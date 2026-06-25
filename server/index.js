require('dotenv').config();
const validateEnv = require('./src/config/validateEnv');
validateEnv(); // Exits in production if critical secrets are missing

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
