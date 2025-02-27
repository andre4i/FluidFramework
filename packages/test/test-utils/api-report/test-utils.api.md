## API Report File for "@fluidframework/test-utils"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { ConfigTypes } from '@fluidframework/core-interfaces';
import { ContainerRuntime } from '@fluidframework/container-runtime';
import { ContainerRuntimeFactoryWithDefaultDataStore } from '@fluidframework/aqueduct';
import { FluidDataStoreRuntime } from '@fluidframework/datastore';
import { FluidObject } from '@fluidframework/core-interfaces';
import { IChannelFactory } from '@fluidframework/datastore-definitions';
import { ICodeDetailsLoader } from '@fluidframework/container-definitions';
import { IConfigProviderBase } from '@fluidframework/core-interfaces';
import { IContainer } from '@fluidframework/container-definitions';
import { IContainerContext } from '@fluidframework/container-definitions';
import { IContainerRuntime } from '@fluidframework/container-runtime-definitions';
import { IContainerRuntimeOptions } from '@fluidframework/container-runtime';
import { IDataStore } from '@fluidframework/runtime-definitions';
import { IDocumentService } from '@fluidframework/driver-definitions';
import { IDocumentServiceFactory } from '@fluidframework/driver-definitions';
import { IDocumentStorageService } from '@fluidframework/driver-definitions';
import { IFluidCodeDetails } from '@fluidframework/container-definitions';
import { IFluidDataStoreChannel } from '@fluidframework/runtime-definitions';
import { IFluidDataStoreContext } from '@fluidframework/runtime-definitions';
import { IFluidDataStoreFactory } from '@fluidframework/runtime-definitions';
import { IFluidDataStoreRuntime } from '@fluidframework/datastore-definitions';
import { IFluidHandle } from '@fluidframework/core-interfaces';
import { IFluidLoadable } from '@fluidframework/core-interfaces';
import { IFluidModule } from '@fluidframework/container-definitions';
import { IFluidModuleWithDetails } from '@fluidframework/container-definitions';
import { IHostLoader } from '@fluidframework/container-definitions';
import { ILoaderOptions } from '@fluidframework/container-definitions';
import { ILoaderProps } from '@fluidframework/container-loader';
import { IOnDemandSummarizeOptions } from '@fluidframework/container-runtime';
import { IProvideFluidCodeDetailsComparer } from '@fluidframework/container-definitions';
import { IProvideFluidDataStoreFactory } from '@fluidframework/runtime-definitions';
import { IProvideFluidDataStoreRegistry } from '@fluidframework/runtime-definitions';
import { IProvideRuntimeFactory } from '@fluidframework/container-definitions';
import { IRequest } from '@fluidframework/core-interfaces';
import { IRequestHeader } from '@fluidframework/core-interfaces';
import { IResolvedUrl } from '@fluidframework/driver-definitions';
import { IResponse } from '@fluidframework/core-interfaces';
import { IRuntime } from '@fluidframework/container-definitions';
import { ISharedMap } from '@fluidframework/map';
import { ISummarizer } from '@fluidframework/container-runtime';
import { ISummaryContext } from '@fluidframework/driver-definitions';
import { ISummaryTree } from '@fluidframework/protocol-definitions';
import { ITelemetryBaseEvent } from '@fluidframework/core-interfaces';
import { ITelemetryBaseLogger } from '@fluidframework/core-interfaces';
import { ITelemetryGenericEventExt } from '@fluidframework/telemetry-utils';
import { ITestDriver } from '@fluidframework/test-driver-definitions';
import { IUrlResolver } from '@fluidframework/driver-definitions';
import { Loader } from '@fluidframework/container-loader';
import { NamedFluidDataStoreRegistryEntries } from '@fluidframework/runtime-definitions';
import { RuntimeRequestHandler } from '@fluidframework/request-handler';

// @internal (undocumented)
export type ChannelFactoryRegistry = Iterable<[string | undefined, IChannelFactory]>;

// @alpha
export function createAndAttachContainer(source: IFluidCodeDetails, loader: IHostLoader, attachRequest: IRequest): Promise<IContainer>;

