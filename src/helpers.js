const os = require("os");
const { v4: uuidv4 } = require("uuid");

function getSystemUser() {
  const user = os.userInfo().username;
  return process.env.USER || process.env.USERNAME || user || "unknown";
}

function baseLog(msg, error = false) {
  const timeStamp = new Date();
  const msgFormatted = `[${timeStamp.toISOString()}] ${msg}`;
  if (!error) console.log(msgFormatted);
  else console.error(msgFormatted);
}

function startLog(req) {
  const requestId = uuidv4();
  baseLog(`[INFO] [${requestId}] ${req.method} ${req.url} - Started`);
  return requestId;
}

function endLog(requestId) {
  baseLog(`[INFO] [${requestId}] Finished successfully`);
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = [];
    req
      .on("data", (chunk) => body.push(chunk))
      .on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(body).toString()));
        } catch (err) {
          reject(new Error("Invalid JSON"));
        }
      })
      .on("error", reject);
  });
}
function getOptimalPartSize(fileSizeInBytes) {
  const ONE_GB = 1024 * 1024 * 1024; // 1 GB

  if (fileSizeInBytes < ONE_GB) {
    return 10 * 1024 * 1024; // 10 MB for files < 1 GB
  } else {
    return 100 * 1024 * 1024; // 100 MB for files >= 1 GB
  }
}

module.exports = {
  getSystemUser,
  baseLog,
  getOptimalPartSize,
  parseRequestBody,
  startLog,
  endLog,
};
