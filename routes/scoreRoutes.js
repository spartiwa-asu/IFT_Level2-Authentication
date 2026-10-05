const express = require('express');
const scoreController = require('../controllers/scoreController');

const router = express.Router();

// ● BREAKPOINT R4 - ROUTE: the scores router matched the URL
//   Trigger:  any /scores request in Swagger, after clicking Authorize
//   Inspect:  req.method, req.baseUrl, req.path, req.user.email
//   Why:      req.user is already set - middleware/authenticate.js ran BEFORE this router
//             (BREAKPOINTS 12-15). Without a valid token you never reach this line.
//   Next:     F5 - the method + path decide which controller runs (BREAKPOINTS S1-S5).
router.use((req, res, next) => {
  next();
});

// ● BREAKPOINT R5 - ROUTE: Express pulled :id out of the URL
//   Trigger:  GET, PATCH or DELETE /scores/{id}
//   Inspect:  id  and  req.params.id  - the same string
//   Why:      router.param runs once for every route below that has :id in its path,
//             before the controller. It is the natural place to check an id.
//   Try:      send the id "abc". The controller's findById throws a CastError, and
//             middleware/errorHandler.js turns it into a 400.
router.param('id', (req, res, next, id) => {
  next();
});

// These lines run ONCE, at startup, to build the route table. A breakpoint on them only
// fires when the server starts - never per request. Use R4 and R5 instead.
router.route('/').get(scoreController.getScores).post(scoreController.createScore);

router
  .route('/:id')
  .get(scoreController.getScore)
  .patch(scoreController.updateScore)
  .delete(scoreController.deleteScore);

module.exports = router;
