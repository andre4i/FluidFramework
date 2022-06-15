/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ICreateTreeParams } from "@fluidframework/gitresources";
import { handleResponse } from "@fluidframework/server-services-shared";
import { Router } from "express";
import nconf from "nconf";
import {
    getRepoManagerFromWriteAPI,
    getRepoManagerParamsFromRequest,
    IRepositoryManagerFactory,
    logAndThrowApiError,
} from "../../utils";

export function create(store: nconf.Provider, repoManagerFactory: IRepositoryManagerFactory): Router {
    const router: Router = Router();
    const repoPerDocEnabled: boolean = store.get("git:repoPerDocEnabled") ?? false;

    router.post("/repos/:owner/:repo/git/trees", async (request, response, next) => {
        const repoManagerParams = getRepoManagerParamsFromRequest(request);
        const resultP = getRepoManagerFromWriteAPI(repoManagerFactory, repoManagerParams, repoPerDocEnabled)
            .then(async (repoManager) => repoManager.createTree(request.body as ICreateTreeParams))
            .catch((error) => logAndThrowApiError(error, request, repoManagerParams));

        handleResponse(resultP, response, undefined, undefined, 201);
    });

    router.get("/repos/:owner/:repo/git/trees/:sha", async (request, response, next) => {
        const repoManagerParams = getRepoManagerParamsFromRequest(request);
        const resultP = repoManagerFactory.open(repoManagerParams)
            .then(async (repoManager) => repoManager.getTree(request.params.sha, request.query.recursive === "1"))
            .catch((error) => logAndThrowApiError(error, request, repoManagerParams));

        handleResponse(resultP, response);
    });

    return router;
}
