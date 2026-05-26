import dotenv from "dotenv";

dotenv.config();

const BITBUCKET_URL = process.env.BITBUCKET_URL;
const PROJECT = process.env.BITBUCKET_PROJECT;
const BITBUCKET_USER = process.env.BITBUCKET_USERNAME;
const BITBUCKET_PASSWORD = process.env.BITBUCKET_PASSWORD;

const authHeader =
  "Basic " +
  Buffer.from(
    `${BITBUCKET_USER}:${BITBUCKET_PASSWORD}`
  ).toString("base64");


// ---------------- CREATE REPO ----------------

const createRepo = async (repoName) => {
  try {
    const url = `${BITBUCKET_URL}/rest/api/1.0/projects/${PROJECT}/repos`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader
      },
      body: JSON.stringify({
        name: repoName,
        scmId: "git",
        forkable: true
      })
    });
    const data = await response.json();
    return {
      code: response.status,
      message: "Repository created successfully",
      data
    };
  } catch (error) {
    return {
      code: 400,
      message: "Repository creation failed",
      error: error.message
    };
  }
};

// ---------------- ADD BRANCH PERMISSION ----------------
const addBranchPermission = async (payload) => {
  try {
    const { repoSlug, users, permissionType } = payload;
    console.log({ repoSlug, users, permissionType })
    const url =
      `${BITBUCKET_URL}/rest/branch-permissions/2.0/projects/${PROJECT}/repos/${repoSlug}/restrictions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader
      },
      body: JSON.stringify({
        type: permissionType,
        matcher: {
          id: "refs/heads/main",
          type: {
            id: "BRANCH",
            name: "Branch"
          }
        },
        users: users
      })
    });

    const data = await response.json();

    return {
      code: response.status,
      message: "Branch permission added successfully",
      data
    };

  } catch (error) {

    return {
      code: 400,
      message: "Failed to add branch permission",
      error: error.message
    };

  }

};

const getRepos = async () => {
  try {
    const url = `${BITBUCKET_URL}/rest/api/1.0/projects/${PROJECT}/repos`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader,
      },
    });

    const data = await response.json();

    return {
      code: response.status,
      message: "Repositories fetched successfully",
      data,
    };
  } catch (error) {
    return {
      code: 400,
      message: "Failed to fetch repositories",
      error: error.message,
    };
  }
};


const deleteRepo = async (payload) => {
  try {
    const { repoName } = payload || {}
    const url = `${BITBUCKET_URL}/rest/api/1.0/projects/${PROJECT}/repos/${repoName}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return {
      code: response.status,
      message: "Repository deleted successfully",
    };
  } catch (error) {
    return {
      code: 400,
      message: "Repository deletion failed",
      error: error.message,
    };
  }
};


export const bitbucketServices = {
  createRepo,
  addBranchPermission,
  getRepos,
  deleteRepo
};