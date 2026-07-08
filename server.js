const http = require("http");

const PORT = process.env.PORT || 10000;

const BACKEND_HOST = process.env.BACKEND_HOST || "161.97.69.206";
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 80);
const BACKEND_DOMAIN = process.env.BACKEND_DOMAIN || "redfilm.win";

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function cleanHeaders(headers) {
  const result = { ...headers };

  for (const key of Object.keys(result)) {
    if (hopByHopHeaders.has(key.toLowerCase())) {
      delete result[key];
    }
  }

  return result;
}

const server = http.createServer((clientReq, clientRes) => {
  const headers = cleanHeaders(clientReq.headers);

  const forwardedFor = [
    clientReq.headers["x-forwarded-for"],
    clientReq.socket.remoteAddress,
  ]
    .filter(Boolean)
    .join(", ");

  headers.host = BACKEND_DOMAIN;
  headers["x-forwarded-host"] = clientReq.headers.host || BACKEND_DOMAIN;
  headers["x-forwarded-proto"] = "https";
  headers["x-forwarded-for"] = forwardedFor;
  headers["x-real-ip"] = clientReq.socket.remoteAddress || "";

  const proxyReq = http.request(
    {
      host: BACKEND_HOST,
      port: BACKEND_PORT,
      method: clientReq.method,
      path: clientReq.url,
      headers,
    },
    (proxyRes) => {
      const responseHeaders = cleanHeaders(proxyRes.headers);

      if (responseHeaders.location) {
        responseHeaders.location = responseHeaders.location
          .toString()
          .replace("http://redfilm.win", "https://redfilm.win")
          .replace("http://www.redfilm.win", "https://www.redfilm.win");
      }

      clientRes.writeHead(proxyRes.statusCode || 502, responseHeaders);
      proxyRes.pipe(clientRes);
    }
  );

  proxyReq.on("error", (error) => {
    console.error("Proxy error:", error);

    if (!clientRes.headersSent) {
      clientRes.writeHead(502, {
        "content-type": "text/plain; charset=utf-8",
      });
    }

    clientRes.end("Bad Gateway");
  });

  clientReq.pipe(proxyReq);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`REDFILM edge proxy listening on 0.0.0.0:${PORT}`);
  console.log(`Backend: http://${BACKEND_HOST}:${BACKEND_PORT}`);
});
