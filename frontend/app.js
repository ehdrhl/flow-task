const MAX_TITLE_LENGTH = 100;

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
    item.title.length <= MAX_TITLE_LENGTH
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
  for (const t of parsed) tasks.push({ id: t.id, title: t.title });
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

function render() {
  taskList.replaceChildren();
  for (const task of tasks) {
    const li = document.createElement("li");
    li.dataset.id = String(task.id);
    li.textContent = task.title; // 글자로만 표시한다.
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
  tasks.push({ id: nextId++, title: result.title });
  clearError();
  saveTasks();
  input.value = "";
  input.focus();
  render();
});

loadTasks();
render();