// @internal
export const createContainerRuntimeFactoryWithDefaultDataStore: (Base: typeof ContainerRuntimeFactoryWithDefaultDataStore | undefined, ctorArgs: {
    defaultFactory: IFluidDataStoreFactory;
    registryEntries: NamedFluidDataStoreRegistryEntries;
    dependencyContainer?: any;
    requestHandlers?: RuntimeRequestHandler[] | undefined;
    runtimeOptions?: IContainerRuntimeOptions | undefined;
    provideEntryPoint?: ((runtime: IContainerRuntime) => Promise<FluidObject>) | undefined;
}) => ContainerRuntimeFactoryWithDefaultDataStore;

// @internal (undocumented)
export const createDocumentId: () => string;

// @internal
export function createLoader(packageEntries: Iterable<[IFluidCodeDetails, fluidEntryPoint]>, documentServiceFactory: IDocumentServiceFactory, urlResolver: IUrlResolver, logger?: ITelemetryBaseLogger, options?: ILoaderOptions): IHostLoader;

// @internal
export function createSummarizer(provider: ITestObjectProvider, container: IContainer, config?: ITestContainerConfig, summaryVersion?: string, logger?: ITelemetryBaseLogger): Promise<{
    container: IContainer;
    summarizer: ISummarizer;
}>;

// @internal (undocumented)
export function createSummarizerCore(container: IContainer, loader: IHostLoader, summaryVersion?: string): Promise<{
    container: IContainer;
    summarizer: ISummarizer;
}>;

// @internal
export function createSummarizerFromFactory(provider: ITestObjectProvider, container: IContainer, dataStoreFactory: IFluidDataStoreFactory, summaryVersion?: string, containerRuntimeFactoryType?: typeof ContainerRuntimeFactoryWithDefaultDataStore, registryEntries?: NamedFluidDataStoreRegistryEntries, logger?: ITelemetryBaseLogger, configProvider?: IConfigProviderBase): Promise<{
    container: IContainer;
    summarizer: ISummarizer;
}>;

// @internal
export const createTestConfigProvider: () => ITestConfigProvider;

// @internal
export const createTestContainerRuntimeFactory: (containerRuntimeCtor: typeof ContainerRuntime) => {
    new (type: string, dataStoreFactory: IFluidDataStoreFactory, runtimeOptions?: IContainerRuntimeOptions, requestHandlers?: RuntimeRequestHandler[]): {
        type: string;
        dataStoreFactory: IFluidDataStoreFactory;
        runtimeOptions: IContainerRuntimeOptions;
        requestHandlers: RuntimeRequestHandler[];
        instantiateFirstTime(runtime: ContainerRuntime): Promise<void>;
        instantiateFromExisting(runtime: ContainerRuntime): Promise<void>;
        preInitialize(context: IContainerContext, existing: boolean): Promise<IRuntime & IContainerRuntime>;
        readonly IRuntimeFactory: any;
        instantiateRuntime(context: IContainerContext, existing: boolean): Promise<IRuntime>;
        hasInitialized(_runtime: IContainerRuntime): Promise<void>;
    };
};

// @internal (undocumented)
export enum DataObjectFactoryType {
    // (undocumented)
    Primed = 0,
    // (undocumented)
    Test = 1
}

// @internal (undocumented)
export const defaultTimeoutDurationMs = 250;

// @internal
export class EventAndErrorTrackingLogger implements ITelemetryBaseLogger {
    constructor(baseLogger: ITelemetryBaseLogger);
    // (undocumented)
    registerExpectedEvent(...orderedExpectedEvents: ITelemetryGenericEventExt[]): void;
    // (undocumented)
    reportAndClearTrackedEvents(): {
        expectedNotFound: ({
            index: number;
            event: ITelemetryGenericEventExt | undefined;
        } | undefined)[];
        unexpectedErrors: ITelemetryBaseEvent[];
    };
    // (undocumented)
    send(event: ITelemetryBaseEvent): void;
}

// @internal (undocumented)
export type fluidEntryPoint = SupportedExportInterfaces | IFluidModule;

// @internal
export function getContainerEntryPointBackCompat<T>(container: IContainer): Promise<T>;

// @internal
export function getDataStoreEntryPointBackCompat<T>(dataStore: IDataStore): Promise<T>;

// @internal (undocumented)
export function getUnexpectedLogErrorException(logger: EventAndErrorTrackingLogger | undefined, prefix?: string): Error | undefined;

