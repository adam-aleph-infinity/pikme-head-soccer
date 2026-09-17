// Regression checks for the two false-green failures in the original handoff pipeline.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { deployUrl, verifyDeployment } from './scripts/deploy.mjs';

const wanted = 'a'.repeat(40);
const old = 'b'.repeat(40);
assert.throws(() => deployUrl('', wanted), /missing/);
assert.throws(() => deployUrl('https://api.render.com/deploy/srv-another-game?key=test', wanted), /Head Football/);
assert.throws(() => deployUrl('https://example.com/deploy/srv-da62j13bc2fs73anuptg?key=test', wanted), /Head Football/);
const hook = deployUrl('https://api.render.com/deploy/srv-da62j13bc2fs73anuptg?key=test', wanted);
assert.equal(hook.searchParams.get('ref'), wanted);

let current = old;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ commit: current }));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
try {
  await assert.rejects(verifyDeployment(wanted, { base, attempts: 1, delayMs: 0 }), /older build/);
  current = wanted;
  await verifyDeployment(wanted, { base, attempts: 1, delayMs: 0 });
} finally {
  server.close();
  server.closeAllConnections();
}
console.log('deploy: 6 checks passed');
