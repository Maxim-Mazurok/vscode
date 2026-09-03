// Mock for the 'vscode' module
export const Uri = {
  parse: (s) => ({ toString: () => s, path: s, fsPath: s }),
  file: (s) => ({ toString: () => `file://${s}`, path: s, fsPath: s }),
};
export const env = { openExternal: async () => {} };
export const l10n = { t: (s) => s };
export const workspace = {
  getConfiguration: () => ({ get: () => 'https' }),
  workspaceFolders: [Uri.file('/test')],
};
export const EventEmitter = class { fire() {} event = () => ({ dispose() {} }) };
export const Disposable = class { dispose() {} };
export const commands = { executeCommand: async () => {} };
export const window = { showErrorMessage: () => {}, showInformationMessage: () => {} };
export const authentication = { getSession: async () => ({}), registerAuthenticationProvider: () => ({ dispose() {} }) };
export const ProgressLocation = { SourceControl: 1 };
export class AuthenticationSession {}
export const extensions = { getExtension: () => undefined };
