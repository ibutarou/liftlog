const test = require('node:test');
const assert = require('node:assert/strict');

const { BODY_PARTS, BODY_PART_MAP } = require('../src/constants.js');
const {
  formatLocalDate,
  calculateOneRM,
  calculateVolume,
  getExerciseHistoryWithPR,
  getPreviousRecord,
  evaluateNewRecordPR,
  filterWorkoutsByPeriod,
  calculateBodyPartStats,
  generateBalanceAdvice,
  buildCalendarMonthData,
  evaluateSwipeNavigation,
  computeSwipeDragState,
  computeTutorialPopoverPosition,
} = require('../src/calculations.js');
const { createSampleWorkouts } = require('../src/sampleData.js');
const { computeGrowthChartLayout } = require('../src/charts.js');

test('calculateOneRM calculates weight * (1 + reps / 30) rounded to 1 decimal', () => {
  assert.equal(calculateOneRM(60, 10), 80);
  assert.equal(calculateOneRM(100, 5), 116.7);
  assert.equal(calculateOneRM(72.5, 8), 91.8);
  assert.equal(calculateOneRM(0, 10), 0);
  assert.equal(calculateOneRM(60, 0), 0);
  assert.equal(calculateOneRM(-10, 5), 0);
});

test('calculateVolume calculates weight * reps * sets cleanly', () => {
  assert.equal(calculateVolume(60, 10, 3), 1800);
  assert.equal(calculateVolume(62.5, 8, 3), 1500);
  assert.equal(calculateVolume(0, 10, 3), 0);
  assert.equal(calculateVolume(60, 0, 3), 0);
  assert.equal(calculateVolume(60, 10, 0), 0);
});

test('getExerciseHistoryWithPR & evaluateNewRecordPR handle baseline, PR breakthrough, non-PR, and tie', () => {
  const workouts = [
    { id: '1', date: '2026-11-01', bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 60, reps: 10, sets: 3, createdAt: 1 },
    { id: '2', date: '2026-11-05', bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 65, reps: 10, sets: 3, createdAt: 2 },
    { id: '3', date: '2026-11-10', bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 60, reps: 8, sets: 3, createdAt: 3 },
    { id: '4', date: '2026-11-12', bodyPart: 'chest', exerciseName: 'ベンチプレス', weight: 65, reps: 10, sets: 3, createdAt: 4 },
  ];

  const history = getExerciseHistoryWithPR(workouts, ' ベンチプレス ');
  assert.equal(history.totalSessions, 4);
  assert.equal(history.entries[0].isFirstRecord, true);
  assert.equal(history.entries[0].isOneRMPR, false);
  assert.equal(history.entries[0].isVolumePR, false);

  // Entry 2 beats baseline
  assert.equal(history.entries[1].isOneRMPR, true);
  assert.equal(history.entries[1].isVolumePR, true);

  // Entry 3 is lower
  assert.equal(history.entries[2].isOneRMPR, false);
  assert.equal(history.entries[2].isVolumePR, false);

  // Entry 4 is a tie, so not strictly greater -> not PR
  assert.equal(history.entries[3].isOneRMPR, false);
  assert.equal(history.entries[3].isVolumePR, false);

  assert.equal(history.bestOneRM, 86.7);
  assert.equal(history.bestOneRMDate, '2026-11-05');
  assert.equal(history.bestVolume, 1950);

  const evalBreak = evaluateNewRecordPR(workouts, {
    exerciseName: 'ベンチプレス',
    weight: 70,
    reps: 10,
    sets: 3,
  });
  assert.equal(evalBreak.hasHistory, true);
  assert.equal(evalBreak.isOneRMPR, true);
  assert.equal(evalBreak.isVolumePR, true);
  assert.equal(evalBreak.oneRMDelta, 6.6);
  assert.equal(evalBreak.volumeDelta, 150);

  const evalTie = evaluateNewRecordPR(workouts, {
    exerciseName: 'ベンチプレス',
    weight: 65,
    reps: 10,
    sets: 3,
  });
  assert.equal(evalTie.isOneRMPR, false);
  assert.equal(evalTie.isVolumePR, false);
});

