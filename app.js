// All resource routes require a valid bearer session.
const express = require('express');
const swaggerUi = require('swagger-ui-express');

const swaggerDocument = require('./SwaggerTFT458');
const authController = require('./controllers/authController');
const gameController = require('./controllers/gameController');
const scoreController = require('./controllers/scoreController');

const userRoutes = require('./routes/userRoutes');
const gameRoutes = require('./routes/gameRoutes');
const scoreRoutes = require('./routes/scoreRoutes');
const authenticate = require('./middleware/authenticate');
const requestLogger = require('./middleware/requestLogger');
const corsMiddleware = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');
const { createLogger } = require('./utils/logger');

const API = process.env.API_VERSION || '/api/v1';

// Give every exported handler a name, so the request log can say which
// controller ran: [authController.login] instead of [(no controller)].
function tagControllers(modules) {
  for (const [moduleName, controllerModule] of Object.entries(modules)) {
    for (const [exportName, handler] of Object.entries(controllerModule)) {
      if (typeof handler === 'function') handler.controllerName = `${moduleName}.${exportName}`;
    }
  }
}

// server.js passes its logger in; tests can call createApp() with no argument
module.exports = function createApp(log = createLogger({ name: 'app-test', toConsole: false }), tracker = null) {
  tagControllers({ authController, gameController, scoreController });

  const app = express();

  // 1) Body parser: read JSON request bodies into req.body
  app.use(express.json());

  // 2) Log every request: route, controller, payload, outcome (and on failure,
  //    an ordered checklist of what to check)
  app.use(requestLogger(log, tracker));

  // 2b) CORS for other websites listed in CORS_ORIGINS (see middleware/cors.js).
  //     It must run BEFORE authenticate: the browser's OPTIONS preflight never
  //     carries the bearer token, so authenticate would answer it with 401.
  app.use(corsMiddleware());

  // 3) API documentation - open http://localhost:4001/api-docs
  app.use('/api-docs', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    swaggerOptions: { persistAuthorization: false },
    customJsStr: require('./utils/swaggerReset'),
    customCss: '.swagger-reset { max-width: 1420px; margin: 24px auto; padding: 20px; font: 16px/1.5 system-ui, sans-serif; color: #17202a; background: #f3f6fa; border: 1px solid #cbd5e1; border-radius: 8px; } .swagger-reset h2 { margin: 0 0 8px; font-size: 22px; } .swagger-reset button { padding: 10px 16px; border: 0; border-radius: 4px; background: #174ea6; color: white; font: inherit; cursor: pointer; } .swagger-reset button:focus-visible { outline: 3px solid #111; outline-offset: 3px; } .swagger-reset summary { cursor: pointer; } .swagger-reset .reset-status:empty { display: none; }'
  }));
  app.get('/', (req, res) => res.redirect('/api-docs'));

  // 4) Routes - the ORDER of these lines is the order a request travels.
  //   Signup/login:  express.json -> requestLogger -> userRoutes -> authController
  //                  (BREAKPOINTS 1-11: no token needed yet)
  //   Games/scores:  express.json -> requestLogger -> authenticate -> gameRoutes/scoreRoutes
  //                  -> gameController/scoreController (BREAKPOINTS 12-16)
  //   Every route file also has a per-request stop (BREAKPOINTS R1-R5), and every
  //   game/score handler has one (G1-G4, S1-S5).
  //   Breakpoints on these app.use() lines only fire once, at startup, when the chain
  //   is built. To follow a request, put breakpoints INSIDE the functions they register.
  app.use(API, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(`${API}/users`, userRoutes); // signup + login
  // Mount the guard before resource routers so future API resources are protected too.
  app.use(API, authenticate);
  app.use(`${API}/games`, gameRoutes);
  app.use(`${API}/scores`, scoreRoutes);

  // 5) 404 + central error handler (Express 5 forwards async errors here automatically)
  app.use((req, res, next) => {
    const err = new Error(`Cannot find ${req.method} ${req.originalUrl}`);
    err.statusCode = 404;
    next(err);
  });
  app.use(errorHandler(log));

  return app;
};
