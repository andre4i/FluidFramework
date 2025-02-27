/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	AttachState,
	type IContainer,
	type IFluidModuleWithDetails,
	type IHostLoader,
} from "@fluidframework/container-definitions";
import { Loader } from "@fluidframework/container-loader";
import { type ConfigTypes, type FluidObject } from "@fluidframework/core-interfaces";
import { assert } from "@fluidframework/core-utils";
import {
	type IDocumentServiceFactory,
	type IUrlResolver,
} from "@fluidframework/driver-definitions";
import {
	type ContainerSchema,
	type IFluidContainer,
	type IRootDataObject,
	createDOProviderContainerRuntimeFactory,
	createFluidContainer,
	createServiceAudience,
} from "@fluidframework/fluid-static";
import { type IClient } from "@fluidframework/protocol-definitions";
import { RouterliciousDocumentServiceFactory } from "@fluidframework/routerlicious-driver";
import { wrapConfigProviderWithDefaults } from "@fluidframework/telemetry-utils";
import {
	InsecureTinyliciousTokenProvider,
	InsecureTinyliciousUrlResolver,
	createTinyliciousCreateNewRequest,
} from "@fluidframework/tinylicious-driver";
import { createTinyliciousAudienceMember } from "./TinyliciousAudience.js";
import { type TinyliciousClientProps, type TinyliciousContainerServices } from "./interfaces.js";

/**
 * Provides the ability to have a Fluid object backed by a Tinylicious service.
 *
 * @see {@link https://fluidframework.com/docs/testing/tinylicious/}
 * @internal
 */
export class TinyliciousClient {
	private readonly documentServiceFactory: IDocumentServiceFactory;
	private readonly urlResolver: IUrlResolver;

	/**
	 * Creates a new client instance using configuration parameters.
	 * @param props - Optional. Properties for initializing a new TinyliciousClient instance
	 */
	public constructor(private readonly props?: TinyliciousClientProps) {
		const tokenProvider = new InsecureTinyliciousTokenProvider();
		this.urlResolver = new InsecureTinyliciousUrlResolver(
			this.props?.connection?.port,
			this.props?.connection?.domain,
		);
		this.documentServiceFactory = new RouterliciousDocumentServiceFactory(
			this.props?.connection?.tokenProvider ?? tokenProvider,
		);
	}

	/**
	 * Creates a new detached container instance in Tinylicious server.
	 * @param containerSchema - Container schema for the new container.
	 * @returns New detached container instance along with associated services.
	 */
	public async createContainer<TContainerSchema extends ContainerSchema>(
		containerSchema: TContainerSchema,
	): Promise<{
		container: IFluidContainer<TContainerSchema>;
		services: TinyliciousContainerServices;
	}> {
		const loader = this.createLoader(containerSchema);

		// We're not actually using the code proposal (our code loader always loads the same module
		// regardless of the proposal), but the Container will only give us a NullRuntime if there's
		// no proposal.  So we'll use a fake proposal.
		const container = await loader.createDetachedContainer({
			package: "no-dynamic-package",
			config: {},
		});

		const rootDataObject = await this.getContainerEntryPoint(container);

		/**
		 * See {@link FluidContainer.attach}
		 */
		const attach = async (): Promise<string> => {
			if (container.attachState !== AttachState.Detached) {
				throw new Error("Cannot attach container. Container is not in detached state.");
			}
			const request = createTinyliciousCreateNewRequest();
			await container.attach(request);
			if (container.resolvedUrl === undefined) {
				throw new Error("Resolved Url not available on attached container");
			}
			return container.resolvedUrl.id;
		};

		const fluidContainer = createFluidContainer<TContainerSchema>({
			container,
			rootDataObject,
		});
		fluidContainer.attach = attach;

		const services = this.getContainerServices(container);
		return { container: fluidContainer, services };
	}

	/**
	 * Accesses the existing container given its unique ID in the tinylicious server.
	 * @param id - Unique ID of the container.
	 * @param containerSchema - Container schema used to access data objects in the container.
	 * @returns Existing container instance along with associated services.
	 */
	public async getContainer<TContainerSchema extends ContainerSchema>(
		id: string,
		containerSchema: TContainerSchema,
	): Promise<{
		container: IFluidContainer<TContainerSchema>;
		services: TinyliciousContainerServices;
	}> {
		const loader = this.createLoader(containerSchema);
		const container = await loader.resolve({ url: id });
		const rootDataObject = await this.getContainerEntryPoint(container);
		const fluidContainer = createFluidContainer<TContainerSchema>({
			container,
			rootDataObject,
		});
		const services = this.getContainerServices(container);
		return { container: fluidContainer, services };
	}

	// #region private
	private getContainerServices(container: IContainer): TinyliciousContainerServices {
		return {
			audience: createServiceAudience({
				container,
				createServiceMember: createTinyliciousAudienceMember,
			}),
		};
	}

	private createLoader(schema: ContainerSchema): IHostLoader {
		const containerRuntimeFactory = createDOProviderContainerRuntimeFactory({
			schema,
		});
		const load = async (): Promise<IFluidModuleWithDetails> => {
			return {
				module: { fluidExport: containerRuntimeFactory },
				details: { package: "no-dynamic-package", config: {} },
			};
		};

		const codeLoader = { load };
		const client: IClient = {
			details: {
				capabilities: { interactive: true },
			},
			permission: [],
			scopes: [],
			user: { id: "" },
			mode: "write",
		};

		const featureGates: Record<string, ConfigTypes> = {
			// T9s client requires a write connection by default
			"Fluid.Container.ForceWriteConnection": true,
		};
		const loader = new Loader({
			urlResolver: this.urlResolver,
			documentServiceFactory: this.documentServiceFactory,
			codeLoader,
			logger: this.props?.logger,
			options: { client },
			configProvider: wrapConfigProviderWithDefaults(/* original */ undefined, featureGates),
		});

		return loader;
	}

	private async getContainerEntryPoint(container: IContainer): Promise<IRootDataObject> {
		const rootDataObject: FluidObject<IRootDataObject> = await container.getEntryPoint();
		assert(
			rootDataObject.IRootDataObject !== undefined,
			0x875 /* entryPoint must be of type IRootDataObject */,
		);
		return rootDataObject.IRootDataObject;
	}
	// #endregion
}
