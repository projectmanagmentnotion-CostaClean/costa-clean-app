import { existsSync } from 'node:fs'
import path from 'node:path'

export function resolveLocalToolInvocation(command, args, {
  platform = process.platform,
  execPath = process.execPath,
  npmExecPath = process.env.npm_execpath,
} = {}) {
  if (command === 'npm' || command === 'npx') {
    const adjacentNpmCli = path.join(path.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    const npmCli = npmExecPath || (existsSync(adjacentNpmCli) ? adjacentNpmCli : null)
    if ((platform === 'win32' || npmExecPath) && npmCli) {
      const npmArgs = command === 'npx' ? ['exec', '--', ...args] : args
      return { command: execPath, args: [npmCli, ...npmArgs] }
    }
  }
  return { command, args }
}
