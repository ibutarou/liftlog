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
    computeTutorialPopoverPosition,
  } = Calculations;
  const { escapeHtml, formatNumber } = Charts;

  const now = new Date();
  const state = {
    workouts: Storage.loadWorkouts(),
    exercisePresets: Storage.loadPresets(),
    isPresetModalOpen: false,
    presetModalBodyPart: 'chest',
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
    appHeader: document.querySelector('.app-header'),
    appMain: document.querySelector('.app-main'),
    mobileBottomNav: document.querySelector('.mobile-bottom-nav'),
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
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    workoutForm: document.getElementById('workoutForm'),
    recordHeading: document.getElementById('record-heading'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    inputDate: document.getElementById('inputDate'),
    bodyPartSelector: document.getElementById('bodyPartSelector'),
    inputExercise: document.getElementById('inputExercise'),
    exerciseSuggestions: document.getElementById('exerciseSuggestions'),
    presetChipsLabel: document.getElementById('presetChipsLabel'),
    togglePresetEditBtn: document.getElementById('togglePresetEditBtn'),
    presetExerciseChips: document.getElementById('presetExerciseChips'),
    presetEditorModal: document.getElementById('presetEditorModal'),
    closePresetModalBtn: document.getElementById('closePresetModalBtn'),
    presetModalPartTabs: document.getElementById('presetModalPartTabs'),
    presetModalPartLabel: document.getElementById('presetModalPartLabel'),
    presetModalCount: document.getElementById('presetModalCount'),
    presetModalChips: document.getElementById('presetModalChips'),
    newPresetInput: document.getElementById('newPresetInput'),
    addPresetBtn: document.getElementById('addPresetBtn'),
    presetFromHistoryRow: document.getElementById('presetFromHistoryRow'),
    resetPresetsBtn: document.getElementById('resetPresetsBtn'),
    donePresetEditBtn: document.getElementById('donePresetEditBtn'),
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
    // Tutorial
    tutorialOverlay: document.getElementById('tutorialOverlay'),
    tutorialSpotlight: document.getElementById('tutorialSpotlight'),
    tutorialCard: document.getElementById('tutorialCard'),
    tutorialStepBadge: document.getElementById('tutorialStepBadge'),
    tutorialDots: document.getElementById('tutorialDots'),
    tutorialSkipBtn: document.getElementById('tutorialSkipBtn'),
    tutorialTitle: document.getElementById('tutorialTitle'),
    tutorialBody: document.getElementById('tutorialBody'),
    tutorialNote: document.getElementById('tutorialNote'),
    tutorialPrevBtn: document.getElementById('tutorialPrevBtn'),
    tutorialNextBtn: document.getElementById('tutorialNextBtn'),
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
      return `
        <button
          type="button"
          class="part-pill ${selected ? 'is-selected' : ''}"
          data-body-part="${escapeHtml(part.id)}"
          role="radio"
          aria-checked="${selected}"
          style="--part-color:${escapeHtml(part.color)};"
        >
          <span class="part-dot" style="background:${escapeHtml(part.color)}"></span>
          <span>${escapeHtml(part.label)}</span>
        </button>
      `;
    }).join('');
  }

  function renderExerciseSuggestions() {
    const partObj = BODY_PART_MAP[state.selectedBodyPart];
    const currentPresets = Array.isArray(state.exercisePresets[state.selectedBodyPart])
      ? state.exercisePresets[state.selectedBodyPart]
      : partObj
      ? [...partObj.presets]
      : [];

    const uniqueNames = new Set(currentPresets);
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

    const partLabel = partObj ? partObj.label : '';
    if (els.presetChipsLabel) {
      els.presetChipsLabel.textContent = `よく使う種目（${partLabel}）`;
    }
    if (els.togglePresetEditBtn) {
      els.togglePresetEditBtn.setAttribute('aria-expanded', String(state.isPresetModalOpen));
    }

    if (currentPresets.length === 0) {
      els.presetExerciseChips.innerHTML =
        '<span class="preset-empty-hint">よく使う種目は未設定です（「編集」から追加できます）。</span>';
      return;
    }

    const currentNormalized = normalizeExerciseName(els.inputExercise.value);
    els.presetExerciseChips.innerHTML = currentPresets
      .map((name) => {
        const isCurrent = normalizeExerciseName(name) === currentNormalized && currentNormalized !== '';
        return `<button type="button" class="chip-btn ${isCurrent ? 'is-active' : ''}" data-preset-exercise="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
      })
      .join('');
  }

  function renderPresetEditorModal() {
    if (!els.presetEditorModal) return;

    const targetPartId = BODY_PART_MAP[state.presetModalBodyPart] ? state.presetModalBodyPart : 'chest';
    state.presetModalBodyPart = targetPartId;
    const partObj = BODY_PART_MAP[targetPartId];
    const currentPresets = Array.isArray(state.exercisePresets[targetPartId])
      ? state.exercisePresets[targetPartId]
      : partObj
      ? [...partObj.presets]
      : [];

    if (els.presetModalPartTabs) {
      els.presetModalPartTabs.innerHTML = BODY_PARTS.map((part) => {
        const selected = part.id === targetPartId;
        return `
          <button
            type="button"
            class="part-pill ${selected ? 'is-selected' : ''}"
            data-modal-part="${escapeHtml(part.id)}"
            role="tab"
            aria-selected="${selected}"
            style="--part-color:${escapeHtml(part.color)};"
          >
            <span class="part-dot" style="background:${escapeHtml(part.color)}"></span>
            <span>${escapeHtml(part.label)}</span>
          </button>
        `;
      }).join('');
    }

    if (els.presetModalPartLabel) {
      els.presetModalPartLabel.textContent = `表示中の種目（${partObj ? partObj.label : ''}）`;
    }
    if (els.presetModalCount) {
      els.presetModalCount.textContent = `${currentPresets.length} 件`;
    }

    if (els.presetModalChips) {
      if (currentPresets.length === 0) {
        els.presetModalChips.innerHTML =
          '<span class="preset-empty-hint">表示中の種目はありません。下の欄から追加してください。</span>';
      } else {
        els.presetModalChips.innerHTML = currentPresets
          .map(
            (name) => `
              <button
                type="button"
                class="chip-btn is-editable"
                data-remove-preset="${escapeHtml(name)}"
                aria-label="${escapeHtml(name)}をショートカットから削除"
              >
                <span>${escapeHtml(name)}</span>
                <span class="chip-remove-icon" aria-hidden="true">×</span>
              </button>
            `
          )
          .join('');
      }
    }

    if (els.presetFromHistoryRow) {
      const presetKeys = new Set(currentPresets.map((n) => normalizeExerciseName(n)));
      const recordedForPart = [];
      const seenRecorded = new Set();
      for (const w of state.workouts) {
        if (w.bodyPart !== targetPartId || !w.exerciseName) continue;
        const key = normalizeExerciseName(w.exerciseName);
        if (!presetKeys.has(key) && !seenRecorded.has(key)) {
          seenRecorded.add(key);
          recordedForPart.push(w.exerciseName.trim());
        }
      }
      const candidates = recordedForPart.slice(0, 6);
      if (candidates.length > 0) {
        els.presetFromHistoryRow.hidden = false;
        els.presetFromHistoryRow.innerHTML = `
          <span class="preset-from-history-label">履歴から追加：</span>
          <div class="preset-from-history-chips">
            ${candidates
              .map(
                (name) =>
                  `<button type="button" class="chip-btn is-suggestion" data-add-history-preset="${escapeHtml(name)}">＋ ${escapeHtml(name)}</button>`
              )
              .join('')}
          </div>
        `;
      } else {
        els.presetFromHistoryRow.hidden = true;
        els.presetFromHistoryRow.innerHTML = '';
      }
    }
  }

  function renderPreviousRecordBox() {
    const name = els.inputExercise.value.trim();
    const clockSvg =
      '<svg class="prev-record-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M8 4.75V8l2.25 1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    if (!name) {
      els.previousRecordInline.className = 'prev-record-box is-compact';
      els.previousRecordInline.innerHTML = `
        ${clockSvg}
        <span>前回記録：種目を選択するとここに表示されます</span>
      `;
      return;
    }

    const prev = getPreviousRecord(state.workouts, name, state.editingId);
    if (!prev) {
      els.previousRecordInline.className = 'prev-record-box is-compact is-first';
      els.previousRecordInline.innerHTML = `
        ${clockSvg}
        <span>「<strong>${escapeHtml(name)}</strong>」の過去記録はまだありません（初回記録）</span>
      `;
      return;
    }

    const partLabel = BODY_PART_MAP[prev.bodyPart] ? BODY_PART_MAP[prev.bodyPart].label : prev.bodyPart;
    els.previousRecordInline.className = 'prev-record-box is-expanded';
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
      els.dayWorkoutsList.innerHTML = `
        <div class="day-empty-state">
          <div class="day-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>
            </svg>
          </div>
          <p class="day-empty-title">この日の記録はまだありません</p>
          <p class="day-empty-sub">左のフォームからトレーニングを記録しましょう</p>
        </div>
      `;
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
        <div class="mini-stat-value"><span class="mini-stat-num">${escapeHtml(stats7.totalSets)}</span><span class="mini-stat-unit">set</span></div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">総ボリューム</div>
        <div class="mini-stat-value"><span class="mini-stat-num">${escapeHtml(formatNumber(stats7.totalVolume))}</span><span class="mini-stat-unit">kg</span></div>
      </div>
      <div class="mini-stat">
        <div class="mini-stat-label">実施部位数</div>
        <div class="mini-stat-value"><span class="mini-stat-num">${escapeHtml(trainedPartsCount)}</span><span class="mini-stat-unit">/ 6</span></div>
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
      els.formError.hidden = true;
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

    function setBackgroundInert(locked) {
      [els.appHeader, els.appMain, els.mobileBottomNav].forEach((node) => {
        if (!node) return;
        node.inert = locked;
        if (locked) {
          node.setAttribute('aria-hidden', 'true');
        } else {
          node.removeAttribute('aria-hidden');
        }
      });
    }

    function handleModalEscape(ev) {
      if (ev.key === 'Escape' && state.isPresetModalOpen) {
        ev.preventDefault();
        closePresetModal();
      }
    }

    function openPresetModal() {
      if (!els.presetEditorModal || state.isPresetModalOpen) return;
      state.isPresetModalOpen = true;
      state.presetModalBodyPart = state.selectedBodyPart;
      renderPresetEditorModal();
      els.presetEditorModal.hidden = false;
      document.body.classList.add('is-modal-open');
      setBackgroundInert(true);
      if (els.togglePresetEditBtn) {
        els.togglePresetEditBtn.setAttribute('aria-expanded', 'true');
      }
      window.addEventListener('keydown', handleModalEscape);
      if (els.newPresetInput) {
        els.newPresetInput.value = '';
        els.newPresetInput.focus();
      }
    }

    function closePresetModal() {
      if (!els.presetEditorModal || !state.isPresetModalOpen) return;
      state.isPresetModalOpen = false;
      els.presetEditorModal.hidden = true;
      document.body.classList.remove('is-modal-open');
      setBackgroundInert(false);
      window.removeEventListener('keydown', handleModalEscape);
      renderExerciseSuggestions();
      if (els.togglePresetEditBtn) {
        els.togglePresetEditBtn.focus();
      }
    }

    function handleAddPreset(rawName) {
      const targetPart = state.presetModalBodyPart;
      const result = Storage.addPresetExercise(state.exercisePresets, targetPart, rawName);
      if (result.added) {
        state.exercisePresets = result.presets;
        if (els.newPresetInput) {
          els.newPresetInput.value = '';
          els.newPresetInput.focus();
        }
        renderPresetEditorModal();
        renderExerciseSuggestions();
        showToast(`「${rawName.trim()}」をよく使う種目に追加しました`, false);
      } else if (result.reason === 'duplicate') {
        showToast('その種目はすでに登録されています', false);
      } else if (result.reason === 'empty') {
        if (els.newPresetInput) els.newPresetInput.focus();
      }
    }

    if (els.togglePresetEditBtn) {
      els.togglePresetEditBtn.addEventListener('click', openPresetModal);
    }

    if (els.closePresetModalBtn) {
      els.closePresetModalBtn.addEventListener('click', closePresetModal);
    }

    if (els.donePresetEditBtn) {
      els.donePresetEditBtn.addEventListener('click', closePresetModal);
    }

    if (els.presetEditorModal) {
      els.presetEditorModal.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-close-preset-modal]')) {
          closePresetModal();
        }
      });
    }

    if (els.presetModalPartTabs) {
      els.presetModalPartTabs.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-modal-part]');
        if (!btn) return;
        state.presetModalBodyPart = btn.dataset.modalPart;
        renderPresetEditorModal();
      });
    }

    if (els.presetModalChips) {
      els.presetModalChips.addEventListener('click', (ev) => {
        const removeBtn = ev.target.closest('[data-remove-preset]');
        if (!removeBtn) return;
        const targetName = removeBtn.dataset.removePreset;
        state.exercisePresets = Storage.removePresetExercise(
          state.exercisePresets,
          state.presetModalBodyPart,
          targetName
        );
        renderPresetEditorModal();
        renderExerciseSuggestions();
        showToast(`「${targetName}」をよく使う種目から削除しました`, false);
      });
    }

    if (els.addPresetBtn) {
      els.addPresetBtn.addEventListener('click', () => {
        handleAddPreset(els.newPresetInput ? els.newPresetInput.value : '');
      });
    }

    if (els.newPresetInput) {
      els.newPresetInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.isComposing) {
          ev.preventDefault();
          handleAddPreset(els.newPresetInput.value);
        }
      });
    }

    if (els.presetFromHistoryRow) {
      els.presetFromHistoryRow.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-add-history-preset]');
        if (!btn) return;
        handleAddPreset(btn.dataset.addHistoryPreset);
      });
    }

    if (els.resetPresetsBtn) {
      els.resetPresetsBtn.addEventListener('click', () => {
        state.exercisePresets = Storage.resetBodyPartPresets(
          state.exercisePresets,
          state.presetModalBodyPart
        );
        renderPresetEditorModal();
        renderExerciseSuggestions();
        showToast('この部位のよく使う種目を初期値に戻しました', false);
      });
    }

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

    // Theme toggle
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
      a.download = `machomemo_${formatLocalDate(new Date())}.json`;
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

  function setupTutorial() {
    if (!els.tutorialOverlay || !els.tutorialSpotlight || !els.tutorialCard) return;

    const TUTORIAL_STEPS = [
      {
        tab: 'record',
        selector: '.form-card',
        title: 'マチョめもへようこそ！',
        body: '日々の筋トレを素早く記録し、成長や部位バランスを見える化できます。まずはサンプルデータを使って主な機能をご案内します。',
        prepare() {
          state.selectedBodyPart = 'chest';
          renderBodyPartPills();
          els.inputExercise.value = 'ベンチプレス';
          renderExerciseSuggestions();
          renderPreviousRecordBox();
          renderLivePreview();
        },
      },
      {
        tab: 'record',
        selector: '#presetShortcutsArea',
        title: 'よく使う種目は自由に編集OK',
        body: '「編集」ボタンから、よく使う種目の追加・削除を部位ごとにカスタマイズできます。種目が増えすぎず、いつものメニューを1タップで素早く選べます。',
        prepare() {
          state.selectedBodyPart = 'chest';
          renderBodyPartPills();
          renderExerciseSuggestions();
        },
      },
      {
        tab: 'record',
        selector: '#previousRecordInline',
        title: '前回記録を見ながら即入力',
        body: '種目を選ぶと前回の重量・回数・セット数が表示されます。「前回値をコピー」や ± ボタンでジムでも数秒で記録できます。',
        prepare() {
          if (!els.inputExercise.value.trim()) {
            els.inputExercise.value = 'ベンチプレス';
          }
          renderPreviousRecordBox();
          renderLivePreview();
        },
      },
      {
        tab: 'growth',
        selector: '#view-growth .chart-panel',
        title: '種目ごとの成長と自己ベストを可視化',
        body: '推定1RMと総ボリュームの推移をグラフで確認できます。自己ベスト（PR）を更新した日には ★ マークが表示されます。',
        prepare() {
          state.selectedExercise = 'ベンチプレス';
          state.growthMetric = 'oneRM';
          renderGrowthView();
        },
      },
      {
        tab: 'balance',
        selector: '#balanceChartContainer',
        title: '部位の偏りとアドバイスを把握',
        body: '直近7日〜全期間の6部位バランスをレーダーや棒グラフで可視化し、不足している部位や偏りに対してアドバイスを表示します。',
        prepare() {
          state.balancePeriod = 14;
          state.balanceChartType = 'radar';
          renderBalanceView();
        },
      },
      {
        tab: 'history',
        selector: '.history-calendar-card',
        title: 'カレンダーで実施日を一目で確認',
        body: 'カレンダー上でトレーニングした日と部位カラーを確認でき、日付タップで記録を絞り込めます。準備ができたら始めましょう！',
        isFinal: true,
        prepare() {
          const today = new Date();
          state.historyCalendarYear = today.getFullYear();
          state.historyCalendarMonth = today.getMonth();
          state.historySelectedDate = null;
          renderHistoryView();
        },
      },
    ];

    let currentStepIndex = 0;
    let isOpen = false;
    let rafId = null;

    function getSafeViewportInsets() {
      const headerEl = document.querySelector('.app-header');
      const mobileNavEl = document.querySelector('.mobile-bottom-nav');
      const headerBottom = headerEl ? Math.max(0, Math.ceil(headerEl.getBoundingClientRect().bottom)) : 0;
      const mobileNavRect = mobileNavEl ? mobileNavEl.getBoundingClientRect() : null;
      const mobileNavHeight =
        mobileNavRect && mobileNavRect.height > 0 ? Math.ceil(mobileNavRect.height) : 0;
      return { headerBottom, mobileNavHeight };
    }

    function scrollTargetIntoSafeArea(targetEl) {
      const { headerBottom, mobileNavHeight } = getSafeViewportInsets();
      const rect = targetEl.getBoundingClientRect();
      const topPadding = 14;
      const bottomPadding = 14;
      const availableHeight = Math.max(120, window.innerHeight - headerBottom - mobileNavHeight - topPadding - bottomPadding);

      let targetScrollY;
      if (rect.height >= availableHeight) {
        targetScrollY = window.scrollY + rect.top - headerBottom - topPadding;
      } else {
        const safeCenterY = headerBottom + topPadding + availableHeight / 2;
        const rectCenterY = rect.top + rect.height / 2;
        targetScrollY = window.scrollY + (rectCenterY - safeCenterY);
        const minVisibleTopY = window.scrollY + rect.top - headerBottom - topPadding;
        targetScrollY = Math.min(targetScrollY, minVisibleTopY);
      }

      window.scrollTo({ top: Math.max(0, Math.round(targetScrollY)), behavior: 'instant' });
    }

    function positionOverlay() {
      if (!isOpen) return;
      const step = TUTORIAL_STEPS[currentStepIndex];
      const targetEl = document.querySelector(step.selector);
      if (!targetEl) return;

      const { headerBottom, mobileNavHeight } = getSafeViewportInsets();
      const targetRect = targetEl.getBoundingClientRect();
      const cardRect = els.tutorialCard.getBoundingClientRect();
      const pos = computeTutorialPopoverPosition({
        targetRect,
        cardWidth: cardRect.width || 340,
        cardHeight: cardRect.height || 220,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        safeTop: headerBottom + 8,
        safeBottom: mobileNavHeight + 8,
      });

      els.tutorialSpotlight.style.top = `${pos.spotlight.top}px`;
      els.tutorialSpotlight.style.left = `${pos.spotlight.left}px`;
      els.tutorialSpotlight.style.width = `${pos.spotlight.width}px`;
      els.tutorialSpotlight.style.height = `${pos.spotlight.height}px`;
      els.tutorialCard.style.top = `${pos.top}px`;
      els.tutorialCard.style.left = `${pos.left}px`;
    }

    function schedulePosition() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        positionOverlay();
      });
    }

    function handleKeydown(ev) {
      if (!isOpen) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        completeTutorial();
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
          showStep(currentStepIndex + 1);
        } else {
          completeTutorial();
        }
      } else if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        if (currentStepIndex > 0) {
          showStep(currentStepIndex - 1);
        }
      }
    }

    function showStep(index) {
      currentStepIndex = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, index));
      const step = TUTORIAL_STEPS[currentStepIndex];

      setActiveTab(step.tab, { skipAnimation: true });
      if (typeof step.prepare === 'function') {
        step.prepare();
      }

      els.tutorialStepBadge.textContent = `${currentStepIndex + 1} / ${TUTORIAL_STEPS.length}`;
      els.tutorialDots.innerHTML = TUTORIAL_STEPS.map(
        (_, i) => `<span class="tutorial-dot ${i === currentStepIndex ? 'is-active' : ''}"></span>`
      ).join('');
      els.tutorialTitle.textContent = step.title;
      els.tutorialBody.textContent = step.body;
      els.tutorialNote.hidden = !step.isFinal;
      els.tutorialPrevBtn.hidden = currentStepIndex === 0;
      els.tutorialNextBtn.textContent = step.isFinal ? 'はじめる' : '次へ';

      const targetEl = document.querySelector(step.selector);
      if (targetEl) {
        scrollTargetIntoSafeArea(targetEl);
      }
      els.tutorialOverlay.hidden = false;
      positionOverlay();
      schedulePosition();
    }

    function completeTutorial() {
      if (!isOpen) return;
      isOpen = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      els.tutorialOverlay.hidden = true;
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.removeEventListener('keydown', handleKeydown);

      const result = Storage.finishTutorialAndClearSample();
      state.workouts = result.workouts;
      state.selectedExercise = '';
      state.historySelectedDate = null;
      els.inputExercise.value = '';
      resetFormToCreateMode(false);
      setActiveTab('record', { skipAnimation: true });
      refreshAllViews();
      window.scrollTo({ top: 0, behavior: 'instant' });

      if (result.clearedSample) {
        showToast('チュートリアル完了！サンプルデータを消去しました。最初の記録をつけてみましょう。', false);
      }
    }

    function startTutorial() {
      if (isOpen) return;
      isOpen = true;
      window.addEventListener('resize', schedulePosition);
      window.addEventListener('scroll', schedulePosition, true);
      window.addEventListener('keydown', handleKeydown);
      showStep(0);
    }

    els.tutorialNextBtn.addEventListener('click', () => {
      if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
        showStep(currentStepIndex + 1);
      } else {
        completeTutorial();
      }
    });

    els.tutorialPrevBtn.addEventListener('click', () => {
      if (currentStepIndex > 0) {
        showStep(currentStepIndex - 1);
      }
    });

    els.tutorialSkipBtn.addEventListener('click', completeTutorial);

    if (Storage.shouldShowTutorial()) {
      startTutorial();
    }
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
    setupTutorial();
  }

  init();
})(typeof globalThis !== 'undefined' ? globalThis : window);