test('getPreviousRecord normalizes exercise name and respects excludeId', () => {
  const workouts = [
    { id: 'w1', date: '2026-11-01', bodyPart: 'legs', exerciseName: 'Squat', weight: 80, reps: 8, sets: 3, createdAt: 1 },
    { id: 'w2', date: '2026-11-10', bodyPart: 'legs', exerciseName: '  squat ', weight: 90, reps: 8, sets: 3, createdAt: 2 },
  ];

  const latest = getPreviousRecord(workouts, 'SQUAT');
  assert.equal(latest.id, 'w2');
  assert.equal(latest.weight, 90);

  const excludingLatest = getPreviousRecord(workouts, 'squat', 'w2');
  assert.equal(excludingLatest.id, 'w1');
  assert.equal(excludingLatest.weight, 80);
});

test('filterWorkoutsByPeriod filters inclusive calendar day windows and all', () => {
  const ref = new Date(2026, 10, 27); // 2026-11-27
  const workouts = [
    { id: 'a', date: '2026-11-27', bodyPart: 'chest', exerciseName: 'Bench', weight: 60, reps: 10, sets: 3 },
    { id: 'b', date: '2026-11-21', bodyPart: 'chest', exerciseName: 'Bench', weight: 60, reps: 10, sets: 3 }, // exact 7-day boundary (27 - 6)
    { id: 'c', date: '2026-11-20', bodyPart: 'chest', exerciseName: 'Bench', weight: 60, reps: 10, sets: 3 }, // 8th day ago
    { id: 'd', date: '2026-11-14', bodyPart: 'back', exerciseName: 'Row', weight: 50, reps: 10, sets: 3 }, // exact 14-day boundary (27 - 13)
    { id: 'e', date: '2026-10-01', bodyPart: 'legs', exerciseName: 'Squat', weight: 80, reps: 8, sets: 3 },
  ];

  assert.deepEqual(filterWorkoutsByPeriod(workouts, 7, ref).map((w) => w.id), ['a', 'b']);
  assert.deepEqual(filterWorkoutsByPeriod(workouts, 14, ref).map((w) => w.id), ['a', 'b', 'c', 'd']);
  assert.equal(filterWorkoutsByPeriod(workouts, 'all', ref).length, 5);
});

test('calculateBodyPartStats returns all 6 parts and accurate shares summing to ~100%', () => {
  const ref = new Date(2026, 10, 27);
  const workouts = [
    { id: '1', date: '2026-11-27', bodyPart: 'chest', exerciseName: 'Bench', weight: 50, reps: 10, sets: 4 }, // vol 2000, sets 4
    { id: '2', date: '2026-11-26', bodyPart: 'back', exerciseName: 'Row', weight: 50, reps: 10, sets: 4 }, // vol 2000, sets 4
  ];

  const stats = calculateBodyPartStats(workouts, 7, ref);
  assert.equal(stats.parts.length, 6);
  assert.equal(stats.totalSets, 8);
  assert.equal(stats.totalVolume, 4000);

  const chest = stats.parts.find((p) => p.id === 'chest');
  const back = stats.parts.find((p) => p.id === 'back');
  const core = stats.parts.find((p) => p.id === 'core');

  assert.equal(chest.setsShare, 50);
  assert.equal(chest.volumeShare, 50);
  assert.equal(back.setsShare, 50);
  assert.equal(core.sets, 0);

  const sumVolumeShares = stats.parts.reduce((acc, p) => acc + p.volumeShare, 0);
  assert.equal(Math.round(sumVolumeShares), 100);
});

test('generateBalanceAdvice covers empty, missing parts, dominant part, and balanced states', () => {
  const emptyStats = calculateBodyPartStats([], 7, new Date(2026, 10, 27));
  const emptyAdvice = generateBalanceAdvice(emptyStats);
  assert.equal(emptyAdvice[0].level, 'info');

  // Missing parts & dominant chest
  const skewedWorkouts = [
    { id: '1', date: '2026-11-27', bodyPart: 'chest', exerciseName: 'Bench', weight: 60, reps: 10, sets: 10 },
    { id: '2', date: '2026-11-26', bodyPart: 'back', exerciseName: 'Row', weight: 50, reps: 10, sets: 3 },
  ];
  const skewedStats = calculateBodyPartStats(skewedWorkouts, 7, new Date(2026, 10, 27));
  const skewedAdvice = generateBalanceAdvice(skewedStats);
  assert.ok(skewedAdvice.some((a) => a.level === 'warning' && a.title.includes('未実施')));
  assert.ok(skewedAdvice.some((a) => a.level === 'warning' && a.title.includes('胸への偏り')));

  // Balanced across all 6 parts
  const balancedWorkouts = BODY_PARTS.map((bp, i) => ({
    id: `b_${i}`,
    date: '2026-11-27',
    bodyPart: bp.id,
    exerciseName: bp.presets[0],
    weight: 50,
    reps: 10,
    sets: 3,
  }));
  const balancedStats = calculateBodyPartStats(balancedWorkouts, 7, new Date(2026, 10, 27));
  const balancedAdvice = generateBalanceAdvice(balancedStats);
  assert.equal(balancedAdvice.length, 1);
  assert.equal(balancedAdvice[0].level, 'success');
});

