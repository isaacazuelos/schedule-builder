# Phone Coverage Scheduler

Single-file HTML scheduling tool (`scheduler.html`). No server, minimal
dependencies beyond GLPK.js from CDN. Opens directly in a browser. Deployed by
dropping the output in SharePoint or a shared drive — users have no terminal
access and no admin rights on their machines.

## What it does

Generates monthly phone and in-person advising coverage schedules for an office
(~25 staff). Constraint optimization via GLPK.js (WebAssembly ILP solver, runs
in-browser). Output is an HTML calendar the manager pastes into SharePoint.

## Shift types

- `phones-am`, `phones-pm`, `inperson-am`, `inperson-pm`
- Default slots per day: 2 / 2 / 1 / 1

## Roles

People have roles: `OP2`, `SA1`, `SA2`. Each staff member has a role and can do
any shift type they're trained on regardless of roles. By default, `OP2` can
only do phones. Both `SA1` and `SA2` can do any type. This default is used to
populate what someone's trained on when adding new people in the UI.

## ILP model

Objective: minimize M (minimax fairness — minimize the maximum total shifts
assigned to any person).

Constraints:

- Coverage is exact.
- One shift per person per day.
- Training eligibility: variable fixed to 0 if untrained or unavailable
- Weekly caps per role: total shifts/week and per shift type/week

## Availability input

Outlook calendar CSV export, matched to staff by filename (e.g. `Jane Smith.csv`
matches staff member "Jane Smith"). Standard Outlook CSV format — Subject, Start
Date, End Date columns. Manual per-person date overrides also supported in the
UI.

## Config persistence

Export/import as JSON: staff list, overrides, holidays, slot counts, caps. No
backend storage.

## UI structure

Six tabs in order: Staff -> Availability -> Constraints -> Shift Calendar ->
Generate -> Output.

## Key things to be careful about

- The ILP can return infeasible if coverage requirements exceed available
  trained staff after applying availability and caps. Surface this clearly to
  the user; don't silently produce a partial schedule.
- Outlook CSV filename matching is currently a naive substring match — fragile
  if filenames diverge from staff names.
- It's okay if there's a build step for the developer, but the actual output we
  can give users must be a single file. The single-file constraint is
  intentional and hard.
