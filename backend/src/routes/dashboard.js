import express from 'express';
import prisma from '../prismaClient.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const assetWhere = { active: true };
  const srWhere = { active: true };

  if (req.user.role === 'LocationCoordinator' && req.user.location_id) {
    assetWhere.location_id = req.user.location_id;
    srWhere.location_id = req.user.location_id;
  } else if (req.user.role === 'User') {
    assetWhere.owner_user_id = req.user.userId;
    srWhere.submitted_by_user_id = req.user.userId;
  }

  const totalAssets = await prisma.asset.count({ where: assetWhere });
  const amcCount = await prisma.asset.count({ where: { ...assetWhere, support_type: 'AMC' } });
  const fmsCount = await prisma.asset.count({ where: { ...assetWhere, support_type: 'FMS' } });

  const assetsByTypeGroup = await prisma.asset.groupBy({
    by: ['asset_type_id'],
    where: assetWhere,
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
    where: assetWhere,
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
    where: srWhere,
    _count: { id: true },
  });
  res.json({ totalAssets, amcCount, fmsCount, assetsByType, assetsByLocation, complaints });
});

export default router;
