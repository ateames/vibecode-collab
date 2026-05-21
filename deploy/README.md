# Deploy configuration

Add environment-specific deployment files here (kept in **this** repo):


| Path            | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| [`digitalocean/`](digitalocean/) | Lemmy on Droplet `137.184.183.96` — run [`scripts/remote-deploy-lemmy.sh`](../scripts/remote-deploy-lemmy.sh) |
| `cloudflare/`   | Wrangler Pages direct upload (`wrangler pages deploy`), env templates   |


Upstream references:

- Lemmy Docker: `../lemmy/docker/` (in the Lemmy repo)
- Blorp env vars: `../blorp/.env.example` (in the Blorp repo)

See [docs/deployment.md](../docs/deployment.md) for the full guide.