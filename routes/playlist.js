const express = require('express');
const router  = express.Router();
const { db, nextId } = require('../database/db');
const { requireLogin } = require('../middleware/auth');

// Áp dụng requireLogin cho mọi route trong file này
router.use(requireLogin);

// ── Helper: lấy playlist của user hiện tại ─────
function getUserPlaylists(userId) {
  return db.get('playlists').filter({ userId }).value() || [];
}

// ── Helper: lấy thông tin bài hát đầy đủ cho playlist ─
function hydrateSongs(songIds) {
  const allMusic = db.get('music').value() || [];
  return songIds
    .map(id => allMusic.find(s => s.id === id))
    .filter(Boolean); // bỏ qua bài đã bị xóa
}

// ═══════════════════════════════════════════════
// GET /playlists — Trang danh sách playlist
// ═══════════════════════════════════════════════
router.get('/', (req, res) => {
  const userId    = req.session.user.id;
  const playlists = getUserPlaylists(userId);
  const settings  = db.get('settings').value() || {};
  const allMusic  = db.get('music').value() || [];

  // Gắn thông tin bài hát vào từng playlist để hiển thị
  const enriched = playlists.map(pl => ({
    ...pl,
    songs:     hydrateSongs(pl.songIds),
    coverImg:  hydrateSongs(pl.songIds).find(s => s.image)?.image || null
  }));

  res.render('playlists', {
    user: req.session.user,
    playlists: enriched,
    allMusic,
    settings,
    message: req.query.message || null
  });
});

// ═══════════════════════════════════════════════
// GET /playlists/:id — Chi tiết một playlist
// ═══════════════════════════════════════════════
router.get('/:id', (req, res) => {
  const userId = req.session.user.id;
  const plId   = parseInt(req.params.id);

  const playlist = db.get('playlists').find({ id: plId, userId }).value();
  if (!playlist) return res.redirect('/playlists?message=Playlist không tồn tại');

  const songs    = hydrateSongs(playlist.songIds);
  const allMusic = db.get('music').value() || [];
  const settings = db.get('settings').value() || {};

  // Các bài chưa có trong playlist (để gợi ý thêm)
  const notInPlaylist = allMusic.filter(s => !playlist.songIds.includes(s.id));

  res.render('playlist_detail', {
    user: req.session.user,
    playlist,
    songs,
    notInPlaylist,
    settings,
    message: req.query.message || null
  });
});

// ═══════════════════════════════════════════════
// POST /playlists/create — Tạo playlist mới
// ═══════════════════════════════════════════════
router.post('/create', (req, res) => {
  const { name } = req.body;
  const userId   = req.session.user.id;

  if (!name || !name.trim()) {
    return res.redirect('/playlists?message=Tên playlist không được để trống');
  }

  // Giới hạn 20 playlist / user
  const count = getUserPlaylists(userId).length;
  if (count >= 20) {
    return res.redirect('/playlists?message=Bạn chỉ được tạo tối đa 20 playlist');
  }

  const id = nextId('playlists');
  db.get('playlists').push({
    id,
    userId,
    name:      name.trim(),
    songIds:   [],
    createdAt: new Date().toISOString()
  }).write();

  res.redirect(`/playlists/${id}?message=Đã tạo playlist "${name.trim()}"!`);
});

// ═══════════════════════════════════════════════
// POST /playlists/:id/rename — Đổi tên playlist
// ═══════════════════════════════════════════════
router.post('/:id/rename', (req, res) => {
  const userId = req.session.user.id;
  const plId   = parseInt(req.params.id);
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.redirect(`/playlists/${plId}?message=Tên không được để trống`);
  }

  const playlist = db.get('playlists').find({ id: plId, userId }).value();
  if (!playlist) return res.redirect('/playlists');

  db.get('playlists').find({ id: plId }).assign({ name: name.trim() }).write();
  res.redirect(`/playlists/${plId}?message=Đã đổi tên thành công!`);
});

