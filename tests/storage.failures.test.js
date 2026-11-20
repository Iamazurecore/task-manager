/* Issue #3 (A1): the app reported "saved" even when saving failed.
   These tests make the browser's storage refuse every write (like a full
   disk or private mode) and check that TaskStorage reports the failure
   instead of pretending the change was saved.

   On the original code, the "throws" tests FAIL - that is the bug. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import storageModule from '../js/storage.js';

const { TaskStorage } = storageModule;

const task = (id, extra = {}) => ({
  id,
  title: `Task ${id}`,
  description: '',
  priority: 'medium',
  dueDate: '',
  completed: false,
  createdDate: '2026-11-20T09:00:00.000Z',
  ...extra,
});

// Make every localStorage.setItem call fail, like a full storage quota.
const breakStorage = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Simulated: storage is full', 'QuotaExceededError');
  });

let storage;

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  storage = new TaskStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('when saving fails, TaskStorage must report it (issue #3)', () => {
  it('addTask throws instead of pretending the task was saved', () => {
    breakStorage();
    expect(() => storage.addTask([], task('a'))).toThrow(/could not be saved/i);
  });

  it('updateTask throws instead of pretending the change was saved', () => {
    const list = [task('a')];
    breakStorage();
    expect(() => storage.updateTask(list, 'a', { completed: true })).toThrow(/could not be saved/i);
  });

  it('deleteTask throws instead of pretending the task was deleted', () => {
    const list = [task('a')];
    breakStorage();
    expect(() => storage.deleteTask(list, 'a')).toThrow(/could not be saved/i);
  });

  it('clearCompletedTasks throws instead of pretending tasks were cleared', () => {
    const list = [task('a', { completed: true }), task('b')];
    breakStorage();
    expect(() => storage.clearCompletedTasks(list)).toThrow(/could not be saved/i);
  });

  it('reorderTasks throws instead of pretending the new order was saved', () => {
    const list = [task('a'), task('b')];
    breakStorage();
    expect(() => storage.reorderTasks(list, ['b', 'a'])).toThrow(/could not be saved/i);
  });

  it('leaves the original task list untouched when saving fails', () => {
    const list = [task('a')];
    breakStorage();
    try {
      storage.updateTask(list, 'a', { title: 'Changed' });
    } catch {
      /* expected after the fix */
    }
    expect(list[0].title).toBe('Task a');
  });
});

describe('when saving works, nothing changes for the user (issue #3)', () => {
  it('addTask still returns the new list and saves it', () => {
    const list = storage.addTask([], task('a'));
    expect(list.map((t) => t.id)).toEqual(['a']);
    expect(storage.loadTasks().map((t) => t.id)).toEqual(['a']);
  });
});
