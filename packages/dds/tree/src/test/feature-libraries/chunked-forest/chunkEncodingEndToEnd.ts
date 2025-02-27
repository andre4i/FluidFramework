/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { SessionId, createIdCompressor } from "@fluidframework/id-compressor";
import {
	ChangesetLocalId,
	IEditableForest,
	RevisionTagCodec,
	TreeStoredSchemaRepository,
} from "../../../core/index.js";
import { leaf } from "../../../domains/index.js";
import { typeboxValidator } from "../../../external-utilities/index.js";
import {
	Chunker,
	defaultChunkPolicy,
	tryShapeFromSchema,
	// eslint-disable-next-line import/no-internal-modules
} from "../../../feature-libraries/chunked-forest/chunkTree.js";
// eslint-disable-next-line import/no-internal-modules
import { decode } from "../../../feature-libraries/chunked-forest/codec/chunkDecoding.js";
// eslint-disable-next-line import/no-internal-modules
import { TreeShape, UniformChunk } from "../../../feature-libraries/chunked-forest/uniformChunk.js";
import {
	Context,
	DefaultChangeFamily,
	DefaultEditBuilder,
	FlexTreeSchema,
	ForestSummarizer,
	ModularChangeset,
	TreeCompressionStrategy,
	buildChunkedForest,
	createMockNodeKeyManager,
	defaultSchemaPolicy,
	getTreeContext,
	intoStoredSchema,
	makeFieldBatchCodec,
	nodeKeyFieldKey,
} from "../../../feature-libraries/index.js";
import { ForestType } from "../../../shared-tree/index.js";
import { brand } from "../../../util/index.js";
import { flexTreeViewWithContent, numberSequenceRootSchema } from "../../utils.js";

const options = {
	jsonValidator: typeboxValidator,
	forest: ForestType.Optimized,
	summaryEncodeType: TreeCompressionStrategy.Compressed,
};

const context = {
	encodeType: options.summaryEncodeType,
	schema: { schema: intoStoredSchema(numberSequenceRootSchema), policy: defaultSchemaPolicy },
};

const fieldBatchCodec = makeFieldBatchCodec({ jsonValidator: typeboxValidator });
const sessionId = "beefbeef-beef-4000-8000-000000000001" as SessionId;
const idCompressor = createIdCompressor(sessionId);
const revisionTagCodec = new RevisionTagCodec(idCompressor);

describe("End to end chunked encoding", () => {
	it(`insert ops shares reference with the original chunk.`, () => {
		const treeSchema = new TreeStoredSchemaRepository(
			intoStoredSchema(numberSequenceRootSchema),
		);
		const chunker = new Chunker(
			treeSchema,
			defaultSchemaPolicy,
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			defaultChunkPolicy.uniformChunkNodeCount,
			tryShapeFromSchema,
		);

		const forest = buildChunkedForest(chunker);
		const numberShape = new TreeShape(leaf.number.name, true, []);
		const chunk = new UniformChunk(numberShape.withTopLevelLength(4), [1, 2, 3, 4]);
		assert(!chunk.isShared());
		const changeLog: ModularChangeset[] = [];

		// This function is declared in the test to have access to push changes to the changelog declared outside of this function.
		function createFlexTree(editableForest: IEditableForest, schema: FlexTreeSchema): Context {
			const changeReceiver = (change: ModularChangeset) => {
				changeLog.push(change);
			};
			const dummyEditor = new DefaultEditBuilder(
				new DefaultChangeFamily(revisionTagCodec, fieldBatchCodec, {
					jsonValidator: typeboxValidator,
				}),
				changeReceiver,
			);
			return getTreeContext(
				schema,
				editableForest,
				dummyEditor,
				createMockNodeKeyManager(),
				brand(nodeKeyFieldKey),
			);
		}

		const flexTree = createFlexTree(forest, numberSequenceRootSchema);
		const root = flexTree.root;
		assert(root.is(numberSequenceRootSchema.rootFieldSchema));
		root.insertAt(0, chunk.cursor());

		// Check that inserted change contains chunk which is reference equal to the original chunk.
		const insertedChange = changeLog[0];
		assert(insertedChange.builds !== undefined);
		const insertedChunk = insertedChange.builds.get(undefined)?.get(0 as ChangesetLocalId);
		assert.equal(insertedChunk, chunk);
		assert(chunk.isShared());
	});

	it.skip(`summary values are correct, and shares reference with the original chunk when inserting content.`, () => {
		const numberShape = new TreeShape(leaf.number.name, true, []);
		const chunk = new UniformChunk(numberShape.withTopLevelLength(4), [1, 2, 3, 4]);
		assert(!chunk.isShared());
		const flexTree = flexTreeViewWithContent({
			schema: numberSequenceRootSchema,
			initialTree: [],
		});

		flexTree.flexTree.insertAt(0, chunk.cursor());

		const forestSummarizer = new ForestSummarizer(
			flexTree.context.forest as IEditableForest,
			revisionTagCodec,
			fieldBatchCodec,
			context,
			options,
		);

		// This function is declared in the test to have access to the original uniform chunk for comparison.
		function stringifier(content: unknown) {
			const insertedChunk = decode((content as any).fields);
			assert.equal(insertedChunk, chunk);
			assert(chunk.isShared());
			return JSON.stringify(content);
		}
		forestSummarizer.getAttachSummary(stringifier);
	});

	it.skip(`summary values are correct, and shares reference with the original chunk when initializing with content.`, () => {
		const numberShape = new TreeShape(leaf.number.name, true, []);
		const chunk = new UniformChunk(numberShape.withTopLevelLength(4), [1, 2, 3, 4]);
		assert(!chunk.isShared());

		const flexTree = flexTreeViewWithContent({
			schema: numberSequenceRootSchema,
			initialTree: chunk.cursor(),
		});

		const forestSummarizer = new ForestSummarizer(
			flexTree.context.forest as IEditableForest,
			revisionTagCodec,
			fieldBatchCodec,
			context,
			options,
		);

		// This function is declared in the test to have access to the original uniform chunk for comparison.
		function stringifier(content: unknown) {
			const insertedChunk = decode((content as any).fields);
			assert.equal(insertedChunk, chunk);
			assert(chunk.isShared());
			return JSON.stringify(content);
		}
		forestSummarizer.getAttachSummary(stringifier);
	});
});
