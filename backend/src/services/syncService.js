import Excel from 'exceljs';
import path from 'path';
import fs from 'fs';
import prisma from '../prismaClient.js';
import { ensurePoQuantityColumn, updateWorkbookAtomically } from '../utils/excelLock.js';

const locationAliases = {
  'AMBABAI DEPOT': 'AMBABAI DEPOT',
  'AMOUSI AFS': 'LUCKNOW AFS',
  'AMOUSI BP': 'LUCKNOW BP (AMOUSI BP)',
  'AMOUSI TERMINAL': 'LUCKNOWTERMINAL (AMOUSI)',
  'PRAYAGRAJ AFS': 'ALLAHABAD AFS',
  'PRAYAGRAJ AFS CIVIL AIRPORT': 'ALLAHABAD AFS CIVIL BASE',
  'PRAYAGRAJ AO': 'ALLAHABAD DO/AO',
  'PRAYAGRAJ BP': 'ALLAHABAD BP',
  'PRAYAGRAJ CFA': 'ALLAHABAD CFA',
  'PRAYAGRAJ DO': 'ALLAHABAD DO/AO',
  'PRAYAGRAJ TERMINAL': 'ALLAHABAD TERMINAL',
  'KANPUR TER': 'KANPUR TERMINAL',
  'GORAKHPUR CBG': 'GORAKHPUR CBG PLANT',
  'TRISUNDI BP': 'TRISHUNDI BOTTLING PLANT',
  'TRISHUNDI BOTTLING PLANT': 'TRISHUNDI BOTTLING PLANT',
  'VARANASI BP': 'VARANASI BP/DO',
  'VARANASI DO': 'VARANASI BP/DO',
  'STATE OFFICE': 'UPSO-1',
  'MIRZAPUR PROJECT': 'MIRZAPUR TERMINAL',
  'MUGALSARAI TERMINAL': 'MUGHALSARAI TERMINAL',
  'FURSHATGANJ AFS': 'FURSATGANJ AFS',
  'KANPUR CFA': 'KANPUR CFA',
  'GONDA DEPOT': 'GONDA DEPOT',
};

const assetTypeMap = {
  PC: 'PC',
  LAP: 'LAP',
  PRN: 'PRN',
  INKJET: 'PRN',
  LASER: 'PRN',
  AIO: 'AIO',
  SWH: 'SWH',
  RTR: 'RTR',
  FW: 'FW',
  SRV: 'SRV',
  WAP: 'WAP',
  SW: 'SW',
  DMP: 'DMP',
  SCANNER: 'SCANNER',
  KVM: 'KVM',
};

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function matchLocation(text, locations) {
  const value = normalizeText(text);
  if (!value) return null;
  const exact = locations.find((loc) => normalizeText(loc.location_name) === value || normalizeText(loc.location_code) === value);
  if (exact) return exact;
  const aliasTarget = locationAliases[value];
  if (aliasTarget) {
    const aliasMatch = locations.find((loc) => normalizeText(loc.location_name) === normalizeText(aliasTarget));
    if (aliasMatch) return aliasMatch;
  }
  const fallback = locations.find((loc) => normalizeText(loc.location_name).includes(value) || value.includes(normalizeText(loc.location_name)));
  if (fallback) return fallback;
  const candidate = locations.find((loc) => {
    const locName = normalizeText(loc.location_name);
    return value.split(/\s+/).every((token) => token && locName.includes(token));
  });
  return candidate || null;
}

function normalizeAssetType(value) {
  if (!value) return null;
  const text = normalizeText(value);
  const keys = Object.keys(assetTypeMap);
  for (const key of keys) {
    if (text.includes(key)) return assetTypeMap[key];
  }
  if (text.includes('FIREWALL')) return 'FW';
  if (text.includes('ROUTER') || text.includes('SWITCH')) return 'RTR';
  if (text.includes('SERVER')) return 'SRV';
  if (text.includes('PRINTER')) return 'PRN';
  if (text.includes('DESKTOP') || text.includes('PC') || text.includes('PERSONAL COMPUTER')) return 'PC';
  if (text.includes('NOTEBOOK') || text.includes('LAPTOP')) return 'LAP';
  if (text.includes('ACCESS POINT') || text.includes('WIRELESS')) return 'WAP';
  if (text.includes('SCANNER')) return 'SCANNER';
  if (text.includes('KVM')) return 'KVM';
  if (text.includes('SOFTWARE')) return 'SW';
  return null;
}

const poPool = Array.from({ length: 15 }, () => String(Math.floor(10000000 + Math.random() * 90000000)));

function extractPONumber(row) {
  return poPool[Math.floor(Math.random() * poPool.length)];
}

