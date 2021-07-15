/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ISharedMap, SharedMap } from "@fluidframework/map";
import { IFluidDataStoreRuntime } from "@fluidframework/datastore-definitions";
import { SharedString } from "@fluidframework/sequence";

const rootMapId = "root";

/**
 * A document is a collection of collaborative types.
 */
export class Document {
    public static async load(runtime: IFluidDataStoreRuntime): Promise<Document> {
        const root = await runtime.getChannel(rootMapId) as ISharedMap;
        const document = new Document(runtime, root);

        return document;
    }

    /**
     * Constructs a new document from the provided details
     */
    private constructor(public runtime: IFluidDataStoreRuntime, private readonly root: ISharedMap) {
    }

    public getRoot(): ISharedMap {
        return this.root;
    }

    public createMap(id?: string): ISharedMap {
        return SharedMap.create(this.runtime, id);
    }

    public createString(id?: string): SharedString {
        return SharedString.create(this.runtime, id);
    }
}
