/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from 'assert';
import { BenchmarkType, benchmark } from '@fluid-tools/benchmark';
import { MockContainerRuntimeFactory } from '@fluidframework/test-runtime-utils';
import { EditLog } from '../EditLog.js';
import { SharedTree } from '../SharedTree.js';
import { runSummaryLoadPerfTests } from './utilities/SummaryLoadPerfTests.js';
import { createStableEdits, setUpTestSharedTree } from './utilities/TestUtilities.js';

describe('SharedTree Perf', () => {
	let tree: SharedTree | undefined;
	let containerRuntimeFactory: MockContainerRuntimeFactory | undefined;
	for (const count of [1, 1_000]) {
		benchmark({
			type: BenchmarkType.Measurement,
			title: `get currentView with ${count} sequenced edit(s)`,
			before: () => {
				({ tree, containerRuntimeFactory } = setUpTestSharedTree({ localMode: false }));

				const edits = createStableEdits(count, tree);
				for (let i = 0; i < count; i++) {
					tree.applyEditInternal(edits[i].changes);
				}

				containerRuntimeFactory.processAllMessages();
				const editLog = tree.edits as EditLog;
				assert(editLog.numberOfSequencedEdits === count);
				assert(editLog.numberOfLocalEdits === 0);
			},
			benchmarkFn: () => {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				tree!.currentView;
			},
			after: () => {
				tree = undefined;
				containerRuntimeFactory = undefined;
			},
		});
	}

	runSummaryLoadPerfTests('Summary Load');
});
