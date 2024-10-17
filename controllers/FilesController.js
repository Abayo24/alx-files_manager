import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import ObjectId from'mongodb';
import fs from 'fs-extra';
import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';
// import fileQueue from 'fileQueue';

/**
 * FileController class handles file-related operations.
 */
class FileController {
  /**
   * Creates a new file in the database and starts background processing
   * for generating thumbnails if the file type is 'image'.
   *
   * @param {object} req - The request object, containing file data and user info.
   * @param {object} res - The response object, used to send back the appropriate
   *  HTTP status and data.
   * @returns {object} The newly created file document, or an error message if something goes wrong.
   */
  static async postUpload(req, res) {
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const fileDocument = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? 0 : ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileName = uuidv4();
    const filePath = `${FOLDER_PATH}/${fileName}`;

    fs.mkdirSync(FOLDER_PATH, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

    fileDocument.localPath = filePath;
    const result = await dbClient.db.collection('files').insertOne(fileDocument);

    if (type === 'image') {
      await fileQueue.add({ userId, fileId: result.insertedId.toString() });
    }

    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  /**
 * Retrieves a file document based on the provided ID.
 *
 * @param {object} req - The request object, containing parameters and headers.
 * @param {object} res - The response object, used to send back the appropriate
 * HTTP status and data.
 * @returns {object} The file document if found, or an error message if not found or unauthorized.
 */
  static async getShow(req, res) {
    const { id } = req.params;
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);

    // If user is not authenticated, return an error
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the file document by ID and userId
    const fileDocument = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    // If the file document is not found, return an error
    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Return the file document
    return res.status(200).json(fileDocument);
  }

  /**
 * Retrieves a list of file documents for the authenticated user,
 * based on the provided parentId and page for pagination.
 *
 * @param {object} req - The request object, containing query parameters and headers.
 * @param {object} res - The response object, used to send back the appropriate
 *  HTTP status and data.
 * @returns {array} An array of file documents, or an error message if unauthorized.
 */
  static async getIndex(req, res) {
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);

    // If user is not authenticated, return an error
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get query parameters for parentId and page
    const { parentId = 0, page = 0 } = req.query;
    const pageSize = 20;

    // Find file documents for the authenticated user
    const files = await dbClient.db.collection('files')
      .find({
        userId: ObjectId(userId),
        parentId: parentId === '0' ? 0 : ObjectId(parentId),
      })
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();

    // Return the list of file documents
    return res.status(200).json(files);
  }

  /**
   * Publishes a file by setting `isPublic` to true based on the provided ID.
   *
   * @param {object} req - The request object, containing parameters and headers.
   * @param {object} res - The response object, used to send back the appropriate
   *  HTTP status and data.
   * @returns {object} The updated file document, or an error message if not found or unauthorized.
   */
  static async putPublish(req, res) {
    const { id } = req.params;
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);

    // If user is not authenticated, return an error
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the file document by ID and userId
    const fileDocument = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    // If the file document is not found, return an error
    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update the value of isPublic to true
    await dbClient.db.collection('files').updateOne(
      { _id: ObjectId(id) },
      { $set: { isPublic: true } },
    );

    // Return the updated file document
    fileDocument.isPublic = true;
    return res.status(200).json(fileDocument);
  }

  /**
   * Unpublishes a file by setting `isPublic` to false based on the provided ID.
   *
   * @param {object} req - The request object, containing parameters and headers.
   * @param {object} res - The response object, used to send back the appropriate
   *  HTTP status and data.
   * @returns {object} The updated file document, or an error message if not found or unauthorized.
   */
  static async putUnpublish(req, res) {
    const { id } = req.params;
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);

    // If user is not authenticated, return an error
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the file document by ID and userId
    const fileDocument = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    // If the file document is not found, return an error
    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update the value of isPublic to false
    await dbClient.db.collection('files').updateOne(
      { _id: ObjectId(id) },
      { $set: { isPublic: false } },
    );

    // Return the updated file document
    fileDocument.isPublic = false;
    return res.status(200).json(fileDocument);
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;
    const userId = await redisClient.get(`auth_${req.headers['x-token']}`);

    const fileDocument = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      $or: [
        { userId: ObjectId(userId) },
        { isPublic: true },
      ],
    });

    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (fileDocument.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    let filePath = fileDocument.localPath;
    if (size && [500, 250, 100].includes(parseInt(size, 10))) {
      filePath = `${filePath}_${size}`;
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(fileDocument.name);
    res.setHeader('Content-Type', mimeType);
    return res.status(200).sendFile(filePath);
  }
}

export default FileController;
