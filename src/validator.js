const mime = require("mime-types");
const fileType = require("file-type");
const path = require("path");

const allowedMajorTypes = ["image", "video", "audio"];

function checkMajorTypeAllowed(mimeType) {
  if (!mimeType) {
    throw new Error("Unable to determine MIME type of a file");
  }
  const [major] = mimeType.split("/");
  if (!allowedMajorTypes.includes(major))
    throw new Error(`Forbidden file category: ${major}`);
}

function validateByExtension(filePath) {
  const filename = path.basename(filePath);
  const type = mime.lookup(filename);
  checkMajorTypeAllowed(type);
  return type;
}

async function validateByContent(filePath) {
  const type = await fileType.fromFile(filePath);
  checkMajorTypeAllowed(type?.mime);
  return type.mime;
}

async function validateFileType(filePath) {
  try {
    // here, we may already obtain an error
    const contentType = validateByExtension(filePath);

    // detecting the actual content type
    const contentTypeDeep = await validateByContent(filePath);

    return contentTypeDeep;
  } catch (error) {
    throw new Error(`Error validating file: ${error.message}`);
  }
}

module.exports = {
  validateFileType,
};
