# Consumer Changes

Commits in this repo that don't work automatically after a `server/shared`
submodule bump — each needs a matching change in the consuming app.

| Commit | Adds | Per-app action | Done in |
|---|---|---|---|
| `393e9ad` | S3Module now global in `BaseNraAppModule` | Add `@aws-sdk/client-s3` to `server/package.json` | dnd-management-nra (react-admin-nestjs is pinned past this without the dep — currently broken) |
