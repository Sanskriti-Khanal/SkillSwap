// Magic-byte (file signature) validation — checks actual file content against known
// binary signatures, independent of file extension or declared MIME type. Defends
// against a malicious file (e.g. an executable) being renamed/mislabeled to pass as
// an allowed type (.exe renamed to .pdf, etc). This module is storage-agnostic and
// reusable anywhere in the app that accepts uploads.
//
// To support an additional format: add one entry to SIGNATURES with its MIME type(s)
// and a match(buffer) function. No other code needs to change.

function bytesMatch(buffer, signature, offset = 0) {
  if (buffer.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

// Office Open XML formats (docx/xlsx/pptx) are ZIP containers — the magic bytes only
// confirm "this is a valid ZIP", not which specific Office format it is. Distinguishing
// those requires inspecting the archive's internal [Content_Types].xml, which is out of
// scope for a byte-signature check; callers should treat a ZIP match as "plausible",
// not a guarantee of the exact Office subtype.
function isZip(buffer) {
  return bytesMatch(buffer, [0x50, 0x4b, 0x03, 0x04]) || bytesMatch(buffer, [0x50, 0x4b, 0x05, 0x06]);
}

// Legacy binary Office formats (.doc/.xls/.ppt) all share the OLE2/Compound File
// Binary Format signature — same caveat as isZip above (family-level match only).
function isOleCompoundFile(buffer) {
  return bytesMatch(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

const SIGNATURES = [
  {
    name: 'jpeg',
    mimes: ['image/jpeg'],
    match: (buf) => bytesMatch(buf, [0xff, 0xd8, 0xff]),
  },
  {
    name: 'png',
    mimes: ['image/png'],
    match: (buf) => bytesMatch(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    name: 'pdf',
    mimes: ['application/pdf'],
    match: (buf) => bytesMatch(buf, [0x25, 0x50, 0x44, 0x46]), // "%PDF"
  },
  {
    name: 'webp',
    mimes: ['image/webp'],
    match: (buf) => bytesMatch(buf, [0x52, 0x49, 0x46, 0x46]) && bytesMatch(buf, [0x57, 0x45, 0x42, 0x50], 8), // RIFF....WEBP
  },
  {
    name: 'gif',
    mimes: ['image/gif'],
    match: (buf) => bytesMatch(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || bytesMatch(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF87a / GIF89a
  },
  {
    name: 'ole-compound-document',
    mimes: ['application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'],
    match: isOleCompoundFile,
  },
  {
    name: 'office-open-xml',
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    match: isZip,
  },
];

// Validates that `buffer` (the first ~32 bytes of an uploaded file are sufficient for
// every signature above) actually matches the expected MIME type's known signature.
// Returns { valid: true } or { valid: false, reason }.
function validateFileSignature(buffer, expectedMime) {
  const signature = SIGNATURES.find((sig) => sig.mimes.includes(expectedMime));
  if (!signature) {
    return { valid: false, reason: `No known file signature registered for MIME type "${expectedMime}"` };
  }
  if (!signature.match(buffer)) {
    return { valid: false, reason: `File content does not match the expected "${signature.name}" signature` };
  }
  return { valid: true };
}

module.exports = { validateFileSignature, SIGNATURES };
