(function (root) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  }

  function formatShortDate(dateStr) {
    if (typeof dateStr !== 'string') return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${Number(parts[1])}/${Number(parts[2])}`;
  }

  function computeNiceTicks(minVal, maxVal, tickCount) {
    if (maxVal <= minVal) {
      const base = Math.max(0, minVal);
      const step = base > 0 ? Math.max(1, Math.ceil(base * 0.25)) : 10;
      const start = Math.max(0, base - step * 2);
      const ticks = [];
      for (let i = 0; i < tickCount; i += 1) {
        ticks.push(Math.round((start + step * i) * 10) / 10);
      }
      return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
    }

    const range = maxVal - minVal;
    const rawStep = range / Math.max(1, tickCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    let niceNorm = 10;
    if (normalized <= 1) niceNorm = 1;
    else if (normalized <= 2) niceNorm = 2;
    else if (normalized <= 2.5) niceNorm = 2.5;
    else if (normalized <= 5) niceNorm = 5;

    const step = niceNorm * magnitude;
    const niceMin = Math.max(0, Math.floor(minVal / step) * step);
    const niceMax = Math.ceil(maxVal / step) * step;

    const ticks = [];
    for (let val = niceMin; val <= niceMax + step * 0.001; val += step) {
      ticks.push(Math.round(val * 10) / 10);
    }
    return {
      min: ticks[0],
      max: ticks[ticks.length - 1],
      ticks,
    };
  }

  function positionFloatingTooltip(container, tooltipEl, anchorXRatio, anchorYRatio) {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const leftPct = Math.min(82, Math.max(18, anchorXRatio * 100));
    const topPct = Math.max(8, Math.min(72, anchorYRatio * 100 - 8));
    tooltipEl.style.left = `${leftPct}%`;
    tooltipEl.style.top = `${topPct}%`;
  }

  /**
   * Computes responsive SVG geometry for the growth chart based on container/viewport width.
   */
  function computeGrowthChartLayout({ containerWidth = 680, viewportWidth = 1024 } = {}) {
    const isCompact = viewportWidth > 0 && viewportWidth < 640;
    if (isCompact) {
      const resolvedW = containerWidth > 0 ? Math.max(260, Math.round(containerWidth)) : Math.max(280, Math.round(viewportWidth - 36));
      return {
        isCompact: true,
        W: resolvedW,
        H: 268,
        margin: { top: 24, right: 14, bottom: 32, left: 40 },
        maxLabels: 4,
      };
    }
    return {
      isCompact: false,
      W: 680,
      H: 310,
      margin: { top: 28, right: 24, bottom: 40, left: 58 },
      maxLabels: 6,
    };
  }

  /**
   * Renders the exercise growth line/area chart with PR markers and interactive tooltip.
   */
  function renderGrowthChart(container, { history, metric, onSelectPoint }) {
    if (!container) return;

    const entries = (history && history.entries) || [];
    if (entries.length === 0) {
      container.innerHTML = `
        <div class="chart-empty">
          <div class="chart-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 19h18" />
              <path d="m4.5 14.5 5-5 4 3 6-6" />
              <path d="M15.5 6.5h4v4" />
            </svg>
          </div>
          <p class="chart-empty-title">選択した種目の記録がまだありません</p>
          <p class="chart-empty-sub">「記録」タブからトレーニングを登録すると、推定1RMや総ボリュームの推移がここに表示されます。</p>
        </div>
      `;
      return;
    }

    const isOneRM = metric === 'oneRM';
    const values = entries.map((e) => (isOneRM ? e.oneRM : e.volume));
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = rawMax === rawMin ? Math.max(5, rawMax * 0.15) : (rawMax - rawMin) * 0.14;
    const { min, max, ticks } = computeNiceTicks(Math.max(0, rawMin - padding), rawMax + padding, 5);

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const containerWidth = container.clientWidth || 0;
    const { isCompact, W, H, margin, maxLabels } = computeGrowthChartLayout({
      containerWidth,
      viewportWidth,
    });
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const xOf = (idx) => {
      if (entries.length === 1) return margin.left + plotW / 2;
      return margin.left + (idx / (entries.length - 1)) * plotW;
    };

    const yOf = (val) => {
      const span = max - min || 1;
      const ratio = (val - min) / span;
      return margin.top + plotH - ratio * plotH;
    };

    const points = entries.map((entry, idx) => {
      const val = isOneRM ? entry.oneRM : entry.volume;
      const isPR = isOneRM ? entry.isOneRMPR : entry.isVolumePR;
      return {
        idx,
        entry,
        val,
        isPR,
        x: xOf(idx),
        y: yOf(val),
      };
    });

    const linePath = points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const areaPath =
      points.length > 1
        ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(margin.top + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(margin.top + plotH).toFixed(1)} Z`
        : '';

    const gridLinesSvg = ticks
      .map((t) => {
        const y = yOf(t);
        return `
          <g class="chart-grid-row">
            <line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${W - margin.right}" y2="${y.toFixed(1)}" stroke="var(--chart-grid)" stroke-dasharray="4 4" />
            <text x="${margin.left - (isCompact ? 6 : 10)}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="chart-axis-text">${escapeHtml(formatNumber(t))}</text>
          </g>
        `;
      })
      .join('');

    const labelStep = Math.max(1, Math.ceil(points.length / maxLabels));
    const xLabelsSvg = points
      .filter((p, idx) => idx === 0 || idx === points.length - 1 || idx % labelStep === 0)
      .map((p) => {
        return `<text x="${p.x.toFixed(1)}" y="${H - (isCompact ? 8 : 12)}" text-anchor="middle" class="chart-axis-text">${escapeHtml(formatShortDate(p.entry.date))}</text>`;
      })
      .join('');

    const isSinglePoint = points.length === 1;
    const pointsSvg = points
      .map((p) => {
        const prRing = p.isPR
          ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="10" fill="rgba(245, 158, 11, 0.22)" />
             <text x="${p.x.toFixed(1)}" y="${(p.y - 14).toFixed(1)}" text-anchor="middle" class="chart-pr-star">★ PR</text>`
          : '';
        const singleValueLabel = isSinglePoint
          ? `<text x="${(p.x + 12).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="start" class="chart-point-value">${escapeHtml(formatNumber(p.val))}kg</text>`
          : '';
        const fill = p.isPR ? 'var(--gold)' : 'var(--chart-line)';
        const stroke = 'var(--chart-dot-stroke)';
        return `
          <g class="chart-point-group" data-point-idx="${p.idx}" tabindex="0" role="button" aria-label="${escapeHtml(p.entry.date)} ${escapeHtml(formatNumber(p.val))}${isOneRM ? 'kg' : 'kgボリューム'}">
            ${prRing}
            ${singleValueLabel}
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="16" fill="transparent" class="chart-hit-area" />
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.isPR ? 6 : 4.5}" fill="${fill}" stroke="${stroke}" stroke-width="2" class="chart-dot" />
          </g>
        `;
      })
      .join('');

    const singleCaptionHtml = isSinglePoint
      ? '<p class="chart-single-caption">※ 2回目以降の記録から推移線が表示されます</p>'
      : '';

    const gradientId = `growthAreaGrad_${Math.random().toString(36).slice(2, 8)}`;
    const unitLabel = isOneRM ? 'kg (推定1RM)' : 'kg (総ボリューム)';

    container.innerHTML = `
      ${singleCaptionHtml}
      <div class="svg-chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" class="growth-svg${isCompact ? ' is-compact' : ''}" role="img" aria-label="種目成長グラフ">
          <defs>
            <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--chart-area)" stop-opacity="0.24" />
              <stop offset="100%" stop-color="var(--chart-area)" stop-opacity="0.01" />
            </linearGradient>
          </defs>
          <text x="${margin.left}" y="${isCompact ? 13 : 15}" class="chart-unit-label">${escapeHtml(unitLabel)}</text>
          ${gridLinesSvg}
          ${xLabelsSvg}
          ${areaPath ? `<path d="${areaPath}" fill="url(#${gradientId})" />` : ''}
          ${points.length > 1 ? `<path d="${linePath}" fill="none" stroke="var(--chart-line)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />` : ''}
          ${pointsSvg}
        </svg>
        <div class="chart-tooltip" hidden></div>
      </div>
    `;

    const wrap = container.querySelector('.svg-chart-wrap');
    const tooltip = container.querySelector('.chart-tooltip');
    const pointGroups = container.querySelectorAll('.chart-point-group');

    function showTooltip(pt) {
      const e = pt.entry;
      const prTag = pt.isPR ? '<span class="tooltip-pr">★ 自己ベスト更新</span>' : '';
      tooltip.innerHTML = `
        <div class="tooltip-date">${escapeHtml(e.date)} ${prTag}</div>
        <div class="tooltip-spec">${escapeHtml(formatNumber(e.weight))}kg × ${escapeHtml(e.reps)}回 × ${escapeHtml(e.sets)}セット</div>
        <div class="tooltip-metrics">
          <span>推定1RM: <strong>${escapeHtml(formatNumber(e.oneRM))}kg</strong></span>
          <span>総ボリューム: <strong>${escapeHtml(formatNumber(e.volume))}kg</strong></span>
        </div>
      `;
      tooltip.hidden = false;
      positionFloatingTooltip(wrap, tooltip, pt.x / W, pt.y / H);
    }

    function hideTooltip() {
      tooltip.hidden = true;
    }

    pointGroups.forEach((group) => {
      const idx = Number(group.getAttribute('data-point-idx'));
      const pt = points[idx];
      if (!pt) return;

      group.addEventListener('mouseenter', () => showTooltip(pt));
      group.addEventListener('focus', () => showTooltip(pt));
      group.addEventListener('mouseleave', hideTooltip);
      group.addEventListener('blur', hideTooltip);
      group.addEventListener('click', (ev) => {
        ev.stopPropagation();
        showTooltip(pt);
        if (typeof onSelectPoint === 'function') {
          onSelectPoint(pt.entry);
        }
      });
    });

    wrap.addEventListener('click', (ev) => {
      if (!ev.target.closest('.chart-point-group')) {
        hideTooltip();
      }
    });
  }

  /**
   * Renders a 6-axis hexagonal radar chart for body part balance.
   */
  function renderRadarChart(container, { parts, metric }) {
    if (!container) return;
    const items = parts || [];
    const total = items.reduce((acc, p) => acc + (metric === 'sets' ? p.sets : p.volume), 0);

    if (total === 0) {
      container.innerHTML = `
        <div class="chart-empty">
          <div class="chart-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 3 19.8 7.5 19.8 16.5 12 21 4.2 16.5 4.2 7.5" />
              <polygon points="12 8 15.5 10 15.5 14 12 16 8.5 14 8.5 10" />
            </svg>
          </div>
          <p class="chart-empty-title">選択期間のトレーニングデータがありません</p>
          <p class="chart-empty-sub">期間を「直近30日」や「全期間」に切り替えるか、新しい記録を追加してください。</p>
        </div>
      `;
      return;
    }

    const W = 400;
    const H = 340;
    const cx = W / 2;
    const cy = H / 2 + 4;
    const radius = 104;
    const count = items.length || 6;

    const values = items.map((p) => (metric === 'sets' ? p.sets : p.volumeShare));
    const maxVal = Math.max(1, ...values);

    const angleAt = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / count;

    const ringLevels = [0.25, 0.5, 0.75, 1];
    const ringsSvg = ringLevels
      .map((level) => {
        const pts = items
          .map((_, i) => {
            const a = angleAt(i);
            const r = radius * level;
            return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
          })
          .join(' ');
        return `<polygon points="${pts}" fill="none" stroke="var(--chart-grid)" stroke-width="1" />`;
      })
      .join('');

    const axesSvg = items
      .map((part, i) => {
        const a = angleAt(i);
        const x2 = cx + radius * Math.cos(a);
        const y2 = cy + radius * Math.sin(a);
        const labelR = radius + 28;
        const lx = cx + labelR * Math.cos(a);
        const ly = cy + labelR * Math.sin(a);

        let anchor = 'middle';
        if (Math.cos(a) > 0.25) anchor = 'start';
        else if (Math.cos(a) < -0.25) anchor = 'end';

        const subText = metric === 'sets' ? `${part.sets} set` : `${part.volumeShare}%`;
        const isZero = part.sets === 0;

        return `
          <g>
            <line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--chart-axis-line)" stroke-width="1" />
            <text x="${lx.toFixed(1)}" y="${(ly - 2).toFixed(1)}" text-anchor="${anchor}" class="radar-label ${isZero ? 'is-zero' : ''}">${escapeHtml(part.label)}</text>
            <text x="${lx.toFixed(1)}" y="${(ly + 14).toFixed(1)}" text-anchor="${anchor}" class="radar-sublabel ${isZero ? 'is-zero' : ''}">${escapeHtml(subText)}</text>
          </g>
        `;
      })
      .join('');

    const dataPoints = items.map((part, i) => {
      const a = angleAt(i);
      const val = metric === 'sets' ? part.sets : part.volumeShare;
      const ratio = maxVal > 0 ? val / maxVal : 0;
      const r = radius * ratio;
      return {
        part,
        x: cx + r * Math.cos(a),
        y: cy + r * Math.sin(a),
      };
    });

    const polygonPoints = dataPoints.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');

    const dotsSvg = dataPoints
      .map((d, idx) => {
        return `
          <g class="radar-dot-group" data-part-idx="${idx}" tabindex="0" role="button" aria-label="${escapeHtml(d.part.label)} ${escapeHtml(d.part.sets)}セット">
            <circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="14" fill="transparent" />
            <circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="5" fill="${escapeHtml(d.part.color)}" stroke="var(--chart-dot-stroke)" stroke-width="2" />
          </g>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="svg-chart-wrap radar-wrap">
        <svg viewBox="0 0 ${W} ${H}" class="radar-svg" role="img" aria-label="部位バランスレーダーチャート">
          ${ringsSvg}
          ${axesSvg}
          <polygon points="${polygonPoints}" fill="var(--radar-fill)" stroke="var(--chart-line)" stroke-width="2.5" stroke-linejoin="round" />
          ${dotsSvg}
        </svg>
        <div class="chart-tooltip" hidden></div>
      </div>
    `;

    const wrap = container.querySelector('.svg-chart-wrap');
    const tooltip = container.querySelector('.chart-tooltip');
    const dotGroups = container.querySelectorAll('.radar-dot-group');

    function showTooltip(pt) {
      const p = pt.part;
      tooltip.innerHTML = `
        <div class="tooltip-date">${escapeHtml(p.label)}</div>
        <div class="tooltip-metrics">
          <span>セット数: <strong>${escapeHtml(p.sets)} set (${escapeHtml(p.setsShare)}%)</strong></span>
          <span>ボリューム: <strong>${escapeHtml(formatNumber(p.volume))}kg (${escapeHtml(p.volumeShare)}%)</strong></span>
        </div>
      `;
      tooltip.hidden = false;
      positionFloatingTooltip(wrap, tooltip, pt.x / W, pt.y / H);
    }

    dotGroups.forEach((g) => {
      const idx = Number(g.getAttribute('data-part-idx'));
      const pt = dataPoints[idx];
      if (!pt) return;
      g.addEventListener('mouseenter', () => showTooltip(pt));
      g.addEventListener('focus', () => showTooltip(pt));
      g.addEventListener('mouseleave', () => {
        tooltip.hidden = true;
      });
      g.addEventListener('blur', () => {
        tooltip.hidden = true;
      });
      g.addEventListener('click', (ev) => {
        ev.stopPropagation();
        showTooltip(pt);
      });
    });

    wrap.addEventListener('click', (ev) => {
      if (!ev.target.closest('.radar-dot-group')) {
        tooltip.hidden = true;
      }
    });
  }

  /**
   * Renders a clean horizontal bar chart for body part sets or volume share.
   */
  function renderBarChart(container, { parts, metric }) {
    if (!container) return;
    const items = parts || [];
    const total = items.reduce((acc, p) => acc + (metric === 'sets' ? p.sets : p.volume), 0);

    if (total === 0) {
      container.innerHTML = `
        <div class="chart-empty">
          <div class="chart-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 19h18" />
              <rect x="5" y="11" width="3.5" height="5" rx="1" />
              <rect x="10.25" y="7" width="3.5" height="9" rx="1" />
              <rect x="15.5" y="4" width="3.5" height="12" rx="1" />
            </svg>
          </div>
          <p class="chart-empty-title">選択期間のトレーニングデータがありません</p>
          <p class="chart-empty-sub">期間を切り替えるか、新しいトレーニングを記録してください。</p>
        </div>
      `;
      return;
    }

    const values = items.map((p) => (metric === 'sets' ? p.sets : p.volumeShare));
    const maxVal = Math.max(1, ...values);

    const rowsHtml = items
      .map((part) => {
        const val = metric === 'sets' ? part.sets : part.volumeShare;
        const pct = Math.max(0, Math.min(100, (val / maxVal) * 100));
        const isZero = part.sets === 0;
        const primaryText =
          metric === 'sets'
            ? `${part.sets} セット (${part.setsShare}%)`
            : `${part.volumeShare}% (${formatNumber(part.volume)} kg)`;
        return `
          <div class="bar-row ${isZero ? 'is-zero' : ''}">
            <div class="bar-row-header">
              <span class="bar-part-name">
                <span class="part-dot" style="background:${escapeHtml(part.color)}"></span>
                ${escapeHtml(part.label)}
              </span>
              <span class="bar-part-value">${escapeHtml(primaryText)}</span>
            </div>
            <div class="bar-track" aria-hidden="true">
              <div class="bar-fill" style="width:${pct.toFixed(1)}%; background:${escapeHtml(part.color)}"></div>
            </div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = `<div class="bar-chart-list">${rowsHtml}</div>`;
  }

  const api = {
    computeGrowthChartLayout,
    renderGrowthChart,
    renderRadarChart,
    renderBarChart,
    escapeHtml,
    formatNumber,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LiftLog = root.LiftLog || {};
  root.LiftLog.Charts = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
