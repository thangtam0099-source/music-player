const express = require('express');
const router  = express.Router();
const { db }  = require('../database/db');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
  const { q, sort } = req.query;
  let songs = db.get('music').value() || [];

  // Tìm kiếm
  if (q && q.trim()) {
    const kw = q.trim().toLowerCase();
    songs = songs.filter(s =>
      s.title.toLowerCase().includes(kw) ||
      s.artist.toLowerCase().includes(kw)
    );
  }

  // Sắp xếp
  if (sort === 'az') {
    songs = [...songs].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
  } else {
    songs = [...songs].sort((a, b) => b.id - a.id); // mới nhất = id cao nhất
  }

  const settings = db.get('settings').value() || {};
  res.render('home', { user: req.session.user, songs, settings, q: q || '', sort: sort || 'newest' });
});

module.exports = router;