test('createSampleWorkouts generates valid records with PR progression and period variation', () => {
  const ref = new Date(2026, 10, 27);
  const sample = createSampleWorkouts(ref);
  assert.ok(sample.length >= 25);

  for (const w of sample) {
    assert.ok(BODY_PART_MAP[w.bodyPart], `Unknown bodyPart: ${w.bodyPart}`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(w.date));
    assert.ok(w.weight > 0 && w.reps > 0 && w.sets > 0);
  }

  const benchHistory = getExerciseHistoryWithPR(sample, 'ベンチプレス');
  assert.ok(benchHistory.totalSessions >= 4);
  assert.ok(benchHistory.entries.some((e) => e.isOneRMPR), 'Bench press should show PR breakthroughs');

  const stats7 = calculateBodyPartStats(sample, 7, ref);
  const stats30 = calculateBodyPartStats(sample, 30, ref);
  assert.ok(stats30.totalSets > stats7.totalSets);
  assert.equal(formatLocalDate(ref), '2026-11-27');
});

test('buildCalendarMonthData builds Sun-Sat grid, deduplicates bodyParts in canonical order, and computes in-month stats', () => {
  const workouts = [
    // Outside November (Oct 31, 2026 is Saturday, not in Nov grid; Nov 1 is Sunday)
    // Use Dec 1, 2026 (Tuesday) which is in Nov 2026 trailing cells (Nov 30 is Monday -> Dec 1..Dec 5 are trailing)
    { id: '1', date: '2026-11-10', bodyPart: 'arms', exerciseName: 'Curl', weight: 10, reps: 10, sets: 3 },
    { id: '2', date: '2026-11-10', bodyPart: 'chest', exerciseName: 'Bench', weight: 60, reps: 10, sets: 4 },
    { id: '3', date: '2026-11-10', bodyPart: 'chest', exerciseName: 'Fly', weight: 14, reps: 12, sets: 3 },
    { id: '4', date: '2026-11-27', bodyPart: 'legs', exerciseName: 'Squat', weight: 80, reps: 8, sets: 4 },
    { id: '5', date: '2026-12-01', bodyPart: 'back', exerciseName: 'Row', weight: 50, reps: 10, sets: 5 },
  ];

  const cal = buildCalendarMonthData(workouts, 2026, 10, new Date(2026, 10, 27)); // monthIndex 10 = Nov
  assert.equal(cal.monthLabel, '2026年11月');
  assert.equal(cal.cells.length % 7, 0);
  assert.equal(cal.cells[0].dateStr, '2026-11-01');
  assert.equal(cal.cells[cal.cells.length - 1].dateStr, '2026-12-05');

  // In-month stats ignore Dec 1
  assert.equal(cal.trainedDaysCount, 2);
  assert.equal(cal.monthTotalWorkouts, 4);
  assert.equal(cal.monthTotalSets, 14);

  const nov10 = cal.cells.find((c) => c.dateStr === '2026-11-10');
  assert.equal(nov10.inCurrentMonth, true);
  assert.equal(nov10.count, 3);
  assert.equal(nov10.totalSets, 10);
  // Deduplicated and in canonical BODY_PARTS order ('chest' before 'arms')
  assert.deepEqual(nov10.bodyParts.map((b) => b.id), ['chest', 'arms']);

  const nov27 = cal.cells.find((c) => c.dateStr === '2026-11-27');
  assert.equal(nov27.isToday, true);
  assert.equal(nov27.count, 1);

  const dec01 = cal.cells.find((c) => c.dateStr === '2026-12-01');
  assert.equal(dec01.inCurrentMonth, false);
  assert.equal(dec01.count, 1);
});

