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

  const { STORAGE_KEYS, BODY_PART_MAP } = Constants;

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
    if (!storage) return { initialized: false, isSample: false };
    try {
      const raw = storage.getItem(STORAGE_KEYS.meta);
      if (!raw) return { initialized: false, isSample: false };
      const parsed = JSON.parse(raw);
      return {
        initialized: Boolean(parsed && parsed.initialized),
        isSample: Boolean(parsed && parsed.isSample),
      };
    } catch {
      return { initialized: false, isSample: false };
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
          isSample: metaUpdates && typeof metaUpdates.isSample === 'boolean' ? metaUpdates.isSample : prevMeta.isSample,
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
      saveWorkouts(sample, { isSample: true });
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
        app: 'LiftLog',
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
    loadTheme,
    saveTheme,
    exportWorkoutsJson,
    importWorkoutsJson,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LiftLog = root.LiftLog || {};
  root.LiftLog.Storage = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
