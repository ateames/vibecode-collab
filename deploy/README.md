# Deploy configuration

Add environment-specific deployment files here (kept in **this** repo):


| Path            | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `digitalocean/` | Docker Compose overrides, `lemmy.hjson` templates, DO App Platform spec |
| `cloudflare/`   | Wrangler Pages direct upload (`wrangler pages deploy`), env templates   |


Upstream references:

- Lemmy Docker: `../lemmy/docker/` (in the Lemmy repo)
- Blorp env vars: `../blorp/.env.example` (in the Blorp repo)

See [docs/deployment.md](../docs/deployment.md) for the full guide.