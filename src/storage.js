(function (root) {
  'use strict';

  const Constants =
    typeof module !== 'undefined' && module.exports
      ? require('./constants.js')
      : root.LiftLog.Constants;
  const SampleData =
    typeof module !== 'undefined' && module.exports
      ? require('./sampleData.js')
      : root.LiftLog.SampleData;

  const { STORAGE_KEYS, BODY_PARTS, BODY_PART_MAP } = Constants;

  function getStorage() {
    try {
      if (typeof root !== 'undefined' && root.localStorage) {
        return root.localStorage;
      }
    } catch {
      return null;
    }
    return null;
  }

  function sanitizeWorkout(item, fallbackIndex) {
    if (!item || typeof item !== 'object') return null;
    const date = typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null;
    const bodyPart = BODY_PART_MAP[item.bodyPart] ? item.bodyPart : null;
    const exerciseName = typeof item.exerciseName === 'string' ? item.exerciseName.trim() : '';
    const weight = Number(item.weight);
    const reps = Number(item.reps);
    const sets = Number(item.sets);

    if (!date || !bodyPart || !exerciseName) return null;
    if (!Number.isFinite(weight) || weight <= 0) return null;
    if (!Number.isFinite(reps) || reps <= 0) return null;
    if (!Number.isFinite(sets) || sets <= 0) return null;

    return {
      id: typeof item.id === 'string' && item.id ? item.id : `w_${Date.now()}_${fallbackIndex || 0}`,
      date,
      bodyPart,
      exerciseName,
      weight: Math.round(weight * 100) / 100,
      reps: Math.round(reps),
      sets: Math.round(sets),
      memo: typeof item.memo === 'string' ? item.memo.trim() : '',
      createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now(),
    };
  }

  function readMeta() {
    const storage = getStorage();
    if (!storage) return { initialized: false, isSample: false, tutorialCompleted: false };
    try {
      const raw = storage.getItem(STORAGE_KEYS.meta);
      if (!raw) return { initialized: false, isSample: false, tutorialCompleted: false };
      const parsed = JSON.parse(raw);
      const initialized = Boolean(parsed && parsed.initialized);
      const isSample = Boolean(parsed && parsed.isSample);
      const tutorialCompleted =
        parsed && typeof parsed.tutorialCompleted === 'boolean'
          ? parsed.tutorialCompleted
          : Boolean(initialized && !isSample);
      return {
        initialized,
        isSample,
        tutorialCompleted,
      };
    } catch {
      return { initialized: false, isSample: false, tutorialCompleted: false };
    }
  }

  function writeMeta(meta) {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEYS.meta, JSON.stringify(meta));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }

  function saveWorkouts(workouts, metaUpdates) {
    const sanitized = (workouts || [])
      .map((item, idx) => sanitizeWorkout(item, idx))
      .filter(Boolean);
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEYS.workouts, JSON.stringify(sanitized));
        const prevMeta = readMeta();
        writeMeta({
          initialized: true,
          isSample:
            metaUpdates && typeof metaUpdates.isSample === 'boolean'
              ? metaUpdates.isSample
              : prevMeta.isSample,
          tutorialCompleted:
            metaUpdates && typeof metaUpdates.tutorialCompleted === 'boolean'
              ? metaUpdates.tutorialCompleted
              : prevMeta.tutorialCompleted,
        });
      } catch {
        // Ignore storage write errors
      }
    }
    return sanitized;
  }

  function loadWorkouts() {
    const storage = getStorage();
    if (!storage) {
      return SampleData.createSampleWorkouts();
    }

    const meta = readMeta();
    const raw = storage.getItem(STORAGE_KEYS.workouts);

    if (raw === null && !meta.initialized) {
      const sample = SampleData.createSampleWorkouts();
      saveWorkouts(sample, { isSample: true, tutorialCompleted: false });
      return sample;
    }

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item, idx) => sanitizeWorkout(item, idx)).filter(Boolean);
    } catch {
      return [];
    }
  }

  function isUsingSampleData() {
    return readMeta().isSample;
  }

  function isTutorialCompleted() {
    return readMeta().tutorialCompleted;
  }

  function shouldShowTutorial() {
    const meta = readMeta();
    return !meta.tutorialCompleted && meta.isSample;
  }

  function markTutorialCompleted() {
    const prevMeta = readMeta();
    writeMeta({
      initialized: true,
      isSample: prevMeta.isSample,
      tutorialCompleted: true,
    });
  }

  function finishTutorialAndClearSample() {
    const meta = readMeta();
    if (meta.isSample) {
      saveWorkouts([], { isSample: false, tutorialCompleted: true });
      return { workouts: [], clearedSample: true };
    }
    markTutorialCompleted();
    return { workouts: loadWorkouts(), clearedSample: false };
  }

  function loadTheme() {
    const storage = getStorage();
    if (storage) {
      try {
        const stored = storage.getItem(STORAGE_KEYS.theme);
        if (stored === 'dark' || stored === 'light') {
          return stored;
        }
      } catch {
        // Ignore storage read errors
      }
    }
    try {
      if (root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // Ignore matchMedia errors
    }
    return 'light';
  }

  function saveTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEYS.theme, next);
      } catch {
        // Ignore storage write errors
      }
    }
    return next;
  }

  function normalizePresetKey(name) {
    return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLowerCase() : '';
  }

  function getDefaultPresets() {
    const map = {};
    for (const part of BODY_PARTS) {
      map[part.id] = [...part.presets];
    }
    return map;
  }

  function sanitizePresetList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim().replace(/\s+/g, ' ');
      if (!trimmed) continue;
      const key = normalizePresetKey(trimmed);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  }

  function loadPresets() {
    const defaults = getDefaultPresets();
    const storage = getStorage();
    if (!storage) return defaults;

    try {
      const raw = storage.getItem(STORAGE_KEYS.presets);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return defaults;
      }
      const result = {};
      for (const part of BODY_PARTS) {
        if (Array.isArray(parsed[part.id])) {
          result[part.id] = sanitizePresetList(parsed[part.id]);
        } else {
          result[part.id] = [...part.presets];
        }
      }
      return result;
    } catch {
      return defaults;
    }
  }

  function savePresets(presetsMap) {
    const next = {};
    for (const part of BODY_PARTS) {
      if (presetsMap && Array.isArray(presetsMap[part.id])) {
        next[part.id] = sanitizePresetList(presetsMap[part.id]);
      } else {
        next[part.id] = [...part.presets];
      }
    }
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(STORAGE_KEYS.presets, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
    }
    return next;
  }

  function addPresetExercise(presetsMap, bodyPart, name) {
    if (!BODY_PART_MAP[bodyPart]) {
      return { presets: presetsMap || loadPresets(), added: false, reason: 'invalid_part' };
    }
    const trimmed = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    if (!trimmed) {
      return { presets: presetsMap || loadPresets(), added: false, reason: 'empty' };
    }
    const base = presetsMap && typeof presetsMap === 'object' ? presetsMap : loadPresets();
    const currentList = Array.isArray(base[bodyPart]) ? base[bodyPart] : [...BODY_PART_MAP[bodyPart].presets];
    const key = normalizePresetKey(trimmed);
    if (currentList.some((item) => normalizePresetKey(item) === key)) {
      return { presets: base, added: false, reason: 'duplicate' };
    }
    const saved = savePresets({
      ...base,
      [bodyPart]: [...currentList, trimmed],
    });
    return { presets: saved, added: true };
  }

  function removePresetExercise(presetsMap, bodyPart, name) {
    if (!BODY_PART_MAP[bodyPart]) {
      return presetsMap || loadPresets();
    }
    const base = presetsMap && typeof presetsMap === 'object' ? presetsMap : loadPresets();
    const currentList = Array.isArray(base[bodyPart]) ? base[bodyPart] : [...BODY_PART_MAP[bodyPart].presets];
    const key = normalizePresetKey(name);
    const nextList = currentList.filter((item) => normalizePresetKey(item) !== key);
    return savePresets({
      ...base,
      [bodyPart]: nextList,
    });
  }

  function resetBodyPartPresets(presetsMap, bodyPart) {
    if (!BODY_PART_MAP[bodyPart]) {
      return presetsMap || loadPresets();
    }
    const base = presetsMap && typeof presetsMap === 'object' ? presetsMap : loadPresets();
    return savePresets({
      ...base,
      [bodyPart]: [...BODY_PART_MAP[bodyPart].presets],
    });
  }

  function generateId() {
    return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function addWorkout(workouts, input) {
    const candidate = sanitizeWorkout({
      ...input,
      id: generateId(),
      createdAt: Date.now(),
    });
    if (!candidate) return { workouts, added: null };
    const next = [...(workouts || []), candidate];
    saveWorkouts(next, { isSample: false });
    return { workouts: next, added: candidate };
  }

  function updateWorkout(workouts, id, input) {
    let updatedItem = null;
    const next = (workouts || []).map((item) => {
      if (item.id !== id) return item;
      const sanitized = sanitizeWorkout({
        ...item,
        ...input,
        id: item.id,
        createdAt: item.createdAt,
      });
      if (sanitized) {
        updatedItem = sanitized;
        return sanitized;
      }
      return item;
    });
    if (updatedItem) {
      saveWorkouts(next, { isSample: false });
    }
    return { workouts: next, updated: updatedItem };
  }

  function deleteWorkout(workouts, id) {
    const next = (workouts || []).filter((item) => item.id !== id);
    saveWorkouts(next, { isSample: false });
    return next;
  }

  function clearWorkouts() {
    saveWorkouts([], { isSample: false });
    return [];
  }

  function seedSampleData() {
    const sample = SampleData.createSampleWorkouts();
    saveWorkouts(sample, { isSample: true });
    return sample;
  }

  function exportWorkoutsJson(workouts) {
    return JSON.stringify(
      {
        app: 'マチョめも',
        version: 1,
        exportedAt: new Date().toISOString(),
        workouts: workouts || [],
      },
      null,
      2
    );
  }

  function importWorkoutsJson(jsonText) {
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.workouts) ? parsed.workouts : null;
    if (!items) {
      throw new Error('有効なワークアウトJSONではありません。');
    }
    const sanitized = items.map((item, idx) => sanitizeWorkout(item, idx)).filter(Boolean);
    saveWorkouts(sanitized, { isSample: false });
    return sanitized;
  }

  const api = {
    sanitizeWorkout,
    loadWorkouts,
    saveWorkouts,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    clearWorkouts,
    seedSampleData,
    isUsingSampleData,
    isTutorialCompleted,
    shouldShowTutorial,
    markTutorialCompleted,
    finishTutorialAndClearSample,
    loadTheme,
    saveTheme,
    getDefaultPresets,
    sanitizePresetList,
    loadPresets,
    savePresets,
    addPresetExercise,
    removePresetExercise,
    resetBodyPartPresets,
    exportWorkoutsJson,
    importWorkoutsJson,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LiftLog = root.LiftLog || {};
  root.LiftLog.Storage = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
