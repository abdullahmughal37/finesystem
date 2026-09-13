# Student and book modules

For configurable fields, drag-and-drop layouts, and administrator login settings added on 12 September 2026, see [FIELD_LAYOUTS.md](FIELD_LAYOUTS.md). That document contains the latest verification totals.

Implemented and verified on 12 September 2026.

## Student fields and identity

The student form and list follow `Required Students Data.xlsx`, Sheet1, row 6: Sr #, Name, Father Name, Registration No., Department, Contact No., Semester, Status, and Remarks. Sr # is generated for the displayed list; it is not a student identifier. Email is an additional optional field requested for identity checks and future email workflows. The supplied workbook is a blank template, so no actual students were imported from it.

Name and Registration No. are required. Status supports Active, Inactive, Graduated, and Suspended. Contacts, registration numbers, and ISBNs are stored as text to retain leading zeroes. Keep these columns formatted as Text in Excel before exporting CSV.

| Incoming student | Result |
| --- | --- |
| Same name, registration, and email | Duplicate; skipped without changing the existing record |
| Same name, different registration | Separate student; accepted |
| Same registration, different name or email | Conflict; review and explicitly edit the existing record |
| Same email, different registration | Not automatically merged or rejected |
| Same name and registration, both emails blank | Duplicate; email is optional |

Identity comparison ignores case and extra whitespace. Registration numbers are normalized to uppercase and email addresses to lowercase. Other fields on a duplicate are preserved, not overwritten. Use Edit Student for deliberate updates.

## Importing

1. Open Students or Books and select **Import CSV**.
2. Download the corresponding template. Enter one record per row and save as **CSV UTF-8**. XLSX uploads are not accepted.
3. Select the file and choose **Preview file**. The preview does not insert records.
4. Review Ready, Duplicate, Conflict, and Invalid rows. Download the results if useful.
5. Select **Import N new records**. Only new valid records are added. The server checks again at confirmation in case data changed after the preview.

Limits: 5 MB, 10,000 records, and 128 KB per CSV record. Workbook-style headings and database-style headings are accepted. Blank rows and introductory rows before the headings are supported. Existing records are never updated by importing. A database error rolls back all additions in that batch. Duplicate/conflict/invalid rows are skipped and reported individually. CSV record numbers account for header/preamble records; a quoted multiline cell remains one CSV record.

Students and books use server-side search and pagination. Imports and manual changes refresh the list. Dashboard totals use database records and provide a link to all students.

## Books, issuing, and returns

- Each accession identifies one physical copy. Different copies may share title, author, and ISBN.
- Matching accession and catalog details are duplicates. Changed details for an existing accession are conflicts, requiring explicit editing.
- Add/Edit supports accession, title, author, publisher, publication year, pages, call number, binding, source, cost, ISBN, and remarks.
- The catalog shows total, available, issued, and overdue copies. View shows full metadata and the latest 100 loans, including returned loans.
- Text searches that match several students or books require selection. Exact registration/accession searches take precedence. Changing search text clears the prior selection.
- Issuing uses backend-calculated dates and current policy. Student and book row locks prevent concurrent requests from exceeding the borrowing limit or lending the same copy twice.
- Suspended/inactive/graduated students cannot borrow. Payment-based clearance is not implemented by this module; existing sent/unsent fine states cannot establish whether a fine was paid.
- Returns and automatic fines commit together. Repeated return requests do not create additional fines. Zero and decimal daily rates are supported.
- The business timezone defaults to Asia/Karachi; set `LIBRARY_TIMEZONE` if needed. Date-only calculations are consistent across the catalog, return preview, and overdue report.
- Students/books with any loan or fine history cannot be deleted through their module endpoints. Existing conflicting active loans are displayed for manual reconciliation; this change does not delete or merge historical data.

## Starting the application

Install root and server dependencies separately. Configure `server/.env` for the intended database. Existing environment variables take precedence over the file.

The backend initializes missing tables and applies an additive email-column migration before listening. It preserves existing students, books, loans, and fines. If migration fails, startup fails visibly. Database access now uses a pool, with one connection per transaction.

From the repository root:

```text
npm install
npm --prefix server install
npm start
```

Run the frontend in another terminal with `npm run dev`. For a production frontend build, set `VITE_API_URL` to the reachable backend URL before `npm run build`; otherwise it defaults to localhost:5000. The frontend build and API still require their respective hosting configuration. No university deployment was performed.

## Verification

```text
npm --prefix server test
```

This runs 16 tests covering CSV headings/encoding/quoting/limits, student identity, book validation, policy rates, date boundaries, safe CSV serialization, clearance templates, one-page clearance PDF integrity, production configuration, and administrator bootstrapping.

For integration tests, start a disposable LOCAL MySQL/MariaDB instance and set `TEST_DB_PORT` (and `TEST_DB_PASSWORD` if required), then run:

```text
npm --prefix server run test:integration
```

The integration suite connects only to 127.0.0.1 using the test port, creates a uniquely named `library_module_test_...` database, and drops only that database afterward. It does not use production credentials from `server/.env`. Without TEST_DB_PORT it explicitly skips. KEEP_TEST_DB=1 is available for a local browser fixture and retains synthetic data plus a test-only administrator.

Verified against an isolated MariaDB 10.4 instance: 55 tests passed including the parent suite. Tests include schema migration, one-by-one additions, import preview/confirmation/re-import, conflict preservation, failure rollback, simultaneous issuing/returning, a 300-student import, search/pagination, overdue reconciliation, fine resolution, 90-day fine trash snapshots and expiry, immutable student-clearance issuance/verification/revocation, administrator accounts, authenticated backups, and signed-out API rejection. Exact production MySQL version and existing production constraints still require staging verification.

Chrome browser checks passed for login, Add/Edit/View Student, CSV preview and confirmed import, Add Book, issuing, availability/history, returning, clearance eligibility/issuance/history/public verification, template settings, and mobile dialog layout. No uncaught browser errors were observed. Production Vite build and backend syntax checks passed. The existing large-bundle warning remains. See [CLEARANCE_MODULE.md](CLEARANCE_MODULE.md) for the clearance workflow and deployment configuration.

## Release boundary

These student and book workflows are implemented and tested. Business APIs are authenticated and a data-only SQL backup is available. The application is **not yet cleared for public university deployment** until production secrets are rotated, a restore drill succeeds, deployment/CORS/HTTPS are configured, and the university decides whether it needs roles, payment tracking, 2FA, and automatic reminder history. See DEPLOYMENT_REVIEW.md.
