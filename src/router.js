require("dotenv").config();

const { routes } = require("./routes");

function handleRequest(req, res) {
  const method = req.method;
  const url = req.url.replace(/\/$/, "");
  const staticRoute = routes[url]?.[method];

  if (staticRoute) {
    return staticRoute(req, res);
  }

  const dynamicMatch = parseDynamicRoute(url, method);
  if (dynamicMatch?.handler) {
    req.params = dynamicMatch.params;
    console.log("req.params: ", req.params);
    return dynamicMatch.handler(req, res);
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
}

function parseDynamicRoute(url, method) {
  console.log("----- parseDynamicRoute");
  console.log(url);
  const urlParts = url.split("/");
  console.log(urlParts);
  const routeParts = Object.keys(routes)
    .filter((path) => path.includes(":"))
    .find((path) => {
      const pathParts = path.split("/");
      return (
        pathParts.length === urlParts.length &&
        pathParts.every(
          (part, i) => part.startsWith(":") || part === urlParts[i]
        )
      );
    });

  if (!routeParts) return null;

  const params = {};
  routeParts.split("/").forEach((part, i) => {
    if (part.startsWith(":")) {
      params[part.slice(1)] = urlParts[i];
    }
  });

  return {
    handler: routes[routeParts][method],
    params,
  };
}

module.exports = { handleRequest };
