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
} from "@fluidframework/test-utils";
import { describeNoCompat, itExpects } from "@fluidframework/test-version-utils";
import { IContainer, IErrorBase } from "@fluidframework/container-definitions";
import { ConfigTypes, IConfigProviderBase, TelemetryDataTag } from "@fluidframework/telemetry-utils";
import { GenericError } from "@fluidframework/container-utils";

describeNoCompat("Message size", (getTestObjectProvider) => {
    const mapId = "mapId";
    const registry: ChannelFactoryRegistry = [
        [mapId, SharedMap.getFactory()],
    ];
    const testContainerConfig: ITestContainerConfig = {
        fluidDataObjectType: DataObjectFactoryType.Test,
        registry,
    };

    let provider: ITestObjectProvider;
    beforeEach(() => {
        provider = getTestObjectProvider();
    });
    afterEach(async () => provider.reset());

    let container1: IContainer;
    let dataObject1: ITestFluidObject;
    let dataObject2: ITestFluidObject;
    let dataObject1map1: SharedMap;
    let dataObject2map1: SharedMap;

    const configProvider = ((settings: Record<string, ConfigTypes>): IConfigProviderBase => ({
        getRawConfig: (name: string): ConfigTypes => settings[name],
    }));

    const setupContainers = async (
        containerConfig: ITestContainerConfig,
        featureGates: Record<string, ConfigTypes> = {},
    ) => {
        const configWithFeatureGates = {
            ...containerConfig,
            loaderProps: { configProvider: configProvider(featureGates) }
        };

        // Create a Container for the first client.
        container1 = await provider.makeTestContainer(configWithFeatureGates);
        dataObject1 = await requestFluidObject<ITestFluidObject>(container1, "default");
        dataObject1map1 = await dataObject1.getSharedObject<SharedMap>(mapId);

        // Load the Container that was created by the first client.
        const container2 = await provider.loadTestContainer(testContainerConfig);
        dataObject2 = await requestFluidObject<ITestFluidObject>(container2, "default");
        dataObject2map1 = await dataObject2.getSharedObject<SharedMap>(mapId);

        await provider.ensureSynchronized();
    };

    const generateStringOfSize = (sizeInBytes: number): string => new Array(sizeInBytes + 1).join("0");
    const setMapKeys = (map: SharedMap, count: number, item: string): void => {
        for (let i = 0; i < count; i++) {
            map.set(`key${i}`, item);
        }
    };

    const containerError = async (container: IContainer) =>
        new Promise<IErrorBase | undefined>((resolve) => container.once("closed", (error) => { resolve(error); }));

    itExpects("A large op will close the container with chunking disabled", [
        { eventName: "fluid:telemetry:Container:ContainerClose", error: "OpTooLarge" },
    ], async () => {
        const maxMessageSizeInBytes = 20000;
        await setupContainers(testContainerConfig, {
            "Fluid.ContainerRuntime.MaxOpSizeInBytes": maxMessageSizeInBytes,
        });
        const errorEvent = containerError(container1);

        const largeString = generateStringOfSize(maxMessageSizeInBytes + 1);
        const messageCount = 1;
        setMapKeys(dataObject1map1, messageCount, largeString);

        const error = await errorEvent;
        assert.ok(error instanceof GenericError);
        assert.ok(error.getTelemetryProperties().length ?? 0 > maxMessageSizeInBytes);
        assert.deepEqual(
            error.getTelemetryProperties().limit,
            {
                value: maxMessageSizeInBytes,
                tag: TelemetryDataTag.PackageData,
            });
    });

    it("Small ops will pass with chunking disabled", async () => {
        const maxMessageSizeInBytes = 20000;
        await setupContainers(testContainerConfig, {
            "Fluid.ContainerRuntime.MaxOpSizeInBytes": maxMessageSizeInBytes,
        });
        const largeString = generateStringOfSize(maxMessageSizeInBytes / 10);
        const messageCount = 10;
        setMapKeys(dataObject1map1, messageCount, largeString);
        await provider.ensureSynchronized();

        for (let i = 0; i < messageCount; i++) {
            const value = dataObject2map1.get(`key${i}`);
            assert.strictEqual(value, largeString, `Wrong value for key${i}`);
        }
    });

    it("Large ops pass with chunking enabled", async () => {
        const maxMessageSizeInBytes = 20000;
        await setupContainers(testContainerConfig, {
            "Fluid.ContainerRuntime.MaxOpSizeInBytes": -1,
        });
        // Server max op size should be at around 16000, therefore the runtime will chunk all ops.
        const largeString = generateStringOfSize(maxMessageSizeInBytes + 1);
        const messageCount = 5;
        setMapKeys(dataObject1map1, messageCount, largeString);
        await provider.ensureSynchronized();

        for (let i = 0; i < messageCount; i++) {
            const value = dataObject2map1.get(`key${i}`);
            assert.strictEqual(value, largeString, `Wrong value for key${i}`);
        }
    });
});
