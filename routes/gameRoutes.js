const express = require('express');
const gameController = require('../controllers/gameController');

const router = express.Router();

// ● BREAKPOINT R2 - ROUTE: the games router matched the URL
//   Trigger:  any /games request in Swagger, after clicking Authorize
//   Inspect:  req.method, req.baseUrl, req.path, req.user.email
//   Why:      req.user is already set - middleware/authenticate.js ran BEFORE this router
//             (BREAKPOINTS 12-15). Without a valid token you never reach this line.
//   Next:     F5 - the method + path decide which controller runs (BREAKPOINT 16 or G1-G4).
router.use((req, res, next) => {
  next();
});

// ● BREAKPOINT R3 - ROUTE: Express pulled :id out of the URL
//   Trigger:  GET, PATCH or DELETE /games/{id}
//   Inspect:  id  and  req.params.id  - the same string
//   Why:      router.param runs once for every route below that has :id in its path,
//             before the controller. It is the natural place to check an id.
//   Try:      send the id "abc". The controller's findById throws a CastError, and
//             middleware/errorHandler.js turns it into a 400.
router.param('id', (req, res, next, id) => {
  next();
});

// These lines run ONCE, at startup, to build the route table. A breakpoint on them only
// fires when the server starts - never per request. Use R2 and R3 instead.
router.route('/').get(gameController.getGames).post(gameController.createGame);

router
  .route('/:id')
  .get(gameController.getGame)
  .patch(gameController.updateGame)
  .delete(gameController.deleteGame);

module.exports = router;
