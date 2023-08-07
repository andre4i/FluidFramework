/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";

import { IDirectory, SharedDirectory, SharedMap } from "@fluidframework/map";
import { requestFluidObject } from "@fluidframework/runtime-utils";
import { ConfigTypes, IConfigProviderBase } from "@fluidframework/telemetry-utils";
import {
	ChannelFactoryRegistry,
	DataObjectFactoryType,
	ITestContainerConfig,
	ITestFluidObject,
	ITestObjectProvider,
} from "@fluidframework/test-utils";
import {
	describeNoCompat,
	itExpectsSkipsFailureOnSpecificDrivers,
	itSkipsFailureOnSpecificDrivers,
} from "@fluid-internal/test-version-utils";
import { SharedString } from "@fluidframework/sequence";
import { IContainer } from "@fluidframework/container-definitions";
import { IMergeTreeInsertMsg } from "@fluidframework/merge-tree";
import { FlushMode } from "@fluidframework/runtime-definitions";

describeNoCompat("Concurrent op processing via DDS event handlers", (getTestObjectProvider) => {
	const mapId = "mapKey";
	const sharedStringId = "sharedStringKey";
	const sharedDirectoryId = "sharedDirectoryKey";
	const registry: ChannelFactoryRegistry = [
		[mapId, SharedMap.getFactory()],
		[sharedStringId, SharedString.getFactory()],
		[sharedDirectoryId, SharedDirectory.getFactory()],
	];
	const testContainerConfig: ITestContainerConfig = {
		fluidDataObjectType: DataObjectFactoryType.Test,
		registry,
	};
	let provider: ITestObjectProvider;
	let container1: IContainer;
	let container2: IContainer;
	let dataObject1: ITestFluidObject;
	let dataObject2: ITestFluidObject;
	let sharedMap1: SharedMap;
	let sharedMap2: SharedMap;
	let sharedString1: SharedString;
	let sharedString2: SharedString;
	let sharedDirectory1: SharedDirectory;
	let sharedDirectory2: SharedDirectory;

	const configProvider = (settings: Record<string, ConfigTypes>): IConfigProviderBase => ({
		getRawConfig: (name: string): ConfigTypes => settings[name],
	});

	const mapsAreEqual = (a: SharedMap, b: SharedMap) =>
		a.size === b.size && [...a.entries()].every(([key, value]) => b.get(key) === value);

	beforeEach(async () => {
		provider = getTestObjectProvider();
	});

	const setupContainers = async (
		containerConfig: ITestContainerConfig,
		featureGates: Record<string, ConfigTypes> = {},
	) => {
		const configWithFeatureGates = {
			// AB#3986 track work to removing this exception using simulateReadConnectionUsingDelay
			simulateReadConnectionUsingDelay: false,
			...containerConfig,
			loaderProps: { configProvider: configProvider(featureGates) },
		};
		container1 = await provider.makeTestContainer(configWithFeatureGates);
		container2 = await provider.loadTestContainer(configWithFeatureGates);

		dataObject1 = await requestFluidObject<ITestFluidObject>(container1, "default");
		dataObject2 = await requestFluidObject<ITestFluidObject>(container2, "default");

		sharedMap1 = await dataObject1.getSharedObject<SharedMap>(mapId);
		sharedMap2 = await dataObject2.getSharedObject<SharedMap>(mapId);

		sharedString1 = await dataObject1.getSharedObject<SharedString>(sharedStringId);
		sharedString2 = await dataObject2.getSharedObject<SharedString>(sharedStringId);

		sharedDirectory1 = await dataObject1.getSharedObject<SharedDirectory>(sharedDirectoryId);
		sharedDirectory2 = await dataObject2.getSharedObject<SharedDirectory>(sharedDirectoryId);

		await provider.ensureSynchronized();
	};

	itExpectsSkipsFailureOnSpecificDrivers(
		"Should close the container when submitting an op while processing a batch",
		[
			{
				eventName: "fluid:telemetry:Container:ContainerClose",
				error: "Op was submitted from within a `ensureNoDataModelChanges` callback",
			},
		],
		["tinylicious", "t9s"], // This test is flaky on Tinylicious. ADO:5010
		async () => {
			await setupContainers({
				...testContainerConfig,
				runtimeOptions: {
					enableOpReentryCheck: true,
				},
			});

			sharedMap1.on("valueChanged", (changed) => {
				if (changed.key !== "key2") {
					sharedMap1.set("key2", `${sharedMap1.get("key1")} updated`);
				}
			});

			assert.throws(() => {
				sharedMap1.set("key1", "1");
			});

			sharedMap2.set("key2", "2");
			await provider.ensureSynchronized();

			// The offending container is closed
			assert.ok(container1.closed);

			// The other container is fine
			assert.equal(sharedMap2.get("key1"), undefined);
			assert.equal(sharedMap2.get("key2"), "2");
			assert.ok(!mapsAreEqual(sharedMap1, sharedMap2));
		},
	);

	[false, true].forEach((enableGroupedBatching) => {
		itSkipsFailureOnSpecificDrivers(
			`Eventual consistency with op reentry - ${
				enableGroupedBatching ? "Grouped" : "Regular"
			} batches`,
			["tinylicious", "t9s"], // This test is flaky on Tinylicious. ADO:5010
			async () => {
				await setupContainers({
					...testContainerConfig,
					runtimeOptions: {
						enableGroupedBatching,
					},
				});

				sharedString1.insertText(0, "ad");
				sharedString1.insertText(1, "c");
				await provider.ensureSynchronized();

				sharedString2.on("sequenceDelta", (sequenceDeltaEvent) => {
					if ((sequenceDeltaEvent.opArgs.op as IMergeTreeInsertMsg).seg === "b") {
						sharedString2.insertText(3, "x");
					}
				});
				sharedMap2.on("valueChanged", (changed1) => {
					if (changed1.key !== "key2" && changed1.key !== "key3") {
						sharedMap2.on("valueChanged", (changed2) => {
							if (changed2.key !== "key3") {
								sharedMap2.set("key3", `${sharedMap1.get("key1")} updated`);
							}
						});

						sharedMap2.set("key2", "3");
					}
				});

				sharedMap1.set("key1", "1");

				sharedString1.insertText(1, "b");
				sharedString2.insertText(0, "y");
				await provider.ensureSynchronized();

				// The offending container is still alive
				sharedString2.insertText(0, "z");
				await provider.ensureSynchronized();

				assert.strictEqual(sharedString1.getText(), "zyabxcd");
				assert.strictEqual(
					sharedString1.getText(),
					sharedString2.getText(),
					"SharedString eventual consistency broken",
				);

				assert.strictEqual(sharedMap1.get("key1"), "1");
				assert.strictEqual(sharedMap1.get("key2"), "3");
				assert.strictEqual(sharedMap1.get("key3"), "1 updated");
				assert.ok(
					mapsAreEqual(sharedMap1, sharedMap2),
					"SharedMap eventual consistency broken",
				);

				// Both containers are alive at the end
				assert.ok(!container1.closed, "Local container is closed");
				assert.ok(!container2.closed, "Remote container is closed");
			},
		);

		const areDirectoriesEqual = (a: IDirectory | undefined, b: IDirectory | undefined) => {
			if (a === undefined || b === undefined) {
				assert.strictEqual(a, b, "Both directories should be undefined");
				return;
			}

			const leftKeys = Array.from(a.keys());
			const rightKeys = Array.from(b.keys());
			assert.strictEqual(
				leftKeys.length,
				rightKeys.length,
				"Number of keys should be the same",
			);
			leftKeys.forEach((key) => {
				const left = JSON.stringify(a.get(key));
				const right = JSON.stringify(b.get(key));
				assert.strictEqual(left, right, "Key values should be the same");
			});

			const leftSubdirectories = Array.from(a.subdirectories());
			const rightSubdirectories = Array.from(b.subdirectories());
			assert.strictEqual(
				leftSubdirectories.length,
				rightSubdirectories.length,
				"Number of subdirectories should be the same",
			);

			leftSubdirectories.forEach(([name]) =>
				areDirectoriesEqual(a.getSubDirectory(name), b.getSubDirectory(name)),
			);
		};

		it(`Eventual consistency for shared directories with op reentry - ${
			enableGroupedBatching ? "Grouped" : "Regular"
		} batches`, async () => {
			await setupContainers({
				...testContainerConfig,
				runtimeOptions: {
					enableGroupedBatching,
				},
			});

			const concurrentValue = 10;
			const finalConcurrentValue = 100;
			const topLevel = "root";
			const innerLevel = "inner";
			const key = "key";
			sharedDirectory1
				.createSubDirectory(topLevel)
				.createSubDirectory(innerLevel)
				.set(key, concurrentValue);
			sharedDirectory2
				.createSubDirectory(topLevel)
				.createSubDirectory(innerLevel)
				.set(key, concurrentValue);

			await provider.ensureSynchronized();
			areDirectoriesEqual(sharedDirectory1, sharedDirectory2);

			const concurrentValue1 = concurrentValue + 10;
			const concurrentValue2 = concurrentValue + 20;

			sharedDirectory2
				.getSubDirectory(topLevel)
				?.getSubDirectory(innerLevel)
				?.set(key, concurrentValue2);
			sharedDirectory1
				.getSubDirectory(topLevel)
				?.getSubDirectory(innerLevel)
				?.set(key, concurrentValue1);
			sharedDirectory1
				.getSubDirectory(topLevel)
				?.getSubDirectory(innerLevel)
				?.set(key, "foobar");
			sharedDirectory1
				.getSubDirectory(topLevel)
				?.getSubDirectory(innerLevel)
				?.set(key, finalConcurrentValue);

			await provider.ensureSynchronized();
			areDirectoriesEqual(sharedDirectory1, sharedDirectory2);
			assert.strictEqual(
				sharedDirectory2.getSubDirectory(topLevel)?.getSubDirectory(innerLevel)?.get(key),
				finalConcurrentValue,
			);
		});
	});

	describe("Reentry safeguards", () => {
		itExpectsSkipsFailureOnSpecificDrivers(
			"Flushing is not supported",
			[
				{
					eventName: "fluid:telemetry:Container:ContainerClose",
					error: "Flushing is not supported inside DDS event handlers",
				},
			],
			["tinylicious", "t9s"], // This test is flaky on Tinylicious. ADO:5010
			async () => {
				await setupContainers({
					...testContainerConfig,
					runtimeOptions: {
						flushMode: FlushMode.Immediate,
					},
				});

				sharedString1.on("sequenceDelta", () =>
					assert.throws(() =>
						dataObject1.context.containerRuntime.orderSequentially(() =>
							sharedMap1.set("0", 0),
						),
					),
				);

				sharedString1.insertText(0, "ad");
				await provider.ensureSynchronized();
			},
		);

		it("Flushing is supported if it happens in the next batch", async () => {
			await setupContainers({
				...testContainerConfig,
				runtimeOptions: {
					flushMode: FlushMode.Immediate,
				},
			});

			sharedString1.on("sequenceDelta", (sequenceDeltaEvent) => {
				if ((sequenceDeltaEvent.opArgs.op as IMergeTreeInsertMsg).seg === "ad") {
					void Promise.resolve().then(() => {
						sharedString1.insertText(0, "bc");
					});
				}
			});

			sharedString1.insertText(0, "ad");
			await provider.ensureSynchronized();
			assert.strictEqual(sharedString1.getText(), "bcad");
		});
	});

	it("Should throw when submitting an op while handling an event - offline", async () => {
		await setupContainers({
			...testContainerConfig,
			runtimeOptions: {
				enableOpReentryCheck: true,
			},
		});

		await container1.deltaManager.inbound.pause();
		await container1.deltaManager.outbound.pause();

		sharedMap1.on("valueChanged", (changed) => {
			if (changed.key !== "key2") {
				sharedMap1.set("key2", `${sharedMap1.get("key1")} updated`);
			}
		});

		assert.throws(() => {
			sharedMap1.set("key1", "1");
		});

		container1.deltaManager.inbound.resume();
		container1.deltaManager.outbound.resume();

		await provider.ensureSynchronized();

		// The offending container is not closed
		assert.ok(!container1.closed);
		assert.ok(!mapsAreEqual(sharedMap1, sharedMap2));
	});

	describe("Allow reentry", () =>
		[
			{
				options: testContainerConfig,
				featureGates: {},
				name: "Default config and feature gates",
			},
			{
				options: {
					...testContainerConfig,
					runtimeOptions: {
						enableOpReentryCheck: true,
					},
				},
				featureGates: { "Fluid.ContainerRuntime.DisableOpReentryCheck": true },
				name: "Enabled by options, disabled by feature gate",
			},
		].forEach((testConfig) => {
			itSkipsFailureOnSpecificDrivers(
				`Should not close the container when submitting an op while processing a batch [${testConfig.name}]`,
				["tinylicious", "t9s"], // This test is flaky on Tinylicious. ADO:5010
				async () => {
					await setupContainers(testConfig.options, testConfig.featureGates);

					sharedMap1.on("valueChanged", (changed) => {
						if (changed.key !== "key2") {
							sharedMap1.set("key2", `${sharedMap1.get("key1")} updated`);
						}
					});

					const outOfOrderObservations: string[] = [];
					sharedMap1.on("valueChanged", (changed) => {
						outOfOrderObservations.push(changed.key);
					});

					sharedMap1.set("key1", "1");
					sharedMap2.set("key2", "2");
					await provider.ensureSynchronized();

					// The offending container is not closed
					assert.ok(!container1.closed);
					assert.equal(sharedMap1.get("key2"), "1 updated");

					// The other container is also fine
					assert.equal(sharedMap2.get("key1"), "1");
					assert.equal(sharedMap2.get("key2"), "1 updated");

					// The second event handler didn't receive the events in the actual order of changes
					assert.deepEqual(outOfOrderObservations, ["key2", "key1"]);
					assert.ok(mapsAreEqual(sharedMap1, sharedMap2));
				},
			);

			itSkipsFailureOnSpecificDrivers(
				`Should not throw when submitting an op while processing a batch - offline [${testConfig.name}]`,
				["tinylicious", "t9s"], // This test is flaky on Tinylicious. ADO:5010
				async () => {
					await setupContainers(testConfig.options, testConfig.featureGates);

					await container1.deltaManager.inbound.pause();
					await container1.deltaManager.outbound.pause();

					sharedMap1.on("valueChanged", (changed) => {
						if (changed.key !== "key2") {
							sharedMap1.set("key2", `${sharedMap1.get("key1")} updated`);
						}
					});

					const outOfOrderObservations: string[] = [];
					sharedMap1.on("valueChanged", (changed) => {
						outOfOrderObservations.push(changed.key);
					});

					sharedMap1.set("key1", "1");

					container1.deltaManager.inbound.resume();
					container1.deltaManager.outbound.resume();
					await provider.ensureSynchronized();

					// The offending container is not closed
					assert.ok(!container1.closed);

					// The second event handler didn't receive the events in the actual order of changes
					assert.deepEqual(outOfOrderObservations, ["key2", "key1"]);
					assert.ok(mapsAreEqual(sharedMap1, sharedMap2));
				},
			);
		}));
});