test('evaluateSwipeNavigation supports relaxed distance, fast flicks, axis-lock, deliberate drags, and tab boundaries', () => {
  const order = ['record', 'growth', 'balance', 'history'];

  // Short slow drags below 42px -> ignored
  assert.equal(
    evaluateSwipeNavigation({ dx: -25, dy: 0, durationMs: 200, currentTab: 'record', tabOrder: order }),
    null
  );
  assert.equal(
    evaluateSwipeNavigation({ dx: -38, dy: 0, durationMs: 300, currentTab: 'growth', tabOrder: order }),
    null
  );

  // Fast short flick (>= 28px and >= 0.28 px/ms) -> switches tab
  assert.equal(
    evaluateSwipeNavigation({ dx: -30, dy: 8, durationMs: 90, currentTab: 'record', tabOrder: order }),
    'growth'
  );

  // Relaxed distance swipe (>= 42px, ratio >= 1.2) -> switches tab
  assert.equal(
    evaluateSwipeNavigation({ dx: -45, dy: 20, durationMs: 220, currentTab: 'record', tabOrder: order }),
    'growth'
  );
  assert.equal(
    evaluateSwipeNavigation({ dx: 45, dy: -15, durationMs: 220, currentTab: 'growth', tabOrder: order }),
    'record'
  );

  // Vertical-heavy diagonal without horizontal lock -> ignored
  assert.equal(
    evaluateSwipeNavigation({ dx: -60, dy: 55, durationMs: 200, currentTab: 'record', tabOrder: order }),
    null
  );

  // Vertical drift after horizontal axis-lock -> allowed
  assert.equal(
    evaluateSwipeNavigation({
      dx: -60,
      dy: 55,
      durationMs: 200,
      currentTab: 'record',
      tabOrder: order,
      lockedHorizontal: true,
    }),
    'growth'
  );

  // Slow deliberate drag past commitDistance -> switches even past maxDurationMs
  assert.equal(
    evaluateSwipeNavigation({
      dx: -120,
      dy: 0,
      durationMs: 1500,
      currentTab: 'record',
      tabOrder: order,
      stageWidth: 366,
    }),
    'growth'
  );

  // Slow short drag exceeding maxDurationMs -> ignored
  assert.equal(
    evaluateSwipeNavigation({
      dx: -50,
      dy: 0,
      durationMs: 1500,
      currentTab: 'record',
      tabOrder: order,
      stageWidth: 366,
    }),
    null
  );

  // Boundary tabs return null
  assert.equal(
    evaluateSwipeNavigation({ dx: 120, dy: 0, durationMs: 200, currentTab: 'record', tabOrder: order }),
    null
  );
  assert.equal(
    evaluateSwipeNavigation({ dx: -120, dy: 0, durationMs: 200, currentTab: 'history', tabOrder: order }),
    null
  );
});

test('computeSwipeDragState computes finger-following offsets, neighbor tab, clamp, and boundary rubber-band', () => {
  const order = ['record', 'growth', 'balance', 'history'];

  // Left drag from record reveals growth at dx + stride (366 + 16 = 382)
  const leftDrag = computeSwipeDragState({
    dx: -100,
    dy: 5,
    currentTab: 'record',
    tabOrder: order,
    stageWidth: 366,
  });
  assert.equal(leftDrag.direction, -1);
  assert.equal(leftDrag.neighborTab, 'growth');
  assert.equal(leftDrag.stride, 382);
  assert.equal(leftDrag.currentOffsetPx, -100);
  assert.equal(leftDrag.neighborOffsetPx, 282);

  // Right drag from growth reveals record at dx - stride
  const rightDrag = computeSwipeDragState({
    dx: 120,
    dy: -8,
    currentTab: 'growth',
    tabOrder: order,
    stageWidth: 366,
  });
  assert.equal(rightDrag.direction, 1);
  assert.equal(rightDrag.neighborTab, 'record');
  assert.equal(rightDrag.currentOffsetPx, 120);
  assert.equal(rightDrag.neighborOffsetPx, -262);

  // Clamps at ±stride
  const clamped = computeSwipeDragState({
    dx: -500,
    dy: 0,
    currentTab: 'record',
    tabOrder: order,
    stageWidth: 366,
  });
  assert.equal(clamped.currentOffsetPx, -382);
  assert.equal(clamped.neighborOffsetPx, 0);

  // Boundary drags apply rubber-band resistance capped at ±48px
  const leftEdge = computeSwipeDragState({
    dx: 100,
    dy: 0,
    currentTab: 'record',
    tabOrder: order,
    stageWidth: 366,
  });
  assert.equal(leftEdge.neighborTab, null);
  assert.equal(leftEdge.neighborOffsetPx, null);
  assert.equal(leftEdge.currentOffsetPx, 25);

  const rightEdgeMax = computeSwipeDragState({
    dx: -300,
    dy: 0,
    currentTab: 'history',
    tabOrder: order,
    stageWidth: 366,
  });
  assert.equal(rightEdgeMax.neighborTab, null);
  assert.equal(rightEdgeMax.currentOffsetPx, -48);
});

