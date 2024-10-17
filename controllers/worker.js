const Bull = require('bull');
const { ObjectId } = require('mongodb');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const dbClient = require('../utils/db');

// Initialize Bull queue
const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const fileDocument = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!fileDocument) throw new Error('File not found');

  const options = [
    { width: 500 },
    { width: 250 },
    { width: 100 },
  ];

  const thumbnails = await Promise.all(
    options.map((option) => imageThumbnail(fileDocument.localPath, option)),
  );

  thumbnails.forEach((thumbnail, index) => {
    const filePath = `${fileDocument.localPath}_${options[index].width}`;
    fs.writeFileSync(filePath, thumbnail);
  });
});
