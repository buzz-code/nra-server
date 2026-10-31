---
name: ops-tracking
description: Use at the start of any code task in an NRA repo (bug fix, feature, refactor, PR) and at each status change, to create or update the matching action-item issue in buzz-code/ops so the "Action items" board shows the real state. Use when the user mentions "ops#N", "buzz-code/ops#N", or asks to track, open or update an action item.
---

# Skill: Track Work in buzz-code/ops

> **Use this skill when:** you start, progress or finish a code task in any NRA repo. Every task is an issue in `buzz-code/ops` (private tracker). Its `status:*` label drives the column on the "Action items" GitHub Project board, so keep it current.

Full rules (triage, label meanings, work order) live in `CLAUDE.md` of `buzz-code/ops`. This skill is the subset a code session needs.

---

## Privacy (read first)

`react-admin-nestjs`, `nra-client` and `nra-server` are **public**. In every code repo:

- Never copy text from an ops issue into code, commits, PR titles/bodies, PR comments or docs: no client names, organization names, people, phone numbers, emails or mail quotes.
- Reference the item only as `buzz-code/ops#N` plus a neutral technical description.
- Detailed context belongs in the ops issue (private), not in the code repo.

## Session link

Every ops issue links to the Claude session(s) that worked on it.

- Creating an ops issue: end the body with `🔗 סשן Claude: <link>`.
- First time this session comments on an existing ops issue (plan, status change, PR link): add the same line, unless the issue already has this session's link.
- Link: the project thread URL if this session runs in a Claude project thread, otherwise `https://claude.ai/code/session_…` (same value as the `Claude-Session:` commit trailer).
- Not sure of the link → leave it out. Never guess.
- Put the link only on the ops issue. Nothing extra goes into code-repo PRs or commits.

## Labels

| Repo | Project label |
|---|---|
| `react-admin-nestjs` | `project:react-admin` |
| `event-management-nra` | `project:event-mgmt` |
| `teacher-report-nra` | `project:teacher-report` |
| `student-report-nra` | `project:student-report` |
| `dnd-management-nra` | `project:dnd` |
| `nra-client`, `nra-server` | `project:shared` |

- Source: `src:client-mail`, `src:idea`, `src:bug`
- Type: `type:reply`, `type:hotfix`, `type:feature`, `type:question`
- Priority: `p0-urgent`, `p1`, `p2`
- Status (exactly one at a time): `status:needs-reply`, `status:thinking`, `status:planned`, `status:in-progress`, `status:in-review`. No status label = Inbox; closed = Done.

## Steps

### 1. Find the item

- User gave `ops#N` / `buzz-code/ops#N` → read that issue and its comments.
- Otherwise search open issues in `buzz-code/ops` for the same task. Found → confirm with user it is the one.
- None → create one in `buzz-code/ops`:
  - Title: short summary of the ask (Hebrew, matching existing issues).
  - Body: what and why, affected repo and files.
  - Labels: source (`src:bug` or `src:idea`), type, project label for this repo, priority (`p2` unless told), `status:planned`.

### 2. Plan before code

If the issue has no plan comment yet: comment the plan on the ops issue, set `status:planned`, ask user to approve. Code only after approval.

### 3. Start coding

Swap status label to `status:in-progress` (remove the previous `status:*`). Short comment: repo + branch.

### 4. Open the PR

- PR body starts with `Fixes buzz-code/ops#N` (or `Part of buzz-code/ops#N` when the item needs PRs in more than one repo), then technical description only.
- On the ops issue: swap to `status:in-review`, comment the PR link.

### 5. After merge

- Do **not** close the ops issue yourself. It closes after every PR for it is merged **and** any client reply is sent (per ops `CLAUDE.md`). Comment "merged: <PR link>" and tell the user what is left.
- Note: `Fixes buzz-code/ops#N` from another repo may not auto-close the issue; that's expected.

## No access to buzz-code/ops

If the session can't read or write `buzz-code/ops` (repo not attached, permission denied): don't block the code work. Tell the user, once, which ops update is needed (issue number, label change, comment text) so they or the ops session can apply it.
