// Mock for './auth.js' — provides a controllable getOctokit()
import { MockOctokit } from './octokit.mjs';

let _mockOctokit = null;

export function setMockOctokit(octokit) {
  _mockOctokit = octokit;
}

export async function getOctokit() {
  if (!_mockOctokit) {
    throw new Error('Mock Octokit not set. Call setMockOctokit() first.');
  }
  return _mockOctokit;
}
