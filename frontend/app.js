const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const STATUSES = ["TODO", "DOING", "DONE"];
const STATUS_LABELS = { TODO: "할 일", DOING: "진행 중", DONE: "완료" };
const PRIORITIES = ["HIGH", "NORMAL", "LOW"];
const PRIORITY_LABELS = { HIGH: "높음", NORMAL: "보통", LOW: "낮음" };

// 화면과 API는 같은 출처(Nginx)에서 제공한다. 로그인 쿠키(HttpOnly)와 서버의 같은 출처 검사 때문에
// 다른 출처의 개발 서버(:5500)에서는 로그인 후 API를 쓸 수 없다.
const API_BASE = "/api";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 20;

const form = document.getElementById("task-form");
const input = document.getElementById("title-input");
const descriptionInput = document.getElementById("description-input");
const priorityInput = document.getElementById("priority-input");
const dueInput = document.getElementById("due-input");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const priorityFilter = document.getElementById("priority-filter");
const sortSelect = document.getElementById("sort-select");
const formPanel = document.getElementById("form-panel");
const formToggle = document.getElementById("form-toggle");
const formToggleLabel = document.getElementById("form-toggle-label");
const listPanel = document.getElementById("list-panel");
const listToggle = document.getElementById("list-toggle");
const listToggleLabel = document.getElementById("list-toggle-label");
const errorMessage = document.getElementById("error-message");
const bootMessage = document.getElementById("boot-message");
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const userBar = document.getElementById("user-bar");
const currentUserLabel = document.getElementById("current-user");
const logoutButton = document.getElementById("logout-button");
const authMessage = document.getElementById("auth-message");
const loginForm = document.getElementById("login-form");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const signupForm = document.getElementById("signup-form");
const signupUsername = document.getElementById("signup-username");
const signupPassword = document.getElementById("signup-password");
const signupPasswordConfirm = document.getElementById("signup-password-confirm");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");

// 서버에서 받은 목록의 사본이다. 저장소는 API 서버이며, 브라우저에는 저장하지 않는다.
const tasks = [];
// "loading": 불러오는 중, "ready": 서버 목록과 일치, "failed": 불러오지 못함
let loadState = "loading";
let editingId = null;
let submitting = false;
// 로그인한 사용자(서버의 /api/auth/me 응답). 로그인하지 않았으면 null이다.
let currentUser = null;
let authBusy = false;

class ApiError extends Error {
  constructor(status, message, retryAfter = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter; // 429일 때 서버가 알려 주는 남은 초
  }
}

function errorTextFor(status) {
  if (status === 401) return "로그인이 필요합니다.";
  if (status === 403) return "요청이 거절되었습니다. 이 화면을 연 주소가 서버와 같은지 확인해 주세요.";
  if (status === 503) return "서버가 데이터베이스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  if (status === 404) return "대상 항목을 찾을 수 없습니다. 목록을 새로 불러왔습니다.";
  if (status === 422) return "서버가 입력값을 받아들이지 않았습니다. 입력 내용을 확인해 주세요.";
  return `서버 오류가 발생했습니다. (${status})`;
}

async function api(method, path, body) {
  let response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError(0, "API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.");
  }
  if (response.status === 204) return null;
  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    // 본문이 JSON이 아니면 상태 코드로만 판단한다.
  }
  if (response.status === 401 && path.startsWith("/tasks")) {
    // 로그인 세션이 만료되었거나 로그아웃된 상태이다. 로그인 화면으로 보낸다.
    sessionExpired();
  }
  if (!response.ok) {
    const seconds = Number(response.headers.get("Retry-After"));
    throw new ApiError(
      response.status,
      errorTextFor(response.status),
      Number.isFinite(seconds) && seconds > 0 ? seconds : null
    );
  }
  return data;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// 로컬 달력 기준 오늘 날짜(YYYY-MM-DD)
function todayString() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function isOverdue(task) {
  return task.due_date !== null && task.status !== "DONE" && task.due_date < todayString();
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}

function validateTitle(raw) {
  const title = raw.trim();
  if (title.length === 0) return { error: "제목을 입력해 주세요." };
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `제목은 ${MAX_TITLE_LENGTH}자 이하로 입력해 주세요.` };
  }
  return { title };
}

