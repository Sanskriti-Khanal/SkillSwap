const https = require('https');

const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || '0x0000000000000000000000000000000000000000'; // Test secret key

module.exports = function (req, res, next) {
  const token = req.body['h-captcha-response'];

  if (!token) {
    return res.status(400).json({ msg: 'Please complete the CAPTCHA' });
  }

  const postData = new URLSearchParams({
    secret: HCAPTCHA_SECRET,
    response: token
  }).toString();

  const options = {
    hostname: 'hcaptcha.com',
    path: '/siteverify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };

  const verifyReq = https.request(options, (verifyRes) => {
    let data = '';
    verifyRes.on('data', (chunk) => {
      data += chunk;
    });

    verifyRes.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.success) {
          next();
        } else {
          res.status(400).json({ msg: 'CAPTCHA verification failed' });
        }
      } catch (err) {
        res.status(500).send('Server Error during CAPTCHA verification');
      }
    });
  });

  verifyReq.on('error', (err) => {
    console.error('hCaptcha Verification Error:', err);
    res.status(500).send('Server Error');
  });

  verifyReq.write(postData);
  verifyReq.end();
};
