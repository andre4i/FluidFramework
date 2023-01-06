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
import { describeInstallVersions, getContainerRuntimeApi, getVersionedTestObjectProvider } from "@fluidframework/test-version-utils";
import { IContainer } from "@fluidframework/container-definitions";
import { IContainerRuntimeBase } from "@fluidframework/runtime-definitions";
import { IRequest } from "@fluidframework/core-interfaces";
// eslint-disable-next-line import/no-internal-modules
import { driver, r11sEndpointName, tenantIndex } from "@fluidframework/test-version-utils/dist/compatOptions";

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
    /* timeoutMs */ 1000000,
)(
    "OP Ordering",
    () => {
        describe("OP processing", () => versions.forEach((version) => {
            let provider: ITestObjectProvider;
            let map: SharedMap;
            let detachedContainer: IContainer;
            beforeEach(async () => {
                provider = await getVersionedTestObjectProvider(
                    version, // baseVersion
                    version, // loaderVersion
                    {
                        type: driver,
                        version,
                        config: {
                            r11s: { r11sEndpointName },
                            odsp: { tenantIndex },
                        },
                    }, // driverConfig
                    version, // runtimeVersion
                    version, // dataRuntimeVersion
                );
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

            const createOldDetachedContainer = async (ver): Promise<IContainer> => {
                const oldContainerRuntimeFactoryWithDefaultDataStore =
                    getContainerRuntimeApi(ver).ContainerRuntimeFactoryWithDefaultDataStore;
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

            const setupContainers = async (ver: string) => {
                const startup = await provider.makeTestContainer(testContainerConfig);
                const startupDO = await requestFluidObject<ITestFluidObject>(startup, "default");
                await startupDO.getSharedObject<SharedMap>(mapId);

                detachedContainer = await createOldDetachedContainer(ver);
                const oldDataObject = await requestFluidObject<ITestFluidObject>(detachedContainer, "default");
                map = await oldDataObject.getSharedObject<SharedMap>(mapId);
            };

            it(`Ops are processed in order, version: ${version}`, async () => {
                await setupContainers(version);
                map.set("key", "oldest");
                detachedContainer.once("readonly", () => {
                    map.set("key", "latest");
                });
                await detachedContainer.attach(provider.driver.createCreateNewRequest(provider.documentId));
                await provider.ensureSynchronized();

                assert.equal(map.get("key"), "latest");
            });
        }));
    });
