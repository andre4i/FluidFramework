/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import * as fs from "fs";
import { ITelemetryBaseEvent } from "@fluidframework/core-interfaces";
import { parse } from "json2csv";
import { BaseFileLogger } from "./baseFileLogger";

/**
 * FileLogger that writes events into a defined CSV file
 * @internal
 */
export class CSVFileLogger extends BaseFileLogger {
	/** Store the column names to write as the CSV header */
	private readonly columns = new Set();

	protected async flush(): Promise<void> {
		// No flushing is performed since we need all log entries to determine set of CSV columns
	}

	public send(event: ITelemetryBaseEvent): void {
		// eslint-disable-next-line guard-for-in, no-restricted-syntax
		for (const prop in event) {
			this.columns.add(prop);
		}
		super.send(event);
	}

	public async close(): Promise<void> {
		await super.close();
		// eslint-disable-next-line guard-for-in, no-restricted-syntax
		for (const field in this.defaultProps) {
			this.columns.add(field);
		}

		fs.writeFileSync(this.filePath, parse(this.events, Array.from(this.columns)));
	}
}
