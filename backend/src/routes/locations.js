import express from 'express';
import prisma from '../prismaClient.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const locations = await prisma.location.findMany({
    include: {
      assets: true,
      serviceRequests: true,
    },
  });
  const payload = locations.map((loc) => ({
    id: loc.id,
    location_name: loc.location_name,
    location_code: loc.location_code,
    region: loc.region,
    accountable_contact: loc.accountable_contact,
    source: loc.source,
    asset_count: loc.assets.length,
    open_complaint_count: loc.serviceRequests.filter((req) => req.active && req.status !== 'Resolved' && req.status !== 'Closed').length,
  }));
  res.json(payload);
});

router.post('/', authenticate, authorize('Administrator'), async (req, res) => {
  const data = req.body;
  if (!data.location_name || !data.location_code) {
    return res.status(400).json({ error: 'location_name and location_code are required' });
  }
  const code = data.location_code.trim();
  const existing = await prisma.location.findUnique({ where: { location_code: code } });
  if (existing) return res.status(400).json({ error: 'Duplicate location_code' });

  const location = await prisma.location.create({
    data: {
      location_name: data.location_name.trim(),
      location_code: code,
      region: data.region?.trim() || null,
      accountable_contact: data.accountable_contact?.trim() || null,
      source: 'manual',
    },
  });
  res.json(location);
});

router.patch('/:id', authenticate, authorize('Administrator'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Location not found' });

  const data = req.body;
  const updates = {};
  if (data.location_name !== undefined) updates.location_name = data.location_name.trim();
  if (data.location_code !== undefined) updates.location_code = data.location_code.trim();
  if (data.region !== undefined) updates.region = data.region?.trim() || null;
  if (data.accountable_contact !== undefined) updates.accountable_contact = data.accountable_contact?.trim() || null;

  if (updates.location_code) {
    const dup = await prisma.location.findUnique({ where: { location_code: updates.location_code } });
    if (dup && dup.id !== id) return res.status(400).json({ error: 'Duplicate location_code' });
  }

  const location = await prisma.location.update({ where: { id }, data: updates });
  res.json(location);
});

router.delete('/:id', authenticate, authorize('Administrator'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Location not found' });
  try {
    await prisma.location.delete({ where: { id } });
  } catch (error) {
    return res.status(400).json({ error: 'Cannot delete a location that still has assets, service requests, or users assigned to it.' });
  }
  res.json({ success: true });
});

export default router;
