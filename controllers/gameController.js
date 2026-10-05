const Game = require('../models/gameModel');
const pick = require('../utils/pick');

const GAME_FIELDS = ['title', 'developer', 'genre', 'description', 'platform', 'status', 'submittedBy'];

// GET /api/v1/games
exports.getGames = async (req, res) => {
  // ● BREAKPOINT 16 of 16 - CONTROLLER: authenticated, now do the work
  //   Trigger:  GET /games with a valid token (after BREAKPOINTS 12-15)
  //   Inspect:  req.user.email  - set by middleware/authenticate.js; the controller
  //             never sees the token, only WHO is calling.
  //   AUTHENTICATION vs AUTHORIZATION: authentication answered "who are you?". Nobody
  //   asks "are you ALLOWED to?" - see updateGame/deleteGame below: any logged-in user
  //   can change or delete any game. An authorization check (owner or role) would go
  //   at the top of those handlers, using req.user.
  const games = await Game.find().sort('-createdAt');
  res.status(200).json({ status: 'success', results: games.length, data: { games } });
};

// GET /api/v1/games/:id
exports.getGame = async (req, res) => {
  // ● BREAKPOINT G1 - CONTROLLER: read ONE game
  //   Trigger:  GET /games/{id} - copy an _id from the GET /games response
  //   Step over (F10), then inspect:  game  (a document, or null)
  //   Try:      a valid-looking id that does not exist, e.g. 66f0c2a4e1b2c3d4e5f60718 -
  //             game is null and you take the 404 branch. "abc" never gets this far:
  //             findById throws, and the error handler answers 400 (see BREAKPOINT R3).
  const game = await Game.findById(req.params.id);
  if (!game) return res.status(404).json({ status: 'fail', message: 'Game not found.' });
  res.status(200).json({ status: 'success', data: { game } });
};

// POST /api/v1/games
exports.createGame = async (req, res) => {
  // ● BREAKPOINT G2 - CONTROLLER: create a game
  //   Trigger:  POST /games - add an extra field to the body, e.g. "_id": "123" or "isAdmin": true
  //   Inspect:  req.body  compared with  pick(req.body, GAME_FIELDS)  (type it in the DEBUG CONSOLE)
  //   Why:      pick() keeps only the allow-listed fields, so the client cannot set fields
  //             you never meant to accept (mass assignment). F11 to step into utils/pick.js.
  //   Try:      leave out "title" - Game.create throws a ValidationError and you get 400.
  const game = await Game.create(pick(req.body, GAME_FIELDS));
  res.status(201).json({ status: 'success', data: { game } });
};

// PATCH /api/v1/games/:id  - ZERO AUTHORIZATION: anyone can edit any game
exports.updateGame = async (req, res) => {
  // ● BREAKPOINT G3 - CONTROLLER: update a game (authenticated, NOT authorized)
  //   Trigger:  PATCH /games/{id} logged in as a DIFFERENT user than the one who created it
  //   Inspect:  req.user.email  and  game.submittedBy  after F10 - they need not match.
  //   Why:      authenticate proved WHO you are; nothing here checks whether you may
  //             edit THIS game. runValidators: true re-checks the schema on update
  //             (Mongoose skips validation on updates by default).
  //   Try:      "platform": "toaster" - the enum validator rejects it with 400.
  const game = await Game.findByIdAndUpdate(req.params.id, pick(req.body, GAME_FIELDS), {
    returnDocument: 'after', // return the updated document, not the old one
    runValidators: true
  });
  if (!game) return res.status(404).json({ status: 'fail', message: 'Game not found.' });
  res.status(200).json({ status: 'success', data: { game } });
};

// DELETE /api/v1/games/:id  - ZERO AUTHORIZATION: anyone can delete any game
exports.deleteGame = async (req, res) => {
  // ● BREAKPOINT G4 - CONTROLLER: delete a game (authenticated, NOT authorized)
  //   Trigger:  DELETE /games/{id}
  //   Inspect:  game  after F10 - the document that was just removed
  //   Why:      204 means "success, no body", so send() has nothing to send. Run the same
  //             DELETE again: game is now null and you get 404.
  const game = await Game.findByIdAndDelete(req.params.id);
  if (!game) return res.status(404).json({ status: 'fail', message: 'Game not found.' });
  res.status(204).send();
};
