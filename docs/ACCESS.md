# Head Football access — owner configuration

Idan can change all game code, test it on his Mac, and publish to the existing production URL
by pushing `main`. Hosting administration remains with Adam. No owner PAT is required.

## Enforced boundaries (verified 2026-09-17)

| Boundary | Configuration |
|---|---|
| GitHub | `idanb-shino` is an accepted **write** collaborator on `adam-aleph-infinity/pikme-head-soccer` |
| Other repositories | Among 20 repositories with owner-level audit access across Adam's two accounts, this was Idan's only grant; this is not an audit of every possible GitHub organization |
| Render membership | Idan is not a member of the shared `pikmeTV` workspace |
| Deployment capability | The repo has only `RENDER_DEPLOY_HOOK`, scoped to service `srv-da62j13bc2fs73anuptg` (`pikme-headsoccer`) |
| Runtime network | Dedicated project `Head Football` (`prj-dam0g1vcgkoc73fsavk0`), environment `Production` (`evm-dam0g27cgkoc73fsavl0`), `networkIsolationEnabled: true` |
| Environment contents | Only the Head Football service; no databases, other games, or environment groups |
| Runtime credentials | No configured environment variables, secret files, or shared environment groups |
| App bridge | Injects nickname and compact card choices; the app authentication token is not injected |
| Deploy source | `main` on this repository; native auto-deploy is off, GitHub Actions triggers an exact SHA |

The environment is protected against non-admin infrastructure changes. Idan needs no Render
membership: his service-specific hook can publish the game, including arbitrary game server
code. It cannot configure other services. The workflow checks the hook's service ID to catch
an accidental wrong secret, but the actual authorization boundary is Render's hook scope.

Private network isolation prevents the game connecting to other environments over Render's
internal network. Public URLs remain reachable like they are from any computer; their normal
authentication remains necessary. This does not claim to make all public APIs inaccessible.
See [Render network isolation](https://render.com/docs/projects#blocking-cross-environment-traffic)
and [deploy hook scope](https://render.com/docs/deploy-hooks).

## What the previous setup got wrong

- Idan's own GitHub browser login already works. Asking Adam to generate a personal access
  token for Idan confused authentication with repository permissions.
- The service used a public Git URL. Making the repo private broke Render's source access;
  it did not mean Idan needed broader permissions. A previous session restored public
  visibility; this setup preserves that state.
- Missing deployment secrets previously produced green Actions runs. A generic HTTP 200
  could also come from an old build. Both now fail: the Action deploys a specific SHA and
  waits for that SHA at `/version`, then checks the game WebSocket.
- A separate repo and service did not isolate the private runtime network. The game now has
  its own isolated environment, containing no other services.
- Node 20 was documented even though the Mac simulator and tests use Node 22's global
  WebSocket. `.nvmrc`, package metadata, CI, and onboarding now agree on Node 22.
- A fixed test port could hit another checkout's server. The online test now asks the OS
  for a port; simulator browser debugging ports are also allocated automatically.

## Canonical repository

Use `adam-aleph-infinity/pikme-head-soccer`. During this repair another session created a
separate private repository at `adamp-svg/pikme-head-soccer` and temporarily pointed Render
at it. That copy had a pending Idan invitation and no Actions deploy secret. It is not a
completed transfer. Production was restored to the original repository so Idan retains his
accepted access and existing clone. The private copy has been left untouched.

## Keep it working

- Do not give Idan Adam's GitHub login, Render API key, or shared workspace membership.
- Do not attach shared credentials, databases, or other games to this environment.
- Do not connect an automatically syncing Blueprint from this writable repo to shared
  infrastructure. `render.yaml` is a reference; the live service is configured directly.
- Before making the repo private, connect Render to a GitHub integration that can read it,
  then verify a push reaches production. An empty repository webhooks list does **not** prove
  a GitHub App integration is absent.
- Any pending ownership-transfer email from the earlier attempt is unnecessary for Idan.
  Do not accept it as a setup step; if ownership changes later, recheck source access,
  collaborator permissions, repository secrets, and deployment.
- If the hook is lost or exposed, regenerate only this service's hook in Render and replace
  `RENDER_DEPLOY_HOOK` in this repository's Actions secrets. Never substitute a Render API key.

## Idan's first check

Follow `ONBOARDING.md` on **his own Mac**. Verify `gh api user --jq .login` says `idanb-shino`,
run `npm ci`, `npm test`, and `npm run sim`. Make a small game change, commit and push `main`,
then confirm the Actions run is green and `/version` equals `git rev-parse HEAD`.
Adam's machine verifying the simulator does not establish that Idan's Mac is already installed.
