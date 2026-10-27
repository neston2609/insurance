# Production

- Server: 18.142.92.2 (SSH user: ubuntu)
- Demo: https://mfecinsure.demohub24.com/
- Management: https://mfecinsure.demohub24.com/manage
- Code: /opt/insurance/demo and /opt/insurance/manage
- Services: insurance-demo.service and insurance-manage.service
- Internal ports: 127.0.0.1:3100 and 127.0.0.1:3101
- Environment: /etc/mfec-insurance-demo.env and /etc/mfec-insurance-manage.env
- Data: /var/lib/mfec-insurance-demo/data and /var/lib/mfec-insurance-manage/data
- Backups: /var/backups/mfec-insurance-demo and /var/backups/mfec-insurance-manage

Nginx routes `/manage`, `/manage/*`, `/api/admin/*` and the public policy/callback APIs to Management. All other requests use Demo. Management production assets are built with the `/manage/` prefix to avoid collisions with Demo assets.

The applications use independent data directories, administrator credentials and sessions. Demo inquiries and product changes are not synchronized with Management.

Initial deployment copies the existing business records and administrator password hash from the legacy application on the same server. It does not copy sessions or change the existing password. Runtime files and secrets stay on the server.

For updates, back up the runtime directories, pull this repository, run `npm ci`, `npm run build`, and `npm test` in each application directory, then restart only the updated service. Avoid replacing runtime data or environment files. Check `systemctl status insurance-demo insurance-manage`, `journalctl -u insurance-demo -u insurance-manage`, and the public health endpoints.

HTTPS uses the domain's Let's Encrypt certificate and the server's existing Certbot renewal timer and Nginx reload hook. The legacy application on port 3000 is retained.