// 제목·설명·우선순위·마감일을 검사해 서버로 보낼 값을 돌려준다. (서버도 같은 규칙으로 다시 검사한다.)
function validateFields({ title, description, priority, dueDate }) {
  const titleResult = validateTitle(title);
  if (titleResult.error) return { error: titleResult.error };
  const desc = description.trim();
  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `설명은 ${MAX_DESCRIPTION_LENGTH}자 이하로 입력해 주세요.` };
  }
  if (!PRIORITIES.includes(priority)) return { error: "우선순위를 올바르게 선택해 주세요." };
  if (dueDate !== "" && !isValidDate(dueDate)) {
    return { error: "마감일은 YYYY-MM-DD 형식의 올바른 날짜여야 합니다." };
  }
  return {
    values: {
      title: titleResult.title,
      description: desc,
      priority,
      due_date: dueDate === "" ? null : dueDate,
    },
  };
}

async function loadTasks() {
  loadState = "loading";
  render();
  try {
    const data = await api("GET", "/tasks");
    if (!Array.isArray(data)) throw new ApiError(0, "서버 응답 형식이 올바르지 않습니다.");
    tasks.splice(0, tasks.length, ...data);
    loadState = "ready";
    clearError();
  } catch (e) {
    // 오래된 목록을 보여 주지 않는다.
    tasks.length = 0;
    loadState = "failed";
    showError(e.message);
  }
  render();
}

// 서버 목록을 불러오지 못한 상태에서는 변경하지 않는다. 화면과 서버 목록이 어긋나기 때문이다.
async function ensureReady() {
  if (loadState !== "ready") await loadTasks();
  return loadState === "ready";
}

// API 호출이 필요한 변경을 실행한다. 성공하면 true를 돌려준다.
async function mutate(action, { rerenderOnError = true } = {}) {
  if (!(await ensureReady())) return false;
  try {
    await action();
  } catch (e) {
    if (e.status === 404) {
      editingId = null;
      await loadTasks();
      if (loadState === "ready") showError(e.message);
    } else {
      showError(e.message);
      if (rerenderOnError) render();
    }
    return false;
  }
  clearError();
  render();
  return true;
}

function replaceTask(updated) {
  const index = tasks.findIndex((t) => t.id === updated.id);
  if (index !== -1) tasks[index] = updated;
}

function findTask(id) {
  return tasks.find((t) => t.id === id);
}

function changeStatus(id, status) {
  if (!findTask(id) || !STATUSES.includes(status)) return Promise.resolve(false);
  return mutate(async () => {
    replaceTask(await api("PATCH", `/tasks/${id}`, { status }));
  });
}

function startEdit(id) {
  editingId = id;
  clearError();
  render();
}

function cancelEdit() {
  editingId = null;
  clearError();
  render();
}

async function saveEdit(id, fields) {
  const result = validateFields(fields);
  if (result.error) {
    showError(result.error);
    return false;
  }
  // 실패해도 수정 중인 입력값을 잃지 않도록 화면을 다시 그리지 않는다.
  return mutate(
    async () => {
      replaceTask(await api("PATCH", `/tasks/${id}`, result.values));
      editingId = null;
    },
    { rerenderOnError: false }
  );
}

async function deleteTask(id) {
  const task = findTask(id);
  if (!task) return false;
  // 취소하면 아무것도 바꾸지 않는다.
  if (!confirm(`"${task.title}" 항목을 삭제할까요?`)) return false;
  return mutate(async () => {
    await api("DELETE", `/tasks/${id}`);
    tasks.splice(tasks.findIndex((t) => t.id === id), 1);
    if (editingId === id) editingId = null;
  });
}

function makeButton(label, onClick, type = "button") {
  const button = document.createElement("button");
  button.type = type;
  button.textContent = label;
  if (onClick) button.addEventListener("click", onClick);
  return button;
}

function makeSelect(label, labels, value) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  for (const [optionValue, optionLabel] of Object.entries(labels)) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    select.appendChild(option);
  }
  select.value = value;
  return select;
}

