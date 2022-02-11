/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ITelemetryLogger } from "@fluidframework/common-definitions";
import { unreachableCase } from "@fluidframework/common-utils";
import { AttachState } from "@fluidframework/container-definitions";
import { IFluidRouter, IRequest, IResponse } from "@fluidframework/core-interfaces";
import { IFluidDataStoreChannel } from "@fluidframework/runtime-definitions";
import { TelemetryDataTag } from "@fluidframework/telemetry-utils";
import { ContainerRuntime } from "./containerRuntime";
import { DataStores } from "./dataStores";

/**
 * Interface for an op to be used for assigning an
 * alias to a datastore
 */
export interface IDataStoreAliasMessage {
    /** The internal id of the datastore */
    readonly internalId: string;
    /** The alias name to be assigned to the datastore */
    readonly alias: string;
}

/**
 * Type guard that returns true if the given alias message is actually an instance of
 * a class which implements @see IDataStoreAliasMessage
 * @param maybeDataStoreAliasMessage - message object to be validated
 * @returns True if the @see IDataStoreAliasMessage is fully implemented, false otherwise
 */
 export const isDataStoreAliasMessage = (
    maybeDataStoreAliasMessage: any,
): maybeDataStoreAliasMessage is IDataStoreAliasMessage => {
    return typeof maybeDataStoreAliasMessage?.internalId === "string"
        && typeof maybeDataStoreAliasMessage?.alias === "string";
};

/**
 * Encapsulates the return codes of the aliasing API
 */
export enum AliasResult {
    /**
     * The datastore has been successfully aliased
     */
    Success = "Success",
    /**
     * There is already a datastore bound to the provided alias
     */
    Conflict = "Conflict",
    /**
     * The datastore is currently in the process of being aliased
     */
    Aliasing = "Aliasing",
    /**
     * The datastore has been attempted to be aliased before
     */
    AlreadyAliased = "AlreadyAliased",
}

/**
 * A fluid router with the capability of being assigned an alias
 */
 export interface IDataStore extends IFluidRouter {
    /**
     * Attempt to assign an alias to the datastore.
     * If the operation succeeds, the datastore can be referenced
     * by the supplied alias.
     *
     * @param alias - Given alias for this datastore.
     */
    trySetAlias(alias: string): Promise<AliasResult>;
}

export const channelToDataStore = (
    fluidDataStoreChannel: IFluidDataStoreChannel,
    internalId: string,
    runtime: ContainerRuntime,
    datastores: DataStores,
    logger: ITelemetryLogger,
): IDataStore => new DataStore(fluidDataStoreChannel, internalId, runtime, datastores, logger);

enum AliasState {
    Aliased = "Aliased",
    Aliasing = "Aliasing",
    None = "None",
}

class DataStore implements IDataStore {
    private aliasState: AliasState = AliasState.None;
    private alias: string | undefined;

    async trySetAlias(alias: string): Promise<AliasResult> {
        switch (this.aliasState) {
            // If we're already aliasing, throw an exception
            case AliasState.Aliasing:
                return AliasResult.Aliasing;
            // If this datastore is already aliased, return true only if this
            // is a repeated call for the same alias
            case AliasState.Aliased:
                return this.alias === alias ? AliasResult.Success : AliasResult.AlreadyAliased;
            // There is no current or past alias operation for this datastore,
            // it is safe to continue execution
            case AliasState.None: break;
            default: unreachableCase(this.aliasState);
        }

        this.aliasState = AliasState.Aliasing;
        const message: IDataStoreAliasMessage = {
            internalId: this.internalId,
            alias,
        };

        if (this.runtime.attachState === AttachState.Detached) {
            const localResult = this.datastores.processAliasMessageCore(message);
            // Explicitly Lock-out future attempts of aliasing,
            // regardless of result
            this.aliasState = AliasState.Aliased;
            return localResult ? AliasResult.Success : AliasResult.Conflict;
        }

        this.fluidDataStoreChannel.bindToContext();

        const aliased = await this.ackBasedPromise<boolean>((resolve) => {
            this.runtime.submitDataStoreAliasOp(message, resolve);
        }).then((succeeded) => {
            // Explicitly Lock-out future attempts of aliasing,
            // regardless of result
            this.aliasState = AliasState.Aliased;
            if (succeeded) {
                this.alias = alias;
            }

            return succeeded;
        }).catch((error) => {
            this.logger.sendErrorEvent({
                eventName: "AliasingException",
                alias: {
                    value: alias,
                    tag: TelemetryDataTag.UserData,
                },
                internalId: {
                    value: this.internalId,
                    tag: TelemetryDataTag.PackageData,
                },
            }, error);
            this.aliasState = AliasState.None;
            return false;
        });

        return aliased ? AliasResult.Success : AliasResult.Conflict;
    }

    async request(request: IRequest): Promise<IResponse> {
        return this.fluidDataStoreChannel.request(request);
    }

    constructor(
        private readonly fluidDataStoreChannel: IFluidDataStoreChannel,
        private readonly internalId: string,
        private readonly runtime: ContainerRuntime,
        private datastores: DataStores,
        private readonly logger: ITelemetryLogger,
    ) { }
    public get IFluidRouter() { return this.fluidDataStoreChannel; }

    private async ackBasedPromise<T>(
        executor: (resolve: (value: T | PromiseLike<T>) => void,
        reject: (reason?: any) => void) => void,
    ): Promise<T> {
        let rejectBecauseDispose: () => void;
        return new Promise<T>((resolve, reject) => {
            rejectBecauseDispose =
                () => reject(new Error("ContainerRuntime disposed while this ack-based Promise was pending"));

            if (this.runtime.disposed) {
                rejectBecauseDispose();
                return;
            }

            this.runtime.on("dispose", rejectBecauseDispose);
            executor(resolve, reject);
        }).finally(() => {
            this.runtime.off("dispose", rejectBecauseDispose);
        });
    }
}
