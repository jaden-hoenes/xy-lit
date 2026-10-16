import { Server } from '@hocuspocus/server';
import type { afterUnloadDocumentPayload, onAuthenticatePayload } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { SQLite } from '@hocuspocus/extension-sqlite';
import { ports } from '../../../config/ports.ts';
import { answerRootCheck } from '../../../config/root-check.ts';
import { createRepairHook } from './repair-hook.ts';

/** Token format: `user:<id>` or `user:<id>:ro` (read-only). See spec/01 §Apps → collab-server. */
export function parseToken(token: string): { id: string; readOnly: boolean } | undefined {
  const match = /^user:([^:]+)(:ro)?$/.exec(token);
  if (!match) return undefined;
  return { id: match[1] as string, readOnly: match[2] === ':ro' };
}

/**
 * The collaboration server: Hocuspocus with SQLite persistence (`DB`, default in memory), token
 * authentication and a debounced document validator.
 *
 * @param port - Port to listen on (default `COLLAB_PORT` / 1234).
 */
export function createServer(port: number = ports.collab): Server {
  const repair = createRepairHook({
    delayMs: Number(process.env.HEAL_DEBOUNCE_MS ?? 2000),
    onHealed: (documentName, fixed) =>
      console.log(`[collab] repaired ${documentName}: ${fixed.map((i) => i.kind).join(', ')}`),
  });
  return new Server({
    port,
    name: 'xy-lit-collab',
    extensions: [new Logger(), new SQLite({ database: process.env.DB ?? ':memory:' })],
    onAuthenticate(data: onAuthenticatePayload) {
      const user = parseToken(data.token);
      if (!user) return Promise.reject(new Error('unauthorized'));
      data.connectionConfig.readOnly = user.readOnly;
      return Promise.resolve({ user: { id: user.id } });
    },
    // `GET /__xy-root.json`: lets Playwright tell this checkout's server from another one's (config/root-check.ts)
    onRequest: ({ request, response }) => {
      const answer = answerRootCheck(request.url);
      if (!answer) return Promise.resolve();
      response.writeHead(answer.status, { 'content-type': 'application/json' }).end(answer.body);
      // the hook protocol: rejecting without a reason stops Hocuspocus from writing its own reply
      return Promise.reject();
    },
    onChange: (data) => repair.onChange(data),
    afterUnloadDocument: (data: afterUnloadDocumentPayload) => {
      repair.forget(data.documentName);
      return Promise.resolve();
    },
    onDestroy: () => {
      repair.destroy();
      return Promise.resolve();
    },
  });
}

await createServer().listen();