function renderEditRow(li, task) {
  const editForm = document.createElement("form");
  editForm.className = "edit-form";
  const titleEdit = document.createElement("input");
  titleEdit.type = "text";
  titleEdit.value = task.title;
  titleEdit.setAttribute("aria-label", "제목 수정");
  const descEdit = document.createElement("textarea");
  descEdit.rows = 2;
  descEdit.value = task.description;
  descEdit.setAttribute("aria-label", "설명 수정");
  const priorityEdit = makeSelect("우선순위 수정", PRIORITY_LABELS, task.priority);
  const dueEdit = document.createElement("input");
  dueEdit.type = "date";
  dueEdit.value = task.due_date ?? "";
  dueEdit.setAttribute("aria-label", "마감일 수정");
  const buttons = document.createElement("div");
  buttons.className = "edit-buttons";
  buttons.append(makeButton("저장", null, "submit"), makeButton("취소", cancelEdit));
  editForm.append(titleEdit, descEdit, priorityEdit, dueEdit, buttons);
  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    return saveEdit(task.id, {
      title: titleEdit.value,
      description: descEdit.value,
      priority: priorityEdit.value,
      dueDate: dueEdit.value,
    });
  });
  li.appendChild(editForm);
}

function makeBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function renderViewRow(li, task) {
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = task.title; // 글자로만 표시한다.

  const select = makeSelect("상태", STATUS_LABELS, task.status);
  select.addEventListener("change", () => changeStatus(task.id, select.value));

  const actions = document.createElement("span");
  actions.className = "actions";
  actions.append(
    select,
    makeButton("수정", () => startEdit(task.id)),
    makeButton("삭제", () => deleteTask(task.id))
  );

  const main = document.createElement("div");
  main.className = "row-main";
  main.append(title, actions);

  const meta = document.createElement("div");
  meta.className = "row-meta";
  meta.appendChild(makeBadge(`우선순위 ${PRIORITY_LABELS[task.priority]}`, `priority-${task.priority}`));
  if (task.due_date !== null) meta.appendChild(makeBadge(`마감 ${task.due_date}`, "due"));
  if (isOverdue(task)) meta.appendChild(makeBadge("지연", "overdue"));

  li.append(main, meta);
  if (task.description !== "") {
    const description = document.createElement("p");
    description.className = "description";
    description.textContent = task.description; // 글자로만 표시한다.
    li.appendChild(description);
  }
}

// 제목 검색, 상태, 우선순위 조건을 모두 만족하는(AND) 항목만 남긴다.
function visibleTasks() {
  const query = searchInput.value.trim().toLowerCase();
  return tasks.filter(
    (task) =>
      (query === "" || task.title.toLowerCase().includes(query)) &&
      (statusFilter.value === "" || task.status === statusFilter.value) &&
      (priorityFilter.value === "" || task.priority === priorityFilter.value)
  );
}

// 정렬 기준이 같으면 등록 순서(id)를 따른다. 마감일이 없는 항목은 마지막이다.
const PRIORITY_RANK = { HIGH: 0, NORMAL: 1, LOW: 2 };
const SORTERS = {
  created: () => 0,
  due: (a, b) => {
    if (a.due_date === b.due_date) return 0;
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  },
  priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
};

function sortedTasks(list) {
  const compare = SORTERS[sortSelect.value] ?? SORTERS.created;
  return [...list].sort((a, b) => compare(a, b) || a.id - b.id);
}

function render() {
  const visible = sortedTasks(visibleTasks());
  taskList.replaceChildren();
  for (const task of visible) {
    const li = document.createElement("li");
    li.dataset.id = String(task.id);
    li.dataset.status = task.status;
    li.dataset.overdue = String(isOverdue(task));
    if (task.id === editingId) renderEditRow(li, task);
    else renderViewRow(li, task);
    taskList.appendChild(li);
  }
  if (loadState === "loading") emptyMessage.textContent = "불러오는 중입니다.";
  else if (loadState === "failed") emptyMessage.textContent = "목록을 불러오지 못했습니다.";
  else if (tasks.length === 0) emptyMessage.textContent = "등록된 할 일이 없습니다.";
  else emptyMessage.textContent = "조건에 맞는 할 일이 없습니다.";
  emptyMessage.hidden = visible.length > 0;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return; // 응답을 기다리는 동안 중복 등록을 막는다.
  const result = validateFields({
    title: input.value,
    description: descriptionInput.value,
    priority: priorityInput.value,
    dueDate: dueInput.value,
  });
  if (result.error) {
    showError(result.error);
    input.focus();
    return;
  }
  submitting = true;
  const created = await mutate(async () => {
    tasks.push(await api("POST", "/tasks", result.values));
  });
  submitting = false;
  if (created) {
    input.value = "";
    descriptionInput.value = "";
    priorityInput.value = "NORMAL";
    dueInput.value = "";
  }
  input.focus();
});

