const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cấu hình credentials từ biến môi trường
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Storage cho ảnh (bìa bài hát, logo, banner...) ──
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'music-player/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    // Tên file = timestamp để tránh trùng
    public_id: (req, file) => `img_${Date.now()}_${Math.round(Math.random() * 1e5)}`
  }
});

// ── Storage cho nhạc mp3 ─────────────────────────────
const musicStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'music-player/music',
    allowed_formats: ['mp3'],
    resource_type:   'video', // Cloudinary dùng "video" cho audio
    public_id: (req, file) => `audio_${Date.now()}_${Math.round(Math.random() * 1e5)}`
  }
});

// ── Xóa file trên Cloudinary theo URL ───────────────
async function deleteFromCloudinary(fileUrl) {
  if (!fileUrl) return;

  try {
    // Lấy public_id từ URL Cloudinary
    // URL dạng: https://res.cloudinary.com/cloud_name/image/upload/v.../folder/public_id.ext
    const parts = fileUrl.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return;

    // Lấy phần sau "upload/vXXX/" hoặc "upload/"
    const afterUpload = parts.slice(uploadIdx + 1);
    // Bỏ phần version (vXXX) nếu có
    const startIdx = afterUpload[0]?.match(/^v\d+$/) ? 1 : 0;
    const withExt  = afterUpload.slice(startIdx).join('/');
    const publicId = withExt.replace(/\.[^/.]+$/, ''); // bỏ extension

    // Xác định resource_type
    const isAudio = fileUrl.includes('/video/') || publicId.includes('music/');
    const resourceType = isAudio ? 'video' : 'image';

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.warn('[Cloudinary] Không xóa được file:', fileUrl, err.message);
  }
}

module.exports = { cloudinary, imageStorage, musicStorage, deleteFromCloudinary };
