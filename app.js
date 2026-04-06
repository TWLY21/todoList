const STORAGE_KEY = "momentum.tasks.v1";

const form = document.querySelector("#todo-form");
const titleInput = document.querySelector("#todo-input");
const priorityInput = document.querySelector("#priority-input");
const searchInput = document.querySelector("#search-input");
const list = document.querySelector("#task-list");
const stats = document.querySelector("#stats");
const emptyState = document.querySelector("#empty-state");
const clearCompletedBtn = document.querySelector("#clear-completed");
const filterContainer = document.querySelector("#filters");
const liveDate = document.querySelector("#live-date");

let tasks = loadTasks();
let activeFilter = "all";
let editingId = null;

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage may be blocked in some browser/file:// contexts.
    // Keep app functional in-memory even if persistence fails.
  }
}

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function getVisibleTasks() {
  const query = searchInput.value.trim().toLowerCase();
  return tasks.filter((task) => {
    const matchFilter =
      activeFilter === "all" ||
      (activeFilter === "active" && !task.completed) ||
      (activeFilter === "completed" && task.completed);

    const matchQuery = !query || task.title.toLowerCase().includes(query);
    return matchFilter && matchQuery;
  });
}

function setLiveDate() {
  const now = new Date();
  liveDate.textContent = now.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const active = total - completed;
  stats.textContent = `${active} active | ${completed} completed | ${total} total`;
}

function makeActionButton(label, action, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.className = `action-btn ${extraClass}`.trim();
  button.textContent = label;
  return button;
}

function renderTaskItem(task) {
  const li = document.createElement("li");
  li.className = `task ${task.completed ? "is-done" : ""}`;
  li.dataset.id = task.id;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toggle";
  toggle.dataset.action = "toggle";
  toggle.setAttribute("aria-label", task.completed ? "Mark as active" : "Mark as completed");

  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("p");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("p");
  meta.className = "task-meta";

  const priority = document.createElement("span");
  priority.className = `priority ${task.priority}`;
  priority.textContent = task.priority;

  const created = document.createElement("span");
  created.textContent = `Created ${formatDate(task.createdAt)}`;

  meta.append(priority, created);
  main.append(title, meta);

  li.append(toggle, main);

  if (editingId === task.id) {
    const editRow = document.createElement("div");
    editRow.className = "edit-row";

    const input = document.createElement("input");
    input.className = "edit-input";
    input.value = task.title;
    input.maxLength = 120;

    const editActions = document.createElement("div");
    editActions.className = "edit-actions";
    editActions.append(
      makeActionButton("Save", "save"),
      makeActionButton("Cancel", "cancel")
    );

    editRow.append(input, editActions);
    li.append(editRow);

    queueMicrotask(() => {
      input.focus();
      input.select();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        updateTaskTitle(task.id, input.value);
      }
      if (event.key === "Escape") {
        editingId = null;
        render();
      }
    });

    return li;
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    makeActionButton("Edit", "edit"),
    makeActionButton("Delete", "delete", "delete")
  );

  li.append(actions);
  return li;
}

function updateTaskTitle(taskId, nextTitle) {
  const cleanTitle = nextTitle.trim();
  if (!cleanTitle) return;

  tasks = tasks.map((task) =>
    task.id === taskId
      ? { ...task, title: cleanTitle, updatedAt: new Date().toISOString() }
      : task
  );

  editingId = null;
  saveTasks();
  render();
}

function render() {
  const visibleTasks = getVisibleTasks();

  list.innerHTML = "";
  visibleTasks.forEach((task) => list.append(renderTaskItem(task)));

  emptyState.style.display = visibleTasks.length ? "none" : "block";

  renderStats();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  if (!title) return;

  tasks.unshift({
    id: uid(),
    title,
    completed: false,
    priority: priorityInput.value,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  titleInput.value = "";
  priorityInput.value = "medium";

  saveTasks();
  render();
  titleInput.focus();
});

filterContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;

  activeFilter = button.dataset.filter;

  [...filterContainer.querySelectorAll("button")].forEach((node) => {
    node.classList.toggle("is-active", node === button);
  });

  render();
});

searchInput.addEventListener("input", render);

clearCompletedBtn.addEventListener("click", () => {
  tasks = tasks.filter((task) => !task.completed);
  if (editingId && !tasks.find((task) => task.id === editingId)) {
    editingId = null;
  }
  saveTasks();
  render();
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const taskElement = event.target.closest(".task");
  if (!taskElement) return;

  const taskId = taskElement.dataset.id;
  const action = button.dataset.action;

  if (action === "toggle") {
    tasks = tasks.map((task) =>
      task.id === taskId
        ? { ...task, completed: !task.completed, updatedAt: new Date().toISOString() }
        : task
    );
    saveTasks();
    render();
    return;
  }

  if (action === "delete") {
    tasks = tasks.filter((task) => task.id !== taskId);
    if (editingId === taskId) editingId = null;
    saveTasks();
    render();
    return;
  }

  if (action === "edit") {
    editingId = taskId;
    render();
    return;
  }

  if (action === "cancel") {
    editingId = null;
    render();
    return;
  }

  if (action === "save") {
    const input = taskElement.querySelector(".edit-input");
    if (!input) return;
    updateTaskTitle(taskId, input.value);
  }
});

setLiveDate();
setInterval(setLiveDate, 10000);
render();

