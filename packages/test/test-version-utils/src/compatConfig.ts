/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { assert, Lazy } from "@fluidframework/core-utils";
import { fromInternalScheme } from "@fluid-tools/version-tools";
import {
	CompatKind,
	compatKind,
	compatVersions,
	driver,
	r11sEndpointName,
	tenantIndex,
	reinstall,
} from "../compatOptions.cjs";
import { ensurePackageInstalled } from "./testApi.js";
import { pkgVersion } from "./packageVersion.js";
import { baseVersion, codeVersion, testBaseVersion } from "./baseVersion.js";
import { getRequestedVersion } from "./versionUtils.js";

/**
 * Represents a previous major release of a package based on the provided delta. For example, if the base version is 2.X and
 * the delta is -1, then we are trying to represent the package at version 1.X.
 * @internal
 */
export interface CompatVersion {
	base: string;
	delta: number;
}

/**
 * Generate configuration combinations for a particular compat version
 * @privateRemarks Please update this packages README.md if the default versions and config combination changes
 */
export interface CompatConfig {
	name: string;
	kind: CompatKind;
	compatVersion: number | string;
	loader?: string | number;
	driver?: string | number;
	containerRuntime?: string | number;
	dataRuntime?: string | number;
	/**
	 * Cross Version Compat Only
	 * Version that the `TestObjectProviderWithVersionedLoad` will use to create the container with.
	 * (Same version will be used across all layers).
	 */
	createWith?: CompatVersion;
	/**
	 * Cross Version Compat Only
	 * Version that the `TestObjectProviderWithVersionedLoad` will use to load the container with.
	 * (Same version will be used across all layers).
	 */
	loadWith?: CompatVersion;
}

const defaultCompatVersions = {
	// N and N - 1
	currentVersionDeltas: [0, -1],
	// we are currently supporting 1.3.X long-term
	ltsVersions: ["^1.3.4"],
};

function genConfig(compatVersion: number | string): CompatConfig[] {
	if (compatVersion === 0) {
		return [
			{
				// include the base version if it is not the same as the package version and it is not the test build
				name: `Non-Compat${baseVersion !== pkgVersion ? ` v${baseVersion}` : ""}`,
				kind: CompatKind.None,
				compatVersion: 0,
			},
		];
	}

	const allOld = {
		loader: compatVersion,
		driver: compatVersion,
		containerRuntime: compatVersion,
		dataRuntime: compatVersion,
	};

	const compatVersionStr =
		typeof compatVersion === "string"
			? `${compatVersion} (N)`
			: `${getRequestedVersion(baseVersion, compatVersion)} (N${compatVersion})`;
	return [
		{
			name: `compat ${compatVersionStr} - old loader`,
			kind: CompatKind.Loader,
			compatVersion,
			loader: compatVersion,
		},
		{
			name: `compat ${compatVersionStr} - new loader`,
			kind: CompatKind.NewLoader,
			compatVersion,
			...allOld,
			loader: undefined,
		},
		{
			name: `compat ${compatVersionStr} - old driver`,
			kind: CompatKind.Driver,
			compatVersion,
			driver: compatVersion,
		},
		{
			name: `compat ${compatVersionStr} - new driver`,
			kind: CompatKind.NewDriver,
			compatVersion,
			...allOld,
			driver: undefined,
		},
		{
			name: `compat ${compatVersionStr} - old container runtime`,
			kind: CompatKind.ContainerRuntime,
			compatVersion,
			containerRuntime: compatVersion,
		},
		{
			name: `compat ${compatVersionStr} - new container runtime`,
			kind: CompatKind.NewContainerRuntime,
			compatVersion,
			...allOld,
			containerRuntime: undefined,
		},
		{
			name: `compat ${compatVersionStr} - old data runtime`,
			kind: CompatKind.DataRuntime,
			compatVersion,
			dataRuntime: compatVersion,
		},
		{
			name: `compat ${compatVersionStr} - new data runtime`,
			kind: CompatKind.NewDataRuntime,
			compatVersion,
			...allOld,
			dataRuntime: undefined,
		},
	];
}

