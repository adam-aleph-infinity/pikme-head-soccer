// server/feedback.js: players' bug reports and ideas, passed on to a Google Form. "Sent" only when
// Google took it; nothing personal passed on; off until the form is set up.
import { createFeedback, formBody } from './server/feedback.js';
import { EventEmitter } from 'node:events';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log('FAIL', name); } };

const ENV = { FEEDBACK_FORM_ID: 'FORM', FEEDBACK_ENTRY_KIND: 'entry.1', FEEDBACK_ENTRY_TEXT: 'entry.2', FEEDBACK_ENTRY_VERSION: 'entry.3', RENDER_GIT_COMMIT: 'abcdef1234' };

// a request / response pair as node:http hands them over
function call(fb, method, body, ip = '1.2.3.4') {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    Object.assign(req, { method, headers: { 'x-forwarded-for': ip }, socket: {} });
    const res = { code: 0, writeHead(c) { this.code = c; return this; }, end(s) { resolve({ code: this.code, json: s ? JSON.parse(s) : null }); } };
    const answered = fb.handle(req, res, '/feedback');
    if (!answered) resolve(null);
    if (body !== undefined) req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
    req.emit('end');
  });
}
const google = (status, seen = []) => async (url, opts) => { seen.push({ url, body: String(opts.body) }); if (status === 'throw') throw new Error('net'); return { status }; };

// off until the form is set up
{
  const fb = createFeedback({ env: {}, fetchFn: google(200) });
  ok('no form: off', fb.on === false);
  ok('GET says off', (await call(fb, 'GET')).json.on === false);
  const r = await call(fb, 'POST', { kind: 'bug', text: 'the ball went through the wall' });
  ok('no form: a post is refused, never "sent"', r.code === 503 && r.json.ok === false);
  ok('other paths are not ours', fb.handle({ method: 'GET' }, {}, '/play') === false);
}

// what Google gets
{
  const seen = [];
  const fb = createFeedback({ env: ENV, fetchFn: google(200, seen) });
  ok('form set: on', fb.on && (await call(fb, 'GET')).json.on === true);
  const r = await call(fb, 'POST', { kind: 'idea', text: '  more champions please  ', name: 'Dana', device: 'xyz' });
  ok('Google 200 → ok', r.code === 200 && r.json.ok === true);
  const p = new URLSearchParams(seen[0].body);
  ok('posts to the form\'s formResponse', seen[0].url === 'https://docs.google.com/forms/d/e/FORM/formResponse');
  ok('kind label and trimmed text', p.get('entry.1') === 'הצעה' && p.get('entry.2') === 'more champions please');
  ok('the version rides along', p.get('entry.3') === 'abcdef1');
  ok('nothing else is passed on (no name, no device, no address)', [...p.keys()].sort().join() === 'entry.1,entry.2,entry.3');
}

// bad posts
{
  const fb = createFeedback({ env: ENV, fetchFn: google(200) });
  ok('unknown kind → 400', (await call(fb, 'POST', { kind: 'spam', text: 'hello there' })).code === 400);
  ok('too short → 400', (await call(fb, 'POST', { kind: 'bug', text: '  a ' })).code === 400);
  ok('too long → 400', (await call(fb, 'POST', { kind: 'bug', text: 'x'.repeat(1001) })).code === 400);
  ok('not JSON → 400', (await call(fb, 'POST', 'nope', '9.9.9.9')).code === 400);
  ok('too big → 413', (await call(fb, 'POST', 'x'.repeat(5000), '8.8.8.8')).code === 413);
  ok('a GET body never gets there: formBody alone', formBody({ kind: 'bug', text: 'abc' }, { kind: 'k', text: 't' }, 'v').params.get('k') === 'באג');
}

// Google says no, or never answers: never "sent"
for (const status of [400, 500, 302, 'throw']) {
  const fb = createFeedback({ env: ENV, fetchFn: google(status) });
  const r = await call(fb, 'POST', { kind: 'bug', text: 'the ball got stuck' });
  ok(`Google ${status} → 502, not ok`, r.code === 502 && r.json.ok === false);
}

// five a ten minutes from one address
{
  let t = 0;
  const fb = createFeedback({ env: ENV, fetchFn: google(200), now: () => t });
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await call(fb, 'POST', { kind: 'bug', text: `report ${i}` }, '5.5.5.5')).code);
  ok('the sixth in ten minutes → 429', codes.slice(0, 5).every((c) => c === 200) && codes[5] === 429);
  ok('another address is not held up', (await call(fb, 'POST', { kind: 'bug', text: 'other one' }, '6.6.6.6')).code === 200);
  t = 10 * 60000 + 1;
  ok('ten minutes later it goes again', (await call(fb, 'POST', { kind: 'bug', text: 'later one' }, '5.5.5.5')).code === 200);
}

console.log(`feedback: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
