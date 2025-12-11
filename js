// server.js
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Create DB file if not present
const DB_PATH = path.join(__dirname, 'nutrition.db');

// Middleware
app.use(express.json({limit: '100kb'})); // small payloads
app.use(express.urlencoded({extended: false}));

// Serve frontend static files (index.html + images)
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to DB:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite DB at', DB_PATH);
});

// Create table if not exists (safe columns only, no PII beyond optional name)
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      deficiency TEXT NOT NULL,
      age_range TEXT,
      diet_pref TEXT,
      timestamp TEXT NOT NULL
    )
  `, (err) => {
    if (err) console.error('DB create table error:', err.message);
  });
});

// API: Accept a submission (non-sensitive, educational)
app.post('/api/submit', (req, res) => {
  try {
    const { name, deficiency, age, diet, timestamp } = req.body;

    // validate basic fields
    if (!deficiency) {
      return res.status(400).json({ error: 'Missing deficiency field.' });
    }

    // keep values simple and short
    const safeName = (typeof name === 'string' && name.length <= 100) ? name.trim() : null;
    const safeDef = String(deficiency).trim().slice(0, 50);
    const safeAge = (typeof age === 'string' && age.length <= 40) ? age : null;
    const safeDiet = (typeof diet === 'string' && diet.length <= 40) ? diet : null;
    const safeTimestamp = timestamp || new Date().toISOString();

    const sql = `INSERT INTO submissions (name, deficiency, age_range, diet_pref, timestamp) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [safeName, safeDef, safeAge, safeDiet, safeTimestamp], function(err) {
      if (err) {
        console.error('DB insert error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ message: 'Saved', id: this.lastID });
    });
  } catch (e) {
    console.error('Error handling submit:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// (Optional) Admin: list last 200 submissions (lightweight). For real app, add auth.
app.get('/api/submissions', (req, res) => {
  db.all(`SELECT id, name, deficiency, age_range as age, diet_pref as diet, timestamp FROM submissions ORDER BY id DESC LIMIT 200`, [], (err, rows) => {
    if (err) {
      console.error('DB fetch error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ submissions: rows });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} to view the app`);
});
