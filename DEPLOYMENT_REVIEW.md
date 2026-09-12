# University deployment review

Reviewed: 11 September 2026. Scope: the current working tree, including existing uncommitted changes.

Update, 12 September 2026: student imports/forms and book circulation have since been changed and tested. See MODULE_SETUP.md for the implemented behavior and verification. Findings below describe the original review snapshot, not the completion status of every current file.

Further update, 12 September 2026: configurable catalog layouts, administrator account management, central business-API authentication, authenticated exports/backups, a 90-day Fine Trash, accurate notification identifiers, and explicit reminder-email failures are implemented. The nonfunctional OTP toggle is no longer presented as an available feature.

Update, 13 September 2026: audited fine resolution and the student-clearance module are implemented. Clearance uses live obligations, immutable versioned PDFs, public QR verification, revocation history, and editable administrator templates. See [CLEARANCE_MODULE.md](CLEARANCE_MODULE.md). The current automated result is 14 unit tests and 55 isolated MariaDB integration tests passing; frontend and backend production dependency audits report zero known vulnerabilities.

## Current readiness

The system is suitable for controlled local and staging evaluation. It has not been deployed publicly.

| Area | Current status |
| --- | --- |
| Student and book setup | Implemented: configurable fields, drag/reorder, manual CRUD, layout-aware templates/imports/exports, validation, pagination, and duplicate/conflict reporting |
| Circulation | Implemented: one active loan per accession, server-side dates, configured issue period and maximum books per student, eligibility checks, concurrent locks, and atomic returns/fines |
| Fines | Implemented: automatic/manual type and reason, accurate reports, and a searchable Fine Trash. Removing any active fine stores a complete independent snapshot for 90 days, including its Accounts handoff state, before automatic purge |
| Login and API access | Implemented: bcrypt logins, multiple administrator accounts, session invalidation, login throttling, and authentication on all business routes |
| Branding and header | Implemented: settings logo on login/sidebar/admin avatar, removed global disabled search, and outside-click/Escape dismissal for notifications/admin menus |
| Backup | Data-only SQL and CSV downloads are authenticated and structurally valid; restoration into an initialized staging installation still needs a documented drill |
| Reminder email | Uses student email, rejects missing SMTP configuration, reports failed/skipped delivery, and requires login; scheduling, duplicate-send protection, and delivery history remain |
| Accounts/payment | “Sent to Accounts” records a handoff state. Payment, partial payment, waiver, receipt, and Accounts Office acknowledgment remain undefined |
| Permissions | Every created login currently has full administrator access. Add roles only if the university needs separate administrator, librarian, and accounts permissions |
| Production operations | Still required: rotate exposed/placeholder secrets, configure HTTPS/CORS/SMTP and managed MySQL, rehearse restore/restart, and add monitoring/log retention |

The recommended first AI feature for the admin side is an **Overdue Follow-up Assistant** in Reminder Emails. Deterministic code should select the correct overdue records and calculate dates/fines; AI should only rank follow-up urgency and draft concise English/Urdu messages for administrator review. Store the approved draft, recipient, underlying issue ID, sender, send result, and timestamp so the same overdue event is not emailed repeatedly. Keep issuing, returning, fines, and waivers rule-based.

**Recommendation: fix the access-control, circulation-integrity, data-retention, and backup defects before using this system with real university records.** The application has the main screens and backend operations, but several normal library scenarios currently produce incorrect or misleading results.

This review changes no application code or live records. Evidence comes from source inspection, a production build, backend syntax checks, and isolated execution of real Express route handlers against synthetic database responses. It is not a live MySQL, browser, network-security, load, or disaster-recovery certification.

## Project map

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, React Router | Login, dashboard, students, books, issue/return, fines, reminders, reports, settings |
| API | Node.js and Express | CRUD, CSV imports, circulation rules, exports, email requests |
| Storage | MySQL through mysql2 | `students`, `books`, `issues`, `fines`, `admins`, `settings` |
| Authentication | bcrypt passwords, JWT sessions, and database-backed token version checks | Login and all business routes require a valid administrator session; public access is limited to login, branding settings, and logo files |
| Files and email | Local uploads, CSV, ExcelJS, Nodemailer | Logo/import storage, exports, manual overdue-email sending |

The normal workflow is: register/import student and book records, identify a student and accession number, create an issue, return the issue, generate an overdue fine if necessary, and review/export fines. There is one book row per unique accession number and no separate copy-quantity model. This review assumes an accession identifies one physical copy; if the university uses a different convention, availability needs an explicit inventory model.

