import express from 'express';
import prisma from '../prismaClient.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password, portal } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  if (portal === 'admin' && user.role === 'User') {
    return res.status(403).json({ error: 'Please use the User login page.' });
  }
  if (portal === 'user' && user.role !== 'User') {
    return res.status(403).json({ error: 'Please use the Admin login page.' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role, location_id: user.location_id }, process.env.JWT_SECRET, { expiresIn: '8h' });

  let syncResult = null;
  let syncError = null;
  if (user.role === 'Administrator') {
    try {
      const { runSync } = await import('../services/syncService.js');
      syncResult = await runSync();
    } catch (err) {
      syncError = err.message || 'Excel synchronization failed';
    }
  }

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, location_id: user.location_id },
    syncResult,
    syncError
  });
});

export default router;
