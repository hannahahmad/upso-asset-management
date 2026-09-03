import test from 'node:test';
import assert from 'node:assert/strict';

test('Dashboard Metrics — Role-Based Query Filter Scoping', () => {
  const getDashboardWhere = (user) => {
    const assetWhere = { active: true };
    const srWhere = { active: true };

    if (user.role === 'LocationCoordinator' && user.location_id) {
      assetWhere.location_id = user.location_id;
      srWhere.location_id = user.location_id;
    } else if (user.role === 'User') {
      assetWhere.owner_user_id = user.userId;
      srWhere.submitted_by_user_id = user.userId;
    }

    return { assetWhere, srWhere };
  };

  const admin = { userId: 1, role: 'Administrator' };
  const coord = { userId: 5, role: 'LocationCoordinator', location_id: 105 };
  const user = { userId: 12, role: 'User', location_id: 105 };

  assert.deepEqual(getDashboardWhere(admin), {
    assetWhere: { active: true },
    srWhere: { active: true }
  }, 'Admin queries global metrics');

  assert.deepEqual(getDashboardWhere(coord), {
    assetWhere: { active: true, location_id: 105 },
    srWhere: { active: true, location_id: 105 }
  }, 'LocationCoordinator queries site metrics');

  assert.deepEqual(getDashboardWhere(user), {
    assetWhere: { active: true, owner_user_id: 12 },
    srWhere: { active: true, submitted_by_user_id: 12 }
  }, 'User queries personal metrics');
});
