import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  source: user.source,
  location: user.location ? { id: user.location.id, name: user.location.location_name } : null,
});

router.get('/', authenticate, authorize('Administrator', 'AssetManager'), async (req, res) => {
  const { role } = req.query;
  const where = role ? { role } : {};
  const users = await prisma.user.findMany({ where, include: { location: true } });
  res.json(users.map(toPublicUser));
});

router.post('/', authenticate, authorize('Administrator'), async (req, res) => {
  const data = req.body;
  if (!data.name || !data.email || !data.password || !data.role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: 'Duplicate email' });

  let locationId = data.location_id ? Number(data.location_id) : null;
  if (locationId) {
    if (isNaN(locationId) || !Number.isInteger(locationId)) {
      return res.status(400).json({ error: 'Invalid location_id' });
    }
    const loc = await prisma.location.findUnique({ where: { id: locationId } });
    if (!loc) return res.status(400).json({ error: 'Location not found' });
  }

  const password = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email,
      password,
      role: data.role.trim(),
      location_id: locationId,
      source: 'manual',
    },
    include: { location: true },
  });
  res.json(toPublicUser(user));
});

router.patch('/:id', authenticate, authorize('Administrator'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const data = req.body;
  const updates = {};
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.role !== undefined) updates.role = data.role.trim();
  if (data.location_id !== undefined) {
    const locId = data.location_id ? Number(data.location_id) : null;
    if (locId) {
      if (isNaN(locId) || !Number.isInteger(locId)) {
        return res.status(400).json({ error: 'Invalid location_id' });
      }
      const loc = await prisma.location.findUnique({ where: { id: locId } });
      if (!loc) return res.status(400).json({ error: 'Location not found' });
    }
    updates.location_id = locId;
  }
  if (data.email !== undefined) {
    const email = data.email.trim().toLowerCase();
    const dup = await prisma.user.findUnique({ where: { email } });
    if (dup && dup.id !== id) return res.status(400).json({ error: 'Duplicate email' });
    updates.email = email;
  }
  if (data.password) {
    updates.password = await bcrypt.hash(data.password, 10);
  }

  const user = await prisma.user.update({ where: { id }, data: updates, include: { location: true } });
  res.json(toPublicUser(user));
});

router.delete('/:id', authenticate, authorize('Administrator'), async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'User not found' });
  if (existing.source === 'import') {
    return res.status(403).json({ error: 'Legacy imported users cannot be deleted.' });
  }
  await prisma.user.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