// 패널을 접거나 펼친다. 접어도 입력 중인 값과 목록 상태는 지우지 않는다.
function setupCollapsible(panel, button, label, name, onOpen) {
  button.addEventListener("click", () => {
    const open = panel.classList.contains("collapsed");
    panel.classList.toggle("collapsed", !open);
    button.setAttribute("aria-expanded", String(open));
    label.textContent = open ? "−" : "+";
    button.setAttribute("aria-label", `${name} ${open ? "접기" : "펼치기"}`);
    if (open && onOpen) onOpen();
  });
}
setupCollapsible(formPanel, formToggle, formToggleLabel, "등록 폼", () => input.focus());
setupCollapsible(listPanel, listToggle, listToggleLabel, "할 일 목록");


searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
priorityFilter.addEventListener("change", render);
sortSelect.addEventListener("change", render);

// ---- 로그인·회원가입·로그아웃 (F12~F17, F19) ----
// 비밀번호는 요청을 보내는 순간에만 쓰고 어디에도 저장하지 않는다(localStorage 포함). 제출 뒤에는 입력칸을 비운다.

function setView(view) {
  bootMessage.hidden = view !== "boot";
  authView.hidden = view !== "auth";
  appView.hidden = view !== "app";
  userBar.hidden = view !== "app";
}

function setAuthMessage(text, kind = "error") {
  authMessage.textContent = text;
  authMessage.className = `auth-message ${kind}`;
  authMessage.setAttribute("role", kind === "error" ? "alert" : "status");
  authMessage.hidden = text === "";
}

const AUTH_TABS = {
  login: { tab: document.getElementById("tab-login"), panel: document.getElementById("panel-login") },
  signup: { tab: document.getElementById("tab-signup"), panel: document.getElementById("panel-signup") },
};

function selectTab(name, { focus = false } = {}) {
  for (const [key, { tab, panel }] of Object.entries(AUTH_TABS)) {
    const selected = key === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
    if (selected && focus) tab.focus();
  }
}

for (const [name, { tab }] of Object.entries(AUTH_TABS)) {
  tab.addEventListener("click", () => {
    selectTab(name);
    setAuthMessage("");
  });
  tab.addEventListener("keydown", (event) => {
    const order = Object.keys(AUTH_TABS);
    const index = order.indexOf(name);
    let next = null;
    if (event.key === "ArrowRight") next = order[(index + 1) % order.length];
    else if (event.key === "ArrowLeft") next = order[(index - 1 + order.length) % order.length];
    else if (event.key === "Home") next = order[0];
    else if (event.key === "End") next = order[order.length - 1];
    if (next === null) return;
    event.preventDefault();
    selectTab(next, { focus: true });
    setAuthMessage("");
  });
}

function setAuthBusy(busy) {
  authBusy = busy;
  for (const formElement of [loginForm, signupForm]) {
    formElement.querySelector('button[type="submit"]').disabled = busy;
  }
}

// 로그아웃·세션 만료 때 이전 사용자의 목록과 입력 내용이 남지 않게 모두 비운다.
function resetAppState() {
  tasks.length = 0;
  loadState = "loading";
  editingId = null;
  submitting = false;
  input.value = "";
  descriptionInput.value = "";
  priorityInput.value = "NORMAL";
  dueInput.value = "";
  searchInput.value = "";
  statusFilter.value = "";
  priorityFilter.value = "";
  sortSelect.value = "created";
  clearError();
  render();
}

