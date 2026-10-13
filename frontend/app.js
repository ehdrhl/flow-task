const MAX_TITLE_LENGTH = 100;

const form = document.getElementById("task-form");
const input = document.getElementById("title-input");
const errorMessage = document.getElementById("error-message");
const taskList = document.getElementById("task-list");
const emptyMessage = document.getElementById("empty-message");

// T01: 메모리에만 보관한다. 새로고침하면 사라진다.
const tasks = [];
let nextId = 1;

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
  clearError();
  tasks.push({ id: nextId++, title: result.title });
  input.value = "";
  input.focus();
  render();
});

render();
