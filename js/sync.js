/* ========================================================
   sync.js — FEAT #13: keeps the tasks on this device and the
   tasks in the user's Supabase account in step.

   Offline first: the app always saves on the device first.
   Sync then compares each task with the cloud copy and keeps
   the most recent version ("last write wins"). Deletions travel
   too, using the trash from C5 (soft delete).
   ======================================================== */

const SYNC_META_KEY = 'taskline_sync_meta';

/* In the browser, friendlyAuthError (auth.js) and StorageError (storage.js)
   are already loaded by earlier <script> tags; in the Node tests they are required. */
function syncDeps() {
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    return { friendly: require('./auth.js').friendlyAuthError, StorageErr: require('./storage.js').StorageError };
  }
  return { friendly: friendlyAuthError, StorageErr: StorageError };
}
const GUEST_BACKUP_KEY = 'taskline_guest_tasks';

const toTime = (iso) => {
  const t = Date.parse(iso || '');
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Merges the device's tasks and trash with the cloud rows.
 * Pure function: no storage, no network, easy to test.
 *
 * @param {Array<Object>} localTasks - tasks on this device (with updatedAt)
 * @param {Array<Object>} localTrash - C5 trash entries { task, deletedAt }
 * @param {Array<Object>} remoteRows - cloud rows { id, data, updated_at, deleted_at }
 * @returns {{tasks: Array<Object>, upload: Array<Object>, changedLocally: boolean}}
 */
function mergeTasks(localTasks, localTrash, remoteRows) {
  const local = new Map(localTasks.map((task) => [task.id, task]));
  const trash = new Map(localTrash.map((entry) => [entry.task.id, entry]));
  const remote = new Map(remoteRows.map((row) => [row.id, row]));
  const ids = new Set([...local.keys(), ...trash.keys(), ...remote.keys()]);

  let tasks = [...localTasks];
  const upload = [];
  let changedLocally = false;

  ids.forEach((id) => {
    const liveTask = local.get(id);
    const deleted = trash.get(id);
    const row = remote.get(id);

    let mine = null;
    if (liveTask) {
      mine = { deleted: false, time: toTime(liveTask.updatedAt || liveTask.createdDate), task: liveTask };
    } else if (deleted) {
      mine = { deleted: true, time: toTime(deleted.deletedAt), task: deleted.task };
    }
    const theirs = row
      ? { deleted: Boolean(row.deleted_at), time: toTime(row.deleted_at || row.updated_at), task: row.data }
      : null;

    // Only on this device, or newer here: send it to the cloud.
    if (mine && (!theirs || mine.time > theirs.time)) {
      const iso = new Date(mine.time || Date.now()).toISOString();
      upload.push({
        id,
        data: mine.task,
        updated_at: iso,
        deleted_at: mine.deleted ? iso : null,
      });
      return;
    }

    // Only in the cloud, or newer in the cloud: bring it to this device.
    if (theirs && (!mine || theirs.time > mine.time)) {
      if (theirs.deleted) {
        if (liveTask) {
          tasks = tasks.filter((task) => task.id !== id);
          changedLocally = true;
        }
        return;
      }
      const incoming = { ...theirs.task, id, updatedAt: row.updated_at };
      const index = tasks.findIndex((task) => task.id === id);
      if (index >= 0) tasks[index] = incoming;
      else tasks = [incoming, ...tasks]; // new from another device: show at the top
      changedLocally = true;
    }
    // Same time on both sides: nothing to do.
  });

  return { tasks, upload, changedLocally };
}

class SyncService {
  /**
   * @param {Object|null} client - Supabase client, or null in guest mode
   * @param {TaskStorage} storage
   */
  constructor(client, storage) {
    this.client = client || null;
    this.storage = storage;
    this.running = false;
  }

  loadMeta() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  _saveMeta(meta) {
    try {
      localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
    } catch (error) {
      console.warn('SyncService: could not save sync details', error);
    }
  }

  /**
   * True when this device holds guest tasks that have never been linked to
   * this account. Then the user must choose before anything is uploaded,
   * so someone else's tasks on a shared device never end up in their account.
   * @param {string} userId
   * @returns {number} how many tasks are waiting for a choice (0 = none)
   */
  pendingGuestTasks(userId) {
    if (this.loadMeta().userId === userId) return 0;
    return this.storage.loadTasks().length;
  }

  /**
   * The user's choice for the guest tasks on this device.
   * @param {string} userId
   * @param {boolean} copy - true: add them to the account; false: set them aside
   */
  resolveGuestTasks(userId, copy) {
    if (!copy) {
      const guestTasks = this.storage.loadTasks();
      try {
        localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify(guestTasks));
      } catch (error) {
        throw new (syncDeps().StorageErr)();
      }
      this.storage.replaceAll([]);
      this.storage.clearTrash();
    }
    this._saveMeta({ ...this.loadMeta(), userId });
  }

  /**
   * Two-way sync for the signed-in user.
   * @param {string} userId
   * @returns {Promise<{ok: boolean, changedLocally?: boolean, uploaded?: number, error?: string, waitingForChoice?: boolean}>}
   */
  async syncNow(userId) {
    if (!this.client) return { ok: false, error: 'Accounts are not available right now.' };
    if (this.pendingGuestTasks(userId) > 0) return { ok: false, waitingForChoice: true };
    if (this.running) return { ok: false, error: 'A sync is already running.' };
    this.running = true;
    try {
      const { data: rows, error } = await this.client
        .from('tasks')
        .select('id, data, updated_at, deleted_at');
      if (error) return { ok: false, error: syncDeps().friendly(error) };

      const merged = mergeTasks(this.storage.loadTasks(), this.storage.loadTrash(), rows || []);

      if (merged.upload.length > 0) {
        const { error: upError } = await this.client
          .from('tasks')
          .upsert(merged.upload.map((row) => ({ ...row, user_id: userId })));
        if (upError) return { ok: false, error: syncDeps().friendly(upError) };
      }
      if (merged.changedLocally) {
        this.storage.replaceAll(merged.tasks);
      }
      this._saveMeta({ userId, lastSyncedAt: new Date().toISOString() });
      return { ok: true, changedLocally: merged.changedLocally, uploaded: merged.upload.length };
    } catch (error) {
      return { ok: false, error: error && error.name === 'StorageError' ? error.message : syncDeps().friendly(error) };
    } finally {
      this.running = false;
    }
  }

  /**
   * On sign-out: the account's tasks leave this device (they are safe in the
   * cloud) and any guest tasks set aside at sign-in come back.
   * Only call this after a successful sync, so nothing unsynced is lost.
   */
  clearAccountData() {
    let guestTasks = [];
    try {
      guestTasks = JSON.parse(localStorage.getItem(GUEST_BACKUP_KEY) || '[]');
      localStorage.removeItem(GUEST_BACKUP_KEY);
    } catch (error) {
      guestTasks = [];
    }
    this.storage.replaceAll(Array.isArray(guestTasks) ? guestTasks : []);
    this.storage.clearTrash();
    localStorage.removeItem(SYNC_META_KEY);
  }
}

/* Lets the automated tests load this file in Node. Browsers skip this block. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SyncService, mergeTasks, SYNC_META_KEY, GUEST_BACKUP_KEY };
}