The active CSV workflows are inside Students and Books. `StudentImport.tsx` is an unconnected sample-data screen, and `FinedStudents.tsx` is also absent from the current router. Their existence should not be treated as evidence of complete production features.

## Deployment blockers

### 1. Business API operations do not require authentication — Critical

**Use case:** Someone who can reach the API reads student contact information, changes fine policy, exports records, or calls the delete-all endpoint without signing in.

**Evidence:** `server/server.js:11` mounts the routes without authentication. `server/middleware/auth.js:4` defines JWT verification but is never imported by the application routes. `server/routes/backup.js:58` exposes delete-all. The frontend mostly makes requests without an Authorization header, while `src/app/routes.tsx:17` only checks that a local-storage token exists. Isolated issue requests without Authorization returned HTTP 200.

**Fix:** Enforce authentication centrally and add permissions for librarian, administrator, and accounts operations. Keep only login and a deliberately limited public branding endpoint public. Use one authenticated frontend request/download mechanism, handle expired sessions, and restrict destructive operations separately. Adding middleware alone will break the current unauthenticated fetches and download links, so update both sides together.

**Acceptance:** Missing, malformed, and expired credentials fail before any database operation. A librarian cannot change security settings or erase records. Authorized exports still work.

### 2. One physical copy can be issued to multiple students — High

**Use case:** Ali borrows accession ACC-001. Sara later borrows that same accession while Ali still has it. Both issues succeed.

**Evidence:** `server/routes/issueBook.js:65` checks whether the same student already has the same book, rather than whether anyone has that copy. The lookup calculates `activeIssues`, but the issue screen does not enforce availability. Reproduced with two sequential requests and different students.

**Fix:** Check and reserve the physical copy within a transaction. Add a database invariant preventing more than one active loan per copy. Show availability and the selected accession clearly before confirmation.

**Acceptance:** A second loan for the same copy is rejected until the first loan is returned, including simultaneous requests from two desks.

### 3. Simultaneous requests can exceed borrowing limits — High

**Use case:** A student has two books and the limit is three. Two library desks issue different books at the same time; both check the count before either insertion completes.

**Evidence:** The count and insert in `server/routes/issueBook.js:61` are separate operations without a transaction or lock. Reproduced: both requests succeeded and the student ended with four active loans.

**Fix:** Use a connection pool, acquire one connection per transaction, and lock the borrower and copy consistently before checking limits. Disable repeat submission in the interface and support safe retries on the server.

**Acceptance:** Concurrent issues never exceed the configured limit; retrying the same operation does not create an additional loan.

### 4. Deleting records can erase borrowing and fine history — High

**Use case:** A librarian removes a graduated student's record while books or fines remain outstanding. Those obligations and their history disappear under the supplied schema. Deleting a book also deletes its loan history.

**Evidence:** Direct deletes are in `server/controllers/studentController.js:27` and `server/routes/books.js:69`. `server/db.js:51` cascades student/book deletion into issues, and `server/db.js:67` cascades student deletion into fines. The live database's exact constraints were not inspected.

**Fix:** Archive students and books, block removal with outstanding obligations, and retain immutable circulation and fine history. Record who performed each change. Disable or tightly restrict delete-all in production.

**Acceptance:** A student with an active loan cannot be removed; archiving a borrower preserves all historical reports and fine records.

### 5. A returned book can lose its fine permanently — High

**Use case:** An overdue return updates the loan successfully, then the fine insertion fails. The book is now returned, but the fine does not exist. Retrying reports that the book is already returned.

**Evidence:** `server/routes/returnBook.js:73` updates the loan before the insert at line 78 without a transaction. Reproduced by injecting a fine-insert error: first response 500, loan remained returned, retry response 400.

**Fix:** Commit the return and fine together, or roll both back. Enforce uniqueness of the automatic return fine and make retries report the existing result safely.

**Acceptance:** An injected failure cannot leave a return without its required fine. A repeated request cannot charge twice.

### 6. The SQL download is not a reliable recovery backup — High

**Use case:** A university server fails and the staff try to recover from the downloaded SQL file. The file lacks schema, administrator accounts, settings, and uploaded assets; date values are not serialized in MySQL date format. Failed table reads can silently produce an incomplete file labeled as successful.

