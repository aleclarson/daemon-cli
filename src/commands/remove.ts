import fs from 'fs-extra';
import path from 'path';
import { stopService } from '../lib/launchd.js';
import { getPlistPath, getWrapperPath, getConfigPath, getLogPath, LOGS_DIR } from '../lib/paths.js';
import { confirm, log, spinner } from '../utils/ui.js';
import { cleanupCron } from '../lib/logrotate.js';

export async function removeCommand(name: string) {
  spinner.start(`Stopping service '${name}'...`);
  await stopService(name);
  spinner.stop(`Service '${name}' stopped.`);

  spinner.start('Cleaning up files...');
  await fs.remove(getPlistPath(name));
  await fs.remove(getWrapperPath(name));
  await fs.remove(getConfigPath(name));
  await cleanupCron();
  spinner.stop('Files cleaned up.');

  const deleteLogs = await confirm(`Delete logs for '${name}'?`);
  if (deleteLogs) {
    spinner.start('Deleting logs...');
    const logPath = getLogPath(name);
    await fs.remove(logPath);
    // Remove rotated logs
    const logFiles = await fs.readdir(LOGS_DIR);
    for (const file of logFiles) {
      if (file.startsWith(`${name}.log.`)) {
        await fs.remove(path.join(LOGS_DIR, file));
      }
    }
    spinner.stop('Logs deleted.');
  }

  log.success(`Daemon '${name}' removed.`);
}
