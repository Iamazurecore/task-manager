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
  constructor(storageKey = 'taskline_tasks', themeKey = 'taskline_theme') {
    this.storageKey = storageKey;
    this.themeKey = themeKey;
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
   * Removes a task by ID.
   * @param {Array<Object>} tasks - current task list
   * @param {string} id - task ID to remove
   * @returns {Array<Object>} updated task list
   */
  deleteTask(tasks, id) {
    const updated = tasks.filter((task) => task.id !== id);
    // FIX #3 (A1): was `this.saveTasks(updated); return updated;`, which ignored a failed save.
    return this._persist(updated);
  }

  /**
   * Removes all tasks marked as completed.
   * @param {Array<Object>} tasks - current task list
   * @returns {Array<Object>} updated task list
   */
  clearCompletedTasks(tasks) {
    const updated = tasks.filter((task) => !task.completed);
    // FIX #3 (A1): was `this.saveTasks(updated); return updated;`, which ignored a failed save.
    return this._persist(updated);
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
