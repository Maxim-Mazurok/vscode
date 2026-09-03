// Resolve hook: redirect specific imports to our mocks
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockDir = join(__dirname, 'mocks');

const mockFiles = {
  'vscode': join(mockDir, 'vscode.mjs'),
  '@octokit/rest': join(mockDir, 'octokit.mjs'),
  'auth': join(mockDir, 'auth.mjs'),
  'util': join(mockDir, 'util.mjs'),
  'links': join(mockDir, 'links.mjs'),
  'git-base': join(mockDir, 'git-base.mjs'),
};

export async function resolve(specifier, context, nextResolve) {
  // Direct package mocks
  if (mockFiles[specifier]) {
    return {
      url: pathToFileURL(mockFiles[specifier]).href,
      shortCircuit: true,
      format: 'module',
    };
  }

  // Relative imports: extract basename and check against mock map
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const base = new URL(specifier, context.parentURL || import.meta.url);
    const pathname = fileURLToPath(base);
    const basename = dirname(pathname).split(/[\\/]/).pop();
    const filename = pathname.split(/[\\/]/).pop()?.replace(/\.js$/, '').replace(/\.ts$/, '');

    if (filename && mockFiles[filename]) {
      return {
        url: pathToFileURL(mockFiles[filename]).href,
        shortCircuit: true,
        format: 'module',
      };
    }
  }

  return nextResolve(specifier, context);
}
