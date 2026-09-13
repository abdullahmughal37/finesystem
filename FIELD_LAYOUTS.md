# Student and book field settings

Implemented and verified on 12 September 2026.

Open **Settings → Student fields** or **Settings → Book fields**. Select a field to rename it, choose whether it appears in the catalog table and add/edit forms, mark it required, or choose half/full form width. Drag its handle to reorder it, or use the up/down buttons (also accessible on mobile). Arrow keys work on a focused drag handle. Choose **Save layout** to apply changes.

**Add field** supports short text, long text, email, phone, number, date, and dropdown fields. Enter dropdown choices one per line. The table preview reflects the draft order. Unsaved changes are protected when navigating away or closing the page.

Custom fields can be archived and restored. Archiving hides them without deleting saved values. Built-in fields retain their data types; name/registration and title/accession remain required to support student identity and circulation. These fields can still be renamed and reordered. Row numbers, copy availability, and action buttons are computed controls, so they stay outside the configurable data fields.

## Data and CSV behavior

- Layouts persist in `catalog_layouts`; custom values persist in an additive JSON `custom_data` column on students and books. Renaming and dragging never rename SQL columns or rewrite records. Startup adds the storage columns and initializes default layouts while retaining existing data.
- Current catalog forms, tables, detail views, CSV templates, and CSV exports use saved field labels and order. Custom values are included in catalog search. Existing circulation/report identifiers keep their stable internal keys.
- Download a fresh CSV template after changing fields. Templates include fields shown in forms; exports include all active fields, including fields hidden from forms/tables. Archived fields remain in the database and can be restored before exporting them.
- Imports recognize canonical headings and previous labels after renaming. Unknown and archived headings are rejected with instructions, rather than silently losing their values. Required fields and dropdown/date/number/email validation apply to manual entries and imported rows.
- Making a field required does not rewrite old records. Those records must satisfy the new requirement when edited. A type or option change that cannot represent existing nonempty values is rejected.
- Student duplicate/conflict rules remain unchanged: a shared name alone is allowed; matching normalized name, registration, and email is a duplicate. Reusing a registration with different identity details is a conflict. Imports never overwrite existing records. Book duplicate comparison also checks active custom values.
- Layout revisions protect against concurrent administrator edits and stale forms/import previews. If a layout changes, reload it, reopen the form, or preview the CSV again as the error message directs.
- Layouts allow up to 50 fields total. CSV limits remain 5 MB, 10,000 rows, and 128 KB per record.

## Admin account

**Settings → Security** lets an administrator change their own name, login email, and password after supplying their current password. It also lists administrators and can create or remove additional logins. Each account currently has full administrator access. A new password requires at least 12 characters and at most 72 UTF-8 bytes. Saving invalidates previous tokens at protected endpoints and returns the current browser to login. Passwords are stored as bcrypt hashes. The previous nonfunctional OTP toggle has been replaced with actual account controls; email OTP is not implemented.

An administrator account was created in the configured local database because it had no administrators. Its credentials were provided in the task response; no plaintext password was placed in this repository.

## Verification and limits

`npm --prefix server test`: 16 passing unit tests.

With a local MySQL/MariaDB instance, set `TEST_DB_PORT`, then run `npm --prefix server run test:integration`: 55 passing tests including the parent suite. Every normal run creates and cleans up its own uniquely named test database; it does not load university records. The suite covers migration, duplicate handling, transaction failure rollback, concurrent borrowing/returns, dynamic fields, required values, alias collisions, stale revisions, archive/restore, exports/search, 90-day fine trash retention and purge, fine resolution, student clearance, reporting, account management, invalidated tokens, backups, and signed-out API rejection.

Chrome checks passed for drag-and-drop, move buttons, custom dropdowns, renaming without data loss, archive/restore, custom book fields, CSV preview/import, issue/return, account changes and subsequent login, and a 390-pixel mobile viewport. The new local administrator login was also verified through the browser. No uncaught browser errors were observed. `npm run build` passed; the existing large bundle warning remains.

All business APIs now require a valid administrator session; only login, logo files, and read-only branding settings remain public. Expired sessions return the browser to login. Role-based permissions, a tested restore drill, production secret rotation, and operational deployment setup remain before public/university deployment. See [DEPLOYMENT_REVIEW.md](DEPLOYMENT_REVIEW.md).
