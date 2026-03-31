# schedule-builder

> A tool for building role-based schedules for office workers. 

This is also me messing around with AI coding tools.

## Build

```sh
npm install
npm run build
```

The output is a single self-contained file: `dist/index.html`. Open it directly in a browser. 

## Development

```sh
npm run dev
```

Starts a local dev server with hot reload at `http://localhost:5173`.

## Usage

1. **Schedule** — pick the target month, generate a schedule, and download the HTML file for SharePoint. Shows a summary and per-person shift breakdown after generating.
2. **Staff** — add/remove staff, set roles (OP2 / SA1 / SA2), and adjust trained shift types. Export or import the staff list as CSV.
3. **Availability** — upload Outlook calendar CSV exports (filename must contain the person's name) and/or click cells to add manual overrides. Mark holidays here too.
4. **Constraints** — set how many shifts each type needs per day, and weekly shift caps per role.

The staff list can be exported and re-imported as CSV from the Staff tab.
