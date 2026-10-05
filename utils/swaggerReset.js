// Run only in the Swagger page. Never clear unrelated origin storage or API records.
module.exports = `(${function installSwaggerReset() {
  window.addEventListener('load', () => {
    const root = document.querySelector('#swagger-ui');
    if (!root) return;
    const section = document.createElement('section');
    section.className = 'swagger-reset';
    section.setAttribute('aria-labelledby', 'swagger-reset-title');
    section.innerHTML = '<h2 id="swagger-reset-title">Clear Swagger Data</h2>' +
      '<p>Start a fresh test by clearing Swagger authorization, entered request values, and displayed responses.</p>' +
      '<button type="button">Clear Swagger Data and Reload</button>' +
      '<p class="reset-status" role="status" aria-live="polite"></p>' +
      '<details><summary>Browser cache and cookies</summary>' +
      '<p>This reset affects this Swagger tab. It does not delete database records, revoke issued tokens, or clear browser-wide cache and cookies.</p>' +
      '<p>For Chrome site data, use the icon beside the address bar → Cookies and site data → Manage on-device site data, then remove this site and reload.</p>' +
      '<p>To bypass cached page files: Command + Shift + R on macOS, or Ctrl + Shift + R on Windows/Linux.</p>' +
      '</details>';
    root.before(section);
    const status = section.querySelector('.reset-status');
    try {
      if (sessionStorage.getItem('ift458.swaggerReset') === 'done') {
        sessionStorage.removeItem('ift458.swaggerReset');
        status.textContent = 'Swagger data cleared. Requests now require a new authorization. Example Value is documentation, not a live server response.';
      }
    } catch { /* Storage can be disabled; resetting this page still works. */ }
    section.querySelector('button').addEventListener('click', () => {
      window.ui?.authActions?.logout(['bearerAuth']);
      try {
        // Swagger UI uses this key when authorization persistence is enabled.
        localStorage.removeItem('authorized');
        sessionStorage.setItem('ift458.swaggerReset', 'done');
      } catch { /* The configured in-memory authorization is reset by reload. */ }
      window.location.reload();
    });
  });
}})();`;
