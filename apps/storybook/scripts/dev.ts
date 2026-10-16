import { spawn } from 'node:child_process';
import { ports } from '../../../config/ports.ts';

// Storybook takes its port from the CLI only; read it from the shared env contract.
const child = spawn('storybook', ['dev', '-p', String(ports.storybook), '--no-open'], {
  stdio: 'inherit',
});
// stop Storybook together with this wrapper
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
