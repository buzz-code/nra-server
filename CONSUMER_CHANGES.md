# Consumer Changes

Commits in this repo that don't work automatically after a `server/shared`
submodule bump — each needs a matching change in the consuming app.

| Commit | Adds | Per-app action | Done in |
|---|---|---|---|
| `393e9ad` | S3Module now global in `BaseNraAppModule` | Add `@aws-sdk/client-s3` to `server/package.json`; it needs Node >=20, so also bump `server/Dockerfile`'s `FROM node:16-alpine` to `node:20-alpine` (all 3 stages) if not already there | dnd-management-nra, react-admin-nestjs |
| `c0cd9fe` | `bootstrapNraApplication` now sets `keepAliveTimeout` (35s) and `headersTimeout` (36s) on the underlying HTTP server, to avoid Caddy reusing a keep-alive connection Node already closed | Add `caddy.reverse_proxy.transport: http` and `caddy.reverse_proxy.transport.keepalive: 30s` labels to the `server` service's `deploy.labels` in `docker-compose-swarm.yml` (must stay below Node's 35s `keepAliveTimeout`) | react-admin-nestjs, event-management-nra, teacher-report-nra, student-report-nra, dnd-management-nra |
