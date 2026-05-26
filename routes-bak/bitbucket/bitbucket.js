import Joi from "joi";
import { bitbucketServices } from "../../services-bak/bitbucket/bitbucket.js";

export const createBitbucketRepo = {
    path: '/api/v1/bitbucket/repo',
    method: 'POST',
    config: {
        description: 'Create Bitbucket Repository',
        tags: ['api', 'Bitbucket'],
        auth: 'jwt',
    },
    handler: async (request, h) => {
        try {
            const response = await bitbucketServices.createRepo(request.payload.repoName);
            return h.response(response).code(response?.code || 200);

        } catch (error) {
            return h.response(error).code(error?.code || 400);
        }
    },
};

export const addBranchPermission = {
    path: '/api/v1/bitbucket/branch-permission',
    method: 'POST',
    config: {
        description: 'Add Bitbucket Branch Permission',
        tags: ['api', 'Bitbucket'],
        auth: 'jwt',
    },
    handler: async (request, h) => {
        try {
            const opts = {
                users: request.payload.users,
                repoSlug: request.payload.repoSlug,
                permissionType: request.payload.permissionType
            }
            const response = await bitbucketServices.addBranchPermission(opts);

            return h.response(response).code(response?.code || 200);

        } catch (error) {
            return h.response(error).code(error?.code || 400);
        }
    },
};

export const getAllRepos = {
    path: '/api/v1/bitbucket/repos',
    method: 'GET',
    config: {
        description: 'GET All Branhes',
        tags: ['api', 'Bitbucket'],
        auth: 'jwt',
    },
    handler: async (request, h) => {
        try {
            const response = await bitbucketServices.getRepos();

            return h.response(response).code(response?.code || 200);

        } catch (error) {
            return h.response(error).code(error?.code || 400);
        }
    },
};

export const deleteRepo = {
    path: '/api/v1/bitbucket/repos/{repoName}',
    method: 'DELETE',
    config: {
        description: 'Delete Repos',
        tags: ['api', 'Bitbucket'],
        auth: 'jwt',
    },
    handler: async (request, h) => {
        try {
            const opts = {
               repoName: request.params.repoName || "",
            }
            console.log({ opts })
            const response = await bitbucketServices.deleteRepo(opts);
            return h.response(response).code(response?.code || 200);
        } catch (error) {
            return h.response(error).code(error?.code || 400);
        }
    },
};