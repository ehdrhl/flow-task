const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const STATUSES = ["TODO", "DOING", "DONE"];
const STATUS_LABELS = { TODO: "할 일", DOING: "진행 중", DONE: "완료" };
const PRIORITIES = ["HIGH", "NORMAL", "LOW"];
const PRIORITY_LABELS = { HIGH: "높음", NORMAL: "보통", LOW: "낮음" };

const form = document.getElementById("task-form");
const input = document.getElementById("title-input");
const descriptionInput = document.getElementById("description-input");
const priorityInput = document.getElementById("priority-input");
const dueInput = document.getElementById("due-input");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const priorityFilter = document.getElementById("priority-filter");
const errorMessage = document.getElementById("error-message");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");

const STORAGE_KEY = "task-flow-v1";

const tasks = [];
let nextId = 1;
// 저장값이 손상되었거나 저장소를 쓸 수 없으면 false. 이때는 기존 저장값을 덮어쓰지 않는다.
let storageWritable = true;

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

function isValidStoredTask(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    Number.isInteger(item.id) &&
    item.id > 0 &&
    typeof item.title === "string" &&
    item.title.trim().length >= 1 &&
    item.title.length <= MAX_TITLE_LENGTH &&
    // 이전 단계(T02·T03)에서 저장된 항목에는 새 필드가 없으므로, 없으면 기본값으로 본다.
    (item.status === undefined || STATUSES.includes(item.status)) &&
    (item.description === undefined ||
      (typeof item.description === "string" && item.description.length <= MAX_DESCRIPTION_LENGTH)) &&
    (item.priority === undefined || PRIORITIES.includes(item.priority)) &&
    (item.due_date === undefined || item.due_date === null || isValidDate(item.due_date))
  );
}

function loadTasks() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    storageWritable = false;
    storageNotice = "브라우저 저장소를 사용할 수 없어 저장하지 않습니다.";
    clearError();
    return;
  }
  if (raw === null) return;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parsed = null;
  }
  const ids = Array.isArray(parsed) ? parsed.map((t) => t && t.id) : [];
  if (
    !Array.isArray(parsed) ||
    !parsed.every(isValidStoredTask) ||
    new Set(ids).size !== ids.length
  ) {
    storageWritable = false;
    storageNotice =
      "저장된 데이터가 손상되어 불러오지 못했습니다. 기존 저장값은 그대로 두며, 이 상태에서는 저장하지 않습니다.";
    clearError();
    return;
  }
  for (const t of parsed) {
    tasks.push({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      status: t.status ?? "TODO",
      priority: t.priority ?? "NORMAL",
      due_date: t.due_date ?? null,
    });
  }
  nextId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
}

function saveTasks() {
  if (!storageWritable) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    showError("저장에 실패했습니다. 새로고침하면 방금 등록한 항목이 사라질 수 있습니다.");
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

// 저장소 문제 안내는 입력 오류를 지워도 계속 보여 준다.
let storageNotice = "";

function clearError() {
  errorMessage.textContent = storageNotice;
  errorMessage.hidden = storageNotice === "";
}

function validateTitle(raw) {
  const title = raw.trim();
  if (title.length === 0) return { error: "제목을 입력해 주세요." };
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `제목은 ${MAX_TITLE_LENGTH}자 이하로 입력해 주세요.` };
  }
  return { title };
}

// 제목·설명·우선순위·마감일을 검사해 저장할 값을 돌려준다.
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

let editingId = null;

function findTask(id) {
  return tasks.find((t) => t.id === id);
}

function changeStatus(id, status) {
  const task = findTask(id);
  if (!task || !STATUSES.includes(status)) return;
  task.status = status;
  clearError();
  saveTasks();
  render();
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

function saveEdit(id, fields) {
  const result = validateFields(fields);
  if (result.error) {
    showError(result.error);
    return;
  }
  const task = findTask(id);
  if (task) Object.assign(task, result.values); // status와 id는 그대로 둔다.
  editingId = null;
  clearError();
  saveTasks();
  render();
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task) return;
  // 취소하면 아무것도 바꾸지 않는다.
  if (!confirm(`"${task.title}" 항목을 삭제할까요?`)) return;
  tasks.splice(tasks.indexOf(task), 1);
  if (editingId === id) editingId = null;
  clearError();
  saveTasks();
  render();
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
    saveEdit(task.id, {
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

function render() {
  const visible = visibleTasks();
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
  if (tasks.length === 0) emptyMessage.textContent = "등록된 할 일이 없습니다.";
  else emptyMessage.textContent = "조건에 맞는 할 일이 없습니다.";
  emptyMessage.hidden = visible.length > 0;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
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
  tasks.push({ id: nextId++, status: "TODO", ...result.values });
  clearError();
  saveTasks();
  input.value = "";
  descriptionInput.value = "";
  priorityInput.value = "NORMAL";
  dueInput.value = "";
  input.focus();
  render();
});

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
priorityFilter.addEventListener("change", render);

loadTasks();
render();
