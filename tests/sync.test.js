// Issue #13: cloud sync. The merge rules are tested as a pure function, and
// SyncService is tested against a fake Supabase client (no network, no keys).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import syncModule from '../js/sync.js';
import storageModule from '../js/storage.js';

const { SyncService, mergeTasks } = syncModule;
const { TaskStorage } = storageModule;

const T1 = '2026-11-22T10:00:00.000Z';
const T2 = '2026-11-22T11:00:00.000Z';
const T3 = '2026-11-22T12:00:00.000Z';
const task = (id, extra = {}) => ({ id, title: `Task ${id}`, priority: 'medium', completed: false, createdDate: T1, updatedAt: T1, ...extra });
const row = (id, updatedAt, extra = {}) => ({ id, data: task(id, { updatedAt, ...extra.data }), updated_at: updatedAt, deleted_at: extra.deleted_at || null });

describe('merging device and cloud tasks (#13)', () => {
  it('uploads a task that exists only on this device', () => {
    const { upload, tasks } = mergeTasks([task('a')], [], []);
    expect(upload.map((r) => r.id)).toEqual(['a']);
    expect(tasks.map((t) => t.id)).toEqual(['a']);
  });

  it('downloads a task that exists only in the cloud and shows it at the top', () => {
    const { tasks, upload, changedLocally } = mergeTasks([task('a')], [], [row('b', T2)]);
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a']);
    expect(upload.map((r) => r.id)).toEqual(['a']); // 'a' is only on this device, so it goes up
    expect(changedLocally).toBe(true);
  });

  it('keeps the newer cloud version when the cloud copy was edited later', () => {
    const local = [task('a', { title: 'old', updatedAt: T1 })];
    const { tasks, upload } = mergeTasks(local, [], [row('a', T2, { data: { title: 'new' } })]);
    expect(tasks[0].title).toBe('new');
    expect(upload).toHaveLength(0);
  });

  it('uploads the device version when it was edited later', () => {
    const local = [task('a', { title: 'mine', updatedAt: T3 })];
    const { tasks, upload } = mergeTasks(local, [], [row('a', T2, { data: { title: 'theirs' } })]);
    expect(tasks[0].title).toBe('mine');
    expect(upload[0]).toMatchObject({ id: 'a', deleted_at: null });
  });

  it('sends a deletion made on this device to the cloud', () => {
    const trash = [{ task: task('a'), index: 0, deletedAt: T3 }];
    const { upload } = mergeTasks([], trash, [row('a', T2)]);
    expect(upload[0]).toMatchObject({ id: 'a', deleted_at: T3 });
  });

  it('removes a task here when it was deleted on another device later', () => {
    const { tasks, changedLocally } = mergeTasks([task('a', { updatedAt: T1 })], [], [row('a', T2, { deleted_at: T2 })]);
    expect(tasks).toHaveLength(0);
    expect(changedLocally).toBe(true);
  });

  it('keeps a task here when it was edited after the other device deleted it', () => {
    const { tasks, upload } = mergeTasks([task('a', { updatedAt: T3 })], [], [row('a', T2, { deleted_at: T2 })]);
    expect(tasks.map((t) => t.id)).toEqual(['a']);
    expect(upload[0]).toMatchObject({ id: 'a', deleted_at: null });
  });

  it('does nothing when both sides already match', () => {
    const result = mergeTasks([task('a', { updatedAt: T2 })], [], [row('a', T2)]);
    expect(result.upload).toHaveLength(0);
    expect(result.changedLocally).toBe(false);
  });
});

describe('timestamps for sync (#13)', () => {
  beforeEach(() => localStorage.clear());

  it('marks new and edited tasks with updatedAt, and leaves unchanged ones alone', () => {
    const storage = new TaskStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T1));
    let tasks = storage.addTask([], task('a', { updatedAt: undefined }));
    tasks = storage.addTask(tasks, task('b', { updatedAt: undefined }));
    expect(tasks.every((t) => t.updatedAt === T1)).toBe(true);
    vi.setSystemTime(new Date(T2));
    tasks = storage.updateTask(tasks, 'a', { title: 'edited' });
    expect(tasks.find((t) => t.id === 'a').updatedAt).toBe(T2);
    expect(tasks.find((t) => t.id === 'b').updatedAt).toBe(T1);
    vi.useRealTimers();
  });
});

function fakeClient(remoteRows = [], { selectError = null, upsertError = null } = {}) {
  const upsert = vi.fn(async () => ({ error: upsertError }));
  const select = vi.fn(async () => ({ data: remoteRows, error: selectError }));
  return { client: { from: vi.fn(() => ({ select, upsert })) }, upsert, select };
}

describe('SyncService (#13)', () => {
  let storage;
  beforeEach(() => {
    localStorage.clear();
    storage = new TaskStorage();
  });
  afterEach(() => vi.restoreAllMocks());

  it('asks before copying guest tasks into an account the first time', async () => {
    storage.replaceAll([task('guest1')]);
    const { client, upsert } = fakeClient();
    const sync = new SyncService(client, storage);
    expect(sync.pendingGuestTasks('user-1')).toBe(1);
    const result = await sync.syncNow('user-1');
    expect(result.waitingForChoice).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('copies guest tasks up when the user says yes', async () => {
    storage.replaceAll([task('guest1')]);
    const { client, upsert } = fakeClient();
    const sync = new SyncService(client, storage);
    sync.resolveGuestTasks('user-1', true);
    const result = await sync.syncNow('user-1');
    expect(result.ok).toBe(true);
    expect(upsert.mock.calls[0][0][0]).toMatchObject({ id: 'guest1', user_id: 'user-1' });
  });

  it('sets guest tasks aside when the user says no, and brings them back on sign-out', async () => {
    storage.replaceAll([task('guest1')]);
    const { client } = fakeClient([row('cloud1', T2)]);
    const sync = new SyncService(client, storage);
    sync.resolveGuestTasks('user-1', false);
    await sync.syncNow('user-1');
    expect(storage.loadTasks().map((t) => t.id)).toEqual(['cloud1']);
    sync.clearAccountData();
    expect(storage.loadTasks().map((t) => t.id)).toEqual(['guest1']);
  });

  it('reports a network error without touching the tasks on this device', async () => {
    storage.replaceAll([task('a')]);
    const { client } = fakeClient([], { selectError: { message: 'Failed to fetch' } });
    const sync = new SyncService(client, storage);
    sync.resolveGuestTasks('user-1', true);
    const result = await sync.syncNow('user-1');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/still saved on this device/);
    expect(storage.loadTasks().map((t) => t.id)).toEqual(['a']);
  });

  it('does nothing in guest mode', async () => {
    const result = await new SyncService(null, storage).syncNow('user-1');
    expect(result.ok).toBe(false);
  });
});
