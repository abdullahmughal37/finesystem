# Railway deployment

This repository deploys as one Railway web service plus one private Railway MySQL service. The Docker image builds the React application and serves it from the Express API, so login, API calls, uploaded branding, and clearance verification use one HTTPS domain.

## Services

1. Create a Railway project from this GitHub repository.
2. Add a MySQL database to the same project and environment.
3. Keep MySQL Public Networking disabled. The application connects through Railway's private network.
4. Add a volume to the application service with mount path `/data`.
5. Generate a public domain for the application service after its first healthy deployment.

Railway detects the root `Dockerfile` and reads `railway.json`. The configured health check is `GET /health`.

## Application variables

Add these variables to the application service. If the database service is named `MySQL`, use Railway reference variables exactly as shown.

```text
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=<at-least-32-random-characters>
JWT_EXPIRE=7d
NODE_ENV=production
LIBRARY_TIMEZONE=Asia/Karachi
UPLOAD_DIR=/data/uploads
ADMIN_NAME=Library Administrator
ADMIN_EMAIL=<production-admin-email>
ADMIN_PASSWORD=<12-to-72-byte-temporary-bootstrap-password>
```

Railway supplies `PORT`; do not set it manually. `CORS_ORIGIN` is unnecessary while the browser and API use the same Railway domain. If a separate frontend is added later, set it to the exact allowed HTTPS origin. Several origins may be comma-separated.

On a new database, startup creates the first administrator from `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. If an administrator already exists, startup never changes a password. After the first successful login, remove the three `ADMIN_*` bootstrap variables and deploy that variable change; future startups use the administrator stored in MySQL.

## First deployment verification

1. Confirm the application deployment is Active and `/health` returns `{"status":"healthy"}`.
2. Open the generated HTTPS domain and sign in with the initial administrator.
3. Open Settings and save the university name, campus, address, logo, loan limit, issue period, fine rate, and reminder period.
4. In Settings → Clearance Letter, set **Verification website** to the generated HTTPS domain without `/verify`.
5. Upload the official logo and signature, then redeploy once to confirm they remain available from the attached volume.
6. Add one test student and one test book; issue, return, and verify the complete workflow.
7. Generate a clearance certificate for an eligible test student and scan/open its public QR verification link.
8. Download an authenticated backup and perform a restoration drill in a separate staging database before importing real records.

## Data protection

- Do not enable a public TCP proxy on the MySQL service for routine application use.
- Store every secret as a Railway service variable. Never place values in GitHub, `VITE_*` variables, screenshots, or support tickets.
- Enable Railway database backups before importing university data and document who owns restore operations.
- Keep the application at one replica while it uses a Railway volume for uploaded branding.
- The application SQL download is a data export and does not replace managed database backups.

## Deploying updates

The Railway service tracks the GitHub `main` branch. A pushed commit creates a new deployment. Railway checks `/health` before routing traffic to it, and the previous deployment remains available during the configured drain period.

If a deployment fails, inspect the build and deployment logs first. Startup intentionally fails when database settings, `JWT_SECRET`, or first-admin bootstrap values are invalid, preventing an apparently healthy service with unusable authentication.

Before pushing a deployment change, run `npm run build`, `npm --prefix server test`, and `npm --prefix server run test:production` from the repository root.
