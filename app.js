const STORAGE_KEY = "af-transfer-risk-manager-v1";
const RISK_SHARE = 0.51;
const WARNING_SHARE = 0.45;
const MONTHLY_FEE_YEN = 7678;
const DEFAULT_MONTHLY_GOAL = 12;

const els = {
  todayPill: document.querySelector("#todayPill"),
  homeClubInput: document.querySelector("#homeClubInput"),
  saveHomeBtn: document.querySelector("#saveHomeBtn"),
  homeSaveStatus: document.querySelector("#homeSaveStatus"),
  visitForm: document.querySelector("#visitForm"),
  visitDate: document.querySelector("#visitDate"),
  visitStore: document.querySelector("#visitStore"),
  visitMemo: document.querySelector("#visitMemo"),
  recordSaveStatus: document.querySelector("#recordSaveStatus"),
  clearFormBtn: document.querySelector("#clearFormBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  entryTitle: document.querySelector("#entryTitle"),
  homeClubSuggestions: document.querySelector("#homeClubSuggestions"),
  visitStoreSuggestions: document.querySelector("#visitStoreSuggestions"),
  riskStoreSuggestions: document.querySelector("#riskStoreSuggestions"),
  simStoreSuggestions: document.querySelector("#simStoreSuggestions"),
  historyEditStoreSuggestions: document.querySelector("#historyEditStoreSuggestions"),
  windowLabel: document.querySelector("#windowLabel"),
  totalVisits: document.querySelector("#totalVisits"),
  maxAwayShare: document.querySelector("#maxAwayShare"),
  warningCount: document.querySelector("#warningCount"),
  usageTable: document.querySelector("#usageTable"),
  alertsList: document.querySelector("#alertsList"),
  historyBody: document.querySelector("#historyBody"),
  historyEditPanel: document.querySelector("#historyEditPanel"),
  historyEditForm: document.querySelector("#historyEditForm"),
  historyEditDate: document.querySelector("#historyEditDate"),
  historyEditStore: document.querySelector("#historyEditStore"),
  historyEditMemo: document.querySelector("#historyEditMemo"),
  historyCancelEditBtn: document.querySelector("#historyCancelEditBtn"),
  historyEditResetBtn: document.querySelector("#historyEditResetBtn"),
  historyEditStatus: document.querySelector("#historyEditStatus"),
  riskStoreInput: document.querySelector("#riskStoreInput"),
  riskResult: document.querySelector("#riskResult"),
  simDate: document.querySelector("#simDate"),
  simStore: document.querySelector("#simStore"),
  simResult: document.querySelector("#simResult"),
  costMonthLabel: document.querySelector("#costMonthLabel"),
  currentCostPerVisit: document.querySelector("#currentCostPerVisit"),
  currentCostMessage: document.querySelector("#currentCostMessage"),
  monthlyFeeLabel: document.querySelector("#monthlyFeeLabel"),
  currentMonthVisits: document.querySelector("#currentMonthVisits"),
  goalRateLabel: document.querySelector("#goalRateLabel"),
  goalRemainingLabel: document.querySelector("#goalRemainingLabel"),
  monthlyGoalInput: document.querySelector("#monthlyGoalInput"),
  saveMonthlyGoalBtn: document.querySelector("#saveMonthlyGoalBtn"),
  monthlyGoalStatus: document.querySelector("#monthlyGoalStatus"),
  goalMeterBar: document.querySelector("#goalMeterBar"),
  costProjectionCards: document.querySelector("#costProjectionCards"),
  monthlyCostTrend: document.querySelector("#monthlyCostTrend"),
  calendarLabel: document.querySelector("#calendarLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  prevMonthBtn: document.querySelector("#prevMonthBtn"),
  nextMonthBtn: document.querySelector("#nextMonthBtn"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabSections: document.querySelectorAll("[data-tab-section]"),
};

let state = loadState();
let editingId = null;
let historyEditingId = null;
let calendarCursor = startOfMonth(new Date());
let homeStatusTimer = null;
let recordStatusTimer = null;
let monthlyGoalStatusTimer = null;
let activeTab = "overview";

init();

function init() {
  const today = toISODate(new Date());
  els.todayPill.textContent = `今日: ${formatJPDate(today)}`;
  els.visitDate.value = today;
  els.simDate.value = today;
  els.homeClubInput.value = state.homeClub;
  els.monthlyGoalInput.value = state.monthlyGoal;
  attachEvents();
  render();
}

function attachEvents() {
  els.saveHomeBtn.addEventListener("click", () => {
    state.homeClub = normalizeStore(els.homeClubInput.value);
    persist();
    showHomeSaved();
    render();
  });

  els.visitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const visit = {
      id: editingId || crypto.randomUUID(),
      date: els.visitDate.value,
      store: normalizeStore(els.visitStore.value),
      memo: els.visitMemo.value.trim(),
      createdAt: editingId ? findVisit(editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!visit.date || !visit.store) return;

    if (editingId) {
      state.visits = state.visits.map((item) => (item.id === editingId ? visit : item));
    } else {
      state.visits.push(visit);
    }

    showRecordSaved(visit);
    finishRecord();
    persist();
    render();
  });

  els.clearFormBtn.addEventListener("click", clearForm);
  els.cancelEditBtn.addEventListener("click", clearForm);
  els.historyEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveHistoryEdit();
  });
  els.historyCancelEditBtn.addEventListener("click", cancelHistoryEdit);
  els.historyEditResetBtn.addEventListener("click", () => {
    const visit = findVisit(historyEditingId);
    if (visit) fillHistoryEditForm(visit);
  });
  els.riskStoreInput.addEventListener("input", renderRiskCheck);
  els.simDate.addEventListener("input", renderSimulator);
  els.simStore.addEventListener("input", renderSimulator);
  els.saveMonthlyGoalBtn.addEventListener("click", saveMonthlyGoal);
  els.monthlyGoalInput.addEventListener("input", markMonthlyGoalUnsaved);
  els.prevMonthBtn.addEventListener("click", () => {
    calendarCursor = addMonths(calendarCursor, -1);
    renderCalendar();
  });
  els.nextMonthBtn.addEventListener("click", () => {
    calendarCursor = addMonths(calendarCursor, 1);
    renderCalendar();
  });
  bindStoreAutocomplete(els.homeClubInput, els.homeClubSuggestions);
  bindStoreAutocomplete(els.visitStore, els.visitStoreSuggestions);
  bindStoreAutocomplete(els.riskStoreInput, els.riskStoreSuggestions, renderRiskCheck);
  bindStoreAutocomplete(els.simStore, els.simStoreSuggestions, renderSimulator);
  bindStoreAutocomplete(els.historyEditStore, els.historyEditStoreSuggestions);
  els.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });
}

