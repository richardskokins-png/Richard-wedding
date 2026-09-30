import {
  PEOPLE,
  SALESPEOPLE,
  RuleError,
  calculateCommission,
  calculateSummary,
  centsToEuro,
  employeeById,
  requireRole,
  validateExpenseInput,
  validateSaleInput
} from "./business.mjs";
import { referenceState } from "./fixtures.mjs";
import { SUBMISSION } from "./submission.mjs";

const DEMO_STORAGE_KEY = "friends-included-reference-state-v2";
const roleSelect = document.querySelector("#role-select");
const toastElement = document.querySelector("#toast");
let currentView = "overview";
let recordFilter = "all";
let config = {
  backendConfigured: false,
  sheetsConfigured: false,
  telegramConfigured: false,
  telegramBotUsername: "",
  studentName: "",
  githubUrl: "",
  sheetsUrl: "",
  appUrl: "",
  ...SUBMISSION
};
let state = loadReferenceState();
let resetBackup = null;
const reviewRef = Date.now().toString(36).toUpperCase();

function loadReferenceState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY));
    if (saved?.sales && saved?.expenses) {
      for (const record of [...saved.sales, ...saved.expenses]) { record.sync_status = "reference"; record.notification_status = "reference"; }
      return { ...saved, mode: "reference", summary: calculateSummary(saved.sales, saved.expenses) };
    }
  } catch {}
  return referenceState();
}

function saveReferenceState() {
  if (state.mode !== "reference") return;
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ sales: state.sales, expenses: state.expenses }));
}

function money(cents) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(centsToEuro(cents));
}

function shortMoney(cents) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(centsToEuro(cents));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function personName(id, short = false) {
  const person = employeeById(id);
  if (!person) return id || "—";
  if (!short) return person.name;
  return id === "jean-claude" ? "Jean-Claude" : person.name.split(/[ “]/)[0];
}

function currentEmployee() {
  return employeeById(roleSelect.value) || PEOPLE[0];
}

function isManager() {
  return currentEmployee().role === "manager";
}

function visibleRecords() {
  const employee = currentEmployee();
  if (employee.role === "manager") return { sales: state.sales, expenses: state.expenses };
  return {
    sales: state.sales.filter((sale) => sale.salesperson_id === employee.id),
    expenses: state.expenses.filter((expense) => expense.reporter_id === employee.id)
  };
}