**Evidence:** `server/routes/backup.js:6` exports four tables only; line 18 ignores query errors; line 25 applies `String()` to dates and other values. No consistent snapshot or restore process is supplied. Reproduced a 200 response with omitted failed tables and JavaScript date text. `server/scripts/init-schema.sql:1` also begins with destructive DROP statements, making it unsuitable as an ordinary upgrade script.

**Fix:** Use a proper database backup mechanism with a consistent snapshot, include configuration and required assets securely, fail visibly on errors, keep backups outside the application server, and document restoration. Use versioned, nondestructive migrations for upgrades.

**Acceptance:** Restore a backup onto an empty staging installation and reconcile counts, loan dates, fines, settings, and login access. Run this exercise before launch.

## Functional and operational issues

### 7. Policy settings disagree with actual issuance and fines — High

**Use case:** The librarian changes the loan period to seven days and fine rate to PKR 20/day. The issue screen still sends a 15-day due date; overdue reports still calculate PKR 10/day. Setting a zero fine rate still charges PKR 10/day.

**Evidence:** `src/app/components/pages/IssueBook.tsx:20` fixes the period at 15 days, which `server/routes/issueBook.js:69` accepts in preference to settings. `server/routes/reports.js:30` multiplies by 10. `server/routes/returnBook.js:8` uses `parseInt(value) || 10`, replacing zero and truncating decimals. The return screen's rate explanation is also fixed at 10. The due-date override and zero-rate behavior were reproduced.

**Fix:** Calculate authoritative dates and charges on the backend using validated settings and return the applied policy to the UI. Preserve valid zero values. Agree whether policy changes affect existing loans, and store the applicable rate/version if required.

**Acceptance:** A seven-day policy produces a seven-day loan. All screens and exports agree for zero, integer, and permitted decimal rates.

### 8. Student eligibility and clearance rules are not enforced — High

**Use case:** A suspended student, a graduate, or a borrower with unpaid fines receives another book. The return page explicitly says fines must be cleared before new issuance.

**Evidence:** `server/routes/issueBook.js:51` retrieves only the student's ID and performs no status or fine-clearance check. Students support status values, but the current student edit form does not offer a status selector. No payment/clearance lifecycle exists in the fines schema.

**Fix:** Agree the university's exact eligibility rules, implement them on the server, and provide a supported status-management and clearance workflow. Log authorized overrides.

**Acceptance:** Ineligible borrowers receive a clear explanation; authorized clearance restores eligibility without deleting their history.

### 9. Sending to accounts is a status change, and “Collected” is misleading — High

**Use case:** A librarian clicks Send to Account Office and assumes accounts received the fines. No delivery occurs, yet the reports count the marked amount as collected money.

**Evidence:** `server/routes/fines.js:70` only updates all eligible fine rows. There is no email, recipient, integration, delivery acknowledgment, or batch record in this operation. `server/routes/reports.js:69` counts `status='sent'` as `collectedFines`, displayed as Collected in Reports. The status-only operation was reproduced.

**Fix:** Decide whether handoff is an actual electronic delivery or a recorded manual handoff. Name it accurately, track the exact batch and result, and keep delivery status separate from unpaid, partially paid, paid, and waived states. Record receipts or accounts references for clearance.

**Acceptance:** A failed delivery is not marked sent. An unpaid sent fine never increases collected revenue.

### 10. Manual fine reasons and types are lost — High

**Use case:** Staff charge PKR 500 for a damaged book. The student later disputes it, but the system shows Auto / Overdue 0 days. The Manual filter cannot find it.

**Evidence:** `src/app/components/pages/Fines.tsx:24` submits a reason, but `server/routes/fines.js:35` does not read or persist it. The schema has no reason/type fields, and the fine list hardcodes Auto. Negative amounts are accepted by the API despite the UI's minimum-value check. Both reason loss and a negative insertion were reproduced.

**Fix:** Persist fine type, reason, creator, related loan/copy, amount, and adjustment history. Validate amounts and referenced books on the server. Preserve the original charge when correcting it.

**Acceptance:** A damaged-book fine retains its reason in the list, filters, dashboard, and accounts export. Negative charges are rejected unless handled by an explicit adjustment workflow.

### 11. Email reminders use phone numbers and hide failures — High if reminders are required at launch

**Use case:** Students are imported with normal contact numbers. Staff send reminders, but the backend uses those numbers as email recipients. Missing SMTP configuration and failed messages do not produce a useful failure report.