const genLTSConfig = (compatVersion: number | string): CompatConfig[] => {
	return [
		{
			name: `compat LTS ${compatVersion} - old loader`,
			kind: CompatKind.Loader,
			compatVersion,
			loader: compatVersion,
		},
		{
			name: `compat LTS ${compatVersion} - old loader + old driver`,
			kind: CompatKind.LoaderDriver,
			compatVersion,
			driver: compatVersion,
			loader: compatVersion,
		},
	];
};

const genBackCompatConfig = (compatVersion: number): CompatConfig[] => {
	const compatVersionStr =
		typeof compatVersion === "string"
			? `${compatVersion} (N)`
			: `${getRequestedVersion(baseVersion, compatVersion)} (N${compatVersion})`;

	return [
		{
			name: `compat back ${compatVersionStr} - older loader`,
			kind: CompatKind.Loader,
			compatVersion,
			loader: compatVersion,
		},
		{
			name: `compat back ${compatVersionStr} - older loader + older driver`,
			kind: CompatKind.LoaderDriver,
			compatVersion,
			driver: compatVersion,
			loader: compatVersion,
		},
	];
};

const genFullBackCompatConfig = (): CompatConfig[] => {
	const _configList: CompatConfig[] = [];

	const [, semverInternal, prereleaseIndentifier] = fromInternalScheme(codeVersion, true, true);
	assert(semverInternal !== undefined, "Unexpected pkg version");

	// Here we check if the release is an RC release. If so, we also need to account for internal releases when
	// generating back compat configs. For back compat purposes, we consider RC major release 1 to be treated as internal
	// major release 9. This will ensure we generate back compat configs for all RC and internal major releases.
	const greatestInternalMajor = 8;
	const greatestMajor =
		prereleaseIndentifier === "rc" || prereleaseIndentifier === "dev-rc"
			? semverInternal.major + greatestInternalMajor
			: semverInternal.major;

	// This makes the assumption N and N-1 scenarios are already fully tested thus skipping 0 and -1.
	// This loop goes as far back as 2.0.0.internal.1.y.z.
	// The idea is to generate all the versions from -2 -> - (major - 1) the current major version (i.e 2.0.0-internal.9.y.z would be -8)
	// This means as the number of majors increase the number of versions we support - this may be updated in the future.
	for (let i = 2; i < greatestMajor; i++) {
		_configList.push(...genBackCompatConfig(-i));
	}
	return _configList;
};

/**
 * Generates the cross version compat config permutations.
 * This will resolve to one permutation where `CompatConfig.createWith` is set to the current version and
 * `CompatConfig.loadWith` is set to the delta (N-1) version. Then, a second permutation where `CompatConfig.createWith`
 * is set to the delta (N-1) version and `CompatConfig.loadWith` is set to the current version.
 *
 * Note: `adjustMajorPublic` will be set to true when requesting versions. This will ensure that we test against
 * the latest **public** major release when using the N-1 version (instead of the most recent internal major release).
 *
 * @internal
 */
export const genCrossVersionCompatConfig = (): CompatConfig[] => {
	const allDefaultDeltaVersions = defaultCompatVersions.currentVersionDeltas.map((delta) => ({
		base: pkgVersion,
		delta,
	}));

	return (
		allDefaultDeltaVersions
			.map((createVersion) =>
				allDefaultDeltaVersions.map((loadVersion) => {
					const resolvedCreateVersion = getRequestedVersion(
						createVersion.base,
						createVersion.delta,
						/** adjustMajorPublic */ true,
					);
					const resolvedLoadVersion = getRequestedVersion(
						loadVersion.base,
						loadVersion.delta,
						/** adjustMajorPublic */ true,
					);
					return {
						name: `compat cross version - create with ${resolvedCreateVersion} + load with ${resolvedLoadVersion}`,
						kind: CompatKind.CrossVersion,
						// Note: `compatVersion` is used to determine what versions need to be installed.
						// By setting it to `resolvedCreateVersion` we ensure both versions will eventually be
						// installed, since we switch the create/load versions in the test permutations.
						compatVersion: resolvedCreateVersion,
						createWith: createVersion,
						loadWith: loadVersion,
					};
				}),
			)
			.reduce((a, b) => a.concat(b))
			// Filter to ensure we don't create/load with the same version.
			.filter((config) => config.createWith !== config.loadWith)
	);
};

