/* ========================================================
   storage.js — All localStorage interactions, wrapped in a
   TaskStorage class for reuse and easy error handling.
   ======================================================== */

// FIX #3 (A1): a dedicated error type, so the app can tell a failed save
// apart from any other problem and warn the user instead of pretending it worked.
class StorageError extends Error {
  constructor(message = 'Your change could not be saved. Browser storage may be full or blocked, so it will be lost if you refresh the page.') {
    super(message);
    this.name = 'StorageError';
  }
}

class TaskStorage {
  /**
   * @param {string} storageKey - localStorage key for tasks
   * @param {string} themeKey - localStorage key for theme preference
   */
  constructor(storageKey = 'taskline_tasks', themeKey = 'taskline_theme', trashKey = 'taskline_trash') {
    this.storageKey = storageKey;
    this.themeKey = themeKey;
    // FEAT #9 (C5): deleted tasks are moved here (soft delete) so they can be restored.
    this.trashKey = trashKey;
  }

  /**
   * Loads the task list from localStorage.
   * Returns an empty array if nothing is stored or data is corrupt.
   * @returns {Array<Object>}
   */
  loadTasks() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (error) {
      console.error('TaskStorage.loadTasks: failed to read tasks from localStorage', error);
      return [];
    }
  }

  /**
   * Persists the full task list to localStorage.
   * @param {Array<Object>} tasks
   * @returns {boolean} success flag
   */
  saveTasks(tasks) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.error('TaskStorage.saveTasks: failed to write tasks to localStorage', error);
      return false;
    }
  }

  /**
   * FIX #3 (A1): saves the list and throws a StorageError if the save failed.
   * Before this fix, callers ignored saveTasks()'s false result.
   * @param {Array<Object>} tasks
   * @returns {Array<Object>} the same list, only once it is really saved
   */
  _persist(tasks) {
    if (!this.saveTasks(tasks)) {
      throw new StorageError();
    }
    return tasks;
  }

  /**
   * Adds a new task object to storage.
   * @param {Array<Object>} tasks - current task list
   * @param {Object} task - new task to add
   * @returns {Array<Object>} updated task list
   */
  addTask(tasks, task) {
    const updated = [task, ...tasks];
    // FIX #3 (A1): was `this.saveTasks(updated); return updated;`, which ignored a failed save.
    return this._persist(updated);
  }

  /**
   * Updates an existing task by ID with the provided fields.
   * @param {Array<Object>} tasks - current task list
   * @param {string} id - task ID to update
   * @param {Object} updates - fields to merge into the task
   * @returns {Array<Object>} updated task list
   */
  updateTask(tasks, id, updates) {
    const updated = tasks.map((task) =>
      task.id === id ? { ...task, ...updates } : task
    );
    // FIX #3 (A1): was `this.saveTasks(updated); return updated;`, which ignored a failed save.
    return this._persist(updated);
  }

  /**
   * Moves a task to the trash (soft delete) so it can be restored.
   * @param {Array<Object>} tasks - current task list
   * @param {string} id - task ID to remove
   * @returns {Array<Object>} updated task list
   */
  deleteTask(tasks, id) {
    // FEAT #9 (C5): was a hard delete (filter + save). The task now goes to the trash first.
    return this._moveToTrash(tasks, (task) => task.id === id);
  }

  /**
   * Moves all completed tasks to the trash so the clear can be undone.
   * @param {Array<Object>} tasks - current task list
   * @returns {Array<Object>} updated task list
   */
  clearCompletedTasks(tasks) {
    // FEAT #9 (C5): completed tasks go to the trash, so "Clear completed" can be undone.
    return this._moveToTrash(tasks, (task) => task.completed);
  }

  /* ---------------- FEAT #9 (C5): soft delete and undo ---------------- */

  /**
   * Reads the trash: a list of { task, index, deletedAt } entries.
   * @returns {Array<Object>}
   */
  loadTrash() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.trashKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('TaskStorage.loadTrash: failed to read the trash', error);
      return [];
    }
  }

  /**
   * Saves the trash, throwing a StorageError on failure (same rule as A1).
   * @param {Array<Object>} trash
   */
  _saveTrash(trash) {
    try {
      localStorage.setItem(this.trashKey, JSON.stringify(trash));
    } catch (error) {
      console.error('TaskStorage._saveTrash: failed to write the trash', error);
      throw new StorageError();
    }
  }

  /**
   * Moves every task that matches into the trash, remembering where it was.
   * The trash is written first; if saving the task list then fails, the trash
   * is put back as it was, so nothing is half-deleted.
   * @param {Array<Object>} tasks
   * @param {Function} matches - (task) => boolean
   * @returns {Array<Object>} the remaining tasks, once really saved
   */
  _moveToTrash(tasks, matches) {
    const deletedAt = new Date().toISOString();
    const removed = [];
    const remaining = [];
    tasks.forEach((task, index) => {
      if (matches(task)) removed.push({ task, index, deletedAt });
      else remaining.push(task);
    });
    if (removed.length === 0) return tasks;

    const oldTrash = this.loadTrash();
    this._saveTrash([...oldTrash, ...removed]);
    try {
      return this._persist(remaining);
    } catch (error) {
      this._saveTrash(oldTrash);
      throw error;
    }
  }

  /**
   * Takes the given tasks out of the trash and puts each back where it was.
   * @param {Array<Object>} tasks - current task list
   * @param {Array<string>} ids - IDs of the tasks to restore
   * @returns {Array<Object>} the task list with the tasks restored, once saved
   */
  restoreTasks(tasks, ids) {
    const trash = this.loadTrash();
    const wanted = new Set(ids);
    const present = new Set(tasks.map((task) => task.id));
    const back = trash
      // Never restore a task that is already in the list (no duplicates).
      .filter((entry) => wanted.has(entry.task.id) && !present.has(entry.task.id))
      .sort((x, y) => x.index - y.index);
    if (back.length === 0) return tasks;

    const restored = [...tasks];
    back.forEach((entry) => {
      restored.splice(Math.min(entry.index, restored.length), 0, entry.task);
    });

    this._persist(restored);
    // The tasks are safely back; if the trash cannot be tidied, they would only
    // remain in it as well, which does no harm, so this failure is not fatal.
    try {
      this._saveTrash(trash.filter((entry) => !wanted.has(entry.task.id)));
    } catch (error) {
      console.warn('TaskStorage.restoreTasks: restored, but the trash was not updated', error);
    }
    return restored;
  }

  /**
   * Permanently removes trash entries older than the given number of days.
   * @param {number} maxAgeDays
   */
  purgeTrash(maxAgeDays = 30) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const trash = this.loadTrash();
    const kept = trash.filter((entry) => new Date(entry.deletedAt).getTime() >= cutoff);
    if (kept.length === trash.length) return;
    try {
      this._saveTrash(kept);
    } catch (error) {
      console.warn('TaskStorage.purgeTrash: could not tidy the trash', error);
    }
  }

  /**
   * Reorders tasks based on an array of IDs in the desired order,
   * then persists the new order.
   * @param {Array<Object>} tasks - current task list
   * @param {Array<string>} orderedIds - task IDs in new order
   * @returns {Array<Object>} reordered task list
   */
  reorderTasks(tasks, orderedIds) {
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const reordered = orderedIds
      .map((id) => taskMap.get(id))
      .filter(Boolean);

    // Append any tasks not present in orderedIds (safety net)
    tasks.forEach((task) => {
      if (!orderedIds.includes(task.id)) {
        reordered.push(task);
      }
    });

    // FIX #3 (A1): was `this.saveTasks(reordered); return reordered;`, which ignored a failed save.
    return this._persist(reordered);
  }

  /**
   * Reads the saved theme preference ('light' or 'dark').
   * Defaults to 'light' if nothing is stored.
   * @returns {string}
   */
  loadTheme() {
    try {
      return localStorage.getItem(this.themeKey) || 'light';
    } catch (error) {
      console.error('TaskStorage.loadTheme: failed to read theme from localStorage', error);
      return 'light';
    }
  }

  /**
   * Saves the theme preference.
   * @param {string} theme - 'light' or 'dark'
   * @returns {boolean} success flag
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(this.themeKey, theme);
      return true;
    } catch (error) {
      console.error('TaskStorage.saveTheme: failed to write theme to localStorage', error);
      return false;
    }
  }
}

/* Lets the automated tests load this file in Node. Browsers skip this block. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TaskStorage, StorageError };
}
