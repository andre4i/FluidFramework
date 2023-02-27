/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { decompress } from "lz4js";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { assert, IsoBuffer, Uint8ArrayToString } from "@fluidframework/common-utils";
import { ChildLogger } from "@fluidframework/telemetry-utils";
import { ITelemetryLogger } from "@fluidframework/common-definitions";
import { CompressionAlgorithms } from "../containerRuntime";
import { IMessageProcessingResult } from "./definitions";

/**
 * State machine that "unrolls" contents of compressed batches of ops after decompressing them.
 * This class relies on some implicit contracts defined below:
 * 1. A compressed batch will have its first message with batch metadata set to true and compressed set to true
 * 2. Messages in the middle of a compressed batch will have neither batch metadata nor the compression property set
 * 3. The final message of a batch will have batch metadata set to false
 * 4. An individually compressed op will have undefined batch metadata and compression set to true
 */
export class OpDecompressor {
	private activeBatch = false;
	private rootMessageContents: any | undefined;
	private processedCount = 0;
	private readonly logger;

	constructor(logger: ITelemetryLogger, private readonly disabled = false) {
		this.logger = ChildLogger.create(logger, "OpDecompressor");
	}

	public processMessage(message: ISequencedDocumentMessage): IMessageProcessingResult {
		assert(
			message.compression === undefined || message.compression === CompressionAlgorithms.lz4,
			0x511 /* Only lz4 compression is supported */,
		);

		if (message.metadata?.batch === true && this.isCompressed(message)) {
			// Beginning of a compressed batch
			assert(this.activeBatch === false, 0x4b8 /* shouldn't have multiple active batches */);
			if (message.compression) {
				// lz4 is the only supported compression algorithm for now
				assert(
					message.compression === CompressionAlgorithms.lz4,
					0x4b9 /* lz4 is currently the only supported compression algorithm */,
				);
			}

			this.activeBatch = true;

			const contents = IsoBuffer.from(message.contents.packedContents, "base64");
			const decompressedMessage = decompress(contents);
			const intoString = Uint8ArrayToString(decompressedMessage);
			const asObj = JSON.parse(intoString);
			this.rootMessageContents = asObj;
			if (this.disabled) {
				throw new Error("Canary");
			}

			return {
				message: newMessage(message, this.rootMessageContents[this.processedCount++]),
				state: "Accepted",
			};
		}

		if (
			this.rootMessageContents !== undefined &&
			message.metadata?.batch === undefined &&
			this.activeBatch
		) {
			assert(message.contents === undefined, 0x512 /* Expecting empty message */);

			// Continuation of compressed batch
			return {
				message: newMessage(message, this.rootMessageContents[this.processedCount++]),
				state: "Accepted",
			};
		}

		if (this.rootMessageContents !== undefined && message.metadata?.batch === false) {
			// End of compressed batch
			const returnMessage = newMessage(
				message,
				this.rootMessageContents[this.processedCount++],
			);

			this.activeBatch = false;
			this.rootMessageContents = undefined;
			this.processedCount = 0;

			if (this.disabled) {
				throw new Error("Canary");
			}

			return {
				message: returnMessage,
				state: "Processed",
			};
		}

		if (message.metadata?.batch === undefined && this.isCompressed(message)) {
			// Single compressed message
			assert(
				this.activeBatch === false,
				0x4ba /* shouldn't receive compressed message in middle of a batch */,
			);

			const contents = IsoBuffer.from(message.contents.packedContents, "base64");
			const decompressedMessage = decompress(contents);
			const intoString = new TextDecoder().decode(decompressedMessage);
			const asObj = JSON.parse(intoString);

			if (this.disabled) {
				throw new Error("Canary");
			}

			return {
				message: newMessage(message, asObj[0]),
				state: "Processed",
			};
		}

		return {
			message,
			state: "Skipped",
		};
	}

	private isCompressed(message: ISequencedDocumentMessage) {
		if (message.compression === CompressionAlgorithms.lz4) {
			return true;
		}

		// This condition holds true for compressed messages, regardless of metadata.
		// Back-compat self healing mechanism for ADO:3538, as loaders from
		// version client_v2.0.0-internal.1.2.0 to client_v2.0.0-internal.2.2.0 do not
		// support adding the proper compression metadata to compressed messages submitted
		// by the runtime. Should be removed after the loader reaches sufficient saturation
		// for a version greater or equal than client_v2.0.0-internal.2.2.0.
		try {
			if (
				typeof message.contents === "object" &&
				message.contents?.packedContents !== undefined &&
				Object.keys(message.contents).length === 1 &&
				typeof message.contents?.packedContents === "string" &&
				message.contents.packedContents.length > 0 &&
				btoa(atob(message.contents.packedContents)) === message.contents.packedContents
			) {
				this.logger.sendTelemetryEvent({
					eventName: "LegacyCompression",
					type: message.type,
					batch: message.metadata?.batch,
				});
				return true;
			}
		} catch (err) {
			return false;
		}

		return false;
	}
}

// We should not be mutating the input message nor its metadata
const newMessage = (
	originalMessage: ISequencedDocumentMessage,
	contents: any,
): ISequencedDocumentMessage => ({
	...originalMessage,
	contents,
	compression: undefined,
	metadata: { ...originalMessage.metadata },
});
