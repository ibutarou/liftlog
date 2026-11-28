const test = require('node:test');
const assert = require('node:assert/strict');
const { STORAGE_KEYS } = require('../src/constants.js');

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function loadFreshStorage(mockStorage) {
  globalThis.localStorage = mockStorage;
  delete require.cache[require.resolve('../src/storage.js')];
  return require('../src/storage.js');
}

test('First-time visit seeds sample data and enables tutorial, then finishTutorialAndClearSample deletes sample permanently', () => {
  const mock = createMockStorage();
  const Storage = loadFreshStorage(mock);

  const initialWorkouts = Storage.loadWorkouts();
  assert.ok(initialWorkouts.length > 0);
  assert.equal(Storage.isUsingSampleData(), true);
  assert.equal(Storage.isTutorialCompleted(), false);
  assert.equal(Storage.shouldShowTutorial(), true);

  // Completing or skipping tutorial deletes sample workouts and marks tutorial completed
  const finished = Storage.finishTutorialAndClearSample();
  assert.equal(finished.clearedSample, true);
  assert.deepEqual(finished.workouts, []);
  assert.equal(Storage.isUsingSampleData(), false);
  assert.equal(Storage.isTutorialCompleted(), true);
  assert.equal(Storage.shouldShowTutorial(), false);

  // Reloading afterwards returns empty workouts and never re-seeds sample data or re-opens tutorial
  const reloaded = Storage.loadWorkouts();
  assert.deepEqual(reloaded, []);
  assert.equal(Storage.shouldShowTutorial(), false);
  assert.equal(Storage.isTutorialCompleted(), true);
});

test('Existing user with real workouts does not see tutorial and keeps data untouched', () => {
  const existingWorkouts = [
    {
      id: 'real_1',
      date: '2026-11-27',
      bodyPart: 'chest',
      exerciseName: 'ベンチプレス',
      weight: 80,
      reps: 8,
      sets: 3,
      memo: '',
      createdAt: 1000,
    },
  ];
  const mock = createMockStorage({
    [STORAGE_KEYS.workouts]: JSON.stringify(existingWorkouts),
    [STORAGE_KEYS.meta]: JSON.stringify({ initialized: true, isSample: false }),
  });
  const Storage = loadFreshStorage(mock);

  const loaded = Storage.loadWorkouts();
  assert.equal(loaded.length, 1);
  assert.equal(Storage.isUsingSampleData(), false);
  assert.equal(Storage.isTutorialCompleted(), true);
  assert.equal(Storage.shouldShowTutorial(), false);

  const res = Storage.finishTutorialAndClearSample();
  assert.equal(res.clearedSample, false);
  assert.equal(res.workouts.length, 1);
});

test('Preset exercise management supports load, add, duplicate rejection, full removal, and per-part reset', () => {
  const mock = createMockStorage();
  const Storage = loadFreshStorage(mock);

  let presets = Storage.loadPresets();
  assert.ok(presets.chest.includes('ベンチプレス'));
  assert.ok(presets.chest.includes('ディップス'));

  // Add new preset and verify persistence across reload
  const added = Storage.addPresetExercise(presets, 'chest', '  ペックフライ ');
  assert.equal(added.added, true);
  presets = added.presets;
  assert.ok(presets.chest.includes('ペックフライ'));

  // Reject duplicate regardless of case/whitespace
  const dup = Storage.addPresetExercise(presets, 'chest', 'ベンチプレス ');
  assert.equal(dup.added, false);
  assert.equal(dup.reason, 'duplicate');

  // Edit another part to verify per-part reset isolation
  presets = Storage.addPresetExercise(presets, 'back', 'ワンハンドロウ').presets;

  // Remove all presets in chest -> empty array must persist instead of reverting to defaults
  for (const name of [...presets.chest]) {
    presets = Storage.removePresetExercise(presets, 'chest', name);
  }
  assert.deepEqual(presets.chest, []);

  const ReloadedStorage = loadFreshStorage(mock);
  const reloadedPresets = ReloadedStorage.loadPresets();
  assert.deepEqual(reloadedPresets.chest, []);
  assert.ok(reloadedPresets.back.includes('ワンハンドロウ'));

  // Reset only chest -> chest returns to defaults, back keeps custom entry
  const resetPresets = ReloadedStorage.resetBodyPartPresets(reloadedPresets, 'chest');
  assert.ok(resetPresets.chest.includes('ベンチプレス'));
  assert.ok(!resetPresets.chest.includes('ペックフライ'));
  assert.ok(resetPresets.back.includes('ワンハンドロウ'));
});
