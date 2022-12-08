/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { compress } from "lz4js";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { IsoBuffer } from "@fluidframework/common-utils";
import { ContainerRuntimeMessage, ContainerMessageType } from "../..";
import { OpDecompressor } from "../../opLifecycle";


function generateCompressedBatchMessage(length: number, metadata = true): ISequencedDocumentMessage {
    const batch: ContainerRuntimeMessage[] = [];
    for (let i = 0; i < length; i++) {
        batch.push({ contents: `value${i}`, type: ContainerMessageType.FluidDataStoreOp });
    }

    const contentsAsBuffer = new TextEncoder().encode(JSON.stringify(batch));
    const compressedContents = compress(contentsAsBuffer);
    const compressedContent = IsoBuffer.from(compressedContents).toString("base64");

    const messageBase: ISequencedDocumentMessage = {
        contents: { packedContents: compressedContent },
        clientId: "clientId",
        sequenceNumber: 1,
        term: 1,
        minimumSequenceNumber: 1,
        clientSequenceNumber: 1,
        referenceSequenceNumber: 1,
        type: "type",
        timestamp: 1,
        compression: "lz4",
    };

    let opMetadata;
    if (metadata) {
        opMetadata = { compressed: true };
    }

    // Single compressed message won't have batch metadata
    if (length === 1) {
        return {
            ...messageBase,
            metadata: opMetadata,
        };
    }

    return {
        ...messageBase,
        metadata: { ...opMetadata, batch: true },
    };
}

const emptyMessage: ISequencedDocumentMessage = {
    contents: {},
    clientId: "clientId",
    sequenceNumber: 1,
    term: 1,
    minimumSequenceNumber: 1,
    clientSequenceNumber: 1,
    referenceSequenceNumber: 1,
    type: "type",
    timestamp: 1,
};

const endBatchEmptyMessage: ISequencedDocumentMessage = {
    contents: {},
    metadata: { batch: false },
    clientId: "clientId",
    sequenceNumber: 1,
    term: 1,
    minimumSequenceNumber: 1,
    clientSequenceNumber: 1,
    referenceSequenceNumber: 1,
    type: "type",
    timestamp: 1,
};

describe("OpDecompressor", () => {
    let decompressor: OpDecompressor;
    beforeEach(() => {
        decompressor = new OpDecompressor();
    });

    it("Processes single compressed op", () => {
        const result = decompressor.processMessage(generateCompressedBatchMessage(1));
        assert.equal(result.state, "Processed");
        assert.strictEqual(result.message.contents.contents, "value0");
    });

    it("Processes multiple compressed ops", () => {
        const rootMessage = generateCompressedBatchMessage(5);
        const firstMessageResult = decompressor.processMessage(rootMessage);

        assert.equal(firstMessageResult.state, "Accepted");
        assert.strictEqual(firstMessageResult.message.contents.contents, "value0");

        for (let i = 1; i < 4; i++) {
            const result = decompressor.processMessage(emptyMessage);
            assert.equal(result.state, "Accepted");
            assert.strictEqual(result.message.contents.contents, `value${i}`);
        }

        const lastMessageResult = decompressor.processMessage(endBatchEmptyMessage);
        assert.equal(lastMessageResult.state, "Processed");
        assert.strictEqual(lastMessageResult.message.contents.contents, "value4");
    });

    it("Processes multiple batches of compressed ops", () => {
        const rootMessage = generateCompressedBatchMessage(5);
        const firstMessageResult = decompressor.processMessage(rootMessage);

        assert.equal(firstMessageResult.state, "Accepted");
        assert.strictEqual(firstMessageResult.message.contents.contents, "value0");

        for (let i = 1; i < 4; i++) {
            const result = decompressor.processMessage(emptyMessage);
            assert.equal(result.state, "Accepted");
            assert.strictEqual(result.message.contents.contents, `value${i}`);
        }

        const lastMessageResult = decompressor.processMessage(endBatchEmptyMessage);
        assert.equal(lastMessageResult.state, "Processed");
        assert.strictEqual(lastMessageResult.message.contents.contents, "value4");

        const nextRootMessage = generateCompressedBatchMessage(3);
        const nextFirstMessageResult = decompressor.processMessage(nextRootMessage);
        assert.equal(nextFirstMessageResult.state, "Accepted");
        assert.strictEqual(nextFirstMessageResult.message.contents.contents, "value0");

        const middleMessageResult = decompressor.processMessage(emptyMessage);
        assert.equal(middleMessageResult.state, "Accepted");
        assert.strictEqual(middleMessageResult.message.contents.contents, "value1");

        const endBatchEmptyMessageResult = decompressor.processMessage(endBatchEmptyMessage);
        assert.equal(endBatchEmptyMessageResult.state, "Processed");
        assert.strictEqual(endBatchEmptyMessageResult.message.contents.contents, "value2");
    });

    it("Processes single compressed op wth only protocol property", () => {
        const rootMessage = generateCompressedBatchMessage(5, false);
        const firstMessageResult = decompressor.processMessage(rootMessage);

        assert.equal(firstMessageResult.state, "Accepted");
        assert.strictEqual(firstMessageResult.message.contents.contents, "value0");
    });

    it("Ignores ops without compression", () => {
        const rootMessage = { ...generateCompressedBatchMessage(5), metadata: undefined, compression: undefined };
        const firstMessageResult = decompressor.processMessage(rootMessage);

        assert.equal(firstMessageResult.state, "Skipped");
        assert.deepStrictEqual(firstMessageResult.message, rootMessage);
    });
});
