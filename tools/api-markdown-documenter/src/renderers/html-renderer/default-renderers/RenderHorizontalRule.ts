/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import type { DocumentWriter } from "../../DocumentWriter.js";
import type { RenderContext } from "../RenderContext.js";
import { renderSelfClosingTag } from "../Utilities.js";

/**
 * Renders a {@link HorizontalRuleNode} as HTML.
 *
 * @param writer - Writer context object into which the document contents will be written.
 * @param context - See {@link RenderContext}.
 */
export function renderHorizontalRule(writer: DocumentWriter, context: RenderContext): void {
	renderSelfClosingTag("hr", writer, context);
}
