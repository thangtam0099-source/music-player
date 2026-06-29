const cloudinary = require('cloudinary').v2;

// Cấu hình từ biến môi trường
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload buffer lên Cloudinary
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// Xóa file trên Cloudinary theo URL
async function deleteFromCloudinary(fileUrl) {
  if (!fileUrl || !fileUrl.includes('cloudinary.com')) return;
  try {
    const parts      = fileUrl.split('/');
    const uploadIdx  = parts.indexOf('upload');
    if (uploadIdx === -1) return;

    const afterUpload = parts.slice(uploadIdx + 1);
    const startIdx    = afterUpload[0]?.match(/^v\d+$/) ? 1 : 0;
    const withExt     = afterUpload.slice(startIdx).join('/');
    const publicId    = withExt.replace(/\.[^/.]+$/, '');

    const resourceType = fileUrl.includes('/video/') ? 'video' : 'image';
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.warn('[Cloudinary] Không xóa được:', fileUrl, err.message);
  }
}

module.exports = { cloudinary, uploadToCloudinary, deleteFromCloudinary };
