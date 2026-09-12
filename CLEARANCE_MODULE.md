# Student clearance module

Implemented and verified on 13 September 2026.

## Administrator workflow

Open **Clearance**, find a student by registration number or name, and select the exact result. The server performs a fresh eligibility check against the database. A student is ready only when there are no active book issues and no fines whose resolution is still pending.

For a blocked student, the page lists each issued book and unresolved fine. Staff can download a clearly marked **Pending Library Clearance Report**; it is not presented as a clearance certificate. After books are returned and fines are resolved, run the check again.

For an eligible student, choose a purpose and issue the letter. The server rechecks eligibility inside a database transaction, assigns a sequential reference such as `LIB-CLR-2026-000001`, and saves the exact PDF plus its SHA-256 integrity hash. The history table supports search, immutable PDF download, and revocation with a required reason. Revocation preserves the original document and audit record.

## Editable template

Open **Settings -> Clearance Letter** to edit the university name, campus, address, contact line, document title and body, footer, reference prefix, verification website, signatory details, font size, logo/signature visibility, and section order. Signature uploads accept PNG or JPEG files up to 2 MB. Saving creates a new template version; it cannot alter PDFs that were already issued.

The body and footer support placeholders including student name, registration number, father name, department, semester, status, email, contact number, purpose, date, reference, institution/signatory fields, and active custom student fields. Invalid placeholders, unsafe URLs, duplicate sections, and excessive lengths are rejected by the server.

Set **Verification website** to the public HTTPS address of the deployed frontend, without `/verify` at the end. The QR code opens `/verify/<reference>`. Verification is read-only, rate-limited, and does not require a login. It reports whether the record is valid or revoked and verifies that the stored PDF still matches its saved hash.

## Fine resolution and clearance rules

Active fines now have a separate resolution state: Pending, Paid, or Waived. Paying or waiving a fine requires an audit note; reopening it also requires a reason. Sending a fine to Accounts does not mark it paid and therefore does not clear the student. Removing a fine sends a complete snapshot, including its resolution history and Accounts status, to Fine Trash for 90 days.

## Data and recovery

The module adds `clearance_templates`, `clearance_sequences`, and `clearance_letters`. Issued records retain student, eligibility, template, administrator, PDF, hash, and revocation snapshots. Student deletion is blocked when clearance history exists. Authenticated SQL backups include the clearance tables and fine-resolution fields.

## Verification

- Production Vite build passed with Vite 6.4.3.
- 14 backend unit tests passed, including template validation and one-page A4 PDF/hash generation.
- 55 MariaDB integration tests passed, including eligibility, issue/download/verify, template immutability, revocation, fine reopening, pending reports, and Fine Trash snapshots.
- Administrator browser checks passed for blocked and eligible students, template editing, issuance, history, and public verification.
- Frontend and backend production dependency audits report zero known vulnerabilities.

Before real issuance, the university should approve the official wording and signatory, upload its production logo/signature, and set the public verification website. No production deployment or real student record was used during verification.
