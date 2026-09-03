/**
 * Standalone tests for GithubRemoteSourceProvider
 *
 * Run with:
 *   node --import ./register.mjs remoteSourceProvider.test.mjs
 *
 * These tests import the ACTUAL source file (remoteSourceProvider.ts) with
 * mocked vscode / octokit / auth / util / links dependencies, and verify
 * that user repos are prioritized over public search results.
 */

import assert from 'node:assert/strict';
import { setMockOctokit } from './mocks/auth.mjs';
import { createMockOctokit } from './mocks/octokit.mjs';
import { GithubRemoteSourceProvider } from '../src/remoteSourceProvider.ts';

// ─── Test data helpers ───────────────────────────────────────────────

function makeRepo(fullName, { stars = 0, description = null } = {}) {
  return {
    full_name: fullName,
    description,
    stargazers_count: stars,
    clone_url: `https://github.com/${fullName}.git`,
    ssh_url: `git@github.com:${fullName}.git`,
  };
}

function makeProvider({ userRepos = [], searchResults = [] }) {
  const octokit = createMockOctokit({ userRepos, searchResults });
  setMockOctokit(octokit);
  return new GithubRemoteSourceProvider();
}

function names(results) {
  return results.map(r => r.name.replace('$(github) ', ''));
}

// ─── Test runner ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\nGithubRemoteSourceProvider — Clone Search Prioritization Tests\n');

// ── 1. Core bug: user repo should appear when typing partial name ──
console.log('Core bug reproduction:');

await test('typing "life" should surface Maxim-Mazurok/life (user repo)', async () => {
  const provider = makeProvider({
    userRepos: [
      makeRepo('Maxim-Mazurok/life', { description: 'my personal repo' }),
      makeRepo('Maxim-Mazurok/other-project'),
    ],
    searchResults: [
      makeRepo('someone/lifecycle-manager', { stars: 500 }),
      makeRepo('another/lifehack', { stars: 200 }),
      makeRepo('public/life-tools', { stars: 100 }),
    ],
  });

  const results = await provider.getRemoteSources('life');
  const repoNames = names(results);

  assert.ok(
    repoNames.includes('Maxim-Mazurok/life'),
    `Expected Maxim-Mazurok/life in results, got: ${repoNames.join(', ')}`
  );
});

await test('user repo should appear BEFORE public repos in results', async () => {
  const provider = makeProvider({
    userRepos: [
      makeRepo('Maxim-Mazurok/life', { description: 'my personal repo' }),
    ],
    searchResults: [
      makeRepo('someone/lifecycle-manager', { stars: 500 }),
      makeRepo('another/lifehack', { stars: 200 }),
      makeRepo('public/life-tools', { stars: 100 }),
    ],
  });

  const results = await provider.getRemoteSources('life');
  const repoNames = names(results);
  const userIndex = repoNames.indexOf('Maxim-Mazurok/life');
  const firstPublicIndex = repoNames.findIndex(n => n !== 'Maxim-Mazurok/life');

  assert.ok(userIndex !== -1, `User repo not found in: ${repoNames.join(', ')}`);
  assert.ok(
    userIndex < firstPublicIndex,
    `User repo at index ${userIndex} should be before first public repo at index ${firstPublicIndex}. Order: ${repoNames.join(', ')}`
  );
});

// ── 2. Full owner/repo query still works ──
console.log('\nFull owner/repo queries:');

await test('typing "Maxim-Mazurok/life" returns the exact repo', async () => {
  const provider = makeProvider({
    userRepos: [makeRepo('Maxim-Mazurok/life')],
    searchResults: [makeRepo('Maxim-Mazurok/life', { stars: 42 })],
  });

  const results = await provider.getRemoteSources('Maxim-Mazurok/life');
  assert.ok(names(results).includes('Maxim-Mazurok/life'));
});

// ── 3. No query → user repos returned ──
console.log('\nNo query (initial load):');

await test('empty query returns user repos', async () => {
  const provider = makeProvider({
    userRepos: [
      makeRepo('Maxim-Mazurok/life'),
      makeRepo('Maxim-Mazurok/work'),
    ],
    searchResults: [],
  });

  const results = await provider.getRemoteSources();
  const repoNames = names(results);
  assert.ok(repoNames.includes('Maxim-Mazurok/life'));
  assert.ok(repoNames.includes('Maxim-Mazurok/work'));
});

// ── 4. First keystroke (cache was empty) ──
console.log('\nFirst keystroke (lazy cache):');

await test('first query with empty cache still fetches and returns user repos', async () => {
  // This is the key bug: previously the cache was only populated on empty query.
  // If the user types immediately, the cache was empty → no user repos.
  const provider = makeProvider({
    userRepos: [makeRepo('Maxim-Mazurok/life')],
    searchResults: [makeRepo('public/life-something', { stars: 10 })],
  });

  // First call is directly with a query (no prior empty-query call)
  const results = await provider.getRemoteSources('life');
  assert.ok(
    names(results).includes('Maxim-Mazurok/life'),
    `User repo missing on first keystroke. Got: ${names(results).join(', ')}`
  );
});

