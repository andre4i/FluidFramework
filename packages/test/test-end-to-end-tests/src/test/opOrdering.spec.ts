/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { SharedMap } from "@fluidframework/map";
import { requestFluidObject } from "@fluidframework/runtime-utils";
import {
    ITestFluidObject,
    ChannelFactoryRegistry,
    ITestObjectProvider,
    ITestContainerConfig,
    DataObjectFactoryType,
    TestFluidObjectFactory,
} from "@fluidframework/test-utils";
import { describeInstallVersions, getContainerRuntimeApi } from "@fluidframework/test-version-utils";
import { IContainer } from "@fluidframework/container-definitions";
import { IContainerRuntimeBase } from "@fluidframework/runtime-definitions";
import { IRequest } from "@fluidframework/core-interfaces";

const versions = [
    "2.0.0-internal.2.2.0",
    "2.0.0-internal.2.1.0",
    "2.0.0-internal.2.0.0",
    "2.0.0-internal.1.4.8",
];

describeInstallVersions(
    {
        requestAbsoluteVersions: versions,
    },
    /* timeoutMs */ 100000,
)(
    "OP Ordering",
    (getTestObjectProvider) => {
        describe("OP processing", () => versions.forEach((version) => {
            let provider: ITestObjectProvider;
            let map: SharedMap;
            let detachedContainer: IContainer;
            beforeEach(() => {
                provider = getTestObjectProvider();
            });
            afterEach(async () => provider.reset());

            const innerRequestHandler = async (request: IRequest, runtime: IContainerRuntimeBase) =>
                runtime.IFluidHandleContext.resolveHandle(request);
            const mapId = "map";
            const registry: ChannelFactoryRegistry = [
                [mapId, SharedMap.getFactory()],
            ];
            const factory: TestFluidObjectFactory = new TestFluidObjectFactory(
                registry,
                "default",
            );
            const testContainerConfig: ITestContainerConfig = {
                fluidDataObjectType: DataObjectFactoryType.Test,
                registry,
            };

            const createOldDetachedContainer = async (version): Promise<IContainer> => {
                const oldContainerRuntimeFactoryWithDefaultDataStore =
                    getContainerRuntimeApi(version).ContainerRuntimeFactoryWithDefaultDataStore;
                const oldRuntimeFactory =
                    new oldContainerRuntimeFactoryWithDefaultDataStore(
                        factory,
                        [
                            [factory.type, Promise.resolve(factory)],
                        ],
                        undefined,
                        [innerRequestHandler],
                        {
                            gcOptions: {
                                gcAllowed: true,
                            },
                        },
                    );

                const loader = provider.createLoader([[provider.defaultCodeDetails, oldRuntimeFactory]]);
                return loader.createDetachedContainer(provider.defaultCodeDetails);
            };

            const setupContainers = async (version: string) => {
                const startup = await provider.makeTestContainer(testContainerConfig);
                const startupDO = await requestFluidObject<ITestFluidObject>(startup, "default");
                await startupDO.getSharedObject<SharedMap>(mapId);

                detachedContainer = await createOldDetachedContainer(version);
                const oldDataObject = await requestFluidObject<ITestFluidObject>(detachedContainer, "default");
                map = await oldDataObject.getSharedObject<SharedMap>(mapId);
            };

            it(`Ops are processed in order, version: ${version}`, async () => {
                await setupContainers(version);
                map.set("key", "oldest");
                detachedContainer.once("connected", () => {
                    map.set("key", "latest");
                });
                await detachedContainer.attach(provider.driver.createCreateNewRequest(provider.documentId));
                await provider.ensureSynchronized();

                assert.equal(map.get("key"), "latest");
            });
        }));
    });
