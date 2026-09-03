import express from 'express';
import prisma from '../prismaClient.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateAssetReferences } from './dataHelpers.js';
import { updateWorkbookAtomically, getColumnMap, ensurePoQuantityColumn } from '../utils/excelLock.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { search, status, location_id, support_type, owner_user_id, asset_type_id } = req.query;
  const where = { active: true };

  // Role-based access scoping
  if (req.user.role === 'User') {
    where.owner_user_id = req.user.userId;
  } else if (req.user.role === 'LocationCoordinator' && req.user.location_id) {
    where.location_id = req.user.location_id;
  }

  if (search) {
    where.OR = [
      { asset_id: { contains: search, mode: 'insensitive' } },
      { serial_number: { contains: search, mode: 'insensitive' } },
      { current_owner: { contains: search, mode: 'insensitive' } },
      { make: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status) where.lifecycle_status = status;
  if (location_id && (req.user.role === 'Administrator' || req.user.role === 'AssetManager')) {
    where.location_id = Number(location_id);
  }
  if (support_type) where.support_type = support_type;
  if (owner_user_id && (req.user.role === 'Administrator' || req.user.role === 'AssetManager')) {
    where.owner_user_id = Number(owner_user_id);
  }
  if (asset_type_id) where.asset_type_id = Number(asset_type_id);
  const assets = await prisma.asset.findMany({
    where,
    include: { asset_type: true, location: true },
    orderBy: { updated_at: 'desc' },
  });
  res.json(assets);
});

router.get('/:id', authenticate, async (req, res) => {
  const asset = await prisma.asset.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      asset_type: true,
      location: true,
      auditLogs: true,
      serviceRequests: true,
    },
  });
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  // Authorization checks
  if (req.user.role === 'User' && asset.owner_user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden: Access denied to this asset.' });
  }
  if (req.user.role === 'LocationCoordinator' && req.user.location_id && asset.location_id !== req.user.location_id) {
    return res.status(403).json({ error: 'Forbidden: Asset belongs to another location.' });
  }

  res.json(asset);
});

const generateAssetIdForPo = async (poNumber, assetTypeId) => {
  const safePo = (poNumber || 'NA').trim() || 'NA';
  let typeCode = 'SW';
  if (assetTypeId) {
    const t = await prisma.assetType.findUnique({ where: { id: Number(assetTypeId) } });
    if (t?.code) typeCode = t.code.toUpperCase();
  }
  let n = (await prisma.asset.count()) + 1;
  let candidate = `UPSO1/IS/${safePo}/${typeCode}/${String(n).padStart(4, '0')}`;
  while (await prisma.asset.findUnique({ where: { asset_id: candidate } })) {
    n += 1;
    candidate = `UPSO1/IS/${safePo}/${typeCode}/${String(n).padStart(4, '0')}`;
  }
  return candidate;
};