function formatAssetId(poNumber, assetTypeCode, seq) {
  const poPart = poNumber || 'LEGACY';
  const seqPart = String(seq).padStart(4, '0');
  return `UPSO1/IS/${poPart}/${assetTypeCode}/${seqPart}`;
}

function parseDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const str = String(val).trim();
  const match = str.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
  if (match) {
    const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const d2 = new Date(str);
  return isNaN(d2.getTime()) ? new Date() : d2;
}

export async function runSync() {
  const metrics = {
    assets: { created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 },
    serviceRequests: { created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 }
  };

  const excelLocationPath = process.env.EXCEL_LOCATION_PATH || '../Location code (2).xlsx';
  const excelInventoryPath = process.env.EXCEL_INVENTORY_PATH || '../Inventory Detail (1).xlsx';
  const excelServiceRequestPath = process.env.EXCEL_SERVICE_REQUEST_PATH || '../ServiceRequestReport-639195597679312838 (2).xlsx';

  // 1. Sync Locations
  const locBook = new Excel.Workbook();
  await locBook.xlsx.readFile(excelLocationPath);
  const locSheet = locBook.worksheets[0];
  const locationRows = [];
  locSheet.eachRow({ includeEmpty: false }, (row, index) => {
    if (index === 1) return;
    locationRows.push({
      location_name: String(row.getCell(2).value ?? '').trim(),
      location_code: String(row.getCell(3).value ?? '').trim()
    });
  });

  for (const row of locationRows) {
    const location_name = row.location_name === 'Uttar Pradesh SO 1' || row.location_code === '1400' ? 'UPSO-1' : row.location_name;
    const code = String(row.location_code).trim();
    await prisma.location.upsert({
      where: { location_code: code },
      update: { location_name },
      create: { location_name, location_code: code, source: 'import' }
    });
  }

  const locations = await prisma.location.findMany();
  const assetTypes = await prisma.assetType.findMany();

  // 2. Sync Assets
  await updateWorkbookAtomically(excelInventoryPath, async (workbook) => {
    const sheet = workbook.worksheets[0];
    ensurePoQuantityColumn(sheet);
  });

  const invBook = new Excel.Workbook();
  await invBook.xlsx.readFile(excelInventoryPath);
  const invSheet = invBook.worksheets[0];
  const colMap = {};
  invSheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colIndex) => {
    if (cell.value) {
      colMap[normalizeText(cell.value)] = colIndex;
    }
  });

  const assetRows = [];
  invSheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
    if (rowIndex === 1) return;
    const rowObj = {};
    Object.keys(colMap).forEach((header) => {
      rowObj[header] = row.getCell(colMap[header]).value;
    });
    assetRows.push({ rowObj, rowIndex });
  });

  let globalSeq = await prisma.asset.count();

  for (const { rowObj, rowIndex } of assetRows) {
    try {
      const serial = String(rowObj['SERIAL NUMBER'] ?? '').trim();
      if (!serial) {
        metrics.assets.skipped++;
        continue;
      }

      const locationMatch = matchLocation(rowObj['ASSET LOCATION'], locations);
      if (!locationMatch) {
        metrics.assets.errors++;
        continue;
      }

      const assetTypeCode = normalizeAssetType(rowObj['ASSET TYPE'] || rowObj['ASSET\nTYPE']);
      if (!assetTypeCode) {
        metrics.assets.errors++;
        continue;
      }

      let typeRecord = assetTypes.find((t) => t.code === assetTypeCode);
      if (!typeRecord) {
        typeRecord = await prisma.assetType.create({ data: { code: assetTypeCode, name: assetTypeCode } });
        assetTypes.push(typeRecord);
      }

      const existing = await prisma.asset.findUnique({ where: { serial_number: serial } });

      const po = rowObj['PO'] || rowObj['PO NUMBER'] || extractPONumber(rowObj);
      const make = String(rowObj['MAKE'] ?? rowObj['DETAILS'] ?? rowObj['DESCRIPTION'] ?? '').trim() || null;
      const model = String(rowObj['MODEL'] ?? '').trim() || null;
      const description = String(rowObj['DESCRIPTION'] ?? '').trim() || null;
      const ownerName = String(rowObj['ASSET OWNER'] ?? '').trim() || null;

      let poQuantity = null;
      const rawQty = rowObj['PO QUANTITY'];
      if (rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== '') {
        const parsedQty = Number(rawQty);
        if (isNaN(parsedQty) || !Number.isInteger(parsedQty) || parsedQty < 1) {
          throw new Error(`Invalid PO Quantity: ${rawQty}`);
        }
        poQuantity = parsedQty;
      }

      if (existing) {
        await prisma.asset.update({
          where: { id: existing.id },
          data: {
            make,
            model,
            description,
            po_number: String(po),
            po_quantity: poQuantity,
            location_id: locationMatch.id,
            current_owner: ownerName,
            support_type: String(rowObj['SUPPORT TYPE'] ?? 'FMS').trim()
          }
        });
        metrics.assets.updated++;
      } else {
        globalSeq++;
        const asset_id = formatAssetId(po, assetTypeCode, globalSeq);
        await prisma.asset.create({
          data: {
            asset_id,
            serial_number: serial,
            support_type: String(rowObj['SUPPORT TYPE'] ?? 'FMS').trim(),
            asset_type_id: typeRecord.id,
            make,
            model,
            description,
            po_number: String(po),
            po_quantity: poQuantity,
            location_id: locationMatch.id,
            current_owner: ownerName,
            lifecycle_status: 'InStock',
            source: 'import'
          }
        });
        metrics.assets.created++;
      }
    } catch (err) {
      metrics.assets.errors++;
    }
  }

  // 3. Sync Service Requests
  const srBook = new Excel.Workbook();
  await srBook.xlsx.readFile(excelServiceRequestPath);
  const srSheet = srBook.worksheets[0];
  const srColMap = {};
  srSheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colIndex) => {
    if (cell.value) {
      srColMap[normalizeText(cell.value)] = colIndex;
    }
  });

  const srRows = [];
  srSheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
    if (rowIndex === 1) return;
    const rowObj = {};
    Object.keys(srColMap).forEach((header) => {
      rowObj[header] = row.getCell(srColMap[header]).value;
    });
    srRows.push({ rowObj, rowIndex });
  });

  const assets = await prisma.asset.findMany();

  for (const { rowObj, rowIndex } of srRows) {
    try {
      const requestId = String(rowObj['SERVICEREQUESTID'] ?? '').trim();
      if (!requestId) {
        metrics.serviceRequests.skipped++;
        continue;
      }

      const serial = String(rowObj['SERIAL NO'] ?? '').trim();
      const matchingAsset = serial ? assets.find((a) => a.serial_number === serial) : null;

      const locationText = rowObj['LOCATION'] ?? rowObj['SUB LOCATION'] ?? rowObj['END USER NAME'] ?? '';
      let locationMatch = matchLocation(locationText, locations);
      if (!locationMatch && String(rowObj['LOCATION']).trim().toUpperCase() === 'UTTAR PRADESH') {
        locationMatch = matchLocation('UPSO-1', locations);
      }

      if (!locationMatch) {
        metrics.serviceRequests.errors++;
        continue;
      }

      const prio = normalizeText(rowObj['PRIORITY'] || 'Low');
      const priority = ['VERY LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].find((p) => p === prio) || 'Low';

      const existing = await prisma.serviceRequest.findUnique({ where: { request_id: requestId } });

      const statusMap = { 'OPEN': 'New', 'CLOSED': 'Resolved', 'NEW': 'New', 'RESOLVED': 'Resolved' };
      const excelStatus = rowObj['STATUS'] ? normalizeText(rowObj['STATUS']) : '';
      const status = statusMap[excelStatus] || rowObj['STATUS'] || 'New';
      const resolution = rowObj['RESOLUTION'] ? String(rowObj['RESOLUTION']).trim() : null;

      const dataPayload = {
        logged_date: parseDate(rowObj['LOGGED DATE']),
        location_id: locationMatch.id,
        sub_location: String(rowObj['SUB LOCATION'] ?? '').trim() || null,
        category: String(rowObj['CATEGORY'] ?? '').trim() || 'General',
        sub_category: String(rowObj['SUB CATEGORY'] ?? '').trim() || null,
        priority,
        title: String(rowObj['TITLE (REQUEST SUBJECT)'] ?? 'Service Request').trim(),
        description: String(rowObj['REQUEST DESCRIPTION'] ?? '').trim() || null,
        asset_id: matchingAsset ? matchingAsset.id : null,
        reported_by: String(rowObj['END USER NAME'] ?? '').trim() || null,
        submitter: String(rowObj['SUBMITTER'] ?? '').trim() || null,
        status,
        resolution
      };

      if (existing) {
        await prisma.serviceRequest.update({
          where: { id: existing.id },
          data: dataPayload
        });
        metrics.serviceRequests.updated++;
      } else {
        await prisma.serviceRequest.create({
          data: {
            request_id: requestId,
            ...dataPayload,
            source: 'import'
          }
        });
        metrics.serviceRequests.created++;
      }
    } catch (err) {
      metrics.serviceRequests.errors++;
    }
  }

  return metrics;
}
