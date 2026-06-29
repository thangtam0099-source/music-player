const express = require('express');
const router  = express.Router();
const { db }  = require('../database/db');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
  const { q, sort } = req.query;

  let sql    = 'SELECT * FROM music';
  let params = [];

  if (q && q.trim()) {
    sql   += ' WHERE (title LIKE ? OR artist LIKE ?)';
    params = [`%${q.trim()}%`, `%${q.trim()}%`];
  }

  sql += sort === 'az' ? ' ORDER BY title ASC' : ' ORDER BY created_at DESC';

  const { rows: songs }    = await db.execute(sql, params);
  const { rows: settingsR } = await db.execute('SELECT * FROM settings WHERE id = 1');
  const settings = settingsR[0] || {};

  res.render('home', {
    user: req.session.user,
    songs,
    settings,
    q:    q    || '',
    sort: sort || 'newest'
  });
});

module.exports = router;
