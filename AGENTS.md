# nra-server

Shared **server-side** library (NestJS + TypeScript + TypeORM) consumed by every NRA project as the `server/shared` git submodule.

## This repo is shared — edit with care

`react-admin-nestjs`, `event-management-nra`, `teacher-report-nra`, `student-report-nra`, and `dnd-management-nra` all pin this repo as a submodule. A change here reaches every app the next time it bumps its pointer. Prefer additive, backward-compatible changes. When a change needs each consuming app to do something (new dependency, new config, a Dockerfile/compose edit, a wiring change), it is **not** automatic — record it (see below).

Full rollout process: the `shared-changes-workflow` and `bump-shared-ref` skills in `multi-repo-codespace/.github/skills/`.

## CONSUMER_CHANGES.md convention

`CONSUMER_CHANGES.md` at the repo root is the handshake between a shared change and the apps that must adapt to it. Maintain it by these rules:

- **Add a row only when a consumer must act.** Purely additive changes that work automatically after a pointer bump get no row.
- **When you author such a change, add the row in the same PR.** Columns: `Commit` (short hash, or `(docs)` for policy-only), `Adds`, `Per-app action` (the exact edit), `Done in` (apps already wired — often none yet).
- **When you wire an app, append it to that row's `Done in`** and commit.
- **A runtime break after a bump with no matching row = a missing row.** Add it.

## Key shared subsystems

- `utils/report/` — `BaseReportGenerator` family (Excel/PDF/ZIP/audio/JSON). See the `report-generation` skill.
- `utils/yemot/` — Yemot IVR handler base (v2), router, and the `testing/` scenario harness. See the `yemot-integration` skill.
- `auth/` — JWT auth, guards, strategies.

## Tests

`yarn test` (Jest + ts-jest). Mock the TypeORM repo/DataSource — no live DB in unit tests. See the `write-tests` skill.
