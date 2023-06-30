/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import {
	MockFluidDataStoreRuntime,
	MockContainerRuntimeFactoryForRebasing,
	MockContainerRuntimeForRebasing,
	MockStorage,
} from "@fluidframework/test-runtime-utils";
import { SharedString } from "../sharedString";
import { SharedStringFactory } from "../sequenceFactory";
import { IMergeTreeInsertMsg } from "@fluidframework/merge-tree";

describe("Rebasing", () => {
	let containerRuntimeFactory: MockContainerRuntimeFactoryForRebasing;
	let containerRuntime1: MockContainerRuntimeForRebasing;
	let containerRuntime2: MockContainerRuntimeForRebasing;
	let sharedString1: SharedString;
	let sharedString2: SharedString;

	const createSharedString = async (
		id: string,
		factory: MockContainerRuntimeFactoryForRebasing,
	): Promise<[SharedString, MockContainerRuntimeForRebasing]> => {
		const dataStoreRuntime = new MockFluidDataStoreRuntime();
		dataStoreRuntime.local = false;
		const containerRuntime = factory.createContainerRuntime(dataStoreRuntime);
		const services = {
			deltaConnection: dataStoreRuntime.createDeltaConnection(),
			objectStorage: new MockStorage(),
		};
		const sharedString = new SharedString(dataStoreRuntime, id, SharedStringFactory.Attributes);
		sharedString.initializeLocal();
		sharedString.connect(services);
		return [sharedString, containerRuntime];
	};

	beforeEach(async () => {
		containerRuntimeFactory = new MockContainerRuntimeFactoryForRebasing();
		[sharedString1, containerRuntime1] = await createSharedString(
			"shared-string-1",
			containerRuntimeFactory,
		);
		[sharedString2, containerRuntime2] = await createSharedString(
			"shared-string-2",
			containerRuntimeFactory,
		);
	});

	it("Rebasing ops maintains eventual consistency", async () => {
		sharedString1.insertText(0, "ad");
		sharedString1.insertText(1, "c");
		containerRuntimeFactory.processOneMessage();
		containerRuntime2.rebase();
		containerRuntimeFactory.processAllMessages();

		sharedString2.on("sequenceDelta", (sequenceDeltaEvent) => {
			if ((sequenceDeltaEvent.opArgs.op as IMergeTreeInsertMsg).seg === "b") {
				sharedString2.insertText(3, "x");
				containerRuntime2.rebase();
			}
		});

		sharedString1.insertText(1, "b");
		sharedString2.insertText(0, "y");
		containerRuntime2.rebase();
		containerRuntimeFactory.processAllMessages();

		sharedString2.insertText(0, "z");
		containerRuntimeFactory.processAllMessages();

		assert.strictEqual(sharedString1.getText(), "zyaxbcd");
		assert.strictEqual(
			sharedString1.getText(),
			sharedString2.getText(),
			"SharedString eventual consistency broken",
		);
	});
});
