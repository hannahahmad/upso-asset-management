import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'upso1_prod_sec_#992837482_jwt_auth_key!x';

test('Authentication Logic — Password Hashing & Verification', async () => {
  const plain = 'Admin@123';
  const hash = await bcrypt.hash(plain, 10);
  
  const match = await bcrypt.compare(plain, hash);
  assert.equal(match, true, 'Correct password should compare to true');

  const wrong = await bcrypt.compare('WrongPassword', hash);
  assert.equal(wrong, false, 'Incorrect password should compare to false');
});

test('Authentication Logic — JWT Signing & Verification', () => {
  const payload = { userId: 1, role: 'Administrator', location_id: 10 };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  assert.ok(token, 'JWT token should be generated');

  const verified = jwt.verify(token, JWT_SECRET);
  assert.equal(verified.userId, 1);
  assert.equal(verified.role, 'Administrator');
  assert.equal(verified.location_id, 10);
});

test('Authentication Logic — Invalid JWT Secret Rejection', () => {
  const payload = { userId: 1, role: 'Administrator' };
  const token = jwt.sign(payload, 'wrong-secret');

  assert.throws(() => {
    jwt.verify(token, JWT_SECRET);
  }, /invalid signature/i, 'Token signed with wrong secret must throw invalid signature error');
});

test('Portal Scoping Rules', () => {
  const checkPortalAccess = (portal, role) => {
    if (portal === 'admin' && role === 'User') {
      return { allowed: false, error: 'Please use the User login page.' };
    }
    if (portal === 'user' && role !== 'User') {
      return { allowed: false, error: 'Please use the Admin login page.' };
    }
    return { allowed: true };
  };

  assert.equal(checkPortalAccess('admin', 'User').allowed, false);
  assert.equal(checkPortalAccess('user', 'Administrator').allowed, false);
  assert.equal(checkPortalAccess('admin', 'Administrator').allowed, true);
  assert.equal(checkPortalAccess('user', 'User').allowed, true);
});
