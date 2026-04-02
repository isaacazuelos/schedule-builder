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

### 1. Confirm the month

On the **Schedule** tab, check that the target month is set correctly before doing anything else.

### 2. Set up the staff list

Go to the **Staff** tab.

- Click **Clear all** to remove the sample staff.
- Add people one at a time using the name/role form, or import a CSV using **Import Staff (CSV)**. The CSV must have `Name` and `Role` columns; shift training columns are optional (1 = trained, 0 = not).
- After adding someone, adjust their trained shift checkboxes if the role defaults aren't right.

You can export the current staff list as a CSV and re-import it next time.

### 3. Update availability

Go to the **Availability** tab.

**Mark holidays:**  
Click the date buttons in the **Holidays** section to toggle any statutory holidays or office closures. Holidays are excluded from scheduling entirely.

**Import from Outlook:**  
Export your team's shared calendar from Outlook as a CSV. You need the older Outlook interface to do this:

1. File → Open & Export (left sidebar) → Import/Export
2. In the dialog, choose **Export to a File** → **Comma Separated Values**
3. Select the calendar you want to export
4. Choose where to save the file
5. Keep the default fields selected
6. Enter the date range that covers your target month

Once exported, click **Upload shared calendar CSV** and select the file. The tool will read the events and try to match each one to a staff member by looking for their name in the event subject.

**Review the import:**  
A **Review Import** table will appear showing each event, the date(s) it covers, whether it blocks AM, PM, or both, and which staff member it was matched to. You can:

- Change the **Assign to** dropdown if the automatic match is wrong (the matched portion of the subject is highlighted)
- Click **Dismiss** to ignore an event entirely
- Click **Dismiss all** to ignore everything and start fresh

When you're satisfied, click **Confirm import** to apply the unavailability to the grid.

**Manual overrides:**  
Click any cell in the availability grid to toggle that person's availability for a specific AM or PM period. Green = available, red = unavailable, blue outline = manually overridden.

### 4. Check constraints

Go to the **Constraints** tab and confirm the daily slot counts and weekly caps per role are correct for this month.

### 5. Generate the schedule

Go back to the **Schedule** tab and click **Generate**. Once generated, you can download the result as an HTML file for SharePoint.
