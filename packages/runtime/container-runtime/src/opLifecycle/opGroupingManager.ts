/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { assert } from "@fluidframework/common-utils";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { ContainerMessageType } from "..";
import { IBatch } from "./definitions";

interface IGroupedMessage {
	contents?: unknown;
	metadata?: Record<string, unknown>;
	compression?: string;
}

export class OpGroupingManager {
	static groupedBatchOp = "groupedBatch";

	constructor(private readonly groupedBatchingEnabled: boolean) {}

	public groupBatch(batch: IBatch): IBatch {
		if (batch.content.length < 2 || !this.groupedBatchingEnabled) {
			return batch;
		}

		if (batch.hasReentrantOps === true) {
			// Batches with reentrant ops cannot be grouped as grouping would hide
			// the sequence numbers of the individual ops and reentrant ops may have
			// been based on the remote (original) op reference sequence number.
			// This can cause conflicts in the data model, as there will be no way to
			// establish an order between op within the same batch when they are processed
			// by a remote client.
			// Eventually, all batches must be grouped. This exclusion is to be removed
			// after ADO:2322 is fixed.
			return batch;
		}

		for (const message of batch.content) {
			// Blob attaches cannot be grouped (grouped batching would hide metadata)
			if (message.type === ContainerMessageType.BlobAttach) {
				return batch;
			}
			if (message.metadata) {
				const keys = Object.keys(message.metadata);
				assert(keys.length < 2, 0x5dd /* cannot group ops with metadata */);
				assert(
					keys.length === 0 || keys[0] === "batch",
					0x5de /* unexpected op metadata */,
				);
			}
		}

		const serializedContent = JSON.stringify({
			type: OpGroupingManager.groupedBatchOp,
			contents: batch.content.map<IGroupedMessage>((message) => ({
				contents: message.contents === undefined ? undefined : JSON.parse(message.contents),
				metadata: message.metadata,
				compression: message.compression,
			})),
		});

		const groupedBatch: IBatch = {
			...batch,
			content: [
				{
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: batch.content[0].referenceSequenceNumber,
					contents: serializedContent,
					type: OpGroupingManager.groupedBatchOp as ContainerMessageType,
				},
			],
		};
		return groupedBatch;
	}

	public ungroupOp(op: ISequencedDocumentMessage): ISequencedDocumentMessage[] {
		if (op.contents?.type !== OpGroupingManager.groupedBatchOp) {
			return [op];
		}

		const messages = op.contents.contents as IGroupedMessage[];
		let fakeCsn = 1;
		return messages.map((subMessage) => ({
			...op,
			clientSequenceNumber: fakeCsn++,
			contents: subMessage.contents,
			metadata: subMessage.metadata,
			compression: subMessage.compression,
		}));
	}
}
