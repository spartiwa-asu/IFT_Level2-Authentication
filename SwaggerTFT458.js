// ============================================================================
//  IFT 458 - Level 2 API documentation (OpenAPI 3.0)
//  ALL Swagger docs for this project live in this one file.
//  app.js serves it at  http://localhost:<PORT>/api-docs
//
//  To document a new route: add an entry under `paths`, and if it sends or
//  returns a new shape of data, add that shape under `components.schemas`.
// ============================================================================
const API = process.env.API_VERSION || '/api/v1';

const gameFields = {
  title: { type: 'string', maxLength: 200, example: 'Hollow Knight' },
  developer: { type: 'string', maxLength: 200, example: 'Team Cherry' },
  genre: { type: 'string', maxLength: 60, example: 'Metroidvania' },
  description: { type: 'string', maxLength: 2000, example: 'A hand-drawn adventure beneath a ruined kingdom.' },
  platform: { type: 'string', enum: ['pc', 'console', 'mobile', 'handheld', 'arcade'], example: 'pc' },
  status: { type: 'string', enum: ['active', 'retired'], example: 'active' },
  submittedBy: {
    type: 'string',
    example: 'Alice',
    description: 'Free text supplied by the authenticated client; not a verified ownership field.'
  }
};

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'MongoDB ObjectId of the game',
  schema: { type: 'string', example: '66f0c2a4e1b2c3d4e5f60718' }
};

