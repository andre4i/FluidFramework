/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

const path = require("path");
const { merge } = require("webpack-merge");
const webpack = require("webpack");

module.exports = (env) => {
	return {
		mode: "production",
		entry: {
			main: "./assets/icons/SVGStoreIcons/index.cjs",
		},
		resolve: {
			extensions: [".ts", ".tsx", ".js"],
		},
		module: {
			rules: [
				{
					test: /\.svg$/,
					use: [
						{
							loader: require.resolve("svg-sprite-loader"),
						},
						{
							loader: require.resolve("svgo-loader"),
							options: require("./svgo.plugins.cjs"),
						},
					],
				},
			],
		},
		output: {
			filename: "./index.cjs",
			path: path.resolve(__dirname, "dist", "assets", "icons", "SVGStoreIcons"),
		},
	};
};
