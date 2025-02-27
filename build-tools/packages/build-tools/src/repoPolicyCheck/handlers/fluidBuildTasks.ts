/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import fs from "fs";
import path from "path";
import * as JSON5 from "json5";
import * as semver from "semver";
import { Package, PackageJson, updatePackageJsonFile } from "../../common/npmPackage";
import {
	normalizeGlobalTaskDefinitions,
	getTaskDefinitions,
} from "../../common/fluidTaskDefinitions";
import { getEsLintConfigFilePath } from "../../common/taskUtils";
import { FluidRepo } from "../../common/fluidRepo";
import { loadFluidBuildConfig } from "../../common/fluidUtils";
import * as TscUtils from "../../common/tscUtils";
import { Handler, readFile } from "../common";

/**
 * Get and cache the tsc check ignore setting
 */
const fluidBuildTasksTscIgnoreTasksCache = new Map<string, Set<string>>();

const getFluidBuildTasksTscIgnore = (root: string) => {
	const rootDir = path.resolve(root);
	let ignore = fluidBuildTasksTscIgnoreTasksCache.get(rootDir);
	if (ignore === undefined) {
		const ignoreArray =
			loadFluidBuildConfig(rootDir)?.policy?.fluidBuildTasks?.tsc?.ignoreTasks;
		ignore = ignoreArray ? new Set(ignoreArray) : new Set();
		fluidBuildTasksTscIgnoreTasksCache.set(rootDir, ignore);
	}
	return ignore;
};

const fluidBuildTasksTscIgnoreDependenciesCache = new Map<string, Set<string>>();
const getFluidBuildTasksIgnoreDependencies = (root: string) => {
	const rootDir = path.resolve(root);
	let ignore = fluidBuildTasksTscIgnoreDependenciesCache.get(rootDir);
	if (ignore === undefined) {
		const ignoreArray =
			loadFluidBuildConfig(rootDir)?.policy?.fluidBuildTasks?.tsc?.ignoreDependencies;
		ignore = ignoreArray ? new Set(ignoreArray) : new Set();
		fluidBuildTasksTscIgnoreDependenciesCache.set(rootDir, ignore);
	}
	return ignore;
};

const fluidBuildTasksTscIgnoreDevDependenciesCache = new Map<string, Set<string>>();
const getFluidBuildTasksIgnoreDevDependencies = (root: string) => {
	const rootDir = path.resolve(root);
	let ignore = fluidBuildTasksTscIgnoreDevDependenciesCache.get(rootDir);
	if (ignore === undefined) {
		const ignoreArray =
			loadFluidBuildConfig(rootDir)?.policy?.fluidBuildTasks?.tsc?.ignoreDevDependencies;
		ignore = ignoreArray ? new Set(ignoreArray) : new Set();
		fluidBuildTasksTscIgnoreDevDependenciesCache.set(rootDir, ignore);
	}
	return ignore;
};
/**
 * Cache the FluidRepo object, so we don't have to load it repeatedly
 */
const repoCache = new Map<string, { repo: FluidRepo; packageMap: Map<string, Package> }>();
function getFluidPackageMap(root: string) {
	const rootDir = path.resolve(root);
	let record = repoCache.get(rootDir);
	if (record === undefined) {
		const repo = FluidRepo.create(rootDir);
		const packageMap = repo.createPackageMap();
		record = { repo, packageMap };
		repoCache.set(rootDir, record);
	}
	return record.packageMap;
}

/**
 * Find script name for command in a npm package.json
 *
 * @param json - the package.json content to search script in
 * @param command - the command to find the script name for
 * @returns best script name found to match the command
 */
function findScript(json: PackageJson, command: string) {
	// Multiple scripts can have the same command, we want to find the best one.
	let bestScript: { rank: number; script: string | undefined } = {
		rank: 0,
		script: undefined,
	};
	for (const script in json.scripts) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const scriptCommands = json.scripts[script]!.split("&&");
		scriptCommands.forEach((scriptCommand, index) => {
			if (command === scriptCommand.trim()) {
				// Rank better (lower) when there are fewer commands and the command is earlier
				// in the list.
				const rank = (index + 1) * scriptCommands.length;
				if (bestScript.script === undefined || rank < bestScript.rank) {
					bestScript = { rank, script };
				}
			}
		});
		// If we find an exact match, we can stop looking.
		if (bestScript.rank === 1) {
			return bestScript.script;
		}
	}
	return bestScript.script;
}

