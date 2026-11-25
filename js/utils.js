/* ========================================================
   utils.js — Generic helper functions used across the app
   ======================================================== */

/**
 * Generates a reasonably unique ID for a task.
 * Combines the current timestamp with a random suffix.
 * @returns {string} Unique identifier
 */
function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Returns the current date/time as an ISO string.
 * @returns {string}
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Escapes HTML special characters to prevent XSS when
 * inserting user-provided text into the DOM via innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * FIX #7 (A4): reads a date-only string ("2026-11-21") as that calendar day
 * in the user's own time zone. `new Date("2026-11-21")` reads it as midnight
 * UTC instead, which is still the previous day anywhere behind UTC.
 * Full timestamps (with a time part) are passed to Date unchanged.
 * @param {string} value
 * @returns {Date}
 */
function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Formats an ISO date string (YYYY-MM-DD or full ISO) into
 * a short human-readable date, e.g. "12 Jun 2026".
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return '';
  // FIX #7 (A4): was `new Date(isoString)`, which shifted the day behind UTC.
  const date = parseLocalDate(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Formats an ISO timestamp into a short date for "Created" labels.
 * @param {string} isoString
 * @returns {string}
 */
function formatCreatedDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Checks whether a given due date (YYYY-MM-DD) is in the past
 * relative to today (ignoring time of day).
 * @param {string} dueDate - Date string in YYYY-MM-DD format
 * @returns {boolean}
 */
function isOverdue(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // FIX #7 (A4): was `new Date(dueDate)`, so "today" counted as overdue behind UTC.
  const due = parseLocalDate(dueDate);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/**
 * Debounces a function call, delaying execution until after
 * `delay` milliseconds have elapsed since the last invocation.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Reorders visible task IDs while keeping filtered-out tasks in their slots.
 * @param {Array<string>} allIds - IDs in the full task list
 * @param {Array<string>} orderedVisibleIds - visible IDs in their new order
 * @returns {Array<string>}
 */
function reorderVisibleIds(allIds, orderedVisibleIds) {
  const visibleIds = new Set(orderedVisibleIds);
  let visibleIndex = 0;
  return allIds.map((id) =>
    visibleIds.has(id) ? orderedVisibleIds[visibleIndex++] : id
  );
}

/* Lets the automated tests load this file in Node. Browsers skip this block. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    nowISO,
    escapeHTML,
    parseLocalDate,
    formatDate,
    formatCreatedDate,
    isOverdue,
    debounce,
    capitalize,
    clamp,
    reorderVisibleIds,
  };
}
