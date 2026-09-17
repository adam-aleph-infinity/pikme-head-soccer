import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import WebSocket from 'ws';

export const PRODUCTION = 'https://pikme-headsoccer.onrender.com';
const SERVICE = 'srv-da62j13bc2fs73anuptg';

function checkCommit(commit) {
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Expected a full Git commit SHA.');
}

export function deployUrl(hook, commit) {
  checkCommit(commit);
  if (!hook) throw new Error('RENDER_DEPLOY_HOOK is missing. Nothing was deployed. Ask Adam to restore this service-only repository secret.');
  let url;
  try { url = new URL(hook); } catch { throw new Error('Invalid deploy hook URL.'); }
  if (url.origin !== 'https://api.render.com' || url.pathname !== `/deploy/${SERVICE}`
      || url.username || url.password || !url.searchParams.get('key')) {
    throw new Error('The deploy hook must belong to the Head Football service.');
  }
  url.searchParams.set('ref', commit);
  return url;
}

export async function verifyDeployment(commit, { base = PRODUCTION, attempts = 40, delayMs = 15000 } = {}) {
  checkCommit(commit);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`${base}/version`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const version = response.ok ? await response.json() : null;
      if (version?.commit === commit) {
        const page = await fetch(`${base}/`, { signal: AbortSignal.timeout(10000) });
        if (page.ok) {
          console.log(`Verified production commit ${commit}`);
          return;
        }
      }
    } catch { /* A build starting up can briefly return an error or HTML instead of JSON. */ }
    console.log(`Waiting for commit ${commit.slice(0, 7)} (${attempt}/${attempts})`);
    if (attempt < attempts) await sleep(delayMs);
  }
  throw new Error(`Production did not serve commit ${commit}. An HTTP 200 from an older build is not a successful deploy.`);
}

export function verifyWebSocket(base = PRODUCTION) {
  return new Promise((resolve, reject) => {
    const url = new URL('/ws', base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url, { handshakeTimeout: 10000 });
    let finished = false;
    const timer = setTimeout(() => finish(new Error('The game WebSocket did not send its welcome message.')), 15000);
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ws.close();
      if (error) reject(error); else resolve();
    }
    ws.once('error', () => finish(new Error('The game WebSocket connection failed.')));
    ws.on('message', (data) => {
      try { if (JSON.parse(data).type === 'welcome') finish(); } catch { /* wait for welcome */ }
    });
  });
}

async function main() {
  const commit = process.argv[2];
  const hook = deployUrl(process.env.RENDER_DEPLOY_HOOK, commit);
  let response;
  try {
    response = await fetch(hook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000) });
  } catch { throw new Error('Could not reach the Head Football deploy hook.'); }
  // Do not print the secret URL or a response that could echo it.
  if (!response.ok) throw new Error(`Render rejected the deploy (HTTP ${response.status}). Check repository access and the deploy hook.`);
  console.log(`Render accepted Head Football commit ${commit}. Waiting for the live build.`);
  await verifyDeployment(commit);
  await verifyWebSocket();
  console.log('Production page, version, and game WebSocket verified.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