/**
 * Find the script name for the tsc-multi command in a npm package.json
 *
 * @param json - the package.json content to search script in
 * @param config - the tsc-multi config to check for
 * @returns  first script name found to match the command
 *
 * @remarks
 */
function findTscMultiScript(json: PackageJson, config: string) {
	for (const script in json.scripts) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const scriptCommand = json.scripts[script]!;

		if (scriptCommand.startsWith("tsc-multi") && scriptCommand.includes(config)) {
			return script;
		}
	}
}

/**
 * Find the script name for the fluid-tsc command in a package.json
 *
 * @param json - the package.json content to search script in
 * @param project - the tsc project to check for; `undefined` checks for unspecified project
 * @returns  first script name found to match the command
 *
 * @remarks
 */
function findFluidTscScript(json: PackageJson, project: string | undefined) {
	for (const script in json.scripts) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const scriptCommand = json.scripts[script]!;

		if (scriptCommand.startsWith("fluid-tsc")) {
			if (project ? scriptCommand.includes(project) : !scriptCommand.includes("--project")) {
				return script;
			}
		}
	}
}

/**
 * By default, all `tsc*` script task will depend on "build:genver", and "^tsc",
 * So all the files that it depends on are in place.
 *
 * For dependent package typing (*.d.ts), it default to depend on tsc tasks (^tsc).
 * But not all dependent packages uses a "tsc" script task to generate the type.  This function
 * will go thru all the dependent packages within the mono repo and get the expected set of
 * task dependencies
 *
 * @param root - location of the Fluid Repo root
 * @param json - packages build dependencies to get.
 * @returns an array of build task dependencies name expected
 */
function getDefaultTscTaskDependencies(root: string, json: PackageJson) {
	const packageMap = getFluidPackageMap(root);
	const pkg = packageMap.get(json.name);
	if (pkg === undefined) {
		throw new Error(`Unable to find package ${json.name}`);
	}

	const checkPackageScripts = ["build:genver"];
	const ret = checkPackageScripts.filter((script) => json.scripts?.[script] !== undefined);
	const ignoreDeps = getFluidBuildTasksIgnoreDependencies(root);
	const ignoreDevDeps = getFluidBuildTasksIgnoreDevDependencies(root);
	let hasHeadTsc = false;
	for (const { name, version, dev } of pkg.combinedDependencies) {
		if ((dev ? ignoreDevDeps : ignoreDeps).has(name)) {
			continue;
		}
		const depPackage = packageMap.get(name);
		if (depPackage === undefined) {
			continue;
		}
		const satisfied =
			version.startsWith("workspace:") || semver.satisfies(depPackage.version, version);
		if (!satisfied) {
			continue;
		}
		// TODO: We assume the default build command that produce typing is "tsc"
		const script = findScript(depPackage.packageJson, "tsc");
		if (script === undefined) {
			continue;
		}
		if (script !== "tsc") {
			ret.push(`${depPackage.name}#${script}`);
		} else if (!hasHeadTsc) {
			ret.push("^tsc");
			hasHeadTsc = true;
		}
	}
	return ret;
}

/**
 * @param json - the package.json content to search
 * @param project - the tsc project to search for
 * @returns set of script names found to use the project
 */
function findTscScripts(json: PackageJson, project: string) {
	const tscScripts: string[] = [];
	function addIfDefined(script: string | undefined) {
		if (script !== undefined) {
			tscScripts.push(script);
		}
	}
	if (project === "./tsconfig.json") {
		addIfDefined(findScript(json, "tsc"));
		addIfDefined(findFluidTscScript(json, undefined));
		addIfDefined(findTscMultiScript(json, "tsc-multi.cjs.json"));
		addIfDefined(findTscMultiScript(json, "tsc-multi.node16.cjs.json"));
	}
	addIfDefined(findScript(json, `tsc --project ${project}`));
	addIfDefined(findFluidTscScript(json, project));
	addIfDefined(findTscMultiScript(json, project));
	return tscScripts.length > 0 ? tscScripts : undefined;
}

/**
 * Get a list of build script names that the eslint depends on, based on .eslintrc file.
 * @remarks eslint does not _depend_ on other build tasks. The projects that it references
 *          are configuration guides for the eslint parser, and they associated build tasks
 *          are not prerequisites. Consider policy updates that confirm those tasks are
 *          present, but do not enforce them as prerequisite actions.
 * @param packageDir - directory of the package
 * @param root - directory of the Fluid repo root
 * @param json - content of the package.json
 * @returns
 */
