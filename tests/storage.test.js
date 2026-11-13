/* Baseline tests for js/storage.js.
   jsdom gives us a real localStorage to test against. */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import storageModule from '../js/storage.js';

const { TaskStorage } = storageModule;

const task = (id, extra = {}) => ({
  id,
  title: `Task ${id}`,
  description: '',
  priority: 'medium',
  dueDate: '',
  completed: false,
  createdDate: '2026-11-10T09:00:00.000Z',
  ...extra,
});

let storage;

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  storage = new TaskStorage();
});

describe('loading tasks', () => {
  it('returns an empty list when nothing is saved', () => {
    expect(storage.loadTasks()).toEqual([]);
  });

  it('returns an empty list when the saved data is not valid JSON', () => {
    localStorage.setItem('taskline_tasks', '{broken');
    expect(storage.loadTasks()).toEqual([]);
  });

  it('returns an empty list when the saved data is not an array', () => {
    localStorage.setItem('taskline_tasks', '{"id":"x"}');
    expect(storage.loadTasks()).toEqual([]);
  });

  it('reads back what was saved', () => {
    storage.saveTasks([task('a'), task('b')]);
    expect(storage.loadTasks().map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('changing tasks', () => {
  it('adds a new task to the top of the list and saves it', () => {
    const list = storage.addTask([task('a')], task('b'));
    expect(list.map((t) => t.id)).toEqual(['b', 'a']);
    expect(storage.loadTasks().map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('updates only the matching task', () => {
    const list = storage.updateTask([task('a'), task('b')], 'b', { completed: true });
    expect(list.find((t) => t.id === 'b').completed).toBe(true);
    expect(list.find((t) => t.id === 'a').completed).toBe(false);
  });

  it('deletes a task by ID', () => {
    const list = storage.deleteTask([task('a'), task('b')], 'a');
    expect(list.map((t) => t.id)).toEqual(['b']);
  });

  it('clears only completed tasks', () => {
    const list = storage.clearCompletedTasks([
      task('a', { completed: true }),
      task('b'),
    ]);
    expect(list.map((t) => t.id)).toEqual(['b']);
  });

  it('reorders tasks and keeps any not listed at the end', () => {
    const list = storage.reorderTasks([task('a'), task('b'), task('c')], ['c', 'a']);
    expect(list.map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('theme', () => {
  it('defaults to light and remembers a change', () => {
    expect(storage.loadTheme()).toBe('light');
    storage.saveTheme('dark');
    expect(storage.loadTheme()).toBe('dark');
  });
});
