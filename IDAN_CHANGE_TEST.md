# Idan's agent: make, deploy, and undo a visible game change

Adam authorizes this complete exercise, including both production pushes. Finish it without
requesting another approval to edit, commit, deploy, or revert this game. The existing deployment
probe already passed; this exercise demonstrates a visible change to the playable game.

## Scope and starting point

- Work only in `adam-aleph-infinity/pikme-head-soccer`.
- Production is `https://pikme-headsoccer.onrender.com`.
- Authenticate as **idanb-shino**, using the existing GitHub CLI keyring login. No Adam PAT,
  Render login, or deployment secret on this Mac is needed. `RENDER_DEPLOY_HOOK` is already
  configured in GitHub Actions.
- Use the existing clone and installed tools. Node 24 is acceptable; CI uses Node 22. Chrome
  in `~/Applications` is supported. Do not reinstall working tools or require sudo.
- Read `AGENT_PROMPT.md` and `ONBOARDING.md`. Keep unrelated local edits intact.

Check `gh api user --jq .login`, `git status --short`, and `git remote get-url origin`.
The expected remote is `https://github.com/adam-aleph-infinity/pikme-head-soccer.git` (or its
SSH equivalent). If origin points at `adamp-svg/pikme-head-soccer`, correct this clone's origin
to the canonical URL above; that private copy is not the production source.

Fetch `origin/main`. With a clean main checkout, use `git pull --ff-only`. If this checkout has
uncommitted work, preserve it and create a separate worktree from `origin/main` for the exercise.
Never discard, stash without consent, or include someone else's edits. Never force-push.

## 1. Make one visible change

In `public/index.html`, change only the existing `#playBtn` element:

```html
<!-- Before -->
<button class="play" id="playBtn">שחק</button>

<!-- Temporary exercise -->
<button class="play" id="playBtn" data-idan-check="play-label-v1">שחק עכשיו</button>
```

Keep its ID, class, and click behavior. The new text means "Play now". The attribute gives the
deployment check an unambiguous marker. Do not modify gameplay, physics, authentication, card
ownership, the app integration, hosting settings, or the deployment workflow for this exercise.

If the current button already differs from the Before example, record its actual original
markup and adapt the minimal edit; restore that original at the end.

## 2. Verify locally

```bash
npm ci
npm test
node _shot.mjs
node _pad.mjs
```

Also launch `npm run sim -- --device=se`. Check the pick screen in **bot mode**, where the Play
button is visible, at **667×375** and **844×390**. Existing headless Chrome tooling is acceptable
if your agent cannot view a desktop window. Capture the pick screen, verify the new button text
is rendered inside the viewport without clipping, and click it to confirm a match starts.

`_pad.mjs` verifies match controls; it does not by itself verify the pick-screen label. Inspect
the changed button too. Save screenshots outside tracked files (for example under `.shots/`).
State whether you actually inspected the images or only verified DOM/layout measurements.

## 3. Publish and prove the visible change reached production

Review `git diff` and stage only `public/index.html`. Commit with a descriptive message and
record the full SHA as `CHANGE_SHA`. Push to main with `git push origin HEAD:main`.

If the push is rejected because main advanced, fetch and integrate those changes normally,
rerun affected checks, and record the new SHA. Do not overwrite newer work.

Find the Actions run for **that exact commit**:

```bash
gh run list --repo adam-aleph-infinity/pikme-head-soccer \
  --workflow deploy.yml --commit "$CHANGE_SHA" \
  --json databaseId,status,conclusion,url
gh run watch <that-run-id> --repo adam-aleph-infinity/pikme-head-soccer --exit-status
```

Then verify all of these:

1. `/version` returns `CHANGE_SHA` exactly.
2. The live HTML includes `data-idan-check="play-label-v1"` on `#playBtn` and the new text.
3. Load the **production URL** in a fresh browser context or headless Chrome, using a query
   parameter such as `?idan-check=<CHANGE_SHA>` to avoid an old cached page. Capture the pick
   screen, confirm the new button is visibly rendered, and click it to start a bot match.

A push, a successful HTTP response, a local screenshot, or the `aaaa...` fixture printed by
`test-deploy.mjs` does not substitute for these production checks. Use the production URL for
the production screenshot and record its URL alongside the image.

## 4. Undo the exercise and verify recovery

After recording the successful change, revert **only your exercise commit**:

```bash
git revert --no-edit "$CHANGE_SHA"
npm test
git push origin HEAD:main
```

Record the revert's full SHA as `CLEANUP_SHA`. Watch the Actions run matching that SHA, then
confirm `/version` equals `CLEANUP_SHA`, the test attribute is absent, and the original button
text and click behavior are restored in production. Preserve any unrelated intervening work.

The final state should contain no temporary test label, marker, or committed screenshots.
If a step fails, report the actual error and repair the game within this scope; never describe
a partial check as a pass. A desktop window being inaccessible does not prevent headless checks.

## Return this evidence to Adam

```text
Account: idanb-shino
Repository: adam-aleph-infinity/pikme-head-soccer
Local tests and screenshot checks: PASS / FAIL, with results
Small and large pick-screen screenshots: paths; inspected or DOM-verified only
CHANGE_SHA: <full SHA>
Change Actions run: <URL and conclusion>
Live changed button: PASS / FAIL, with production screenshot path and page URL
CLEANUP_SHA: <full SHA>
Cleanup Actions run: <URL and conclusion>
Final production /version: <actual JSON>
Original button restored; marker absent: PASS / FAIL
Remaining limitations: <specific issues, or none>
```

Do not repeat the account-wide access audit or ask for production credentials. Your own
account, this repository, and the existing deploy Action are enough to complete the exercise.
