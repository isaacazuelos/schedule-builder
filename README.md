# schedule-builder

A tool for building role-based schedules for office workers. This is also me messing around with AI coding tools.

## Build

```sh
npm install
npm run build
```

The output is a single self-contained file: `dist/index.html`. Open it directly in a browser or drop it into SharePoint — no server required.

## Development

```sh
npm run dev
```

Starts a local dev server with hot reload at `http://localhost:5173`.

## Usage

1. **Staff** — add staff members, set their role (OP2 / SA1 / SA2), and adjust which shift types they're trained on.
2. **Availability** — upload Outlook calendar CSV exports (filename must contain the person's name) and/or click cells to add manual overrides. Mark holidays here too.
3. **Constraints** — set how many slots each shift type needs per day, and weekly shift caps per role.
4. **Generate** — pick the target month and run the scheduler. The ILP solver minimises the maximum total shifts assigned to any one person (minimax fairness).
5. **Shift Calendar** — visual grid of the generated schedule.
6. **Output** — copy the HTML calendar to paste into SharePoint, or download it as a file.

Config (staff, overrides, holidays, caps) can be exported and re-imported as JSON from the Staff tab.
