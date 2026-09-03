import test from 'node:test';
import assert from 'node:assert/strict';

test('Asset Management — Asset ID Sequence Formatting', () => {
  const formatAssetId = (poNumber, assetTypeCode, seq) => {
    const poPart = (poNumber || 'NA').trim() || 'NA';
    const seqPart = String(seq).padStart(4, '0');
    return `UPSO1/IS/${poPart}/${assetTypeCode.toUpperCase()}/${seqPart}`;
  };

  assert.equal(formatAssetId('88371928', 'PC', 1), 'UPSO1/IS/88371928/PC/0001');
  assert.equal(formatAssetId('PO99', 'LAP', 12), 'UPSO1/IS/PO99/LAP/0012');
  assert.equal(formatAssetId('', 'PRN', 105), 'UPSO1/IS/NA/PRN/0105');
});

test('Asset Management — BOLA & Scoping Filter Rules', () => {
  const applyAssetScopeFilter = (user, baseWhere = { active: true }) => {
    const where = { ...baseWhere };
    if (user.role === 'User') {
      where.owner_user_id = user.userId;
    } else if (user.role === 'LocationCoordinator' && user.location_id) {
      where.location_id = user.location_id;
    }
    return where;
  };

  const user = { userId: 5, role: 'User', location_id: 10 };
  const coord = { userId: 8, role: 'LocationCoordinator', location_id: 20 };
  const admin = { userId: 1, role: 'Administrator' };

  assert.deepEqual(applyAssetScopeFilter(user), { active: true, owner_user_id: 5 });
  assert.deepEqual(applyAssetScopeFilter(coord), { active: true, location_id: 20 });
  assert.deepEqual(applyAssetScopeFilter(admin), { active: true });
});

test('Asset Management — Asset ID Ownership Verification', () => {
  const canAccessAsset = (user, asset) => {
    if (user.role === 'Administrator' || user.role === 'AssetManager') return true;
    if (user.role === 'User') return asset.owner_user_id === user.userId;
    if (user.role === 'LocationCoordinator') return asset.location_id === user.location_id;
    return false;
  };

  const assetA = { id: 101, owner_user_id: 5, location_id: 20 };

  assert.equal(canAccessAsset({ userId: 5, role: 'User' }, assetA), true);
  assert.equal(canAccessAsset({ userId: 99, role: 'User' }, assetA), false);
  assert.equal(canAccessAsset({ userId: 8, role: 'LocationCoordinator', location_id: 20 }, assetA), true);
  assert.equal(canAccessAsset({ userId: 8, role: 'LocationCoordinator', location_id: 99 }, assetA), false);
  assert.equal(canAccessAsset({ userId: 1, role: 'Administrator' }, assetA), true);
});
