const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { db }  = require('../database/db');

async function getSettings() {
  const { rows } = await db.execute('SELECT * FROM settings WHERE id = 1');
  return rows[0] || {};
}

// ── GET /login ──────────────────────────────────
router.get('/login', async (req, res) => {
  if (req.session?.user) {
    return req.session.user.role === 'admin' ? res.redirect('/admin') : res.redirect('/');
  }
  res.render('login', { error: null, settings: await getSettings() });
});

// ── POST /login ─────────────────────────────────
router.post('/login', async (req, res) => {
  if (req.session?.user) return res.redirect('/');
  const { username, password } = req.body;
  const settings = await getSettings();

  if (!username || !password)
    return res.render('login', { error: 'Vui lòng nhập đầy đủ thông tin.', settings });

  const { rows } = await db.execute(
    'SELECT * FROM users WHERE username = ?', [username.trim()]
  );
  const user = rows[0];
  if (!user)
    return res.render('login', { error: 'Tài khoản không tồn tại.', settings });

  const match = await bcrypt.compare(password, user.password);
  if (!match)
    return res.render('login', { error: 'Mật khẩu không đúng.', settings });

  req.session.user = { id: Number(user.id), username: user.username, role: user.role };
  return user.role === 'admin' ? res.redirect('/admin') : res.redirect('/');
});

// ── GET /register ───────────────────────────────
router.get('/register', async (req, res) => {
  if (req.session?.user) return res.redirect('/');
  res.render('register', { error: null, success: null, settings: await getSettings() });
});

// ── POST /register ──────────────────────────────
router.post('/register', async (req, res) => {
  if (req.session?.user) return res.redirect('/');
  const { username, password, confirm_password } = req.body;
  const settings = await getSettings();
  const fail = (msg) => res.render('register', { error: msg, success: null, settings });

  if (!username || !password)        return fail('Vui lòng nhập đầy đủ thông tin.');
  if (username.length < 3)           return fail('Username phải có ít nhất 3 ký tự.');
  if (password.length < 6)           return fail('Mật khẩu phải có ít nhất 6 ký tự.');
  if (password !== confirm_password) return fail('Mật khẩu xác nhận không khớp.');

  const { rows } = await db.execute(
    'SELECT id FROM users WHERE username = ?', [username.trim()]
  );
  if (rows.length > 0) return fail('Username đã tồn tại.');

  const hashed = await bcrypt.hash(password, 10);
  await db.execute(
    'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
    [username.trim(), hashed, 'guest']
  );

  res.render('register', { error: null, success: 'Đăng ký thành công! Bạn có thể đăng nhập.', settings });
});

// ── GET /logout ─────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
