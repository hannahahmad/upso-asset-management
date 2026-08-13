import prisma from '../prismaClient.js';

export async function validateAssetReferences(data) {
  const errors = [];

  if (data.asset_type_id) {
    const type = await prisma.assetType.findUnique({ where: { id: Number(data.asset_type_id) } });
    if (!type) errors.push('Invalid asset_type_id');
  }

  if (data.location_id) {
    const location = await prisma.location.findUnique({ where: { id: Number(data.location_id) } });
    if (!location) errors.push('Invalid location_id');
  }

  return errors;
}

export async function validateServiceRequestReferences(data) {
  const errors = [];

  if (data.location_id) {
    const location = await prisma.location.findUnique({ where: { id: Number(data.location_id) } });
    if (!location) errors.push('Invalid location_id');
  }

  if (data.asset_id) {
    const asset = await prisma.asset.findUnique({ where: { id: Number(data.asset_id) } });
    if (!asset) errors.push('Invalid asset_id');
  }

  return errors;
}
