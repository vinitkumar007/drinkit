// Static checks for the web apps (no browser needed):
//  1. every JS file parses as an ES module
//  2. every relative import resolves to a real file
//  3. every /path referenced from an HTML file exists
//  4. no inline <script> or inline event handlers (the server's CSP forbids them)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..', 'web');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    fs.statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(root);

const rel = (p) => path.relative(path.join(__dirname, '..'), p);
let errors = 0;
const fail = (m) => { errors++; console.error('  ✗', m); };

for (const f of files.filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(f, 'utf8');
  const tmp = path.join(os.tmpdir(), `check-${process.pid}-${path.basename(f)}.mjs`);
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { fail(`${rel(f)} does not parse:\n${String(e.stderr).split('\n').slice(0, 4).join('\n')}`); }
  fs.unlinkSync(tmp);

  for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.[^'"]+)['"]/g)) {
    if (!fs.existsSync(path.resolve(path.dirname(f), m[1]))) fail(`${rel(f)} imports missing file ${m[1]}`);
  }
}

for (const f of files.filter((x) => x.endsWith('.html'))) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g)) {
    if (!fs.existsSync(path.join(root, m[1]))) fail(`${rel(f)} references missing ${m[1]}`);
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>[^<]/.test(html)) fail(`${rel(f)} has an inline <script> (blocked by CSP)`);
  if (/\son[a-z]+\s*=\s*"/.test(html)) fail(`${rel(f)} has an inline event handler (blocked by CSP)`);
}

console.log(errors ? `\n${errors} problem(s) found.` : `Web check passed: ${files.length} files.`);
process.exit(errors ? 1 : 0);
