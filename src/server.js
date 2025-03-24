const { createServer } = require("node:http");
const { handleRequest } = require("./router");

//const hostname = "0.0.0.0";
const port = process.env.PORT || 3000;

const server = createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(port, () => {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] [INFO] Server - Started`);

  console.log(`Server running at http://localhost:${port}/`);
});