function eslintGetScriptDependencies(
	packageDir: string,
	root: string,
	json: PackageJson,
): string[] {
	if (json.scripts?.["eslint"] === undefined) {
		return [];
	}

	const eslintConfig = getEsLintConfigFilePath(packageDir);
	if (!eslintConfig) {
		throw new Error(`Unable to find eslint config file for package in ${packageDir}`);
	}

	let config;
	try {
		const ext = path.parse(eslintConfig).ext;
		if (ext !== ".js" && ext !== ".cjs") {
			// TODO: optimize double read for TscDependentTask.getDoneFileContent and there.
			const configFile = fs.readFileSync(eslintConfig, "utf8");
			config = JSON5.parse(configFile);
		} else {
			config = require(path.resolve(eslintConfig));
			if (config === undefined) {
				throw new Error(`Exports not found in ${eslintConfig}`);
			}
		}
	} catch (e) {
		throw new Error(`Unable to load eslint config file ${eslintConfig}. ${e}`);
	}

	let projects = config.parserOptions?.project;
	if (projects === undefined) {
		// If we don't have projects, our task needs to have dependent build scripts
		return getDefaultTscTaskDependencies(root, json);
	}

	projects = Array.isArray(projects) ? projects : [projects];
	return projects.map((project) => {
		const found = findTscScripts(json, project);

		// The main compile script is build:esnext, point eslint to it
		if (found === undefined) {
			throw new Error(
				`Unable to find script for project ${project} specified in ${eslintConfig}`,
			);
		}

		return found;
	});
}

/**
 * Check if package has Fluid build enabled.
 * These are packages that are described in 'repoPackages' property in Fluid build config
 * and will be loaded with the FluidRepo object.
 *
 * @param root - directory of the Fluid repo root
 * @param json - package.json content for the package
 * @returns true if FluidRepo includes the package, false otherwise
 */
function isFluidBuildEnabled(root: string, json: PackageJson) {
	return getFluidPackageMap(root).get(json.name) !== undefined;
}

/**
 * Check if a task has a specific dependency
 * @param root - directory of the Fluid repo root
 * @param json - package.json content for the package
 * @param taskName - name of the task to check
 * @param searchDeps - list of any dependent to find.
 * @returns true if searchDep is found for task, false otherwise
 */
function hasTaskDependency(
	root: string,
	json: PackageJson,
	taskName: string,
	searchDeps: string[],
) {
	const rootConfig = loadFluidBuildConfig(root);
	const globalTaskDefinitions = normalizeGlobalTaskDefinitions(rootConfig?.tasks);
	const taskDefinitions = getTaskDefinitions(json, globalTaskDefinitions, false);
	const seenDep = new Set<string>();
	const pending: string[] = [];
	if (taskDefinitions[taskName]) {
		pending.push(...taskDefinitions[taskName].dependsOn);
	}

	while (pending.length !== 0) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const dep = pending.pop()!;
		if (seenDep.has(dep)) {
			// This could be repeats or circular dependency (which we are not trying to detect)
			continue;
		}
		seenDep.add(dep);
		if (searchDeps.includes(dep)) {
			return true;
		}
		if (dep.startsWith("^") || dep.includes("#")) {
			continue;
		}
		if (taskDefinitions[dep]) {
			pending.push(...taskDefinitions[dep].dependsOn);
		}
	}
	return false;
}

/**
 * Check the actual dependencies of a task against an expected set of dependent tasks
 * @param root - directory of the Fluid repo root
 * @param json - package.json content for the package
 * @param taskName - task name to check the actual dependent tasks for
 * @param taskDeps - array of expected dependent tasks
 * @returns message describing the missing dependencies
 */
function checkTaskDeps(
	root: string,
	json: PackageJson,
	taskName: string,
	taskDeps: (string | string[])[],
) {
	const missingTaskDependencies = taskDeps
		.filter(
			(taskDep) =>
				!hasTaskDependency(root, json, taskName, Array.isArray(taskDep) ? taskDep : [taskDep]),
		)
		.map((dep) => (Array.isArray(dep) ? dep.join(" or ") : dep));

	return missingTaskDependencies.length > 0
		? `'${taskName}' task is missing the following dependency: \n\t${missingTaskDependencies.join(
				"\n\t",
		  )}`
		: undefined;
}

