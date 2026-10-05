const mongoose = require('mongoose');

// A GAME is a title players can submit scores against.
const gameSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'A game needs a title.'], trim: true, maxlength: 200 },
    developer: { type: String, required: [true, 'A game needs a developer.'], trim: true, maxlength: 200 },
    genre: { type: String, trim: true, maxlength: 60 },
    description: { type: String, required: [true, 'A game needs a description.'], trim: true, maxlength: 2000 },
    platform: { type: String, enum: ['pc', 'console', 'mobile', 'handheld', 'arcade'], default: 'pc' },
    status: { type: String, enum: ['active', 'retired'], default: 'active' },
    // LEVEL 1 WEAKNESS: the server has no idea who is logged in, so "submittedBy"
    // is just a name the client types. Anyone can claim to be anyone.
    submittedBy: { type: String, trim: true, default: 'anonymous' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);
