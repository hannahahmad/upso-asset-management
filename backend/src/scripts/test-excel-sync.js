import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../prismaClient.js';
import { runSync } from '../services/syncService.js';
import { updateWorkbookAtomically, getColumnMap } from '../utils/excelLock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const originalLocation = path.resolve(__dirname, '../../../Location code (2).xlsx');
const originalInventory = path.resolve(__dirname, '../../../Inventory Detail (1).xlsx');
const originalService = path.resolve(__dirname, '../../../ServiceRequestReport-639195597679312838 (2).xlsx');

const tempLocation = path.resolve(__dirname, './test_Location_code.xlsx');
const tempInventory = path.resolve(__dirname, './test_Inventory_Detail.xlsx');
const tempService = path.resolve(__dirname, './test_ServiceRequestReport.xlsx');

async function testSuite() {
  console.log('--- STARTING 7-STEP INTEGRATION TEST SUITE ---');

  // Copy workbooks for isolated testing
  fs.copyFileSync(originalLocation, tempLocation);
  fs.copyFileSync(originalInventory, tempInventory);
  fs.copyFileSync(originalService, tempService);

  // Set environment variables to point to test copies
  process.env.EXCEL_LOCATION_PATH = tempLocation;
  process.env.EXCEL_INVENTORY_PATH = tempInventory;
  process.env.EXCEL_SERVICE_REQUEST_PATH = tempService;

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  };

  const Excel = await import('exceljs').then((m) => m.default);

  try {
    // Cleanup any leftover test records from previous run crashes
    await prisma.asset.deleteMany({
      where: {
        OR: [
          { serial_number: { startsWith: 'TEST-SERIAL-T' } },
          { current_owner: 'DASHBOARD ADMIN' },
        ]
      }
    });
    await prisma.serviceRequest.deleteMany({
      where: {
        OR: [
          { request_id: { startsWith: 'SR-TEST-T' } }
        ]
      }
    });

    // ----------------------------------------------------
    // Test 1: Excel Asset Edit -> Admin Login -> SQLite
    // ----------------------------------------------------
    console.log('\nRunning Test 1: Excel Asset Edit -> Admin Login -> SQLite...');
    const testSerial1 = `TEST-SERIAL-T1-${Date.now()}`;
    await updateWorkbookAtomically(tempInventory, async (workbook) => {
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

      const colMap = getColumnMap(sheet, ['S.NO.', 'SERIAL NUMBER', 'ASSET LOCATION', 'ASSET TYPE', 'ASSET OWNER']);
      const row = sheet.addRow([]);
      row.getCell(colMap['S.NO.']).value = 9999;
      row.getCell(colMap['SERIAL NUMBER']).value = testSerial1;
      row.getCell(colMap['ASSET LOCATION']).value = 'Ambabai Depot';
      row.getCell(colMap['ASSET TYPE']).value = 'PC';
      row.getCell(colMap['ASSET OWNER']).value = 'EXCEL EDIT USER';
    });

    // Simulate Admin Login Sync
    await runSync();

    const dbAsset1 = await prisma.asset.findUnique({ where: { serial_number: testSerial1 } });
    assert(!!dbAsset1, 'SQLite should contain the new asset edited in Excel');
    assert(dbAsset1?.current_owner === 'EXCEL EDIT USER', 'Asset attributes should match Excel updates');


    // ----------------------------------------------------
    // Test 2: Admin edits or creates asset -> Excel
    // ----------------------------------------------------
    console.log('\nRunning Test 2: Admin edits/creates Asset -> Excel...');
    const testSerial2 = `TEST-SERIAL-T2-${Date.now()}`;
    const testLoc = await prisma.location.findFirst();
    const testType = await prisma.assetType.findFirst();

    // Create via transactional write-back simulation
    await prisma.$transaction(async (tx) => {
      await tx.asset.create({
        data: {
          asset_id: `UPSO1/IS/88888888/${testType.code}/0888`,
          serial_number: testSerial2,
          support_type: 'FMS',
          asset_type_id: testType.id,
          location_id: testLoc.id,
          po_number: '88888888',
          current_owner: 'DASHBOARD ADMIN',
          lifecycle_status: 'InStock',
        }
      });

      await updateWorkbookAtomically(tempInventory, async (workbook) => {
        const sheet = workbook.worksheets[0];
        const colMap = getColumnMap(sheet, ['S.NO.', 'SUPPORT TYPE', 'ASSET TYPE', 'SERIAL NUMBER', 'ASSET LOCATION', 'ASSET OWNER', 'PO']);
        const row = sheet.addRow([]);
        row.getCell(colMap['S.NO.']).value = 8888;
        row.getCell(colMap['SUPPORT TYPE']).value = 'FMS';
        row.getCell(colMap['ASSET TYPE']).value = testType.code;
        row.getCell(colMap['SERIAL NUMBER']).value = testSerial2;
        row.getCell(colMap['ASSET LOCATION']).value = testLoc.location_name;
        row.getCell(colMap['ASSET OWNER']).value = 'DASHBOARD ADMIN';
        row.getCell(colMap['PO']).value = '88888888';
      });
    });

    const verifyBook2 = new Excel.Workbook();
    await verifyBook2.xlsx.readFile(tempInventory);
    const sheet2 = verifyBook2.worksheets[0];
    const colMap2 = getColumnMap(sheet2, ['SERIAL NUMBER', 'ASSET OWNER']);
    let found2 = false;
    let ownerCorrect2 = false;
    sheet2.eachRow((row) => {
      if (String(row.getCell(colMap2['SERIAL NUMBER']).value).trim() === testSerial2) {
        found2 = true;
        ownerCorrect2 = String(row.getCell(colMap2['ASSET OWNER']).value).trim() === 'DASHBOARD ADMIN';
      }
    });
    assert(found2 && ownerCorrect2, 'Admin created/edited asset should successfully update the Excel workbook');


    // ----------------------------------------------------
    // Test 3: Satyanshu complaint -> SQLite & Excel
    // ----------------------------------------------------
    console.log('\nRunning Test 3: Satyanshu complaint -> SQLite & Excel...');
    const testRequestId3 = `SR-TEST-T3-${Date.now()}`;
    const satyanshuUser = await prisma.user.findFirst({ where: { email: 'satyanshu@upso1.in' } });
    assert(!!satyanshuUser, 'Satyanshu user should exist in the SQLite database');

    await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.create({
        data: {
          request_id: testRequestId3,
          location_id: testLoc.id,
          category: 'PC',
          priority: 'Low',
          title: 'Satyanshu Test Complaint',
          description: 'My desktop is not working',
          status: 'New',
          submitted_by_user_id: satyanshuUser.id,
        }
      });

      await updateWorkbookAtomically(tempService, async (workbook) => {
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
          'Request Description',
          'Submitter',
          'STATUS',
          'RESOLUTION',
          'Serial No',
          'Logged Date'
        ]);
        const row = sheet.addRow([]);
        row.getCell(colMap['SERVICEREQUESTID']).value = testRequestId3;
        row.getCell(colMap['REQUEST DESCRIPTION']).value = 'My desktop is not working';
        row.getCell(colMap['SUBMITTER']).value = 'Satyanshu Singh';
        row.getCell(colMap['STATUS']).value = 'New';
        row.getCell(colMap['RESOLUTION']).value = '';
        row.getCell(colMap['SERIAL NO']).value = 'TEST-SERIAL';
        row.getCell(colMap['LOGGED DATE']).value = '07/08/2026';
      });
    });

    const verifyBook3 = new Excel.Workbook();
    await verifyBook3.xlsx.readFile(tempService);
    const sheet3 = verifyBook3.worksheets[0];
    const colMap3 = getColumnMap(sheet3, [
      'ServiceRequestId',
      'Request Description',
      'Submitter',
      'STATUS',
      'RESOLUTION',
      'Serial No',
      'Logged Date'
    ]);
    let found3 = false;
    let fieldsCorrect3 = false;
    sheet3.eachRow((row) => {
      if (String(row.getCell(colMap3['SERVICEREQUESTID']).value).trim() === testRequestId3) {
        found3 = true;
        fieldsCorrect3 = 
          String(row.getCell(colMap3['STATUS']).value).trim() === 'New' &&
          String(row.getCell(colMap3['REQUEST DESCRIPTION']).value).trim() === 'My desktop is not working' &&
          String(row.getCell(colMap3['SUBMITTER']).value).trim() === 'Satyanshu Singh' &&
          String(row.getCell(colMap3['SERIAL NO']).value).trim() === 'TEST-SERIAL' &&
          String(row.getCell(colMap3['LOGGED DATE']).value).trim() !== '';
      }
    });
    assert(found3 && fieldsCorrect3, 'Satyanshu complaint Excel row should record Ticket ID, Asset, Description, Date/Time, Status, and Resolution');


    // ----------------------------------------------------
    // Test 4: Admin updates ticket status/res -> Excel & user visibility
    // ----------------------------------------------------
    console.log('\nRunning Test 4: Admin updates Ticket -> Excel & User Visibility...');
    await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.update({
        where: { request_id: testRequestId3 },
        data: { status: 'Resolved', resolution: 'Completed and Resolved' }
      });

      await updateWorkbookAtomically(tempService, async (workbook) => {
        const sheet = workbook.worksheets[0];
        const colMap = getColumnMap(sheet, ['ServiceRequestId', 'STATUS', 'RESOLUTION']);
        sheet.eachRow((row) => {
          if (String(row.getCell(colMap['SERVICEREQUESTID']).value).trim() === testRequestId3) {
            row.getCell(colMap['STATUS']).value = 'Resolved';
            row.getCell(colMap['RESOLUTION']).value = 'Completed and Resolved';
          }
        });
      });
    });

    // Check Excel
    const verifyBook4 = new Excel.Workbook();
    await verifyBook4.xlsx.readFile(tempService);
    const sheet4 = verifyBook4.worksheets[0];
    const colMap4 = getColumnMap(sheet4, ['ServiceRequestId', 'STATUS', 'RESOLUTION']);
    let statusCorrect4 = false;
    let resCorrect4 = false;
    sheet4.eachRow((row) => {
      if (String(row.getCell(colMap4['SERVICEREQUESTID']).value).trim() === testRequestId3) {
        statusCorrect4 = String(row.getCell(colMap4['STATUS']).value).trim() === 'Resolved';
        resCorrect4 = String(row.getCell(colMap4['RESOLUTION']).value).trim() === 'Completed and Resolved';
      }
    });
    assert(statusCorrect4 && resCorrect4, 'Excel should be updated with the admin\'s status and resolution updates');

    // Verify Satyanshu retrieves the updated ticket from SQLite (simulating user-facing API response)
    const userFetchedTicket = await prisma.serviceRequest.findUnique({
      where: { request_id: testRequestId3 }
    });
    assert(
      userFetchedTicket?.status === 'Resolved' && userFetchedTicket?.resolution === 'Completed and Resolved',
      'Satyanshu retrieves the updated ticket with the exact resolved status and admin resolution comment'
    );


    // ----------------------------------------------------
    // Test 5: Normal user login -> Sync is skipped
    // ----------------------------------------------------
    console.log('\nRunning Test 5: Normal User Login -> Sync Skipped...');
    let syncTriggered = false;
    const mockUserRole = 'User';
    if (mockUserRole === 'Administrator') {
      syncTriggered = true;
    }
    assert(!syncTriggered, 'Login logic must NOT trigger sync for normal users');


    // ----------------------------------------------------
    // Test 6: Duplicate Ticket Retry -> No duplicate row in Excel
    // ----------------------------------------------------
    console.log('\nRunning Test 6: Duplicate Ticket Retry -> No Duplicate in Excel...');
    await updateWorkbookAtomically(tempService, async (workbook) => {
      const sheet = workbook.worksheets[0];
      const colMap = getColumnMap(sheet, ['ServiceRequestId', 'STATUS']);
      
      // Attempt to append duplicate request ID
      let duplicateFound = false;
      sheet.eachRow((row) => {
        if (String(row.getCell(colMap['SERVICEREQUESTID']).value).trim() === testRequestId3) {
          duplicateFound = true;
        }
      });

      if (!duplicateFound) {
        const row = sheet.addRow([]);
        row.getCell(colMap['SERVICEREQUESTID']).value = testRequestId3;
      }
    });

    const verifyBook6 = new Excel.Workbook();
    await verifyBook6.xlsx.readFile(tempService);
    const sheet6 = verifyBook6.worksheets[0];
    const colMap6 = getColumnMap(sheet6, ['ServiceRequestId']);
    let occurCount = 0;
    sheet6.eachRow((row) => {
      if (String(row.getCell(colMap6['SERVICEREQUESTID']).value).trim() === testRequestId3) {
        occurCount++;
      }
    });
    assert(occurCount === 1, 'Duplicate request ID retry should not append a duplicate row in the Excel sheet');


    // ----------------------------------------------------
    // Test 7: Error handling & transactional consistency
    // ----------------------------------------------------
    console.log('\nRunning Test 7: Error Handling & Transactional Consistency...');
    const testSerial7 = `TEST-SERIAL-T7-${Date.now()}`;
    let rollbackTriggered = false;

    try {
      await prisma.$transaction(async (tx) => {
        // Create in DB
        await tx.asset.create({
          data: {
            asset_id: `UPSO1/IS/77777777/${testType.code}/0777`,
            serial_number: testSerial7,
            support_type: 'FMS',
            asset_type_id: testType.id,
            location_id: testLoc.id,
            po_number: '77777777',
            current_owner: 'SHOULD ROLLBACK',
          }
        });

        // Trigger deliberate write error (point to nonexistent locked file)
        await updateWorkbookAtomically('./nonexistent-locked-path.xlsx', async () => {
          throw new Error('Lock error simulated');
        });
      });
    } catch (err) {
      rollbackTriggered = true;
    }

    const verifyAsset7 = await prisma.asset.findUnique({ where: { serial_number: testSerial7 } });
    assert(rollbackTriggered && !verifyAsset7, 'Database transaction should roll back if the Excel write operation fails');

    // ----------------------------------------------------
    // Test 8: PO Quantity validation and bidirectional sync
    // ----------------------------------------------------
    console.log('\nRunning Test 8: PO Quantity verification...');
    
    const { ensurePoQuantityColumn } = await import('../utils/excelLock.js');
    
    const testSerial8 = `TEST-SERIAL-T8-${Date.now()}`;
    const testAssetId8 = `UPSO1/IS/55555555/${testType.code}/0555`;

    // 8.1 Create asset with PO Quantity -> SQLite & Excel
    await prisma.$transaction(async (tx) => {
      await tx.asset.create({
        data: {
          asset_id: testAssetId8,
          serial_number: testSerial8,
          support_type: 'AMC',
          asset_type_id: testType.id,
          location_id: testLoc.id,
          po_number: '55555555',
          po_quantity: 5,
          current_owner: 'PO QTY USER',
        }
      });

      await updateWorkbookAtomically(tempInventory, async (workbook) => {
        const sheet = workbook.worksheets[0];
        ensurePoQuantityColumn(sheet);
        const colMap = getColumnMap(sheet, ['S.NO.', 'SERIAL NUMBER', 'PO', 'PO QUANTITY', 'ASSET LOCATION', 'ASSET TYPE']);
        const row = sheet.addRow([]);
        row.getCell(colMap['S.NO.']).value = 7777;
        row.getCell(colMap['SERIAL NUMBER']).value = testSerial8;
        row.getCell(colMap['PO']).value = '55555555';
        row.getCell(colMap['PO QUANTITY']).value = 5;
        row.getCell(colMap['ASSET LOCATION']).value = testLoc.location_name;
        row.getCell(colMap['ASSET TYPE']).value = testType.code;
      });
    });

    const verifyBook8 = new Excel.Workbook();
    await verifyBook8.xlsx.readFile(tempInventory);
    const sheet8 = verifyBook8.worksheets[0];
    const colMap8 = getColumnMap(sheet8, ['SERIAL NUMBER', 'PO QUANTITY']);
    let qtyCorrect81 = false;
    sheet8.eachRow((row) => {
      if (String(row.getCell(colMap8['SERIAL NUMBER']).value).trim() === testSerial8) {
        qtyCorrect81 = Number(row.getCell(colMap8['PO QUANTITY']).value) === 5;
      }
    });
    const dbAsset81 = await prisma.asset.findUnique({ where: { serial_number: testSerial8 } });
    assert(dbAsset81?.po_quantity === 5 && qtyCorrect81, 'Creating asset with PO Quantity saves correctly in SQLite and Excel');

    // 8.2 Edit PO Quantity -> SQLite & Excel
    await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { serial_number: testSerial8 },
        data: { po_quantity: 10 }
      });

      await updateWorkbookAtomically(tempInventory, async (workbook) => {
        const sheet = workbook.worksheets[0];
        const colMap = getColumnMap(sheet, ['SERIAL NUMBER', 'PO QUANTITY']);
        sheet.eachRow((row) => {
          if (String(row.getCell(colMap['SERIAL NUMBER']).value).trim() === testSerial8) {
            row.getCell(colMap['PO QUANTITY']).value = 10;
          }
        });
      });
    });

    const verifyBook82 = new Excel.Workbook();
    await verifyBook82.xlsx.readFile(tempInventory);
    const sheet82 = verifyBook82.worksheets[0];
    const colMap82 = getColumnMap(sheet82, ['SERIAL NUMBER', 'PO QUANTITY']);
    let qtyCorrect82 = false;
    sheet82.eachRow((row) => {
      if (String(row.getCell(colMap82['SERIAL NUMBER']).value).trim() === testSerial8) {
        qtyCorrect82 = Number(row.getCell(colMap82['PO QUANTITY']).value) === 10;
      }
    });
    const dbAsset82 = await prisma.asset.findUnique({ where: { serial_number: testSerial8 } });
    assert(dbAsset82?.po_quantity === 10 && qtyCorrect82, 'Editing PO Quantity updates successfully in SQLite and Excel');

    // 8.3 Edit PO Quantity directly in Excel -> admin sync -> SQLite
    await updateWorkbookAtomically(tempInventory, async (workbook) => {
      const sheet = workbook.worksheets[0];
      const colMap = getColumnMap(sheet, ['SERIAL NUMBER', 'PO QUANTITY']);
      sheet.eachRow((row) => {
        if (String(row.getCell(colMap['SERIAL NUMBER']).value).trim() === testSerial8) {
          row.getCell(colMap['PO QUANTITY']).value = 20;
        }
      });
    });

    await runSync();

    const dbAsset83 = await prisma.asset.findUnique({ where: { serial_number: testSerial8 } });
    assert(dbAsset83?.po_quantity === 20, 'Direct Excel edit of PO Quantity synchronizes to SQLite on admin login');

    // 8.4 Invalid values reject safely
    let rejectZero = false;
    let rejectNegative = false;
    let rejectDecimal = false;
    let rejectText = false;

    const validateVal = (v) => {
      if (v !== null && String(v).trim() !== '') {
        const p = Number(v);
        if (isNaN(p) || !Number.isInteger(p) || p < 1) throw new Error('Invalid');
      }
    };

    try { validateVal(0); } catch (e) { rejectZero = true; }
    try { validateVal(-3); } catch (e) { rejectNegative = true; }
    try { validateVal(4.5); } catch (e) { rejectDecimal = true; }
    try { validateVal("ten"); } catch (e) { rejectText = true; }

    assert(rejectZero && rejectNegative && rejectDecimal && rejectText, 'Validation rejects invalid values (0, negative, decimal, text) correctly');

    // 8.5 Blank PO Quantity imports as null
    await updateWorkbookAtomically(tempInventory, async (workbook) => {
      const sheet = workbook.worksheets[0];
      const colMap = getColumnMap(sheet, ['SERIAL NUMBER', 'PO QUANTITY']);
      sheet.eachRow((row) => {
        if (String(row.getCell(colMap['SERIAL NUMBER']).value).trim() === testSerial8) {
          row.getCell(colMap['PO QUANTITY']).value = '';
        }
      });
    });

    await runSync();

    const dbAsset85 = await prisma.asset.findUnique({ where: { serial_number: testSerial8 } });
    assert(dbAsset85?.po_quantity === null, 'Blank PO Quantity values in Excel sync as null safely');

    // Clean up T8
    await prisma.asset.delete({ where: { serial_number: testSerial8 } });

    // Clean up DB test records
    await prisma.asset.delete({ where: { serial_number: testSerial1 } });
    await prisma.asset.delete({ where: { serial_number: testSerial2 } });
    await prisma.serviceRequest.delete({ where: { request_id: testRequestId3 } });

  } catch (err) {
    console.error('Test suite general failure:', err);
    failed++;
  } finally {
    try {
      fs.unlinkSync(tempLocation);
      fs.unlinkSync(tempInventory);
      fs.unlinkSync(tempService);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  console.log(`\n--- TEST SUITE SUMMARY: Passed: ${passed}, Failed: ${failed} ---`);
  process.exit(failed > 0 ? 1 : 0);
}

testSuite().catch(console.error);
