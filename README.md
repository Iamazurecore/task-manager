# Taskline — Interactive Task Manager

A production-ready task manager that runs entirely in your browser. No backend, no database — your tasks live in this device's `localStorage`.

---

## Quick start

1. Download or clone this folder.
2. Open `index.html` in any modern browser.
3. Start adding tasks.

No build step, no `npm install`, no server required.

---

## Features

### Task management
- **Add** tasks with a title, description, priority, and due date
- **Edit** any task in-place — the form switches to edit mode
- **Delete** tasks with an animated removal
- **Toggle** completion status with the checkbox
- **Clear completed** removes all finished tasks at once
- **Validation** prevents empty-title submissions with an inline error message

### Filtering & search
- Filter by **All**, **Active**, or **Completed**
- **Live search** across title and description, compatible with all filters
- Filter buttons show a live task count

### Statistics dashboard
- **Total**, **Active**, **Completed**, and **High-priority** counters
- **Completion ring** — animated circular progress indicator showing the percentage done

### Drag & drop
- Reorder tasks by dragging them up or down the list
- Order persists across page reloads via `localStorage`

### Dark / Light mode
- Toggle between themes with the button in the top-right corner
- Preference is saved and restored on next visit

### Keyboard shortcuts
| Shortcut | Action |
|---|---|
| `Enter` | Submit the add / edit form |
| `Escape` | Cancel editing and reset the form |
| `Ctrl` + `F` | Focus the search input |

### Responsive design
- Mobile-first layout
- Tablet and desktop breakpoints
- Touch-friendly tap targets

---

## File structure

```
week2-task-manager/
│
├── index.html          # App shell and markup
│
├── css/
│   ├── theme.css       # Color tokens for light and dark themes
│   └── style.css       # Layout, typography, components, animations
│
├── js/
│   ├── utils.js        # Stateless helper functions (IDs, dates, escaping…)
│   ├── storage.js      # TaskStorage class — all localStorage operations
│   ├── ui.js           # TaskUI class — all DOM rendering
│   └── app.js          # TaskApp class — main controller (events, state, CRUD)
│
├── README.md
└── .gitignore
```

---

## Data model

Each task is stored as a plain JSON object:

```json
{
  "id":          "task_1718000000000_abc1234",
  "title":       "Review pull request",
  "description": "Check the auth branch before standup",
  "priority":    "high",
  "dueDate":     "2026-06-20",
  "completed":   false,
  "createdDate": "2026-06-16T08:30:00.000Z"
}
```

The full array is stored under the key `taskline_tasks` in `localStorage`. The selected theme is stored under `taskline_theme`.

---

## Architecture overview

| Module | Responsibility |
|---|---|
| `utils.js` | Pure functions with no side-effects: `generateId`, `formatDate`, `isOverdue`, `escapeHTML`, `debounce`, etc. Loaded first, no dependencies. |
| `storage.js` | `TaskStorage` class wraps every `localStorage` read/write. All methods return updated state so the caller always has the latest truth. |
| `ui.js` | `TaskUI` class owns all DOM mutations: rendering the task list, updating the stats dashboard, showing toasts, applying themes, and managing validation feedback. |
| `app.js` | `TaskApp` class is the orchestrator. It holds `this.tasks` (the in-memory task array) and `this.activeFilter` / `this.searchTerm` state, binds all events, and calls `_render()` after any mutation. |

---

## Browser compatibility

Tested in Chrome 120+, Firefox 122+, Safari 17+, Edge 120+.

Uses: ES6 classes, `const`/`let`, template literals, `async`/`await`, `Array` methods, CSS custom properties, `localStorage`.

---

## License

MIT — free to use and modify.
