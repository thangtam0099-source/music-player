const multer = require('multer');
const { imageStorage, musicStorage } = require('../config/cloudinary');

const LIMIT = 20 * 1024 * 1024; // 20MB

// ── Bộ lọc file ─────────────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/i;
  const mime    = file.mimetype.split('/')[1];
  if (allowed.test(mime)) return cb(null, true);
  cb(new Error('Chỉ chấp nhận ảnh: jpg, jpeg, png, webp'));
};

const musicFilter = (req, file, cb) => {
  if (file.mimetype === 'audio/mpeg' || file.originalname.toLowerCase().endsWith('.mp3')) {
    return cb(null, true);
  }
  cb(new Error('Chỉ chấp nhận file .mp3'));
};

// ── Upload bài hát: mp3 + ảnh bìa ───────────────────
// Dùng memoryStorage trước để filter, rồi mỗi field dùng storage riêng
// → Cách đơn giản hơn: tạo 2 multer riêng và chain chúng

const _uploadMusicFile = multer({
  storage: musicStorage,
  limits:  { fileSize: LIMIT },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'music_file') return musicFilter(req, file, cb);
    if (file.fieldname === 'image')      return imageFilter(req, file, cb);
    cb(null, false);
  }
}).fields([
  { name: 'music_file', maxCount: 1 },
  { name: 'image',      maxCount: 1 }
]);

// Vì multer-storage-cloudinary không hỗ trợ mixed resource_type trong 1 instance,
// ta dùng memoryStorage rồi upload thủ công lên Cloudinary trong route.
// → Cách gọn nhất: dùng 2 multer riêng rồi gộp kết quả.

const multerMemory = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: LIMIT },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'music_file') return musicFilter(req, file, cb);
    if (file.fieldname === 'image')      return imageFilter(req, file, cb);
    cb(null, false);
  }
}).fields([
  { name: 'music_file', maxCount: 1 },
  { name: 'image',      maxCount: 1 }
]);

// Upload thủ công từ buffer lên Cloudinary
const { cloudinary } = require('../config/cloudinary');

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// Middleware uploadSong: nhận file qua multer memory → đẩy lên Cloudinary
const uploadSong = (req, res, next) => {
  multerMemory(req, res, async (err) => {
    if (err) return next(err);

    try {
      // Upload ảnh bìa nếu có
      if (req.files?.image?.[0]) {
        const imgFile = req.files.image[0];
        const result  = await uploadToCloudinary(imgFile.buffer, {
          folder:        'music-player/images',
          resource_type: 'image',
          public_id:     `img_${Date.now()}`,
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        });
        // Ghi đè để route dùng như cũ
        req.files.image[0].cloudinaryUrl = result.secure_url;
        req.files.image[0].publicId      = result.public_id;
      }

      // Upload file mp3 nếu có
      if (req.files?.music_file?.[0]) {
        const mp3File = req.files.music_file[0];
        const result  = await uploadToCloudinary(mp3File.buffer, {
          folder:        'music-player/music',
          resource_type: 'video', // Cloudinary gọi audio là "video"
          public_id:     `audio_${Date.now()}`
        });
        req.files.music_file[0].cloudinaryUrl = result.secure_url;
        req.files.music_file[0].publicId      = result.public_id;
      }

      next();
    } catch (uploadErr) {
      next(new Error('Lỗi upload Cloudinary: ' + uploadErr.message));
    }
  });
};

// ── Upload ảnh đơn (logo, banner, background) ────────
const _multerSingleMemory = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: LIMIT },
  fileFilter: imageFilter
}).single('image');

const uploadImage = (req, res, next) => {
  _multerSingleMemory(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next();

    try {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder:        'music-player/images',
        resource_type: 'image',
        public_id:     `img_${Date.now()}`,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      });
      req.file.cloudinaryUrl = result.secure_url;
      req.file.publicId      = result.public_id;
      next();
    } catch (uploadErr) {
      next(new Error('Lỗi upload ảnh: ' + uploadErr.message));
    }
  });
};

module.exports = { uploadSong, uploadImage };
