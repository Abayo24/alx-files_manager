const crypto = require('crypto');
import dbClient from '../utils/db.js';

/**
 * UserController class to handle user-related operations.
 */
class UserController {
  /**
     * Handles the creation of a new user.
     *
     * @param {Object} req - The request object.
     * @param {Object} req.body - The body of the request.
     * @param {string} req.body.email - The email of the new user.
     * @param {string} req.body.password - The password of the new user.
     * @param {Object} res - The response object.
     * @returns {Promise<Object>} The response object with the status and JSON data.
     */
  static async postNew(req, res) {
    // Method implementation
    try {
      const { email, password } = req.body;
      if (!email) {
        return res.status(400).send({ error: 'Missing email' });
      }
      if (!password) {
        return res.status(400).send({ error: 'Missing password' });
      }

      // Check if a user with the same email already exists
      const existingUser = await dbClient.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).send({ error: 'User with this email already exists' });
      }

      // Hash the password using SHA1
      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

      // Insert new user into the database
      const result = await dbClient.getCollection('users').insertOne({ email, password: hashedPassword });

      // Return the new user with email and auto-generated ID
      return res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
 * Retrieves the authenticated user's information.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.headers - The headers of the request.
 * @param {string} req.headers.authorization - The authorization header containing the Bearer token.
 * @param {Object} res - The response object.
 * @returns {Promise<void>} - A promise that resolves to sending
 *                          the user's information or an error message.
 *
 * @throws {Error} - If there is an internal server error.
 */
  static async getMe(req, res) {
    try {
      const authHeader = req.hearders.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      const token = authHeader.split(' ')[1];
      const user = await dbClient.getUserByToken(token);
      if (!user) {
        return res.status(401).send({ error: 'Unauthorized' });
      }
      return res.status(200).json({ id: user._id, email: user.email });
    } catch (error) {
      console.error(error);
      return res.status(500).send({ error: 'Internal server error' });
    }
  }
}

export default UserController;
 