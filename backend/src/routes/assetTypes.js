import express from 'express';
import prisma from '../prismaClient.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const types = await prisma.assetType.findMany({ orderBy: { code: 'asc' } });
  res.json(types);
});

export default router;