/**
 * Fix up the actual dependencies of a task against an expected set of dependent tasks
 * @param root - directory of the Fluid repo root
 * @param json - package.json content for the package
 * @param taskName - task name to check the actual dependent tasks for
 * @param taskDeps - array of expected dependent tasks
 * @returns json object is modified to include the expected task dependencies
 */
function patchTaskDeps(
	root: string,
	json: PackageJson,
	taskName: string,
	taskDeps: (string | string[])[],
) {
	const missingTaskDependencies = taskDeps.filter(
		(taskDep) =>
			!hasTaskDependency(root, json, taskName, Array.isArray(taskDep) ? taskDep : [taskDep]),
	);

	if (missingTaskDependencies.length > 0) {
		const fileDep = json.fluidBuild?.tasks?.[taskName];
		if (fileDep === undefined) {
			let tasks: Exclude<Exclude<PackageJson["fluidBuild"], undefined>["tasks"], undefined>;
			if (json.fluidBuild !== undefined) {
				if (json.fluidBuild.tasks !== undefined) {
					tasks = json.fluidBuild.tasks;
				} else {
					tasks = {};
					json.fluidBuild.tasks = tasks;
				}
			} else {
				tasks = {};
				json.fluidBuild = { tasks };
			}

			tasks[taskName] = taskDeps.map((dep) => {
				if (Array.isArray(dep)) {
					throw new Error(
						`build-tools patchTaskDeps for ${taskName} will not auto select single dependency from choice of ${dep.join(
							" or ",
						)}`,
					);
				}
				return dep;
			});
		} else {
			let depArray: string[];
			if (Array.isArray(fileDep)) {
				depArray = fileDep;
			} else if (fileDep.dependsOn !== undefined) {
				depArray = fileDep.dependsOn;
			} else {
				depArray = [];
				fileDep.dependsOn = depArray;
			}
			for (const missingDep of missingTaskDependencies) {
				if (Array.isArray(missingDep)) {
					throw new Error(
						`build-tools patchTaskDeps for ${taskName} will not auto select single dependency from choice of ${missingDep.join(
							" or ",
						)}`,
					);
				}
				// Check if already added in previous interation to avoid duplicates.
				if (!depArray.includes(missingDep)) {
					depArray.push(missingDep);
				}
			}
		}
	}
}

function getTscCommandDependencies(
	packageDir: string,
	json: PackageJson,
	script: string,
	command: string,
	defaultDeps: string[],
) {
	// If the project has a referenced project, depend on that instead of the default
	const parsedCommand = TscUtils.parseCommandLine(command);
	if (!parsedCommand) {
		throw new Error(`Error parsing tsc command for script '${script}': ${command}`);
	}
	const configFile = TscUtils.findConfigFile(packageDir, parsedCommand);
	const configJson = TscUtils.readConfigFile(configFile);
	if (configJson === undefined) {
		throw new Error(`Failed to load config file '${configFile}'`);
	}

	const deps: (string | string[])[] = [];
	// Assume that we are building test ts files either in tsc or build:esnext if build:test
	// doesn't exist. Make sure the order is encoded
	if (
		json.scripts["build:test"] === undefined &&
		json.scripts["typetests:gen"] !== undefined &&
		(script === "tsc" || (json.scripts["tsc"] === undefined && script === "build:esnext"))
	) {
		deps.push("typetests:gen");
	}
	if (configJson.references) {
		const configFilePath = path.dirname(configFile);

		// Strictly speaking tsc project references would build the referenced projects as needed,
		// but with parallel builds we want to ensure referenced projects are built first (and not
		// simultaneously). So we add the referenced projects as dependencies.
		for (const ref of configJson.references) {
			let refConfigPath = path.join(configFilePath, ref.path);
			const fileInfo = fs.statSync(refConfigPath);
			if (fileInfo.isDirectory()) {
				refConfigPath = path.join(refConfigPath, "tsconfig.json");
			}
			// Environment path separator may be \, but find helpers all do
			// simple string comparisons where paths are expected to use /.
			// So, ensure search project is set with only / separators.
			refConfigPath = TscUtils.normalizeSlashes(
				`./${path.relative(packageDir, refConfigPath)}`,
			);

			// Warning: This check will find any script that references the project, but
			// there may be multiple scripts that reference the same project with tsc-multi
			// that will mangle the project output and thus proper reference may not
			// be found. Policy only enforces that at least one of the possible scripts
			// that builds the referenced project is listed as a dependency.
			const referencedScript = findTscScripts(json, refConfigPath);
			if (referencedScript === undefined) {
				throw new Error(`Unable to find tsc script for referenced project ${refConfigPath}`);
			}
			deps.push(referencedScript);
		}
	}

	return deps.concat(defaultDeps);
}

