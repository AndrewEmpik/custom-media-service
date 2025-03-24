require("dotenv").config();
const fs = require("fs");
const path = require("path");

const { ListObjectsV2Command } = require("@aws-sdk/client-s3");

const { Upload } = require("@aws-sdk/lib-storage");

const { s3, checkFileExists, deleteObject } = require("./s3service");
const { validateFileType } = require("./validator");
const {
  startLog,
  baseLog,
  endLog,
  getSystemUser,
  parseRequestBody,
  getOptimalPartSize,
} = require("./helpers");

//////////////// GET LIST ////////////////
async function handleGetMediaList(req, res) {
  const requestId = startLog(req);

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

    const fileList = data.Contents.map((file) => ({
      Key: file.Key,
      Size: file.Size,
      LastModified: file.LastModified,
    }));

    baseLog(`[INFO] [${requestId}] File list: ${JSON.stringify(fileList)}`);

    endLog(requestId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(fileList));
  } catch (error) {
    baseLog(`[ERROR] [${requestId}] Error fetching files: ${error}`, true);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch media files" }));
  }
}

//////////////// GET FILE (KEY) ////////////////
async function handleGetFileByKey(req, res) {
  const requestId = startLog(req);

  const key = req.params.key;

  // AWS connection
  try {
    baseLog(`[INFO] [${requestId}] Downloading: "${key}"`);
    await downloadObject(key, res);

    endLog(requestId);
  } catch (error) {
    baseLog(`[ERROR] [${requestId}] Error fetching files: ${error}`, true);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch media files" }));
  }
}

//////////////// GET FILE (INDEX) ////////////////
async function handleGetFileByIndex(req, res) {
  const requestId = startLog(req);

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

    const fileList = data.Contents.map((file) => ({
      Key: file.Key,
      Size: file.Size,
      LastModified: file.LastModified,
    }));

    baseLog(`[INFO] [${requestId}] Downloading: "${fileList[index].Key}"`);
    await downloadObject(fileList[index].Key, res);

    endLog(requestId);
  } catch (error) {
    baseLog(`[ERROR] [${requestId}] Error fetching files: ${error}`, true);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch media files" }));
  }
}

//////////////// UPLOAD FILE ////////////////
async function handleUploadMedia(req, res) {
  const requestId = startLog(req);

  try {
    const { filePath } = await parseRequestBody(req);
    baseLog(`[INFO] [${requestId}] Body params: filePath = "${filePath}"`);

    if (!fs.existsSync(filePath)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "File not found" }));
    }

    const fileStream = fs.createReadStream(filePath);
    const fileName = path.basename(filePath);
    const contentType = await validateFileType(filePath);

    if (await checkFileExists(fileName)) {
      res.writeHead(409, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ error: "File already exists in the bucket" })
      );
    }

    const statsObj = fs.statSync(filePath);
    const originalModifiedDate = statsObj.mtime.toISOString();
    const systemUserName = getSystemUser();

    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: fileStream,
      ContentType: contentType,
      Metadata: {
        "original-filename": fileName,
        "original-modified-date": originalModifiedDate,
        "username-uploaded": systemUserName,
      },
    };

    const uploadObject = new Upload({
      client: s3,
      params: uploadParams,
      queueSize: 4,
      partSize: getOptimalPartSize(statsObj.size),
    });

    uploadObject.on("httpUploadProgress", (progress) => {
      baseLog(
        `[INFO] [${requestId}] Upload progress: ${JSON.stringify(progress)}`
      );
    });

    await uploadObject.done();

    endLog(requestId);

    res.writeHead(200, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({ message: `File ${fileName} uploaded successfully` })
    );
  } catch (err) {
    const errMessage = `Error uploading file: ${err.message}`;
    baseLog(`[ERROR] [${requestId}] ${errMessage}`, true);
    console.error(errMessage);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: errMessage }));
  }
}

//////////////// UPDATE FILE ////////////////
async function handleUpdateFileByKey(req, res) {
  // TODO Refactor: move repeated code to an external function
  const requestId = startLog(req);

  const key = req.params.key;

  if (!(await checkFileExists(key))) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "File not found in the bucket" }));
  }

  try {
    const { filePath } = await parseRequestBody(req);

    if (!fs.existsSync(filePath)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "File not found" }));
    }

    const fileStream = fs.createReadStream(filePath);

    const contentType = await validateFileType(filePath);

    const statsObj = fs.statSync(filePath);
    const originalModifiedDate = statsObj.mtime.toISOString();
    const systemUserName = getSystemUser();

    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: fileStream,
      ContentType: contentType,
      Metadata: {
        "original-filename": path.basename(filePath),
        "original-modified-date": originalModifiedDate,
        "username-uploaded": systemUserName,
      },
    };

    const uploadObject = new Upload({
      client: s3,
      params: uploadParams,
      queueSize: 4,
      partSize: getOptimalPartSize(statsObj.size),
    });

    uploadObject.on("httpUploadProgress", (progress) => {
      baseLog(
        `[INFO] [${requestId}] Upload progress: ${JSON.stringify(progress)}`
      );
    });

    await uploadObject.done();

    endLog(requestId);

    res.writeHead(200, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ message: `File ${key} updated successfully` }));
  } catch (err) {
    const errMessage = `Error uploading file: ${err.message}`;
    baseLog(`[ERROR] [${requestId}] ${errMessage}`, true);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: errMessage }));
  }
}

//////////////// DELETE FILE ////////////////
async function handleDeleteFileByKey(req, res) {
  const requestId = startLog(req);

  const key = req.params.key;

  // AWS connection
  try {
    baseLog(`[INFO] [${requestId}] Deleting: ${key}`);

    await deleteObject(key, res);

    endLog(requestId);
  } catch (error) {
    console.error("Error deleting files:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to delete media files" }));
  }
}

module.exports = {
  handleGetMediaList,
  handleUploadMedia,
  handleGetFileByKey,
  handleUpdateFileByKey,
  handleDeleteFileByKey,
  handleGetFileByIndex,
};
