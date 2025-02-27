/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { EventEmitterEventType } from "@fluid-internal/client-utils";
import { AttachState } from "@fluidframework/container-definitions";
import { IFluidHandle, ITelemetryBaseProperties } from "@fluidframework/core-interfaces";
import { assert } from "@fluidframework/core-utils";
import {
	IChannelAttributes,
	IChannelServices,
	IChannelStorageService,
	IFluidDataStoreRuntime,
} from "@fluidframework/datastore-definitions";
import { ISequencedDocumentMessage } from "@fluidframework/protocol-definitions";
import {
	IExperimentalIncrementalSummaryContext,
	IGarbageCollectionData,
	ISummaryTreeWithStats,
	ITelemetryContext,
	blobCountPropertyName,
	totalBlobSizePropertyName,
} from "@fluidframework/runtime-definitions";
import {
	DataProcessingError,
	EventEmitterWithErrorHandling,
	ITelemetryLoggerExt,
	MonitoringContext,
	SampledTelemetryHelper,
	createChildLogger,
	loggerToMonitoringContext,
	tagCodeArtifacts,
} from "@fluidframework/telemetry-utils";
import { v4 as uuid } from "uuid";
import { SharedObjectHandle } from "./handle.js";
import { FluidSerializer, IFluidSerializer } from "./serializer.js";
import { SummarySerializer } from "./summarySerializer.js";
import { ISharedObject, ISharedObjectEvents } from "./types.js";
import { makeHandlesSerializable, parseHandles } from "./utils.js";

/**
 * Base class from which all shared objects derive.
 * @alpha
 */
