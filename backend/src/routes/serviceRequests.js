import express from 'express';
import prisma from '../prismaClient.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateServiceRequestReferences } from './dataHelpers.js';
import { updateWorkbookAtomically } from '../utils/excelLock.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { status, location_id, priority, mine } = req.query;
  const where = { active: true };
  if (status) where.status = status;
  if (location_id) where.location_id = Number(location_id);
  if (priority) where.priority = priority;
  if (req.user.role === 'User') {
    where.submitted_by_user_id = req.user.userId;
  } else if (mine === 'true') {
    where.submitted_by_user_id = req.user.userId;
  }
  const requests = await prisma.serviceRequest.findMany({
    where,
    include: { location: true, asset: { include: { location: true } }, submittedBy: true },
    orderBy: { logged_date: 'desc' },
  });
  res.json(requests);
});

router.get('/:id', authenticate, async (req, res) => {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: Number(req.params.id) },
    include: { location: true, asset: { include: { location: true } }, auditLogs: true, submittedBy: true },
  });
  if (!request) return res.status(404).json({ error: 'Service request not found' });
  if (req.user.role === 'User' && request.submitted_by_user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(request);
});

const generateUniqueRequestId = async () => {
  let requestId;
  let exists;
  do {
    requestId = `SR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    exists = await prisma.serviceRequest.findUnique({ where: { request_id: requestId } });
  } while (exists);
  return requestId;
};

router.post('/', authenticate, authorize('Administrator', 'AssetManager', 'LocationCoordinator', 'Engineer', 'User'), async (req, res) => {
  const data = req.body;
  const assetId = data.asset_id ? Number(data.asset_id) : undefined;
  const requestIdValue = data.request_id?.trim();

  let locationId = Number(data.location_id);

  if (req.user.role === 'User') {
    if (!assetId || !Number.isInteger(assetId)) {
      return res.status(400).json({ error: 'Asset is required.' });
    }
    const ownedAsset = await prisma.asset.findFirst({ where: { id: assetId, owner_user_id: req.user.userId } });
    if (!ownedAsset) {
      return res.status(403).json({ error: 'You can only raise complaints for assets allotted to you.' });
    }
    locationId = ownedAsset.location_id;
  }

  if (!data.title || !locationId || !data.category || !data.priority) {
    return res.status(400).json({ error: 'Missing required service request fields' });
  }
  if (!Number.isInteger(locationId) || (data.asset_id && !Number.isInteger(assetId))) {
    return res.status(400).json({ error: 'Invalid location_id or asset_id' });
  }

  if (requestIdValue) {
    const existingRequest = await prisma.serviceRequest.findUnique({ where: { request_id: requestIdValue } });
    if (existingRequest) return res.status(400).json({ error: 'Duplicate request_id' });
  }

  const generatedId = requestIdValue || await generateUniqueRequestId();

  const preparedData = {
    request_id: generatedId,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    location_id: locationId,
    category: data.category.trim(),
    sub_category: data.sub_category?.trim() || null,
    priority: data.priority.trim(),
    asset_id: data.asset_id ? assetId : undefined,
    reported_by: data.reported_by?.trim() || null,
    submitter: data.submitter?.trim() || null,
    submitted_by_user_id: req.user.role === 'User' ? req.user.userId : (data.submitted_by_user_id ? Number(data.submitted_by_user_id) : null),
    assigned_engineer: data.assigned_engineer?.trim() || null,
    status: data.status?.trim() || 'New',
    sub_location: data.sub_location?.trim() || null,
    expected_resolution_date: data.expected_resolution_date || null,
    sla_flag: data.sla_flag?.trim() || null,
  };

  const referenceErrors = await validateServiceRequestReferences(preparedData);
  if (referenceErrors.length) {
    return res.status(400).json({ error: referenceErrors.join(', ') });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.create({ data: preparedData });

      const excelServiceRequestPath = process.env.EXCEL_SERVICE_REQUEST_PATH || '../ServiceRequestReport-639195597679312838 (2).xlsx';
      await updateWorkbookAtomically(excelServiceRequestPath, async (workbook) => {
        const sheet = workbook.worksheets[0];
        const headerRow = sheet.getRow(1);
        
        let statusCol = null;
        let resCol = null;
        headerRow.eachCell((cell, idx) => {
          const norm = String(cell.value).trim().replace(/\s+/g, ' ').toUpperCase();
          if (norm === 'STATUS') statusCol = idx;
          if (norm === 'RESOLUTION') resCol = idx;
        });
        if (!statusCol) {
          statusCol = headerRow.cellCount + 1;
          headerRow.getCell(statusCol).value = 'STATUS';
        }
        if (!resCol) {
          resCol = headerRow.cellCount + 1;
          headerRow.getCell(resCol).value = 'RESOLUTION';
        }

        const colMap = getColumnMap(sheet, [
          'ServiceRequestId',
          'Logged Date',
          'LOCATION',
          'SUB LOCATION',
          'CATEGORY',
          'SUB CATEGORY',
          'PRIORITY',
          'TITLE (REQUEST SUBJECT)',
          'Request Description',
          'Serial No',
          'End User Name',
          'Submitter',
          'STATUS',
          'RESOLUTION'
        ]);

        let foundRow = null;
        sheet.eachRow((r, idx) => {
          if (idx === 1) return;
          if (String(r.getCell(colMap['ServiceRequestId']).value).trim() === generatedId) {
            foundRow = r;
          }
        });

        const location = await tx.location.findUnique({ where: { id: preparedData.location_id } });
        const asset = preparedData.asset_id ? await tx.asset.findUnique({ where: { id: preparedData.asset_id } }) : null;

        const row = foundRow || sheet.addRow([]);
        row.getCell(colMap['ServiceRequestId']).value = generatedId;
        row.getCell(colMap['Logged Date']).value = new Date().toLocaleDateString('en-GB');
        row.getCell(colMap['LOCATION']).value = location?.location_name || '';
        row.getCell(colMap['SUB LOCATION']).value = preparedData.sub_location || '';
        row.getCell(colMap['CATEGORY']).value = preparedData.category;
        row.getCell(colMap['SUB CATEGORY']).value = preparedData.sub_category || '';
        row.getCell(colMap['PRIORITY']).value = preparedData.priority;
        row.getCell(colMap['TITLE (REQUEST SUBJECT)']).value = preparedData.title;
        row.getCell(colMap['Request Description']).value = preparedData.description || '';
        row.getCell(colMap['Serial No']).value = asset?.serial_number || '';
        row.getCell(colMap['End User Name']).value = preparedData.reported_by || req.user.name || '';
        row.getCell(colMap['Submitter']).value = preparedData.submitter || req.user.name || '';
        row.getCell(colMap['STATUS']).value = preparedData.status;
        row.getCell(colMap['RESOLUTION']).value = '';
      });

      await tx.auditLog.create({
        data: {
          entity_type: 'ServiceRequest',
          service_request_id: request.id,
          action: 'Create',
          new_value: JSON.stringify(data),
          changed_by: String(req.user.userId),
          remark: 'Created service request',
        },
      });

      return request;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create service request and sync with Excel.' });
  }
});

const UPDATABLE_FIELDS = [
  'location_id',
  'sub_location',
  'category',
  'sub_category',
  'priority',
  'title',
  'description',
  'asset_id',
  'reported_by',
  'submitter',
  'status',
  'resolution',
  'assigned_engineer',
  'expected_resolution_date',
  'sla_flag',
];

router.patch('/:id', authenticate, authorize('Administrator', 'AssetManager', 'LocationCoordinator', 'Engineer'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Service request not found' });

  const data = req.body;
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    if (data[field] === undefined) continue;
    if (field === 'location_id') {
      updates[field] = Number(data[field]);
    } else if (field === 'asset_id') {
      updates[field] = data[field] ? Number(data[field]) : null;
    } else if (field === 'expected_resolution_date') {
      updates[field] = data[field] ? new Date(data[field]) : null;
    } else {
      const value = typeof data[field] === 'string' ? data[field].trim() : data[field];
      updates[field] = value || null;
    }
  }

  const referenceErrors = await validateServiceRequestReferences(updates);
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
      const request = await tx.serviceRequest.update({ where: { id }, data: updates });

      const excelServiceRequestPath = process.env.EXCEL_SERVICE_REQUEST_PATH || '../ServiceRequestReport-639195597679312838 (2).xlsx';
      await updateWorkbookAtomically(excelServiceRequestPath, async (workbook) => {
        const sheet = workbook.worksheets[0];
        const headerRow = sheet.getRow(1);

        let statusCol = null;
        let resCol = null;
        headerRow.eachCell((cell, idx) => {
          const norm = String(cell.value).trim().replace(/\s+/g, ' ').toUpperCase();
          if (norm === 'STATUS') statusCol = idx;
          if (norm === 'RESOLUTION') resCol = idx;
        });
        if (!statusCol) {
          statusCol = headerRow.cellCount + 1;
          headerRow.getCell(statusCol).value = 'STATUS';
        }
        if (!resCol) {
          resCol = headerRow.cellCount + 1;
          headerRow.getCell(resCol).value = 'RESOLUTION';
        }

        const colMap = getColumnMap(sheet, [
          'ServiceRequestId',
          'STATUS',
          'RESOLUTION'
        ]);

        let foundRow = null;
        sheet.eachRow((r, idx) => {
          if (idx === 1) return;
          if (String(r.getCell(colMap['ServiceRequestId']).value).trim() === request.request_id) {
            foundRow = r;
          }
        });

        if (foundRow) {
          if (updates.status !== undefined) foundRow.getCell(colMap['STATUS']).value = updates.status;
          if (updates.resolution !== undefined) foundRow.getCell(colMap['RESOLUTION']).value = updates.resolution || '';
        }
      });

      await tx.auditLog.create({
        data: {
          entity_type: 'ServiceRequest',
          service_request_id: request.id,
          action: 'Update',
          field_changed: changedFields.join(', '),
          old_value: JSON.stringify(oldValues),
          new_value: JSON.stringify(newValues),
          changed_by: String(req.user.userId),
          remark: 'Updated service request',
        },
      });

      return request;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update service request and sync with Excel.' });
  }
});

router.delete('/:id', authenticate, authorize('Administrator', 'AssetManager', 'LocationCoordinator'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Service request not found' });
  if (existing.source === 'import') {
    return res.status(403).json({ error: 'Legacy imported service requests cannot be deleted.' });
  }
  await prisma.serviceRequest.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
