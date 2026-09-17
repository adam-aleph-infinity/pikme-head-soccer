# Idan: set up Head Football on your Mac

You have write access as **idanb-shino**. Use your own GitHub account. You can change every
part of this game and push `main` to publish to https://pikme-headsoccer.onrender.com.

With [Homebrew](https://brew.sh) installed, run:

```bash
brew install node@22 gh
brew install --cask google-chrome
export PATH="$(brew --prefix node@22)/bin:$PATH"
gh auth login --hostname github.com --git-protocol https --web --scopes workflow
gh auth setup-git
gh api user --jq .login
```

The last line must show `idanb-shino`. Then:

```bash
cd ~
git clone https://github.com/adam-aleph-infinity/pikme-head-soccer.git
cd pikme-head-soccer
npm ci
npm test
npm run sim
```

If you already cloned it, enter that folder and run `git pull --ff-only` instead of cloning
again. Keep any local changes. In a new terminal, repeat the `export PATH` line above.

The simulator is a phone-sized Chrome window with touch emulation. It runs the complete game
on your Mac and starts its own server. Ctrl-C closes it. It does not require the iOS app repo,
Xcode, a database, or any production credentials. Try:

```bash
npm run sim -- --device=se       # smaller phone
npm run sim -- --duo             # two phones for online 1v1
npm run sim -- --album=8         # test the collected-card restrictions
```

After editing, run `npm test`, commit your changed files, and `git push origin main`.
Watch the [deploy Action](https://github.com/adam-aleph-infinity/pikme-head-soccer/actions).
The [live version](https://pikme-headsoccer.onrender.com/version) must equal `git rev-parse HEAD`.
To undo a bad change, `git revert <bad-commit-sha>` and push again.

Paste this into your coding agent, opened in this folder:

> Read AGENT_PROMPT.md and ONBOARDING.md. This workspace is only Head Football.
> I own all changes to this game and may deploy them to production by pushing main.
> Use my own GitHub account, idanb-shino. No Adam token, Render account, app repo,
> or shared backend credentials are needed. Help me run npm ci, npm test, and npm run sim
> on this Mac, then verify my first push through GitHub Actions and the live /version.

See `ONBOARDING.md` for the full workflow and game-specific tips.
