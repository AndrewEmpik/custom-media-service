const { createServer } = require("node:http");
const { handleRequest } = require("./router");

const hostname = "127.0.0.1";
const port = process.env.PORT || 3000;

const server = createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