const match = /(^|\/)package\.json/i;
export const handlers: Handler[] = [
	{
		name: "fluid-build-tasks-eslint",
		match,
		handler: async (file, root) => {
			let json;
			try {
				json = JSON.parse(readFile(file));
			} catch (err) {
				return "Error parsing JSON file: " + file;
			}

			if (!isFluidBuildEnabled(root, json)) {
				return;
			}
			let scriptDeps: string[];
			try {
				scriptDeps = eslintGetScriptDependencies(path.dirname(file), root, json);
				return checkTaskDeps(root, json, "eslint", scriptDeps);
			} catch (e: any) {
				return e.message;
			}
		},
		resolver: (file, root) => {
			let result: { resolved: boolean; message?: string } = { resolved: true };
			updatePackageJsonFile(path.dirname(file), (json) => {
				if (!isFluidBuildEnabled(root, json)) {
					return;
				}
				let scriptDeps: string[];
				try {
					scriptDeps = eslintGetScriptDependencies(path.dirname(file), root, json);
					patchTaskDeps(root, json, "eslint", scriptDeps);
				} catch (e: any) {
					result = { resolved: false, message: e.message };
					return;
				}
			});
			return result;
		},
	},
	{
		name: "fluid-build-tasks-tsc",
		match,
		handler: async (file, root) => {
			let json: PackageJson;
			try {
				json = JSON.parse(readFile(file));
			} catch (err) {
				return "Error parsing JSON file: " + file;
			}

			if (!isFluidBuildEnabled(root, json)) {
				return;
			}
			if (json.scripts === undefined) {
				return;
			}
			const packageDir = path.dirname(file);
			const errors: string[] = [];
			const deps = getDefaultTscTaskDependencies(root, json);
			const ignore = getFluidBuildTasksTscIgnore(root);
			for (const script in json.scripts) {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				const commands = json.scripts[script]!;
				for (const commandUntrimmed of commands.split("&&")) {
					const command = commandUntrimmed.trim();
					if (shouldProcessScriptForTsc(script, command, ignore)) {
						try {
							const checkDeps = getTscCommandDependencies(
								packageDir,
								json,
								script,
								command,
								deps,
							);
							// Check the dependencies
							const error = checkTaskDeps(root, json, script, checkDeps);
							if (error) {
								errors.push(error);
							}
						} catch (e: any) {
							return e.message;
						}
					}
				}
			}
			return errors.length > 0 ? errors.join("\n") : undefined;
		},
		resolver: (file, root) => {
			let result: { resolved: boolean; message?: string } = { resolved: true };
			updatePackageJsonFile(path.dirname(file), (json) => {
				if (!isFluidBuildEnabled(root, json)) {
					return;
				}

				const packageDir = path.dirname(file);
				const deps = getDefaultTscTaskDependencies(root, json);
				const ignore = getFluidBuildTasksTscIgnore(root);
				for (const script in json.scripts) {
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					const commands = json.scripts[script]!;
					for (const commandUntrimmed of commands.split("&&")) {
						const command = commandUntrimmed.trim();
						if (shouldProcessScriptForTsc(script, command, ignore)) {
							try {
								const checkDeps = getTscCommandDependencies(
									packageDir,
									json,
									script,
									command,
									deps,
								);
								patchTaskDeps(root, json, script, checkDeps);
							} catch (e: any) {
								result = { resolved: false, message: e.message };
								return;
							}
						}
					}
				}
			});
			return result;
		},
	},
];

/**
 * Helper to determine if a script/command should be processed by the handler for tsc fluid-build tasks.
 * @param script - The name of the npm script in package.json.
 * @param command - The command that the npm script executes.
 * @param tasksToIgnore - List of fluid-build tasks (usually npm scripts) that should be ignored.
 * @returns
 */
function shouldProcessScriptForTsc(
	script: string,
	command: string,
	tasksToIgnore: Set<string>,
): boolean {
	return (
		// This clause ensures we don't match commands that are prefixed with "tsc", like "tsc-multi". The exception
		// is when the whole command is "tsc".
		(command.startsWith("tsc ") || command === "tsc" || command.startsWith("fluid-tsc ")) &&
		// tsc --watch tasks are long-running processes and don't need the standard task deps
		!command.includes("--watch") &&
		!tasksToIgnore.has(script)
	);
}
