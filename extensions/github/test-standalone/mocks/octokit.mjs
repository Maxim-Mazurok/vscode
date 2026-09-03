// Mock for '@octokit/rest'
export class Octokit {
  constructor(opts) { this.opts = opts; }
}

/**
 * Helper to build a mock Octokit with configurable responses.
 */
export function createMockOctokit({ userRepos = [], searchResults = [], repoDetails = null, branches = [] } = {}) {
  return {
    repos: {
      listForAuthenticatedUser: async (params) => {
        createMockOctokit.lastListForAuthenticatedUserCall = params;
        return { data: userRepos };
      },
      get: async (params) => {
        createMockOctokit.lastRepoGetCall = params;
        if (repoDetails) return { data: repoDetails };
        return { data: { full_name: params.owner + '/' + params.repo, default_branch: 'main' } };
      },
      listBranches: async () => ({ data: branches }),
    },
    search: {
      repos: async (params) => {
        createMockOctokit.lastSearchCall = params;
        return { data: { items: searchResults } };
      },
    },
    users: {
      getAuthenticated: async () => ({ data: { login: 'testuser' } }),
    },
  };
}
export { createMockOctokit as MockOctokit };
