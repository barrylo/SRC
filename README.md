# Daily Tasks

Simple daily tasks manager (Node + Express backend, static frontend).

Run:

```powershell
npm install
npm start
# then open http://localhost:3000
```

Docker:

```bash
docker build -t daily-tasks .
docker run --rm -p 3000:3000 -v "${PWD}/data:/app/data" daily-tasks
```

Compose:

```bash
docker compose up --build
```
