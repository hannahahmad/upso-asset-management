import test from 'node:test';
import assert from 'node:assert/strict';

test('User Management — Public Profile Projection Strips Password', () => {
  const toPublicUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    source: user.source,
    location: user.location ? { id: user.location.id, name: user.location.location_name } : null,
  });

  const rawUser = {
    id: 1,
    name: 'Admin User',
    email: 'admin@upso1.in',
    password: '$2a$10$Vdsn.BEbxiSM0k2HVWSoQeYgupdMlNIY6nWUGJrRH3TZJAEXareKW',
    role: 'Administrator',
    source: 'manual',
    location: { id: 10, location_name: 'UPSO-1' }
  };

  const publicUser = toPublicUser(rawUser);

  assert.equal('password' in publicUser, false, 'Password hash must never be present in public profile projection');
  assert.equal(publicUser.id, 1);
  assert.equal(publicUser.email, 'admin@upso1.in');
});

test('User Management — Location Reference Validation', () => {
  const validateLocationIdInput = (location_id) => {
    if (location_id === undefined || location_id === null || location_id === '') {
      return { valid: true, locationId: null };
    }
    const locId = Number(location_id);
    if (isNaN(locId) || !Number.isInteger(locId) || locId < 1) {
      return { valid: false, error: 'Invalid location_id' };
    }
    return { valid: true, locationId: locId };
  };

  assert.equal(validateLocationIdInput(undefined).valid, true);
  assert.equal(validateLocationIdInput('10').valid, true);
  assert.equal(validateLocationIdInput('invalid').valid, false);
  assert.equal(validateLocationIdInput('-5').valid, false);
});