function showToast(message, error = false) {
  toastElement.textContent = message;
  toastElement.className = `toast show${error ? " error" : ""}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toastElement.className = "toast"; }, 3800);
}

function showNotice(message = "") {
  const notice = document.querySelector("#notice");
  notice.hidden = !message;
  notice.textContent = message;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new RuleError(data.error || "Request failed.", data.code || "REQUEST_FAILED", response.status);
    throw error;
  }
  return data;
}

async function loadConfig() {
  try {
    config = { ...config, ...(await api("/api/config")) };
  } catch {}
  document.querySelector("#student-name").textContent = config.studentName || "Student name not configured";
}

async function loadLiveState() {
  if (!config.backendConfigured) {
    state = loadReferenceState();
    showNotice("Public homework demo: fictional data is saved only in this browser. Live Telegram and Sheets synchronization are pending. Open Reviewer guide for the test steps and Viewer ledger.");
    return;
  }
  state = await api(`/api/state?role=${encodeURIComponent(roleSelect.value)}`);
  showNotice("");
}

function populateRoles() {
  roleSelect.innerHTML = PEOPLE.map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join("");
  const savedRole = localStorage.getItem("friends-included-role");
  roleSelect.value = PEOPLE.some((person) => person.id === savedRole) ? savedRole : "svetlana";
  document.querySelector("#telegram-employee").innerHTML = PEOPLE.filter(person => person.role !== "manager").map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join("");
}

function goTo(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active", element.id === `view-${view}`));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelector("#main-content").focus({ preventScroll: true });
  window.location.hash = view;
}

function kpi(label, value, foot, tone) {
  return `<article class="kpi" style="--tone:${tone}"><div class="kpi-label"><span>${label}</span></div><div class="kpi-value">${value}</div><div class="kpi-foot">${foot}</div></article>`;
}

function renderOverview() {
  const employee = currentEmployee();
  const records = visibleRecords();
  document.querySelector("#updated-at").textContent = state.mode === "live" ? "Live Supabase data" : "Reference scenario · local preview";
  if (employee.role !== "manager") {
    const own = [...records.sales.map((record) => ({ ...record, kind: "sale" })), ...records.expenses.map((record) => ({ ...record, kind: "expense" }))];
    const pending = own.filter((record) => ["pending", "awaiting_allocation"].includes(record.status)).length;
    const issues = own.filter((record) => record.sync_status === "failed" || record.notification_status === "failed").length;
    document.querySelector("#kpi-grid").innerHTML = [
      kpi("My submissions", own.length, "Filtered by the selected fictional role", "var(--blue)"),
      kpi("Awaiting decision", pending, "Still open", "var(--amber)"),
      kpi("Delivery issues", issues, issues ? "Svetlana can retry" : "No failed syncs", "var(--coral)"),
      kpi("My reported value", shortMoney(own.reduce((sum, record) => sum + record.amount_cents, 0)), "Submission value, not financial result", "var(--teal)")
    ].join("");
    document.querySelector("#project-results").innerHTML = `<div class="empty-state">Company and project financial results are available only to Svetlana.</div>`;
    document.querySelector("#commission-list").innerHTML = `<div class="empty-state">Team commission totals are manager-only.</div>`;
    document.querySelector("#attention-list").innerHTML = recentRows(own.slice(0, 4), "No submissions yet.");
    return;
  }

  const summary = state.summary || calculateSummary(state.sales, state.expenses);
  document.querySelector("#kpi-grid").innerHTML = [
    kpi("Company result", money(summary.company.resultCents), `${money(summary.company.approvedIncomeCents)} approved income`, "var(--teal)"),
    kpi("Approved sales", money(summary.company.approvedIncomeCents), `${money(summary.company.commissionCents)} commission expense`, "var(--blue)"),
    kpi("Recorded expenses", money(summary.company.recordedExpensesCents), `${money(summary.company.overheadCents)} overhead`, "var(--coral)"),
    kpi("Awaiting allocation", money(summary.company.awaitingAllocationCents), `${summary.pendingSales} pending sale${summary.pendingSales === 1 ? "" : "s"}`, "var(--amber)")
  ].join("");

  document.querySelector("#project-results").innerHTML = `<table class="result-table"><thead><tr><th>Package</th><th>Income</th><th>Commission</th><th>Expenses</th><th>Result</th></tr></thead><tbody>
    ${["A", "B"].map((project) => `<tr><td><span class="package-name"><strong>Project ${project}</strong><span>${project === "A" ? "Respectable Relatives" : "Drunk University Friends"}</span></span></td><td>${money(summary.projects[project].incomeCents)}</td><td>${money(summary.projects[project].commissionCents)}</td><td>${money(summary.projects[project].expenseCents)}</td><td>${money(summary.projects[project].resultCents)}</td></tr>`).join("")}
    <tr><td>Combined projects</td><td>${money(summary.projects.A.incomeCents + summary.projects.B.incomeCents)}</td><td>${money(summary.projects.A.commissionCents + summary.projects.B.commissionCents)}</td><td>${money(summary.projects.A.expenseCents + summary.projects.B.expenseCents)}</td><td>${money(summary.projects.A.resultCents + summary.projects.B.resultCents)}</td></tr>
  </tbody></table>`;

  const maxCommission = Math.max(...Object.values(summary.commissionByPerson), 1);
  const tones = { richard: "var(--blue)", anastasia: "var(--coral)", "jean-claude": "var(--teal)" };
  document.querySelector("#commission-list").innerHTML = SALESPEOPLE.map((person) => `<div class="commission-person"><strong>${personName(person, true)}</strong><b>${money(summary.commissionByPerson[person])}</b><div class="commission-track"><span style="width:${summary.commissionByPerson[person] / maxCommission * 100}%;--tone:${tones[person]}"></span></div></div>`).join("");
  const pending = [
    ...state.sales.filter((sale) => sale.status === "pending").map((record) => ({ ...record, kind: "sale" })),
    ...state.expenses.filter((expense) => expense.status === "awaiting_allocation").map((record) => ({ ...record, kind: "expense" }))
  ];
  document.querySelector("#attention-list").innerHTML = recentRows(pending, "Nothing is waiting for a decision.");
}

function recentRows(records, emptyMessage) {
  if (!records.length) return `<div class="empty-state">${emptyMessage}</div>`;
  return records.map((record) => `<div class="attention-row"><span class="ref-badge">${escapeHtml(record.ref)}</span><div><strong>${record.kind === "sale" ? escapeHtml(record.customer) : escapeHtml(record.description)}</strong><p>${record.kind === "sale" ? `Project ${record.project} · ${personName(record.salesperson_id, true)}` : `${escapeHtml(record.proposed_allocation)} · ${personName(record.reporter_id, true)}`}</p></div><span class="amount">${money(record.amount_cents)}</span><span class="status">${escapeHtml(record.status.replaceAll("_", " "))}</span></div>`).join("");
}

function renderSubmit() {
  const employee = currentEmployee();
  const saleForm = document.querySelector("#sale-form");
  const expenseForm = document.querySelector("#expense-form");
  const locked = document.querySelector("#locked-submit");
  saleForm.hidden = employee.role !== "salesperson";
  expenseForm.hidden = employee.role !== "expense_reporter";
  locked.hidden = employee.role !== "manager";
  document.querySelector("#submit-role-copy").textContent = employee.role === "salesperson" ? `Submitting as ${personName(employee.id, true)}. Your identity is attached automatically.` : employee.role === "expense_reporter" ? "Submitting as Kevin. Your identity is attached automatically." : "Svetlana reviews decisions; routine entry belongs to the team.";
}

function renderDecisions() {
  const list = document.querySelector("#decision-list");
  if (!isManager()) {
    list.innerHTML = `<section class="panel denied-card"><p class="eyebrow">ACCESS DENIED</p><h2>Only Svetlana can approve or correct transactions.</h2><p>This restriction is also enforced by the server.</p></section>`;
    return;
  }
  const pendingSales = state.sales.filter((sale) => sale.status === "pending");
  const pendingExpenses = state.expenses.filter((expense) => expense.status === "awaiting_allocation");
  if (!pendingSales.length && !pendingExpenses.length) {
    list.innerHTML = `<section class="panel empty-state">No pending sales or expense allocations.</section>`;
    return;
  }
  list.innerHTML = [
    ...pendingSales.map((sale) => `<article class="panel decision-card"><span class="ref-badge">${sale.ref}</span><div><h2>${escapeHtml(sale.customer)} · Project ${sale.project}</h2><p>${escapeHtml(sale.description)}</p><div class="proposal">Proposed: ${shareText(sale.proposed_shares)} · ${money(sale.amount_cents)}</div></div><form class="decision-actions sale-decision" data-ref="${sale.ref}"><div class="split-grid"><label>Richard %<input name="richard" type="number" min="0" max="100" value="${sale.proposed_shares.richard}"></label><label>Anastasia %<input name="anastasia" type="number" min="0" max="100" value="${sale.proposed_shares.anastasia}"></label><label>Jean-Claude %<input name="jean-claude" type="number" min="0" max="100" value="${sale.proposed_shares["jean-claude"]}"></label></div><button class="primary-button" type="submit">Approve sale and split</button></form></article>`),
    ...pendingExpenses.map((expense) => `<article class="panel decision-card"><span class="ref-badge">${expense.ref}</span><div><h2>${money(expense.amount_cents)} · ${escapeHtml(expense.category)}</h2><p>${escapeHtml(expense.description)}</p><div class="proposal">Proposed allocation: ${escapeHtml(expense.proposed_allocation)}</div></div><form class="decision-actions expense-decision" data-ref="${expense.ref}"><label>Final allocation<select name="finalAllocation"><option value="A" ${expense.proposed_allocation === "A" ? "selected" : ""}>A · Respectable Relatives</option><option value="B" ${expense.proposed_allocation === "B" ? "selected" : ""}>B · Drunk University Friends</option><option ${expense.proposed_allocation === "Company overhead" ? "selected" : ""}>Company overhead</option></select></label><button class="primary-button" type="submit">Confirm allocation</button></form></article>`)
  ].join("");
}

function shareText(shares) {
  if (!shares) return "Not approved";
  return `${shares.richard}% / ${shares.anastasia}% / ${shares["jean-claude"]}%`;
}

function renderRecords() {
  const records = visibleRecords();
  const combined = [
    ...records.sales.map((record) => ({ ...record, kind: "sale" })),
    ...records.expenses.map((record) => ({ ...record, kind: "expense" }))
  ].filter((record) => recordFilter === "all" || record.kind === recordFilter)
    .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)) || b.ref.localeCompare(a.ref));
  document.querySelector("#records-body").innerHTML = combined.length ? combined.map(recordRow).join("") : `<tr><td colspan="8" class="empty-state">No records match this view.</td></tr>`;
}

function recordRow(record) {
  const owner = record.kind === "sale" ? personName(record.salesperson_id, true) : personName(record.reporter_id, true);
  const details = record.kind === "sale" ? `<strong>${escapeHtml(record.customer)}</strong><span>${escapeHtml(record.description)} · Project ${record.project}</span>` : `<strong>${escapeHtml(record.category)}</strong><span>${escapeHtml(record.description)}</span>`;
  const decision = record.kind === "sale" ? `${shareText(record.proposed_shares)} → ${shareText(record.final_shares)}` : `${escapeHtml(record.proposed_allocation)} → ${escapeHtml(record.final_allocation || "Awaiting decision")}`;
  const syncFailed = record.sync_status === "failed";
  const notifyFailed = record.notification_status === "failed";
  const retry = isManager() ? `${syncFailed ? `<button class="retry-link" data-retry="sheets" data-type="${record.kind}" data-ref="${record.ref}">Retry Sheets</button>` : ""}${notifyFailed ? `<button class="retry-link" data-retry="telegram" data-type="${record.kind}" data-ref="${record.ref}">Retry Telegram</button>` : ""}` : "";
  return `<tr><td><span class="ref-badge">${record.ref}</span></td><td>${record.kind === "sale" ? "Sale" : "Expense"}</td><td>${escapeHtml(owner)}</td><td class="record-detail">${details}</td><td class="amount">${money(record.amount_cents)}</td><td>${decision}</td><td><span class="status">${escapeHtml(record.status.replaceAll("_", " "))}</span></td><td><div class="delivery"><span class="${syncFailed ? "failed" : ""}">Sheets: ${escapeHtml(record.sync_status || "pending")}</span><span class="${notifyFailed ? "failed" : ""}">Telegram: ${escapeHtml(record.notification_status || "not required")}</span>${retry}</div></td></tr>`;
}

function renderSetup() {
  const manager = isManager();
  document.querySelector("#telegram-link-form").hidden = !manager;
  document.querySelector("#webhook-form").hidden = !manager;
  const statuses = [
    ["Supabase source of truth", config.backendConfigured],
    ["Google Sheets synchronization", config.sheetsConfigured],
    ["Telegram bot and notifications", config.telegramConfigured],
    ["Vercel public URL", Boolean(config.appUrl)]
  ];
  document.querySelector("#service-status").innerHTML = statuses.map(([label, ok]) => `<div class="service-row"><span>${label}</span><b class="${ok ? "ok" : ""}">${ok ? "Configured" : "Not configured"}</b></div>`).join("");
  document.querySelector("#telegram-link-form button").disabled = state.mode !== "live" || !config.telegramConfigured;
  document.querySelector("#webhook-form button").disabled = state.mode !== "live" || !config.telegramConfigured;
  const links = [
    ["Telegram bot", config.telegramBotUsername ? `https://t.me/${config.telegramBotUsername.replace(/^@/, "")}` : ""],
    ["Google Sheets", config.sheetsUrl],
    ["GitHub repository", config.githubUrl],
    ["Vercel application", config.appUrl]
  ];
  document.querySelector("#submission-links").innerHTML = links.map(([label, url]) => `<div class="link-item"><span>${label}</span>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open ↗</a>` : `<strong>Not set</strong>`}</div>`).join("");
  const webhookInput = document.querySelector("#webhook-form input[name=appUrl]");
  if (config.appUrl && !webhookInput.value) webhookInput.value = config.appUrl;
}

function renderChrome() {
  const manager = isManager();
  const pendingCount = manager ? state.sales.filter((sale) => sale.status === "pending").length + state.expenses.filter((expense) => expense.status === "awaiting_allocation").length : 0;
  document.querySelector("#decision-count").textContent = pendingCount;
  document.querySelector('[data-view="decisions"]').disabled = false;
  document.querySelector('[data-view="setup"]').disabled = false;
  const pill = document.querySelector("#connection-pill");
  pill.classList.toggle("live", state.mode === "live");
  pill.lastChild.textContent = state.mode === "live" ? (config.telegramConfigured && config.sheetsConfigured ? " Live test data" : " Live database · setup incomplete") : " Reference mode";
}

function renderReview() {
  document.querySelector("#review-ledger").href = config.sheetsUrl;
  document.querySelector("#review-mode").textContent = state.mode === "live" ? "Transactions are saved on the homework server. Check delivery status separately in Records." : "Reference mode is available now. You can test entry, approvals, allocations, and totals with fictional data. Live Telegram delivery and automatic Sheets updates are pending owner setup.";
  document.querySelector("#review-bot-status").textContent = config.telegramConfigured && state.mode === "live" ? "The bot settings are configured. Follow these steps to test the real connection." : "Pending: the owner has not connected a live bot and database. The instructions below explain the future test; Telegram linking is currently disabled.";
  document.querySelector("#review-sale-command").textContent = `/sale RV-S-${reviewRef} | Alex Example | A | Fictional reviewer sale | 100 | 50/30/20`;
  document.querySelector("#review-expense-command").textContent = `/expense RV-E-${reviewRef} | Fictional reviewer expense | Other | 10 | Company overhead`;
  document.querySelector("#reset-demo").disabled = state.mode !== "reference" || config.backendConfigured;
  document.querySelector("#undo-reset").hidden = !resetBackup;
  document.querySelector("#reset-note").textContent = state.mode === "reference" ? "Reset restores the original fictional figures in this browser. It does not change Google Sheets or server data. You can undo the most recent reset until you reload." : "Reset is available only for the browser demo. Live records are preserved.";
}

function render() {
  if (isManager() && state.mode === "reference") state.summary = calculateSummary(state.sales, state.expenses);
  renderChrome();
  renderOverview();
  renderSubmit();
  renderDecisions();
  renderRecords();
  renderSetup();
  renderReview();
}

async function submitTransaction(type, input) {
  if (config.backendConfigured && state.mode !== "live") throw new RuleError("The live database is unavailable. Refresh before submitting; no local replacement was saved.");
  const employee = currentEmployee();
  if (state.mode === "live") {
    const result = await api("/api/transaction", { method: "POST", body: JSON.stringify({ type, roleId: employee.id, ...input }) });
    await loadLiveState();
    render();
    return result.record;
  }
  if ([...state.sales, ...state.expenses].some((record) => record.ref === String(input.ref).trim().toUpperCase())) throw new RuleError("That reference already exists.", "DUPLICATE_REFERENCE", 409);
  if (type === "sale") {
    const sale = validateSaleInput(input, employee);
    const record = { ref: sale.ref, salesperson_id: employee.id, customer: sale.customer, project: sale.project, description: sale.description, amount_cents: sale.amountCents, proposed_shares: sale.proposedShares, final_shares: null, commission_pool_cents: 0, commission_richard_cents: 0, commission_anastasia_cents: 0, commission_jean_claude_cents: 0, status: "pending", origin: "website", submitted_at: new Date().toISOString(), sync_status: "reference", notification_status: "not_required" };
    state.sales.unshift(record);
    saveReferenceState();
    render();
    return record;
  }
  const expense = validateExpenseInput(input, employee);
  const record = { ref: expense.ref, reporter_id: employee.id, description: expense.description, category: expense.category, amount_cents: expense.amountCents, proposed_allocation: expense.proposedAllocation, final_allocation: expense.finalAllocation, status: expense.status, origin: "website", submitted_at: new Date().toISOString(), sync_status: "reference", notification_status: "not_required" };
  state.expenses.unshift(record);
  saveReferenceState();
  render();
  return record;
}

async function decide(type, ref, decision) {
  if (config.backendConfigured && state.mode !== "live") throw new RuleError("The live database is unavailable. Refresh before deciding; no local replacement was saved.");
  const manager = currentEmployee();
  requireRole(manager, ["manager"], "approve or allocate transactions");
  if (state.mode === "live") {
    await api("/api/decision", { method: "POST", body: JSON.stringify({ type, roleId: manager.id, ref, ...decision }) });
    await loadLiveState();
    render();
    return;
  }
  if (type === "sale") {
    const sale = state.sales.find((item) => item.ref === ref);
    if (!sale) throw new RuleError("Sale not found.", "NOT_FOUND", 404);
    if (sale.status === "approved") return;
    const commission = calculateCommission(sale.amount_cents, decision.finalShares);
    Object.assign(sale, { final_shares: commission.shares, commission_pool_cents: commission.poolCents, commission_richard_cents: commission.earned.richard, commission_anastasia_cents: commission.earned.anastasia, commission_jean_claude_cents: commission.earned["jean-claude"], status: "approved", approved_at: new Date().toISOString(), approved_by: manager.id, notification_status: "reference" });
  } else {
    const expense = state.expenses.find((item) => item.ref === ref);
    if (!expense) throw new RuleError("Expense not found.", "NOT_FOUND", 404);
    if (expense.status === "allocated") return;
    if (!["A", "B", "Company overhead"].includes(decision.finalAllocation)) throw new RuleError("Choose a valid allocation.");
    Object.assign(expense, { final_allocation: decision.finalAllocation, status: "allocated", allocated_at: new Date().toISOString(), allocated_by: manager.id, notification_status: "reference" });
  }
  saveReferenceState();
  render();
}

function bindEvents() {
  window.addEventListener("hashchange", () => {
    const view = window.location.hash.slice(1);
    if (["overview", "submit", "decisions", "records", "setup", "review"].includes(view)) goTo(view);
  });
  for (const type of ["sale", "expense"]) document.querySelector(`#review-${type}`).addEventListener("click", async () => {
    roleSelect.value = type === "sale" ? "richard" : "kevin";
    localStorage.setItem("friends-included-role", roleSelect.value);
    try {
      await loadLiveState(); render(); goTo("submit");
      const form = document.querySelector(`#${type}-form`);
      const values = type === "sale" ? { ref: `RV-W-${Date.now().toString(36).toUpperCase()}`, customer: "Alex Example", project: "A", description: "Fictional reviewer sale", amount: "100", richard: "50", anastasia: "30", "jean-claude": "20" } : { ref: `RV-X-${Date.now().toString(36).toUpperCase()}`, description: "Fictional reviewer expense", category: "Other", amount: "10", proposedAllocation: "Company overhead" };
      for (const [key, value] of Object.entries(values)) form.elements.namedItem(key).value = value;
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelector("#reset-demo").addEventListener("click", () => {
    if (state.mode !== "reference" || config.backendConfigured) return;
    resetBackup = structuredClone(state); state = referenceState(); saveReferenceState(); render(); showToast("This browser’s demo is reset. Undo is available in Reviewer guide.");
  });
  document.querySelector("#undo-reset").addEventListener("click", () => {
    if (!resetBackup || state.mode !== "reference" || config.backendConfigured) return;
    state = resetBackup; resetBackup = null; saveReferenceState(); render(); showToast("Your previous demo entries were restored.");
  });
  document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => goTo(button.dataset.view)));
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => goTo(button.dataset.go)));
  roleSelect.addEventListener("change", async () => {
    localStorage.setItem("friends-included-role", roleSelect.value);
    try { await loadLiveState(); render(); } catch (error) { showToast(error.message, true); }
  });
  document.querySelectorAll("[data-record-filter]").forEach((button) => button.addEventListener("click", () => {
    recordFilter = button.dataset.recordFilter;
    document.querySelectorAll("[data-record-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderRecords();
  }));
  document.querySelector("#sale-form").addEventListener("input", (event) => {
    if (!["richard", "anastasia", "jean-claude"].includes(event.target.name)) return;
    const form = new FormData(event.currentTarget);
    const total = ["richard", "anastasia", "jean-claude"].reduce((sum, name) => sum + Number(form.get(name) || 0), 0);
    const output = document.querySelector("#split-total");
    output.textContent = `${total}%`;
    output.style.color = Math.abs(total - 100) < .000001 ? "var(--teal)" : "var(--danger)";
  });
  document.querySelector("#sale-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const record = await submitTransaction("sale", { ref: form.get("ref"), customer: form.get("customer"), project: form.get("project"), description: form.get("description"), amount: form.get("amount"), proposedShares: { richard: Number(form.get("richard")), anastasia: Number(form.get("anastasia")), "jean-claude": Number(form.get("jean-claude")) } });
      formElement.reset();
      document.querySelector("#split-total").textContent = "100%";
      showToast(`${record.ref} saved pending approval.`);
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelector("#expense-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const record = await submitTransaction("expense", Object.fromEntries(form));
      formElement.reset();
      showToast(`${record.ref} recorded.`);
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelector("#decision-list").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      if (event.target.classList.contains("sale-decision")) await decide("sale", event.target.dataset.ref, { finalShares: { richard: Number(form.get("richard")), anastasia: Number(form.get("anastasia")), "jean-claude": Number(form.get("jean-claude")) } });
      else await decide("expense", event.target.dataset.ref, { finalAllocation: form.get("finalAllocation") });
      showToast(`${event.target.dataset.ref} updated without duplicating the record.`);
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelector("#records-body").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-retry]");
    if (!button) return;
    try {
      await api("/api/retry", { method: "POST", body: JSON.stringify({ roleId: roleSelect.value, type: button.dataset.type, ref: button.dataset.ref, target: button.dataset.retry }) });
      await loadLiveState(); render(); showToast(`${button.dataset.ref} retry completed.`);
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelector("#telegram-link-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api("/api/link-telegram", { method: "POST", body: JSON.stringify({ roleId: roleSelect.value, ...values }) });
      const output = document.querySelector("#telegram-pairing");
      output.replaceChildren(document.createTextNode(`${result.message} `));
      const link = document.createElement("a"); link.href = result.url; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = "Open my Telegram linking chat →"; output.append(link);
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelector("#webhook-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { const result = await api("/api/setup-webhook", { method: "POST", body: JSON.stringify({ roleId: roleSelect.value, ...values }) }); showToast(result.message); } catch (error) { showToast(error.message, true); }
  });
}

function registerWebMcp() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const tools = [
    {
      name: "read_financial_summary",
      title: "Read financial summary",
      description: "Read the currently visible company and project results when acting as Svetlana.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async () => {
        requireRole(currentEmployee(), ["manager"], "view financial results");
        const summary = state.summary || calculateSummary(state.sales, state.expenses);
        return { companyResultCents: summary.company.resultCents, projects: summary.projects, commissionByPerson: summary.commissionByPerson, pendingSales: summary.pendingSales, pendingExpenses: summary.pendingExpenses };
      }
    },
    {
      name: "submit_sale",
      title: "Submit sale",
      description: "Submit one sale using the selected salesperson role and update the visible records.",
      inputSchema: { type: "object", properties: { ref: { type: "string" }, customer: { type: "string" }, project: { type: "string", enum: ["A", "B"] }, description: { type: "string" }, amount: { type: "number", exclusiveMinimum: 0 }, richardPct: { type: "number", minimum: 0, maximum: 100 }, anastasiaPct: { type: "number", minimum: 0, maximum: 100 }, jeanClaudePct: { type: "number", minimum: 0, maximum: 100 } }, required: ["ref", "customer", "project", "description", "amount", "richardPct", "anastasiaPct", "jeanClaudePct"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const record = await submitTransaction("sale", { ...input, proposedShares: { richard: input.richardPct, anastasia: input.anastasiaPct, "jean-claude": input.jeanClaudePct } });
        return { ref: record.ref, status: record.status };
      }
    },
    {
      name: "submit_expense",
      title: "Submit expense",
      description: "Submit one expense using Kevin's selected role and update the visible records.",
      inputSchema: { type: "object", properties: { ref: { type: "string" }, description: { type: "string" }, category: { type: "string", enum: ["Materials", "Travel", "Other"] }, amount: { type: "number", exclusiveMinimum: 0 }, proposedAllocation: { type: "string", enum: ["A", "B", "Company overhead"] } }, required: ["ref", "description", "category", "amount", "proposedAllocation"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => { const record = await submitTransaction("expense", input); return { ref: record.ref, status: record.status }; }
    }
  ];
  const lifecycle = new AbortController();
  for (const tool of tools) Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
}

async function init() {
  populateRoles();
  bindEvents();
  await loadConfig();
  try { await loadLiveState(); } catch (error) { state = loadReferenceState(); showNotice(`Live data could not be loaded: ${error.message} Reference mode is shown instead.`); }
  const hash = window.location.hash.replace("#", "");
  if (["overview", "submit", "decisions", "records", "setup", "review"].includes(hash)) goTo(hash);
  else if (window.location.pathname.replace(/\/$/, "") === "/test") goTo("review");
  render();
  registerWebMcp();
}

init();
