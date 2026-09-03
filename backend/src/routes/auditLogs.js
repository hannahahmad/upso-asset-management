import express from 'express';
import prisma from '../prismaClient.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, authorize('Administrator', 'AssetManager'), async (req, res) => {
  const { entity_type, entity_id } = req.query;
  const where = {};
  if (entity_type) where.entity_type = entity_type;
  if (entity_id) {
    if (entity_type === 'ServiceRequest') {
      where.service_request_id = Number(entity_id);
    } else {
      where.asset_id = Number(entity_id);
    }
  }
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { changed_at: 'desc' },
  });
  res.json(logs);
});

export default router;
