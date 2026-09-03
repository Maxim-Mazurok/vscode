// Mock for './util.js'
export function getRepositoryFromQuery(query) {
  // Match "owner/repo" pattern
  const match = query.match(/^(\S+)\/(\S+)$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return undefined;
}

export function getRepositoryFromUrl(query) {
  // Match git URLs like git@github.com:owner/repo.git or https://github.com/owner/repo
  const sshMatch = query.match(/^git@github\.com:(\S+)\/(\S+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  const httpsMatch = query.match(/^https?:\/\/github\.com\/(\S+)\/(\S+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  return undefined;
}

export class DisposableStore {
  constructor() { this._disposables = []; }
  add(d) { this._disposables.push(d); }
  dispose() { this._disposables.forEach(d => d.dispose()); }
}

export function sequentialize(fn) { return fn; }
