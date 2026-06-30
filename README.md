# 🎵 Music Player

Website nghe nhạc đơn giản, chạy local, không cần cloud hay Docker.

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js + Express.js |
| Database | SQLite (better-sqlite3) |
| Template | EJS |
| Upload | Multer |
| Auth | Express Session |
| Password | bcrypt |

---

## Cài đặt & Chạy

### 1. Cài Node.js
Tải tại https://nodejs.org (phiên bản 16+ trở lên)

### 2. Clone / Giải nén project
```bash
cd music-player
```

### 3. Cài dependencies
```bash
npm install
```

### 4. Khởi động server
```bash
npm start
```

Mở trình duyệt tại: **http://localhost:3000**

---

## Tài khoản mặc định

### Admin
| | |
|---|---|
| Username | `admin` |
| Password | `admin123` |
| URL | http://localhost:3000/admin |

### Guest
Tự đăng ký tại http://localhost:3000/register

---

## Cấu trúc thư mục

```
music-player/
│
├── server.js              # Entry point
├── package.json
│
├── database/
│   ├── db.js              # Khởi tạo SQLite
│   └── database.db        # File DB (tự tạo khi chạy)
│
├── uploads/
│   ├── music/             # File mp3
│   └── images/            # Ảnh bìa, logo, banner...
│
├── public/
│   ├── css/style.css      # Toàn bộ CSS
│   └── js/player.js       # Logic phát nhạc
│
├── views/
│   ├── login.ejs          # Trang đăng nhập
│   ├── register.ejs       # Trang đăng ký
│   ├── home.ejs           # Trang guest
│   └── admin.ejs          # Trang admin
│
├── routes/
│   ├── auth.js            # Login / Register / Logout
│   ├── guest.js           # Trang chủ
│   └── admin.js           # Toàn bộ admin
│
└── middleware/
    ├── auth.js            # Kiểm tra quyền
    └── upload.js          # Cấu hình Multer
```

---

## Tính năng

### 👥 Guest
- Xem danh sách bài hát (ảnh, tên, ca sĩ, album)
- Phát nhạc với HTML5 Audio Player
- Play / Pause / Bài trước / Bài sau
- Thanh tiến trình + thời lượng + âm lượng
- Tìm kiếm theo tên bài / ca sĩ
- Sắp xếp: Mới nhất / A→Z
- Phím tắt: Space (play/pause), ← → (chuyển bài)

### 🔧 Admin
- Dashboard thống kê
- Thêm / Sửa / Xóa bài hát (upload mp3 + ảnh bìa)
- Cài đặt giao diện: Logo, Banner, Background trang chủ, Background Login

---

## Giới hạn upload

| Loại file | Định dạng chấp nhận | Giới hạn |
|---|---|---|
| Nhạc | .mp3 | 20MB |
| Ảnh | .jpg .jpeg .png .webp | 20MB |

---

## Lưu ý

- Database tự tạo ở `database/database.db` khi chạy lần đầu
- Tài khoản admin mặc định tự tạo nếu chưa có
- Xóa bài hát sẽ xóa luôn file mp3 và ảnh trên disk
- Dùng `npm run dev` để chạy với nodemon (tự reload khi sửa code)