**Evidence:** `server/routes/reminders.js:8` and line 22 alias `contact_no` as email. Students have no separate email field. Send failures are swallowed; missing SMTP returns `success: true, count: 0`, which was reproduced. `reminderDays` is saved but never used, and no automatic reminder scheduler or delivery log exists.

**Fix:** Store and validate email separately; add bounded sending, per-recipient results, duplicate prevention, and delivery history. Implement the agreed reminder timing or remove the unused setting. Test delivery only with approved test recipients.

**Acceptance:** Phone numbers cannot be used as email addresses; configuration errors are visible; repeated runs do not repeatedly email the same overdue event.

### 12. Dashboard statistics contain sample data and incorrect labels — High for management reporting

**Use case:** The librarian gives management the monthly report, but the dashboard still shows fixed January–March values regardless of actual activity. An overdue book that has not been returned may not appear in the Overdue Books card.

**Evidence:** `src/app/components/pages/Dashboard.tsx:33` supplies fixed chart values. Line 29 labels the count of students with unsent fines as Overdue Books. Fines arise on return, so this is not an active-overdue count. Reports labels total fines as Year while the backend sum has no year filter. Manual fine chart totals are fixed to zero.

**Fix:** Define every metric, query real records, apply explicit date ranges and academic-year settings, and reconcile dashboard, reports, and exports against the same definitions.

**Acceptance:** A seeded staging dataset produces exact expected totals, including overdue-but-unreturned books and manual fines.

### 13. Two-factor authentication is a nonfunctional setting; credential handling needs correction — High

**Use case:** An administrator enables email OTP and believes the account has extra protection. Login still returns a token immediately after password verification. Re-running the admin seed also resets its password to a fixed value.

**Evidence:** `server/routes/auth.js` has no OTP challenge; the 2FA fields are only stored. `server/scripts/seed-admin.js:29` resets the existing password on a duplicate account. `git ls-files server/.env` confirms that the environment file is tracked, and `.gitignore` only ignores node_modules. No secret values are reproduced here.

**Fix:** Implement and test 2FA or remove the misleading control. Require a unique initial administrator password and do not overwrite existing credentials during seeding. Stop tracking environment secrets; rotate any real credentials that have been shared through repository history. Add supported password/account administration.

**Acceptance:** Enabling 2FA requires successful second-factor verification before a session is granted. Re-running setup cannot reset an established administrator password.

### 14. CSV imports can overwrite valuable existing data silently — Medium/High

**Use case:** Staff import a new semester list containing only names and registration numbers. Matching existing records have contact details and other fields overwritten with blanks, and omitted student status becomes Active. Malformed rows are skipped without an itemized result.

**Evidence:** `server/routes/importStudents.js:19` defaults omitted values and line 38 updates duplicates. Books imports follow the same pattern. Uploads have no configured file/row limit and accumulate the whole CSV in memory. Parser/read errors do not have explicit handlers.

**Fix:** Add a real preview, distinguish omitted from intentionally cleared fields, choose a duplicate policy, and report inserted/updated/rejected rows. Validate identifiers and numbers, limit upload size and rows, process bounded batches, and clean up files on every outcome. Keep temporary imports separate from publicly served assets.

**Acceptance:** Importing a minimal update preserves contact information and suspended status. An oversized or malformed file fails safely with a useful report.

### 15. Network/database failures can look like an empty library — Medium/High

**Use case:** MySQL or the network becomes unavailable. The interface shows zero totals, No active books, or No overdue books instead of explaining that data could not be loaded.

**Evidence:** Several pages convert failed responses into empty arrays without checking `res.ok`, including `ReturnBook.tsx:37`, `ReminderEmails.tsx:14`, and `IssuedStudents.tsx:10`. Students/Books mutations often lack user-visible error handling. Dashboard and analytics also try to respond independently from multiple query callbacks, which needs a single error-response path.

**Fix:** Use shared request/error handling, distinguish loading/empty/error states, support safe retries, and report successful mutations only after server confirmation. Aggregate backend queries through one controlled success/failure path.

**Acceptance:** Simulated HTTP 500 and network loss show an error, never a clean empty result or a successful clearance.

### 16. Production startup and database operations are incomplete — High before hosting

**Use case:** IT builds on one machine and opens the app on another. API calls go to that second machine's localhost unless the correct API address was supplied at build time. Running root `npm start` references a nonexistent root `server.js`.

