require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const routes = {
  "/media": {
    GET: handleGetMediaList,
    POST: handleUploadMedia,
  },

  "/media/:key": {
    GET: handleGetFileByKey,
    PUT: handleUpdateFileByKey,
    DELETE: handleDeleteFileByKey,
  },

  "/media/index/:index": {
    GET: handleGetFileByIndex,
  },
};

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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

async function handleGetMediaList(req, res) {
  console.log(" >> handleGetMediaList", req.url, req.method);

  // AWS connection
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET,
    });
    const data = await s3.send(command);

    if (!data.Contents) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "No files found" }));
    }

    console.log(data.Contents);

    const fileList = data.Contents.map((file) => ({
      Key: file.Key,
      Size: file.Size,
      LastModified: file.LastModified,
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(fileList));
  } catch (error) {
    console.error("Error fetching files:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch media files" }));
  }
}

async function handleGetFileByKey(req, res) {
  console.log(" >> handleGetFileByKey", req.params);

  const key = req.params.key;

  // AWS connection
  try {
    console.log("Downloading:");
    console.log(key);
    await downloadObject(key, res);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch media files" }));
  }
}

async function handleGetFileByIndex(req, res) {
  console.log(" >> handleGetFileByIndex", req.params);

  const index = parseInt(req.params.index);

  // AWS connection
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET,
    });
    const data = await s3.send(command);

    if (!data.Contents) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "No files found" }));
    }

    //console.log(data.Contents);

    const fileList = data.Contents.map((file) => ({
      Key: file.Key,
      Size: file.Size,
      LastModified: file.LastModified,
    }));

    console.log("Downloading:");
    console.log(fileList[index].Key);
    await downloadObject(fileList[index].Key, res);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch media files" }));
  }
}

async function handleUploadMedia(req, res) {
  const { url, method } = req;
  console.log("handleUploadMedia", url, method);
  console.log(req.a);

  try {
    let body = [];
    req
      .on("data", (chunk) => {
        body.push(chunk);
      })
      .on("end", async () => {
        body = Buffer.concat(body).toString();
        const { filePath } = JSON.parse(body);

        if (!fs.existsSync(filePath)) {
          res.writeHead(400, { "Content-Type": "image/jpeg" });
          return res.end(JSON.stringify({ error: "File not found" }));
        }

        const fileStream = fs.createReadStream(filePath);
        const fileName = path.basename(filePath);

        const uploadParams = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: fileName,
          Body: fileStream,
          ContentType: "image/jpeg",
        };

        await s3.send(new PutObjectCommand(uploadParams));

        res.writeHead(200, {
          ContentType: "image/jpeg",
        });
        res.end(
          JSON.stringify({ message: `File ${fileName} uploaded successfully` })
        );
      });
  } catch (err) {
    console.error("Error uploading file:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}

function handleUpdateFileByKey(req, res) {
  console.log(" >> handleUpdateFileByKey");
}

async function handleDeleteFileByKey(req, res) {
  console.log(" >> handleDeleteFileByKey", req.params);

  const key = req.params.key;

  // AWS connection
  try {
    console.log("Deleting:");
    console.log(key);
    await deleteObject(key, res);
  } catch (error) {
    console.error("Error deleting files:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to delete media files" }));
  }
}

const downloadObject = async (key, res) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });

  try {
    const { Body, ContentType } = await s3.send(command);

    res.writeHead(200, {
      "Content-Type": ContentType || "application/octet-stream",
    });

    await new Promise((resolve, reject) => {
      Body.pipe(res).on("finish", resolve).on("error", reject);
    });

    console.log("Object streamed successfully:", key);
  } catch (err) {
    console.error("Error fetching an object:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Error retrieving an object.");
  }
};

const deleteObject = async (key, res) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });

  try {
    await s3.send(command);
    console.log(`Object "${key}" deleted successfully.`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ message: `Object "${key}" deleted successfully.` })
    );
  } catch (err) {
    console.error("Error deleting an object:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error deleting an object." }));
  }
};

module.exports = { handleRequest };
