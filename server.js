const express = require('express');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const JSON_FILE = path.join(DATA_DIR, 'tasks.json');
const DB_FILE = path.join(DATA_DIR, 'tasks.db');

/*const { initDatabase, backupDatabase, releaseLock } = require('./db');

const handleShutdown = async () => {
  console.log('Received termination signal. Executing safe shutdown sequence...');
  try {
    if (db) {
      persistDb();
      db.close();
    }
    await backupDatabase();
  } catch (error) {
    console.error('Database backup failed during shutdown:', error.message);
  } finally {
    await releaseLock();
    process.exit(0);
  }
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
*/

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let SQL;
let db;

function rowsFromStmt(stmt) {
  const rows = [];
  while (stmt.step()) {
    const obj = stmt.getAsObject();
    obj.done = !!obj.done;
    rows.push(obj);
  }
  stmt.free();
  return rows;
}

function persistDb() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function ensureSchemaColumns() {
  const res = db.exec('PRAGMA table_info(tasks)');
  const columns = res[0] && res[0].values ? res[0].values.map(row => row[1]) : [];
  if (!columns.includes('category')) {
    db.run('ALTER TABLE tasks ADD COLUMN category TEXT');
  }
  if (!columns.includes('priority')) {
    db.run('ALTER TABLE tasks ADD COLUMN priority TEXT');
  }
}

function ensureRentalSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS profiles (
    profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
    lastname TEXT NOT NULL,
    firstname TEXT NOT NULL,
    rental REAL NOT NULL DEFAULT 0,
    room TEXT,
    address TEXT,
    status TEXT,
    createdAt TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rental_line_items (
    rental_line_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    rental REAL NOT NULL DEFAULT 0,
    previous_month_elec_read INTEGER NOT NULL DEFAULT 0,
    current_month_elec_read INTEGER NOT NULL DEFAULT 0,
    electricity_fees REAL NOT NULL DEFAULT 0,
    water_fees REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY(profile_id) REFERENCES profiles(profile_id)
  )`);
}

function readTasks() {
  const stmt = db.prepare('SELECT id, title, due, category, priority, notes, done, createdAt FROM tasks ORDER BY done ASC, id ASC');
  return rowsFromStmt(stmt);
}

function readProfiles() {
  const stmt = db.prepare('SELECT profile_id, lastname, firstname, rental, room, address, status, createdAt FROM profiles ORDER BY lastname, firstname');
  return rowsFromStmt(stmt);
}

function readProfileLineItems(profileId) {
  const stmt = db.prepare('SELECT rental_line_item_id, profile_id, month, rental, previous_month_elec_read, current_month_elec_read, electricity_fees, water_fees, total FROM rental_line_items WHERE profile_id = ? ORDER BY month DESC');
  stmt.bind([profileId]);
  return rowsFromStmt(stmt);
}

// Migrate existing JSON file into SQLite if DB is empty
// Migration will be handled during async init below for sql.js

// API routes are registered in startServer so they attach to the running app

const PORT = process.env.PORT || 3000;
function startServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/tasks', (req, res) => {
    res.json(readTasks());
  });

  // Admin API: view DB contents
  app.get('/api/admin/tasks', (req, res) => {
    try {
      res.json(readTasks());
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/rental/profiles', (req, res) => {
    try {
      res.json(readProfiles());
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post('/api/rental/profiles', (req, res) => {
    const { lastname, firstname, rental, room, address, status } = req.body;
    if (!lastname || !firstname) return res.status(400).json({ error: 'Lastname and firstname are required' });
    const createdAt = new Date().toISOString();
    const insert = db.prepare('INSERT INTO profiles (lastname, firstname, rental, room, address, status, createdAt) VALUES (?,?,?,?,?,?,?)');
    insert.run([lastname.trim(), firstname.trim(), Number(rental) || 0, room || '', address || '', status || '', createdAt]);
    insert.free();
    const result = db.exec('SELECT last_insert_rowid() AS id');
    const id = result && result[0] && result[0].values && result[0].values[0] ? result[0].values[0][0] : null;
    const stmt = db.prepare('SELECT profile_id, lastname, firstname, rental, room, address, status, createdAt FROM profiles WHERE profile_id = ?');
    stmt.bind([id]);
    const items = rowsFromStmt(stmt);
    persistDb();
    res.status(201).json(items[0] || null);
  });

  app.get('/api/rental/profiles/:id/line-items', (req, res) => {
    try {
      const rows = readProfileLineItems(req.params.id);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.put('/api/rental/profiles/:profileId/line-items/:month', (req, res) => {
    const profileId = Number(req.params.profileId);
    const month = req.params.month;
    const { previousMonthElecRead, currentMonthElecRead, electricityFees, waterFees, total } = req.body;
    
    if (previousMonthElecRead === undefined || currentMonthElecRead === undefined) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    try {
      const stmt = db.prepare('SELECT * FROM rental_line_items WHERE profile_id = ? AND month = ?');
      stmt.bind([profileId, month]);
      const existing = rowsFromStmt(stmt);

      if (existing.length) {
        const update = db.prepare('UPDATE rental_line_items SET previous_month_elec_read = ?, current_month_elec_read = ?, electricity_fees = ?, water_fees = ?, total = ? WHERE profile_id = ? AND month = ?');
        update.run([previousMonthElecRead, currentMonthElecRead, electricityFees, waterFees, total, profileId, month]);
        update.free();
      } else {
        const insert = db.prepare('INSERT INTO rental_line_items (profile_id, month, rental, previous_month_elec_read, current_month_elec_read, electricity_fees, water_fees, total) VALUES (?,?,?,?,?,?,?,?)');
        const profile = readProfiles().find(p => p.profile_id === profileId);
        const rental = profile ? profile.rental : 0;
        insert.run([profileId, month, rental, previousMonthElecRead, currentMonthElecRead, electricityFees, waterFees, total]);
        insert.free();
      }
      persistDb();
      res.json({ success: true, message: 'Rental line item saved' });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete('/api/rental/line-items/:id', (req, res) => {
    const lineItemId = Number(req.params.id);
    if (!lineItemId) {
      return res.status(400).json({ error: 'Invalid line item id' });
    }

    try {
      const stmt = db.prepare('SELECT * FROM rental_line_items WHERE rental_line_item_id = ?');
      stmt.bind([lineItemId]);
      const rows = rowsFromStmt(stmt);
      if (!rows.length) {
        return res.status(404).json({ error: 'Line item not found' });
      }

      const del = db.prepare('DELETE FROM rental_line_items WHERE rental_line_item_id = ?');
      del.run([lineItemId]);
      del.free();
      persistDb();
      res.json({ success: true, deleted: rows[0] });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete('/api/rental/profiles/:id', (req, res) => {
    const profileId = Number(req.params.id);
    if (!profileId) {
      return res.status(400).json({ error: 'Invalid profile id' });
    }

    try {
      const stmt = db.prepare('SELECT * FROM profiles WHERE profile_id = ?');
      stmt.bind([profileId]);
      const rows = rowsFromStmt(stmt);
      if (!rows.length) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const delItems = db.prepare('DELETE FROM rental_line_items WHERE profile_id = ?');
      delItems.run([profileId]);
      delItems.free();

      const delProfile = db.prepare('DELETE FROM profiles WHERE profile_id = ?');
      delProfile.run([profileId]);
      delProfile.free();
      persistDb();
      res.json({ success: true, deleted: rows[0] });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Admin UI route (redirect to static file)
  app.get('/admin', (req, res) => res.redirect('/admin.html'));

  app.post('/api/tasks', (req, res) => {
    const { title, due, notes, category, priority } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    const allowedPriorities = ['high', 'medium', 'low'];
    const normalizedPriority = allowedPriorities.includes((priority || '').toLowerCase()) ? priority.toLowerCase() : 'medium';
    const createdAt = new Date().toISOString();
    const insert = db.prepare('INSERT INTO tasks (title, due, category, priority, notes, done, createdAt) VALUES (?,?,?,?,?,?,?)');
    insert.run([title.trim(), due || null, category || '', normalizedPriority, notes || '', 0, createdAt]);
    insert.free();
    const idRow = db.exec('SELECT last_insert_rowid() as id');
    const id = idRow && idRow[0] && idRow[0].values && idRow[0].values[0] ? idRow[0].values[0][0] : null;
    const stmt = db.prepare('SELECT id, title, due, category, priority, notes, done, createdAt FROM tasks WHERE id = ?');
    stmt.bind([id]);
    const tasks = rowsFromStmt(stmt);
    const task = tasks[0] || null;
    persistDb();
    res.status(201).json(task);
  });

  app.put('/api/tasks/:id', (req, res) => {
    const id = Number(req.params.id);
    const stmtSel = db.prepare('SELECT * FROM tasks WHERE id = ?');
    stmtSel.bind([id]);
    const rows = rowsFromStmt(stmtSel);
    const existing = rows[0];
    if (!existing) return res.sendStatus(404);
    const updated = { ...existing, ...req.body };
    const allowedPriorities = ['high', 'medium', 'low'];
    const normalizedPriority = allowedPriorities.includes((updated.priority || '').toLowerCase()) ? updated.priority.toLowerCase() : 'medium';
    const upd = db.prepare('UPDATE tasks SET title = ?, due = ?, category = ?, priority = ?, notes = ?, done = ? WHERE id = ?');
    upd.run([updated.title, updated.due || null, updated.category || '', normalizedPriority, updated.notes || '', updated.done ? 1 : 0, id]);
    upd.free();
    const stmt = db.prepare('SELECT id, title, due, category, priority, notes, done, createdAt FROM tasks WHERE id = ?');
    stmt.bind([id]);
    const task = rowsFromStmt(stmt)[0];
    persistDb();
    res.json(task);
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const id = Number(req.params.id);
    const stmtSel = db.prepare('SELECT id, title, due, category, priority, notes, done, createdAt FROM tasks WHERE id = ?');
    stmtSel.bind([id]);
    const rows = rowsFromStmt(stmtSel);
    const existing = rows[0];
    if (!existing) return res.sendStatus(404);
    const del = db.prepare('DELETE FROM tasks WHERE id = ?');
    del.run([id]);
    del.free();
    persistDb();
    res.json(existing);
  });

  // The other routes are already defined above and will use the `db` in scope

  app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
}

(async () => {
  try {
    await initDatabase();
    SQL = await initSqlJs();
    if (fs.existsSync(DB_FILE)) {
      const filebuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(filebuffer);
      ensureSchemaColumns();
      ensureRentalSchema();
    } else {
      db = new SQL.Database();
      db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, due TEXT, category TEXT, priority TEXT, notes TEXT, done INTEGER DEFAULT 0, createdAt TEXT)`);
      ensureRentalSchema();
      // migrate JSON if present
      if (fs.existsSync(JSON_FILE)) {
        try {
          const existing = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8') || '[]');
          const insert = db.prepare('INSERT INTO tasks (id, title, due, category, priority, notes, done, createdAt) VALUES (?,?,?,?,?,?,?,?)');
          for (const r of existing) {
            const allowedPriorities = ['high', 'medium', 'low'];
            const normalizedPriority = allowedPriorities.includes((r.priority || '').toLowerCase()) ? r.priority.toLowerCase() : 'medium';
            insert.run([r.id || null, r.title || '', r.due || null, r.category || '', normalizedPriority, r.notes || '', r.done ? 1 : 0, r.createdAt || new Date().toISOString()]);
          }
          insert.free();
        } catch (e) {
          console.error('JSON migration failed:', e);
        }
      }
      persistDb();
    }
    startServer();
  } catch (e) {
    console.error('DB init error:', e);
    process.exit(1);
  }
})();

