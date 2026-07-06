# Consumer Changes

This repo (`server/shared` in every NRA app) is consumed as a git submodule by
`react-admin-nestjs`, `student-report-nra`, `event-management-nra`,
`dnd-management-nra`, and `teacher-report-nra`. This repo has no `package.json`
of its own — its npm dependencies are resolved against whatever each host
app's `server/package.json` declares. Most commits here are safe to pick up
by just bumping the submodule pointer, but a commit that imports a new npm
package is not: the pointer bump alone breaks the build/tests until the
consuming app also adds that dependency.

This file tracks commits that need a matching per-app change. When you land a
commit here that needs one, add an entry. When an app applies its side,
update its row.

## S3Module wired into BaseNraAppModule (96e0c97, 393e9ad)

`utils/s3/s3.service.ts` wraps `@aws-sdk/client-s3` for upload/download/list/
delete. `393e9ad` marked `S3Module` `@Global()` and registered it in
`BaseNraAppModule.forRoot()`, so **every** host app now loads it at boot
whether or not it uses S3 — there's no way to opt out per app.

**Required per-app action:** add `@aws-sdk/client-s3` to `server/package.json`
dependencies and reinstall. Without it, both the app and its test suite fail
to build (`TS2307: Cannot find module '@aws-sdk/client-s3'`) as soon as
`server/shared` is bumped past `393e9ad`.

| App | Status |
|---|---|
| dnd-management-nra | Done (`@aws-sdk/client-s3` present in `server/package.json`) |
| react-admin-nestjs | **Broken** — `server/shared` is already pinned past `393e9ad` but the dependency is missing; build/tests fail |
| student-report-nra | Not yet exposed (`server/shared` still pinned before `393e9ad`); add the dependency before bumping past it |
| event-management-nra | Not yet exposed; same as above |
| teacher-report-nra | Not yet exposed; same as above |