test('computeTutorialPopoverPosition places popover below or above spotlight and clamps within viewport', () => {
  // Target near top -> places below spotlight
  const belowPos = computeTutorialPopoverPosition({
    targetRect: { top: 80, left: 40, right: 340, bottom: 220 },
    cardWidth: 320,
    cardHeight: 190,
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.equal(belowPos.top, 226 + 14); // spotlight bottom (220 + 6) + gap (14)
  assert.ok(belowPos.left >= 12 && belowPos.left + 320 <= 1280 - 12);

  // Target near bottom -> places above spotlight
  const abovePos = computeTutorialPopoverPosition({
    targetRect: { top: 580, left: 40, right: 340, bottom: 760 },
    cardWidth: 320,
    cardHeight: 190,
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.equal(abovePos.top, 574 - 14 - 190); // spotlight top (580 - 6) - gap - cardHeight

  // Narrow mobile viewport clamps horizontally inside margins (390 - 360 - 12 = 18)
  const mobilePos = computeTutorialPopoverPosition({
    targetRect: { top: 90, left: 260, right: 380, bottom: 260 },
    cardWidth: 360,
    cardHeight: 200,
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.equal(mobilePos.left, 18);
  assert.ok(mobilePos.top + 200 <= 844 - 12);

  // Left-edge target clamps to left margin 12
  const leftEdgePos = computeTutorialPopoverPosition({
    targetRect: { top: 90, left: 10, right: 80, bottom: 200 },
    cardWidth: 360,
    cardHeight: 200,
    viewportWidth: 390,
    viewportHeight: 844,
  });
  assert.equal(leftEdgePos.left, 12);

  // Sticky header safeTop & mobile nav safeBottom prevent spotlight from enclosing header or bottom nav
  const headerSafePos = computeTutorialPopoverPosition({
    targetRect: { top: 0, left: 40, right: 680, bottom: 720 },
    cardWidth: 360,
    cardHeight: 210,
    viewportWidth: 1280,
    viewportHeight: 800,
    safeTop: 72,
    safeBottom: 12,
  });
  assert.ok(headerSafePos.spotlight.top >= 72);
  assert.ok(headerSafePos.top >= 72);
  assert.ok(headerSafePos.top + 210 <= 800 - 12);

  const mobileSafePos = computeTutorialPopoverPosition({
    targetRect: { top: 65, left: 12, right: 378, bottom: 820 },
    cardWidth: 360,
    cardHeight: 210,
    viewportWidth: 390,
    viewportHeight: 844,
    safeTop: 65,
    safeBottom: 68,
  });
  assert.ok(mobileSafePos.spotlight.top >= 65);
  assert.ok(mobileSafePos.spotlight.top + mobileSafePos.spotlight.height <= 844 - 68);
  assert.ok(mobileSafePos.top + 210 <= 844 - 68);
});

test('computeGrowthChartLayout adapts dimensions and margins for mobile vs desktop', () => {
  const mobileLayout = computeGrowthChartLayout({ containerWidth: 350, viewportWidth: 390 });
  assert.equal(mobileLayout.isCompact, true);
  assert.equal(mobileLayout.W, 350);
  assert.ok(mobileLayout.H >= 256);
  assert.ok(mobileLayout.margin.left <= 42);
  assert.equal(mobileLayout.maxLabels, 4);

  const fallbackMobile = computeGrowthChartLayout({ containerWidth: 0, viewportWidth: 390 });
  assert.equal(fallbackMobile.isCompact, true);
  assert.ok(fallbackMobile.W >= 280);

  const desktopLayout = computeGrowthChartLayout({ containerWidth: 700, viewportWidth: 1280 });
  assert.equal(desktopLayout.isCompact, false);
  assert.equal(desktopLayout.W, 680);
  assert.equal(desktopLayout.H, 310);
  assert.equal(desktopLayout.margin.left, 58);
  assert.equal(desktopLayout.maxLabels, 6);
});
