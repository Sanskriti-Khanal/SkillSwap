const cloudinary = require('cloudinary').v2;

// Cloudinary-backed document storage for tutor-application uploads (government IDs,
// certificates, resumes, etc). Uploads use type:'private' — assets are never reachable
// via a plain delivery URL; the only read path is a short-lived signed download URL
// generated on demand for admins (see getSignedDownloadUrl below).
function isStorageConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function getClient() {
  if (!isStorageConfigured()) {
    throw new Error('Cloudinary is not configured');
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

// Generates the params + signature needed for the browser to upload directly to
// Cloudinary (POST https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload).
// Every signed param here is enforced server-side — the client cannot alter them
// without invalidating the signature.
//
// NOTE: publicId already encodes the full folder path (e.g. "tutor-applications/<id>/
// <category>/<uuid>") — do NOT also pass a separate `folder` param, Cloudinary
// concatenates folder + public_id when both are given, silently doubling the path.
function createUploadSignature({ publicId }) {
  const cld = getClient();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, public_id: publicId, type: 'private' };
  const signature = cld.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
  return {
    ...paramsToSign,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

// Re-fetches authoritative metadata for an uploaded asset via the Admin API — defends
// against a client claiming one file type/size at presign time and uploading another.
async function getResourceMetadata(publicId, resourceType) {
  const cld = getClient();
  return cld.api.resource(publicId, { type: 'private', resource_type: resourceType });
}

// Short-lived signed download URL — the only way a document is ever read back.
function getSignedDownloadUrl(publicId, format, resourceType, expiresInSeconds) {
  const cld = getClient();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cld.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: 'private',
    expires_at: expiresAt,
  });
}

async function deleteResource(publicId, resourceType) {
  const cld = getClient();
  return cld.uploader.destroy(publicId, { type: 'private', resource_type: resourceType });
}

// Fetches just the first `byteCount` bytes of a private asset — used for server-side
// magic-byte validation (see services/fileSignatures.js) without downloading the whole
// file. Uses a short-lived (60s) signed URL scoped only to this internal check.
async function fetchFilePrefixBytes(publicId, format, resourceType, byteCount = 32) {
  const url = getSignedDownloadUrl(publicId, format, resourceType, 60);
  const res = await fetch(url, { headers: { Range: `bytes=0-${byteCount - 1}` } });
  if (!res.ok && res.status !== 206) {
    throw new Error(`Failed to fetch file prefix for signature validation: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer).subarray(0, byteCount);
}

function getSignedUrlExpirySeconds() {
  return parseInt(process.env.STORAGE_SIGNED_URL_EXPIRY_SECONDS, 10) || 300;
}

module.exports = {
  isStorageConfigured,
  createUploadSignature,
  getResourceMetadata,
  getSignedDownloadUrl,
  deleteResource,
  fetchFilePrefixBytes,
  getSignedUrlExpirySeconds,
};
