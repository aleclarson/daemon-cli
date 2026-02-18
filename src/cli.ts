import {
  command,
  run,
  string,
  positional,
  option,
  flag,
  boolean,
  subcommands,
  optional,
  oneOf,
  number
} from 'cmd-ts';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { removeCommand } from './commands/remove.js';
import { log } from './utils/ui.js';
import { which } from './utils/process.js';

if (process.platform !== 'darwin') {
  log.error('This tool only supports macOS.');
  process.exit(1);
}

const logrotatePath = await which('logrotate');
if (!logrotatePath) {
  log.error('logrotate is not installed. Please install it via "brew install logrotate".');
  process.exit(1);
}

const create = command({
  name: 'create',
  description: 'Create and start a new daemon',
  args: {
    name: positional({ type: optional(string), displayName: 'name' }),
    command: positional({ type: optional(string), displayName: 'command' }),
    rotation: option({
      type: optional(oneOf(['daily', 'weekly', 'hourly'] as const)),
      long: 'rotation',
      description: 'Log rotation interval (daily, weekly, hourly)'
    }),
    keep: option({
      type: optional(number),
      long: 'keep',
      description: 'Number of log files to keep'
    }),
    compress: flag({
      type: boolean,
      long: 'compress',
      defaultValue: () => true,
      description: 'Compress rotated logs'
    }),
    noKeepAlive: flag({
      type: boolean,
      long: 'no-keep-alive',
      defaultValue: () => false,
      description: 'Disable KeepAlive'
    })
  },
  handler: async (args) => {
    await createCommand({
      name: args.name,
      command: args.command,
      rotation: args.rotation,
      keep: args.keep,
      compress: args.compress,
      keepAlive: !args.noKeepAlive
    });
  }
});

const list = command({
  name: 'list',
  description: 'List all managed daemons',
  args: {},
  handler: async () => {
    await listCommand();
  }
});

const rm = command({
  name: 'rm',
  description: 'Remove a managed daemon',
  args: {
    name: positional({ type: string, displayName: 'name' })
  },
  handler: async ({ name }) => {
    await removeCommand(name);
  }
});

const app = subcommands({
  name: 'daemon',
  cmds: { create, list, rm }
});

run(app, process.argv.slice(2)).catch((err) => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
