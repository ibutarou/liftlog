(function (root) {
  'use strict';

  const { Constants, Calculations, Storage, Charts } = root.LiftLog;
  const { BODY_PARTS, BODY_PART_MAP, PERIOD_OPTIONS } = Constants;
  const {
    formatLocalDate,
    calculateOneRM,
    calculateVolume,
    getExerciseHistoryWithPR,
    getPreviousRecord,
    evaluateNewRecordPR,
    getUniqueExercises,
    calculateBodyPartStats,
    generateBalanceAdvice,
    sortWorkoutsNewestFirst,
    normalizeExerciseName,
    buildCalendarMonthData,
    evaluateSwipeNavigation,
    computeSwipeDragState,
  } = Calculations;
  const { escapeHtml, formatNumber } = Charts;

  const now = new Date();
  const state = {
    workouts: Storage.loadWorkouts(),
    theme: Storage.loadTheme(),
    activeTab: 'record',
    selectedBodyPart: 'chest',
    selectedExercise: '',
    growthMetric: 'oneRM',
    balancePeriod: 14,
    balanceChartType: 'radar',
    balanceMetric: 'sets',
    historyPartFilter: 'all',
    historyQuery: '',
    historyCalendarYear: now.getFullYear(),
    historyCalendarMonth: now.getMonth(),
    historySelectedDate: null,
    editingId: null,
  };

  // DOM References
  const els = {
    appMain: document.querySelector('.app-main'),
    swipeStage: document.getElementById('swipeStage'),
    desktopTabs: document.querySelectorAll('.desktop-nav .nav-tab'),
    mobileTabs: document.querySelectorAll('.mobile-bottom-nav .mobile-tab'),
    views: {
      record: document.getElementById('view-record'),
      growth: document.getElementById('view-growth'),
      balance: document.getElementById('view-balance'),
      history: document.getElementById('view-history'),
    },
    sampleDataBadge: document.getElementById('sampleDataBadge'),
    quickSampleBtn: document.getElementById('quickSampleBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    workoutForm: document.getElementById('workoutForm'),
    recordHeading: document.getElementById('record-heading'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    inputDate: document.getElementById('inputDate'),
    bodyPartSelector: document.getElementById('bodyPartSelector'),
    inputExercise: document.getElementById('inputExercise'),
    exerciseSuggestions: document.getElementById('exerciseSuggestions'),
    presetExerciseChips: document.getElementById('presetExerciseChips'),
    previousRecordInline: document.getElementById('previousRecordInline'),
    inputWeight: document.getElementById('inputWeight'),
    inputReps: document.getElementById('inputReps'),
    inputSets: document.getElementById('inputSets'),
    inputMemo: document.getElementById('inputMemo'),
    liveCalcPreview: document.getElementById('liveCalcPreview'),
    formError: document.getElementById('formError'),
    submitWorkoutBtn: document.getElementById('submitWorkoutBtn'),
    selectedDateBadge: document.getElementById('selectedDateBadge'),
    dayWorkoutsList: document.getElementById('dayWorkoutsList'),
    quickSummaryGrid: document.getElementById('quickSummaryGrid'),
    // Growth
    growthExerciseSelect: document.getElementById('growthExerciseSelect'),
    growthExerciseChips: document.getElementById('growthExerciseChips'),
    growthMetricBtns: document.querySelectorAll('[data-growth-metric]'),
    growthKpiGrid: document.getElementById('growthKpiGrid'),
    growthChartContainer: document.getElementById('growthChartContainer'),
    growthHistoryCount: document.getElementById('growthHistoryCount'),
    growthHistoryTable: document.getElementById('growthHistoryTable'),
    // Balance
    periodFilterGroup: document.getElementById('periodFilterGroup'),
    balanceSummaryStrip: document.getElementById('balanceSummaryStrip'),
    balanceAdviceList: document.getElementById('balanceAdviceList'),
    balanceChartBtns: document.querySelectorAll('[data-balance-chart]'),
    balanceMetricBtns: document.querySelectorAll('[data-balance-metric]'),
    balanceChartContainer: document.getElementById('balanceChartContainer'),
    balanceBreakdownTable: document.getElementById('balanceBreakdownTable'),
    // History
    loadSampleBtn: document.getElementById('loadSampleBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    calPrevMonthBtn: document.getElementById('calPrevMonthBtn'),
    calMonthLabel: document.getElementById('calMonthLabel'),
    calNextMonthBtn: document.getElementById('calNextMonthBtn'),
    calTodayBtn: document.getElementById('calTodayBtn'),
    calMonthSummary: document.getElementById('calMonthSummary'),
    historyCalendarGrid: document.getElementById('historyCalendarGrid'),
    calPartLegend: document.getElementById('calPartLegend'),
    historyPartFilter: document.getElementById('historyPartFilter'),
    historySearchInput: document.getElementById('historySearchInput'),
    historyDateBanner: document.getElementById('historyDateBanner'),
    historyList: document.getElementById('historyList'),
    toastContainer: document.getElementById('toastContainer'),
  };

  function applyTheme(theme) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    state.theme = resolved;
    document.documentElement.dataset.theme = resolved;

    if (els.themeToggleBtn) {
      const isDark = resolved === 'dark';
      const iconEl = els.themeToggleBtn.querySelector('.theme-toggle-icon');
      const labelEl = els.themeToggleBtn.querySelector('.theme-toggle-label');
      if (iconEl) iconEl.textContent = isDark ? '☀️' : '🌙';
      if (labelEl) labelEl.textContent = isDark ? 'ライト' : 'ダーク';
      els.themeToggleBtn.setAttribute('aria-pressed', String(isDark));
      els.themeToggleBtn.setAttribute(
        'aria-label',
        isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'
      );
    }
  }

  function showToast(message, isPR) {
    const toast = document.createElement('div');
    toast.className = `toast${isPR ? ' is-pr' : ''}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3600);
  }

  let resetSwipeVisuals = null;

  function renderTabContent(tab) {
    if (tab === 'growth') renderGrowthView();
    if (tab === 'balance') renderBalanceView();
    if (tab === 'history') renderHistoryView();
    if (tab === 'record') renderRecordSide();
  }

  function updateTabNavActive(tab) {
    els.desktopTabs.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === tab);
    });
    els.mobileTabs.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === tab);
    });
  }

  function setActiveTab(tab, options) {
    if (!els.views[tab]) return;
    if (resetSwipeVisuals && !(options && options.fromSwipeCleanup)) {
      resetSwipeVisuals();
    }
    state.activeTab = tab;

    const skipAnimation = Boolean(options && options.skipAnimation);
    Object.entries(els.views).forEach(([key, section]) => {
      const active = key === tab;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
      section.classList.toggle('no-fade', active && skipAnimation);
    });

    updateTabNavActive(tab);
    renderTabContent(tab);
  }

  function updateSampleBadge() {
    els.sampleDataBadge.hidden = !Storage.isUsingSampleData();
  }

  function renderBodyPartPills() {
    els.bodyPartSelector.innerHTML = BODY_PARTS.map((part) => {
      const selected = part.id === state.selectedBodyPart;
      const style = selected ? `style="background:${escapeHtml(part.color)};"` : '';
      return `
        <button
          type="button"
          class="part-pill ${selected ? 'is-selected' : ''}"
          data-body-part="${escapeHtml(part.id)}"
          role="radio"
          aria-checked="${selected}"
          ${style}
        >
          <span class="part-dot" style="background:${escapeHtml(part.color)}"></span>
          <span>${escapeHtml(part.label)}</span>
        </button>
      `;
    }).join('');
  }

  function renderExerciseSuggestions() {
    const uniqueNames = new Set();
    const partObj = BODY_PART_MAP[state.selectedBodyPart];
    if (partObj) {
      partObj.presets.forEach((p) => uniqueNames.add(p));
    }
    state.workouts.forEach((w) => {
      if (w.bodyPart === state.selectedBodyPart && w.exerciseName) {
        uniqueNames.add(w.exerciseName);
      }
    });
    state.workouts.forEach((w) => {
      if (w.exerciseName) uniqueNames.add(w.exerciseName);
    });

    els.exerciseSuggestions.innerHTML = Array.from(uniqueNames)
      .map((name) => `<option value="${escapeHtml(name)}"></option>`)
      .join('');

    const presetSet = new Set(partObj ? partObj.presets : []);
    state.workouts.forEach((w) => {
      if (w.bodyPart === state.selectedBodyPart) {
        presetSet.add(w.exerciseName);
      }
    });

    const currentNormalized = normalizeExerciseName(els.inputExercise.value);
    els.presetExerciseChips.innerHTML = Array.from(presetSet)
      .slice(0, 6)
      .map((name) => {
        const isCurrent = normalizeExerciseName(name) === currentNormalized && currentNormalized !== '';
        return `<button type="button" class="chip-btn ${isCurrent ? 'is-active' : ''}" data-preset-exercise="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
      })
      .join('');
  }

  function renderPreviousRecordBox() {
    const name = els.inputExercise.value.trim();
    if (!name) {
      els.previousRecordInline.className = 'prev-record-box is-empty';
      els.previousRecordInline.innerHTML = `
        <div class="prev-record-meta">種目名を入力・選択すると、同じ種目の前回記録がここに表示されます。</div>
      `;
      return;
    }

    const prev = getPreviousRecord(state.workouts, name, state.editingId);
    if (!prev) {
      els.previousRecordInline.className = 'prev-record-box is-empty';
      els.previousRecordInline.innerHTML = `
        <div class="prev-record-meta">「<strong>${escapeHtml(name)}</strong>」の過去記録はまだありません（初回記録になります）。</div>
      `;
      return;
    }

    const partLabel = BODY_PART_MAP[prev.bodyPart] ? BODY_PART_MAP[prev.bodyPart].label : prev.bodyPart;
    els.previousRecordInline.className = 'prev-record-box';
    els.previousRecordInline.innerHTML = `
      <div class="prev-record-top">
        <span class="prev-record-badge">前回の記録 (${escapeHtml(prev.date)})</span>
        <button type="button" id="copyPrevBtn" class="copy-prev-btn">前回値をコピー</button>
      </div>
      <div class="prev-record-main">
        <span>${escapeHtml(formatNumber(prev.weight))} kg × ${escapeHtml(prev.reps)} 回 × ${escapeHtml(prev.sets)} セット</span>
      </div>
      <div class="prev-record-meta">
        部位: ${escapeHtml(partLabel)} ／ 推定1RM: <strong>${escapeHtml(formatNumber(prev.oneRM))}kg</strong> ／ 総ボリューム: <strong>${escapeHtml(formatNumber(prev.volume))}kg</strong>
        ${prev.memo ? ` ／ メモ: ${escapeHtml(prev.memo)}` : ''}
      </div>
    `;

    const copyBtn = document.getElementById('copyPrevBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        els.inputWeight.value = prev.weight;
        els.inputReps.value = prev.reps;
        els.inputSets.value = prev.sets;
        if (BODY_PART_MAP[prev.bodyPart]) {
          state.selectedBodyPart = prev.bodyPart;
          renderBodyPartPills();
          renderExerciseSuggestions();
        }
        renderLivePreview();
      });
    }
  }

  function renderLivePreview() {
    const weight = Number(els.inputWeight.value);
    const reps = Number(els.inputReps.value);
    const sets = Number(els.inputSets.value);
    const exerciseName = els.inputExercise.value.trim();

    const oneRM = calculateOneRM(weight, reps);
    const volume = calculateVolume(weight, reps, sets);

    let prHtml = '';
    let isPrHighlight = false;
    if (exerciseName && (oneRM > 0 || volume > 0)) {
      const evaluation = evaluateNewRecordPR(state.workouts, {
        id: state.editingId,
        exerciseName,
        weight,
        reps,
        sets,
      });
      if (evaluation.isOneRMPR || evaluation.isVolumePR) {
        isPrHighlight = true;
        const labels = [];
        if (evaluation.isOneRMPR) labels.push(`推定1RM +${formatNumber(evaluation.oneRMDelta)}kg`);
        if (evaluation.isVolumePR) labels.push(`総ボリューム +${formatNumber(evaluation.volumeDelta)}kg`);
        prHtml = `<span class="pr-pill">🏆 自己ベスト更新予定 (${escapeHtml(labels.join(' / '))})</span>`;
      }
    }

    els.liveCalcPreview.className = `live-preview-bar${isPrHighlight ? ' is-pr' : ''}`;
    els.liveCalcPreview.innerHTML = `
      <div class="live-metrics">
        <span>推定1RM: <strong>${oneRM > 0 ? `${escapeHtml(formatNumber(oneRM))} kg` : '—'}</strong></span>
        <span>総ボリューム: <strong>${volume > 0 ? `${escapeHtml(formatNumber(volume))} kg` : '—'}</strong></span>
      </div>
      ${prHtml}
    `;
  }

  function renderRecordSide() {
    const targetDate = els.inputDate.value || formatLocalDate(new Date());
    els.selectedDateBadge.textContent = targetDate;

    const dayEntries = sortWorkoutsNewestFirst(
      state.workouts.filter((w) => w.date === targetDate)
    );

    if (dayEntries.length === 0) {
      els.dayWorkoutsList.innerHTML = '<p class="empty-muted">この日の記録はまだありません。</p>';
    } else {
      els.dayWorkoutsList.innerHTML = dayEntries
        .map((w) => {
          const part = BODY_PART_MAP[w.bodyPart];
          const volume = calculateVolume(w.weight, w.reps, w.sets);
          return `
            <div class="day-workout-item">
              <div>
                <div class="day-workout-title">
                  <span class="part-dot" style="background:${escapeHtml(part ? part.color : '#64748b')}"></span>
                  <span>${escapeHtml(w.exerciseName)}</span>
                </div>
                <div class="day-workout-sub">${escapeHtml(formatNumber(w.weight))}kg × ${escapeHtml(w.reps)}回 × ${escapeHtml(w.sets)}セット（${escapeHtml(formatNumber(volume))}kg）</div>
              </div>
              <button type="button" class="btn-secondary-sm" data-edit-id="${escapeHtml(w.id)}">編集</button>
            </div>
          `;
        })
        .join('');
    }

    const stats7 = calculateBodyPartStats(state.workouts, 7, new Date());
    const trainedPartsCount = stats7.parts.filter((p) => p.sets > 0).length;
    els.quickSummaryGrid.innerHTML = `
      <div class="mini-stat">
        <div class="mini-stat-label">7日間セット数</div>
        <div class="mini-stat-value">${escapeHtml(stats7.totalSets)} set</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">総ボリューム</div>
        <div class="mini-stat-value">${escapeHtml(formatNumber(stats7.totalVolume))} kg</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">実施部位数</div>
        <div class="mini-stat-value">${escapeHtml(trainedPartsCount)} / 6</div>
      </div>
    `;
  }

  function resetFormToCreateMode(preserveDate) {
    state.editingId = null;
    els.recordHeading.textContent = 'ワークアウトを記録';
    els.submitWorkoutBtn.textContent = '記録を保存する';
    els.cancelEditBtn.hidden = true;
    els.formError.hidden = true;
    if (!preserveDate) {
      els.inputDate.value = formatLocalDate(new Date());
    }
    els.inputMemo.value = '';
    renderPreviousRecordBox();
    renderLivePreview();
  }

  function startEditWorkout(id) {
    const target = state.workouts.find((w) => w.id === id);
    if (!target) return;
    state.editingId = target.id;
    state.selectedBodyPart = target.bodyPart;

    els.inputDate.value = target.date;
    els.inputExercise.value = target.exerciseName;
    els.inputWeight.value = target.weight;
    els.inputReps.value = target.reps;
    els.inputSets.value = target.sets;
    els.inputMemo.value = target.memo || '';

    els.recordHeading.textContent = 'ワークアウトを編集';
    els.submitWorkoutBtn.textContent = '変更を保存する';
    els.cancelEditBtn.hidden = false;
    els.formError.hidden = true;

    renderBodyPartPills();
    renderExerciseSuggestions();
    renderPreviousRecordBox();
    renderLivePreview();
    setActiveTab('record');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderGrowthView() {
    const exercises = getUniqueExercises(state.workouts);

    if (exercises.length === 0) {
      els.growthExerciseSelect.innerHTML = '<option value="">記録がありません</option>';
      els.growthExerciseChips.innerHTML = '';
      els.growthKpiGrid.innerHTML = '';
      els.growthHistoryCount.textContent = '0件';
      els.growthHistoryTable.innerHTML = '<p class="empty-muted">まずは「記録」タブでワークアウトを保存してください。</p>';
      Charts.renderGrowthChart(els.growthChartContainer, { history: { entries: [] }, metric: state.growthMetric });
      return;
    }

    const exists = exercises.some(
      (ex) => normalizeExerciseName(ex.name) === normalizeExerciseName(state.selectedExercise)
    );
    if (!exists) {
      state.selectedExercise = exercises[0].name;
    }

    els.growthExerciseSelect.innerHTML = exercises
      .map((ex) => {
        const selected = normalizeExerciseName(ex.name) === normalizeExerciseName(state.selectedExercise);
        const partLabel = BODY_PART_MAP[ex.bodyPart] ? BODY_PART_MAP[ex.bodyPart].label : '';
        return `<option value="${escapeHtml(ex.name)}" ${selected ? 'selected' : ''}>${escapeHtml(ex.name)}（${escapeHtml(partLabel)}・${ex.count}回）</option>`;
      })
      .join('');

    els.growthExerciseChips.innerHTML = exercises
      .slice(0, 5)
      .map((ex) => {
        const active = normalizeExerciseName(ex.name) === normalizeExerciseName(state.selectedExercise);
        return `<button type="button" class="chip-btn ${active ? 'is-active' : ''}" data-growth-chip="${escapeHtml(ex.name)}">${escapeHtml(ex.name)}</button>`;
      })
      .join('');

    els.growthMetricBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.growthMetric === state.growthMetric);
    });

    const history = getExerciseHistoryWithPR(state.workouts, state.selectedExercise);
    const latest = history.latestEntry;
    const latestIsPR = latest && (state.growthMetric === 'oneRM' ? latest.isOneRMPR : latest.isVolumePR);

    els.growthKpiGrid.innerHTML = `
      <div class="kpi-card ${latest && latest.isOneRMPR ? 'is-highlight' : ''}">
        <div class="kpi-label">自己ベスト推定1RM</div>
        <div class="kpi-value">${escapeHtml(formatNumber(history.bestOneRM))} kg</div>
        <div class="kpi-sub">達成日: ${escapeHtml(history.bestOneRMDate || '—')}</div>
      </div>
      <div class="kpi-card ${latest && latest.isVolumePR ? 'is-highlight' : ''}">
        <div class="kpi-label">自己ベスト総ボリューム</div>
        <div class="kpi-value">${escapeHtml(formatNumber(history.bestVolume))} kg</div>
        <div class="kpi-sub">達成日: ${escapeHtml(history.bestVolumeDate || '—')}</div>
      </div>
      <div class="kpi-card ${latestIsPR ? 'is-highlight' : ''}">
        <div class="kpi-label">最新セッション (${escapeHtml(latest ? latest.date : '—')})</div>
        <div class="kpi-value">${latest ? `${escapeHtml(formatNumber(latest.weight))}kg × ${escapeHtml(latest.reps)}回` : '—'}</div>
        <div class="kpi-sub">${latestIsPR ? '★ 最新回で自己ベスト更新！' : `記録数: ${history.totalSessions} 回`}</div>
      </div>
    `;

    Charts.renderGrowthChart(els.growthChartContainer, {
      history,
      metric: state.growthMetric,
    });

    els.growthHistoryCount.textContent = `${history.totalSessions} 件`;
    const newestFirst = [...history.entries].reverse();
    els.growthHistoryTable.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>重量 × 回数 × セット</th>
            <th>推定1RM</th>
            <th>総ボリューム</th>
            <th>メモ</th>
          </tr>
        </thead>
        <tbody>
          ${newestFirst
            .map((entry) => {
              const rmBadge = entry.isOneRMPR ? ' <span class="pr-pill">★ 1RM PR</span>' : '';
              const volBadge = entry.isVolumePR ? ' <span class="pr-pill">★ Vol PR</span>' : '';
              return `
                <tr>
                  <td>${escapeHtml(entry.date)}</td>
                  <td>${escapeHtml(formatNumber(entry.weight))}kg × ${escapeHtml(entry.reps)} × ${escapeHtml(entry.sets)}</td>
                  <td><strong>${escapeHtml(formatNumber(entry.oneRM))}kg</strong>${rmBadge}</td>
                  <td><strong>${escapeHtml(formatNumber(entry.volume))}kg</strong>${volBadge}</td>
                  <td>${escapeHtml(entry.memo || '—')}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `;
  }

  function renderBalanceView() {
    els.periodFilterGroup.innerHTML = PERIOD_OPTIONS.map((opt) => {
      const active = String(opt.value) === String(state.balancePeriod);
      return `<button type="button" class="segment-btn ${active ? 'is-active' : ''}" data-period="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</button>`;
    }).join('');

    els.balanceChartBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.balanceChart === state.balanceChartType);
    });
    els.balanceMetricBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.balanceMetric === state.balanceMetric);
    });

    const stats = calculateBodyPartStats(state.workouts, state.balancePeriod, new Date());
    const trainedParts = stats.parts.filter((p) => p.sets > 0).length;

    els.balanceSummaryStrip.innerHTML = `
      <div class="mini-stat">
        <div class="mini-stat-label">期間内総セット数</div>
        <div class="mini-stat-value">${escapeHtml(stats.totalSets)} セット</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">期間内総ボリューム</div>
        <div class="mini-stat-value">${escapeHtml(formatNumber(stats.totalVolume))} kg</div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">トレーニング部位数</div>
        <div class="mini-stat-value">${escapeHtml(trainedParts)} / 6 部位</div>
      </div>
    `;

    const adviceList = generateBalanceAdvice(stats);
    els.balanceAdviceList.innerHTML = adviceList
      .map(
        (item) => `
          <div class="advice-card is-${escapeHtml(item.level)}">
            <div class="advice-title">${escapeHtml(item.title)}</div>
            <p class="advice-body">${escapeHtml(item.message)}</p>
          </div>
        `
      )
      .join('');

    if (state.balanceChartType === 'radar') {
      Charts.renderRadarChart(els.balanceChartContainer, {
        parts: stats.parts,
        metric: state.balanceMetric,
      });
    } else {
      Charts.renderBarChart(els.balanceChartContainer, {
        parts: stats.parts,
        metric: state.balanceMetric,
      });
    }

    els.balanceBreakdownTable.innerHTML = stats.parts
      .map((p) => {
        const isZero = p.sets === 0;
        return `
          <div class="breakdown-row ${isZero ? 'is-zero' : ''}">
            <div class="breakdown-name">
              <span class="part-dot" style="background:${escapeHtml(p.color)}"></span>
              <span>${escapeHtml(p.label)}</span>
            </div>
            <div class="breakdown-stats">
              <div><strong>${escapeHtml(p.sets)} セット</strong> (${escapeHtml(p.setsShare)}%)</div>
              <div>${escapeHtml(formatNumber(p.volume))} kg (${escapeHtml(p.volumeShare)}%)</div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderHistoryCalendar() {
    const partFilteredWorkouts =
      state.historyPartFilter === 'all'
        ? state.workouts
        : state.workouts.filter((w) => w.bodyPart === state.historyPartFilter);

    const cal = buildCalendarMonthData(
      partFilteredWorkouts,
      state.historyCalendarYear,
      state.historyCalendarMonth,
      new Date()
    );

    els.calMonthLabel.textContent = cal.monthLabel;
    els.calMonthSummary.textContent = `実施 ${cal.trainedDaysCount}日 ・ ${cal.monthTotalSets} set`;

    els.historyCalendarGrid.innerHTML = cal.cells
      .map((cell) => {
        const classes = ['cal-day'];
        if (!cell.inCurrentMonth) classes.push('is-outside');
        if (cell.count > 0) classes.push('has-workout');
        if (cell.isToday) classes.push('is-today');
        const isSelected = state.historySelectedDate === cell.dateStr;
        if (isSelected) classes.push('is-selected');

        const visibleDots = cell.bodyParts.slice(0, 4);
        const extraCount = cell.bodyParts.length - visibleDots.length;
        const dotsHtml = visibleDots
          .map((bp) => `<span class="cal-dot" style="background:${escapeHtml(bp.color)}"></span>`)
          .join('');
        const moreHtml = extraCount > 0 ? `<span class="cal-dot-more">+</span>` : '';

        const partNames = cell.bodyParts.map((bp) => bp.label).join('・');
        const ariaDetail =
          cell.count > 0
            ? `${cell.dateStr} ワークアウト${cell.count}件 (${partNames})`
            : `${cell.dateStr} 記録なし`;

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-cal-date="${escapeHtml(cell.dateStr)}"
            aria-pressed="${isSelected}"
            aria-label="${escapeHtml(ariaDetail)}"
            title="${escapeHtml(ariaDetail)}"
          >
            <span class="cal-day-num">${escapeHtml(cell.day)}</span>
            <span class="cal-dots" aria-hidden="true">${dotsHtml}${moreHtml}</span>
          </button>
        `;
      })
      .join('');

    els.calPartLegend.innerHTML = BODY_PARTS.map(
      (bp) => `
        <span class="cal-legend-item">
          <span class="part-dot" style="background:${escapeHtml(bp.color)}"></span>
          <span>${escapeHtml(bp.label)}</span>
        </span>
      `
    ).join('');
  }

  function renderHistoryView() {
    renderHistoryCalendar();

    const filterItems = [{ id: 'all', label: 'すべて' }, ...BODY_PARTS];
    els.historyPartFilter.innerHTML = filterItems
      .map((item) => {
        const active = item.id === state.historyPartFilter;
        return `<button type="button" class="chip-btn ${active ? 'is-active' : ''}" data-history-part="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`;
      })
      .join('');

    if (state.historySelectedDate) {
      els.historyDateBanner.hidden = false;
      els.historyDateBanner.innerHTML = `
        <span>📅 ${escapeHtml(state.historySelectedDate)} の記録を表示中</span>
        <button type="button" id="clearSelectedDateBtn" class="btn-secondary-sm">日付指定を解除</button>
      `;
    } else {
      els.historyDateBanner.hidden = true;
      els.historyDateBanner.innerHTML = '';
    }

    // Build PR lookup by workout ID across all exercises
    const prIds = new Set();
    const uniqueEx = getUniqueExercises(state.workouts);
    uniqueEx.forEach((ex) => {
      const h = getExerciseHistoryWithPR(state.workouts, ex.name);
      h.entries.forEach((entry) => {
        if (entry.isOneRMPR || entry.isVolumePR) {
          prIds.add(entry.id);
        }
      });
    });

    const query = normalizeExerciseName(state.historyQuery);
    const filtered = sortWorkoutsNewestFirst(state.workouts).filter((w) => {
      if (state.historySelectedDate && w.date !== state.historySelectedDate) {
        return false;
      }
      if (state.historyPartFilter !== 'all' && w.bodyPart !== state.historyPartFilter) {
        return false;
      }
      if (query) {
        const hay = `${w.exerciseName} ${w.memo || ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      if (state.historySelectedDate) {
        els.historyList.innerHTML = `
          <div class="cal-empty-callout">
            <p>${escapeHtml(state.historySelectedDate)} に一致するトレーニング記録はありません。</p>
            <button type="button" class="btn-secondary-sm" data-add-for-date="${escapeHtml(state.historySelectedDate)}">
              この日 (${escapeHtml(state.historySelectedDate)}) に記録を追加
            </button>
          </div>
        `;
      } else {
        els.historyList.innerHTML = '<p class="empty-muted">条件に一致する履歴がありません。</p>';
      }
      return;
    }

    els.historyList.innerHTML = filtered
      .map((w) => {
        const part = BODY_PART_MAP[w.bodyPart] || { label: w.bodyPart, color: '#64748b' };
        const oneRM = calculateOneRM(w.weight, w.reps);
        const volume = calculateVolume(w.weight, w.reps, w.sets);
        const prTag = prIds.has(w.id) ? '<span class="pr-pill">★ 自己ベスト</span>' : '';
        return `
          <div class="history-item-card">
            <div class="history-item-main">
              <div class="history-item-top">
                <span class="part-tag" style="background:${escapeHtml(part.color)}">${escapeHtml(part.label)}</span>
                <span class="history-date">${escapeHtml(w.date)}</span>
                <span class="history-exercise">${escapeHtml(w.exerciseName)}</span>
                ${prTag}
              </div>
              <div class="history-metrics">
                ${escapeHtml(formatNumber(w.weight))}kg × ${escapeHtml(w.reps)}回 × ${escapeHtml(w.sets)}セット
                ／ 推定1RM <strong>${escapeHtml(formatNumber(oneRM))}kg</strong>
                ／ 総ボリューム <strong>${escapeHtml(formatNumber(volume))}kg</strong>
              </div>
              ${w.memo ? `<p class="history-memo">${escapeHtml(w.memo)}</p>` : ''}
            </div>
            <div class="history-item-actions">
              <button type="button" class="btn-secondary-sm" data-edit-id="${escapeHtml(w.id)}">編集</button>
              <button type="button" class="btn-danger-sm" data-delete-id="${escapeHtml(w.id)}">削除</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function refreshAllViews() {
    updateSampleBadge();
    renderExerciseSuggestions();
    renderPreviousRecordBox();
    renderLivePreview();
    renderRecordSide();
    if (state.activeTab === 'growth') renderGrowthView();
    if (state.activeTab === 'balance') renderBalanceView();
    if (state.activeTab === 'history') renderHistoryView();
  }

  function handleFormSubmit(ev) {
    ev.preventDefault();
    els.formError.hidden = true;

    const date = els.inputDate.value;
    const exerciseName = els.inputExercise.value.trim();
    const weight = Number(els.inputWeight.value);
    const reps = Number(els.inputReps.value);
    const sets = Number(els.inputSets.value);
    const memo = els.inputMemo.value.trim();

    if (!date) {
      els.formError.textContent = '日付を入力してください。';
      els.formError.hidden = false;
      return;
    }
    if (!exerciseName) {
      els.formError.textContent = '種目名を入力または選択してください。';
      els.formError.hidden = false;
      els.inputExercise.focus();
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      els.formError.textContent = '重量は0より大きい数値を入力してください。';
      els.formError.hidden = false;
      els.inputWeight.focus();
      return;
    }
    if (!Number.isFinite(reps) || reps < 1) {
      els.formError.textContent = '回数は1以上の整数を入力してください。';
      els.formError.hidden = false;
      els.inputReps.focus();
      return;
    }
    if (!Number.isFinite(sets) || sets < 1) {
      els.formError.textContent = 'セット数は1以上の整数を入力してください。';
      els.formError.hidden = false;
      els.inputSets.focus();
      return;
    }

    const payload = {
      date,
      bodyPart: state.selectedBodyPart,
      exerciseName,
      weight,
      reps: Math.round(reps),
      sets: Math.round(sets),
      memo,
    };

    const prCheck = evaluateNewRecordPR(state.workouts, {
      ...payload,
      id: state.editingId,
    });

    if (state.editingId) {
      const result = Storage.updateWorkout(state.workouts, state.editingId, payload);
      state.workouts = result.workouts;
      state.selectedExercise = exerciseName;
      resetFormToCreateMode(true);
      showToast(`${exerciseName} の記録を更新しました`, false);
    } else {
      const result = Storage.addWorkout(state.workouts, payload);
      state.workouts = result.workouts;
      state.selectedExercise = exerciseName;
      els.inputMemo.value = '';

      if (prCheck.isOneRMPR || prCheck.isVolumePR) {
        const parts = [];
        if (prCheck.isOneRMPR) parts.push(`推定1RM ${formatNumber(prCheck.oneRM)}kg (+${formatNumber(prCheck.oneRMDelta)}kg)`);
        if (prCheck.isVolumePR) parts.push(`総ボリューム ${formatNumber(prCheck.volume)}kg`);
        showToast(`🎉 自己ベスト更新！ ${exerciseName}：${parts.join(' / ')}`, true);
      } else {
        showToast(`保存しました：${exerciseName} (${formatNumber(weight)}kg × ${Math.round(reps)}回 × ${Math.round(sets)}セット)`, false);
      }
    }

    refreshAllViews();
  }

  function handleLoadSampleData() {
    if (state.workouts.length > 0 && !Storage.isUsingSampleData()) {
      const ok = window.confirm('現在の記録をサンプルデータ（約1ヶ月分の筋トレ履歴）で置き換えますか？');
      if (!ok) return;
    }
    const today = new Date();
    state.workouts = Storage.seedSampleData();
    state.selectedExercise = 'ベンチプレス';
    state.historySelectedDate = null;
    state.historyCalendarYear = today.getFullYear();
    state.historyCalendarMonth = today.getMonth();
    resetFormToCreateMode(false);
    refreshAllViews();
    showToast('サンプルデータを投入しました', false);
  }

  function bindEvents() {
    // Navigation tabs
    [...els.desktopTabs, ...els.mobileTabs].forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });

    // Body part selector
    els.bodyPartSelector.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-body-part]');
      if (!btn) return;
      state.selectedBodyPart = btn.dataset.bodyPart;
      renderBodyPartPills();
      renderExerciseSuggestions();
    });

    // Preset exercise chip click
    els.presetExerciseChips.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-preset-exercise]');
      if (!btn) return;
      const name = btn.dataset.presetExercise;
      els.inputExercise.value = name;
      const prev = getPreviousRecord(state.workouts, name, state.editingId);
      if (prev && (!els.inputWeight.value || !els.inputReps.value)) {
        els.inputWeight.value = prev.weight;
        els.inputReps.value = prev.reps;
        els.inputSets.value = prev.sets;
      }
      renderExerciseSuggestions();
      renderPreviousRecordBox();
      renderLivePreview();
    });

    // Exercise / numeric inputs live update
    els.inputExercise.addEventListener('input', () => {
      renderExerciseSuggestions();
      renderPreviousRecordBox();
      renderLivePreview();
    });

    els.inputDate.addEventListener('change', () => {
      renderRecordSide();
    });

    [els.inputWeight, els.inputReps, els.inputSets].forEach((input) => {
      input.addEventListener('input', renderLivePreview);
    });

    // Stepper buttons
    document.querySelectorAll('.stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        const delta = Number(btn.dataset.delta);
        const current = Number(target.value) || 0;
        const min = Number(target.min) || 0.5;
        const nextVal = Math.max(min, Math.round((current + delta) * 10) / 10);
        target.value = nextVal;
        renderLivePreview();
      });
    });

    els.workoutForm.addEventListener('submit', handleFormSubmit);
    els.cancelEditBtn.addEventListener('click', () => resetFormToCreateMode(false));

    // Side list edit button
    els.dayWorkoutsList.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-edit-id]');
      if (btn) startEditWorkout(btn.dataset.editId);
    });

    // Growth controls
    els.growthExerciseSelect.addEventListener('change', () => {
      state.selectedExercise = els.growthExerciseSelect.value;
      renderGrowthView();
    });

    els.growthExerciseChips.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-growth-chip]');
      if (!btn) return;
      state.selectedExercise = btn.dataset.growthChip;
      renderGrowthView();
    });

    els.growthMetricBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.growthMetric = btn.dataset.growthMetric;
        renderGrowthView();
      });
    });

    // Balance controls
    els.periodFilterGroup.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-period]');
      if (!btn) return;
      const val = btn.dataset.period;
      state.balancePeriod = val === 'all' ? 'all' : Number(val);
      renderBalanceView();
    });

    els.balanceChartBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.balanceChartType = btn.dataset.balanceChart;
        renderBalanceView();
      });
    });

    els.balanceMetricBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.balanceMetric = btn.dataset.balanceMetric;
        renderBalanceView();
      });
    });

    // History calendar controls
    els.calPrevMonthBtn.addEventListener('click', () => {
      if (state.historyCalendarMonth === 0) {
        state.historyCalendarYear -= 1;
        state.historyCalendarMonth = 11;
      } else {
        state.historyCalendarMonth -= 1;
      }
      renderHistoryView();
    });

    els.calNextMonthBtn.addEventListener('click', () => {
      if (state.historyCalendarMonth === 11) {
        state.historyCalendarYear += 1;
        state.historyCalendarMonth = 0;
      } else {
        state.historyCalendarMonth += 1;
      }
      renderHistoryView();
    });

    els.calTodayBtn.addEventListener('click', () => {
      const today = new Date();
      state.historyCalendarYear = today.getFullYear();
      state.historyCalendarMonth = today.getMonth();
      renderHistoryView();
    });

    els.historyCalendarGrid.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-cal-date]');
      if (!btn) return;
      const dateStr = btn.dataset.calDate;
      if (state.historySelectedDate === dateStr) {
        state.historySelectedDate = null;
      } else {
        state.historySelectedDate = dateStr;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          state.historyCalendarYear = Number(parts[0]);
          state.historyCalendarMonth = Number(parts[1]) - 1;
        }
      }
      renderHistoryView();
    });

    els.historyDateBanner.addEventListener('click', (ev) => {
      const clearBtn = ev.target.closest('#clearSelectedDateBtn');
      if (!clearBtn) return;
      state.historySelectedDate = null;
      renderHistoryView();
    });

    // History controls
    els.historyPartFilter.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-history-part]');
      if (!btn) return;
      state.historyPartFilter = btn.dataset.historyPart;
      renderHistoryView();
    });

    els.historySearchInput.addEventListener('input', () => {
      state.historyQuery = els.historySearchInput.value;
      renderHistoryView();
    });

    els.historyList.addEventListener('click', (ev) => {
      const addDateBtn = ev.target.closest('[data-add-for-date]');
      if (addDateBtn) {
        const targetDate = addDateBtn.dataset.addForDate;
        els.inputDate.value = targetDate;
        resetFormToCreateMode(true);
        renderRecordSide();
        setActiveTab('record');
        els.inputExercise.focus();
        return;
      }
      const editBtn = ev.target.closest('[data-edit-id]');
      if (editBtn) {
        startEditWorkout(editBtn.dataset.editId);
        return;
      }
      const delBtn = ev.target.closest('[data-delete-id]');
      if (delBtn) {
        const id = delBtn.dataset.deleteId;
        const ok = window.confirm('このトレーニング記録を削除しますか？');
        if (!ok) return;
        state.workouts = Storage.deleteWorkout(state.workouts, id);
        if (state.editingId === id) {
          resetFormToCreateMode(false);
        }
        refreshAllViews();
        showToast('記録を削除しました', false);
      }
    });

    // Data management & theme toggle
    els.quickSampleBtn.addEventListener('click', handleLoadSampleData);
    els.loadSampleBtn.addEventListener('click', handleLoadSampleData);
    if (els.themeToggleBtn) {
      els.themeToggleBtn.addEventListener('click', () => {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        Storage.saveTheme(next);
        applyTheme(next);
      });
    }

    els.exportJsonBtn.addEventListener('click', () => {
      const json = Storage.exportWorkoutsJson(state.workouts);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liftlog_${formatLocalDate(new Date())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('JSONファイルを書き出しました', false);
    });

    els.clearAllBtn.addEventListener('click', () => {
      if (state.workouts.length === 0) return;
      const ok = window.confirm('保存されている全ての記録を削除しますか？（元に戻せません）');
      if (!ok) return;
      const today = new Date();
      state.workouts = Storage.clearWorkouts();
      state.selectedExercise = '';
      state.historySelectedDate = null;
      state.historyCalendarYear = today.getFullYear();
      state.historyCalendarMonth = today.getMonth();
      resetFormToCreateMode(false);
      refreshAllViews();
      showToast('全データを削除しました', false);
    });
  }

  function bindSwipeNavigation() {
    if (!els.appMain || !els.swipeStage) return;
    const isTouchDevice =
      'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    if (!isTouchDevice) return;

    const TAB_ORDER = ['record', 'growth', 'balance', 'history'];
    let activeSwipe = null;
    let pendingFinalize = null;

    function isExcludedSwipeTarget(target) {
      if (!target || typeof target.closest !== 'function') return false;
      if (target.closest('input, textarea, select')) return true;

      let node = target;
      while (node && node !== els.appMain) {
        if (node.scrollWidth > node.clientWidth + 2) {
          const style = window.getComputedStyle(node);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
            return true;
          }
        }
        node = node.parentElement;
      }
      return false;
    }

    function cleanupSwipeVisuals() {
      if (pendingFinalize) {
        pendingFinalize.cancelOnly();
        pendingFinalize = null;
      }
      Object.entries(els.views).forEach(([key, section]) => {
        section.classList.remove('is-swipe-dragging', 'is-swipe-animating', 'is-swipe-neighbor');
        section.style.transform = '';
        section.hidden = key !== state.activeTab;
      });
    }

    resetSwipeVisuals = cleanupSwipeVisuals;

    function clearSectionSwipe(el, shouldHide) {
      if (!el) return;
      el.classList.remove('is-swipe-dragging', 'is-swipe-animating', 'is-swipe-neighbor');
      el.style.transform = '';
      if (shouldHide) {
        el.hidden = true;
      }
    }

    function animateSwipeFinish(currentEl, neighborEl, targets, onDone) {
      currentEl.classList.remove('is-swipe-dragging');
      currentEl.classList.add('is-swipe-animating');
      if (neighborEl) {
        neighborEl.classList.remove('is-swipe-dragging');
        neighborEl.classList.add('is-swipe-animating');
      }

      // Force layout reflow so browser commits the start transform before animating
      void currentEl.offsetWidth;

      currentEl.style.transform = `translate3d(${targets.currentEndPx}px, 0, 0)`;
      if (neighborEl && targets.neighborEndPx !== null) {
        neighborEl.style.transform = `translate3d(${targets.neighborEndPx}px, 0, 0)`;
      }

      let finished = false;
      const timerId = setTimeout(finish, 280);

      function cleanupListeners() {
        clearTimeout(timerId);
        currentEl.removeEventListener('transitionend', handleTransitionEnd);
      }

      function finish() {
        if (finished) return;
        finished = true;
        cleanupListeners();
        pendingFinalize = null;
        onDone();
      }

      function handleTransitionEnd(ev) {
        if (ev.target === currentEl && ev.propertyName === 'transform') {
          finish();
        }
      }

      currentEl.addEventListener('transitionend', handleTransitionEnd);
      pendingFinalize = {
        flush: finish,
        cancelOnly: cleanupListeners,
      };
    }

    function finishOrCancelHorizontalSwipe(ev) {
      const swipe = activeSwipe;
      activeSwipe = null;
      if (!swipe || swipe.mode !== 'horizontal') return;

      const currentEl = els.views[state.activeTab];
      const neighborEl = swipe.neighborTab ? els.views[swipe.neighborTab] : null;
      const touch = ev.changedTouches && ev.changedTouches[0];
      const dx = touch ? touch.clientX - swipe.startX : swipe.lastDx;
      const dy = touch ? touch.clientY - swipe.startY : swipe.lastDy;
      const durationMs = Date.now() - swipe.time;

      const nextTab =
        ev.type === 'touchend'
          ? evaluateSwipeNavigation({
              dx,
              dy,
              durationMs,
              currentTab: state.activeTab,
              tabOrder: TAB_ORDER,
              minDistancePx: 70,
              horizontalRatio: 2,
              maxDurationMs: 1000,
            })
          : null;

      if (nextTab && nextTab === swipe.neighborTab && neighborEl) {
        const currentEndPx = swipe.direction < 0 ? -swipe.stride : swipe.stride;
        updateTabNavActive(nextTab);
        animateSwipeFinish(
          currentEl,
          neighborEl,
          { currentEndPx, neighborEndPx: 0 },
          () => {
            clearSectionSwipe(currentEl, true);
            clearSectionSwipe(neighborEl, false);
            setActiveTab(nextTab, { skipAnimation: true, fromSwipeCleanup: true });
            if (window.scrollY > 0) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
        );
      } else {
        const neighborBackPx = swipe.direction < 0 ? swipe.stride : -swipe.stride;
        animateSwipeFinish(
          currentEl,
          neighborEl,
          {
            currentEndPx: 0,
            neighborEndPx: neighborEl ? neighborBackPx : null,
          },
          () => {
            clearSectionSwipe(currentEl, false);
            clearSectionSwipe(neighborEl, true);
          }
        );
      }
    }

    els.appMain.addEventListener(
      'touchstart',
      (ev) => {
        if (pendingFinalize) {
          pendingFinalize.flush();
        }
        if (ev.touches.length !== 1 || isExcludedSwipeTarget(ev.target)) {
          activeSwipe = null;
          return;
        }
        const touch = ev.touches[0];
        activeSwipe = {
          startX: touch.clientX,
          startY: touch.clientY,
          time: Date.now(),
          mode: 'pending',
          direction: 0,
          neighborTab: null,
          lastDx: 0,
          lastDy: 0,
          stride: (els.swipeStage.clientWidth || window.innerWidth) + 16,
        };
      },
      { passive: true }
    );

    els.appMain.addEventListener(
      'touchmove',
      (ev) => {
        if (!activeSwipe) return;
        if (ev.touches.length !== 1) {
          finishOrCancelHorizontalSwipe(ev);
          return;
        }

        const touch = ev.touches[0];
        const dx = touch.clientX - activeSwipe.startX;
        const dy = touch.clientY - activeSwipe.startY;
        activeSwipe.lastDx = dx;
        activeSwipe.lastDy = dy;

        if (activeSwipe.mode === 'vertical') return;

        if (activeSwipe.mode === 'pending') {
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);
          if (Math.max(absX, absY) < 12) return;
          if (absX >= absY * 1.6) {
            activeSwipe.mode = 'horizontal';
          } else {
            activeSwipe.mode = 'vertical';
            return;
          }
        }

        if (ev.cancelable) {
          ev.preventDefault();
        }

        const drag = computeSwipeDragState({
          dx,
          dy,
          currentTab: state.activeTab,
          tabOrder: TAB_ORDER,
          stageWidth: els.swipeStage.clientWidth || window.innerWidth,
        });

        activeSwipe.direction = drag.direction;
        activeSwipe.stride = drag.stride;

        if (drag.neighborTab !== activeSwipe.neighborTab) {
          if (activeSwipe.neighborTab) {
            clearSectionSwipe(els.views[activeSwipe.neighborTab], true);
          }
          activeSwipe.neighborTab = drag.neighborTab;
          if (drag.neighborTab) {
            renderTabContent(drag.neighborTab);
            const nextEl = els.views[drag.neighborTab];
            nextEl.hidden = false;
            nextEl.classList.add('is-swipe-neighbor', 'is-swipe-dragging');
            nextEl.classList.remove('no-fade');
          }
        }

        const currentEl = els.views[state.activeTab];
        currentEl.classList.add('is-swipe-dragging');
        currentEl.classList.remove('no-fade');
        currentEl.style.transform = `translate3d(${drag.currentOffsetPx}px, 0, 0)`;

        if (drag.neighborTab && drag.neighborOffsetPx !== null) {
          const neighborEl = els.views[drag.neighborTab];
          neighborEl.style.transform = `translate3d(${drag.neighborOffsetPx}px, 0, 0)`;
        }
      },
      { passive: false }
    );

    els.appMain.addEventListener('touchcancel', finishOrCancelHorizontalSwipe, { passive: true });
    els.appMain.addEventListener('touchend', finishOrCancelHorizontalSwipe, { passive: true });
  }

  function init() {
    applyTheme(state.theme);
    els.inputDate.value = formatLocalDate(new Date());
    els.inputWeight.value = '60';
    els.inputReps.value = '10';
    els.inputSets.value = '3';
    renderBodyPartPills();
    bindEvents();
    bindSwipeNavigation();
    refreshAllViews();
  }

  init();
})(typeof globalThis !== 'undefined' ? globalThis : window);
