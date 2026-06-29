const low    = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Khởi tạo lowdb với file JSON
const adapter = new FileSync(path.join(__dirname, 'database.json'));
const db = low(adapter);

// Schema mặc định
db.defaults({
  users:     [],
  music:     [],
  playlists: [],   // { id, userId, name, songIds: [], createdAt }
  settings:  { id: 1, logo: null, banner: null, background: null, login_background: null },
  _autoId:   { users: 1, music: 1, playlists: 1 }
}).write();

// ── Helper tạo autoincrement ID ────────────────
function nextId(table) {
  const id = db.get(`_autoId.${table}`).value();
  db.set(`_autoId.${table}`, id + 1).write();
  return id;
}

// ── Tạo admin mặc định ─────────────────────────
(async () => {
  const existing = db.get('users').find({ username: 'admin' }).value();
  if (!existing) {
    const hashed = await bcrypt.hash('admin123', 10);
    db.get('users').push({
      id: nextId('users'),
      username: 'admin',
      password: hashed,
      role: 'admin'
    }).write();
    console.log('[DB] Đã tạo tài khoản admin mặc định (admin/admin123)');
  }
})();

module.exports = { db, nextId };
