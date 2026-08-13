import fs from 'fs';
import path from 'path';

/**
 * Acquire a file-based lock atomically using mkdirSync.
 * @param {string} filePath File path to lock
 * @param {number} timeoutMs Maximum time to wait for lock in milliseconds
 * @returns {Promise<() => void>} Release function
 */
export async function acquireLock(filePath, timeoutMs = 15000) {
  const lockDir = `${filePath}.lock`;
  const start = Date.now();

  while (true) {
    try {
      fs.mkdirSync(lockDir);
      return () => {
        try {
          fs.rmdirSync(lockDir);
        } catch (e) {
          // Ignore release errors
        }
      };
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timeout acquiring lock for file: ${filePath}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

/**
 * Safely update an Excel workbook atomically under a lock.
 * @param {string} filePath Path to workbook
 * @param {Function} updateFn Callback receiving workbook, returns promise or value
 */
export async function updateWorkbookAtomically(filePath, updateFn) {
  const absolutePath = path.resolve(filePath);
  const release = await acquireLock(absolutePath);
  try {
    const Excel = await import('exceljs').then((m) => m.default);
    const workbook = new Excel.Workbook();
    
    if (fs.existsSync(absolutePath)) {
      await workbook.xlsx.readFile(absolutePath);
    }

    await updateFn(workbook);

    const tempPath = `${absolutePath}.tmp`;
    await workbook.xlsx.writeFile(tempPath);
    fs.renameSync(tempPath, absolutePath);
  } finally {
    release();
  }
}

/**
 * Maps Excel header names to 1-indexed column numbers.
 * Throws an error if any of the required headers are missing.
 * @param {Object} sheet Exceljs worksheet
 * @param {Array<string>} requiredHeaders List of required header names
 * @returns {Object} Mapping of normalized header name to column index (1-indexed)
 */
export function getColumnMap(sheet, requiredHeaders = []) {
  const headerRow = sheet.getRow(1);
  const columnMap = {};
  
  headerRow.eachCell((cell, colIndex) => {
    if (cell.value) {
      const normName = String(cell.value).trim().replace(/\s+/g, ' ').toUpperCase();
      columnMap[normName] = colIndex;
    }
  });

  const missing = [];
  for (const reqHeader of requiredHeaders) {
    const normReq = reqHeader.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!columnMap[normReq]) {
      missing.push(reqHeader);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Required columns missing from Excel workbook: ${missing.join(', ')}`);
  }

  return columnMap;
}

/**
 * Ensures the 'PO Quantity' column exists immediately after the 'PO' / 'PO Number' column.
 * If missing, inserts it and copies style, width, and validations from the PO column.
 * @param {Object} sheet Exceljs worksheet
 * @returns {number} The column index (1-based) of the 'PO Quantity' column
 */
export function ensurePoQuantityColumn(sheet) {
  const headerRow = sheet.getRow(1);
  let poColIndex = null;
  let qtyColIndex = null;

  headerRow.eachCell((cell, colIndex) => {
    const norm = String(cell.value || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (norm === 'PO' || norm === 'PO NUMBER' || norm === 'PO NO') {
      poColIndex = colIndex;
    }
    if (norm === 'PO QUANTITY') {
      qtyColIndex = colIndex;
    }
  });

  if (qtyColIndex) {
    return qtyColIndex;
  }

  const insertPos = poColIndex ? poColIndex + 1 : headerRow.cellCount + 1;
  sheet.spliceColumns(insertPos, 0, []);
  
  headerRow.getCell(insertPos).value = 'PO Quantity';

  if (poColIndex) {
    const poCol = sheet.getColumn(poColIndex);
    const qtyCol = sheet.getColumn(insertPos);
    qtyCol.width = poCol.width;
    qtyCol.style = { ...poCol.style };
    
    sheet.eachRow((row) => {
      if (row.number === 1) return;
      const poCell = row.getCell(poColIndex);
      const qtyCell = row.getCell(insertPos);
      qtyCell.style = { ...poCell.style };
      if (poCell.dataValidation) {
        qtyCell.dataValidation = { ...poCell.dataValidation };
      }
    });
  }

  return insertPos;
}
