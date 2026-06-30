const multer  = require('multer');
const { uploadToCloudinary } = require('../config/cloudinary');

const LIMIT = 20 * 1024 * 1024; // 20MB

const imageFilter = (req, file, cb) => {
  if (/jpeg|jpg|png|webp/i.test(file.mimetype.split('/')[1])) return cb(null, true);
  cb(new Error('Chỉ chấp nhận ảnh: jpg, jpeg, png, webp'));
};

const musicFilter = (req, file, cb) => {
  if (file.mimetype === 'audio/mpeg' || file.originalname.toLowerCase().endsWith('.mp3')) {
    return cb(null, true);
  }
  cb(new Error('Chỉ chấp nhận file .mp3'));
};

// Multer đọc file vào RAM (memory), sau đó ta tự đẩy lên Cloudinary
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

// Middleware upload bài hát (mp3 + ảnh bìa)
const uploadSong = (req, res, next) => {
  multerMemory(req, res, async (err) => {
    if (err) return next(err);
    try {
      if (req.files?.image?.[0]) {
        const result = await uploadToCloudinary(req.files.image[0].buffer, {
          folder:         'music-player/images',
          resource_type:  'image',
          public_id:      `img_${Date.now()}`,
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        });
        req.files.image[0].cloudinaryUrl = result.secure_url;
      }
      if (req.files?.music_file?.[0]) {
        const result = await uploadToCloudinary(req.files.music_file[0].buffer, {
          folder:        'music-player/music',
          resource_type: 'video', // Cloudinary gọi audio là "video"
          public_id:     `audio_${Date.now()}`
        });
        req.files.music_file[0].cloudinaryUrl = result.secure_url;
      }
      next();
    } catch (e) {
      next(new Error('Lỗi upload Cloudinary: ' + e.message));
    }
  });
};

// Middleware upload ảnh đơn (logo, banner, background)
const multerSingle = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: LIMIT },
  fileFilter: imageFilter
}).single('image');

const uploadImage = (req, res, next) => {
  multerSingle(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next();
    try {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder:         'music-player/images',
        resource_type:  'image',
        public_id:      `img_${Date.now()}`,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      });
      req.file.cloudinaryUrl = result.secure_url;
      next();
    } catch (e) {
      next(new Error('Lỗi upload ảnh: ' + e.message));
    }
  });
};

module.exports = { uploadSong, uploadImage };
