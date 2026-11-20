// Zero-dependency static dev server for CrazyBike
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = +(process.env.PORT || 8080);
const distDir = path.join(__dirname, '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  let file = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath === '/dev' ? 'dev.html' : urlPath);
  if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(distDir, 'index.html');
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CrazyBike dev server running at http://localhost:${port}  (dev mode: http://localhost:${port}/dev?dev)`);
});
