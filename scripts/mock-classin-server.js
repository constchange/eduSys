// Simple mock server for ClassIn endpoints for local testing
// Usage: node scripts/mock-classin-server.js

const http = require('http');
const port = process.env.MOCK_CLASSIN_PORT || 4000;

let courseCounter = 1000;
let sessionCounter = 2000;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/courses') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      courseCounter++;
      res.writeHead(201, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ id: `mock-course-${courseCounter}`, body: JSON.parse(body) }));
    });
  } else if (req.method === 'PUT' && req.url.startsWith('/courses/')) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ success: true }));
  } else if (req.method === 'POST' && req.url === '/sessions') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      sessionCounter++;
      res.writeHead(201, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ id: `mock-session-${sessionCounter}`, body: JSON.parse(body) }));
    });
  } else if (req.method === 'PUT' && req.url.startsWith('/sessions/')) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ success: true }));
  } else {
    res.writeHead(404, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ error: 'not found' }));
  }
});

server.listen(port, () => console.log(`Mock ClassIn server listening on http://localhost:${port}`));
