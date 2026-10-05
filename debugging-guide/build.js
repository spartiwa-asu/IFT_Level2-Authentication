// ============================================================================
//  Refresh the breakpoint data inside debugging-guide/index.html:
//    npm run guide
//
//  Reads every "● BREAKPOINT" block from the source files and writes it, with
//  the real code and line numbers under it, into the <script id="bp-data">
//  block of index.html. Run it after editing any file that has a breakpoint,
//  so the guide never shows a stale line number.
// ============================================================================
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(__dirname, 'index.html');
const FILES = [
  'controllers/authController.js',
  'models/userModel.js',
  'middleware/authenticate.js',
  'controllers/gameController.js',
  'controllers/scoreController.js',
  'routes/userRoutes.js',
  'routes/gameRoutes.js',
  'routes/scoreRoutes.js',
  'labs/jwt-walkthrough.js'
];
const LABELS = 'Trigger|Inspect|Why|Try|Next|Check|Step over \\(F10\\), then inspect|In the DEBUG CONSOLE type|Run|Watch';

function extract() {
  const blocks = [];
  for (const file of FILES) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = /\/\/ ● BREAKPOINT (\S+)(?: of 16)?( \(inside\))? - (.*)$/.exec(line);
      if (!m) return;

      const comment = [];
      let j = i + 1;
      while (j < lines.length && /^\s*\/\//.test(lines[j])) comment.push(lines[j].replace(/^\s*\/\/ ?/, '')), j++;
      while (j < lines.length && !lines[j].trim()) j++;

      // A route's pass-through function: the line that runs per request is
      // next(), not the router.use(...) line that runs once at startup.
      let target = j;
      if (/=>\s*\{\s*$/.test(lines[j]) && /^\s*next\(\);\s*$/.test(lines[j + 1] || '')) target = j + 1;

      const fields = [];
      for (const text of comment) {
        const f = new RegExp(`^\\s{2}(${LABELS}):\\s*(.*)$`).exec(text);
        if (f) fields.push({ label: f[1], text: f[2].trim() });
        else if (fields.length && /^\s{3,}/.test(text)) fields[fields.length - 1].text += ' ' + text.trim();
        else fields.push({ label: '', text: text.trim() });
      }

      const last = Math.min(lines.length - 1, target + 3);
      blocks.push({
        id: m[1],
        inside: Boolean(m[2]),
        title: m[3].trim(),
        file,
        target: target + 1,
        fields: fields.filter((f) => f.text),
        code: lines.slice(i, last + 1).map((text, k) => ({ n: i + k + 1, text }))
      });
    });
  }
  return blocks;
}

const blocks = extract();
const page = fs.readFileSync(PAGE, 'utf8');
const pattern = /(<script id="bp-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!pattern.test(page)) throw new Error('index.html has no <script id="bp-data"> block to update.');
// "</" inside JSON would end the <script> element early
const json = JSON.stringify(blocks).replace(/<\//g, '<\\/');
fs.writeFileSync(PAGE, page.replace(pattern, (_, open, close) => `${open}${json}${close}`));
console.log(`debugging-guide/index.html: ${blocks.length} breakpoints refreshed`);
