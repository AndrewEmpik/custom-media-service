const {
  handleGetMediaList,
  handleUploadMedia,
  handleGetFileByKey,
  handleUpdateFileByKey,
  handleDeleteFileByKey,
  handleGetFileByIndex,
} = require("./handlers");

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

module.exports = { routes };
