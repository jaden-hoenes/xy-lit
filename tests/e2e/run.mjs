// `pnpm e2e -- conformance/nodes.spec.ts` forwards a literal `--`, which Playwright treats as
// "everything after is not a file filter". Drop it so `pnpm e2e -- <file>` narrows the run.
import { spawn } from 'node:child_process';

const args = process.argv.slice(2).filter((a) => a !== '--');
const child = spawn('playwright', ['test', ...args], { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