// ── 5. Dedup: user repo wins over public duplicate ──
console.log('\nDeduplication:');

await test('duplicate repo appears only once, user version wins', async () => {
  const provider = makeProvider({
    userRepos: [makeRepo('Maxim-Mazurok/life', { description: 'MY private repo' })],
    searchResults: [makeRepo('Maxim-Mazurok/life', { stars: 999, description: 'public listing' })],
  });

  const results = await provider.getRemoteSources('life');
  const matches = results.filter(r => r.name.includes('Maxim-Mazurok/life'));
  assert.equal(matches.length, 1, `Expected 1 match, got ${matches.length}`);
  // User version should have the user's description
  assert.ok(
    matches[0].detail === 'MY private repo',
    `Expected user version (detail="MY private repo"), got detail="${matches[0].detail}"`
  );
});

// ── 6. Codicon prefix doesn't interfere with filtering ──
console.log('\nCodicon filtering:');

await test('query "git" should NOT match all repos via $(github) codicon', async () => {
  const provider = makeProvider({
    userRepos: [
      makeRepo('Maxim-Mazurok/life'),
      makeRepo('Maxim-Mazurok/work'),
      makeRepo('Maxim-Mazurok/git-tools'),
    ],
    searchResults: [],
  });

  const results = await provider.getRemoteSources('git');
  const repoNames = names(results);

  // Only "git-tools" should match, not "life" or "work"
  assert.ok(repoNames.includes('Maxim-Mazurok/git-tools'), `git-tools should match, got: ${repoNames.join(', ')}`);
  assert.ok(!repoNames.includes('Maxim-Mazurok/life'), `life should NOT match "git", but it did`);
  assert.ok(!repoNames.includes('Maxim-Mazurok/work'), `work should NOT match "git", but it did`);
});

// ── 7. Multi-word query ──
console.log('\nMulti-word queries:');

await test('multi-word query "maxim life" matches', async () => {
  const provider = makeProvider({
    userRepos: [makeRepo('Maxim-Mazurok/life')],
    searchResults: [],
  });

  const results = await provider.getRemoteSources('maxim life');
  assert.ok(names(results).includes('Maxim-Mazurok/life'));
});

// ── 8. Whitespace-only query ──
console.log('\nEdge cases:');

await test('whitespace-only query returns all user repos (treated as no query)', async () => {
  const provider = makeProvider({
    userRepos: [makeRepo('Maxim-Mazurok/life'), makeRepo('Maxim-Mazurok/work')],
    searchResults: [],
  });

  const results = await provider.getRemoteSources('   ');
  const repoNames = names(results);
  assert.ok(repoNames.includes('Maxim-Mazurok/life'));
  assert.ok(repoNames.includes('Maxim-Mazurok/work'));
});

// ── 9. API error → graceful fallback ──
console.log('\nError handling:');

await test('API error on user repos → still returns search results', async () => {
  // Create a mock that throws on listForAuthenticatedUser
  const octokit = {
    repos: {
      listForAuthenticatedUser: async () => { throw new Error('API error'); },
      get: async () => ({ data: makeRepo('test/test') }),
      listBranches: async () => ({ data: [] }),
    },
    search: {
      repos: async () => ({ data: { items: [makeRepo('public/life-app', { stars: 50 })] } }),
    },
    users: { getAuthenticated: async () => ({ data: { login: 'test' } }) },
  };
  setMockOctokit(octokit);

  const provider = new GithubRemoteSourceProvider();
  const results = await provider.getRemoteSources('life');

  // Should still return the public search result
  assert.ok(names(results).includes('public/life-app'), `Public results should still appear. Got: ${names(results).join(', ')}`);
});

// ── 10. Case-insensitive matching ──
console.log('\nCase sensitivity:');

await test('query is case-insensitive', async () => {
  const provider = makeProvider({
    userRepos: [makeRepo('Maxim-Mazurok/MyLife')],
    searchResults: [],
  });

  const results = await provider.getRemoteSources('mylife');
  assert.ok(names(results).includes('Maxim-Mazurok/MyLife'));
});

// ── 11. Org repos (affiliation param) ──
console.log('\nOrg repo support:');

await test('listForAuthenticatedUser is called with affiliation param', async () => {
  const { createMockOctokit: cmd } = await import('./mocks/octokit.mjs');
  const octokit = cmd({
    userRepos: [makeRepo('my-org/team-project')],
    searchResults: [],
  });
  setMockOctokit(octokit);

  const provider = new GithubRemoteSourceProvider();
  await provider.getRemoteSources('team');

  const call = cmd.lastListForAuthenticatedUserCall;
  assert.ok(call, 'listForAuthenticatedUser should have been called');
  assert.equal(
    call.affiliation,
    'owner,collaborator,organization_member',
    `Expected affiliation param, got: ${JSON.stringify(call)}`
  );
});

// ── Summary ──
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
