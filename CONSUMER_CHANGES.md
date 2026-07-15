# Consumer Changes

Commits in this repo that don't work automatically after a `server/shared`
submodule bump — each needs a matching change in the consuming app.

| Commit | Adds | Per-app action | Done in |
|---|---|---|---|
| `393e9ad` | S3Module now global in `BaseNraAppModule` | Add `@aws-sdk/client-s3` to `server/package.json`; it needs Node >=20, so also bump `server/Dockerfile`'s `FROM node:16-alpine` to `node:20-alpine` (all 3 stages) if not already there | dnd-management-nra, react-admin-nestjs |
| (docs) | Relaxed the "never modify `client/shared`/`server/shared` directly" rule in `AGENTS.md` to "avoid when possible" — editing shared code is fine when a change genuinely belongs there | Update the same line in your own `AGENTS.md`/`CLAUDE.md` to match, so all consuming apps stay aligned on this policy | dnd-management-nra, react-admin-nestjs, teacher-report-nra, student-report-nra, event-management-nra |
