const express = require('express');
const router  = express.Router();
const { db }  = require('../database/db');
const { requireAdmin }            = require('../middleware/auth');
const { uploadSong, uploadImage } = require('../middleware/upload');
const { deleteFromCloudinary }    = require('../config/cloudinary');

function deleteFile(url) {
  if (url && url.includes('cloudinary.com'))
    deleteFromCloudinary(url).catch(() => {});
}

async function getSettings() {
  const { rows } = await db.execute('SELECT * FROM settings WHERE id = 1');
  return rows[0] || {};
}

function base(extra) {
  return {
    user: null, songs: [], editSong: null, settings: {},
    totalSongs: 0, totalUsers: 0, recentSongs: [],
    message: null, error: null, ...extra
  };
}

// ── GET /admin ──────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  const { rows: songs }   = await db.execute('SELECT COUNT(*) as c FROM music');
  const { rows: users }   = await db.execute('SELECT COUNT(*) as c FROM users');
  const { rows: recent }  = await db.execute('SELECT * FROM music ORDER BY created_at DESC LIMIT 5');
  res.render('admin', base({
    user: req.session.user, page: 'dashboard', settings: await getSettings(),
    totalSongs: Number(songs[0].c), totalUsers: Number(users[0].c), recentSongs: recent
  }));
});

// ── GET /admin/songs ────────────────────────────
router.get('/songs', requireAdmin, async (req, res) => {
  const { rows: songs } = await db.execute('SELECT * FROM music ORDER BY created_at DESC');
  res.render('admin', base({
    user: req.session.user, page: 'songs', songs, settings: await getSettings(),
    message: req.query.message || null
  }));
});

// ── GET /admin/songs/edit/:id ───────────────────
router.get('/songs/edit/:id', requireAdmin, async (req, res) => {
  const { rows }        = await db.execute('SELECT * FROM music WHERE id = ?', [req.params.id]);
  const editSong        = rows[0];
  if (!editSong) return res.redirect('/admin/songs');
  const { rows: songs } = await db.execute('SELECT * FROM music ORDER BY created_at DESC');
  res.render('admin', base({
    user: req.session.user, page: 'songs', songs, editSong, settings: await getSettings()
  }));
});

// ── POST /admin/songs/add ───────────────────────
router.post('/songs/add', requireAdmin, (req, res) => {
  uploadSong(req, res, async (err) => {
    if (err) return res.redirect('/admin/songs?message=Lỗi upload: ' + err.message);
    const { title, artist, album, description } = req.body;
    if (!title || !artist) return res.redirect('/admin/songs?message=Thiếu tên bài hoặc ca sĩ');
    const musicFile = req.files?.music_file?.[0];
    if (!musicFile) return res.redirect('/admin/songs?message=Vui lòng chọn file mp3');
    const imageFile = req.files?.image?.[0];

    await db.execute(
      `INSERT INTO music (title, artist, album, description, image, music_file)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title.trim(), artist.trim(),
        album?.trim()       || null,
        description?.trim() || null,
        imageFile?.cloudinaryUrl || null,
        musicFile.cloudinaryUrl
      ]
    );
    res.redirect('/admin/songs?message=Đã thêm bài hát thành công!');
  });
});

// ── POST /admin/songs/edit/:id ──────────────────
router.post('/songs/edit/:id', requireAdmin, (req, res) => {
  uploadSong(req, res, async (err) => {
    if (err) return res.redirect(`/admin/songs?message=Lỗi: ${err.message}`);
    const { rows } = await db.execute('SELECT * FROM music WHERE id = ?', [req.params.id]);
    const song = rows[0];
    if (!song) return res.redirect('/admin/songs');

    const { title, artist, album, description } = req.body;
    const musicFile = req.files?.music_file?.[0];
    const imageFile = req.files?.image?.[0];

    let musicUrl = song.music_file;
    if (musicFile?.cloudinaryUrl) { deleteFile(song.music_file); musicUrl = musicFile.cloudinaryUrl; }

    let imageUrl = song.image;
    if (imageFile?.cloudinaryUrl) { deleteFile(song.image); imageUrl = imageFile.cloudinaryUrl; }

    await db.execute(
      `UPDATE music SET title=?, artist=?, album=?, description=?, image=?, music_file=? WHERE id=?`,
      [
        title?.trim()       || song.title,
        artist?.trim()      || song.artist,
        album?.trim()       || null,
        description?.trim() || null,
        imageUrl, musicUrl,
        req.params.id
      ]
    );
    res.redirect('/admin/songs?message=Đã cập nhật bài hát!');
  });
});

// ── POST /admin/songs/delete/:id ────────────────
router.post('/songs/delete/:id', requireAdmin, async (req, res) => {
  const { rows } = await db.execute('SELECT * FROM music WHERE id = ?', [req.params.id]);
  if (rows[0]) {
    deleteFile(rows[0].music_file);
    deleteFile(rows[0].image);
    await db.execute('DELETE FROM music WHERE id = ?', [req.params.id]);
  }
  res.redirect('/admin/songs?message=Đã xóa bài hát!');
});

// ── GET /admin/settings ─────────────────────────
router.get('/settings', requireAdmin, async (req, res) => {
  res.render('admin', base({
    user: req.session.user, page: 'settings', settings: await getSettings(),
    message: req.query.message || null
  }));
});

// ── POST /admin/settings/upload/:type ───────────
router.post('/settings/upload/:type', requireAdmin, (req, res) => {
  const { type } = req.params;
  if (!['logo','banner','background','login_background'].includes(type))
    return res.redirect('/admin/settings');

  uploadImage(req, res, async (err) => {
    if (err) return res.redirect('/admin/settings?message=Lỗi: ' + err.message);
    if (!req.file?.cloudinaryUrl)
      return res.redirect('/admin/settings?message=Vui lòng chọn file ảnh');

    const settings = await getSettings();
    if (settings[type]) deleteFile(settings[type]);

    await db.execute(`UPDATE settings SET ${type} = ? WHERE id = 1`, [req.file.cloudinaryUrl]);
    res.redirect(`/admin/settings?message=Đã cập nhật ${type} thành công!`);
  });
});

module.exports = router;
