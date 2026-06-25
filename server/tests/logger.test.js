const path = require('path');
const fs = require('fs');
const { logEvent, scrubPII, PII_FIELDS } = require('../src/services/logger');

describe('PII scrubbing', () => {
  test('scrubPII redacts all PII field names', () => {
    const input = {
      password: 'supersecret',
      token: 'eyJhbGc.abc.def',
      secret: 'totp_secret_value',
      refreshToken: 'refresh_abc',
      cardNumber: '4242424242424242',
      cvv: '123',
      totpSecret: 'BASE32SECRET',
      email: 'user@example.com',
      action: 'user.login',
    };

    const result = scrubPII(input);

    expect(result.password).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
    expect(result.refreshToken).toBe('[REDACTED]');
    expect(result.cardNumber).toBe('[REDACTED]');
    expect(result.cvv).toBe('[REDACTED]');
    expect(result.totpSecret).toBe('[REDACTED]');

    // Non-PII fields must be preserved
    expect(result.email).toBe('user@example.com');
    expect(result.action).toBe('user.login');
  });

  test('scrubPII redacts nested PII fields', () => {
    const input = {
      user: {
        password: 'nested_secret',
        name: 'Alice',
      },
    };

    const result = scrubPII(input);

    expect(result.user.password).toBe('[REDACTED]');
    expect(result.user.name).toBe('Alice');
  });

  test('scrubPII leaves non-objects unchanged', () => {
    expect(scrubPII(null)).toBeNull();
    expect(scrubPII('string')).toBe('string');
    expect(scrubPII(42)).toBe(42);
  });

  test('logEvent does not write PII fields to the log file', (done) => {
    const logFile = path.join(__dirname, '../logs/app.log');

    // Truncate log file so we only check the new entry
    if (fs.existsSync(logFile)) fs.truncateSync(logFile, 0);

    logEvent('test-user-id', 'test.pii_check', {
      password: 'should_not_appear',
      token: 'should_not_appear_either',
      email: 'safe@example.com',
    });

    // Give Winston's file transport a tick to flush
    setTimeout(() => {
      const contents = fs.readFileSync(logFile, 'utf-8');
      expect(contents).not.toContain('should_not_appear');
      expect(contents).not.toContain('should_not_appear_either');
      expect(contents).toContain('safe@example.com');
      done();
    }, 200);
  });
});
