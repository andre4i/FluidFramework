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
];

describeInstallVersions(
    {
        requestAbsoluteVersions: versions,
    },
    /* timeoutMs */ 100000,
)(
    "OP Ordering",
    (getTestObjectProvider) => {
        let provider: ITestObjectProvider;
        let oldMap: SharedMap;
        let newMap: SharedMap;
        let oldContainer: IContainer;
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

        const createOldContainer = async (version): Promise<IContainer> => {
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

            return provider.createContainer(oldRuntimeFactory);
        };

        const setupContainers = async (version: string) => {
            oldContainer = await createOldContainer(version);
            const oldDataObject = await requestFluidObject<ITestFluidObject>(oldContainer, "default");
            oldMap = await oldDataObject.getSharedObject<SharedMap>(mapId);

            const containerOnLatest = await provider.loadTestContainer(testContainerConfig);
            const newDataObject = await requestFluidObject<ITestFluidObject>(containerOnLatest, "default");
            newMap = await newDataObject.getSharedObject<SharedMap>(mapId);

            await provider.ensureSynchronized();
        };

        describe("OP processing", () => versions.forEach((version) => {
            it(`Ops are processed in order, version: ${version}`, async () => {
                await setupContainers(version);
                oldContainer.once("connected", () => {
                    oldMap.set("key", "latest");
                });
                oldContainer.disconnect();
                oldMap.set("key", "oldest");
                oldContainer.connect();

                await provider.ensureSynchronized();
                assert.equal(newMap.get("key"), "latest");
            });
        }));
    });
