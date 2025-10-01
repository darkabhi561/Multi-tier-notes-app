const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const DB_HOST = process.env.DB_HOST || 'notes-db';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || 'rootpassword';
const DB_NAME = process.env.DB_NAME || 'notesdb';

// Wait for MySQL startup
async function waitForDb(retries = 20, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASS });
      await conn.execute('SELECT 1');
      await conn.end();
      console.log('DB is available');
      return;
    } catch {
      console.log(`DB not ready, attempt ${i+1}/${retries}. Retrying...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to DB after retries');
}

let pool;
async function init() {
  await waitForDb(30, 2000); // wait up to ~60s
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  console.log('DB initialized');
}
init().catch(err => { console.error('Initialization failed:', err); process.exit(1); });

app.get('/notes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT text, created_at FROM notes ORDER BY id DESC');
    const combined = rows.map(r => `[${r.created_at}] ${r.text}`).join('\n\n');
    res.send(combined);
  } catch (e) {
    res.status(500).send('DB error');
  }
});

app.post('/notes', async (req, res) => {
  const note = (req.body && req.body.note) ? req.body.note.trim() : '';
  if (!note) return res.status(400).send('note required');
  try {
    await pool.query('INSERT INTO notes (text) VALUES (?)', [note]);
    res.status(201).send('ok');
  } catch {
    res.status(500).send('DB error');
  }
});

app.get('/health', (req, res) => res.send('ok'));

app.listen(3000, () => console.log('Backend listening on 3000'));
