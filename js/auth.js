/* ========================================================
   auth.js — FEAT #11: optional accounts with Supabase.
   Guests never need this file to work: if Supabase is not
   available (offline, blocked, not configured), the app stays
   in guest mode and every existing feature still works.
   ======================================================== */

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 60;

/**
 * Checks sign-in or sign-up input before anything is sent to the server.
 * @param {{email: string, password: string, name?: string}} input
 * @param {boolean} isSignUp
 * @returns {string|null} an error message for the user, or null if valid
 */
function validateCredentials({ email, password, name }, isSignUp = false) {
  const cleanEmail = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return 'Please enter a valid email address.';
  }
  if (String(password || '').length < MIN_PASSWORD_LENGTH) {
    return `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (isSignUp && String(name || '').trim().length > MAX_NAME_LENGTH) {
    return `Your name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  return null;
}

/**
 * Up to two initials for the avatar: "Gideon Momah" -> "GM",
 * "lahari" -> "L"; falls back to the email's first letter.
 * @param {string} name
 * @param {string} email
 * @returns {string}
 */
function initialsFor(name, email) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }
  const first = String(email || '').trim()[0];
  return first ? first.toUpperCase() : '?';
}

/**
 * Turns Supabase error messages into plain English for the user.
 * @param {{message?: string}|null} error
 * @returns {string}
 */
function friendlyAuthError(error) {
  const message = String((error && error.message) || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'That email and password do not match.';
  if (message.includes('email not confirmed')) return 'Please confirm your email address first: check your inbox.';
  if (message.includes('already registered')) return 'An account with this email already exists. Try signing in.';
  if (message.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
  if (message.includes('fetch') || message.includes('network')) return 'Cannot reach the server. Check your connection; your tasks are still saved on this device.';
  return 'Something went wrong. Please try again.';
}

class AuthService {
  /**
   * @param {Object|null} client - a Supabase client, or null when unavailable
   */
  constructor(client) {
    this.client = client || null;
  }

  /**
   * Builds the service from the page's config, or an unavailable one.
   * @returns {AuthService}
   */
  static fromConfig() {
    const config = typeof window !== 'undefined' ? window.TASKLINE_CONFIG : null;
    const lib = typeof window !== 'undefined' ? window.supabase : null;
    if (!config || !config.supabaseUrl || !config.supabaseKey || !lib || !lib.createClient) {
      return new AuthService(null);
    }
    try {
      return new AuthService(lib.createClient(config.supabaseUrl, config.supabaseKey));
    } catch (error) {
      console.warn('AuthService: Supabase could not start; staying in guest mode', error);
      return new AuthService(null);
    }
  }

  /** @returns {boolean} true when accounts can be used */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * The signed-in user, or null for a guest.
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    return (data && data.session && data.session.user) || null;
  }

  /**
   * @returns {Promise<{user: Object|null, error: string|null, needsConfirmation?: boolean}>}
   */
  async signUp({ email, password, name }) {
    const invalid = validateCredentials({ email, password, name }, true);
    if (invalid) return { user: null, error: invalid };
    if (!this.client) return { user: null, error: 'Accounts are not available right now.' };

    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: String(name || '').trim() } },
    });
    if (error) return { user: null, error: friendlyAuthError(error) };
    // With email confirmation switched on, Supabase returns a user but no session yet.
    return { user: data.user, error: null, needsConfirmation: !data.session };
  }

  /**
   * @returns {Promise<{user: Object|null, error: string|null}>}
   */
  async signIn({ email, password }) {
    const invalid = validateCredentials({ email, password });
    if (invalid) return { user: null, error: invalid };
    if (!this.client) return { user: null, error: 'Accounts are not available right now.' };

    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { user: null, error: friendlyAuthError(error) };
    return { user: data.user, error: null };
  }

  /** Signs out. Local (guest) tasks are not touched. */
  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
  }

  /**
   * Permanently deletes the account, profile and cloud tasks (GDPR erasure).
   * Tasks saved on this device are not touched.
   * @returns {Promise<string|null>} an error message, or null on success
   */
  async deleteAccount() {
    if (!this.client) return 'Accounts are not available right now.';
    const { error } = await this.client.rpc('delete_my_account');
    if (error) return friendlyAuthError(error);
    await this.client.auth.signOut();
    return null;
  }

  /**
   * Calls back with the user (or null) whenever the sign-in state changes.
   * @param {Function} callback
   */
  onChange(callback) {
    if (!this.client) return;
    this.client.auth.onAuthStateChange((_event, session) => {
      callback((session && session.user) || null);
    });
  }
}

/* Lets the automated tests load this file in Node. Browsers skip this block. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthService, validateCredentials, initialsFor, friendlyAuthError, MIN_PASSWORD_LENGTH };
}
