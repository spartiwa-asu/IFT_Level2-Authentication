// Require this FIRST in every test file.
// It sets test env vars, then gives the file a throw-away in-memory MongoDB.
process.env.NODE_ENV = 'test';
process.env.API_VERSION = '/api/v1';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing for tests only - never this low in real life

const { before, after, afterEach } = require('node:test');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
