// Issue #11: optional accounts. The real Supabase server is replaced by a
// small fake client, so these tests run offline and in CI with no keys.
import { describe, it, expect, vi } from 'vitest';
import authModule from '../js/auth.js';

const { AuthService, validateCredentials, initialsFor, friendlyAuthError } = authModule;

function fakeClient(overrides = {}) {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      signUp: vi.fn(async () => ({ data: { user: { id: 'u1' }, session: { user: { id: 'u1' } } }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(),
      ...overrides.auth,
    },
    rpc: vi.fn(async () => ({ error: null })),
    ...overrides.root,
  };
}

describe('checking sign-in details before sending them (#11)', () => {
  it('rejects an invalid email', () => {
    expect(validateCredentials({ email: 'not-an-email', password: 'longenough' })).toMatch(/valid email/);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(validateCredentials({ email: 'a@b.co', password: 'short' })).toMatch(/at least 8/);
  });

  it('rejects a display name over 60 characters on sign-up', () => {
    expect(validateCredentials({ email: 'a@b.co', password: 'longenough', name: 'x'.repeat(61) }, true)).toMatch(/60/);
  });

  it('accepts valid details', () => {
    expect(validateCredentials({ email: ' gideon@uel.ac.uk ', password: 'longenough' })).toBeNull();
  });
});

describe('avatar initials (#11)', () => {
  it('uses the first letters of the first two names', () => {
    expect(initialsFor('Gideon Momah', 'g@x.com')).toBe('GM');
  });
  it('uses one letter for a single name', () => {
    expect(initialsFor('lahari', 'l@x.com')).toBe('L');
  });
  it('falls back to the email when there is no name', () => {
    expect(initialsFor('', 'amandeep@x.com')).toBe('A');
  });
});

describe('friendly error messages (#11)', () => {
  it('explains wrong credentials in plain English', () => {
    expect(friendlyAuthError({ message: 'Invalid login credentials' })).toBe('That email and password do not match.');
  });
  it('reassures the user when offline that local tasks are safe', () => {
    expect(friendlyAuthError({ message: 'Failed to fetch' })).toMatch(/still saved on this device/);
  });
});

describe('AuthService (#11)', () => {
  it('is unavailable without a client, and the app stays in guest mode', async () => {
    const auth = new AuthService(null);
    expect(auth.isAvailable()).toBe(false);
    expect(await auth.getUser()).toBeNull();
  });

  it('does not contact the server when the details are invalid', async () => {
    const client = fakeClient();
    const result = await new AuthService(client).signIn({ email: 'bad', password: 'longenough' });
    expect(result.error).toMatch(/valid email/);
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with a trimmed email', async () => {
    const client = fakeClient();
    const result = await new AuthService(client).signIn({ email: '  a@b.co ', password: 'longenough' });
    expect(result.error).toBeNull();
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'longenough' });
  });

  it('turns a server error into a friendly message', async () => {
    const client = fakeClient({
      auth: { signInWithPassword: vi.fn(async () => ({ data: {}, error: { message: 'Invalid login credentials' } })) },
    });
    const result = await new AuthService(client).signIn({ email: 'a@b.co', password: 'longenough' });
    expect(result.error).toBe('That email and password do not match.');
  });

  it('sends the display name with sign-up and reports when email confirmation is needed', async () => {
    const client = fakeClient({
      auth: { signUp: vi.fn(async () => ({ data: { user: { id: 'u1' }, session: null }, error: null })) },
    });
    const result = await new AuthService(client).signUp({ email: 'a@b.co', password: 'longenough', name: ' Gideon ' });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.co', password: 'longenough', options: { data: { display_name: 'Gideon' } },
    });
    expect(result.needsConfirmation).toBe(true);
  });

  it('deletes the account through the database function, then signs out', async () => {
    const client = fakeClient();
    const error = await new AuthService(client).deleteAccount();
    expect(error).toBeNull();
    expect(client.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('starts in guest mode when Supabase is not loaded on the page', () => {
    window.TASKLINE_CONFIG = { supabaseUrl: 'https://example.supabase.co', supabaseKey: 'sb_publishable_test' };
    delete window.supabase;
    expect(AuthService.fromConfig().isAvailable()).toBe(false);
  });
});
