const mongoose = require('mongoose');

// A SCORE records one run of one game: what was played, by whom, how many points,
// and whether a moderator has verified it.
//
// Why the game title and platform are copied in rather than referenced: a score is
// a historical record. If the game document is edited or removed later, the score
// must still say what was actually played.
const scoreSchema = new mongoose.Schema(
  {
    gameTitle: { type: String, required: [true, 'A score needs the game title.'], trim: true, maxlength: 200 },
    platform: { type: String, enum: ['pc', 'console', 'mobile', 'handheld', 'arcade'], default: 'pc' },

    // The number that makes this a leaderboard. Whole, non-negative, and capped so
    // one impossible submission cannot dominate every board.
    points: {
      type: Number,
      required: [true, 'A score needs a points value.'],
      min: [0, 'Points cannot be negative.'],
      max: [100000000, 'That score is outside the accepted range.'],
      validate: { validator: Number.isInteger, message: 'Points must be a whole number.' }
    },
    // How far the player got. Optional, because not every game has levels.
    levelReached: { type: Number, min: 1, max: 999, default: null },

    // LEVEL 1 WEAKNESS: with no login, the player is whatever the client types.
    // Level 2 fills these from the verified token instead.
    playerEmail: {
      type: String,
      required: [true, 'A score needs a player email.'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid player email.']
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // A submitted score is a claim. A moderator verifies, rejects or disputes it.
    status: {
      type: String,
      enum: ['submitted', 'verified', 'rejected', 'disputed'],
      default: 'submitted',
      index: true
    },
    playedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Leaderboard queries read "this game, highest first", so index that pair
scoreSchema.index({ gameTitle: 1, points: -1 });

// The collection is named "scores" - Mongoose pluralises the model name "Score"
module.exports = mongoose.model('Score', scoreSchema);
