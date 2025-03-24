const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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
    console.log(`Object "${key}" deleted successfully (if existed).`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: `Object "${key}" deleted successfully (if existed).`,
      })
    );
  } catch (err) {
    console.error("Error deleting an object:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error deleting an object." }));
  }
};

async function checkFileExists(key) {
  try {
    const res = await s3.send(
      new HeadObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      })
    );
    console.log(res);
    return true; // file exists
  } catch (error) {
    if (error.name === "NotFound") return false;
    throw error;
  }
}

module.exports = {
  s3,
  downloadObject,
  deleteObject,
  checkFileExists,
};