router.post('/', authenticate, authorize('Administrator', 'AssetManager'), async (req, res) => {
  const data = req.body;
  const assetTypeId = Number(data.asset_type_id);
  const locationId = Number(data.location_id);
  const assetIdValue = data.asset_id?.trim();

  if (!data.serial_number || !assetTypeId || !locationId || !data.support_type) {
    return res.status(400).json({ error: 'Missing required asset fields' });
  }
  if (!Number.isInteger(assetTypeId) || !Number.isInteger(locationId)) {
    return res.status(400).json({ error: 'Invalid asset_type_id or location_id' });
  }

  const existingSerial = await prisma.asset.findUnique({ where: { serial_number: data.serial_number.trim() } });
  if (existingSerial) return res.status(400).json({ error: 'Duplicate serial_number' });

  if (assetIdValue) {
    const existingAsset = await prisma.asset.findUnique({ where: { asset_id: assetIdValue } });
    if (existingAsset) return res.status(400).json({ error: 'Duplicate asset_id' });
  }

  const poNumber = data.po_number?.trim() || null;
  const poQuantity = data.po_quantity !== undefined && data.po_quantity !== null && String(data.po_quantity).trim() !== '' ? Number(data.po_quantity) : null;
  if (poQuantity !== null && (isNaN(poQuantity) || !Number.isInteger(poQuantity) || poQuantity < 1)) {
    return res.status(400).json({ error: 'po_quantity must be a positive integer >= 1' });
  }

  const preparedData = {
    asset_id: assetIdValue || await generateAssetIdForPo(poNumber, assetTypeId),
    serial_number: data.serial_number.trim(),
    asset_type_id: assetTypeId,
    location_id: locationId,
    support_type: data.support_type.trim(),
    make: data.make?.trim() || null,
    model: data.model?.trim() || null,
    description: data.description?.trim() || null,
    po_number: poNumber,
    po_quantity: poQuantity,
    current_owner: data.current_owner?.trim() || null,
    owner_user_id: data.owner_user_id ? Number(data.owner_user_id) : null,
    lifecycle_status: data.lifecycle_status?.trim() || 'InStock',
  };

  const referenceErrors = await validateAssetReferences(preparedData);
  if (referenceErrors.length) {
    return res.status(400).json({ error: referenceErrors.join(', ') });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({ data: preparedData });
      
      const excelInventoryPath = process.env.EXCEL_INVENTORY_PATH || '../Inventory Detail (1).xlsx';
      await updateWorkbookAtomically(excelInventoryPath, async (workbook) => {
        const sheet = workbook.worksheets[0];
        const headerRow = sheet.getRow(1);
        
        let poColIndex = null;
        headerRow.eachCell((cell, idx) => {
          const norm = String(cell.value).trim().replace(/\s+/g, ' ').toUpperCase();
          if (norm === 'PO') poColIndex = idx;
        });
        if (!poColIndex) {
          poColIndex = headerRow.cellCount + 1;
          headerRow.getCell(poColIndex).value = 'PO';
        }

        // Call the shared helper to ensure column exists
        ensurePoQuantityColumn(sheet);

        const colMap = getColumnMap(sheet, [
          'S.NO.',
          'SUPPORT TYPE',
          'ASSET TYPE',
          'DETAILS',
          'DESCRIPTION',
          'SERIAL NUMBER',
          'ASSET LOCATION',
          'ASSET OWNER',
          'PO',
          'PO QUANTITY'
        ]);
        
        let foundRow = null;
        sheet.eachRow((r, idx) => {
          if (idx === 1) return;
          if (String(r.getCell(colMap['SERIAL NUMBER']).value).trim() === preparedData.serial_number) {
            foundRow = r;
          }
        });

        const assetType = await tx.assetType.findUnique({ where: { id: preparedData.asset_type_id } });
        const location = await tx.location.findUnique({ where: { id: preparedData.location_id } });

        const row = foundRow || sheet.addRow([]);
        if (!foundRow) {
          const lastRow = sheet.lastRow;
          const nextSNo = lastRow && lastRow !== headerRow ? (Number(lastRow.getCell(colMap['S.NO.']).value) || 0) + 1 : 1;
          row.getCell(colMap['S.NO.']).value = nextSNo;
        }
        row.getCell(colMap['SUPPORT TYPE']).value = preparedData.support_type;
        row.getCell(colMap['ASSET TYPE']).value = assetType?.code || '';
        row.getCell(colMap['DETAILS']).value = preparedData.make || '';
        row.getCell(colMap['DESCRIPTION']).value = preparedData.description || '';
        row.getCell(colMap['SERIAL NUMBER']).value = preparedData.serial_number;
        row.getCell(colMap['ASSET LOCATION']).value = location?.location_name || '';
        row.getCell(colMap['ASSET OWNER']).value = preparedData.current_owner || '';
        row.getCell(colMap['PO']).value = preparedData.po_number || '';
        row.getCell(colMap['PO QUANTITY']).value = preparedData.po_quantity;
      });

      await tx.auditLog.create({
        data: {
          entity_type: 'Asset',
          asset_id: asset.id,
          action: 'Create',
          new_value: JSON.stringify(preparedData),
          changed_by: String(req.user.userId),
          remark: 'Created asset',
        },
      });

      return asset;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create asset and sync with Excel.' });
  }
});

const UPDATABLE_FIELDS = [
  'asset_id',
  'serial_number',
  'asset_type_id',
  'location_id',
  'support_type',
  'make',
  'model',
  'description',
  'po_number',
  'po_quantity',
  'current_owner',
  'owner_user_id',
  'lifecycle_status',
];

