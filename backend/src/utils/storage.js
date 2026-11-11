/**
 * storage.js: saves listing photos.
 *
 * If SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, photos go to the
 * Supabase Storage bucket "property-images" and we store their public URL.
 * Otherwise (local development) they are saved in backend/uploads and served
 * by Express at /uploads/...
 *
 * Every file is checked by its CONTENT (magic bytes), not by its name, so a
 * script renamed to .jpg is rejected. Names are random, so users cannot
 * overwrite files or choose paths.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const { AppError } = require('../middleware/errors');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

function storageHeaders(contentType) {
  const key = config.supabaseServiceKey;
  return {
    apikey: key,
    ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
    'Content-Type': contentType,
  };
}

/** Detect the real image type from the first bytes of the file. */
function detectImageType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

const useSupabase = () => Boolean(config.supabaseUrl && config.supabaseServiceKey);

/** file = multer memory file. Returns the URL to store in property_images.image_url */
async function saveImage(file) {
  const type = detectImageType(file.buffer);
  if (!type) throw new AppError(422, `"${file.originalname}" is not a JPG, PNG or WebP image.`, { photos: 'Only JPG, PNG or WebP images are allowed.' });
  const name = `${new Date().toISOString().slice(0, 7)}/${crypto.randomBytes(12).toString('hex')}.${type.ext}`;

  if (useSupabase()) {
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.storageBucket}/${name}`, {
      method: 'POST',
      headers: storageHeaders(type.mime),
      body: file.buffer,
    });
    if (!res.ok) throw new Error(`Supabase Storage upload failed: ${res.status} ${await res.text()}`);
    return `${config.supabaseUrl}/storage/v1/object/public/${config.storageBucket}/${name}`;
  }
  const target = path.join(UPLOAD_DIR, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, file.buffer);
  return `/uploads/${name}`;
}

/** Delete photos we stored (seed photos under /seed are left alone). */
async function deleteImages(urls) {
  for (const url of urls) {
    try {
      if (url.startsWith('/uploads/')) {
        fs.rmSync(path.join(UPLOAD_DIR, url.slice('/uploads/'.length)), { force: true });
      } else if (useSupabase() && url.startsWith(config.supabaseUrl)) {
        const objectPath = url.split(`/public/${config.storageBucket}/`)[1];
        await fetch(`${config.supabaseUrl}/storage/v1/object/${config.storageBucket}`, {
          method: 'DELETE',
          headers: storageHeaders('application/json'),
          body: JSON.stringify({ prefixes: [objectPath] }),
        });
      }
    } catch (err) {
      console.error('Could not delete image', url, err.message);
    }
  }
}

module.exports = { saveImage, deleteImages, detectImageType, UPLOAD_DIR };
