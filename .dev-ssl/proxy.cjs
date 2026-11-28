const https = require('https');
const http = require('http');
const fs = require('fs');

const options = {
  key: fs.readFileSync(__dirname + '/key.pem'),
  cert: fs.readFileSync(__dirname + '/cert.pem'),
};

const proxy = https.createServer(options, (req, res) => {
  const targetOptions = {
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: req.headers,
    rejectUnauthorized: false,
  };

  const proxyReq = http.request(targetOptions, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq, { end: true });
});

proxy.listen(8444, '0.0.0.0', () => {
  console.log('HTTPS proxy listening on https://sysyah.local:8444 -> http://localhost:3000');
});
