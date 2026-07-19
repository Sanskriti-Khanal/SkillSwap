const nodemailer = require('nodemailer');

// Email delivery for account-security messages (password reset, password-changed
// notifications). Gracefully degrades when unconfigured — matches the same
// isConfigured()-guarded pattern used by config/storage.js for Cloudinary, so the
// server keeps booting and other features keep working even before real SMTP
// credentials are provided.
function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD);
}

let transporter = null;

function getTransport() {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

// Returns true if the email was actually sent, false if email isn't configured yet
// (callers should NOT surface this distinction to the end user — see the /password/forgot
// route, which always returns the same generic response either way to avoid leaking
// account existence or server configuration state to an attacker).
async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Not configured — would have sent "${subject}" to ${to}`);
    return false;
  }
  const fromName = process.env.EMAIL_FROM_NAME || 'SkillSwap';
  await getTransport().sendMail({
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return true;
}

async function sendPasswordResetEmail(to, resetLink) {
  return sendEmail({
    to,
    subject: 'Reset your SkillSwap password',
    text: `We received a request to reset your SkillSwap password. Reset it here: ${resetLink}\n\nThis link expires in 30 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3C322F">Reset your password</h2>
        <p style="color:#6B5E58">We received a request to reset your SkillSwap password. This link expires in 30 minutes.</p>
        <p style="margin:24px 0">
          <a href="${resetLink}" style="background:#F47B20;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Reset password</a>
        </p>
        <p style="color:#9E8F89;font-size:.875rem">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  });
}

async function sendPasswordChangedEmail(to) {
  return sendEmail({
    to,
    subject: 'Your SkillSwap password was changed',
    text: 'Your SkillSwap password was just changed. If this wasn\'t you, contact support immediately and secure your account.',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3C322F">Password changed</h2>
        <p style="color:#6B5E58">Your SkillSwap password was just changed. If this wasn't you, contact support immediately.</p>
      </div>
    `,
  });
}

async function sendMeetingLinkEmail(to, { title, meetingLink, requestedTime }) {
  const when = new Date(requestedTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return sendEmail({
    to,
    subject: `Your SkillSwap session "${title}" is confirmed`,
    text: `Your session "${title}" is confirmed for ${when}.\n\nJoin the video call here: ${meetingLink}\n\nThis link works right in your browser — no account or app needed.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#3C322F">Your session is confirmed</h2>
        <p style="color:#6B5E58"><strong>${title}</strong><br/>${when}</p>
        <p style="margin:24px 0">
          <a href="${meetingLink}" style="background:#F47B20;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Join video call</a>
        </p>
        <p style="color:#9E8F89;font-size:.875rem">This link works right in your browser — no account or app needed.</p>
      </div>
    `,
  });
}

module.exports = { isEmailConfigured, sendEmail, sendPasswordResetEmail, sendPasswordChangedEmail, sendMeetingLinkEmail };
