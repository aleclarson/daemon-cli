import fs from 'fs-extra';
import { getWrapperPath } from './paths.js';

export async function generateWrapper(name: string, command: string) {
  const wrapperContent = `#!/bin/bash
# Source user profile to load PATH (nvm, pyenv, etc)
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc"
[ -f "$HOME/.bash_profile" ] && source "$HOME/.bash_profile"

# Execute the command
exec ${command}
`;

  const wrapperPath = getWrapperPath(name);
  await fs.outputFile(wrapperPath, wrapperContent);
  await fs.chmod(wrapperPath, '755');
  return wrapperPath;
}
