import fs from 'fs-extra';
import { getConfigPath, STATE_FILE, LOGROTATE_DIR, getLogPath } from './paths.js';
import { execa } from 'execa';
import { which } from '../utils/process.js';

export interface LogrotateOptions {
  rotation: 'daily' | 'weekly' | 'hourly';
  keep: number;
  compress: boolean;
}

export async function generateLogrotateConfig(name: string, options: LogrotateOptions) {
  const logPath = getLogPath(name);
  const configContent = `"${logPath}" {
  ${options.rotation}
  rotate ${options.keep}
  ${options.compress ? 'compress' : ''}
  missingok
  notifempty
  copytruncate
}
`;

  const configPath = getConfigPath(name);
  await fs.outputFile(configPath, configContent);
  return configPath;
}

const CRON_MARKER = '# daemon-cli-logrotate';

export async function setupCron() {
  const logrotatePath = (await which('logrotate')) || '/usr/local/bin/logrotate';
  const cronLine = `@daily ${logrotatePath} -s ${STATE_FILE} ${LOGROTATE_DIR}*.conf ${CRON_MARKER}`;

  try {
    const { stdout: crontab } = await execa('crontab', ['-l']);
    if (crontab.includes(CRON_MARKER)) return;

    const newCrontab = crontab ? `${crontab}\n${cronLine}` : cronLine;
    await execa('crontab', ['-'], { input: newCrontab });
  } catch (error) {
    // If no crontab exists, create it
    await execa('crontab', ['-'], { input: cronLine });
  }
}

export async function cleanupCron() {
  try {
    const files = await fs.readdir(LOGROTATE_DIR);
    if (files.length > 0) return;

    const { stdout: crontab } = await execa('crontab', ['-l']);
    if (!crontab.includes(CRON_MARKER)) return;

    const newCrontab = crontab
      .split('\n')
      .filter((line) => !line.includes(CRON_MARKER))
      .join('\n');

    if (newCrontab.trim() === '') {
      await execa('crontab', ['-r']).catch(() => {});
    } else {
      await execa('crontab', ['-'], { input: newCrontab });
    }
  } catch (error) {
    // Ignore errors
  }
}
