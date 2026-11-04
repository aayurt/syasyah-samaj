const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3100';

const server = http.createServer(async (req, res) => {
  // Proxy API requests to the backend API server (same-origin for cookies/CORS)
  if (req.url.startsWith('/api/')) {
    try {
      const apiUrl = new URL(req.url, API_BASE);
      const options = {
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        path: apiUrl.pathname + apiUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: apiUrl.host,
          origin: 'http://localhost:5174',
        },
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Proxy error: ${e.message}`);
      });

      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        req.pipe(proxyReq);
      } else {
        proxyReq.end();
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Proxy error: ${e.message}`);
    }
    return;
  }

  // Serve static files (SPA)
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