// @internal
export interface IDocumentIdStrategy {
    get(): string;
    reset(): void;
    update(resolvedUrl?: IResolvedUrl): void;
}

// @alpha (undocumented)
export interface IOpProcessingController {
    // (undocumented)
    pauseProcessing(...containers: IContainer[]): Promise<void>;
    // (undocumented)
    processIncoming(...containers: IContainer[]): Promise<void>;
    // (undocumented)
    processOutgoing(...containers: IContainer[]): Promise<void>;
    // (undocumented)
    resumeProcessing(...containers: IContainer[]): void;
}

// @alpha (undocumented)
export interface IProvideTestFluidObject {
    // (undocumented)
    readonly ITestFluidObject: ITestFluidObject;
}

// @internal
export interface ITestConfigProvider extends IConfigProviderBase {
    clear: () => void;
    set: (key: string, value: ConfigTypes) => void;
}

// @internal (undocumented)
export interface ITestContainerConfig {
    enableAttribution?: boolean;
    fluidDataObjectType?: DataObjectFactoryType;
    forceUseCreateVersion?: true;
    loaderProps?: Partial<ILoaderProps>;
    registry?: ChannelFactoryRegistry;
    runtimeOptions?: IContainerRuntimeOptions;
}

// @alpha (undocumented)
export interface ITestFluidObject extends IProvideTestFluidObject, IFluidLoadable {
    // (undocumented)
    readonly channel: IFluidDataStoreChannel;
    // (undocumented)
    readonly context: IFluidDataStoreContext;
    // (undocumented)
    getSharedObject<T = any>(id: string): Promise<T>;
    // (undocumented)
    root: ISharedMap;
    // (undocumented)
    readonly runtime: IFluidDataStoreRuntime;
}

// @internal (undocumented)
export interface ITestObjectProvider {
    attachDetachedContainer(container: IContainer): Promise<void>;
    createContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps>): Promise<IContainer>;
    createDetachedContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps>): Promise<IContainer>;
    createFluidEntryPoint: (testContainerConfig?: ITestContainerConfig) => fluidEntryPoint;
    createLoader(packageEntries: Iterable<[IFluidCodeDetails, fluidEntryPoint]>, loaderProps?: Partial<ILoaderProps>): IHostLoader;
    defaultCodeDetails: IFluidCodeDetails;
    documentId: string;
    documentServiceFactory: IDocumentServiceFactory;
    driver: ITestDriver;
    ensureSynchronized(timeoutDuration?: number): Promise<void>;
    loadContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps>, requestHeader?: IRequestHeader): Promise<IContainer>;
    loadTestContainer(testContainerConfig?: ITestContainerConfig, requestHeader?: IRequestHeader): Promise<IContainer>;
    logger: EventAndErrorTrackingLogger | undefined;
    makeTestContainer(testContainerConfig?: ITestContainerConfig): Promise<IContainer>;
    makeTestLoader(testContainerConfig?: ITestContainerConfig): IHostLoader;
    opProcessingController: IOpProcessingController;
    reset(): void;
    resetLoaderContainerTracker(syncSummarizerClients?: boolean): any;
    type: "TestObjectProvider" | "TestObjectProviderWithVersionedLoad";
    updateDocumentId(url: IResolvedUrl | undefined): void;
    urlResolver: IUrlResolver;
}

// @alpha (undocumented)
export class LoaderContainerTracker implements IOpProcessingController {
    constructor(syncSummarizerClients?: boolean);
    add<LoaderType extends IHostLoader>(loader: LoaderType): void;
    ensureSynchronized(...containers: IContainer[]): Promise<void>;
    pauseProcessing(...containers: IContainer[]): Promise<void>;
    processIncoming(...containers: IContainer[]): Promise<void>;
    processOutgoing(...containers: IContainer[]): Promise<void>;
    reset(): void;
    resumeProcessing(...containers: IContainer[]): IContainer[];
}

// @internal
export class LocalCodeLoader implements ICodeDetailsLoader {
    constructor(packageEntries: Iterable<[IFluidCodeDetails, fluidEntryPoint]>, runtimeOptions?: IContainerRuntimeOptions);
    load(source: IFluidCodeDetails): Promise<IFluidModuleWithDetails>;
}

