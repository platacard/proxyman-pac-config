# proxyman-pac-config

Proxy auto-config (PAC) files for mobile QA. A phone that uses a PAC link sends only test-stand traffic (stable, dev, mock, sandbox) to Proxyman on your Mac. Everything else goes direct, even when Proxyman is off.

Setup guide (RU): [Proxyman: auto proxy via PAC file](https://platacard.atlassian.net/wiki/spaces/PC/pages/3515318471)

The repository and the published files are public. Keep only host patterns and local Mac IPs here: no tokens, passwords or other internal data.

## How it works

| File | Purpose |
|---|---|
| `template.pac` | Routing rules shared by all testers, with the `{{PROXY}}` placeholder |
| `testers.json` | Tester login → Mac IP |
| `checks.json` | Sample hosts that must go through Proxyman (`proxy`) or directly (`direct`) |
| `scripts/build.mjs` | Generates `dist/<login>.pac` for every tester and checks the rules |

GitHub Actions runs the build on every pull request and publishes `dist/` to GitHub Pages after a merge to `main`.

## Add yourself

1. Pin your Mac's IP in the Wi-Fi network you test from (DHCP reservation on the router), see step 1 of the setup guide.
2. Add a line to `testers.json`. The key is your work email login, the value is your Mac's IP. The Proxyman port defaults to `9090`; use `ip:port` if you changed it.

   ```json
   {
     "egor.danilov": "192.168.0.26"
   }
   ```

   Testing from several networks, for example home and office? Add one entry per network: `egor.danilov-office`.
3. Open a pull request. After the merge your file is published at
   `https://platacard.github.io/proxyman-pac-config/<login>.pac`
4. On the phone: Settings → Wi-Fi → ⓘ next to the network → Configure Proxy → Automatic → paste the link.

## Change the list of stands

1. Edit the rules in `template.pac`.
2. Add a sample host to `checks.json`: to `proxy` if it must go through Proxyman, to `direct` otherwise.
3. Run `node scripts/build.mjs` (Node.js 18+). The build fails with a list of problems if a rule or an IP is wrong.

Phones pick up a new version after reconnecting to Wi-Fi. GitHub Pages caches files for up to 10 minutes.

## Repository settings

Settings → Pages → Build and deployment → Source: **GitHub Actions**. If the Visibility option is shown, keep it **Public**: phones download the PAC file without signing in to GitHub.