export const configList = new Lazy<readonly CompatConfig[]>(() => {
	// set it in the env for parallel workers
	if (compatKind) {
		process.env.fluid__test__compatKind = JSON.stringify(compatKind);
	}
	if (compatVersions) {
		process.env.fluid__test__compatVersion = JSON.stringify(compatVersions);
	}
	process.env.fluid__test__driver = driver;
	process.env.fluid__test__r11sEndpointName = r11sEndpointName;
	process.env.fluid__test__tenantIndex = tenantIndex.toString();
	process.env.fluid__test__baseVersion = baseVersion;

	let _configList: CompatConfig[] = [];

	// CompatVersions is set via pipeline flags. If not set, use default scenarios.
	if (!compatVersions || compatVersions.length === 0) {
		// By default run currentVersionDeltas (N/N-1), LTS, and cross version compat tests
		defaultCompatVersions.currentVersionDeltas.forEach((value) => {
			_configList.push(...genConfig(value));
		});
		defaultCompatVersions.ltsVersions.forEach((value) => {
			_configList.push(...genLTSConfig(value));
		});
		_configList.push(...genCrossVersionCompatConfig());
		// If fluid__test__backCompat=FULL is enabled, run full back compat tests
		if (process.env.fluid__test__backCompat === "FULL") {
			_configList.push(...genFullBackCompatConfig());
		}
	} else {
		compatVersions.forEach((value) => {
			switch (value) {
				case "LTS": {
					defaultCompatVersions.ltsVersions.forEach((lts) => {
						_configList.push(...genLTSConfig(lts));
					});
					break;
				}
				case "FULL": {
					_configList.push(...genFullBackCompatConfig());
					break;
				}
				case "CROSS_VERSION": {
					_configList.push(...genCrossVersionCompatConfig());
					break;
				}
				default: {
					const num = parseInt(value, 10);
					if (num.toString() === value) {
						_configList.push(...genConfig(num));
					} else {
						_configList.push(...genConfig(value));
					}
				}
			}
		});
	}

	if (compatKind !== undefined) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		_configList = _configList.filter((value) => compatKind!.includes(value.kind));
	}
	return _configList;
});

/**
 * Mocha start up to ensure legacy versions are installed
 * @privateRemarks
 * This isn't currently used in a global setup hook due to https://github.com/mochajs/mocha/issues/4508.
 * Instead, we ensure that all requested compatibility versions are loaded at `describeCompat` module import time by
 * leveraging top-level await.
 *
 * This makes compatibility layer APIs (e.g. DDSes, data object, etc.) available at mocha suite creation time rather than
 * hook/test execution time, which is convenient for test authors: this sort of code can be used
 * ```ts
 * describeCompat("my suite", (getTestObjectProvider, apis) => {
 *     class MyDataObject extends apis.dataRuntime.DataObject {
 *         // ...
 *     }
 * });
 * ```
 *
 * instead of code like this:
 *
 * ```ts
 * describeCompat("my suite", (getTestObjectProvider, getApis) => {
 *
 *     const makeDataObjectClass = (apis: CompatApis) => class MyDataObject extends apis.dataRuntime.DataObject {
 *         // ...
 *     }
 *
 *     before(() => {
 *         // `getApis` can only be invoked from inside a hook or test
 *         const MyDataObject = makeDataObjectClass(getApis())
 *     });
 * });
 * ```
 *
 * If the linked github issue is ever fixed, this can be once again used as a global setup fixture.
 *
 * @internal
 */
export async function mochaGlobalSetup() {
	const versions = new Set(configList.value.map((value) => value.compatVersion));
	if (versions.size === 0) {
		return;
	}

	// Make sure we wait for all before returning, even if one of them has error.
	const installP = Array.from(versions.values()).map(async (value) => {
		const version = testBaseVersion(value);
		return ensurePackageInstalled(version, value, reinstall);
	});

	let error: unknown;
	for (const p of installP) {
		try {
			await p;
		} catch (e) {
			error = e;
		}
	}
	if (error) {
		// eslint-disable-next-line @typescript-eslint/no-throw-literal -- rethrowing the originally caught value
		throw error;
	}
}
