/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import { MockLogger } from "@fluidframework/telemetry-utils";
import { ContainerMessageType } from "../../index.js";
import { BatchMessage, IBatch, OpGroupingManager } from "../../opLifecycle/index.js";

describe("OpGroupingManager", () => {
	const mockLogger = new MockLogger();
	const createBatch = (
		length: number,
		hasReentrantOps?: boolean,
		opHasMetadata: boolean = false,
	): IBatch => ({
		...messagesToBatch(new Array(length).fill(createMessage(opHasMetadata))),
		hasReentrantOps,
	});
	const messagesToBatch = (messages: BatchMessage[]): IBatch => ({
		content: messages,
		contentSizeInBytes: messages
			.map((message) => JSON.stringify(message).length)
			.reduce((a, b) => a + b),
		referenceSequenceNumber: messages[0].referenceSequenceNumber,
	});
	const createMessage = (opHasMetadata: boolean) => ({
		metadata: opHasMetadata ? { flag: true } : undefined,
		localOpMetadata: undefined,
		type: ContainerMessageType.FluidDataStoreOp,
		contents: "0",
		referenceSequenceNumber: 0,
	});

	describe("Configs", () => {
		interface ConfigOption {
			enabled: boolean;
			tooSmall?: boolean;
			reentrant?: boolean;
			reentryEnabled?: boolean;
			expectedResult: boolean;
		}
		const options: ConfigOption[] = [
			{ enabled: false, expectedResult: false },
			{ enabled: true, tooSmall: true, expectedResult: false },
			{ enabled: true, reentrant: true, expectedResult: false },
			{ enabled: true, reentrant: true, reentryEnabled: true, expectedResult: true },
			{ enabled: true, expectedResult: true },
		];

		options.forEach((option) => {
			it(`shouldGroup: groupedBatchingEnabled [${option.enabled}] tooSmall [${
				option.tooSmall === true
			}] reentrant [${option.reentrant === true}] reentryEnabled [${
				option.reentryEnabled === true
			}]`, () => {
				assert.strictEqual(
					new OpGroupingManager(
						{
							groupedBatchingEnabled: option.enabled,
							opCountThreshold: option.tooSmall === true ? 10 : 2,
							reentrantBatchGroupingEnabled: option.reentryEnabled ?? false,
						},
						mockLogger,
					).shouldGroup(createBatch(5, option.reentrant)),
					option.expectedResult,
				);
			});
		});
	});

	describe("groupBatch", () => {
		it("grouped batching disabled", () => {
			const result = new OpGroupingManager(
				{
					groupedBatchingEnabled: false,
					opCountThreshold: 2,
					reentrantBatchGroupingEnabled: false,
				},
				mockLogger,
			).groupBatch(createBatch(5));
			assert.strictEqual(result.content.length, 5);
			assert.deepStrictEqual(result.content, [
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
			]);
		});

		it("grouped batching enabled", () => {
			const result = new OpGroupingManager(
				{
					groupedBatchingEnabled: true,
					opCountThreshold: 2,
					reentrantBatchGroupingEnabled: false,
				},
				mockLogger,
			).groupBatch(createBatch(5));
			assert.strictEqual(result.content.length, 1);
			assert.deepStrictEqual(result.content, [
				{
					contents:
						'{"type":"groupedBatch","contents":[{"contents":0},{"contents":0},{"contents":0},{"contents":0},{"contents":0}]}',
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "groupedBatch",
				},
			]);
		});

		it("grouped batching enabled, not large enough", () => {
			const result = new OpGroupingManager(
				{
					groupedBatchingEnabled: true,
					opCountThreshold: 10,
					reentrantBatchGroupingEnabled: false,
				},
				mockLogger,
			).groupBatch(createBatch(5));
			assert.strictEqual(result.content.length, 5);
			assert.deepStrictEqual(result.content, [
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
				{
					contents: "0",
					localOpMetadata: undefined,
					metadata: undefined,
					referenceSequenceNumber: 0,
					type: "component",
				},
			]);
		});

		it("grouped batching enabled, op metadata not allowed", () => {
			assert.throws(() => {
				new OpGroupingManager(
					{
						groupedBatchingEnabled: true,
						opCountThreshold: 2,
						reentrantBatchGroupingEnabled: false,
					},
					mockLogger,
				).groupBatch(createBatch(5, false, true));
			});
		});
	});

	describe("Fakes clientSequenceNumber when ungrouping", () => {
		it("grouped op", () => {
			const opGroupingManager = new OpGroupingManager(
				{
					groupedBatchingEnabled: true,
					opCountThreshold: 2,
					reentrantBatchGroupingEnabled: true,
				},
				mockLogger,
			);

			const op = {
				clientSequenceNumber: 10,
				contents: {
					type: OpGroupingManager.groupedBatchOp,
					contents: [
						{
							contents: "1",
						},
						{
							contents: "2",
						},
						{
							contents: "3",
						},
					],
				},
			} as any;

			const result = opGroupingManager.ungroupOp(op);

			assert.deepStrictEqual(result, [
				{
					clientSequenceNumber: 1,
					contents: "1",
					compression: undefined,
					metadata: undefined,
				},
				{
					clientSequenceNumber: 2,
					contents: "2",
					compression: undefined,
					metadata: undefined,
				},
				{
					clientSequenceNumber: 3,
					contents: "3",
					compression: undefined,
					metadata: undefined,
				},
			]);
		});

		it("non-grouped op with grouped batching enabled", () => {
			const opGroupingManager = new OpGroupingManager(
				{
					groupedBatchingEnabled: true,
					opCountThreshold: 2,
					reentrantBatchGroupingEnabled: true,
				},
				mockLogger,
			);

			const op = {
				clientSequenceNumber: 10,
				contents: "1",
			} as any;

			const result = opGroupingManager.ungroupOp(op);

			assert.deepStrictEqual(result, [
				{
					clientSequenceNumber: 10,
					contents: "1",
				},
			]);
		});

		it("non-grouped op with grouped batching disabled", () => {
			const opGroupingManager = new OpGroupingManager(
				{
					groupedBatchingEnabled: false,
					opCountThreshold: 2,
					reentrantBatchGroupingEnabled: true,
				},
				mockLogger,
			);

			const op = {
				clientSequenceNumber: 10,
				contents: "1",
			} as any;

			const result = opGroupingManager.ungroupOp(op);

			assert.deepStrictEqual(result, [
				{
					clientSequenceNumber: 10,
					contents: "1",
				},
			]);
		});
	});

	it("Ungrouping multiple times does not mess up groupedBatch messages", () => {
		const groupedBatch = {
			type: "op",
			sequenceNumber: 10,
			clientSequenceNumber: 12,
			contents: {
				type: OpGroupingManager.groupedBatchOp,
				contents: [
					{
						contents: {
							type: ContainerMessageType.FluidDataStoreOp,
							contents: {
								contents: "a",
							},
						},
					},
					{
						contents: {
							type: ContainerMessageType.FluidDataStoreOp,
							contents: {
								contents: "b",
							},
						},
					},
				],
			},
		} as any;
		const opGroupingManager = new OpGroupingManager(
			{
				groupedBatchingEnabled: false,
				opCountThreshold: 2,
				reentrantBatchGroupingEnabled: true,
			},
			mockLogger,
		);

		// Run the groupedBatch through a couple times to ensure it cannot get messed up
		let messagesToUngroup: ISequencedDocumentMessage[] = [groupedBatch];
		let result: ISequencedDocumentMessage[] = [];
		for (let i = 0; i < 4; i++) {
			result = [];
			for (const message of messagesToUngroup) {
				for (const ungroupedOp of opGroupingManager.ungroupOp(message)) {
					result.push(ungroupedOp);
				}
			}
			messagesToUngroup = [...result];
		}

		const expected = [
			{
				type: "op",
				sequenceNumber: 10,
				clientSequenceNumber: 1,
				metadata: undefined,
				compression: undefined,
				contents: {
					type: ContainerMessageType.FluidDataStoreOp,
					contents: {
						contents: "a",
					},
				},
			},
			{
				type: "op",
				sequenceNumber: 10,
				clientSequenceNumber: 2,
				metadata: undefined,
				compression: undefined,
				contents: {
					type: ContainerMessageType.FluidDataStoreOp,
					contents: {
						contents: "b",
					},
				},
			},
		];
		assert.deepStrictEqual(result, expected, "ungrouping should work as expected");
	});
});