function render() {
  state.visits.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  renderSuggestions();
  renderSummary();
  renderUsageTable();
  renderAlerts();
  renderHistory();
  renderCostAnalysis();
  renderRiskCheck();
  renderSimulator();
  renderCalendar();
  setActiveTab(activeTab);
}

function renderSuggestions() {
  closeAllSuggestions();
}

function renderSummary() {
  const today = toISODate(new Date());
  const stats = getWindowStats(state.visits, today, state.homeClub);
  const awayRows = stats.rows.filter((row) => !row.isHome);
  const maxAway = awayRows.reduce((max, row) => Math.max(max, row.share), 0);
  const warnings = awayRows.filter((row) => row.status !== "safe").map((row) => row.store);

  els.windowLabel.textContent = `${formatShortDate(stats.start)} - ${formatShortDate(stats.end)}`;
  els.totalVisits.textContent = String(stats.total);
  els.maxAwayShare.textContent = formatPercent(maxAway);
  els.warningCount.textContent = warnings.length ? warnings.join(" / ") : "なし";
}

function renderUsageTable() {
  const stats = getWindowStats(state.visits, toISODate(new Date()), state.homeClub);
  if (!stats.rows.length) {
    els.usageTable.innerHTML = `<div class="usage-row"><span class="empty">直近30日の利用履歴はありません。</span></div>`;
    return;
  }

  const rows = stats.rows
    .map((row) => {
      const barClass = row.isHome ? "" : row.status;
      return `
        <div class="usage-row">
          <strong>${escapeHTML(row.store)}${row.isHome ? "（ホーム）" : ""}</strong>
          <span>${row.count}回</span>
          <div class="bar ${barClass}"><span style="width:${Math.min(row.share * 100, 100)}%"></span></div>
          <span class="share">${formatPercent(row.share)}</span>
        </div>
      `;
    })
    .join("");

  els.usageTable.innerHTML = `
    <div class="usage-row header"><span>店舗名</span><span>回数</span><span>割合</span><span></span></div>
    ${rows}
  `;
}

