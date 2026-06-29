const express = require('express');
const router  = express.Router();
const { db, nextId }           = require('../database/db');
const { requireAdmin }         = require('../middleware/auth');
const { uploadSong, uploadImage } = require('../middleware/upload');
const { deleteFromCloudinary } = require('../config/cloudinary');

// Xóa file — giờ là xóa trên Cloudinary
function deleteFile(fileUrl) {
  if (!fileUrl) return;
  // Chỉ xóa nếu là URL Cloudinary (tránh lỗi khi URL là đường dẫn local cũ)
  if (fileUrl.includes('cloudinary.com')) {
    deleteFromCloudinary(fileUrl).catch(() => {});
  }
}

function getSettings() { return db.get('settings').value() || {}; }

function baseData(extra) {
  return {
    user: null, songs: [], editSong: null, settings: getSettings(),
    totalSongs: 0, totalUsers: 0, recentSongs: [], message: null, error: null,
    ...extra
  };
}

// ── GET /admin ──────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const songs  = db.get('music').value() || [];
  const users  = db.get('users').value() || [];
  const recent = [...songs].sort((a, b) => b.id - a.id).slice(0, 5);
  res.render('admin', baseData({
    user: req.session.user, page: 'dashboard',
    totalSongs: songs.length, totalUsers: users.length, recentSongs: recent
  }));
});

// ── GET /admin/songs ────────────────────────────────
router.get('/songs', requireAdmin, (req, res) => {
  const songs = [...(db.get('music').value() || [])].sort((a, b) => b.id - a.id);
  res.render('admin', baseData({
    user: req.session.user, page: 'songs', songs,
    message: req.query.message || null
  }));
});

// ── GET /admin/songs/edit/:id ───────────────────────
router.get('/songs/edit/:id', requireAdmin, (req, res) => {
  const id      = parseInt(req.params.id);
  const editSong = db.get('music').find({ id }).value();
  if (!editSong) return res.redirect('/admin/songs');
  const songs = [...(db.get('music').value() || [])].sort((a, b) => b.id - a.id);
  res.render('admin', baseData({ user: req.session.user, page: 'songs', songs, editSong }));
});

// ── POST /admin/songs/add ───────────────────────────
router.post('/songs/add', requireAdmin, (req, res, next) => {
  uploadSong(req, res, (err) => {
    if (err) return res.redirect('/admin/songs?message=Lỗi upload: ' + err.message);

    const { title, artist, album, description } = req.body;
    if (!title || !artist)
      return res.redirect('/admin/songs?message=Thiếu tên bài hoặc ca sĩ');

    const musicFile = req.files?.music_file?.[0];
    if (!musicFile)
      return res.redirect('/admin/songs?message=Vui lòng chọn file mp3');

    const imageFile = req.files?.image?.[0];

    // Lấy URL Cloudinary đã upload xong
    const musicUrl = musicFile.cloudinaryUrl;
    const imageUrl = imageFile?.cloudinaryUrl || null;

    db.get('music').push({
      id:          nextId('music'),
      title:       title.trim(),
      artist:      artist.trim(),
      album:       album?.trim()       || null,
      description: description?.trim() || null,
      image:       imageUrl,
      music_file:  musicUrl,
      created_at:  new Date().toISOString()
    }).write();

    res.redirect('/admin/songs?message=Đã thêm bài hát thành công!');
  });
});

// ── POST /admin/songs/edit/:id ──────────────────────
router.post('/songs/edit/:id', requireAdmin, (req, res) => {
  uploadSong(req, res, (err) => {
    if (err) return res.redirect(`/admin/songs?message=Lỗi: ${err.message}`);

    const id   = parseInt(req.params.id);
    const song = db.get('music').find({ id }).value();
    if (!song) return res.redirect('/admin/songs');

    const { title, artist, album, description } = req.body;
    const musicFile = req.files?.music_file?.[0];
    const imageFile = req.files?.image?.[0];

    // Nếu upload file mới → xóa file cũ trên Cloudinary
    let musicUrl = song.music_file;
    if (musicFile?.cloudinaryUrl) {
      deleteFile(song.music_file);
      musicUrl = musicFile.cloudinaryUrl;
    }

    let imageUrl = song.image;
    if (imageFile?.cloudinaryUrl) {
      deleteFile(song.image);
      imageUrl = imageFile.cloudinaryUrl;
    }

    db.get('music').find({ id }).assign({
      title:       title?.trim()       || song.title,
      artist:      artist?.trim()      || song.artist,
      album:       album?.trim()       || null,
      description: description?.trim() || null,
      image:       imageUrl,
      music_file:  musicUrl
    }).write();

    res.redirect('/admin/songs?message=Đã cập nhật bài hát!');
  });
});

// ── POST /admin/songs/delete/:id ────────────────────
router.post('/songs/delete/:id', requireAdmin, (req, res) => {
  const id   = parseInt(req.params.id);
  const song = db.get('music').find({ id }).value();
  if (song) {
    deleteFile(song.music_file);
    deleteFile(song.image);
    db.get('music').remove({ id }).write();
  }
  res.redirect('/admin/songs?message=Đã xóa bài hát!');
});

// ── GET /admin/settings ─────────────────────────────
router.get('/settings', requireAdmin, (req, res) => {
  res.render('admin', baseData({
    user: req.session.user, page: 'settings',
    message: req.query.message || null
  }));
});

// ── POST /admin/settings/upload/:type ───────────────
router.post('/settings/upload/:type', requireAdmin, (req, res, next) => {
  const { type } = req.params;
  const allowed  = ['logo', 'banner', 'background', 'login_background'];
  if (!allowed.includes(type)) return res.redirect('/admin/settings');

  uploadImage(req, res, (err) => {
    if (err) return res.redirect('/admin/settings?message=Lỗi: ' + err.message);
    if (!req.file?.cloudinaryUrl)
      return res.redirect('/admin/settings?message=Vui lòng chọn file ảnh');

    // Xóa ảnh cũ trên Cloudinary
    const settings = getSettings();
    if (settings[type]) deleteFile(settings[type]);

    // Lưu URL Cloudinary mới
    db.set(`settings.${type}`, req.file.cloudinaryUrl).write();
    res.redirect(`/admin/settings?message=Đã cập nhật ${type} thành công!`);
  });
});

module.exports = router;
