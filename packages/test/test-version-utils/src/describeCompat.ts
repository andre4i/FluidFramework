/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { getUnexpectedLogErrorException, ITestObjectProvider, TestObjectProvider } from "@fluidframework/test-utils";
import { configList, getInternalCompatConfig } from "./compatConfig";
import { CompatKind, baseVersion, driver, r11sEndpointName, tenantIndex } from "./compatOptions";
import { getVersionedTestObjectProvider, getInternalVersionedTestObjectProvider } from "./compatUtils";

/*
 * Mocha Utils for test to generate the compat variants.
 */
function createCompatSuite(
    tests: (this: Mocha.Suite, provider: () => ITestObjectProvider) => void,
    enableInternalCompat: boolean,
    compatFilter?: CompatKind[],
) {
    return function(this: Mocha.Suite) {
        let configs = configList.value;
        if (compatFilter !== undefined) {
            configs = configs.filter((value) => compatFilter.includes(value.kind));
        }

        for (const config of configs) {
            wrapTest(config.name, tests, async () =>
                getVersionedTestObjectProvider(
                    baseVersion,
                    config.loader,
                    {
                        type: driver,
                        version: config.driver,
                        config: {
                            r11s: { r11sEndpointName },
                            odsp: { tenantIndex },
                        },
                    },
                    config.containerRuntime,
                    config.dataRuntime,
                ));
        }

        if (enableInternalCompat) {
            getInternalCompatConfig().forEach((config) => {
                wrapTest(config.name, tests, async () =>
                    getInternalVersionedTestObjectProvider(
                        config.createWith,
                        config.createWith,
                        {
                            type: driver,
                            config: {
                                r11s: { r11sEndpointName },
                                odsp: { tenantIndex },
                            },
                        },
                    ));
            });
        }
    };
}

function wrapTest(
    name: string,
    tests: (this: Mocha.Suite, provider: () => ITestObjectProvider) => void,
    makeProvider: () => Promise<TestObjectProvider>,
) {
    describe(name, function() {
        let provider: TestObjectProvider;
        let resetAfterEach: boolean;
        before(async function() {
            provider = await makeProvider();
            Object.defineProperty(this, "__fluidTestProvider", { get: () => provider });
        });

        tests.bind(this)((options?: ITestObjectProviderOptions) => {
            resetAfterEach = options?.resetAfterEach ?? true;
            if (options?.syncSummarizer === true) {
                provider.resetLoaderContainerTracker(true /* syncSummarizerClients */);
            }
            return provider;
        });

        afterEach(function(done: Mocha.Done) {
            const logErrors = getUnexpectedLogErrorException(provider.logger);
            // if the test failed for another reason
            // then we don't need to check errors
            // and fail the after each as well
            if (this.currentTest?.state === "passed") {
                done(logErrors);
            } else {
                done();
            }
            if (resetAfterEach) {
                provider.reset();
            }
        });
    });
}

export interface ITestObjectProviderOptions {
    /** If true, resets all state after each test completes. */
    resetAfterEach?: boolean;
    /** If true, synchronizes summarizer client as well when ensureSynchronized() is called. */
    syncSummarizer?: boolean;
}

export type DescribeCompatSuite =
    (name: string,
        tests: (
            this: Mocha.Suite,
            provider: (options?: ITestObjectProviderOptions) => ITestObjectProvider) => void
    ) => Mocha.Suite | void;

export type DescribeCompat = DescribeCompatSuite & Record<"skip" | "only" | "noCompat", DescribeCompatSuite>;

function createCompatDescribe(enableInternalCompat: boolean, compatFilter?: CompatKind[]): DescribeCompat {
    const d: DescribeCompat =
        (name, tests) => describe(name, createCompatSuite(tests, enableInternalCompat, compatFilter));
    d.skip = (name, tests) => describe.skip(name, createCompatSuite(tests, enableInternalCompat, compatFilter));
    d.only = (name, tests) => describe.only(name, createCompatSuite(tests, enableInternalCompat, compatFilter));
    d.noCompat = (name, tests) => describe(name, createCompatSuite(tests, enableInternalCompat, [CompatKind.None]));
    return d;
}

export const describeNoCompat: DescribeCompat = createCompatDescribe(false, [CompatKind.None]);

export const describeLoaderCompat: DescribeCompat = createCompatDescribe(false, [CompatKind.None, CompatKind.Loader]);

export const describeFullCompat: DescribeCompat = createCompatDescribe(false);

export const describeFullInternalCompat: DescribeCompat = createCompatDescribe(true);
