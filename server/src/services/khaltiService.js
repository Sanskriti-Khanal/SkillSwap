const https = require('https');

// Lazy-read config so the module can load without KHALTI_SECRET_KEY set (e.g. in tests).
function getConfig() {
  if (!process.env.KHALTI_SECRET_KEY) {
    throw new Error('KHALTI_SECRET_KEY environment variable is not set');
  }
  const baseUrl = process.env.KHALTI_BASE_URL || 'https://dev.khalti.com';
  return { secret: process.env.KHALTI_SECRET_KEY, hostname: new URL(baseUrl).hostname };
}

function request(path, body) {
  const { secret, hostname } = getConfig();
  const postData = JSON.stringify(body);

  const options = {
    hostname,
    path,
    method: 'POST',
    headers: {
      // KPG v2 auth format: "key <secret>"
      Authorization: `key ${secret}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 10000,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          return reject(new Error('Invalid response from Khalti'));
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(parsed?.detail || `Khalti API error (${res.statusCode})`));
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error('Khalti request timed out')));
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Starts a KPG v2 payment. `amount` must be an integer in paisa, computed server-side.
function initiate(payload) {
  return request('/api/v2/epayment/initiate/', payload);
}

// Authoritative check of a payment's real status — the only source of truth for
// whether a booking should be marked paid. Redirect query params are never trusted.
function lookup(pidx) {
  return request('/api/v2/epayment/lookup/', { pidx });
}

module.exports = { initiate, lookup };
