// Concatenates src/*.js (in sorted filename order) into template.html
// Outputs dist/index.html (production single-file page) and dist/dev.html (unminified dev build).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
let js = '';
for (const f of files) {
  js += '\n// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(srcDir, f), 'utf8');
}

const buildHash = crypto.createHash('sha1').update(js).digest('hex').slice(0, 12);
js = js.replace(/'__BUILD_HASH__'/g, () => "'" + buildHash + "'");

const tpl = fs.readFileSync(path.join(root, 'template.html'), 'utf8');
if (!tpl.includes('/*__JS__*/')) {
  throw new Error('template.html is missing /*__JS__*/ placeholder');
}

fs.mkdirSync(distDir, { recursive: true });
const devHtml = tpl.replace('/*__JS__*/', () => js);
fs.writeFileSync(path.join(distDir, 'dev.html'), devHtml, 'utf8');

// Production build: minify JS if MIN=1 and esbuild is available, otherwise clean standalone copy
let prodHtml = devHtml;
if (process.env.MIN === '1') {
  try {
    const tmp = path.join(distDir, '.tmp.js');
    fs.writeFileSync(tmp, js, 'utf8');
    const min = require('child_process').execFileSync(
      'npx',
      ['--yes', 'esbuild@0.24.2', tmp, '--minify-whitespace', '--minify-syntax', '--charset=utf8', '--legal-comments=none', '--log-level=warning'],
      { cwd: root, maxBuffer: 64 << 20 }
    ).toString();
    fs.unlinkSync(tmp);
    prodHtml = tpl.replace('/*__JS__*/', () => min);
  } catch (e) {
    console.warn('esbuild unavailable, writing unminified dist/index.html:', e.message.split('\n')[0]);
  }
}

fs.writeFileSync(path.join(distDir, 'index.html'), prodHtml, 'utf8');
console.log(
  `built CrazyBike [${buildHash}]: dist/index.html (${(prodHtml.length / 1024).toFixed(1)} KB), ` +
  `dist/dev.html (${(devHtml.length / 1024).toFixed(1)} KB) from ${files.length} modules`
);
