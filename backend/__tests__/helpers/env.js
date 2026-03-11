// Load .env.test before any test file runs
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.test') });