// Each error shows the message the API really sends for it (copied from a real run),
// not one shared example - otherwise every 400/404 would claim "Incorrect email or password."
const errorResponse = (description, message) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { status: 'fail', message }
    }
  }
});
const AUTH_REQUIRED = 'Authentication required. Log in and provide a valid bearer token.';
const INVALID_ID = 'Invalid _id: abc';

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'IFT 458 Game Score Tracker - Level 2: Resource Authentication',
    version: '1.0.0',
    description: [
      'Log in to obtain a bearer token valid for 24 hours. Use Authorize to supply the token. All game and score operations require authentication.',
      '### Stateless HTTP and request credentials',
      'HTTP does not automatically remember a previous login. Every protected request must carry proof of identity. This application adds state through sessions stored in MongoDB; using a bearer token does not make the application stateless.',
      'Submit email and password in the JSON body of POST /users/login. For later requests, Swagger sends the returned token, not your password, in this header:',
      '```http\nAuthorization: Bearer <your-token>\n```',
      '### Why use the Authorization header',
      'It is the standard place for bearer credentials and avoids putting secrets in URLs, browser history, and URL logs. The header is not encryption. HTTPS protects headers and bodies in transit; plain HTTP does not. The localhost HTTP address is for local lab use. Use HTTPS for deployed or network-accessible use.',
      'Anyone with a bearer token can replay it until it expires or becomes invalid. Developer tools, the server, and TLS-terminating proxies can see it. Never share tokens, expose them in screenshots, or log Authorization headers. Clearing Swagger removes this tab’s credential; it does not revoke a copied token.',
      'References: [MDN HTTP overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview) and [RFC 6750 sections 2.1 and 5](https://www.rfc-editor.org/rfc/rfc6750). This project uses the bearer convention, not a complete OAuth implementation.'
    ].join('\n\n')
  },
  // Relative URL: "Try it out" calls the same host that served this page, so
  // http://localhost:4001 and http://<your-ip>:4001 both work with no CORS setup.
  servers: [{ url: API, description: 'This server' }],
  tags: [
    {
      name: 'Authentication',
      description: 'Start with POST /users/signup to create an application user, then POST /users/login ' +
        'to check that user’s email and password. Expand an endpoint and choose Try it out, edit the ' +
        'JSON body, then Execute. Use application credentials, not your MongoDB Atlas database user. ' +
        'Copy the login response token into Authorize before accessing games or scores.'
    },
    { name: 'Scores', description: 'Scores - authentication required' },
    { name: 'Games', description: 'Game catalogue CRUD - authentication required' }
  ],

  security: [{ bearerAuth: [] }],
  paths: {

    '/scores': {
      get: {
        tags: ['Scores'],
        summary: 'List scores (authentication required)',
        responses: {
          200: { description: 'Scores', content: { 'application/json': { schema: { $ref: '#/components/schemas/ScoreListResponse' } } } },
        }
      },
      post: {
        tags: ['Scores'],
        summary: 'Submit a score (authentication required)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ScoreInput' } } } },
        responses: {
          201: { description: 'Score created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ScoreResponse' } } } },
          400: errorResponse('Validation failed', 'A score needs a player email. A score needs a points value.')
        }
      }
    },

    '/scores/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, description: 'MongoDB ObjectId of the score', schema: { type: 'string' } }],
      get: {
        tags: ['Scores'],
        summary: 'Get one score (authentication required)',
        responses: {
          200: { description: 'The score', content: { 'application/json': { schema: { $ref: '#/components/schemas/ScoreResponse' } } } },
          400: errorResponse('Invalid id', INVALID_ID),
          404: errorResponse('Score not found', 'Score not found.')
        }
      },
      patch: {
        tags: ['Scores'],
        summary: 'Update a score, e.g. mark it verified (authentication required)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ScoreInput' } } } },
        responses: {
          200: { description: 'Updated score', content: { 'application/json': { schema: { $ref: '#/components/schemas/ScoreResponse' } } } },
          400: errorResponse('Invalid id', INVALID_ID),
          404: errorResponse('Score not found', 'Score not found.')
        }
      },
      delete: {
        tags: ['Scores'],
        summary: 'Delete a score (authentication required)',
        responses: {
          204: { description: 'Deleted' },
          400: errorResponse('Invalid id', INVALID_ID),
          404: errorResponse('Score not found', 'Score not found.')
        }
      }
    },
    '/users/signup': {
      post: {
        tags: ['Authentication'],
        security: [],
        summary: 'Register a new user',
        description: 'The password is hashed with bcrypt before it is stored. No token is returned.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } }
        },
        responses: {
          201: {
            description: 'User created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } } }
          },
          400: errorResponse('Validation failed (missing field, short password, passwords do not match)', 'Password must be at least 8 characters.'),
          409: errorResponse('Email already registered', 'That email is already in use.')
        }
      }
    },

    '/users/login': {
      post: {
        tags: ['Authentication'],
        security: [],
        summary: 'Log in and obtain a bearer token',
        description:
          'Returns a bearer token and expiresAt. Send Authorization: Bearer <token> on resource requests.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } }
        },
        responses: {
          200: {
            description: 'Credentials are valid',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } }
          },
          400: errorResponse('Email or password missing', 'Please provide email and password.'),
          401: errorResponse('Incorrect email or password (same message for both, on purpose)', 'Incorrect email or password.')
        }
      }
    },

    '/games': {
      get: {
        tags: ['Games'],
        summary: 'List all games',
        responses: {
          200: {
            description: 'All games, newest first',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GameListResponse' } } }
          }
        }
      },
      post: {
        tags: ['Games'],
        summary: 'Add a game (authentication required)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/GameInput' } } }
        },
        responses: {
          201: {
            description: 'Game created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GameResponse' } } }
          },
          400: errorResponse('Validation failed', 'A game needs a description. A game needs a developer.')
        }
      }
    },

    '/games/{id}': {
      parameters: [idParam],
      get: {
        tags: ['Games'],
        summary: 'Get one game',
        responses: {
          200: {
            description: 'The game',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GameResponse' } } }
          },
          400: errorResponse('Invalid id', INVALID_ID),
          404: errorResponse('Game not found', 'Game not found.')
        }
      },
      patch: {
        tags: ['Games'],
        summary: 'Edit ANY game (authentication required)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/GameUpdate' } } }
        },
        responses: {
          200: {
            description: 'Updated game',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GameResponse' } } }
          },
          400: errorResponse('Invalid id or validation failed', INVALID_ID),
          404: errorResponse('Game not found', 'Game not found.')
        }
      },
      delete: {
        tags: ['Games'],
        summary: 'Delete ANY game (authentication required)',
        responses: {
          204: { description: 'Deleted' },
          400: errorResponse('Invalid id', INVALID_ID),
          404: errorResponse('Game not found', 'Game not found.')
        }
      }
    }
  },

  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', description: 'Opaque session token returned by login; expires after 24 hours.' } },
    schemas: {
      ScoreInput: {
        type: 'object',
        required: ['gameTitle', 'points', 'playerEmail'],
        properties: {
          gameTitle: { type: 'string', example: 'Hollow Knight' },
          platform: { type: 'string', enum: ['pc', 'console', 'mobile', 'handheld', 'arcade'], example: 'pc' },
          points: { type: 'integer', minimum: 0, maximum: 100000000, example: 128400 },
          levelReached: { type: 'integer', minimum: 1, maximum: 999, example: 12 },
          playerEmail: { type: 'string', format: 'email', example: 'player1@ift458.test', description: 'Typed by the client - Level 1 cannot verify it' },
          status: { type: 'string', enum: ['submitted', 'verified', 'rejected', 'disputed'], example: 'submitted' },
          playedAt: { type: 'string', format: 'date-time' }
        }
      },
      Score: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66f0c2a4e1b2c3d4e5f60718' },
          gameTitle: { type: 'string', example: 'Hollow Knight' },
          platform: { type: 'string', enum: ['pc', 'console', 'mobile', 'handheld', 'arcade'] },
          points: { type: 'integer', example: 128400 },
          levelReached: { type: 'integer', nullable: true, example: 12 },
          userId: { type: 'string', nullable: true, description: 'The player' },
          playerEmail: { type: 'string', example: 'player1@ift458.test' },
          status: { type: 'string', enum: ['submitted', 'verified', 'rejected', 'disputed'] },
          playedAt: { type: 'string', format: 'date-time' },
          verifiedAt: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      ScoreResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: { type: 'object', properties: { score: { $ref: '#/components/schemas/Score' } } }
        }
      },
      ScoreListResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          results: { type: 'integer', example: 3 },
          data: { type: 'object', properties: { scores: { type: 'array', items: { $ref: '#/components/schemas/Score' } } } }
        }
      },
      SignupRequest: {
        type: 'object',
        required: ['name', 'email', 'password', 'passwordConfirmation'],
        properties: {
          name: { type: 'string', example: 'Alice Johnson' },
          email: { type: 'string', format: 'email', example: 'alice@ift458.test' },
          password: { type: 'string', format: 'password', minLength: 8, example: 'password12345' },
          passwordConfirmation: { type: 'string', format: 'password', example: 'password12345' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alice@ift458.test' },
          password: { type: 'string', format: 'password', example: 'password12345' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '66f0c2a4e1b2c3d4e5f60718' },
          name: { type: 'string', example: 'Alice Johnson' },
          email: { type: 'string', example: 'alice@ift458.test' }
        }
      },
      UserResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          token: { type: 'string', description: 'Bearer credential returned only at login' },
          expiresAt: { type: 'string', format: 'date-time' },
          data: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } }
        }
      },
      GameInput: {
        type: 'object',
        required: ['title', 'developer', 'description'],
        properties: gameFields
      },
      GameUpdate: {
        type: 'object',
        description: 'Send only the fields you want to change',
        properties: gameFields
      },
      Game: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66f0c2a4e1b2c3d4e5f60718' },
          ...gameFields,
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      GameResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: { type: 'object', properties: { game: { $ref: '#/components/schemas/Game' } } }
        }
      },
      GameListResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          results: { type: 'integer', example: 3 },
          data: {
            type: 'object',
            properties: { games: { type: 'array', items: { $ref: '#/components/schemas/Game' } } }
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'fail' },
          message: { type: 'string', example: 'What went wrong, in one sentence.' }
        }
      }
    }
  }
};

// Every documented resource operation uses the global bearer requirement.
for (const [path, operations] of Object.entries(module.exports.paths)) {
  if (!path.startsWith('/games') && !path.startsWith('/scores')) continue;
  for (const method of ['get', 'post', 'patch', 'delete']) {
    if (operations[method]) operations[method].responses[401] = errorResponse('Missing, invalid or expired bearer token', AUTH_REQUIRED);
  }
}
