import test from 'node:test';
import assert from 'node:assert/strict';

test('Service Requests — Location Coordinator Scoping & Lock', () => {
  const resolveLocationId = (user, bodyLocationId) => {
    if (user.role === 'User') {
      return { locationId: null, requireOwnedAsset: true };
    }
    if (user.role === 'LocationCoordinator' && user.location_id) {
      return { locationId: user.location_id, requireOwnedAsset: false };
    }
    return { locationId: Number(bodyLocationId), requireOwnedAsset: false };
  };

  const coord = { userId: 8, role: 'LocationCoordinator', location_id: 200 };
  const admin = { userId: 1, role: 'Administrator' };

  assert.equal(resolveLocationId(coord, 999).locationId, 200, 'Coordinator location must lock to assigned site');
  assert.equal(resolveLocationId(admin, 999).locationId, 999, 'Admin can specify custom location');
});

test('Service Requests — Resolution Details Validation on Closure', () => {
  const validateClosureResolution = (newStatus, resolutionString) => {
    if (newStatus === 'Resolved' || newStatus === 'Closed') {
      if (!resolutionString || !String(resolutionString).trim()) {
        return { valid: false, error: 'Resolution details are required when marking a service request as Resolved or Closed.' };
      }
    }
    return { valid: true };
  };

  assert.equal(validateClosureResolution('Resolved', '').valid, false);
  assert.equal(validateClosureResolution('Closed', '   ').valid, false);
  assert.equal(validateClosureResolution('Resolved', 'Replaced faulty power adapter.').valid, true);
  assert.equal(validateClosureResolution('In Progress', '').valid, true);
});

test('Service Requests — Soft Delete Contract', () => {
  const performDeleteAction = (existing) => {
    if (existing.source === 'import') {
      return { allowed: false, error: 'Legacy imported service requests cannot be deleted.' };
    }
    return { allowed: true, updateData: { active: false }, logAction: 'Delete' };
  };

  const legacyItem = { id: 1, source: 'import', active: true };
  const manualItem = { id: 2, source: 'manual', active: true };

  assert.equal(performDeleteAction(legacyItem).allowed, false);
  assert.equal(performDeleteAction(manualItem).allowed, true);
  assert.equal(performDeleteAction(manualItem).updateData.active, false);
});
