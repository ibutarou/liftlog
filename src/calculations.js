(function (root) {
  'use strict';

  const Constants =
    typeof module !== 'undefined' && module.exports
      ? require('./constants.js')
      : root.LiftLog.Constants;

  const { BODY_PARTS, BODY_PART_MAP } = Constants;

  /**
   * Formats a Date object as local YYYY-MM-DD without UTC timezone shift.
   */
  function formatLocalDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parses YYYY-MM-DD into a local midnight Date.
   */
  function parseLocalDate(dateStr) {
    if (typeof dateStr !== 'string') return new Date(NaN);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    if (!match) return new Date(NaN);
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  /**
   * Returns whole calendar day difference (dateStrB - dateStrA).
   */
  function daysBetween(dateStrA, dateStrB) {
    const a = parseLocalDate(dateStrA);
    const b = parseLocalDate(dateStrB);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((b.getTime() - a.getTime()) / msPerDay);
  }

  /**
   * Normalizes exercise names for case-insensitive and whitespace-insensitive matching.
   */
  function normalizeExerciseName(name) {
    if (typeof name !== 'string') return '';
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Calculates estimated 1RM using Epley-like formula: weight * (1 + reps / 30).
   */
  function calculateOneRM(weight, reps) {
    const w = Number(weight);
    const r = Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) {
      return 0;
    }
    return Math.round(w * (1 + r / 30) * 10) / 10;
  }

  /**
   * Calculates session total volume: weight * reps * sets.
   */
  function calculateVolume(weight, reps, sets) {
    const w = Number(weight);
    const r = Number(reps);
    const s = Number(sets);
    if (!Number.isFinite(w) || !Number.isFinite(r) || !Number.isFinite(s) || w <= 0 || r <= 0 || s <= 0) {
      return 0;
    }
    return Math.round(w * r * s * 10) / 10;
  }

  function sortWorkoutsChronological(workouts) {
    return [...(workouts || [])].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const ca = Number(a.createdAt) || 0;
      const cb = Number(b.createdAt) || 0;
      if (ca !== cb) return ca - cb;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  function sortWorkoutsNewestFirst(workouts) {
    return sortWorkoutsChronological(workouts).reverse();
  }

  /**
   * Returns chronological exercise entries enriched with 1RM, volume, and PR flags.
   */
  function getExerciseHistoryWithPR(workouts, exerciseName) {
    const key = normalizeExerciseName(exerciseName);
    if (!key) {
      return {
        entries: [],
        bestOneRM: 0,
        bestOneRMDate: null,
        bestVolume: 0,
        bestVolumeDate: null,
        latestEntry: null,
        totalSessions: 0,
      };
    }

    const filtered = sortWorkoutsChronological(workouts).filter(
      (w) => normalizeExerciseName(w.exerciseName) === key
    );

    let maxOneRM = 0;
    let maxVolume = 0;
    let bestOneRMDate = null;
    let bestVolumeDate = null;

    const entries = filtered.map((w, index) => {
      const oneRM = calculateOneRM(w.weight, w.reps);
      const volume = calculateVolume(w.weight, w.reps, w.sets);
      const isFirstRecord = index === 0;
      const isOneRMPR = index > 0 && oneRM > maxOneRM && oneRM > 0;
      const isVolumePR = index > 0 && volume > maxVolume && volume > 0;
      const oneRMDelta = index > 0 ? Math.round((oneRM - maxOneRM) * 10) / 10 : 0;
      const volumeDelta = index > 0 ? Math.round((volume - maxVolume) * 10) / 10 : 0;

      if (oneRM > maxOneRM) {
        maxOneRM = oneRM;
        bestOneRMDate = w.date;
      }
      if (volume > maxVolume) {
        maxVolume = volume;
        bestVolumeDate = w.date;
      }

      return {
        ...w,
        oneRM,
        volume,
        isFirstRecord,
        isOneRMPR,
        isVolumePR,
        oneRMDelta,
        volumeDelta,
      };
    });

    return {
      entries,
      bestOneRM: maxOneRM,
      bestOneRMDate,
      bestVolume: maxVolume,
      bestVolumeDate,
      latestEntry: entries.length > 0 ? entries[entries.length - 1] : null,
      totalSessions: entries.length,
    };
  }

  /**
   * Returns the most recent workout for the same exercise (optionally excluding an ID).
   */
  function getPreviousRecord(workouts, exerciseName, excludeId) {
    const key = normalizeExerciseName(exerciseName);
    if (!key) return null;

    const ordered = sortWorkoutsNewestFirst(workouts);
    const match = ordered.find(
      (w) => normalizeExerciseName(w.exerciseName) === key && (!excludeId || w.id !== excludeId)
    );
    if (!match) return null;

    return {
      ...match,
      oneRM: calculateOneRM(match.weight, match.reps),
      volume: calculateVolume(match.weight, match.reps, match.sets),
    };
  }

  /**
   * Evaluates whether a candidate workout beats existing records for the same exercise.
   */
  function evaluateNewRecordPR(existingWorkouts, candidate) {
    const key = normalizeExerciseName(candidate && candidate.exerciseName);
    const oneRM = calculateOneRM(candidate && candidate.weight, candidate && candidate.reps);
    const volume = calculateVolume(
      candidate && candidate.weight,
      candidate && candidate.reps,
      candidate && candidate.sets
    );

    if (!key) {
      return {
        hasHistory: false,
        isOneRMPR: false,
        isVolumePR: false,
        oneRM,
        volume,
        prevBestOneRM: 0,
        prevBestVolume: 0,
        oneRMDelta: 0,
        volumeDelta: 0,
      };
    }

    const filtered = (existingWorkouts || []).filter(
      (w) => (!candidate.id || w.id !== candidate.id)
    );
    const history = getExerciseHistoryWithPR(filtered, candidate.exerciseName);
    const hasHistory = history.totalSessions > 0;
    const prevBestOneRM = history.bestOneRM;
    const prevBestVolume = history.bestVolume;

    const isOneRMPR = hasHistory && oneRM > prevBestOneRM && oneRM > 0;
    const isVolumePR = hasHistory && volume > prevBestVolume && volume > 0;

    return {
      hasHistory,
      isOneRMPR,
      isVolumePR,
      oneRM,
      volume,
      prevBestOneRM,
      prevBestVolume,
      oneRMDelta: hasHistory ? Math.round((oneRM - prevBestOneRM) * 10) / 10 : 0,
      volumeDelta: hasHistory ? Math.round((volume - prevBestVolume) * 10) / 10 : 0,
    };
  }

  /**
   * Lists unique exercises sorted by most recent date, then session count.
   */
  function getUniqueExercises(workouts) {
    const map = new Map();
    const sorted = sortWorkoutsChronological(workouts);

    for (const w of sorted) {
      const key = normalizeExerciseName(w.exerciseName);
      if (!key) continue;
      const oneRM = calculateOneRM(w.weight, w.reps);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: w.exerciseName.trim(),
          bodyPart: w.bodyPart,
          count: 1,
          lastDate: w.date,
          bestOneRM: oneRM,
        });
      } else {
        existing.name = w.exerciseName.trim();
        existing.bodyPart = w.bodyPart;
        existing.count += 1;
        if (w.date >= existing.lastDate) {
          existing.lastDate = w.date;
        }
        if (oneRM > existing.bestOneRM) {
          existing.bestOneRM = oneRM;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.lastDate !== b.lastDate) return a.lastDate > b.lastDate ? -1 : 1;
      if (a.count !== b.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'ja');
    });
  }

  /**
   * Filters workouts by period ('all' or number of days inclusive of referenceDate).
   */
  function filterWorkoutsByPeriod(workouts, period, referenceDate) {
    const list = workouts || [];
    if (period === 'all' || period === null || period === undefined) {
      return [...list];
    }

    const days = Number(period);
    if (!Number.isFinite(days) || days <= 0) {
      return [...list];
    }

    const refDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate || Date.now());
    const refMidnight = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const cutoff = new Date(refMidnight);
    cutoff.setDate(cutoff.getDate() - (days - 1));
    const cutoffStr = formatLocalDate(cutoff);
    const refStr = formatLocalDate(refMidnight);

    return list.filter((w) => typeof w.date === 'string' && w.date >= cutoffStr && w.date <= refStr);
  }

  /**
   * Computes set counts, volumes, and percentage shares for all 6 body parts.
   */
  function calculateBodyPartStats(workouts, period, referenceDate) {
    const filtered = filterWorkoutsByPeriod(workouts, period, referenceDate);

    const accum = {};
    for (const part of BODY_PARTS) {
      accum[part.id] = {
        id: part.id,
        label: part.label,
        color: part.color,
        sets: 0,
        volume: 0,
        sessions: 0,
        setsShare: 0,
        volumeShare: 0,
      };
    }

    let totalSets = 0;
    let totalVolume = 0;

    for (const w of filtered) {
      const part = accum[w.bodyPart];
      if (!part) continue;
      const sets = Math.max(0, Number(w.sets) || 0);
      const volume = calculateVolume(w.weight, w.reps, sets);
      part.sets += sets;
      part.volume = Math.round((part.volume + volume) * 10) / 10;
      part.sessions += 1;
      totalSets += sets;
      totalVolume = Math.round((totalVolume + volume) * 10) / 10;
    }

    const parts = BODY_PARTS.map((bp) => {
      const p = accum[bp.id];
      return {
        ...p,
        setsShare: totalSets > 0 ? Math.round((p.sets / totalSets) * 1000) / 10 : 0,
        volumeShare: totalVolume > 0 ? Math.round((p.volume / totalVolume) * 1000) / 10 : 0,
      };
    });

    return {
      period,
      totalWorkouts: filtered.length,
      totalSets,
      totalVolume,
      parts,
    };
  }

  /**
   * Generates up to 3 actionable Japanese coaching comments based on body part balance.
   */
  function generateBalanceAdvice(stats) {
    if (!stats || stats.totalWorkouts === 0 || stats.totalSets === 0) {
      return [
        {
          level: 'info',
          title: 'まだ記録がありません',
          message: 'この期間のワークアウトが未登録です。「記録」タブからトレーニングを登録すると部位バランスが表示されます。',
        },
      ];
    }

    const advice = [];
    const { parts, totalSets } = stats;
    const partById = parts.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const zeroParts = parts.filter((p) => p.sets === 0);
    if (zeroParts.length > 0) {
      const names = zeroParts.map((p) => p.label).join('・');
      advice.push({
        level: 'warning',
        title: `未実施の部位があります（${names}）`,
        message: `選択期間中に「${names}」のセット数が0です。怪我予防と全身の成長のため、週1〜2セットから取り入れてみましょう。`,
      });
    }

    const maxSets = Math.max(...parts.map((p) => p.sets));
    const dominantPart = parts.find((p) => p.sets === maxSets);

    if (dominantPart && dominantPart.setsShare >= 40 && totalSets >= 6) {
      advice.push({
        level: 'warning',
        title: `${dominantPart.label}への偏りが強めです（${dominantPart.setsShare}%）`,
        message: `総セット数の${dominantPart.setsShare}%が「${dominantPart.label}」に集中しています。疲労の蓄積を防ぐため、他部位の種目もバランス良く配分するのがおすすめです。`,
      });
    }

    const lowTrainedParts = parts.filter(
      (p) => p.sets > 0 && p.setsShare < 8 && maxSets >= p.sets * 3 && totalSets >= 10
    );
    if (lowTrainedParts.length > 0) {
      const names = lowTrainedParts.map((p) => `${p.label}(${p.sets}set)`).join('・');
      advice.push({
        level: 'info',
        title: `セット数が少なめの部位：${names}`,
        message: `他の部位と比べて「${names}」の刺激量が少なめです。次回1〜2セット追加するとバランスが整います。`,
      });
    }

    const pushSets = (partById.chest ? partById.chest.sets : 0) + (partById.shoulders ? partById.shoulders.sets : 0);
    const pullSets = partById.back ? partById.back.sets : 0;
    if (pushSets >= 6 && pullSets > 0 && pushSets >= pullSets * 2.2) {
      advice.push({
        level: 'info',
        title: '押す動作（胸・肩）が引く動作（背中）より多めです',
        message: `胸・肩（計${pushSets}set）に対して背中（${pullSets}set）が少なめです。姿勢維持のため背中の種目も意識して増やしましょう。`,
      });
    } else if (pullSets >= 6 && pushSets > 0 && pullSets >= pushSets * 2.2) {
      advice.push({
        level: 'info',
        title: '引く動作（背中）が押す動作（胸・肩）より多めです',
        message: `背中（${pullSets}set）に対して胸・肩（計${pushSets}set）が少なめです。上半身の前後バランスを意識してみましょう。`,
      });
    }

    const legs = partById.legs;
    if (legs && legs.sets > 0 && legs.setsShare < 12 && totalSets >= 12 && !lowTrainedParts.some((p) => p.id === 'legs')) {
      advice.push({
        level: 'info',
        title: `下半身（脚）の割合がやや控えめです（${legs.setsShare}%）`,
        message: `下半身は大筋群が多く基礎代謝や総合力に直結します。スクワットやレッグプレスを少しずつ増やすのも効果的です。`,
      });
    }

    if (advice.length === 0) {
      advice.push({
        level: 'success',
        title: '全身バランス良くトレーニングできています',
        message: '特定の部位への極端な偏りや未実施部位は見られません。このペースで漸進性過負荷（重量・回数の更新）を続けていきましょう。',
      });
    }

    return advice.slice(0, 3);
  }

  function getBodyPartLabel(id) {
    return BODY_PART_MAP[id] ? BODY_PART_MAP[id].label : id;
  }

  /**
   * Builds monthly calendar grid data and summary stats for a given year and 0-based monthIndex.
   */
  function buildCalendarMonthData(workouts, year, monthIndex, todayDate) {
    const refToday = todayDate instanceof Date ? todayDate : new Date(todayDate || Date.now());
    const todayStr = formatLocalDate(refToday);

    const byDate = new Map();
    for (const w of workouts || []) {
      if (!w || typeof w.date !== 'string') continue;
      let entry = byDate.get(w.date);
      if (!entry) {
        entry = {
          count: 0,
          totalSets: 0,
          totalVolume: 0,
          bodyPartSet: new Set(),
        };
        byDate.set(w.date, entry);
      }
      const sets = Math.max(0, Number(w.sets) || 0);
      const volume = calculateVolume(w.weight, w.reps, sets);
      entry.count += 1;
      entry.totalSets += sets;
      entry.totalVolume = Math.round((entry.totalVolume + volume) * 10) / 10;
      if (w.bodyPart && BODY_PART_MAP[w.bodyPart]) {
        entry.bodyPartSet.add(w.bodyPart);
      }
    }

    const firstOfMonth = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const lastOfMonth = new Date(year, monthIndex + 1, 0, 0, 0, 0, 0);

    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    const endDate = new Date(lastOfMonth);
    endDate.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));

    const cells = [];
    let trainedDaysCount = 0;
    let monthTotalWorkouts = 0;
    let monthTotalSets = 0;

    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateStr = formatLocalDate(cursor);
      const inCurrentMonth = cursor.getFullYear() === year && cursor.getMonth() === monthIndex;
      const dayStats = byDate.get(dateStr);

      const count = dayStats ? dayStats.count : 0;
      const totalSets = dayStats ? dayStats.totalSets : 0;
      const totalVolume = dayStats ? dayStats.totalVolume : 0;
      const bodyParts = dayStats
        ? BODY_PARTS.filter((bp) => dayStats.bodyPartSet.has(bp.id)).map((bp) => ({
            id: bp.id,
            label: bp.label,
            color: bp.color,
          }))
        : [];

      if (inCurrentMonth) {
        if (count > 0) trainedDaysCount += 1;
        monthTotalWorkouts += count;
        monthTotalSets += totalSets;
      }

      cells.push({
        dateStr,
        day: cursor.getDate(),
        inCurrentMonth,
        isToday: dateStr === todayStr,
        count,
        totalSets,
        totalVolume,
        bodyParts,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      year,
      monthIndex,
      monthLabel: `${year}年${monthIndex + 1}月`,
      trainedDaysCount,
      monthTotalWorkouts,
      monthTotalSets,
      cells,
    };
  }

  /**
   * Evaluates whether a touch gesture qualifies as a horizontal tab swipe.
   * Supports shorter relaxed swipes, fast flicks, and deliberate drags past commit distance.
   */
  function evaluateSwipeNavigation({
    dx,
    dy,
    durationMs,
    currentTab,
    tabOrder,
    stageWidth = 0,
    lockedHorizontal = false,
    minDistancePx = 42,
    flickDistancePx = 28,
    flickVelocityPxPerMs = 0.28,
    horizontalRatio = 1.2,
    maxDurationMs = 1200,
  }) {
    const order = Array.isArray(tabOrder) && tabOrder.length > 0
      ? tabOrder
      : ['record', 'growth', 'balance', 'history'];
    const currentIndex = order.indexOf(currentTab);
    if (currentIndex === -1) return null;

    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    const hasDuration = durationMs !== undefined && durationMs !== null;
    if (hasDuration && (!Number.isFinite(durationMs) || durationMs < 0)) {
      return null;
    }

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!lockedHorizontal && absX < absY * horizontalRatio) return null;

    const commitDistancePx =
      stageWidth > 0
        ? Math.max(minDistancePx * 1.8, Math.round(stageWidth * 0.28))
        : Math.max(minDistancePx * 1.8, 100);

    const isDeliberateDrag = absX >= commitDistancePx;
    const isDistanceSwipe = absX >= minDistancePx && (!hasDuration || durationMs <= maxDurationMs);
    const isFastFlick =
      hasDuration &&
      durationMs > 0 &&
      durationMs <= maxDurationMs &&
      absX >= flickDistancePx &&
      absX / durationMs >= flickVelocityPxPerMs;

    if (!isDeliberateDrag && !isDistanceSwipe && !isFastFlick) {
      return null;
    }

    // Swiping left (dx < 0) moves to next tab; swiping right (dx > 0) moves to previous tab
    const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= order.length) return null;

    return order[nextIndex];
  }

  /**
   * Computes pixel offsets for finger-following horizontal tab swipe drags.
   */
  function computeSwipeDragState({
    dx,
    dy,
    currentTab,
    tabOrder,
    stageWidth,
    gapPx = 16,
    edgeResistance = 0.25,
    maxEdgePull = 48,
  }) {
    const order = Array.isArray(tabOrder) && tabOrder.length > 0
      ? tabOrder
      : ['record', 'growth', 'balance', 'history'];
    const stride = Math.max(1, Number(stageWidth) || 0) + gapPx;
    const currentIndex = order.indexOf(currentTab);

    if (currentIndex === -1 || !Number.isFinite(dx) || dx === 0) {
      return {
        direction: 0,
        neighborTab: null,
        currentOffsetPx: 0,
        neighborOffsetPx: null,
        stride,
      };
    }

    const direction = dx < 0 ? -1 : 1;
    const neighborIndex = currentIndex - direction;

    if (neighborIndex >= 0 && neighborIndex < order.length) {
      const currentOffsetPx = Math.max(-stride, Math.min(stride, Math.round(dx * 10) / 10));
      const neighborOffsetPx = Math.round((currentOffsetPx + (direction < 0 ? stride : -stride)) * 10) / 10;
      return {
        direction,
        neighborTab: order[neighborIndex],
        currentOffsetPx,
        neighborOffsetPx,
        stride,
      };
    }

    const resisted = dx * edgeResistance;
    const currentOffsetPx = Math.max(-maxEdgePull, Math.min(maxEdgePull, Math.round(resisted * 10) / 10));
    return {
      direction,
      neighborTab: null,
      currentOffsetPx,
      neighborOffsetPx: null,
      stride,
    };
  }

  /**
   * Computes viewport-clamped spotlight and popover coordinates for the onboarding walkthrough.
   */
  function computeTutorialPopoverPosition({
    targetRect,
    cardWidth,
    cardHeight,
    viewportWidth,
    viewportHeight,
    margin = 12,
    gap = 14,
    safeTop = 4,
    safeBottom = 4,
  }) {
    const vw = Math.max(200, Number(viewportWidth) || 390);
    const vh = Math.max(200, Number(viewportHeight) || 844);
    const cw = Math.min(vw - margin * 2, Math.max(180, Number(cardWidth) || 320));
    const ch = Math.max(120, Number(cardHeight) || 200);

    const minSpotTop = Math.max(4, Math.round(safeTop));
    const maxSpotBottom = Math.max(minSpotTop + 8, Math.round(vh - Math.max(4, safeBottom)));

    const pad = 6;
    const rawLeft = (targetRect ? targetRect.left : vw / 2) - pad;
    const rawTop = (targetRect ? targetRect.top : vh / 2) - pad;
    const rawRight = (targetRect ? targetRect.right : vw / 2) + pad;
    const rawBottom = (targetRect ? targetRect.bottom : vh / 2) + pad;

    const spotLeft = Math.max(4, Math.min(vw - 8, Math.round(rawLeft)));
    const spotTop = Math.max(minSpotTop, Math.min(maxSpotBottom - 8, Math.round(rawTop)));
    const spotRight = Math.max(spotLeft + 8, Math.min(vw - 4, Math.round(rawRight)));
    const spotBottom = Math.max(spotTop + 8, Math.min(maxSpotBottom, Math.round(rawBottom)));
    const spotlight = {
      top: spotTop,
      left: spotLeft,
      width: spotRight - spotLeft,
      height: spotBottom - spotTop,
    };

    const targetCenterX = spotLeft + spotlight.width / 2;
    const maxLeft = Math.max(margin, vw - cw - margin);
    const left = Math.round(Math.max(margin, Math.min(maxLeft, targetCenterX - cw / 2)));

    const minTop = Math.max(margin, minSpotTop);
    const maxBottom = Math.max(minTop + ch, vh - Math.max(margin, Math.round(safeBottom)));

    let top;
    if (spotBottom + gap + ch <= maxBottom) {
      top = Math.round(spotBottom + gap);
    } else if (spotTop - gap - ch >= minTop) {
      top = Math.round(spotTop - gap - ch);
    } else {
      top = Math.round(Math.max(minTop, maxBottom - ch));
    }

    return { top, left, spotlight };
  }

  const api = {
    formatLocalDate,
    parseLocalDate,
    daysBetween,
    normalizeExerciseName,
    calculateOneRM,
    calculateVolume,
    sortWorkoutsChronological,
    sortWorkoutsNewestFirst,
    getExerciseHistoryWithPR,
    getPreviousRecord,
    evaluateNewRecordPR,
    getUniqueExercises,
    filterWorkoutsByPeriod,
    calculateBodyPartStats,
    generateBalanceAdvice,
    getBodyPartLabel,
    buildCalendarMonthData,
    evaluateSwipeNavigation,
    computeSwipeDragState,
    computeTutorialPopoverPosition,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LiftLog = root.LiftLog || {};
  root.LiftLog.Calculations = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
