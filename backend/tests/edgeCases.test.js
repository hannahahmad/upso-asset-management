import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'upso1_prod_sec_#992837482_jwt_auth_key!x';

// Test 1: Location Alias Matching Logic
test('Edge Case — Location Alias & Fuzzy Matching', () => {
  const locationAliases = {
    'AMBABAIDEPOT': 'AMBABAI DEPOT',
    'AMOUSIBP': 'LUCKNOW BP (AMOUSI BP)',
    'STATEOFFICE': 'UPSO-1',
  };

  const locations = [
    { id: 1, location_name: 'UPSO-1', location_code: '1400' },
    { id: 2, location_name: 'LUCKNOW BP (AMOUSI BP)', location_code: '1401' },
    { id: 3, location_name: 'AMBABAI DEPOT', location_code: '1449' }
  ];

  const matchLocationText = (text) => {
    const norm = String(text || '').trim().replace(/\s+/g, '').toUpperCase();
    const alias = locationAliases[norm];
    if (alias) {
      return locations.find((l) => l.location_name === alias) || null;
    }
    return locations.find((l) => l.location_name.toUpperCase().includes(norm)) || null;
  };

  assert.equal(matchLocationText('STATE OFFICE')?.id, 1);
  assert.equal(matchLocationText('AMOUSI BP')?.id, 2);
  assert.equal(matchLocationText('AMBABAI DEPOT')?.id, 3);
});

// Test 2: Asset Type Fuzzy Keyword Normalization
test('Edge Case — Asset Type Keyword Classification', () => {
  const normalizeAssetType = (value) => {
    if (!value) return null;
    const text = String(value).trim().toUpperCase();
    if (text.includes('FIREWALL')) return 'FW';
    if (text.includes('ROUTER') || text.includes('SWITCH')) return 'RTR';
    if (text.includes('SERVER')) return 'SRV';
    if (text.includes('PRINTER')) return 'PRN';
    if (text.includes('DESKTOP') || text.includes('PC')) return 'PC';
    if (text.includes('NOTEBOOK') || text.includes('LAPTOP')) return 'LAP';
    return null;
  };

  assert.equal(normalizeAssetType('FIREWALL UTILITY'), 'FW');
  assert.equal(normalizeAssetType('CISCO NETWORK SWITCH'), 'RTR');
  assert.equal(normalizeAssetType('DELL R740 SERVER'), 'SRV');
  assert.equal(normalizeAssetType('HP NOTEBOOK 15'), 'LAP');
  assert.equal(normalizeAssetType('WORKSTATION PC'), 'PC');
  assert.equal(normalizeAssetType('UNKNOWN DEVICE'), null);
});

// Test 3: PO Quantity Numerical Bounds Validation
test('Edge Case — PO Quantity Numerical Bounds', () => {
  const validatePoQuantity = (val) => {
    if (val === undefined || val === null || String(val).trim() === '') return { valid: true, value: null };
    const num = Number(val);
    if (isNaN(num) || !Number.isInteger(num) || num < 1) {
      return { valid: false, error: 'po_quantity must be a positive integer >= 1' };
    }
    return { valid: true, value: num };
  };

  assert.equal(validatePoQuantity(null).valid, true);
  assert.equal(validatePoQuantity('10').valid, true);
  assert.equal(validatePoQuantity('0').valid, false);
  assert.equal(validatePoQuantity('-5').valid, false);
  assert.equal(validatePoQuantity('3.14').valid, false);
  assert.equal(validatePoQuantity('abc').valid, false);
});

// Test 4: Token Expiration Edge Case
test('Edge Case — Expired JWT Token Rejection', () => {
  const expiredToken = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '-1s' });
  
  assert.throws(() => {
    jwt.verify(expiredToken, JWT_SECRET);
  }, (err) => err.name === 'TokenExpiredError', 'Expired token must throw TokenExpiredError');
});

// Test 5: Corrupted LocalStorage Parsing
test('Edge Case — LocalStorage Corrupted JSON Resilience', () => {
  const safeJsonParse = (raw) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  assert.equal(safeJsonParse('{ corrupt json string ...'), null);
  assert.equal(safeJsonParse('{"id": 1, "name": "Admin"}')?.id, 1);
  assert.equal(safeJsonParse(null), null);
});