export abstract class SharedObjectCore<TEvent extends ISharedObjectEvents = ISharedObjectEvents>
	extends EventEmitterWithErrorHandling<TEvent>
	implements ISharedObject<TEvent>
{
	public get IFluidLoadable() {
		return this;
	}

	private readonly opProcessingHelper: SampledTelemetryHelper;
	private readonly callbacksHelper: SampledTelemetryHelper;

	/**
	 * The handle referring to this SharedObject
	 */
	public readonly handle: IFluidHandle;

	/**
	 * Telemetry logger for the shared object
	 */
	protected readonly logger: ITelemetryLoggerExt;
	private readonly mc: MonitoringContext;

	/**
	 * Connection state
	 */
	private _connected = false;

	/**
	 * Services used by the shared object
	 */
	private services: IChannelServices | undefined;

	/**
	 * True if the dds is bound to its parent.
	 */
	private _isBoundToContext: boolean = false;

	/**
	 * Tracks error that closed this object.
	 */
	private closeError?: ReturnType<typeof DataProcessingError.wrapIfUnrecognized>;

	/**
	 * Gets the connection state
	 * @returns The state of the connection
	 */
	public get connected(): boolean {
		return this._connected;
	}

	/**
	 * @param id - The id of the shared object
	 * @param runtime - The IFluidDataStoreRuntime which contains the shared object
	 * @param attributes - Attributes of the shared object
	 */
	constructor(
		public id: string,
		protected runtime: IFluidDataStoreRuntime,
		public readonly attributes: IChannelAttributes,
	) {
		super((event: EventEmitterEventType, e: any) => this.eventListenerErrorHandler(event, e));

		assert(!id.includes("/"), 0x304 /* Id cannot contain slashes */);

		this.handle = new SharedObjectHandle(this, id, runtime.IFluidHandleContext);

		this.logger = createChildLogger({
			logger: runtime.logger,
			properties: {
				all: {
					sharedObjectId: uuid(),
					...tagCodeArtifacts({
						ddsType: this.attributes.type,
					}),
				},
			},
		});
		this.mc = loggerToMonitoringContext(this.logger);

		[this.opProcessingHelper, this.callbacksHelper] = this.setUpSampledTelemetryHelpers();
	}

	/**
	 * This function is only supposed to be called from SharedObjectCore's constructor and
	 * depends on a few things being set already. assert() calls make sure of it.
	 * @returns The telemetry sampling helpers, so the constructor can be the one to assign them
	 * to variables to avoid complaints from TypeScript.
	 */
	private setUpSampledTelemetryHelpers(): SampledTelemetryHelper[] {
		assert(
			this.mc !== undefined && this.logger !== undefined,
			0x349 /* this.mc and/or this.logger has not been set */,
		);
		const opProcessingHelper = new SampledTelemetryHelper(
			{
				eventName: "ddsOpProcessing",
				category: "performance",
			},
			this.logger,
			this.mc.config.getNumber("Fluid.SharedObject.OpProcessingTelemetrySampling") ?? 1000,
			true,
			new Map<string, ITelemetryBaseProperties>([
				["local", { localOp: true }],
				["remote", { localOp: false }],
			]),
		);
		const callbacksHelper = new SampledTelemetryHelper(
			{
				eventName: "ddsEventCallbacks",
				category: "performance",
			},
			this.logger,
			this.mc.config.getNumber("Fluid.SharedObject.DdsCallbacksTelemetrySampling") ?? 1000,
			true,
		);

		this.runtime.once("dispose", () => {
			this.callbacksHelper.dispose();
			this.opProcessingHelper.dispose();
		});

		return [opProcessingHelper, callbacksHelper];
	}

	/**
	 * Marks this objects as closed. Any attempt to change it (local changes or processing remote ops)
	 * would result in same error thrown. If called multiple times, only first error is remembered.
	 * @param error - error object that is thrown whenever an attempt is made to modify this object
	 */
	private closeWithError(error: any) {
		if (this.closeError === undefined) {
			this.closeError = error;
		}
	}

	/**
	 * Verifies that this object is not closed via closeWithError(). If it is, throws an error used to close it.
	 */
	private verifyNotClosed() {
		if (this.closeError !== undefined) {
			throw this.closeError;
		}
	}

	/**
	 * Event listener handler helper that can be used to react to exceptions thrown from event listeners
	 * It wraps error with DataProcessingError, closes this object and throws resulting error.
	 * See closeWithError() for more details
	 * Ideally such situation never happens, as consumers of DDS should never throw exceptions
	 * in event listeners (i.e. catch any of the issues and make determination on how to handle it).
	 * When such exceptions propagate through, most likely data model is no longer consistent, i.e.
	 * DDS state does not match what user sees. Because of it DDS moves to "corrupted state" and does not
	 * allow processing of ops or local changes, which very quickly results in container closure.
	 */
	private eventListenerErrorHandler(event: EventEmitterEventType, e: any) {
		const error = DataProcessingError.wrapIfUnrecognized(
			e,
			"SharedObjectEventListenerException",
		);
		error.addTelemetryProperties({ emittedEventName: String(event) });

		this.closeWithError(error);
		throw error;
	}

	private setBoundAndHandleAttach() {
		// Ensure didAttach is only called once, and we only register a single event
		// but we still call setConnectionState as our existing mocks don't
		// always propagate connection state
		this.setBoundAndHandleAttach = () => this.setConnectionState(this.runtime.connected);
		this._isBoundToContext = true;
		const runDidAttach = () => {
			// Allows objects to do any custom processing if it is attached.
			this.didAttach();
			this.setConnectionState(this.runtime.connected);
		};
		if (this.isAttached()) {
			runDidAttach();
		} else {
			this.runtime.once("attaching", runDidAttach);
		}
	}

	/**
	 * A shared object, after construction, can either be loaded in the case that it is already part of
	 * a shared document. Or later attached if it is being newly added.
	 * @param services - Services used by the shared object
	 */
	public async load(services: IChannelServices): Promise<void> {
		this.services = services;
		// set this before load so that isAttached is true
		// for attached runtimes when load core is running
		this._isBoundToContext = true;
		await this.loadCore(services.objectStorage);
		this.attachDeltaHandler();
		this.setBoundAndHandleAttach();
	}

	/**
	 * Initializes the object as a local, non-shared object. This object can become shared after
	 * it is attached to the document.
	 */
	public initializeLocal(): void {
		this.initializeLocalCore();
	}

	/**
	 * {@inheritDoc (ISharedObject:interface).bindToContext}
	 */
	public bindToContext(): void {
		// ensure the method only runs once by removing the implementation
		// without this the method suffers from re-entrancy issues
		this.bindToContext = () => {};
		if (!this._isBoundToContext) {
			this.runtime.bindChannel(this);
			// must set after bind channel so isAttached doesn't report true
			// before binding is complete
			this.setBoundAndHandleAttach();
		}
	}

	/**
	 * {@inheritDoc @fluidframework/datastore-definitions#(IChannel:interface).connect}
	 */
	public connect(services: IChannelServices) {
		// handle the case where load is called
		// before connect; loading detached data stores
		if (this.services === undefined) {
			this.services = services;
			this.attachDeltaHandler();
		}

		this.setBoundAndHandleAttach();
	}

	/**
	 * {@inheritDoc @fluidframework/datastore-definitions#(IChannel:interface).isAttached}
	 */
	public isAttached(): boolean {
		return this._isBoundToContext && this.runtime.attachState !== AttachState.Detached;
	}

	/**
	 * {@inheritDoc @fluidframework/datastore-definitions#(IChannel:interface).getAttachSummary}
	 */
	public abstract getAttachSummary(
		fullTree?: boolean,
		trackState?: boolean,
		telemetryContext?: ITelemetryContext,
	): ISummaryTreeWithStats;

	/**
	 * {@inheritDoc @fluidframework/datastore-definitions#(IChannel:interface).summarize}
	 */
	public abstract summarize(
		fullTree?: boolean,
		trackState?: boolean,
		telemetryContext?: ITelemetryContext,
	): Promise<ISummaryTreeWithStats>;

	/**
	 * {@inheritDoc (ISharedObject:interface).getGCData}
	 */
	public abstract getGCData(fullGC?: boolean): IGarbageCollectionData;

	/**
	 * Called when a handle is decoded by this object. A handle in the object's data represents an outbound reference
	 * to another object in the container.
	 * @param decodedHandle - The handle of the Fluid object that is decoded.
	 */
	protected handleDecoded(decodedHandle: IFluidHandle) {
		if (this.isAttached()) {
			// This represents an outbound reference from this object to the node represented by decodedHandle.
			this.services?.deltaConnection.addedGCOutboundReference?.(this.handle, decodedHandle);
		}
	}

	/**
	 * Allows the distributed data type to perform custom loading
	 * @param services - Storage used by the shared object
	 */
	protected abstract loadCore(services: IChannelStorageService): Promise<void>;

	/**
	 * Allows the distributed data type to perform custom local loading.
	 */
	protected initializeLocalCore() {
		return;
	}

	/**
	 * Allows the distributive data type the ability to perform custom processing once an attach has happened.
	 * Also called after non-local data type get loaded.
	 */
	protected didAttach() {
		return;
	}

	/**
	 * Derived classes must override this to do custom processing on a remote message.
	 * @param message - The message to process
	 * @param local - True if the shared object is local
	 * @param localOpMetadata - For local client messages, this is the metadata that was submitted with the message.
	 * For messages from a remote client, this will be undefined.
	 */
	protected abstract processCore(
		message: ISequencedDocumentMessage,
		local: boolean,
		localOpMetadata: unknown,
	);

	/**
	 * Called when the object has disconnected from the delta stream.
	 */
	protected abstract onDisconnect();

	/**
	 * The serializer to serialize / parse handles.
	 */
	protected abstract get serializer(): IFluidSerializer;

	/**
	 * Submits a message by the local client to the runtime.
	 * @param content - Content of the message. Note: handles contained in the
	 * message object should not be encoded in any way
	 * @param localOpMetadata - The local metadata associated with the message. This is kept locally by the runtime
	 * and not sent to the server. This will be sent back when this message is received back from the server. This is
	 * also sent if we are asked to resubmit the message.
	 */
	protected submitLocalMessage(content: any, localOpMetadata: unknown = undefined): void {
		this.verifyNotClosed();
		if (this.isAttached()) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			this.services!.deltaConnection.submit(
				makeHandlesSerializable(content, this.serializer, this.handle),
				localOpMetadata,
			);
		}
	}

	/**
	 * Marks this object as dirty so that it is part of the next summary. It is called by a SharedSummaryBlock
	 * that want to be part of summary but does not generate ops.
	 */
	protected dirty(): void {
		if (!this.isAttached()) {
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this.services!.deltaConnection.dirty();
	}

	/**
	 * Called when the object has fully connected to the delta stream
	 * Default implementation for DDS, override if different behavior is required.
	 */
	protected onConnect() {}

	/**
	 * Called when a message has to be resubmitted. This typically happens after a reconnection for unacked messages.
	 * The default implementation here is to resubmit the same message. The client can override if different behavior
	 * is required. It can choose to resubmit the same message, submit different / multiple messages or not submit
	 * anything at all.
	 * @param content - The content of the original message.
	 * @param localOpMetadata - The local metadata associated with the original message.
	 */
	protected reSubmitCore(content: any, localOpMetadata: unknown) {
		this.submitLocalMessage(content, localOpMetadata);
	}

	/**
	 * Promises that are waiting for an ack from the server before resolving should use this instead of new Promise.
	 * It ensures that if something changes that will interrupt that ack (e.g. the FluidDataStoreRuntime disposes),
	 * the Promise will reject.
	 * If runtime is disposed when this call is made, executor is not run and promise is rejected right away.
	 */
	protected async newAckBasedPromise<T>(
		executor: (
			resolve: (value: T | PromiseLike<T>) => void,
			reject: (reason?: any) => void,
		) => void,
	): Promise<T> {
		let rejectBecauseDispose: () => void;
		return new Promise<T>((resolve, reject) => {
			rejectBecauseDispose = () =>
				reject(
					new Error(
						"FluidDataStoreRuntime disposed while this ack-based Promise was pending",
					),
				);

			if (this.runtime.disposed) {
				rejectBecauseDispose();
				return;
			}

			this.runtime.on("dispose", rejectBecauseDispose);
			executor(resolve, reject);
		}).finally(() => {
			// Note: rejectBecauseDispose will never be undefined here
			this.runtime.off("dispose", rejectBecauseDispose);
		});
	}

	private attachDeltaHandler() {
		// Services should already be there in case we are attaching delta handler.
		assert(
			this.services !== undefined,
			0x07a /* "Services should be there to attach delta handler" */,
		);
		// attachDeltaHandler is only called after services is assigned
		this.services.deltaConnection.attach({
			process: (
				message: ISequencedDocumentMessage,
				local: boolean,
				localOpMetadata: unknown,
			) => {
				this.process(
					{ ...message, contents: parseHandles(message.contents, this.serializer) },
					local,
					localOpMetadata,
				);
			},
			setConnectionState: (connected: boolean) => {
				this.setConnectionState(connected);
			},
			reSubmit: (content: any, localOpMetadata: unknown) => {
				this.reSubmit(content, localOpMetadata);
			},
			applyStashedOp: (content: any): void => {
				this.applyStashedOp(parseHandles(content, this.serializer));
			},
			rollback: (content: any, localOpMetadata: unknown) => {
				this.rollback(content, localOpMetadata);
			},
		});
	}

	/**
	 * Set the state of connection to services.
	 * @param connected - true if connected, false otherwise.
	 */
	private setConnectionState(connected: boolean) {
		// only an attached shared object can transition its
		// connected state. This is defensive, as some
		// of our test harnesses don't handle this correctly
		if (!this.isAttached() || this._connected === connected) {
			// Not changing state, nothing the same.
			return;
		}

		// Should I change the state at the end? So that we *can't* send new stuff before we send old?
		this._connected = connected;

		if (!connected) {
			// Things that are true now...
			// - if we had a connection we can no longer send messages over it
			// - if we had outbound messages some may or may not be ACK'd. Won't know until next message
			//
			// - nack could get a new msn - but might as well do it in the join?
			this.onDisconnect();
		} else {
			// Call this for now so that DDSes like ConsensusOrderedCollection that maintain their own pending
			// messages will work.
			this.onConnect();
		}
	}

	/**
	 * Handles a message being received from the remote delta server.
	 * @param message - The message to process
	 * @param local - Whether the message originated from the local client
	 * @param localOpMetadata - For local client messages, this is the metadata that was submitted with the message.
	 * For messages from a remote client, this will be undefined.
	 */
	private process(message: ISequencedDocumentMessage, local: boolean, localOpMetadata: unknown) {
		this.verifyNotClosed(); // This will result in container closure.
		this.emitInternal("pre-op", message, local, this);

		this.opProcessingHelper.measure(
			() => {
				this.processCore(message, local, localOpMetadata);
			},
			local ? "local" : "remote",
		);

		this.emitInternal("op", message, local, this);
	}

	/**
	 * Called when a message has to be resubmitted. This typically happens for unacked messages after a
	 * reconnection.
	 * @param content - The content of the original message.
	 * @param localOpMetadata - The local metadata associated with the original message.
	 */
	private reSubmit(content: any, localOpMetadata: unknown) {
		this.reSubmitCore(content, localOpMetadata);
	}

	/**
	 * Revert an op
	 */
	protected rollback(content: any, localOpMetadata: unknown) {
		throw new Error("rollback not supported");
	}

	/**
	 * Apply changes from the provided op content just as if a local client has made the change,
	 * including submitting the op. Used when rehydrating an attached container
	 * with pending changes. The rehydration process replays all remote ops
	 * and applies stashed ops after the remote op with a sequence number
	 * that matches that of the stashed op is applied. This ensures
	 * stashed ops are applied at the same state they were originally created.
	 *
	 * It is possible that stashed ops have been sent in the past, and will be found when
	 * the shared object catches up with remotes ops.
	 * So this prepares the SharedObject for seeing potentially seeing the ACK.
	 * If no matching remote op is found, all the applied stashed ops will go
	 * through the normal resubmit flow upon reconnection, which allows the dds
	 * to rebase them to the latest state, and then resubmit them.
	 *
	 * @param content - Contents of a stashed op.
	 */
	protected abstract applyStashedOp(content: any): void;

	/**
	 * Emit an event. This function is only intended for use by DDS classes that extend SharedObject/SharedObjectCore,
	 * specifically to emit events that are part of the public interface of the DDS (i.e. those that can have listeners
	 * attached to them by the consumers of the DDS). It should not be called from outside the class or to emit events
	 * which are only internal to the DDS. Support for calling it from outside the DDS instance might be removed in the
	 * future.
	 * @param event - The event to emit.
	 * @param args - Arguments to pass to the event listeners.
	 * @returns `true` if the event had listeners, `false` otherwise.
	 */
	public emit(event: EventEmitterEventType, ...args: any[]): boolean {
		return this.callbacksHelper.measure(() => {
			// Creating ops while handling a DDS event can lead
			// to undefined behavior and events observed in the wrong order.
			// For example, we have two callbacks registered for a DDS, A and B.
			// Then if on change #1 callback A creates change #2, the invocation flow will be:
			//
			// A because of #1
			// A because of #2
			// B because of #2
			// B because of #1
			//
			// The runtime must enforce op coherence by not allowing any ops to be created during
			// the event handler
			return this.runtime.ensureNoDataModelChanges(() => super.emit(event, ...args));
		});
	}

	/**
	 * Use to emit events inside {@link SharedObjectCore}, with no telemetry measurement
	 * done on the duration of the callbacks. Simply calls `super.emit()`.
	 * @param event - Event to emit
	 * @param args - Arguments for the event
	 * @returns Whatever `super.emit()` returns.
	 */
	private emitInternal(event: EventEmitterEventType, ...args: any[]): boolean {
		return super.emit(event, ...args);
	}
}

