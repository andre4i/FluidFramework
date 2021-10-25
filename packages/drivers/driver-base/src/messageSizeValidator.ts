/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ITelemetryLogger } from "@fluidframework/common-definitions";
import { IDocumentMessage } from "@fluidframework/protocol-definitions";
import { ThresholdCounter } from "@fluidframework/telemetry-utils";

export class MessageSizeValidator {
    private readonly messageSizeCountersWithEvents = [
        // The order here matters, in order to save telemetry quota.
        // The first counter to exceed its limit will short-circuit
        // event publishing.
        {
            counter: new ThresholdCounter(this.maxMessageSizeInBytes, this.logger),
            eventName: "LargeMessageLimitExceeded",
        },
        {
            counter: new ThresholdCounter(this.maxMessageSizeInBytes / 2, this.logger),
            eventName: "LargeMessage50PercentOfMax",
        },
        {
            counter: new ThresholdCounter(this.maxMessageSizeInBytes / 4, this.logger),
            eventName: "LargeMessage25PercentOfMax",
        },
    ];

    constructor(
        private readonly maxMessageSizeInBytes: number,
        private readonly logger: ITelemetryLogger,
    ) {
    }

    private async track(sizeInBytes: number): Promise<void> {
        return new Promise<void>((resolve) => {
            for (const x of this.messageSizeCountersWithEvents) {
                if (x.counter.send(x.eventName, sizeInBytes)) {
                    break;
                }
            }

            resolve();
        });
    }

    public validate(messages: IDocumentMessage[][]): boolean {
        let sizeInBytes = 0;
        for (const inner of messages) {
            for (const message of inner) {
                sizeInBytes = sizeInBytes + MessageSizeValidator.sizeInBytes(message);
            }
        }

        this.track(sizeInBytes).catch(() => { });
        return sizeInBytes < this.maxMessageSizeInBytes;
    }

    public static sizeInBytes(message: IDocumentMessage): number {
        const { contents, ...restOfObject } = message;
        // `contents` is already stringified. Re-stringifying the whole message will
        // lead to additional escape characters which will increase the size artificially.
        return new TextEncoder().encode(message.contents).length
            + new TextEncoder().encode(JSON.stringify(restOfObject)).length;
    }
}
