// ============================================================================
//  Browser client: sign up, log in, list games.
//  Open DevTools -> Network while you use it: each button is one HTTP request,
//  the same ones Swagger sends. A request with a JSON body or an Authorization
//  header may show an OPTIONS "preflight" first - CORS asking the API for
//  permission (the browser caches the answer for 10 minutes).
// ============================================================================

// Same host the page came from, API port 4001. Opened as http://192.168.1.5:5173,
// it calls http://192.168.1.5:4001 - so that origin must be in CORS_ORIGINS too.
const API_BASE = `${location.protocol}//${location.hostname}:4001/api/v1`;

// The token lives in this variable only. Reloading the page logs you out.
// localStorage would survive a reload, but any script on the page (including an
// injected one - XSS) could read it and replay the token until it expires.
let session = null; // { token, expiresAt, user }

const $ = (selector) => document.querySelector(selector);

function showStatus(message, kind = 'info') {
  const status = $('#status');
  status.textContent = message;
  status.className = kind;
}

// One place for every call: JSON in, JSON out, bearer token when logged in.
async function api(method, path, body) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (session) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: body && JSON.stringify(body) });
  } catch {
    // fetch() only throws when there is NO usable response: the API is down, or
    // the browser blocked it (CORS). The browser hides which one, on purpose -
    // the console (F12) shows the real reason.
    throw new Error(
      `Could not reach ${API_BASE}. Is "npm start" running, and does CORS_ORIGINS in .env include ${location.origin}? Check the browser console (F12).`
    );
  }

  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) {
    const error = new Error(data.message || `Request failed with ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

function formData(form) {
  return Object.fromEntries(new FormData(form));
}

function render() {
  $('#signed-out').hidden = Boolean(session);
  $('#signed-in').hidden = !session;
  if (session) {
    $('#who').textContent = session.user.email;
    $('#expires').textContent = new Date(session.expiresAt).toLocaleString();
  } else {
    $('#games').replaceChildren();
  }
}

$('#signup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const { data } = await api('POST', '/users/signup', formData(event.target));
    event.target.reset();
    $('#login-form').email.value = data.user.email;
    showStatus(`Account created for ${data.user.email}. Now log in.`, 'ok');
  } catch (err) {
    showStatus(`Sign up failed: ${err.message}`, 'error');
  }
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const { token, expiresAt, data } = await api('POST', '/users/login', formData(event.target));
    session = { token, expiresAt, user: data.user };
    event.target.reset();
    render();
    showStatus('Logged in. Your requests now carry Authorization: Bearer <token>.', 'ok');
  } catch (err) {
    showStatus(`Log in failed: ${err.message}`, 'error');
  }
});

$('#load-games').addEventListener('click', async () => {
  try {
    const { results, data } = await api('GET', '/games');
    // textContent, never innerHTML: game fields are typed in by users, and
    // innerHTML would run any <script> or <img onerror=...> hidden in them.
    const rows = data.games.map((game) => {
      const row = document.createElement('tr');
      for (const value of [game.title, game.developer, game.genre, game.platform, game.status]) {
        const cell = document.createElement('td');
        cell.textContent = value ?? '';
        row.append(cell);
      }
      return row;
    });
    $('#games').replaceChildren(...rows);
    showStatus(`${results} game(s) loaded.`, 'ok');
  } catch (err) {
    if (err.status === 401) {
      // Expired or unknown token: the server no longer accepts it, so drop it.
      session = null;
      render();
      showStatus(`Your session is no longer valid (${err.message}) Please log in again.`, 'error');
    } else {
      showStatus(`Loading games failed: ${err.message}`, 'error');
    }
  }
});

// There is no logout endpoint in Level 2, so this only forgets the token in
// THIS page. The session in MongoDB stays valid until it expires: a copy of the
// token still works. Revoking it on the server is a later level.
$('#logout').addEventListener('click', () => {
  session = null;
  render();
  showStatus('Logged out in this page. The token itself is still valid until it expires.', 'info');
});

$('#api-base').textContent = API_BASE;
render();
