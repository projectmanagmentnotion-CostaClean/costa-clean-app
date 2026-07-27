import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { spawnSyncCompatV3 } from './cp2b_command_launcher_v3.mjs'

const nativeSpawnSync = childProcess.spawnSync

childProcess.spawnSync = function cp2bSpawnSyncV3(executable, args, options) {
  return spawnSyncCompatV3(executable, args, options, {
    platform: process.platform,
    spawnSync: nativeSpawnSync,
  })
}

syncBuiltinESMExports()
