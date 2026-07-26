// Usage: node scripts/hash-password.js "your-new-password"
// Prints a bcrypt hash to paste into .env as ADMIN_PASSWORD_HASH.
// The plain password is never saved anywhere by this script.
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-new-password"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Please choose a password with at least 8 characters.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('\nAdd this line to your .env file:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
