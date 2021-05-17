/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
    IFluidHandle,
    IFluidHandleContext,
    IFluidSerializer,
} from "@fluidframework/core-interfaces";
import { RemoteFluidObjectHandle } from "./remoteObjectHandle";
import { generateHandleContextPath } from "./dataStoreHandleContextUtils";
import { isSerializedHandle } from "./utils";

function recursivelyReplace(
    input: any,
    replacer: (input: any) => any,
) {
    // If the current input is an IFluidHandle instance, replace this leaf in the object graph with
    // the handle's serialized from.
    const result = replacer(input);

    if (result !== input) {
        return result;
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    let clone: object | undefined;
    for (const key of Object.keys(input)) {
        const value = input[key];
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (!!value && typeof value === "object") {
            // Note: `input` has either been replaced (above) or must not contain circular references (as
            //       object must be JSON serializable.)  Therefore, guarding against infinite recursion here
            //       would only lead to a later error when attempting to stringify().
            const replaced = recursivelyReplace(value, replacer);

            // If the `replaced` object is different than the original `value` then the subgraph contained one
            // or more replacements.  If this happens, we need to return a clone of the `input` object where
            // the current property is replaced by the `replaced` value.
            if (replaced !== value) {
                // Lazily create a shallow clone of the `input` object if we haven't done so already.
                clone = clone ?? (Array.isArray(input)
                    ? [...input]
                    : { ...input });

                // Overwrite the current property `key` in the clone with the `replaced` value.
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                clone![key] = replaced;
            }
        }
    }

    return clone ?? input;
}

/**
 * Data Store serializer implementation
 */
export class FluidSerializer implements IFluidSerializer {
    private readonly root: IFluidHandleContext;

    public constructor(private readonly context: IFluidHandleContext) {
        this.root = this.context;
        while (this.root.routeContext !== undefined) {
            this.root = this.root.routeContext;
        }
    }

    public get IFluidSerializer() { return this; }

    private encodeValue(value: any, bind: IFluidHandle) {
        const handle = value.IFluidHandle;

        return handle !== undefined
            ? this.serializeHandle(handle, bind)
            : value;
    }

    private decodeValue(value: any) {
        if (!isSerializedHandle(value)) {
            return value;
        }

        // Old documents may have handles with relative path in their summaries. Convert these to absolute
        // paths. This will ensure that future summaries will have absolute paths for these handles.
        const absolutePath = value.url.startsWith("/")
            ? value.url
            : generateHandleContextPath(value.url, this.context);
        return new RemoteFluidObjectHandle(absolutePath, this.root);
    }

    /**
     * Given a mostly-jsonable object that may have handle objects embedded within, will return a fully-jsonable object
     * where any embedded IFluidHandles have been replaced with a serializable form.
     *
     * The original `input` object is not mutated.  This method will shallowly clones all objects in the path from
     * the root to any replaced handles.  (If no handles are found, returns the original object.)
     */
    public replaceHandles(input: any, bind: IFluidHandle) {
        // If the given 'input' cannot contain handles, return it immediately.  Otherwise,
        // return the result of recursively replacing handles with thier encoded form.
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        return !!input && typeof input === "object"
            ? recursivelyReplace(input, (value) => this.encodeValue(value, bind))
            : input;
    }

    public stringify(input: any, bind: IFluidHandle) {
        return JSON.stringify(input,
            (key, value) =>
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                value && this.encodeValue(value, bind));
    }

    // Parses the serialized data - context must match the context with which the JSON was stringified
    public parse(input: string) {
        return JSON.parse(input, (key, value) => this.decodeValue(value));
    }

    protected serializeHandle(handle: IFluidHandle, bind: IFluidHandle) {
        bind.bind(handle);
        return {
            type: "__fluid_handle__",
            url: handle.absolutePath,
        };
    }
}
