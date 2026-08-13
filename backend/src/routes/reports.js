import express from 'express';
import prisma from '../prismaClient.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/summary', authenticate, async (req, res) => {
  const assetsByLocation = await prisma.asset.groupBy({
    by: ['location_id'],
    where: { active: true },
    _count: { id: true },
  });
  const locationIds = assetsByLocation.map((item) => item.location_id);
  const locations = await prisma.location.findMany({ where: { id: { in: locationIds } } });
  const assetsByLocationWithName = assetsByLocation.map((item) => ({
    location_id: item.location_id,
    location_name: locations.find((loc) => loc.id === item.location_id)?.location_name || 'Unknown',
    count: item._count.id,
  }));
  const complaintsByPriority = await prisma.serviceRequest.groupBy({
    by: ['priority'],
    where: { active: true },
    _count: { id: true },
  });

  const assetsByType = await prisma.asset.groupBy({
    by: ['asset_type_id'],
    where: { active: true },
    _count: { id: true },
  });
  const typeIds = assetsByType.map((item) => item.asset_type_id);
  const types = await prisma.assetType.findMany({ where: { id: { in: typeIds } } });
  const assetsByTypeWithName = assetsByType.map((item) => ({
    asset_type_id: item.asset_type_id,
    asset_type_code: types.find((t) => t.id === item.asset_type_id)?.code || 'Unknown',
    asset_type_name: types.find((t) => t.id === item.asset_type_id)?.name || 'Unknown',
    count: item._count.id,
  }));

  res.json({ assetsByLocation: assetsByLocationWithName, assetsByType: assetsByTypeWithName, complaintsByPriority });
});

export default router;
