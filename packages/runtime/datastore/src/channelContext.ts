/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { IChannel } from "@fluidframework/datastore-definitions";
import { IDocumentStorageService } from "@fluidframework/driver-definitions";
import { ISequencedDocumentMessage, ISnapshotTree } from "@fluidframework/protocol-definitions";
import {
    IGarbageCollectionData,
    ISummarizeResult,
    ISummaryTreeWithStats,
} from "@fluidframework/runtime-definitions";
import { addBlobToSummary } from "@fluidframework/runtime-utils";
import { ChannelDeltaConnection } from "./channelDeltaConnection";
import { ChannelStorageService } from "./channelStorageService";

export const attributesBlobKey = ".attributes";

export interface IChannelContext {
    getChannel(): Promise<IChannel>;

    setConnectionState(connected: boolean, clientId?: string);

    processOp(message: ISequencedDocumentMessage, local: boolean, localOpMetadata?: unknown): void;

    summarize(fullTree?: boolean, trackState?: boolean): Promise<ISummarizeResult>;

    reSubmit(content: any, localOpMetadata: unknown): void;

    applyStashedOp(content: any): unknown;

    /**
     * Returns the data used for garbage collection. This includes a list of GC nodes that represent this context
     * including any of its children. Each node has a set of outbound routes to other GC nodes in the document.
     * @param fullGC - true to bypass optimizations and force full generation of GC data.
     */
    getGCData(fullGC?: boolean): Promise<IGarbageCollectionData>;

    /**
     * After GC has run, called to notify this context of routes that are used in it. These are used for the following:
     * 1. To identify if this context is being referenced in the document or not.
     * 2. To identify if this context or any of its children's used routes changed since last summary.
     * 3. They are added to the summary generated by this context.
     */
    updateUsedRoutes(usedRoutes: string[]): void;
}

export function createServiceEndpoints(
    id: string,
    connected: boolean,
    submitFn: (content: any, localOpMetadata: unknown) => void,
    dirtyFn: () => void,
    storageService: IDocumentStorageService,
    tree?: ISnapshotTree,
    extraBlobs?: Map<string, ArrayBufferLike>,
) {
    const deltaConnection = new ChannelDeltaConnection(
        id,
        connected,
        (message, localOpMetadata) => submitFn(message, localOpMetadata),
        dirtyFn);
    const objectStorage = new ChannelStorageService(tree, storageService, extraBlobs);

    return {
        deltaConnection,
        objectStorage,
    };
}

export function summarizeChannel(
    channel: IChannel,
    fullTree: boolean = false,
    trackState: boolean = false,
): ISummaryTreeWithStats {
    const summarizeResult = channel.summarize(fullTree, trackState);

    // Add the channel attributes to the returned result.
    addBlobToSummary(summarizeResult, attributesBlobKey, JSON.stringify(channel.attributes));
    return summarizeResult;
}
