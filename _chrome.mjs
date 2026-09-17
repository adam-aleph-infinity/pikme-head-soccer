// WHERE CHROME IS.
//
// Every visual harness in this repo drives a real Chrome over CDP, and every one of them used
// to hard-code `/Applications/Google Chrome.app/...`. On a machine without Chrome — a fresh
// laptop with only Safari, or Linux CI — they died inside `spawn` with no message, which reads
// as "the harness is broken" rather than "install a browser". The whole picture half of the
// verification rule went with it.
//
// So: one place that finds a browser, and one error that says what to do about it.
// `CHROME_BIN=/path/to/browser` overrides everything.
import { existsSync } from 'node:fs';

const CANDIDATES = [
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  // Linux
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

// Safari is deliberately not a fallback: these harnesses speak the Chrome DevTools Protocol,
// and Safari does not. A browser being present is not the same as this working.
export function chromePath() {
  const override = process.env.CHROME_BIN;
  if (override) {
    if (existsSync(override)) return override;
    throw new Error(`CHROME_BIN points at ${override}, which does not exist.`);
  }
  const found = CANDIDATES.find((p) => existsSync(p));
  if (found) return found;
  throw new Error(
    'No Chrome-family browser found, and these harnesses drive one over the DevTools Protocol '
    + '(Safari cannot).\n'
    + '  macOS:  brew install --cask google-chrome\n'
    + '  Linux:  apt install chromium\n'
    + '  or point at one you already have:  CHROME_BIN=/path/to/browser node _shot.mjs',
  );
}