function renderAlerts() {
  const today = toISODate(new Date());
  const stats = getWindowStats(state.visits, today, state.homeClub);
  const alerts = stats.rows.filter((row) => !row.isHome && row.status !== "safe");
  const oneAway = getKnownStores()
    .filter((store) => store !== state.homeClub)
    .map((store) => ({ store, remaining: visitsUntilDanger(store, today) }))
    .filter((item) => item.remaining !== null && item.remaining > 0 && item.remaining <= 2 && !alerts.some((alert) => alert.store === item.store));

  if (!alerts.length && !oneAway.length) {
    els.alertsList.innerHTML = `<div class="alert-card"><strong>現在の警告はありません</strong><p>直近30日で条件に近い非ホーム店舗はありません。</p></div>`;
    return;
  }

  els.alertsList.innerHTML = [
    ...alerts.map((row) => `
      <div class="alert-card ${row.status}">
        <strong>${row.status === "danger" ? "危険" : "要注意"}: ${escapeHTML(row.store)}</strong>
        <p>直近30日で${row.count}回、${formatPercent(row.share)}です。${row.reason}</p>
      </div>
    `),
    ...oneAway.map((item) => `
      <div class="alert-card warning">
        <strong>近接: ${escapeHTML(item.store)}</strong>
        <p>あと${item.remaining}回利用すると、直近30日とその前30日の連続条件に届く可能性があります。</p>
      </div>
    `),
  ].join("");
}

