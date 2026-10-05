const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// ● BREAKPOINT R1 - ROUTE: the users router matched the URL
//   Trigger:  Swagger -> POST /users/signup or POST /users/login
//   Inspect:  req.method, req.originalUrl, req.baseUrl, req.path
//   Why:      app.js mounted this router at /api/v1/users and stripped that prefix, so
//             req.path is just '/signup' or '/login' - that is what the lines below match.
//             No token is checked here: app.js mounts this router BEFORE authenticate.
//   Next:     F5 - you land in controllers/authController.js (BREAKPOINT 1 or 6).
router.use((req, res, next) => {
  next();
});

// These router.post() lines run ONCE, at startup, to build the route table. A breakpoint
// on them only fires when the server starts - never per request. Use R1 instead.
router.post('/signup', authController.signup);
router.post('/login', authController.login);

module.exports = router;
