/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { IDeltaManager } from "@fluidframework/container-definitions";
import {
    IDocumentMessage,
    ISequencedDocumentMessage,
    ISequencedDocumentSystemMessage,
} from "@fluidframework/protocol-definitions";
import { isRuntimeMessage } from "@fluidframework/driver-utils";

export class OpTrackerState {
    constructor(
        public readonly nonSystemOpCount: number,
        public readonly opsSize: number,
    ) {}

    delta(other: OpTrackerState) {
        return new OpTrackerState(this.nonSystemOpCount - other.nonSystemOpCount, this.opsSize - other.opsSize);
    }

    update(nonSystemOpCount: number, opsSize: number) {
        return new OpTrackerState(this.nonSystemOpCount + nonSystemOpCount, this.opsSize + opsSize);
    }

    static default = new OpTrackerState(0, 0);
}

export class OpTracker {
    private readonly stateAtSequence = new Map<number, OpTrackerState>();
    private lastResetSequence: number;

    public currentState(sequenceNumber: number): OpTrackerState | undefined {
        const older = this.stateAtSequence.get(this.lastResetSequence);
        const newer = this.stateAtSequence.get(sequenceNumber);
        if (older === undefined || newer === undefined) {
            return undefined;
        }

        return older.delta(newer);
    }

    public constructor(
        deltaManager: IDeltaManager<ISequencedDocumentMessage, IDocumentMessage>,
        disabled: boolean,
    ) {
        this.lastResetSequence = deltaManager.lastSequenceNumber;

        if (disabled) {
            return;
        }

        deltaManager.inbound.on("push", (message: ISequencedDocumentMessage) => {
            // Some messages my already have string contents at this point,
            // so stringifying them again will add inaccurate overhead.
            const messageContent = typeof message.contents === "string" ?
                message.contents :
                JSON.stringify(message.contents);
            const messageData = OpTracker.messageHasData(message) ? message.data : "";
            const messageSize = messageContent.length + messageData.length;

            const id = OpTracker.messageId(message);
            const prevId = id - 1;

            if (this.stateAtSequence.size > 0 && this.stateAtSequence[prevId] === undefined) {
                return;
            }

            const prev = this.stateAtSequence[prevId] === undefined ?
                OpTrackerState.default : this.stateAtSequence[prevId];

            this.stateAtSequence[id] = prev.update(isRuntimeMessage(message) ? 1 : 0, messageSize);
        });
    }

    private static messageId(message: ISequencedDocumentMessage): number {
        return message.sequenceNumber;
    }

    private static messageHasData(message: ISequencedDocumentMessage): message is ISequencedDocumentSystemMessage {
        return (message as ISequencedDocumentSystemMessage).data !== undefined;
    }

    public reset(sequenceNumber: number) {
        this.lastResetSequence = sequenceNumber;
        this.stateAtSequence.clear();
    }
}
