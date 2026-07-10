# AI Real Estate Assistant

Internship project for building an OpenClaw based real estate assistant.

Current repo status:

- OpenClaw is installed as the runtime dependency
- local setup notes are in `docs/setup-notes.md`
- Week 1 architecture notes are in `docs/architecture.md`
- secrets go in `.env`, using `.env.example` as the template

The MLS SQL dumps and `.env` file are intentionally not committed.

Week 2 parser work lives in `src/skills/property-search`.

Run checks:

```bash
npm test
npm run typecheck
```

Week 3 database integration adds MySQL query helpers in `src/db`.

The local Docker database currently has `rets.rets_property`; `california_sold` can be imported later for sold comps.

Database checks:

```bash
npm test
npm run typecheck
RUN_DB_TESTS=1 npm test
```

`RUN_DB_TESTS=1` expects the Docker MySQL container to be reachable on `localhost:3306` with the `.env` settings.

