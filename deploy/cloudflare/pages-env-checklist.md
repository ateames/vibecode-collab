# Vibe Code Collab production build variables (checklist)

The frontend (Blorp fork) bakes these into the static bundle at **build time** (`blorp/.env.production`). Changing them requires `pnpm build:web:prod` and `pnpm deploy:cloudflare:prod`.

## Required

- [ ] `REACT_APP_NAME` — display name in the UI (`Vibe Code Collab`)
- [ ] `REACT_APP_DEFAULT_INSTANCE` — `https://your-lemmy.example.com` (no trailing path)
- [ ] `REACT_APP_LOCK_TO_DEFAULT_INSTANCE` — `1` for a single-instance site
- [ ] `REACT_APP_INSTANCE_SELECTION_MODE` — e.g. `default_first`

## Branding (recommended)

- [ ] `REACT_APP_TAGLINE` — subtitle in browser tab / SEO
- [ ] `REACT_APP_PUBLIC_URL` — public app URL for legal copy
- [ ] `REACT_APP_SUPPORT_EMAIL` — support contact in Terms / Support screens
- [ ] `REACT_APP_GITHUB_REPO` — optional; enables GitHub links in Settings/Support

## Optional

- [ ] `REACT_APP_CONTENT_WARNING` — NSFW gate copy
- [ ] `REACT_APP_HOST` — public app hostname (SEO / sitemap in Vite config)

## After deploy

- [ ] Custom domain attached in Pages → **Custom domains**
- [ ] Lemmy CORS allows `https://<your-app-host>`
- [ ] Login, feed, post, comment, image upload work in the browser
- [ ] Network tab shows API calls to your Lemmy host without CORS errors
- [ ] No “Blorp” in user-visible UI (tab title, settings, legal pages)

Template: [blorp.production.env.example](./blorp.production.env.example)
