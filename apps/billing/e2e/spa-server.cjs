const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
  let filePath = path.join(process.cwd(), req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(process.cwd(), 'index.html')));
    } else {
      res.writeHead(200);
      res.end(data);
    }
  });
});
server.listen(5174, '0.0.0.0', () => console.log('SPA server on 5174'));