**Evidence:** `src/config.ts:3` defaults to localhost; `package.json:10` runs `node server.js`, which does not exist at the root. The backend has a separate start script, and it does not serve the frontend build. `server/db.js:4` uses one persistent connection; startup listens without waiting for schema readiness and has no application-level reconnect/pool strategy. Schema creation errors can merely be logged and ignored.

**Fix:** Document frontend hosting, API hosting, HTTPS/reverse-proxy setup, SPA route fallback, build-time API configuration, database permissions, environment validation, readiness checks, process restart, logging, and backup ownership. Use migrations and a tested pool/recovery strategy. Verify strict SQL mode and actual existing-schema compatibility on staging.

**Acceptance:** A clean installation works from a second university computer, survives a database restart, and restores service after a machine reboot. Missing required configuration prevents a misleading healthy startup.

### 17. Date-only operations mix UTC, local time, and database time — Medium

**Use case:** Staff issue a book at 00:30 Pakistan time. `toISOString().split('T')[0]` uses the previous UTC calendar day. Differing API/database timezones can also make the return screen and overdue reports disagree.

**Evidence:** `src/app/components/pages/IssueBook.tsx:18` derives dates using UTC; return calculations use JavaScript elapsed milliseconds while SQL reports use `CURDATE()`/`DATEDIFF`. This boundary was identified in source; deployment timezone behavior was not tested.

**Fix:** Define the library business timezone, handle loan dates as date-only values consistently, and make calendar-day fine rules explicit.

**Acceptance:** Test just before/after midnight, due-date boundaries, month/year changes, and the configured server/database timezone combination.

### 18. Search, exports, and larger datasets need completion — Medium

**Use case:** Two students share a name or several copies share a title. Search selects only the latest matching row. Large student lists load and render in full, and exports may misrepresent fields.

**Evidence:** `server/routes/issueBook.js:5` and line 23 use partial-name/title matching with `LIMIT 1`; changing the search input does not clear the previously verified selection. Student lists are unpaginated and book pagination happens after loading all rows. `server/routes/fines.js:62` labels a column Book Accession but writes the title without consistent CSV escaping. Notification UI expects `rollNo` while the API returns `registration_no`. The Students eye button has no action.

**Fix:** Prefer exact identifier matches and offer a selection list for ambiguous text; invalidate verification when inputs change. Add server-side filtering/pagination. Use one CSV serializer with appropriate spreadsheet-formula protection, correct field mappings, and complete/remove inactive controls. Load-test against expected university record counts.

**Acceptance:** Same-name students and same-title copies can be distinguished, CSV values containing commas/quotes/newlines retain their columns, and large lists remain responsive.

## Validation completed

- Production Vite build passed, using a separate temporary output directory. It reported a 792.58 kB JavaScript chunk (225.41 kB gzip), so route-level code splitting is a useful later improvement.
- `node --check` passed for all 21 backend JavaScript files.
- Ten observations were verified with real route handlers, synthetic database responses, and local HTTP requests: unauthenticated duplicate-copy issuance, ignored configured loan period, absence of eligibility queries, concurrent borrowing-limit breach, failed-return partial update, zero-rate fallback, negative/reasonless manual fine, status-only accounts handoff, incomplete/date-invalid backup output, and success response with missing SMTP.
- No live database was loaded by the test harness, no real email was sent, and no destructive endpoint was called against real data.
- No maintained business-test suite or TypeScript-check script is configured. Backend `npm test` is a placeholder. A successful Vite build does not validate database queries or complete workflows.

## Suggested implementation order

1. Protect data: authentication and permissions, secrets/setup credentials, destructive-operation restrictions, verified recovery backups.
2. Make circulation reliable: copy availability, concurrent borrower limits, atomic return/fine creation, archival retention, eligibility rules.
3. Make financial and policy behavior consistent: authoritative policy calculations, fine reasons/types, payment and accounts handoff states, date handling.
4. Complete user-facing features: real reports, validated imports, email delivery results, unambiguous search, visible failure states.
5. Rehearse deployment: fresh staging database, representative records, two simultaneous librarian sessions, second-computer access, backup restoration, database restart, and expected-scale load checks.

Before implementation, confirm the university's rules for borrower categories, unpaid-fine blocks, holidays/grace periods, rate changes on existing loans, lost/damaged books, graduation clearance, renewal/reservation needs, accounts handoff, and record retention. These are policy decisions; missing optional workflows are not automatically defects unless required for launch.
