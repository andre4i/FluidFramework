/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	IAppState,
	IArrayish,
	IClient,
	makeBubble,
	makeClient,
} from "@fluid-example/bubblebench-common";
import { Change, SharedTree } from "@fluid-experimental/tree";
import { TreeArrayProxy, TreeObjectProxy, fromJson } from "./proxy/index.js";

interface IApp {
	clients: IArrayish<IClient>;
}

export class AppState implements IAppState {
	private readonly update: (...change: Change[]) => void;
	public readonly applyEdits: () => void;
	private readonly root: IApp;

	public readonly localClient: IClient;

	private readonly deferredUpdates = true;
	private readonly deferredChanges: Change[] = [];

	constructor(
		private readonly tree: SharedTree,
		private _width: number,
		private _height: number,
		numBubbles: number,
	) {
		this.update = this.deferredUpdates
			? this.deferredChanges.push.bind(this.deferredChanges)
			: this.tree.applyEdit.bind(tree);

		this.applyEdits = this.deferredUpdates
			? () => {
					this.tree.applyEdit(...this.deferredChanges);
					this.deferredChanges.length = 0;
			  }
			: () => {};

		this.root = TreeObjectProxy<IApp>(this.tree, this.tree.currentView.root, this.update);

		const json = makeClient(_width, _height, numBubbles);
		const clientNode = fromJson(tree, json);
		(this.clients as unknown as TreeArrayProxy<IClient>).pushNode(clientNode);
		this.localClient = TreeObjectProxy(this.tree, clientNode.identifier, this.update);

		this.applyEdits();
	}

	public setSize(width?: number, height?: number) {
		this._width = width ?? 640;
		this._height = height ?? 480;
	}

	public get width() {
		return this._width;
	}
	public get height() {
		return this._height;
	}

	public get clients(): IArrayish<IClient> {
		return this.root.clients;
	}

	private makeBubble() {
		return makeBubble(this.width, this.height);
	}

	public increaseBubbles() {
		this.localClient.bubbles.push(this.makeBubble());
	}

	public decreaseBubbles() {
		const bubbles = this.localClient.bubbles;
		if (bubbles.length > 1) {
			bubbles.pop();
		}
	}
}
