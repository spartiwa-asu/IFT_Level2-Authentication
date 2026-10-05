// =============================================================================
// userModel.js - the MODEL for users (the "M" in MVC): rules + password hashing
// Breakpoints 2-4 (signup) and the password check used by BREAKPOINT 8 (login).
// =============================================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// The bcrypt COST, read from .env. Each +1 doubles the hashing work (12 = 4096
// rounds), which makes guessing passwords from a stolen hash slower. It is NOT the
// salt: the salt is random per password and generated below.
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please tell us your name.'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Please provide your email.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email.']
    },
    password: {
      type: String,
      required: [true, 'Please provide a password.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      select: false // never returned by queries unless asked for with .select('+password')
    },
    // Only exists long enough to be validated; it is never stored
    passwordConfirmation: {
      type: String,
      required: [
        function () {
          return this.isModified('password');
        },
        'Please confirm your password.'
      ],
      validate: {
        validator(value) {
          return value === this.password;
        },
        message: 'Passwords do not match.'
      }
    }
  },
  { timestamps: true }
);

// Hash the password before saving. Validation runs first, so the rules above
// see the plain-text password; the database only ever sees the hash.
userSchema.pre('save', async function () {
  // ● BREAKPOINT 2 of 16 - SIGNUP: the model is about to protect the password
  //   Inspect:  this.password  - still plain text (validation has already passed).
  //             this.isModified('password') - true for a new user.
  //   Why:      a Mongoose "pre save" hook runs automatically before every save,
  //             so no controller can forget to hash.
  if (!this.isModified('password')) return;

  // ● BREAKPOINT 3 of 16 - SIGNUP: generate the SALT
  //   Step over (F10), then inspect:  salt   e.g. $2b$12$YbMg6f5k7xWd1sYQAHC7kO
  //     $2b$   = bcrypt version
  //     12$    = cost, from BCRYPT_ROUNDS in .env
  //     the last 22 characters = random bytes, new for EVERY password
  //   Why:      the salt makes identical passwords hash differently, so an attacker
  //             cannot use one precomputed table (or spot users who share a password).
  //   Try:      sign up two users with the SAME password and compare their salts.
  //   Note:     the salt is not a secret and is not in .env - it is stored inside the
  //             hash (see BREAKPOINT 4). A secret shared by all passwords would be a
  //             "pepper", which this project does not use.
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);

  // ● BREAKPOINT 4 of 16 - SIGNUP: hash password + salt
  //   Step over (F10), then inspect:  this.password  - 60 characters.
  //   In the DEBUG CONSOLE type:  this.password.startsWith(salt)   -> true
  //   Why:      the first 29 characters of the hash ARE the salt; the last 31 are the
  //             hash itself. That is how login can re-use the salt (BREAKPOINT 8).
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordConfirmation = undefined;
});

// bcrypt re-hashes the candidate with the salt stored inside the hash and compares
userSchema.methods.isPasswordMatch = function (candidatePassword) {
  // ● BREAKPOINT 8 of 16 (inside) - LOGIN: how the password is validated
  //   Inspect:  candidatePassword (plain text typed at login), this.password (stored hash)
  //   In the DEBUG CONSOLE type:  bcrypt.getSalt(this.password)
  //             - the SAME salt that was generated at signup (BREAKPOINT 3).
  //   Why:      bcrypt.compare hashes candidatePassword with that salt and cost, then
  //             compares the result with the stored hash. The password is never decrypted:
  //             a hash is one-way, it cannot be reversed.
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
