# Daily Tasks — Documentation

**Overview**
- **Project**: Simple daily tasks web app (Node + Express + static frontend).
- **Purpose**: Create, list, update, and delete daily tasks. Tasks are persisted in a local SQLite file (`data/tasks.db`) via `sql.js` and a small admin UI is provided at `/admin` for inspecting/exporting the DB.

**Quick Start (Windows)**
- Install Node.js LTS (if not already installed). Example using winget:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

- From the project root (`SRC`) install dependencies and start the server:

```powershell
cd C:\Users\barry\DOCKER-TUTORIAL\SRC
npm install
npm start
# Server listens at http://localhost:3000
```

**Files of interest**
- `server.js`: Express server, API endpoints, DB init & migration logic.
- `package.json`: scripts and dependencies.
- `public/index.html`, `public/app.js`, `public/styles.css`: frontend UI.
- `public/checkout.html`, `public/guest-checkout.html`, `public/guest-checkout.js`: guest checkout demo pages and toggle behavior.
- `public/temp-converter.html`, `public/temp-converter.js`: temperature converter UI with history.
- `prisma/schema.prisma`: Prisma schema defining the `Order` and `LineItem` models used by the checkout data model.
- `public/admin.html`, `public/admin.js`: admin UI for viewing/exporting DB contents.
- `flask_app/app.py`: Flask temperature converter API with history tracking.
- `flask_app/requirements.txt`: Flask and dependencies.
- `flask_app/tests/`: unit and API tests for the converter.
- `data/tasks.db`: SQLite database file (created/updated at runtime).
- `data/tasks.json`: legacy JSON file used for one-time migration (kept for reference).
- `DOCUMENTATION.md`: this file.

**API Endpoints**
- GET /api/tasks
  - Response: JSON array of tasks sorted by `done` then `id`.

- POST /api/tasks
  - Body (JSON): `{ "title": "Buy milk", "due": "2026-05-22", "notes": "2L" }`
  - Response: created task object (201)

- PUT /api/tasks/:id
  - Body (JSON): partial or full task fields to update, e.g. `{ "done": true }`
  - Response: updated task object

- DELETE /api/tasks/:id
  - Response: deleted task object

**Checkout Data Model**
- `Order`: stores each checkout order with `id` (UUID), nullable `userId` for guest checkout, `totalAmount`, `status`, and `createdAt`.
- `LineItem`: stores ordered items linked to `Order` via `orderId`, plus `productId`, `quantity`, `unitPrice`, and optional `totalPrice`.
- Relationship: each `Order` can have many `LineItem` records for itemized receipts.
- The Prisma schema lives in `prisma/schema.prisma` and supports the guest checkout flow and itemized order details.

**Admin UI**
- URL: `http://localhost:3000/admin`
- Features: refresh current DB rows, export JSON of all tasks.

**Examples (curl / PowerShell)**
- Get tasks (curl):

```bash
curl http://localhost:3000/api/tasks
```

- Create a task (curl):

```bash
curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" -d '{"title":"Test","due":"2026-05-22","notes":"from curl"}'
```

- Mark a task done (PowerShell example):

```powershell
# Replace $id with the numeric id returned by the POST response
$body = @{ done = $true } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/tasks/$id" -Body $body -ContentType 'application/json'
```

**Data persistence & migration**
- On startup the server initializes `sql.js` and attempts to load `data/tasks.db` if present.
- If `data/tasks.db` does not exist but `data/tasks.json` exists, the server migrates rows from the JSON file into the new SQLite DB and writes `data/tasks.db`.
- All changes (create/update/delete) persist to `data/tasks.db` (the app writes the serialized DB file after mutations).

**Security & production notes**
- This sample app includes no authentication — the admin page and API are open. For production, add authentication (e.g., JWT, session middleware) and restrict `/admin`.
- `sql.js` stores the DB as a local file. For multi-user or production systems, use a server-grade DB (Postgres, MySQL, or SQLite with a proper file lock strategy) or run under a single-process environment.

**Docker**
- A `Dockerfile` is included in the project root and exposes port `3000`.
- A `docker-compose.yml` file is also available to map `./data` into the container and restart the service automatically.
- Database persistence: Docker Compose mounts the named `daily_tasks_data` volume at `/app/data`, so `tasks.db` survives container recreation and image rebuilds. Do not remove this volume mapping when deploying.
- SnapDeploy persistence: attach a persistent volume to `/app/data` (or set `DATA_DIR` to the platform's persistent storage path). Container-local storage is ephemeral and will be lost when SnapDeploy replaces the container.

Run with Docker:

```bash
docker build -t daily-tasks .
docker run --rm -p 3000:3000 -v "${PWD}/data:/app/data" daily-tasks
```

Run with Docker Compose:

```bash
docker compose up --build
```

Back up the persistent database from PowerShell when using the local Compose volume:

```powershell
docker run --rm -v src_daily_tasks_data:/data -v "${PWD}\data:/backup" alpine cp /data/tasks.db /backup/tasks.db.backup
```

Then open: http://localhost:3000

Guest checkout demo pages:

- http://localhost:3000/checkout.html
- http://localhost:3000/guest-checkout.html

**Temperature Converter (Flask service)**

Demo page: http://localhost:3000/temp-converter.html

Features:
- Convert between Celsius (C), Fahrenheit (F), and Kelvin (K).
- Automatic history tracking: displays the 5 most recent conversions (newest first).
- Clear history button with confirmation.

Flask Converter API (port 5000):
- Health: `GET /ping` → returns `pong`
- Convert: `POST /convert` with JSON `{ "value": number, "from": "C|F|K", "to": "C|F|K" }` → returns `{ "value": convertedNumber }`
- History: `GET /history` → returns array of recent conversions (max 5 items)
- Clear history: `POST /history/clear` → clears all recorded conversions

Example conversions (PowerShell):

```powershell
# Convert 100°C to Fahrenheit
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/convert' -ContentType 'application/json' -Body '{"value":100,"from":"C","to":"F"}'

# Get history
Invoke-RestMethod -Method Get -Uri 'http://localhost:5000/history'

# Clear history
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/history/clear'
```

Each history entry includes: value, from/to units, result, and timestamp (ISO format).

Export the image to your Windows Desktop:

```powershell
docker build -t daily-tasks .
docker save daily-tasks:latest -o "$Env:USERPROFILE\Desktop\daily-tasks.tar"
```

If the file does not appear, ensure the Desktop folder exists or use `explorer.exe /select,"$Env:USERPROFILE\Desktop\daily-tasks.tar"` to open and highlight it.

Run with Docker Compose:

```bash
docker compose up --build
```

Then open: http://localhost:3000

**Troubleshooting**
- `npm` or `node` not found: ensure Node.js is installed and on PATH.
- `better-sqlite3` build errors: this project now uses `sql.js` (pure JS) to avoid native build steps. If you see native build errors, inspect `package.json` and ensure `sql.js` is installed.
- If `/admin` returns 404: open `/admin.html` directly or restart the server — the server redirects `/admin` → `/admin.html`.
- If the exported tarball is not visible on Desktop, verify the folder path and use:

```powershell
explorer.exe /select,"C:\Users\barry\Desktop\daily-tasks.tar"
```

**Next improvements (ideas)**
- Add authentication for admin routes.
- Add pagination/search to the admin UI.
- Add unit/integration tests and a CI pipeline.
- Replace `sql.js` with Postgres for multi-user deployments.

If you'd like, I can add a `Dockerfile`, CI config, or automated tests next — which would you prefer?