function renderHistory() {
  if (!state.visits.length) {
    els.historyBody.innerHTML = `<tr><td colspan="5" class="empty">利用履歴はまだありません。</td></tr>`;
    return;
  }

  els.historyBody.innerHTML = state.visits
    .map((visit) => {
      const isHome = visit.store === state.homeClub;
      return `
        <tr>
          <td>${formatJPDate(visit.date)}</td>
          <td>${escapeHTML(visit.store)}</td>
          <td>${escapeHTML(visit.memo || "")}</td>
          <td><span class="badge ${isHome ? "home" : "away"}">${isHome ? "ホーム" : "その他"}</span></td>
          <td>
            <div class="row-actions">
              <button class="mini-btn" data-action="edit" data-id="${visit.id}">編集</button>
              <button class="mini-btn danger" data-action="delete" data-id="${visit.id}">削除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  els.historyBody.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const visit = findVisit(button.dataset.id);
      if (!visit) return;
      if (button.dataset.action === "edit") startHistoryEdit(visit);
      if (button.dataset.action === "delete") deleteVisit(visit.id);
    });
  });
}

function renderRiskCheck() {
  const store = normalizeStore(els.riskStoreInput.value);
  if (!store) {
    els.riskResult.className = "risk-result empty";
    els.riskResult.textContent = "店舗名を入力すると、今日利用した場合のリスクを判定します。";
    return;
  }

  const today = toISODate(new Date());
  const result = simulateSingleVisit(today, store);
  const remaining = visitsUntilDanger(store, today);
  els.riskResult.className = `risk-result ${result.status}`;
  els.riskResult.innerHTML = `
    <strong>${escapeHTML(store)}: ${result.label}</strong><br>
    ${result.message}<br>
    ${store === state.homeClub ? "ホーム店舗の利用として扱います。" : formatRemainingText(remaining)}
  `;
}

function renderSimulator() {
  const date = els.simDate.value;
  const store = normalizeStore(els.simStore.value);
  if (!date || !store) {
    els.simResult.className = "sim-result empty";
    els.simResult.textContent = "予定日と店舗を入力すると、その1回を追加した場合の30日集計を表示します。";
    return;
  }

  const result = simulateSingleVisit(date, store);
  const stats = getWindowStats([...state.visits, makeSyntheticVisit(date, store)], date, state.homeClub);
  const rows = stats.rows
    .slice(0, 5)
    .map((row) => `${escapeHTML(row.store)}: ${row.count}回 / ${formatPercent(row.share)}`)
    .join("<br>");

  els.simResult.className = `sim-result ${result.status}`;
  els.simResult.innerHTML = `<strong>${result.label}</strong><br>${result.message}<hr>${rows || "利用なし"}`;
}

function renderCostAnalysis() {
  const today = new Date();
  const monthKey = toMonthKey(today);
  const monthLabel = formatMonthLabel(monthKey);
  const count = countVisitsInMonth(monthKey);
  const goal = getMonthlyGoal();
  const remaining = Math.max(goal - count, 0);
  const goalRate = goal ? Math.round((count / goal) * 100) : 0;

  els.costMonthLabel.textContent = `${monthLabel}の費用活用`;
  els.monthlyFeeLabel.textContent = formatYen(MONTHLY_FEE_YEN);
  els.currentMonthVisits.textContent = `${count}回`;
  els.currentCostPerVisit.textContent = count ? `${formatYen(costPerVisit(count))}/回` : "未利用";
  els.currentCostMessage.textContent = count
    ? `月会費を${count}回で割ると、実質${formatYen(costPerVisit(count))}/回です。`
    : "今月の利用履歴を登録すると、1回あたり費用を表示します。";
  els.goalRateLabel.textContent = `${goalRate}%`;
  els.goalRemainingLabel.textContent = remaining ? `目標まであと${remaining}回` : "月間目標を達成済み";
  els.goalMeterBar.style.width = `${Math.min(goalRate, 100)}%`;
  els.monthlyGoalInput.value = goal;

  renderCostProjections(count);
  renderMonthlyCostTrend(monthKey);
}

function renderCostProjections(currentCount) {
  els.costProjectionCards.innerHTML = [1, 2, 3]
    .map((extra) => {
      const nextCount = currentCount + extra;
      return `
        <div class="projection-card">
          <span>あと${extra}回行くと</span>
          <strong>${formatYen(costPerVisit(nextCount))}/回</strong>
          <small>月${nextCount}回利用</small>
        </div>
      `;
    })
    .join("");
}

function renderMonthlyCostTrend(currentMonthKey) {
  const rows = getMonthlyCostRows(currentMonthKey);
  const maxCount = Math.max(...rows.map((row) => row.count), getMonthlyGoal(), 1);

  els.monthlyCostTrend.innerHTML = rows
    .map((row) => {
      const width = Math.max((row.count / maxCount) * 100, row.count ? 8 : 0);
      const unitCost = row.count ? `${formatYen(costPerVisit(row.count))}/回` : "未利用";
      return `
        <div class="monthly-row">
          <div>
            <strong>${formatMonthLabel(row.month)}</strong>
            <span>${row.count}回</span>
          </div>
          <div class="monthly-bar"><span style="width:${width}%"></span></div>
          <strong>${unitCost}</strong>
        </div>
      `;
    })
    .join("");
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  els.calendarLabel.textContent = `${year}年${month + 1}月`;

  const first = new Date(year, month, 1);
  const gridStart = addDays(first, -first.getDay());
  const today = toISODate(new Date());
  const majorAwayStores = getMajorAwayStores();
  const cells = [];

  for (let i = 0; i < 42; i += 1) {
    const date = addDays(gridStart, i);
    const iso = toISODate(date);
    const visits = state.visits.filter((visit) => visit.date === iso);
    const dayRisk = getDayRiskDetails(iso, majorAwayStores);
    const riskDot =
      dayRisk.status === "danger"
        ? renderRiskDot("danger", "連続条件到達日", dayRisk.stores)
        : dayRisk.status === "warning"
          ? renderRiskDot("caution", "単独条件到達日", dayRisk.stores)
          : "";
    const visitDots = visits
      .slice(0, 4)
      .map((visit) => `<i class="dot ${visit.store === state.homeClub ? "home" : "away"}" title="${escapeHTML(visit.store)}"></i>`)
      .join("");
    const stores = visits.map((visit) => visit.store).join(" / ");

    cells.push(`
      <div class="day-cell ${date.getMonth() === month ? "" : "other-month"} ${iso === today ? "today" : ""}">
        <div class="day-num">${date.getDate()}</div>
        <div class="day-dots">${visitDots}${riskDot}</div>
        ${stores ? `<div class="day-store">${escapeHTML(stores)}</div>` : ""}
      </div>
    `);
  }

  els.calendarGrid.innerHTML = cells.join("");
}

function renderRiskDot(kind, label, stores) {
  const storeText = stores.length ? stores.join(" / ") : "対象店舗なし";
  return `
    <span class="risk-dot-wrap" tabindex="0">
      <i class="dot ${kind}" title="${escapeHTML(label)}: ${escapeHTML(storeText)}"></i>
      <span class="risk-tooltip">${escapeHTML(label)}<br>${escapeHTML(storeText)}</span>
    </span>
  `;
}

function showHomeSaved() {
  window.clearTimeout(homeStatusTimer);
  els.homeSaveStatus.textContent = state.homeClub ? `保存しました: ${state.homeClub}` : "所属店舗を空にしました";
  els.saveHomeBtn.textContent = "保存済み";
  homeStatusTimer = window.setTimeout(() => {
    els.homeSaveStatus.textContent = "";
    els.saveHomeBtn.textContent = "保存";
  }, 2200);
}

function showRecordSaved(visit) {
  window.clearTimeout(recordStatusTimer);
  els.recordSaveStatus.textContent = `記録しました: ${formatJPDate(visit.date)} / ${visit.store}`;
  recordStatusTimer = window.setTimeout(() => {
    els.recordSaveStatus.textContent = "";
  }, 2800);
}

function saveMonthlyGoal() {
  const parsed = Number.parseInt(els.monthlyGoalInput.value, 10);
  state.monthlyGoal = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_GOAL;
  els.monthlyGoalInput.value = state.monthlyGoal;
  persist();
  renderCostAnalysis();
  window.clearTimeout(monthlyGoalStatusTimer);
  els.monthlyGoalStatus.textContent = `月間目標を${state.monthlyGoal}回で保存しました`;
  els.saveMonthlyGoalBtn.textContent = "保存済み";
  monthlyGoalStatusTimer = window.setTimeout(() => {
    els.monthlyGoalStatus.textContent = "";
    els.saveMonthlyGoalBtn.textContent = "保存";
  }, 2400);
}

function markMonthlyGoalUnsaved() {
  window.clearTimeout(monthlyGoalStatusTimer);
  els.monthlyGoalStatus.textContent = "未保存です。保存ボタンを押すと反映されます。";
  els.saveMonthlyGoalBtn.textContent = "保存";
}

function startEdit(visit) {
  editingId = visit.id;
  els.entryTitle.textContent = "利用履歴を編集";
  els.visitDate.value = visit.date;
  els.visitStore.value = visit.store;
  els.visitMemo.value = visit.memo || "";
  els.cancelEditBtn.classList.remove("hidden");
  els.visitStore.focus();
}

function startHistoryEdit(visit) {
  historyEditingId = visit.id;
  fillHistoryEditForm(visit);
  els.historyEditPanel.classList.remove("hidden");
  els.historyEditStore.focus();
}

function fillHistoryEditForm(visit) {
  els.historyEditDate.value = visit.date;
  els.historyEditStore.value = visit.store;
  els.historyEditMemo.value = visit.memo || "";
  els.historyEditStatus.textContent = "";
}

function saveHistoryEdit() {
  const existing = findVisit(historyEditingId);
  if (!existing) return;

  const updated = {
    ...existing,
    date: els.historyEditDate.value,
    store: normalizeStore(els.historyEditStore.value),
    memo: els.historyEditMemo.value.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (!updated.date || !updated.store) return;

  state.visits = state.visits.map((item) => (item.id === historyEditingId ? updated : item));
  persist();
  render();
  historyEditingId = updated.id;
  fillHistoryEditForm(updated);
  els.historyEditPanel.classList.remove("hidden");
  els.historyEditStatus.textContent = `更新しました: ${formatJPDate(updated.date)} / ${updated.store}`;
}

function cancelHistoryEdit() {
  historyEditingId = null;
  els.historyEditStatus.textContent = "";
  els.historyEditPanel.classList.add("hidden");
}

function clearForm() {
  editingId = null;
  els.entryTitle.textContent = "利用を記録";
  els.visitDate.value = toISODate(new Date());
  els.visitStore.value = "";
  els.visitMemo.value = "";
  els.recordSaveStatus.textContent = "";
  els.cancelEditBtn.classList.add("hidden");
}

function finishRecord() {
  editingId = null;
  els.entryTitle.textContent = "利用を記録";
  els.visitMemo.value = "";
  els.cancelEditBtn.classList.add("hidden");
}

function deleteVisit(id) {
  const visit = findVisit(id);
  if (!visit) return;
  const ok = window.confirm(`${visit.date} ${visit.store} の履歴を削除しますか？`);
  if (!ok) return;
  state.visits = state.visits.filter((item) => item.id !== id);
  if (editingId === id) clearForm();
  if (historyEditingId === id) cancelHistoryEdit();
  persist();
  render();
}

function getWindowStats(visits, endDate, homeClub) {
  const end = parseISODate(endDate);
  const start = addDays(end, -29);
  const inWindow = visits.filter((visit) => {
    const date = parseISODate(visit.date);
    return date >= start && date <= end;
  });
  const counts = new Map();
  inWindow.forEach((visit) => counts.set(visit.store, (counts.get(visit.store) || 0) + 1));
  const total = inWindow.length;
  const rows = [...counts.entries()]
    .map(([store, count]) => {
      const share = total ? count / total : 0;
      const isHome = store === homeClub;
      const period = getPeriodRisk(visits, endDate, store, homeClub);
      const status = isHome ? "safe" : period.status;
      return {
        store,
        count,
        share,
        isHome,
        status,
        reason:
          status === "danger"
            ? "直近30日とその前30日の両方で条件に到達しています。"
            : status === "warning"
              ? "直近30日単体では条件に近い、または到達しています。前30日も同条件の場合に危険扱いです。"
              : "条件には届いていません。",
      };
    })
    .sort((a, b) => b.count - a.count || a.store.localeCompare(b.store, "ja"));

  return { start: toISODate(start), end: toISODate(end), total, rows, visits: inWindow };
}

function simulateSingleVisit(date, store) {
  const visits = [...state.visits, makeSyntheticVisit(date, store)];
  return getRiskResultForVisits(visits, date, store, "追加後");
}

function getRiskResultForVisits(visits, date, store, prefix) {
  const stats = getWindowStats(visits, date, state.homeClub);
  const row = stats.rows.find((item) => item.store === store);
  const period = getPeriodRisk(visits, date, store, state.homeClub);

  if (store === state.homeClub) {
    return {
      status: "safe",
      label: "安全",
      message: `${prefix}の直近30日は合計${stats.total}回です。ホーム店舗利用のため非ホーム同一店舗51%条件には該当しません。`,
    };
  }

  if (period.status === "danger") {
    return {
      status: "danger",
      label: "危険",
      message: `${prefix}、直近30日は${row.count}/${stats.total}回（${formatPercent(row.share)}）です。その前30日も同じ店舗で条件に到達しているため、連続条件に該当します。`,
    };
  }

  if (period.status === "warning") {
    return {
      status: "warning",
      label: "要注意",
      message: `${prefix}の直近30日は${row?.count || 0}/${stats.total}回（${formatPercent(row?.share || 0)}）です。直近30日単体では条件に近い、または到達していますが、その前30日が同条件でなければ危険扱いにはしません。`,
    };
  }

  return {
    status: "safe",
    label: "低リスク",
    message: `${prefix}の直近30日は${row?.count || 0}/${stats.total}回（${formatPercent(row?.share || 0)}）です。現時点では51%条件に届きません。`,
  };
}

function visitsUntilDanger(store, baseDate) {
  if (!store || store === state.homeClub) return null;
  for (let count = 0; count <= 10; count += 1) {
    const synthetic = Array.from({ length: count }, (_, index) => makeSyntheticVisit(addDays(parseISODate(baseDate), index), store));
    const checkDate = toISODate(addDays(parseISODate(baseDate), Math.max(count - 1, 0)));
    const period = getPeriodRisk([...state.visits, ...synthetic], checkDate, store, state.homeClub);
    if (period.status === "danger") return count;
  }
  return null;
}

function getPeriodRisk(visits, endDate, store, homeClub) {
  if (!store || store === homeClub) {
    return { status: "safe", current: null, previous: null };
  }

  const current = getStoreWindowMetrics(visits, endDate, store);
  const previousEnd = toISODate(addDays(parseISODate(endDate), -30));
  const previous = getStoreWindowMetrics(visits, previousEnd, store);
  const currentRisk = isPeriodRisk(current);
  const previousRisk = isPeriodRisk(previous);

  if (currentRisk && previousRisk) {
    return { status: "danger", current, previous };
  }
  if (currentRisk || isPeriodWarning(current)) {
    return { status: "warning", current, previous };
  }
  return { status: "safe", current, previous };
}

function getStoreWindowMetrics(visits, endDate, store) {
  const end = parseISODate(endDate);
  const start = addDays(end, -29);
  const inWindow = visits.filter((visit) => {
    const date = parseISODate(visit.date);
    return date >= start && date <= end;
  });
  const count = inWindow.filter((visit) => visit.store === store).length;
  const total = inWindow.length;
  return {
    start: toISODate(start),
    end: toISODate(end),
    count,
    total,
    share: total ? count / total : 0,
  };
}

function isPeriodRisk(metrics) {
  return metrics.total >= 4 && metrics.count >= 4 && metrics.share >= RISK_SHARE;
}

function isPeriodWarning(metrics) {
  return metrics.total >= 4 && metrics.count >= 3 && metrics.share >= WARNING_SHARE;
}

function getMajorAwayStores() {
  const stats = getWindowStats(state.visits, toISODate(new Date()), state.homeClub);
  const stores = stats.rows.filter((row) => !row.isHome).map((row) => row.store);
  return stores.length ? stores : getKnownStores().filter((store) => store !== state.homeClub);
}

function getDayRiskDetails(date, stores) {
  const warningStores = [];
  for (const store of stores) {
    const visits = [...state.visits, makeSyntheticVisit(date, store)];
    const period = getPeriodRisk(visits, date, store, state.homeClub);
    if (period.status === "danger") return { status: "danger", stores: [store] };
    if (isPeriodRisk(period.current)) warningStores.push(store);
  }
  return warningStores.length ? { status: "warning", stores: warningStores } : { status: "safe", stores: [] };
}

function getKnownStores() {
  return [...new Set([state.homeClub, ...state.visits.map((visit) => visit.store)].filter(Boolean))]
    .map(normalizeStore)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function getMonthlyGoal() {
  return state.monthlyGoal || DEFAULT_MONTHLY_GOAL;
}

function countVisitsInMonth(monthKey) {
  return state.visits.filter((visit) => visit.date.startsWith(`${monthKey}-`)).length;
}

function getMonthlyCostRows(currentMonthKey) {
  const months = new Set([currentMonthKey]);
  state.visits.forEach((visit) => {
    if (visit.date) months.add(visit.date.slice(0, 7));
  });

  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => ({
      month,
      count: countVisitsInMonth(month),
    }));
}

function costPerVisit(count) {
  return Math.round(MONTHLY_FEE_YEN / count);
}

function bindStoreAutocomplete(input, list, onPick) {
  const open = () => renderComboOptions(input, list);
  input.addEventListener("input", open);
  input.addEventListener("focus", open);
  input.addEventListener("blur", () => {
    window.setTimeout(() => list.classList.add("hidden"), 140);
  });
  list.addEventListener("mousedown", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    event.preventDefault();
    input.value = button.dataset.value;
    list.classList.add("hidden");
    if (onPick) onPick();
  });
}

function renderComboOptions(input, list) {
  const query = normalizeStore(input.value).toLowerCase();
  const stores = getKnownStores().filter((store) => store.toLowerCase().includes(query));
  if (!stores.length) {
    list.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  list.innerHTML = stores
    .slice(0, 8)
    .map((store) => `<button type="button" class="combo-option" data-value="${escapeHTML(store)}">${escapeHTML(store)}</button>`)
    .join("");
  list.classList.remove("hidden");
}

function closeAllSuggestions() {
  [els.homeClubSuggestions, els.visitStoreSuggestions, els.riskStoreSuggestions, els.simStoreSuggestions, els.historyEditStoreSuggestions].forEach((list) => {
    list.classList.add("hidden");
  });
}

function setActiveTab(tab) {
  activeTab = tab || "overview";
  els.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });
  els.tabSections.forEach((section) => {
    section.classList.toggle("tab-hidden", section.dataset.tabSection !== activeTab);
  });
}

function formatRemainingText(remaining) {
  if (remaining === null) {
    return "現在の31〜60日前の履歴では、同じ店舗を追加しても直ちに連続条件にはなりません。";
  }
  if (remaining === 0) {
    return "現状ですでに連続条件に到達しています。";
  }
  return `現状から連続条件まであと ${remaining} 回です。`;
}

function makeSyntheticVisit(date, store) {
  return {
    id: `sim-${date}-${store}-${Math.random()}`,
    date: typeof date === "string" ? date : toISODate(date),
    store,
    memo: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function findVisit(id) {
  return state.visits.find((visit) => visit.id === id);
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const monthlyGoal = Number.parseInt(parsed.monthlyGoal, 10);
    return {
      homeClub: parsed.homeClub || "",
      visits: Array.isArray(parsed.visits) ? parsed.visits.filter((visit) => visit.date && visit.store) : [],
      monthlyGoal: Number.isFinite(monthlyGoal) && monthlyGoal > 0 ? monthlyGoal : DEFAULT_MONTHLY_GOAL,
    };
  } catch {
    return { homeClub: "", visits: [], monthlyGoal: DEFAULT_MONTHLY_GOAL };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeStore(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatJPDate(value) {
  const date = typeof value === "string" ? parseISODate(value) : value;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year}年${month}月`;
}

function formatShortDate(value) {
  const date = parseISODate(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatYen(value) {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
