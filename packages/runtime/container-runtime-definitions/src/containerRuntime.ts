/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import type { AttachState, IDeltaManager } from "@fluidframework/container-definitions";
import type {
	FluidObject,
	IEventProvider,
	IFluidHandle,
	IFluidHandleContext,
	IRequest,
	IResponse,
} from "@fluidframework/core-interfaces";
import type { IDocumentStorageService } from "@fluidframework/driver-definitions";
import {
	type IClientDetails,
	type IDocumentMessage,
	type ISequencedDocumentMessage,
} from "@fluidframework/protocol-definitions";
import {
	type FlushMode,
	type IContainerRuntimeBase,
	type IContainerRuntimeBaseEvents,
	type IProvideFluidDataStoreRegistry,
} from "@fluidframework/runtime-definitions";

/**
 * @deprecated Will be removed in future major release. Migrate all usage of IFluidRouter to the "entryPoint" pattern. Refer to Removing-IFluidRouter.md
 * @alpha
 */
export interface IContainerRuntimeWithResolveHandle_Deprecated extends IContainerRuntime {
	readonly IFluidHandleContext: IFluidHandleContext;
	resolveHandle(request: IRequest): Promise<IResponse>;
}

/**
 * Events emitted by {@link IContainerRuntime}.
 * @alpha
 */
export interface IContainerRuntimeEvents extends IContainerRuntimeBaseEvents {
	(event: "dirty" | "disconnected" | "saved" | "attached", listener: () => void);
	(event: "connected", listener: (clientId: string) => void);
}

/**
 * @alpha
 */
export type IContainerRuntimeBaseWithCombinedEvents = IContainerRuntimeBase &
	IEventProvider<IContainerRuntimeEvents>;

/**
 * Represents the runtime of the container. Contains helper functions/state of the container.
 * @alpha
 */
export interface IContainerRuntime
	extends IProvideFluidDataStoreRegistry,
		IContainerRuntimeBaseWithCombinedEvents {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readonly options: Record<string | number, any>;
	readonly clientId: string | undefined;
	readonly clientDetails: IClientDetails;
	readonly connected: boolean;
	readonly deltaManager: IDeltaManager<ISequencedDocumentMessage, IDocumentMessage>;
	readonly storage: IDocumentStorageService;
	readonly flushMode: FlushMode;
	readonly scope: FluidObject;
	/**
	 * Indicates the attachment state of the container to a host service.
	 */
	readonly attachState: AttachState;

	/**
	 * Returns the aliased data store's entryPoint, given the alias.
	 * @param alias - The alias for the data store.
	 * @returns The data store's entry point ({@link @fluidframework/core-interfaces#IFluidHandle}) if it exists and is aliased.
	 * Returns undefined if no data store has been assigned the given alias.
	 */
	getAliasedDataStoreEntryPoint(alias: string): Promise<IFluidHandle<FluidObject> | undefined>;

	/**
	 * Returns true if document is dirty, i.e. there are some pending local changes that
	 * either were not sent out to delta stream or were not yet acknowledged.
	 */
	readonly isDirty: boolean;

	/**
	 * Get an absolute url for a provided container-relative request.
	 * Returns undefined if the container isn't attached to storage.
	 * @param relativeUrl - A relative request within the container
	 */
	getAbsoluteUrl(relativeUrl: string): Promise<string | undefined>;
}