router.patch('/:id', authenticate, authorize('Administrator', 'AssetManager'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Asset not found' });

  const data = req.body;
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (data[field] === undefined) continue;
    if (field === 'asset_type_id' || field === 'location_id' || field === 'owner_user_id') {
      updates[field] = data[field] ? Number(data[field]) : null;
    } else if (field === 'po_quantity') {
      const val = data[field] !== null && String(data[field]).trim() !== '' ? Number(data[field]) : null;
      if (val !== null && (isNaN(val) || !Number.isInteger(val) || val < 1)) {
        return res.status(400).json({ error: 'po_quantity must be a positive integer >= 1' });
      }
      updates[field] = val;
    } else {
      const value = typeof data[field] === 'string' ? data[field].trim() : data[field];
      updates[field] = value || null;
    }
  }

  if (updates.po_number !== undefined && updates.po_number !== existing.po_number && updates.asset_id === undefined) {
    updates.asset_id = await generateAssetIdForPo(updates.po_number);
  }

  if (updates.serial_number) {
    const dup = await prisma.asset.findUnique({ where: { serial_number: updates.serial_number } });
    if (dup && dup.id !== id) return res.status(400).json({ error: 'Duplicate serial_number' });
  }
  if (updates.asset_id) {
    const dup = await prisma.asset.findUnique({ where: { asset_id: updates.asset_id } });
    if (dup && dup.id !== id) return res.status(400).json({ error: 'Duplicate asset_id' });
  }

  const referenceErrors = await validateAssetReferences(updates);
  if (referenceErrors.length) {
    return res.status(400).json({ error: referenceErrors.join(', ') });
  }

  const changedFields = Object.keys(updates).filter((field) => String(existing[field] ?? '') !== String(updates[field] ?? ''));
  if (changedFields.length === 0) {
    return res.json(existing);
  }

  const oldValues = {};
  const newValues = {};
  changedFields.forEach((field) => {
    oldValues[field] = existing[field];
    newValues[field] = updates[field];
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.update({ where: { id }, data: updates });

      const excelInventoryPath = process.env.EXCEL_INVENTORY_PATH || '../Inventory Detail (1).xlsx';
      await updateWorkbookAtomically(excelInventoryPath, async (workbook) => {
        const sheet = workbook.worksheets[0];
        const headerRow = sheet.getRow(1);

        let poColIndex = null;
        headerRow.eachCell((cell, idx) => {
          const norm = String(cell.value).trim().replace(/\s+/g, ' ').toUpperCase();
          if (norm === 'PO') poColIndex = idx;
        });
        if (!poColIndex) {
          poColIndex = headerRow.cellCount + 1;
          headerRow.getCell(poColIndex).value = 'PO';
        }

        // Call the shared helper to ensure column exists
        ensurePoQuantityColumn(sheet);

        const colMap = getColumnMap(sheet, [
          'S.NO.',
          'SUPPORT TYPE',
          'ASSET TYPE',
          'DETAILS',
          'DESCRIPTION',
          'SERIAL NUMBER',
          'ASSET LOCATION',
          'ASSET OWNER',
          'PO',
          'PO QUANTITY'
        ]);

        let foundRow = null;
        sheet.eachRow((r, idx) => {
          if (idx === 1) return;
          if (String(r.getCell(colMap['SERIAL NUMBER']).value).trim() === (updates.serial_number || existing.serial_number)) {
            foundRow = r;
          }
        });

        const assetType = await tx.assetType.findUnique({ where: { id: asset.asset_type_id } });
        const location = await tx.location.findUnique({ where: { id: asset.location_id } });

        const row = foundRow || sheet.addRow([]);
        if (!foundRow) {
          const lastRow = sheet.lastRow;
          const nextSNo = lastRow && lastRow !== headerRow ? (Number(lastRow.getCell(colMap['S.NO.']).value) || 0) + 1 : 1;
          row.getCell(colMap['S.NO.']).value = nextSNo;
        }
        row.getCell(colMap['SUPPORT TYPE']).value = asset.support_type;
        row.getCell(colMap['ASSET TYPE']).value = assetType?.code || '';
        row.getCell(colMap['DETAILS']).value = asset.make || '';
        row.getCell(colMap['DESCRIPTION']).value = asset.description || '';
        row.getCell(colMap['SERIAL NUMBER']).value = asset.serial_number;
        row.getCell(colMap['ASSET LOCATION']).value = location?.location_name || '';
        row.getCell(colMap['ASSET OWNER']).value = asset.current_owner || '';
        row.getCell(colMap['PO']).value = asset.po_number || '';
        row.getCell(colMap['PO QUANTITY']).value = asset.po_quantity;
      });

      await tx.auditLog.create({
        data: {
          entity_type: 'Asset',
          asset_id: asset.id,
          action: 'Update',
          field_changed: changedFields.join(', '),
          old_value: JSON.stringify(oldValues),
          new_value: JSON.stringify(newValues),
          changed_by: String(req.user.userId),
          remark: 'Updated asset',
        },
      });

      return asset;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update asset and sync with Excel.' });
  }
});

router.delete('/:id', authenticate, authorize('Administrator', 'AssetManager'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Asset not found' });
  if (existing.source === 'import') {
    return res.status(403).json({ error: 'Legacy imported assets cannot be deleted.' });
  }
  
  await prisma.$transaction(async (tx) => {
    await tx.asset.update({ where: { id }, data: { active: false } });
    await tx.auditLog.create({
      data: {
        entity_type: 'Asset',
        asset_id: id,
        action: 'Delete',
        field_changed: 'active',
        old_value: 'true',
        new_value: 'false',
        changed_by: String(req.user.userId),
        remark: 'Soft deleted asset',
      },
    });
  });

  res.json({ success: true });
});

export default router;
