import fs from 'fs';
import path from 'path';
import Excel from 'exceljs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const locationFile = path.resolve(__dirname, '../../../Location code (2).xlsx');
const assetFile = path.resolve(__dirname, '../../../Inventory Detail (1).xlsx');
const serviceFile = path.resolve(__dirname, '../../../ServiceRequestReport-639195597679312838 (2).xlsx');
const reportFile = path.resolve(__dirname, '../../../import-report.json');

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
  'PRAYAGRAJ TERMINAL': 'ALLAHABAD TERMINAL',
};

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
  // Return a random 8-digit PO number from the pool to simulate repeating POs
  return poPool[Math.floor(Math.random() * poPool.length)];
}

function formatAssetId(poNumber, assetTypeCode, seq) {
  const poPart = poNumber || 'LEGACY';
  const seqPart = String(seq).padStart(4, '0');
  return `UPSO1/IS/${poPart}/${assetTypeCode}/${seqPart}`;
}

async function loadLocations() {
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(locationFile);
  const sheet = workbook.worksheets[0];
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, index) => {
    if (index === 1) return;
    rows.push({
      sn: row.getCell(1).value,
      location_name: String(row.getCell(2).value ?? '').trim(),
      location_code: String(row.getCell(3).value ?? '').trim(),
    });
  });
  return rows;
}

async function loadAssetRows() {
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(assetFile);
  const sheet = workbook.worksheets[0];
  const headers = sheet.getRow(1).values.slice(1).map((header) => normalizeText(header));
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, index) => {
    if (index === 1) return;
    const values = row.values.slice(1);
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx];
    });
    rows.push(rowObj);
  });
  return rows;
}

async function loadServiceRows() {
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(serviceFile);
  const sheet = workbook.worksheets[0];
  const headers = sheet.getRow(1).values.slice(1).map((header) => normalizeText(header));
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, index) => {
    if (index === 1) return;
    const values = row.values.slice(1);
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx];
    });
    rows.push(rowObj);
  });
  return rows;
}