function showAuth(message = "", kind = "error", tab = "login") {
  currentUser = null;
  resetAppState();
  currentUserLabel.textContent = "";
  loginPassword.value = "";
  signupPassword.value = "";
  signupPasswordConfirm.value = "";
  setView("auth");
  selectTab(tab);
  setAuthMessage(message, kind);
}

function showApp(user) {
  currentUser = user;
  currentUserLabel.textContent = user.username; // 글자로만 표시한다.
  setAuthMessage("");
  setView("app");
  return loadTasks();
}

function sessionExpired() {
  if (currentUser === null) return;
  showAuth("로그인이 만료되었습니다. 다시 로그인해 주세요.");
}

// 서버의 로그인 상태를 확인해 화면을 정한다. 시작할 때와 뒤로 가기로 되돌아왔을 때 쓴다.
async function checkSession() {
  try {
    const user = await api("GET", "/auth/me");
    if (!user || typeof user.username !== "string") {
      throw new ApiError(0, "서버 응답 형식이 올바르지 않습니다.");
    }
    if (currentUser !== null && currentUser.id === user.id) return; // 이미 같은 사용자 화면이다.
    await showApp(user);
  } catch (e) {
    if (e.status === 401) {
      showAuth(currentUser !== null ? "로그인이 만료되었습니다. 다시 로그인해 주세요." : "");
    } else {
      showAuth(e.message);
    }
  }
}

function loginErrorText(e) {
  if (e.status === 401) return "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (e.status === 429) {
    const minutes = e.retryAfter === null ? null : Math.max(1, Math.ceil(e.retryAfter / 60));
    return minutes === null
      ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
      : `로그인 시도가 너무 많습니다. ${minutes}분 뒤에 다시 시도해 주세요.`;
  }
  return e.message;
}

function validateSignup(username, password, confirm) {
  if (!USERNAME_PATTERN.test(username)) {
    return "아이디는 영문, 숫자, 밑줄(_)만 써서 3~20자로 입력해 주세요.";
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}~${MAX_PASSWORD_LENGTH}자로 입력해 주세요.`;
  }
  if (password !== confirm) return "비밀번호와 비밀번호 확인이 다릅니다.";
  return null;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authBusy) return;
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  if (username === "" || password === "") {
    setAuthMessage("아이디와 비밀번호를 입력해 주세요.");
    return;
  }
  setAuthBusy(true);
  try {
    const user = await api("POST", "/auth/login", { username, password });
    loginUsername.value = "";
    loginPassword.value = "";
    await showApp(user);
  } catch (e) {
    loginPassword.value = "";
    setAuthMessage(loginErrorText(e));
    loginPassword.focus();
  } finally {
    setAuthBusy(false);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authBusy) return;
  const username = signupUsername.value.trim();
  const password = signupPassword.value;
  const confirm = signupPasswordConfirm.value;
  const problem = validateSignup(username, password, confirm);
  if (problem !== null) {
    setAuthMessage(problem);
    return;
  }
  setAuthBusy(true);
  try {
    await api("POST", "/auth/signup", {
      username,
      password,
      password_confirm: confirm,
    });
    signupUsername.value = "";
    signupPassword.value = "";
    signupPasswordConfirm.value = "";
    selectTab("login");
    loginUsername.value = username.toLowerCase();
    loginPassword.value = "";
    setAuthMessage("가입이 완료되었습니다. 로그인해 주세요.", "notice");
    loginPassword.focus();
  } catch (e) {
    signupPassword.value = "";
    signupPasswordConfirm.value = "";
    setAuthMessage(e.status === 409 ? "이미 사용 중인 아이디입니다." : e.message);
  } finally {
    setAuthBusy(false);
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await api("POST", "/auth/logout");
    showAuth("로그아웃되었습니다.", "notice");
  } catch (e) {
    showError(e.message); // 로그아웃하지 못했으면 로그인 상태 그대로 둔다.
  } finally {
    logoutButton.disabled = false;
  }
});

// 뒤로 가기로 이전 화면이 복원되면(bfcache) 로그아웃한 뒤에도 목록이 보일 수 있어 다시 확인한다.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) checkSession();
});

setView("boot");
checkSession();