// @internal
export const retryWithEventualValue: <T>(callback: () => Promise<T>, check: (value: T) => boolean, defaultValue: T, maxTries?: number, backOffMs?: number) => Promise<T>;

// @internal
export function summarizeNow(summarizer: ISummarizer, inputs?: string | IOnDemandSummarizeOptions): Promise<SummaryInfo>;

// @internal
export interface SummaryInfo {
    summaryRefSeq: number;
    summaryTree: ISummaryTree;
    summaryVersion: string;
}

// @internal (undocumented)
export type SupportedExportInterfaces = Partial<IProvideRuntimeFactory & IProvideFluidDataStoreFactory & IProvideFluidDataStoreRegistry & IProvideFluidCodeDetailsComparer>;

// @internal
export const TestContainerRuntimeFactory: {
    new (type: string, dataStoreFactory: IFluidDataStoreFactory, runtimeOptions?: IContainerRuntimeOptions, requestHandlers?: RuntimeRequestHandler[]): {
        type: string;
        dataStoreFactory: IFluidDataStoreFactory;
        runtimeOptions: IContainerRuntimeOptions;
        requestHandlers: RuntimeRequestHandler[];
        instantiateFirstTime(runtime: ContainerRuntime): Promise<void>;
        instantiateFromExisting(runtime: ContainerRuntime): Promise<void>;
        preInitialize(context: IContainerContext, existing: boolean): Promise<IRuntime & IContainerRuntime>;
        readonly IRuntimeFactory: any;
        instantiateRuntime(context: IContainerContext, existing: boolean): Promise<IRuntime>;
        hasInitialized(_runtime: IContainerRuntime): Promise<void>;
    };
};

// @internal
export class TestFluidObject implements ITestFluidObject {
    constructor(runtime: IFluidDataStoreRuntime, channel: IFluidDataStoreChannel, context: IFluidDataStoreContext, factoryEntriesMap: Map<string, IChannelFactory>);
    // (undocumented)
    readonly channel: IFluidDataStoreChannel;
    // (undocumented)
    readonly context: IFluidDataStoreContext;
    getSharedObject<T = any>(id: string): Promise<T>;
    // (undocumented)
    get handle(): IFluidHandle<this>;
    // (undocumented)
    get IFluidLoadable(): this;
    // (undocumented)
    initialize(existing: boolean): Promise<void>;
    // (undocumented)
    get ITestFluidObject(): this;
    // (undocumented)
    request(request: IRequest): Promise<IResponse>;
    // (undocumented)
    root: ISharedMap;
    // (undocumented)
    readonly runtime: IFluidDataStoreRuntime;
}

// @internal
export class TestFluidObjectFactory implements IFluidDataStoreFactory {
    constructor(factoryEntries: ChannelFactoryRegistry, type?: string);
    // (undocumented)
    get IFluidDataStoreFactory(): this;
    // (undocumented)
    instantiateDataStore(context: IFluidDataStoreContext, existing: boolean): Promise<FluidDataStoreRuntime>;
    // (undocumented)
    readonly type: string;
}

// @internal
export class TestObjectProvider implements ITestObjectProvider {
    constructor(LoaderConstructor: typeof Loader,
    driver: ITestDriver,
    createFluidEntryPoint: (testContainerConfig?: ITestContainerConfig) => fluidEntryPoint);
    attachDetachedContainer(container: IContainer): Promise<void>;
    createContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps>): Promise<IContainer>;
    createDetachedContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps> | undefined): Promise<IContainer>;
    readonly createFluidEntryPoint: (testContainerConfig?: ITestContainerConfig) => fluidEntryPoint;
    createLoader(packageEntries: Iterable<[IFluidCodeDetails, fluidEntryPoint]>, loaderProps?: Partial<ILoaderProps>): Loader;
    get defaultCodeDetails(): IFluidCodeDetails;
    get documentId(): string;
    get documentServiceFactory(): IDocumentServiceFactory;
    readonly driver: ITestDriver;
    ensureSynchronized(): Promise<void>;
    loadContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps>, requestHeader?: IRequestHeader): Promise<IContainer>;
    loadTestContainer(testContainerConfig?: ITestContainerConfig, requestHeader?: IRequestHeader): Promise<IContainer>;
    get logger(): EventAndErrorTrackingLogger;
    makeTestContainer(testContainerConfig?: ITestContainerConfig): Promise<IContainer>;
    makeTestLoader(testContainerConfig?: ITestContainerConfig): Loader;
    get opProcessingController(): IOpProcessingController;
    reset(): void;
    resetLoaderContainerTracker(syncSummarizerClients?: boolean): void;
    readonly type = "TestObjectProvider";
    updateDocumentId(resolvedUrl: IResolvedUrl | undefined): void;
    get urlResolver(): IUrlResolver;
}

