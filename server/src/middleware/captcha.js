const https = require('https');

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;

// SECURITY: fails CLOSED — if the reCAPTCHA verifier is unreachable, times out, or
// returns something unparseable, the request is denied rather than passed through.
// A fail-open policy here would let an attacker take down (or simply wait out) Google's
// siteverify endpoint to bypass CAPTCHA entirely on registration/login.
module.exports = function (req, res, next) {
  const token = req.body['g-recaptcha-response'];

  if (!token) {
    return res.status(400).json({ msg: 'Please complete the CAPTCHA' });
  }

  const postData = new URLSearchParams({
    secret: RECAPTCHA_SECRET,
    response: token,
    remoteip: req.ip,
  }).toString();

  const options = {
    hostname: 'www.google.com',
    path: '/recaptcha/api/siteverify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 5000,
  };

  const verifyReq = https.request(options, (verifyRes) => {
    let data = '';
    verifyRes.on('data', (chunk) => { data += chunk; });
    verifyRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.success) {
          next();
        } else {
          res.status(400).json({ msg: 'CAPTCHA verification failed' });
        }
      } catch {
        res.status(502).json({ msg: 'CAPTCHA verification error' });
      }
    });
  });

  verifyReq.on('timeout', () => {
    verifyReq.destroy();
  });

  verifyReq.on('error', (err) => {
    console.error('reCAPTCHA error:', err);
    res.status(502).json({ msg: 'CAPTCHA verification unavailable — please try again' });
  });

  verifyReq.write(postData);
  verifyReq.end();
};
