import { UserService } from '../services/users.service.js';

const service = new UserService();

/**
 * List all users
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function listUsers(req, res) {
  try {
    const result = await service.listUsers(req.query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get a single user by ID
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function getUser(req, res) {
  try {
    const result = await service.getUser(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create a new user
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function createUser(req, res) {
  try {
    const result = await service.createUser(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update an existing user
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function updateUser(req, res) {
  try {
    const result = await service.updateUser(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete a user
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export async function deleteUser(req, res) {
  try {
    await service.deleteUser(req.params.id);
    const result = { success: true };
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}