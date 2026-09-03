// Mock for './links.js'
export function getBranchLink(url, branch, host) {
  const base = host ? `https://${host}` : url.replace(/\/tree\/.*/, '');
  return `${base}/tree/${branch}`;
}
export function getVscodeDevHost() {
  return 'vscode.dev';
}
