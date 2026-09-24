# Meta WhatsApp deployment

This is the live path: Meta → HTTPS 443/Nginx → localhost:3001 → shared
orchestrator → MySQL/providers → Meta response. Sample mode is CLI-only.

## Before starting

Use Node 24+, `npm ci`, an authorized database and private `.env` configuration
based on `.env.example`. Run `npm run check` and `npm run demo:check`. Configure
the Meta access token, phone-number ID, app secret and your chosen verification
token. Do not share screenshots containing tokens. Key presence alone does not
prove validity, authorization or remaining provider credits.

Start locally with `npm run whatsapp:meta:webhook`. It binds only to
`127.0.0.1:${META_WHATSAPP_PORT:-3001}`. `GET /health` returns `ok`.
The Meta phone must be configured for your account; test recipients and production
eligibility depend on that account. A short-lived test token is not a permanent
deployment credential.

## systemd and HTTPS

`deploy/systemd/real-estate-meta-whatsapp.service` is the existing VPS template.
**Adjust its user, group, absolute project path, Node/npm path and environment
file for your machine before installing.** Do not copy its `cwh`/NVM paths onto
another host unchanged. Protect `.env` permissions and do not run the service as
root.

`deploy/nginx/meta-whatsapp.conf` is a location snippet, not a complete TLS server.
Include it inside the existing domain's `server` block that listens on HTTPS
443 and has a valid certificate. Adjust the upstream port if configured
differently. Do not expose localhost ports 3000/3001 through the firewall.
Validate Nginx configuration before reload and arrange certificate renewal.

In the Meta app, configure the callback
`https://YOUR_DOMAIN/meta-whatsapp` and the exact verification token from `.env`.
Subscribe to the `messages` webhook field for the intended WhatsApp account.
POST requests require valid HMAC-SHA256 signatures; do not disable signature
verification to bypass a setup error. `/health` is not the callback URL.

After a code or credential update, restart the installed unit deliberately:

```bash
sudo systemctl restart real-estate-meta-whatsapp
sudo systemctl status real-estate-meta-whatsapp --no-pager -l
npm run demo:check -- --meta
```

The preflight checks local health and reads Meta phone metadata. It does not
validate public DNS/TLS, webhook subscription, SMTP or a complete message round
trip. Finish by messaging the configured number from your authorized test
account; test `help`, one property query and one knowledge question.

For failures, inspect `journalctl -u real-estate-meta-whatsapp -n 80 --no-pager`.
Treat logs as private and redact user messages/identifiers before sharing.

## Operational boundaries

State is in memory. Restart discards pending email approvals, search sessions
and recent-message deduplication. The current webhook acknowledges before agent
execution; a process crash can lose work. Use a durable queue/state store before
claiming resilient production delivery. systemd alone does not provide that.

The old `whatsapp:webhook` command is an unsigned legacy local adapter, not the
Meta server. Keep it private. The direct Meta integration does not need an
OpenClaw daemon or Twilio to run alongside it.