// @internal
export class TestObjectProviderWithVersionedLoad implements ITestObjectProvider {
    constructor(LoaderConstructorForCreating: typeof Loader, LoaderConstructorForLoading: typeof Loader, driverForCreating: ITestDriver, driverForLoading: ITestDriver, createFluidEntryPointForCreating: (testContainerConfig?: ITestContainerConfig) => fluidEntryPoint, createFluidEntryPointForLoading: (testContainerConfig?: ITestContainerConfig) => fluidEntryPoint);
    attachDetachedContainer(container: IContainer): Promise<void>;
    createContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps>): Promise<IContainer>;
    createDetachedContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps> | undefined): Promise<IContainer>;
    get createFluidEntryPoint(): (testContainerConfig?: ITestContainerConfig) => fluidEntryPoint;
    createLoader(packageEntries: Iterable<[IFluidCodeDetails, fluidEntryPoint]>, loaderProps?: Partial<ILoaderProps>, forceUseCreateVersion?: true): Loader;
    get defaultCodeDetails(): IFluidCodeDetails;
    get documentId(): string;
    get documentServiceFactory(): IDocumentServiceFactory;
    get driver(): ITestDriver;
    ensureSynchronized(): Promise<void>;
    loadContainer(entryPoint: fluidEntryPoint, loaderProps?: Partial<ILoaderProps>, requestHeader?: IRequestHeader): Promise<IContainer>;
    loadTestContainer(testContainerConfig?: ITestContainerConfig, requestHeader?: IRequestHeader): Promise<IContainer>;
    get logger(): EventAndErrorTrackingLogger;
    makeTestContainer(testContainerConfig?: ITestContainerConfig): Promise<IContainer>;
    makeTestLoader(testContainerConfig?: ITestContainerConfig): Loader;
    get opProcessingController(): IOpProcessingController;
    reset(): void;
    resetLoaderContainerTracker(syncSummarizerClients?: boolean): void;
    readonly type = "TestObjectProviderWithVersionedLoad";
    updateDocumentId(resolvedUrl: IResolvedUrl | undefined): void;
    get urlResolver(): IUrlResolver;
}

// @internal
export function timeoutAwait<T = void>(promise: PromiseLike<T>, timeoutOptions?: TimeoutWithError | TimeoutWithValue<T>): Promise<T>;

// @internal
export function timeoutPromise<T = void>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void, timeoutOptions?: TimeoutWithError | TimeoutWithValue<T>): Promise<T>;

// @internal (undocumented)
export interface TimeoutWithError {
    durationMs?: number;
    // (undocumented)
    errorMsg?: string;
    // (undocumented)
    reject?: true;
}

// @internal (undocumented)
export interface TimeoutWithValue<T = void> {
    durationMs?: number;
    // (undocumented)
    reject: false;
    // (undocumented)
    value: T;
}

// @internal
export function waitForContainerConnection(container: IContainer, failOnContainerClose?: boolean, timeoutOptions?: TimeoutWithError): Promise<void>;

// @internal @deprecated (undocumented)
export function wrapDocumentService(innerDocService: IDocumentService, uploadSummaryCb: (summaryTree: ISummaryTree, context: ISummaryContext) => ISummaryContext): IDocumentService;

// @internal @deprecated (undocumented)
export function wrapDocumentServiceFactory(innerDocServiceFactory: IDocumentServiceFactory, uploadSummaryCb: (summaryTree: ISummaryTree, context: ISummaryContext) => ISummaryContext): IDocumentServiceFactory;

// @internal @deprecated (undocumented)
export function wrapDocumentStorageService(innerDocStorageService: IDocumentStorageService, uploadSummaryCb: (summaryTree: ISummaryTree, context: ISummaryContext) => ISummaryContext): IDocumentStorageService;

// (No @packageDocumentation comment for this package)

```
