# Blorp production build variables (checklist)

Blorp bakes these into the static bundle at **build time** (`blorp/.env.production`). Changing them requires `pnpm build:web:prod` and `pnpm deploy:cloudflare:prod`.

## Required

- [ ] `REACT_APP_NAME` — display name in the UI
- [ ] `REACT_APP_DEFAULT_INSTANCE` — `https://your-lemmy.example.com` (no trailing path)
- [ ] `REACT_APP_LOCK_TO_DEFAULT_INSTANCE` — `1` for a single-instance site
- [ ] `REACT_APP_INSTANCE_SELECTION_MODE` — e.g. `default_first`

## Optional

- [ ] `REACT_APP_CONTENT_WARNING` — NSFW gate copy
- [ ] `REACT_APP_HOST` — public Blorp hostname (SEO / sitemap in Vite config)

## After deploy

- [ ] Custom domain attached in Pages → **Custom domains**
- [ ] Lemmy CORS allows `https://<your-blorp-host>`
- [ ] Login, feed, post, comment, image upload work in the browser
- [ ] Network tab shows API calls to your Lemmy host without CORS errors

Template: [blorp.production.env.example](./blorp.production.env.example)
