require('dotenv').config();
const mongoose = require('mongoose');
const { verifyAuditChain } = require('./src/services/logger');
const AuditLog = require('./src/models/AuditLog');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/skillswap');
    
    console.log("--- Verifying Audit Chain ---");
    const result = await verifyAuditChain();
    console.log("Verification Result:", result);

    console.log("\n--- Audit Log Chaining Sample (First 3 entries) ---");
    const entries = await AuditLog.find().sort({ sequence: 1 }).limit(3).lean();
    entries.forEach(entry => {
      console.log(`\nSequence: ${entry.sequence}`);
      console.log(`Action: ${entry.action}`);
      console.log(`Previous Hash: ${entry.previous_hash}`);
      console.log(`Hash:          ${entry.hash}`);
    });
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
