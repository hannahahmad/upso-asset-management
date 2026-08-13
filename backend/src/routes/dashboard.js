import express from 'express';
import prisma from '../prismaClient.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const totalAssets = await prisma.asset.count({ where: { active: true } });
  const amcCount = await prisma.asset.count({ where: { support_type: 'AMC', active: true } });
  const fmsCount = await prisma.asset.count({ where: { support_type: 'FMS', active: true } });

  const assetsByTypeGroup = await prisma.asset.groupBy({
    by: ['asset_type_id'],
    where: { active: true },
    _count: { id: true },
  });
  const typeIds = assetsByTypeGroup.map((item) => item.asset_type_id);
  const types = await prisma.assetType.findMany({ where: { id: { in: typeIds } } });
  const assetsByType = assetsByTypeGroup.map((item) => {
    const t = types.find((type) => type.id === item.asset_type_id);
    return {
      asset_type_id: item.asset_type_id,
      asset_type_name: t?.name || t?.code || `Type ${item.asset_type_id}`,
      asset_type_code: t?.code || '',
      _count: item._count,
    };
  });

  const assetsByLocationGroup = await prisma.asset.groupBy({
    by: ['location_id'],
    where: { active: true },
    _count: { id: true },
  });
  const locationIds = assetsByLocationGroup.map((item) => item.location_id);
  const locations = await prisma.location.findMany({ where: { id: { in: locationIds } } });
  const assetsByLocation = assetsByLocationGroup.map((item) => {
    const loc = locations.find((l) => l.id === item.location_id);
    return {
      location_id: item.location_id,
      location_name: loc?.location_name || `Location ${item.location_id}`,
      location_code: loc?.location_code || '',
      _count: item._count,
    };
  });

  const complaints = await prisma.serviceRequest.groupBy({
    by: ['status'],
    where: { active: true },
    _count: { id: true },
  });
  res.json({ totalAssets, amcCount, fmsCount, assetsByType, assetsByLocation, complaints });
});

export default router;
