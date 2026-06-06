const { Pool } = require('pg');

// Create a new pool using environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  // Add pool configuration
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  // Expose a query function that uses parameterized statements
  query: (text, params) => {
    // Ensuring parameterized queries are used
    if (!params && text.includes('$1')) {
      console.warn('Warning: Query might be missing parameters');
    }
    return pool.query(text, params);
  },
  // Expose the pool for transaction management
  pool
};