async function run() {
  console.log('Starting import...');
  const report = { locations: [], assets: { imported: 0, rejected: [] }, serviceRequests: { imported: 0, rejected: [] }, warnings: [] };
  const locationRows = await loadLocations();
  const locationMap = new Map();
  const duplicateLocationCodes = [];
  for (const row of locationRows) {
    const location_name = row.location_name === 'Uttar Pradesh SO 1' || row.location_code === '1400' ? 'UPSO-1' : row.location_name;
    const code = String(row.location_code).trim();
    if (locationMap.has(code)) {
      duplicateLocationCodes.push({ code, existing: locationMap.get(code).location_name, duplicate: location_name });
      continue;
    }
    locationMap.set(code, { location_name, location_code: code, region: null, accountable_contact: null, source: 'import' });
  }
  const locationRecords = Array.from(locationMap.values());
  if (duplicateLocationCodes.length) {
    report.warnings.push({ type: 'duplicateLocationCode', items: duplicateLocationCodes });
  }
  await prisma.auditLog.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.asset.deleteMany();
  // User rows are never wiped here: this script creates no User records itself, and Asset/ServiceRequest
  // now carry real FKs (owner_user_id, submitted_by_user_id) to User, so deleting all users would silently
  // orphan that ownership/submitter data on every re-import.
  await prisma.location.deleteMany();
  await prisma.assetType.deleteMany();

  const seedAssetTypes = Object.entries(assetTypeMap).filter(([key]) => key === key.toUpperCase()).map(([code, value]) => ({ code: value, name: value }));
  const uniqueAssetTypes = Array.from(new Map(seedAssetTypes.map((item) => [item.code, item])).values());
  await prisma.location.createMany({ data: locationRecords });
  await prisma.assetType.createMany({ data: uniqueAssetTypes });
  report.locations = await prisma.location.findMany();

  const assetRows = await loadAssetRows();
  const locations = await prisma.location.findMany();
  const assetTypeLookup = await prisma.assetType.findMany();
  const serialSet = new Set();
  let globalSeq = 0;
  for (const row of assetRows) {
    const rowId = row['S.NO.'] ?? 'unknown';
    const locationMatch = matchLocation(row['ASSET LOCATION'], locations);
    if (!locationMatch) {
      report.assets.rejected.push({ row: rowId, reason: 'Unknown location', data: row });
      continue;
    }
    const assetTypeCode = normalizeAssetType(row['ASSET TYPE'] || row['ASSET\nTYPE'] || row['ASSET TYPE']);
    if (!assetTypeCode) {
      report.assets.rejected.push({ row: rowId, reason: 'Unknown asset type', data: row });
      continue;
    }
    const serial = String(row['SERIAL NUMBER'] ?? '').trim();
    if (!serial) {
      report.assets.rejected.push({ row: rowId, reason: 'Missing serial number', data: row });
      continue;
    }
    if (serialSet.has(serial)) {
      report.assets.rejected.push({ row: rowId, reason: 'Duplicate serial number in import', data: row });
      continue;
    }
    serialSet.add(serial);
    const po = extractPONumber(row) || `LEGACY-${rowId}`;
    globalSeq += 1;
    const asset_id = formatAssetId(po, assetTypeCode, globalSeq);
    const typeRecord = assetTypeLookup.find((item) => item.code === assetTypeCode);
    const locationRecord = locations.find((item) => item.id === locationMatch.id);
    try {
      await prisma.asset.create({
        data: {
          asset_id,
          serial_number: serial,
          support_type: String(row['SUPPORT TYPE'] ?? 'FMS').trim(),
          asset_type_id: typeRecord.id,
          make: String(row['MAKE'] ?? row['DESCRIPTION'] ?? '').trim() || null,
          model: String(row['MODEL'] ?? '').trim() || null,
          description: String(row['DESCRIPTION'] ?? '').trim() || null,
          po_number: po,
          location_id: locationRecord.id,
          current_owner: String(row['ASSET OWNER'] ?? '').trim() || null,
          lifecycle_status: 'InStock',
          purchase_date: null,
          warranty_expiry: null,
          source: 'import',
        },
      });
      report.assets.imported += 1;
    } catch (error) {
      report.assets.rejected.push({ row: rowId, reason: error.message, data: row });
    }
  }

  const serviceRows = await loadServiceRows();
  const assets = await prisma.asset.findMany();
  for (const row of serviceRows) {
    const rowId = row['SERVICEREQUESTID'] ?? 'unknown';
    const locationText = row['LOCATION'] ?? row['SUB LOCATION'] ?? row['END USER NAME'] ?? '';
    let locationMatch = matchLocation(locationText, locations);
    if (!locationMatch && row['LOCATION'] === 'UTTAR PRADESH') {
      locationMatch = matchLocation('UPSO-1', locations);
    }
    if (!locationMatch && row['END USER NAME']) {
      const alt = String(row['END USER NAME']).split('-')[0];
      locationMatch = matchLocation(alt, locations);
    }
    if (!locationMatch) {
      report.serviceRequests.rejected.push({ row: rowId, reason: 'Unknown location', data: row });
      continue;
    }
    const serial = String(row['SERIAL NO'] ?? '').trim();
    const matchingAsset = serial ? assets.find((asset) => asset.serial_number === serial) : null;
    const prio = normalizeText(row['PRIORITY'] || 'Low');
    const priority = ['VERY LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].find((p) => p === prio) || 'Low';
    try {
      await prisma.serviceRequest.create({
        data: {
          request_id: String(rowId),
          logged_date: row['LOGGED DATE'] ? new Date(row['LOGGED DATE']) : new Date(),
          location_id: locationMatch.id,
          sub_location: String(row['SUB LOCATION'] ?? '').trim() || null,
          category: String(row['CATEGORY'] ?? '').trim() || 'General',
          sub_category: String(row['SUB CATEGORY'] ?? '').trim() || null,
          priority,
          title: String(row['TITLE (REQUEST SUBJECT)'] ?? 'Service Request').trim(),
          description: String(row['REQUEST DESCRIPTION'] ?? '').trim() || null,
          asset_id: matchingAsset ? matchingAsset.id : null,
          reported_by: String(row['END USER NAME'] ?? '').trim() || null,
          submitter: String(row['SUBMITTER'] ?? '').trim() || null,
          status: 'New',
          expected_resolution_date: null,
          sla_flag: null,
          source: 'import',
        },
      });
      report.serviceRequests.imported += 1;
    } catch (error) {
      report.serviceRequests.rejected.push({ row: rowId, reason: error.message, data: row });
    }
  }

  const output = JSON.stringify(report, null, 2);
  fs.writeFileSync(reportFile, output, 'utf-8');
  console.log('Import report saved to', reportFile);
  console.log(output);
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
