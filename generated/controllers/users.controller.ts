
import { Request, Response } from 'express';
import { UserService } from '../services/users.service';

const service = new UserService();


export async function listUsers(req: Request, res: Response) {
  try {
    
    const result = await service.listUsers(req.query);
    
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function getUser(req: Request, res: Response) {
  try {
    
    const result = await service.getUser(req.params.id);
    
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function createUser(req: Request, res: Response) {
  try {
    
    const result = await service.createUser(req.body);
    
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function updateUser(req: Request, res: Response) {
  try {
    
    const result = await service.updateUser(req.params.id, req.body);
    
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export async function deleteUser(req: Request, res: Response) {
  try {
    
    await service.deleteUser(req.params.id);
    const result = { success: true };
    
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


