// Usage:  npm run seed          (wipe + import sample users and games)
//         npm run seed:delete   (wipe only)
const dotenv = require('dotenv');
dotenv.config({ path: `${__dirname}/../.env`, quiet: true });
dotenv.config({ path: `${__dirname}/../config.env`, quiet: true });

const mongoose = require('mongoose');
const User = require('../models/userModel');
const Game = require('../models/gameModel');
const users = require('./users.json');
const games = require('./games.json');

// Same placeholder rules as server.js - keep the two in sync.
const DB = (process.env.DATABASE_URL || '')
  .replace('<password>', () => process.env.DATABASE_PASSWORD || '')
  .replace('<db_username>', () => encodeURIComponent(process.env.DATABASE_USER || ''))
  .replace('<db_password>', () => encodeURIComponent(process.env.DATABASE_PWD || ''))
  .replace('<db_name>', () => encodeURIComponent(process.env.DATABASE_NAME || ''));

(async () => {
  try {
    if (!DB) throw new Error('DATABASE_URL is not set. Copy config.env.example to .env and configure your connection string.');
    await mongoose.connect(DB);
    await Promise.all([User.deleteMany(), Game.deleteMany()]);
    console.log('Collections cleared.');

    if (process.argv.includes('--import')) {
      // User.create (not insertMany) so the pre-save hook hashes each password
      for (const user of users) await User.create(user);
      await Game.insertMany(games.map((b) => ({ ...b, submittedBy: 'seed script' })));
      console.log(`Imported ${users.length} users and ${games.length} games. Password for all: password12345`);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
