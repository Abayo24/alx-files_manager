import { v4 as uuidv4 } from 'uuid';
import crypto from'crypto';
import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

class AuthController {
  static async getConnect(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.log('Missing authorization  headers');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const base64Credentials = authHeader.split(' ')[1];
      const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');

      const [email, password] = decodedCredentials.split(':');
      const hashedPwd = crypto.createHash('sha1').update(password).digest('hex');

      const usersCollection = dbClient.client.db.collection('users');
      const found = await usersCollection.findOne({ email, password: hashedPwd });

      if (!found) {
        console.log('User not found');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const redisKey = `Auth_${uuidv4()}`;
      const expiration = 3600 * 24;

      await redisClient.set(redisKey, JSON.stringify(found), expiration);
      return res.json({ token: redisKey });
    } catch (error) {
      console.log(`getConnect Error -> ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await redisClient.get(`Auth_${token}`);
      if (!user) {
        console.log('User not found');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await redisClient.del(token);

      return res.status(204).send();
    } catch (error) {
      console.error(`getDisconnect Error -> ${error}`);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default AuthController;
