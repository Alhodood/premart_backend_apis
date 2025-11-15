// --- helpers/s3.js (or inline above your routes) ---
function extractKeyAndBucket(keyOrUrl = '') {
  let key = (keyOrUrl || '').trim();
  let bucket = null;

  if (!key) return { key: '', bucket: null };

  // If it's a full URL, parse bucket + key
  if (key.startsWith('http')) {
    const u = new URL(key);

    // Try virtual-hosted–style: <bucket>.s3.<region>.amazonaws.com
    const hostParts = u.hostname.split('.');
    if (hostParts.length >= 4 && hostParts[1] === 's3') {
      bucket = hostParts[0];
    } else {
      // Path-style (rare now): s3.<region>.amazonaws.com/<bucket>/...
      const segs = u.pathname.split('/').filter(Boolean);
      if (segs.length > 1) {
        bucket = segs[0];
      }
    }

    // Key = portion AFTER "uploads/"
    const path = decodeURIComponent(u.pathname);
    const idx = path.indexOf('/uploads/');
    if (idx >= 0) {
      key = path.substring(idx + '/uploads/'.length).replace(/^\/+/, '');
    } else {
      // fallback: whole path without leading slash
      key = path.replace(/^\/+/, '');
      // If it still contains the bucket prefix (path-style), strip it
      if (bucket && key.startsWith(bucket + '/')) {
        key = key.substring((bucket + '/').length);
      }
    }
  }

  // If client already sent something like "uploads/xyz", strip the prefix.
  if (key.startsWith('uploads/')) {
    key = key.substring('uploads/'.length);
  }

  return { key, bucket };
}

module.exports = { extractKeyAndBucket };