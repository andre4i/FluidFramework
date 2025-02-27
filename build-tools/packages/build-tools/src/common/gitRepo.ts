/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { parseISO } from "date-fns";
import { exec, execNoError } from "./utils";

import registerDebug from "debug";
const traceGitRepo = registerDebug("fluid-build:gitRepo");
export class GitRepo {
	constructor(public readonly resolvedRoot: string) {}

	private async getRemotes() {
		const result = await this.exec(`remote -v`, `getting remotes`);
		const remoteLines = result.split(/\r?\n/);
		return remoteLines.map((line) => line.split(/\s+/));
	}

	/**
	 * Get the remote based on the partial Url.
	 * It will match the first remote that contains the partialUrl case insensitively
	 * @param partialUrl partial url to match case insensitively
	 */
	public async getRemote(partialUrl: string) {
		const lowerPartialUrl = partialUrl.toLowerCase();
		const remotes = await this.getRemotes();
		for (const r of remotes) {
			if (r[1] && r[1].toLowerCase().includes(lowerPartialUrl)) {
				return r[0];
			}
		}
		return undefined;
	}

	public async getCurrentSha() {
		const result = await this.exec(`rev-parse HEAD`, `get current sha`);
		return result.split(/\r?\n/)[0];
	}

	public async getShaForBranch(branch: string, remote?: string) {
		const refspec = remote ? `refs/remotes/${remote}/${branch}` : `refs/heads/${branch}`;
		const result = await this.execNoError(`show-ref ${refspec}`);
		if (result) {
			const line = result.split(/\r?\n/)[0];
			if (line) {
				return line.split(" ")[0];
			}
		}
		return undefined;
	}

	public async isBranchUpToDate(branch: string, remote: string) {
		await this.fetchBranch(remote, branch);
		const currentSha = await this.getShaForBranch(branch);
		const remoteSha = await this.getShaForBranch(branch, remote);
		return remoteSha === currentSha;
	}

	public async getStatus() {
		return await this.execNoError(`status --porcelain`);
	}

	public async getShaForTag(tag: string) {
		const result = await this.execNoError(`show-ref refs/tags/${tag}`);
		if (result) {
			const line = result.split(/\r?\n/)[0];
			if (line) {
				return line.split(" ")[0];
			}
		}
		return undefined;
	}

	/**
	 * Add a tag to the current commit
	 *
	 * @param tag the tag to add
	 */
	public async addTag(tag: string) {
		await this.exec(`tag ${tag}`, `adding tag ${tag}`);
	}

	/**
	 * Delete a tag
	 * NOTE: this doesn't fail on error
	 *
	 * @param tag the tag to add
	 */
	public async deleteTag(tag: string) {
		await this.execNoError(`tag -d ${tag}`);
	}

	/**
	 * Push a tag
	 *
	 */
	public async pushTag(tag: string, remote: string) {
		await this.exec(`push ${remote} ${tag}`, `pushing tag`);
	}

	/**
	 * Get the current git branch name
	 */
	public async getCurrentBranchName() {
		const revParseOut = await this.exec("rev-parse --abbrev-ref HEAD", "get current branch");
		return revParseOut.split(/\r?\n/)[0];
	}

	/**
	 * Create a new branch
	 *
	 * @param branchName name of the new branch
	 */
	public async createBranch(branchName: string) {
		await this.exec(`checkout -b ${branchName}`, `create branch ${branchName}`);
	}

	/**
	 * Push branch
	 * @param branchName
	 */
	public async pushBranch(remote: string, fromBranchName: string, toBranchName: string) {
		await this.exec(
			`push ${remote} ${fromBranchName}:${toBranchName}`,
			`push branch ${fromBranchName}->${toBranchName} to ${remote}`,
		);
	}

	/**
	 * Delete a branch
	 * NOTE: this doesn't fail on error
	 *
	 * @param branchName name of the new branch
	 */
	public async deleteBranch(branchName: string) {
		await this.execNoError(`branch -D ${branchName}`);
	}

	/**
	 * Switch branch
	 *
	 * @param branchName name of the new branch
	 */
	public async switchBranch(branchName: string) {
		await this.exec(`checkout ${branchName}`, `switch branch ${branchName}`);
	}

	/**
	 * Commit changes
	 *
	 * @param message the commit message
	 */
	public async commit(message: string, error: string) {
		await this.exec(`commit -a -F -`, error, message);
	}

	/**
	 * Fetch branch
	 */
	public async fetchBranch(remote: string, branchName: string) {
		return await this.exec(
			`fetch ${remote} ${branchName}`,
			`fetch branch ${branchName} from remote ${remote}`,
		);
	}

	/**
	 * Fetch Tags
	 */
	public async fetchTags() {
		return await this.exec(`fetch --tags --force`, `fetch tags`);
	}

	/**
	 * Get Tags
	 *
	 * @param pattern pattern of tags to get
	 */
	public async getTags(pattern: string) {
		return await this.exec(`tag -l ${pattern}`, `get tags ${pattern}`);
	}

	/**
	 * Get all tags matching a pattern.
	 *
	 * @param pattern - Pattern of tags to get.
	 */
	public async getAllTags(pattern?: string): Promise<string[]> {
		if (pattern === undefined || pattern.length === 0) {
			traceGitRepo(`Reading git tags from repo.`);
		} else {
			traceGitRepo(`Reading git tags from repo using pattern: '${pattern}'`);
		}
		const results =
			pattern === undefined || pattern.length === 0
				? await this.exec(`tag -l --sort=-committerdate`, `get all tags`)
				: await this.exec(`tag -l "${pattern}" --sort=-committerdate`, `get tags ${pattern}`);
		const tags = results.split("\n").filter((t) => t !== undefined && t !== "" && t !== null);

		traceGitRepo(`Found ${tags.length} tags.`);
		return tags;
	}

	/**
	 * Returns an array containing all the modified files in the repo.
	 */
	public async getModifiedFiles(): Promise<string[]> {
		const results = await this.exec(`status --porcelain`, `get modified files`);
		return results
			.split("\n")
			.filter((t) => t !== "" && !t.startsWith(" D "))
			.map((t) => t.substring(3));
	}

	/**
	 * @param gitRef - A reference to a git commit/tag/branch for which the commit date will be parsed.
	 * @returns The commit date of the ref.
	 */
	public async getCommitDate(gitRef: string) {
		const result = (
			await this.exec(`show -s --format=%cI "${gitRef}"`, `get commit date ${gitRef}`)
		).trim();
		const date = parseISO(result);
		return date;
	}

	public async setUpstream(branchName: string, remote: string = "origin") {
		return await this.exec(`push --set-upstream ${remote} ${branchName}`, `publish branch`);
	}

	public async addRemote(repoPath: string) {
		return await this.exec(`remote add upstream ${repoPath}`, `set remote`);
	}

	/**
	 * Execute git command
	 *
	 * @param command the git command
	 * @param error description of command line to print when error happens
	 */
	private async exec(command: string, error: string, pipeStdIn?: string) {
		return exec(`git ${command}`, this.resolvedRoot, error, pipeStdIn);
	}

	/**
	 * Execute git command
	 *
	 * @param command the git command
	 * @param error description of command line to print when error happens
	 */
	private async execNoError(command: string, pipeStdIn?: string) {
		return execNoError(`git ${command}`, this.resolvedRoot, pipeStdIn);
	}
}
