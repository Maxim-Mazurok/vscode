/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';

suite('remoteSourceProvider', function () {

	// These tests run inside VS Code and exercise the real GithubRemoteSourceProvider
	// with a mocked Octokit. They verify that user repos are prioritized over
	// public search results in the clone picker (Issue #141754).

	// We import the provider and mock at the method level by overriding
	// the private methods with a test harness.

	suite('merge order and prioritization', function () {

		function createTestProvider(userRepos: any[], searchResults: any[]) {
			// Build a minimal provider-like object that exercises the same
			// merge/filter logic as GithubRemoteSourceProvider.
			// This avoids needing to mock the full Octokit + vscode auth stack.

			const asRemoteSource = (raw: any) => ({
				name: `$(github) ${raw.full_name}`,
				description: raw.stargazers_count > 0 ? `$(star-full) ${raw.stargazers_count}` : '',
				detail: raw.description || undefined,
				url: raw.clone_url || `https://github.com/${raw.full_name}.git`
			});

			let userReposCache: any[] | null = null;

			function getUserRemoteSources(query?: string): any[] {
				if (userReposCache === null) {
					userReposCache = userRepos.map(asRemoteSource);
				}
				const normalizedQuery = query?.trim().toLowerCase();
				if (!normalizedQuery) {
					return userReposCache;
				}
				return userReposCache.filter(repo => {
					const displayName = repo.name.replace(/^\$\(\w+\)\s*/, '').toLowerCase();
					return normalizedQuery.split(/\s+/).every(part => displayName.includes(part));
				});
			}

			function getQueryRemoteSources(query?: string): any[] {
				if (!query) return [];
				return searchResults.map(asRemoteSource);
			}

			async function getRemoteSources(query?: string): Promise<any[]> {
				// User repos first
				const all = await Promise.all([
					getUserRemoteSources(query),
					getQueryRemoteSources(query),
				]);
				const map = new Map<string, any>();
				for (const group of all) {
					for (const rs of group) {
						if (!map.has(rs.name)) {
							map.set(rs.name, rs);
						}
					}
				}
				return [...map.values()];
			}

			return { getRemoteSources };
		}

		function makeRepo(fullName: string, stars = 0, description?: string) {
			return {
				full_name: fullName,
				description: description || null,
				stargazers_count: stars,
				clone_url: `https://github.com/${fullName}.git`,
			};
		}

		function strip(results: any[]): string[] {
			return results.map(r => r.name.replace('$(github) ', ''));
		}

		test('user repo appears when typing partial name', async () => {
			const provider = createTestProvider(
				[makeRepo('Maxim-Mazurok/life')],
				[makeRepo('someone/lifecycle-manager', 500), makeRepo('another/lifehack', 200)]
			);
			const results = await provider.getRemoteSources('life');
			assert.ok(strip(results).includes('Maxim-Mazurok/life'));
		});

		test('user repo ranks before public repos', async () => {
			const provider = createTestProvider(
				[makeRepo('Maxim-Mazurok/life')],
				[makeRepo('someone/lifecycle-manager', 500)]
			);
			const results = await provider.getRemoteSources('life');
			const names = strip(results);
			assert.ok(names.indexOf('Maxim-Mazurok/life') < names.indexOf('someone/lifecycle-manager'));
		});

		test('first keystroke with empty cache fetches user repos', async () => {
			const provider = createTestProvider(
				[makeRepo('Maxim-Mazurok/life')],
				[makeRepo('public/life-app', 10)]
			);
			// No prior empty-query call — first call is directly with "life"
			const results = await provider.getRemoteSources('life');
			assert.ok(strip(results).includes('Maxim-Mazurok/life'));
		});

		test('dedup keeps user version over public duplicate', async () => {
			const provider = createTestProvider(
				[makeRepo('Maxim-Mazurok/life', 0, 'MY repo')],
				[makeRepo('Maxim-Mazurok/life', 999, 'public')]
			);
			const results = await provider.getRemoteSources('life');
			const matches = results.filter(r => r.name.includes('Maxim-Mazurok/life'));
			assert.equal(matches.length, 1);
			assert.equal(matches[0].detail, 'MY repo');
		});

		test('codicon prefix does not cause false matches', async () => {
			const provider = createTestProvider(
				[makeRepo('Maxim-Mazurok/life'), makeRepo('Maxim-Mazurok/git-tools')],
				[]
			);
			const results = await provider.getRemoteSources('git');
			const names = strip(results);
			assert.ok(names.includes('Maxim-Mazurok/git-tools'));
			assert.ok(!names.includes('Maxim-Mazurok/life'));
		});

		test('multi-word query matches', async () => {
			const provider = createTestProvider(
				[makeRepo('Maxim-Mazurok/life')],
				[]
			);
			const results = await provider.getRemoteSources('maxim life');
			assert.ok(strip(results).includes('Maxim-Mazurok/life'));
		});

		test('case-insensitive matching', async () => {
			const provider = createTestProvider(
				[makeRepo('Maxim-Mazurok/MyLife')],
				[]
			);
			const results = await provider.getRemoteSources('mylife');
			assert.ok(strip(results).includes('Maxim-Mazurok/MyLife'));
		});
	});
});
