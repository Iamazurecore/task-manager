// Issue #9 (C5): deleting a task must be undoable. Deleted tasks are kept in
// a "trash" (soft delete) instead of being erased, so they can be restored to
// the same place, and so a later sync can tell other devices about deletions.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import storageModule from '../js/storage.js';

const { TaskStorage } = storageModule;

const task = (id, extra = {}) => ({
  id, title: `Task ${id}`, description: '', priority: 'medium',
  dueDate: '', completed: false, createdDate: '2026-11-22T10:00:00.000Z', ...extra,
});

describe('undo delete (#9)', () => {
  let storage;
  let tasks;

  beforeEach(() => {
    localStorage.clear();
    storage = new TaskStorage();
    tasks = [task('a'), task('b'), task('c')];
    storage.saveTasks(tasks);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('deleting a task keeps it in the trash instead of erasing it', () => {
    const after = storage.deleteTask(tasks, 'b');
    expect(after.map((t) => t.id)).toEqual(['a', 'c']);
    const trash = storage.loadTrash();
    expect(trash).toHaveLength(1);
    expect(trash[0].task.id).toBe('b');
    expect(typeof trash[0].deletedAt).toBe('string');
  });

  it('restoring puts the task back in the same position', () => {
    const after = storage.deleteTask(tasks, 'b');
    const restored = storage.restoreTasks(after, ['b']);
    expect(restored.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(storage.loadTrash()).toHaveLength(0);
    expect(storage.loadTasks().map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('clearing completed tasks can be undone in one step, in the original order', () => {
    tasks = [task('a', { completed: true }), task('b'), task('c', { completed: true })];
    const after = storage.clearCompletedTasks(tasks);
    expect(after.map((t) => t.id)).toEqual(['b']);
    const restored = storage.restoreTasks(after, ['a', 'c']);
    expect(restored.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('restoring the same task twice does not duplicate it', () => {
    const after = storage.deleteTask(tasks, 'b');
    const once = storage.restoreTasks(after, ['b']);
    const twice = storage.restoreTasks(once, ['b']);
    expect(twice.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('the trash survives a page reload', () => {
    storage.deleteTask(tasks, 'a');
    const reloaded = new TaskStorage();
    expect(reloaded.loadTrash().map((e) => e.task.id)).toEqual(['a']);
  });

  it('old trash entries are purged after 30 days, recent ones are kept', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    let after = storage.deleteTask(tasks, 'a');
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
    after = storage.deleteTask(after, 'b');
    vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
    storage.purgeTrash(30);
    expect(storage.loadTrash().map((e) => e.task.id)).toEqual(['b']);
  });

  it('if the save fails, the task is not deleted and the trash is unchanged (A1 rule)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Simulated: storage is full', 'QuotaExceededError');
    });
    expect(() => storage.deleteTask(tasks, 'b')).toThrow(/could not be saved/i);
    vi.restoreAllMocks();
    expect(storage.loadTrash()).toHaveLength(0);
    expect(storage.loadTasks().map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});