/**
 * SharedObject with simplified, synchronous summarization and GC.
 * DDS implementations with async and incremental summarization should extend SharedObjectCore directly instead.
 * @alpha
 */
export abstract class SharedObject<
	TEvent extends ISharedObjectEvents = ISharedObjectEvents,
> extends SharedObjectCore<TEvent> {
	/**
	 * True while we are garbage collecting this object's data.
	 */
	private _isGCing: boolean = false;

	/**
	 * The serializer to use to serialize / parse handles, if any.
	 */
	private readonly _serializer: IFluidSerializer;

	protected get serializer(): IFluidSerializer {
		/**
		 * During garbage collection, the SummarySerializer keeps track of IFluidHandles that are serialized. These
		 * handles represent references to other Fluid objects.
		 *
		 * This is fine for now. However, if we implement delay loading in DDss, they may load and de-serialize content
		 * in summarize. When that happens, they may incorrectly hit this assert and we will have to change this.
		 */
		assert(
			!this._isGCing,
			0x075 /* "SummarySerializer should be used for serializing data during summary." */,
		);
		return this._serializer;
	}

	/**
	 * @param id - The id of the shared object
	 * @param runtime - The IFluidDataStoreRuntime which contains the shared object
	 * @param attributes - Attributes of the shared object
	 */
	constructor(
		id: string,
		runtime: IFluidDataStoreRuntime,
		attributes: IChannelAttributes,
		private readonly telemetryContextPrefix: string,
	) {
		super(id, runtime, attributes);

		this._serializer = new FluidSerializer(
			this.runtime.channelsRoutingContext,
			(handle: IFluidHandle) => this.handleDecoded(handle),
		);
	}

	/**
	 * {@inheritDoc @fluidframework/datastore-definitions#(IChannel:interface).getAttachSummary}
	 */
	public getAttachSummary(
		fullTree: boolean = false,
		trackState: boolean = false,
		telemetryContext?: ITelemetryContext,
	): ISummaryTreeWithStats {
		const result = this.summarizeCore(this.serializer, telemetryContext);
		this.incrementTelemetryMetric(
			blobCountPropertyName,
			result.stats.blobNodeCount,
			telemetryContext,
		);
		this.incrementTelemetryMetric(
			totalBlobSizePropertyName,
			result.stats.totalBlobSize,
			telemetryContext,
		);
		return result;
	}

	/**
	 * {@inheritDoc @fluidframework/datastore-definitions#(IChannel:interface).summarize}
	 */
	public async summarize(
		fullTree: boolean = false,
		trackState: boolean = false,
		telemetryContext?: ITelemetryContext,
		incrementalSummaryContext?: IExperimentalIncrementalSummaryContext,
	): Promise<ISummaryTreeWithStats> {
		const result = this.summarizeCore(
			this.serializer,
			telemetryContext,
			incrementalSummaryContext,
		);
		this.incrementTelemetryMetric(
			blobCountPropertyName,
			result.stats.blobNodeCount,
			telemetryContext,
		);
		this.incrementTelemetryMetric(
			totalBlobSizePropertyName,
			result.stats.totalBlobSize,
			telemetryContext,
		);
		return result;
	}

	/**
	 * {@inheritDoc (ISharedObject:interface).getGCData}
	 */
	public getGCData(fullGC: boolean = false): IGarbageCollectionData {
		// Set _isGCing to true. This flag is used to ensure that we only use SummarySerializer to serialize handles
		// in this object's data.
		assert(
			!this._isGCing,
			0x078 /* "Possible re-entrancy! Summary should not already be in progress." */,
		);
		this._isGCing = true;

		let gcData: IGarbageCollectionData;
		try {
			const serializer = new SummarySerializer(
				this.runtime.channelsRoutingContext,
				(handle: IFluidHandle) => this.handleDecoded(handle),
			);
			this.processGCDataCore(serializer);
			// The GC data for this shared object contains a single GC node. The outbound routes of this node are the
			// routes of handles serialized during summarization.
			gcData = { gcNodes: { "/": serializer.getSerializedRoutes() } };
			assert(
				this._isGCing,
				0x079 /* "Possible re-entrancy! Summary should have been in progress." */,
			);
		} finally {
			this._isGCing = false;
		}

		return gcData;
	}

	/**
	 * Calls the serializer over all data in this object that reference other GC nodes.
	 * Derived classes must override this to provide custom list of references to other GC nodes.
	 */
	protected processGCDataCore(serializer: IFluidSerializer) {
		// We run the full summarize logic to get the list of outbound routes from this object. This is a little
		// expensive but its okay for now. It will be updated to not use full summarize and make it more efficient.
		// See: https://github.com/microsoft/FluidFramework/issues/4547
		this.summarizeCore(serializer);
	}

	/**
	 * Gets a form of the object that can be serialized.
	 * @returns A tree representing the snapshot of the shared object.
	 */
	protected abstract summarizeCore(
		serializer: IFluidSerializer,
		telemetryContext?: ITelemetryContext,
		incrementalSummaryContext?: IExperimentalIncrementalSummaryContext,
	): ISummaryTreeWithStats;

	private incrementTelemetryMetric(
		propertyName: string,
		incrementBy: number,
		telemetryContext?: ITelemetryContext,
	) {
		const prevTotal = (telemetryContext?.get(this.telemetryContextPrefix, propertyName) ??
			0) as number;
		telemetryContext?.set(this.telemetryContextPrefix, propertyName, prevTotal + incrementBy);
	}
}
