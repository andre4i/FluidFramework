/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { IBatchMessage, IContainerContext, IDeltaManager } from "@fluidframework/container-definitions";
import { IDocumentMessage, ISequencedDocumentMessage, MessageType } from "@fluidframework/protocol-definitions";
import { IBatchProcessor, Outbox } from "../../opLifecycle";
import { BatchMessage, IBatch } from "../../batchManager";
import { PendingStateManager } from "../../pendingStateManager";
import { ContainerMessageType, ContainerRuntimeMessage } from "../..";

describe("Outbox", () => {
    const maxBatchSizeInBytes = 1024;
    interface State {
        deltaManagerFlushCalls: number;
        canSendOps: boolean;
        batchesSubmitted: IBatchMessage[][];
        batchesCompressed: IBatch[];
        individualOpsSubmitted: { type: MessageType; contents: any; batch: boolean; appData?: any; }[];
        pendingOpContents: { type: ContainerMessageType; content: any; }[];
        opsSubmitted: number;
    };
    const state: State = {
        deltaManagerFlushCalls: 0,
        canSendOps: true,
        batchesSubmitted: [],
        batchesCompressed: [],
        individualOpsSubmitted: [],
        pendingOpContents: [],
        opsSubmitted: 0,
    };

    beforeEach(() => {
        state.deltaManagerFlushCalls = 0;
        state.canSendOps = true;
        state.batchesSubmitted.splice(0);
        state.batchesCompressed = [];
        state.individualOpsSubmitted.splice(0);
        state.pendingOpContents.splice(0);
        state.opsSubmitted = 0;
    });

    it("Sending batches", () => {
        const outbox = new Outbox(
            () => state.canSendOps,
            getMockPendingStateManager() as PendingStateManager,
            getMockContext() as IContainerContext,
            {
                enableOpReentryCheck: false,
                maxBatchSizeInBytes,
            },
            {
                compressor: getMockCompressor(),
            },
        );

        const messages = [
            createMessage(ContainerMessageType.FluidDataStoreOp, "0"),
            createMessage(ContainerMessageType.FluidDataStoreOp, "1"),
            createMessage(ContainerMessageType.Attach, "2"),
            createMessage(ContainerMessageType.Attach, "3"),
            createMessage(ContainerMessageType.FluidDataStoreOp, "4"),
            createMessage(ContainerMessageType.FluidDataStoreOp, "5"),
        ];

        outbox.submit(messages[0]);
        outbox.submit(messages[1]);
        outbox.submitAttach(messages[2]);
        outbox.submitAttach(messages[3]);

        outbox.flush();

        outbox.submit(messages[4]);
        outbox.flush();

        outbox.submit(messages[5]);

        assert.equal(state.opsSubmitted, 5);
        assert.equal(state.individualOpsSubmitted.length, 0);
        assert.deepEqual(state.batchesSubmitted, [
            [
                batchedMessage(messages[2], true),
                batchedMessage(messages[3], false),
            ], // Attach messages are always flushed first
            [
                batchedMessage(messages[0], true),
                batchedMessage(messages[1], false),
            ],
            [
                batchedMessage(messages[4]),
            ], // The last message was not batched
        ]);
    });

    it("Will send messages when only when allowed", () => {
        // const outbox = new Outbox(
        //     () => state.canSendOps,
        //     getMockPendingStateManager() as PendingStateManager,
        //     getMockLegacyContext() as IContainerContext,
        //     {
        //         enableOpReentryCheck: false,
        //         maxBatchSizeInBytes,
        //     },
        //     {
        //         compressor: getMockCompressor(),
        //     },
        // );
        // state.canSendOps = false;


    });

    it("Uses legacy path for legacy contexts", () => {
        const outbox = new Outbox(
            () => state.canSendOps,
            getMockPendingStateManager() as PendingStateManager,
            getMockLegacyContext() as IContainerContext,
            {
                enableOpReentryCheck: false,
                maxBatchSizeInBytes,
            },
            {
                compressor: getMockCompressor(),
            },
        );
        outbox.flush();
    });

    it("No limits set on batch managers if compression is enabled", () => {

    });

    it("Compress only if compression is enabled", () => {

    });

    it("Compress only if the batch is larger than the configured limit", () => {

    });


    const getMockDeltaManager = (): Partial<IDeltaManager<ISequencedDocumentMessage, IDocumentMessage>> => ({
        flush() {
            state.deltaManagerFlushCalls++;
        },
    });

    const getMockContext = (): Partial<IContainerContext> => ({
        deltaManager: getMockDeltaManager() as IDeltaManager<ISequencedDocumentMessage, IDocumentMessage>,
        clientDetails: { capabilities: { interactive: true } },
        updateDirtyContainerState: (_dirty: boolean) => { },
        submitFn: (type: MessageType, contents: any, batch: boolean, appData?: any) => {
            state.individualOpsSubmitted.push({ type, contents, batch, appData });
            state.opsSubmitted++;
            return state.opsSubmitted;
        },
        submitBatchFn: (batch: IBatchMessage[]): number => {
            state.batchesSubmitted.push(batch);
            state.opsSubmitted += batch.length;
            return state.opsSubmitted;
        },
    });

    const getMockLegacyContext = (): Partial<IContainerContext> => ({
        deltaManager: getMockDeltaManager() as IDeltaManager<ISequencedDocumentMessage, IDocumentMessage>,
        clientDetails: { capabilities: { interactive: true } },
        updateDirtyContainerState: (_dirty: boolean) => { },
        submitFn: (type: MessageType, contents: any, batch: boolean, appData?: any) => {
            state.individualOpsSubmitted.push({ type, contents, batch, appData });
            state.opsSubmitted++;
            return state.opsSubmitted;
        },
        connected: true,
    });

    const getMockCompressor = (): IBatchProcessor => ({
        process: (batch: IBatch): IBatch => {
            state.batchesCompressed.push(batch);
            return batch;
        },
    });

    const getMockPendingStateManager = (): Partial<PendingStateManager> => ({
        onSubmitMessage: (
            type: ContainerMessageType,
            _clientSequenceNumber: number,
            _referenceSequenceNumber: number,
            content: any,
            _localOpMetadata: unknown,
            _opMetadata: Record<string, unknown> | undefined,
        ): void => {
            state.pendingOpContents.push({ type, content });
        }
    });

    const createMessage = (type: ContainerMessageType, contents: string): BatchMessage => {
        const deserializedContent: ContainerRuntimeMessage = { type, contents };
        return {
            contents: JSON.stringify(deserializedContent),
            deserializedContent,
            metadata: { "test": true },
            localOpMetadata: {},
            referenceSequenceNumber: Infinity,
        };
    };

    const batchedMessage = (message: BatchMessage, batchMarker: boolean | undefined = undefined) => {
        return batchMarker === undefined ?
            { contents: message.contents, metadata: message.metadata } :
            { contents: message.contents, metadata: { ...message.metadata, batch: batchMarker } };
    }
});
