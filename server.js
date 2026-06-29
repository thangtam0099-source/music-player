// Load biến môi trường từ .env (khi chạy local)
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// Template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files (CSS, JS public)
app.use(express.static(path.join(__dirname, 'public')));

// Giữ /uploads cho backward compat (ảnh local cũ nếu có)
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
}

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(session({
  secret:            process.env.SESSION_SECRET || 'music-player-fallback-secret',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 ngày
}));

// Khởi tạo DB
require('./database/db');

// Routes
app.use('/',          require('./routes/auth'));
app.use('/',          require('./routes/guest'));
app.use('/admin',     require('./routes/admin'));
app.use('/playlists', require('./routes/playlist'));

// 404
app.use((req, res) => {
  res.status(404).send('<h2>404 — Trang không tồn tại</h2><a href="/">Về trang chủ</a>');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).send('<h2>Lỗi server</h2><pre>' + err.message + '</pre>');
});

app.listen(PORT, () => {
  console.log(`\n🎵 Music Player đang chạy tại http://localhost:${PORT}`);
  console.log(`   Admin: http://localhost:${PORT}/admin  (admin/admin123)\n`);
});
