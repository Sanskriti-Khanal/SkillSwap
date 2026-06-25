const https = require('https');
const crypto = require('crypto');

// SECURITY: HaveIBeenPwned k-anonymity password breach check.
//
// WHY: A password can satisfy every complexity rule yet still be in breach databases
// (e.g. "Password123!" appears millions of times in HIBP). We check at registration
// and password reset without ever sending the full password to a third party.
//
// HOW (k-anonymity model):
//   1. SHA-1 hash the password locally.
//   2. Send only the first 5 hex characters (the prefix) to api.pwnedpasswords.com.
//   3. The API returns all hashes that share that prefix (~500 on average).
//   4. We search the returned list for our hash suffix — locally, never transmitted.
//   5. If found: password is known-breached → reject it.
//
// The API never sees the full hash. An observer watching the network sees only a 5-char
// prefix, which maps to ~500 different possible passwords — no PII is revealed.
// OWASP A07:2021 – Identification and Authentication Failures.

async function isPasswordPwned(password) {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.pwnedpasswords.com',
      path: `/range/${prefix}`,
      method: 'GET',
      headers: {
        'Add-Padding': 'true', // pads response to fixed size — prevents traffic analysis
        'User-Agent': 'SkillSwap-SecurityCheck/1.0',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const lines = data.split('\r\n');
        for (const line of lines) {
          const [hashSuffix, countStr] = line.split(':');
          if (hashSuffix && hashSuffix.toUpperCase() === suffix) {
            resolve(parseInt(countStr, 10)); // return breach count
          }
        }
        resolve(0); // not found in breach database
      });
    });

    req.on('error', (err) => {
      // SECURITY: fail open — if HIBP is unavailable, do not block registration.
      // Logging the error allows the security team to detect persistent outages.
      console.error('HIBP check failed (fail-open):', err.message);
      resolve(0);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve(0); // timeout → fail open
    });

    req.end();
  });
}

module.exports = { isPasswordPwned };
