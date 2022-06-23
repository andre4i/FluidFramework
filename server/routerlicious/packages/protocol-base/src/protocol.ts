/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    IAudience,
    IDocumentAttributes,
    IClientJoin,
    ICommittedProposal,
    IProcessMessageResult,
    IProposal,
    IQuorum,
    ISequencedClient,
    ISequencedDocumentMessage,
    ISequencedDocumentSystemMessage,
    ISequencedProposal,
    MessageType,
    ISignalMessage,
    ISignalClient,
} from "@fluidframework/protocol-definitions";
import { IQuorumSnapshot, Quorum } from "./quorum";

export interface IScribeProtocolState {
    sequenceNumber: number;
    minimumSequenceNumber: number;
    members: [string, ISequencedClient][];
    proposals: [number, ISequencedProposal, string[]][];
    values: [string, ICommittedProposal][];
}

export function isSystemMessage(message: ISequencedDocumentMessage) {
    switch (message.type) {
        case MessageType.ClientJoin:
        case MessageType.ClientLeave:
        case MessageType.Propose:
        case MessageType.Reject:
        case MessageType.NoOp:
        case MessageType.NoClient:
        case MessageType.Summarize:
        case MessageType.SummaryAck:
        case MessageType.SummaryNack:
            return true;
        default:
            return false;
    }
}

export interface ILocalSequencedClient extends ISequencedClient {
    /**
     * True if the client should have left the quorum, false otherwise
     */
    shouldHaveLeft?: boolean;
}

export type ProtocolHandlerBuilder = (
    attributes: IDocumentAttributes,
    snapshot: IQuorumSnapshot,
    sendProposal: (key: string, value: any) => number,
    audience?: IAudience,
) => IProtocolHandler;

export interface IProtocolHandler {
    readonly audience?: IAudience;
    readonly quorum: IQuorum;
    readonly attributes: IDocumentAttributes;

    setConnectionState(connected: boolean, clientId: string | undefined);
    snapshot(): IQuorumSnapshot;

    close(): void;
    processMessage(message: ISequencedDocumentMessage, local: boolean): IProcessMessageResult;
    processSignal(message: ISignalMessage);
    getProtocolState(): IScribeProtocolState;
}

/**
 * Handles protocol specific ops.
 */
export class ProtocolOpHandler implements IProtocolHandler {
    private readonly _quorum: Quorum;
    public get quorum(): Quorum {
        return this._quorum;
    }

    public readonly term: number;

    constructor(
        public minimumSequenceNumber: number,
        public sequenceNumber: number,
        term: number | undefined,
        members: [string, ISequencedClient][],
        proposals: [number, ISequencedProposal, string[]][],
        values: [string, ICommittedProposal][],
        sendProposal: (key: string, value: any) => number,
        public readonly audience?: IAudience,
    ) {
        this.term = term ?? 1;
        this._quorum = new Quorum(
            members,
            proposals,
            values,
            sendProposal,
        );
    }

    public get attributes(): IDocumentAttributes {
        return {
            minimumSequenceNumber: this.minimumSequenceNumber,
            sequenceNumber: this.sequenceNumber,
            term: this.term,
        };
    }

    setConnectionState(connected: boolean, clientId: string | undefined) {
        this._quorum.setConnectionState(connected, clientId);
    }

    snapshot(): IQuorumSnapshot {
        return this._quorum.snapshot();
    }

    public close() {
        this._quorum.close();
    }

    public processSignal(message: ISignalMessage) {
        if (this.audience === undefined) {
            return;
        }

        const innerContent = message.content as { content: any; type: string; };
        if (innerContent.type === MessageType.ClientJoin) {
            const newClient = innerContent.content as ISignalClient;
            this.audience.addMember(newClient.clientId, newClient.client);
        } else if (innerContent.type === MessageType.ClientLeave) {
            const leftClientId = innerContent.content as string;
            this.audience.removeMember(leftClientId);
        }
    }

    public processMessage(message: ISequencedDocumentMessage, local: boolean): IProcessMessageResult {
        // verify it's moving sequentially
        if (message.sequenceNumber !== this.sequenceNumber + 1) {
            throw new Error(
                `Protocol state is not moving sequentially. ` +
                `Current is ${this.sequenceNumber}. Next is ${message.sequenceNumber}`);
        }

        // Update tracked sequence numbers
        this.sequenceNumber = message.sequenceNumber;
        this.minimumSequenceNumber = message.minimumSequenceNumber;

        let immediateNoOp = false;

        switch (message.type) {
            case MessageType.ClientJoin:
                const systemJoinMessage = message as ISequencedDocumentSystemMessage;
                const join = JSON.parse(systemJoinMessage.data) as IClientJoin;
                const member: ISequencedClient = {
                    client: join.detail,
                    sequenceNumber: systemJoinMessage.sequenceNumber,
                };
                this._quorum.addMember(join.clientId, member);
                break;

            case MessageType.ClientLeave:
                const systemLeaveMessage = message as ISequencedDocumentSystemMessage;
                const clientId = JSON.parse(systemLeaveMessage.data) as string;
                this._quorum.removeMember(clientId);
                break;

            case MessageType.Propose:
                const proposal = message.contents as IProposal;
                this._quorum.addProposal(
                    proposal.key,
                    proposal.value,
                    message.sequenceNumber,
                    local,
                    message.clientSequenceNumber);

                // On a quorum proposal, immediately send a response to expedite the approval.
                immediateNoOp = true;
                break;

            case MessageType.Reject:
                throw new Error("Quorum rejection is removed.");

            default:
        }

        // Notify the quorum of the MSN from the message. We rely on it to handle duplicate values but may
        // want to move that logic to this class.
        this._quorum.updateMinimumSequenceNumber(message);

        return { immediateNoOp };
    }

    /**
     * Gets the scribe protocol state
     */
    public getProtocolState(): IScribeProtocolState {
        // return a new object every time
        // this ensures future state changes will not affect outside callers
        return {
            sequenceNumber: this.sequenceNumber,
            minimumSequenceNumber: this.minimumSequenceNumber,
            ...this._quorum.snapshot(),
        };
    }
}

export class ProtocolOpHandlerWithClientValidation extends ProtocolOpHandler {
    constructor(
        attributes: IDocumentAttributes,
        quorumSnapshot: IQuorumSnapshot,
        sendProposal: (key: string, value: any) => number,
        audience?: IAudience,
    ) {
        super(
            attributes.minimumSequenceNumber,
            attributes.sequenceNumber,
            attributes.term,
            quorumSnapshot.members,
            quorumSnapshot.proposals,
            quorumSnapshot.values,
            sendProposal,
            audience,
        );
    }

    public processMessage(message: ISequencedDocumentMessage, local: boolean): IProcessMessageResult {
        const client: ILocalSequencedClient | undefined = this.quorum.getMember(message.clientId);

        // Check and report if we're getting messages from a clientId that we previously
        // flagged as shouldHaveLeft, or from a client that's not in the quorum but should be
        if (message.clientId != null) {
            if (client === undefined && message.type !== MessageType.ClientJoin) {
                // pre-0.58 error message: messageClientIdMissingFromQuorum
                throw new Error("Remote message's clientId is missing from the quorum");
            }

            if (client?.shouldHaveLeft === true && message.type !== MessageType.NoOp) {
                // pre-0.58 error message: messageClientIdShouldHaveLeft
                throw new Error("Remote message's clientId already should have left");
            }
        }

        return super.processMessage(message, local);
    }
}
