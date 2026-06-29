# Setup Notes

Week 0 is mainly environment setup.

What I set up locally:

- Node/npm already installed
- MySQL installed with Homebrew
- database created: `idx_exchange`
- local MySQL user created: `idx_user`
- Python virtual environment created in `.venv`
- Python packages installed for data work and MySQL access
- OpenClaw installed through npm
- OpenClaw gateway was able to start and pass health check
- WhatsApp channel was linked and showed healthy/connected

Still left for later:

- import `rets_property.sql`
- import `california_sold.sql`
- verify row counts after import

Useful commands:

```bash
mysql -u idx_user -p idx_exchange
npx openclaw status
npx openclaw channels status
```
