const MAX_TITLE_LENGTH = 100;
const STATUSES = ["TODO", "DOING", "DONE"];
const STATUS_LABELS = { TODO: "할 일", DOING: "진행 중", DONE: "완료" };

const form = document.getElementById("task-form");
const input = document.getElementById("title-input");
const errorMessage = document.getElementById("error-message");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");

const STORAGE_KEY = "task-flow-v1";

const tasks = [];
let nextId = 1;
// 저장값이 손상되었거나 저장소를 쓸 수 없으면 false. 이때는 기존 저장값을 덮어쓰지 않는다.
let storageWritable = true;

function isValidStoredTask(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    Number.isInteger(item.id) &&
    item.id > 0 &&
    typeof item.title === "string" &&
    item.title.trim().length >= 1 &&
    item.title.length <= MAX_TITLE_LENGTH &&
    // T02에서 저장된 항목에는 status가 없으므로 없으면 TODO로 본다.
    (item.status === undefined || STATUSES.includes(item.status))
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
    tasks.push({ id: t.id, title: t.title, status: t.status ?? "TODO" });
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

function saveEdit(id, raw) {
  const result = validateTitle(raw);
  if (result.error) {
    showError(result.error);
    return;
  }
  const task = findTask(id);
  if (task) task.title = result.title;
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

function renderEditRow(li, task) {
  const editForm = document.createElement("form");
  editForm.className = "edit-form";
  const editInput = document.createElement("input");
  editInput.type = "text";
  editInput.value = task.title;
  editInput.setAttribute("aria-label", "제목 수정");
  editForm.append(editInput, makeButton("저장", null, "submit"), makeButton("취소", cancelEdit));
  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEdit(task.id, editInput.value);
  });
  li.appendChild(editForm);
}

function renderViewRow(li, task) {
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = task.title; // 글자로만 표시한다.

  const select = document.createElement("select");
  select.setAttribute("aria-label", "상태");
  for (const status of STATUSES) {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = STATUS_LABELS[status];
    select.appendChild(option);
  }
  select.value = task.status;
  select.addEventListener("change", () => changeStatus(task.id, select.value));

  const actions = document.createElement("span");
  actions.className = "actions";
  actions.append(
    select,
    makeButton("수정", () => startEdit(task.id)),
    makeButton("삭제", () => deleteTask(task.id))
  );
  li.append(title, actions);
}

function render() {
  taskList.replaceChildren();
  for (const task of tasks) {
    const li = document.createElement("li");
    li.dataset.id = String(task.id);
    li.dataset.status = task.status;
    if (task.id === editingId) renderEditRow(li, task);
    else renderViewRow(li, task);
    taskList.appendChild(li);
  }
  emptyMessage.hidden = tasks.length > 0;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = validateTitle(input.value);
  if (result.error) {
    showError(result.error);
    input.focus();
    return;
  }
  tasks.push({ id: nextId++, title: result.title, status: "TODO" });
  clearError();
  saveTasks();
  input.value = "";
  input.focus();
  render();
});

loadTasks();
render();
