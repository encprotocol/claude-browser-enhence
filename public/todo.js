window.TodoPanel = (function() {
  const STORAGE_KEY = 'synesthesia-todo-data';
  let modal, todoInput, todoAddBtn, todoList, closeBtn;
  let data = [];

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        data = JSON.parse(raw);
      } else {
        // Migrate from old combined storage
        var old = localStorage.getItem('synesthesia-notes-data');
        if (old) {
          var parsed = JSON.parse(old);
          if (parsed.todos && parsed.todos.length) {
            data = parsed.todos;
            save();
          }
        }
      }
    } catch (e) {
      data = [];
    }
    if (!Array.isArray(data)) data = [];
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function renderTodos() {
    todoList.innerHTML = '';
    data.forEach(function(todo) {
      var item = document.createElement('div');
      item.className = 'todo-item' + (todo.done ? ' done' : '');

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-checkbox';
      checkbox.checked = todo.done;
      checkbox.addEventListener('change', function() { toggleTodo(todo.id); });

      var text = document.createElement('span');
      text.className = 'todo-text';
      text.textContent = todo.text;

      var del = document.createElement('button');
      del.className = 'todo-delete';
      del.textContent = '\u00d7';
      del.title = 'Delete';
      del.addEventListener('click', function() { deleteTodo(todo.id); });

      item.appendChild(checkbox);
      item.appendChild(text);
      item.appendChild(del);
      todoList.appendChild(item);
    });
  }

  function addTodo(text) {
    text = text.trim();
    if (!text) return;
    data.push({ id: Date.now().toString(36), text: text, done: false });
    save();
    renderTodos();
  }

  function toggleTodo(id) {
    var todo = data.find(function(t) { return t.id === id; });
    if (todo) todo.done = !todo.done;
    save();
    renderTodos();
  }

  function deleteTodo(id) {
    data = data.filter(function(t) { return t.id !== id; });
    save();
    renderTodos();
  }

  function toggle() {
    modal.classList.toggle('visible');
    if (modal.classList.contains('visible')) {
      todoInput.focus();
    }
  }

  function isVisible() {
    return modal.classList.contains('visible');
  }

  function init() {
    modal = document.getElementById('todo-modal');
    todoInput = document.getElementById('todo-input');
    todoAddBtn = document.getElementById('todo-add');
    todoList = document.getElementById('todo-list');
    closeBtn = document.getElementById('todo-close');

    load();
    renderTodos();

    todoAddBtn.addEventListener('click', function() {
      addTodo(todoInput.value);
      todoInput.value = '';
      todoInput.focus();
    });

    todoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTodo(todoInput.value);
        todoInput.value = '';
      }
    });

    closeBtn.addEventListener('click', function() {
      modal.classList.remove('visible');
    });

    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('visible');
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isVisible()) {
        modal.classList.remove('visible');
      }
    });
  }

  return { init: init, toggle: toggle, isVisible: isVisible };
})();
