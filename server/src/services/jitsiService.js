const crypto = require('crypto');

// Free, keyless video calls via the public meet.jit.si server — no account or API
// key needed. The room name doubles as the access control: it's derived from the
// booking id plus a random token, so it's unique and unguessable, but anyone who
// has the link (i.e. the tutor and learner it was generated for) can join directly.
function generateMeetingLink(bookingId) {
  const domain = process.env.JITSI_DOMAIN || 'meet.jit.si';
  const token = crypto.randomBytes(8).toString('hex');
  const room = `SkillSwap-${bookingId}-${token}`;
  return `https://${domain}/${room}`;
}

module.exports = { generateMeetingLink };
