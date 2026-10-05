# Level 2 Authentication — Start Here

## Read these documents

1. **IFT458_Level2_Student_Assignment.docx** — the current assignment, required evidence, code snapshots, and line-by-line explanations.
2. **IFT458_Non_Repudiation_and_Token_Verification.docx** — token verification, non-repudiation, and the JWT.io demonstration.
3. **IFT458_Guide_Swagger_and_OpenAPI.docx** — Swagger reference.
4. **DEBUGGING.md** (project root) — step through signup, login and token checking with 16 VS Code breakpoints, plus the JWT lab.

The Level 1 assignment and diagrams are included as background. Follow the Level 2 document for this assignment.

## What you need

- Node.js and npm. The included dependencies require Node.js 20.19.0 or newer.
- A running local MongoDB instance or your own MongoDB Atlas database.
- A browser and a Word-compatible document reader.
- Internet access to install dependencies. Tests may download a MongoDB test binary on first use.

## Setup

Extract the ZIP completely. Open a terminal in the extracted project folder (the folder containing package.json).

```bash
npm ci
```

Create your own `.env` file from the supplied template:

macOS / Linux:
```bash
cp config.env.example .env
```

Windows PowerShell:
```powershell
Copy-Item config.env.example .env
```

Edit `.env` before starting. The default DATABASE_URL setting uses MongoDB on your own computer. If using Atlas, replace the local DATABASE_URL line with the Atlas template and fill in your own values. Set STUDENT_NAME and STUDENT_ID for your assignment evidence. Only one settings file is needed; the application also supports config.env as a fallback.

Use a dedicated assignment database: `npm run seed` deletes its existing users and games before importing the supplied sample data.

```bash
npm run seed
npm start
```

Open **http://localhost:4001/api-docs**. Keep the server terminal open while working. Run checks from a second terminal in the project folder:

```bash
npm test
```

## First authentication check

1. With Swagger authorization cleared, request GET /api/v1/games. Expect **401 Unauthorized**.
2. Register and log in using the assignment instructions, or log in with the supplied local sample account `admin@ift458.test` / `password12345` after seeding.
3. Copy the login response token into Swagger's **Authorize** dialog. Enter the token alone; Swagger adds the Bearer prefix.
4. Retry GET /api/v1/games. Expect **200 OK**.
5. Use **Clear Swagger Data and Reload** to remove Swagger authorization and repeat the anonymous check.

For manual requests, send `Authorization: Bearer <token>`. See requests.http for examples. This project uses opaque session tokens, not JWTs; use only the public demonstration token for the JWT.io exercise in the separate guide.

The root image **Clear browser settings.png** is an illustrated guide to clearing localhost site data. Clearing Swagger data and clearing browser site data are separate operations.

## Your submission

Follow the deliverables and grading requirements in the Level 2 assignment document. Keep your own screenshots and logs as evidence. Do not submit .env, config.env, real passwords, or live bearer tokens.

## Package contents

Source code, package.json and package-lock.json, tests, sample data, Swagger documentation, request examples, assignment documents, diagrams, Dockerfile, and a configuration template are included. Dependencies, personal environment files, prior logs, and temporary working files are excluded. Install dependencies with npm ci and supply your own MongoDB connection settings.
