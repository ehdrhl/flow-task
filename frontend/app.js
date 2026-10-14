const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const STATUSES = ["TODO", "DOING", "DONE"];
const STATUS_LABELS = { TODO: "할 일", DOING: "진행 중", DONE: "완료" };
const PRIORITIES = ["HIGH", "NORMAL", "LOW"];
const PRIORITY_LABELS = { HIGH: "높음", NORMAL: "보통", LOW: "낮음" };

// 개발 단계(정적 서버 :5500)에서는 같은 호스트의 API 서버(:8000)를 부른다.
// 그 밖의 주소(Nginx 등)에서는 같은 출처의 /api를 쓴다.
const API_BASE =
  location.port === "5500" ? `http://${location.hostname}:8000/api` : "/api";

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
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");

// 서버에서 받은 목록의 사본이다. 저장소는 API 서버이며, 브라우저에는 저장하지 않는다.
const tasks = [];
// "loading": 불러오는 중, "ready": 서버 목록과 일치, "failed": 불러오지 못함
let loadState = "loading";
let editingId = null;
let submitting = false;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function errorTextFor(status) {
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
  if (!response.ok) throw new ApiError(response.status, errorTextFor(response.status));
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

loadTasks();