// ═══════════════════════════════════════════════
// POST /playlists/:id/delete — Xóa playlist
// ═══════════════════════════════════════════════
router.post('/:id/delete', (req, res) => {
  const userId = req.session.user.id;
  const plId   = parseInt(req.params.id);

  const playlist = db.get('playlists').find({ id: plId, userId }).value();
  if (playlist) {
    db.get('playlists').remove({ id: plId, userId }).write();
  }

  res.redirect('/playlists?message=Đã xóa playlist!');
});

// ═══════════════════════════════════════════════
// POST /playlists/:id/add-song — Thêm bài vào playlist
// ═══════════════════════════════════════════════
router.post('/:id/add-song', (req, res) => {
  const userId  = req.session.user.id;
  const plId    = parseInt(req.params.id);
  const songId  = parseInt(req.body.songId);
  const isAjax  = req.headers['x-requested-with'] === 'XMLHttpRequest';

  const playlist = db.get('playlists').find({ id: plId, userId }).value();
  if (!playlist) {
    if (isAjax) return res.json({ ok: false, message: 'Playlist không tồn tại' });
    return res.redirect('/playlists');
  }

  // Kiểm tra bài hát tồn tại
  const song = db.get('music').find({ id: songId }).value();
  if (!song) {
    if (isAjax) return res.json({ ok: false, message: 'Bài hát không tồn tại' });
    return res.redirect(`/playlists/${plId}`);
  }

  // Không thêm trùng
  if (playlist.songIds.includes(songId)) {
    if (isAjax) return res.json({ ok: false, message: 'Bài này đã có trong playlist' });
    return res.redirect(`/playlists/${plId}?message=Bài này đã có trong playlist`);
  }

  // Giới hạn 200 bài / playlist
  if (playlist.songIds.length >= 200) {
    if (isAjax) return res.json({ ok: false, message: 'Playlist đã đầy (tối đa 200 bài)' });
    return res.redirect(`/playlists/${plId}?message=Playlist đã đủ 200 bài`);
  }

  db.get('playlists').find({ id: plId }).get('songIds').push(songId).write();

  if (isAjax) return res.json({ ok: true, message: `Đã thêm "${song.title}" vào playlist` });
  res.redirect(`/playlists/${plId}?message=Đã thêm bài vào playlist!`);
});

// ═══════════════════════════════════════════════
// POST /playlists/:id/remove-song — Xóa bài khỏi playlist
// ═══════════════════════════════════════════════
router.post('/:id/remove-song', (req, res) => {
  const userId = req.session.user.id;
  const plId   = parseInt(req.params.id);
  const songId = parseInt(req.body.songId);
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

  const playlist = db.get('playlists').find({ id: plId, userId }).value();
  if (!playlist) {
    if (isAjax) return res.json({ ok: false, message: 'Không tìm thấy playlist' });
    return res.redirect('/playlists');
  }

  const newIds = playlist.songIds.filter(id => id !== songId);
  db.get('playlists').find({ id: plId }).assign({ songIds: newIds }).write();

  if (isAjax) return res.json({ ok: true });
  res.redirect(`/playlists/${plId}?message=Đã xóa bài khỏi playlist!`);
});

// ═══════════════════════════════════════════════
// POST /playlists/:id/reorder — Kéo thả sắp xếp thứ tự
// ═══════════════════════════════════════════════
router.post('/:id/reorder', (req, res) => {
  const userId  = req.session.user.id;
  const plId    = parseInt(req.params.id);
  const { songIds } = req.body; // mảng id mới từ client

  const playlist = db.get('playlists').find({ id: plId, userId }).value();
  if (!playlist) return res.json({ ok: false });

  // Chỉ cho phép các id đã có trong playlist
  const valid = songIds
    .map(id => parseInt(id))
    .filter(id => playlist.songIds.includes(id));

  db.get('playlists').find({ id: plId }).assign({ songIds: valid }).write();
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════
// GET /playlists/api/my — API lấy danh sách playlist (cho popup)
// ═══════════════════════════════════════════════
router.get('/api/my', (req, res) => {
  const userId    = req.session.user.id;
  const playlists = getUserPlaylists(userId).map(pl => ({
    id:    pl.id,
    name:  pl.name,
    count: pl.songIds.length
  }));
  res.json({ ok: true, playlists });
});

module.exports = router;
