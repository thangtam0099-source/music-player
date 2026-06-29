const express = require('express');
const router  = express.Router();
const { db, parseSongIds } = require('../database/db');
const { requireLogin }     = require('../middleware/auth');

router.use(requireLogin);

async function getSettings() {
  const { rows } = await db.execute('SELECT * FROM settings WHERE id = 1');
  return rows[0] || {};
}

// Lấy bài hát đầy đủ từ danh sách id
async function hydrateSongs(songIds) {
  if (!songIds.length) return [];
  const { rows } = await db.execute('SELECT * FROM music');
  return songIds.map(id => rows.find(s => Number(s.id) === id)).filter(Boolean);
}

// ── GET /playlists ──────────────────────────────
router.get('/', async (req, res) => {
  const userId = req.session.user.id;
  const { rows: playlists } = await db.execute(
    'SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC', [userId]
  );
  const { rows: allMusic } = await db.execute('SELECT * FROM music');
  const settings = await getSettings();

  const enriched = await Promise.all(playlists.map(async pl => {
    const ids   = parseSongIds(pl.song_ids);
    const songs = ids.map(id => allMusic.find(s => Number(s.id) === id)).filter(Boolean);
    return { ...pl, songIds: ids, songs, coverImg: songs.find(s => s.image)?.image || null };
  }));

  res.render('playlists', {
    user: req.session.user, playlists: enriched,
    allMusic, settings, message: req.query.message || null
  });
});

// ── GET /playlists/api/my ───────────────────────
router.get('/api/my', async (req, res) => {
  const { rows } = await db.execute(
    'SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC',
    [req.session.user.id]
  );
  const playlists = rows.map(pl => ({
    id: Number(pl.id), name: pl.name,
    count: parseSongIds(pl.song_ids).length
  }));
  res.json({ ok: true, playlists });
});

// ── GET /playlists/:id ──────────────────────────
router.get('/:id', async (req, res) => {
  const userId = req.session.user.id;
  const { rows } = await db.execute(
    'SELECT * FROM playlists WHERE id = ? AND user_id = ?', [req.params.id, userId]
  );
  const playlist = rows[0];
  if (!playlist) return res.redirect('/playlists?message=Playlist không tồn tại');

  const songIds = parseSongIds(playlist.song_ids);
  const songs   = await hydrateSongs(songIds);
  const { rows: allMusic } = await db.execute('SELECT * FROM music');
  const notInPlaylist = allMusic.filter(s => !songIds.includes(Number(s.id)));
  const settings = await getSettings();

  res.render('playlist_detail', {
    user: req.session.user,
    playlist: { ...playlist, songIds },
    songs, notInPlaylist, settings,
    message: req.query.message || null
  });
});

// ── POST /playlists/create ──────────────────────
router.post('/create', async (req, res) => {
  const { name } = req.body;
  const userId   = req.session.user.id;
  if (!name?.trim()) return res.redirect('/playlists?message=Tên playlist không được để trống');

  const { rows } = await db.execute(
    'SELECT COUNT(*) as c FROM playlists WHERE user_id = ?', [userId]
  );
  if (Number(rows[0].c) >= 20)
    return res.redirect('/playlists?message=Bạn chỉ được tạo tối đa 20 playlist');

  const result = await db.execute(
    'INSERT INTO playlists (user_id, name, song_ids) VALUES (?, ?, ?)',
    [userId, name.trim(), '[]']
  );
  res.redirect(`/playlists/${result.lastInsertRowid}?message=Đã tạo playlist "${name.trim()}"!`);
});

// ── POST /playlists/:id/rename ──────────────────
router.post('/:id/rename', async (req, res) => {
  const { name } = req.body;
  const userId   = req.session.user.id;
  if (!name?.trim()) return res.redirect(`/playlists/${req.params.id}?message=Tên không được để trống`);

  await db.execute(
    'UPDATE playlists SET name = ? WHERE id = ? AND user_id = ?',
    [name.trim(), req.params.id, userId]
  );
  res.redirect(`/playlists/${req.params.id}?message=Đã đổi tên thành công!`);
});

// ── POST /playlists/:id/delete ──────────────────
router.post('/:id/delete', async (req, res) => {
  await db.execute(
    'DELETE FROM playlists WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.user.id]
  );
  res.redirect('/playlists?message=Đã xóa playlist!');
});

// ── POST /playlists/:id/add-song ────────────────
router.post('/:id/add-song', async (req, res) => {
  const userId = req.session.user.id;
  const plId   = req.params.id;
  const songId = parseInt(req.body.songId);
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
  const fail   = (msg) => isAjax ? res.json({ ok: false, message: msg }) : res.redirect(`/playlists/${plId}?message=${msg}`);

  const { rows: plRows } = await db.execute(
    'SELECT * FROM playlists WHERE id = ? AND user_id = ?', [plId, userId]
  );
  const playlist = plRows[0];
  if (!playlist) return fail('Playlist không tồn tại');

  const { rows: songRows } = await db.execute('SELECT * FROM music WHERE id = ?', [songId]);
  if (!songRows[0]) return fail('Bài hát không tồn tại');

  const ids = parseSongIds(playlist.song_ids);
  if (ids.includes(songId)) return fail('Bài này đã có trong playlist');
  if (ids.length >= 200)    return fail('Playlist đã đủ 200 bài');

  ids.push(songId);
  await db.execute(
    'UPDATE playlists SET song_ids = ? WHERE id = ?', [JSON.stringify(ids), plId]
  );

  if (isAjax) return res.json({ ok: true, message: `Đã thêm "${songRows[0].title}" vào playlist` });
  res.redirect(`/playlists/${plId}?message=Đã thêm bài vào playlist!`);
});

// ── POST /playlists/:id/remove-song ────────────
router.post('/:id/remove-song', async (req, res) => {
  const userId = req.session.user.id;
  const plId   = req.params.id;
  const songId = parseInt(req.body.songId);
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

  const { rows } = await db.execute(
    'SELECT * FROM playlists WHERE id = ? AND user_id = ?', [plId, userId]
  );
  const playlist = rows[0];
  if (!playlist) {
    return isAjax ? res.json({ ok: false }) : res.redirect('/playlists');
  }

  const ids    = parseSongIds(playlist.song_ids).filter(id => id !== songId);
  await db.execute('UPDATE playlists SET song_ids = ? WHERE id = ?', [JSON.stringify(ids), plId]);

  if (isAjax) return res.json({ ok: true });
  res.redirect(`/playlists/${plId}?message=Đã xóa bài khỏi playlist!`);
});

// ── POST /playlists/:id/reorder ─────────────────
router.post('/:id/reorder', async (req, res) => {
  const userId  = req.session.user.id;
  const { songIds } = req.body;

  const { rows } = await db.execute(
    'SELECT * FROM playlists WHERE id = ? AND user_id = ?', [req.params.id, userId]
  );
  const playlist = rows[0];
  if (!playlist) return res.json({ ok: false });

  const current = parseSongIds(playlist.song_ids);
  const valid   = songIds.map(id => parseInt(id)).filter(id => current.includes(id));
  await db.execute(
    'UPDATE playlists SET song_ids = ? WHERE id = ?', [JSON.stringify(valid), req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
