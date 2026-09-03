import test from 'node:test';
import assert from 'node:assert/strict';

test('Audit Logs — Authorization Scoping Rules', () => {
  const isAuditLogAccessAllowed = (role) => {
    const allowedRoles = ['Administrator', 'AssetManager'];
    return allowedRoles.includes(role);
  };

  assert.equal(isAuditLogAccessAllowed('Administrator'), true);
  assert.equal(isAuditLogAccessAllowed('AssetManager'), true);
  assert.equal(isAuditLogAccessAllowed('LocationCoordinator'), false);
  assert.equal(isAuditLogAccessAllowed('Engineer'), false);
  assert.equal(isAuditLogAccessAllowed('User'), false);
});
