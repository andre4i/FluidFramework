/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { FieldChangeRebaser } from "../modular-schema/index.js";
import { compose } from "./compose.js";
import { invert } from "./invert.js";
import { prune } from "./prune.js";
import { rebase } from "./rebase.js";
import { Changeset } from "./types.js";

export type SequenceChangeRebaser = FieldChangeRebaser<Changeset>;

export const sequenceFieldChangeRebaser = {
	compose,
	invert,
	rebase,
	prune,
};
