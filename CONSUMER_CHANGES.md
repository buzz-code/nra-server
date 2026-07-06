# Consumer Changes

Commits in this repo that don't work automatically after a `server/shared`
submodule bump — each needs a matching change in the consuming app.

| Commit | Adds | Per-app action | Done in |
|---|---|---|---|
| `393e9ad` | S3Module now global in `BaseNraAppModule` | Add `@aws-sdk/client-s3` to `server/package.json`; it needs Node >=20, so also bump `server/Dockerfile`'s `FROM node:16-alpine` to `node:20-alpine` (all 3 stages) if not already there | dnd-management-nra, react-admin-nestjs |
