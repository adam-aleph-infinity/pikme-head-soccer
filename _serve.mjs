// MAKE SURE THE GAME IS BEING SERVED.
//
// Every screenshot harness navigates a browser at http://127.0.0.1:PORT and none of them used
// to check that anything was listening there. With no server the browser loads an empty page,
// the harness screenshots it, and the failure surfaces as "the heads did not render" — a
// believable game bug that is really a missing `npm start` in another terminal. The first
// person to run `node _shot.mjs` from the docs hit exactly that.
//
// So: `await ensureServer()` at the top of a harness. If something is already listening it is
// left alone and left running — that is the common case, and killing a server someone else is
// using would be worse than not starting one. If nothing is, one is started and stopped again
// when the harness exits.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import net from 'node:net';

const listening = (port) => new Promise((r) => {
  const s = net.connect({ port, host: '127.0.0.1' });
  s.on('connect', () => { s.destroy(); r(true); });
  s.on('error', () => r(false));
  setTimeout(() => { s.destroy(); r(false); }, 800);
});

export async function ensureServer(port = Number(process.env.PORT) || 3020) {
  if (await listening(port)) return { started: false, stop() {} };

  const child = spawn(process.execPath, ['server.js'], {
    cwd: import.meta.dirname,
    stdio: 'ignore',                       // the harness's own output is the interesting one
    env: { ...process.env, PORT: String(port) },
  });
  for (let i = 0; i < 50; i++) { if (await listening(port)) break; await sleep(100); }
  if (!(await listening(port))) {
    child.kill();
    throw new Error(`could not start server.js on :${port} — is something else holding the port?`);
  }

  const stop = () => { try { child.kill(); } catch { /* already gone */ } };
  // A harness that throws half way through should not leave a server behind.
  process.once('exit', stop);
  process.once('SIGINT', () => { stop(); process.exit(130); });
  console.log(`· started a server on :${port} for this run`);
  return { started: true, stop };
}
