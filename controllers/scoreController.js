const Score = require('../models/scoreModel');
const pick = require('../utils/pick');

const SCORE_FIELDS = ['gameTitle', 'platform', 'points', 'levelReached', 'status', 'playedAt', 'verifiedAt', 'playerEmail'];

// GET /api/v1/scores
exports.getScores = async (req, res) => {
  // ● BREAKPOINT S1 - CONTROLLER: list scores for the leaderboard
  //   Trigger:  GET /scores
  //   Inspect:  req.user.email (who asked)  and  scores  after F10
  //   Why:      sort('-points') means highest first; the minus sign means descending.
  //             Every logged-in user sees every score - no filtering by req.user.
  const scores = await Score.find().sort('-points');
  res.status(200).json({ status: 'success', results: scores.length, data: { scores } });
};

// GET /api/v1/scores/:id
exports.getScore = async (req, res) => {
  // ● BREAKPOINT S2 - CONTROLLER: read ONE score
  //   Trigger:  GET /scores/{id} - copy an _id from the GET /scores response
  //   Inspect:  req.params.id (filled by the route, BREAKPOINT R5)  and  score  after F10
  const score = await Score.findById(req.params.id);
  if (!score) return res.status(404).json({ status: 'fail', message: 'Score not found.' });
  res.status(200).json({ status: 'success', data: { score } });
};

// POST /api/v1/scores  - ZERO AUTHORIZATION: anyone can borrow as anyone
exports.createScore = async (req, res) => {
  // ● BREAKPOINT S3 - CONTROLLER: submit a score as ANYONE
  //   Trigger:  POST /scores with "playerEmail" set to someone else's email
  //   Inspect:  req.user.email  compared with  req.body.playerEmail
  //   Why:      the server KNOWS who is calling (req.user), but it trusts the email typed
  //             in the body instead. userId stays null because it is not in SCORE_FIELDS.
  //             Fix idea: take playerEmail and userId from req.user, never from req.body.
  const score = await Score.create(pick(req.body, SCORE_FIELDS));
  res.status(201).json({ status: 'success', data: { score } });
};

// PATCH /api/v1/scores/:id  - ZERO AUTHORIZATION: anyone can change any score
exports.updateScore = async (req, res) => {
  // ● BREAKPOINT S4 - CONTROLLER: change any score, e.g. mark it verified
  //   Trigger:  PATCH /scores/{id} with { "status": "verified", "points": 99999999 }
  //   Inspect:  pick(req.body, SCORE_FIELDS)  in the DEBUG CONSOLE, then score after F10
  //   Why:      any logged-in player can verify their own score or inflate someone else's.
  //             Verifying should need a moderator role - that is AUTHORIZATION.
  //   Try:      "points": 12.5 - runValidators rejects it (whole numbers only) with 400.
  const score = await Score.findByIdAndUpdate(req.params.id, pick(req.body, SCORE_FIELDS), {
    returnDocument: 'after',
    runValidators: true
  });
  if (!score) return res.status(404).json({ status: 'fail', message: 'Score not found.' });
  res.status(200).json({ status: 'success', data: { score } });
};

// DELETE /api/v1/scores/:id  - ZERO AUTHORIZATION: anyone can delete any score
exports.deleteScore = async (req, res) => {
  // ● BREAKPOINT S5 - CONTROLLER: delete any score
  //   Trigger:  DELETE /scores/{id} for a score you did not submit
  //   Inspect:  req.user.email  and  score.playerEmail  after F10 - no check compares them.
  const score = await Score.findByIdAndDelete(req.params.id);
  if (!score) return res.status(404).json({ status: 'fail', message: 'Score not found.' });
  res.status(204).send();
};
