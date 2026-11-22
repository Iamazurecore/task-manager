/* ========================================================
   account.js — FEAT #11: the account button and the panel
   that slides in from the right (sign in, create account,
   profile, sign out, delete account, theme).
   All text is set with textContent, never innerHTML.
   ======================================================== */

class AccountPanel {
  /**
   * @param {AuthService} auth
   * @param {{onToggleTheme: Function, notify: Function}} hooks
   */
  constructor(auth, hooks) {
    this.auth = auth;
    this.hooks = hooks;
    this.user = null;
    this.mode = 'signin'; // or 'signup'

    this.button = document.getElementById('accountBtn');
    this.panel = document.getElementById('accountPanel');
    this.backdrop = document.getElementById('accountBackdrop');
    this.guestView = document.getElementById('accountGuest');
    this.userView = document.getElementById('accountUser');
    this.form = document.getElementById('accountForm');
    this.nameField = document.getElementById('accountNameField');
    this.message = document.getElementById('accountMessage');
    this.submitBtn = document.getElementById('accountSubmit');
    this.confirmDelete = document.getElementById('accountConfirmDelete');

    this._bind();
    this._render();

    if (this.auth.isAvailable()) {
      this.auth.getUser().then((user) => this._setUser(user));
      this.auth.onChange((user) => this._setUser(user));
    }
  }

  open() {
    this.panel.hidden = false;
    this.backdrop.hidden = false;
    // next frame, so the slide-in transition runs
    requestAnimationFrame(() => this.panel.classList.add('is-open'));
    this.button.setAttribute('aria-expanded', 'true');
    const first = this.panel.querySelector('input:not([hidden]), button.account__close');
    if (first) first.focus();
  }

  close() {
    this.panel.classList.remove('is-open');
    this.panel.hidden = true;
    this.backdrop.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    this.confirmDelete.hidden = true;
    this.button.focus();
  }

  isOpen() {
    return !this.panel.hidden;
  }

  _bind() {
    this.button.addEventListener('click', () => (this.isOpen() ? this.close() : this.open()));
    this.backdrop.addEventListener('click', () => this.close());
    this.panel.querySelector('.account__close').addEventListener('click', () => this.close());
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    });

    document.getElementById('accountModeSignIn').addEventListener('click', () => this._setMode('signin'));
    document.getElementById('accountModeSignUp').addEventListener('click', () => this._setMode('signup'));
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });

    document.getElementById('accountTheme').addEventListener('click', () => this.hooks.onToggleTheme());
    document.getElementById('accountSignOut').addEventListener('click', () => this._signOut());
    document.getElementById('accountDelete').addEventListener('click', () => {
      this.confirmDelete.hidden = false;
    });
    document.getElementById('accountDeleteCancel').addEventListener('click', () => {
      this.confirmDelete.hidden = true;
    });
    document.getElementById('accountDeleteConfirm').addEventListener('click', () => this._deleteAccount());
  }

  _setMode(mode) {
    this.mode = mode;
    this._say('');
    this._render();
  }

  _setUser(user) {
    this.user = user;
    this._render();
  }

  _say(text, isError = false) {
    this.message.textContent = text;
    this.message.classList.toggle('is-error', isError);
  }

  async _submit() {
    const email = document.getElementById('accountEmail').value;
    const password = document.getElementById('accountPassword').value;
    const name = document.getElementById('accountName').value;

    this.submitBtn.disabled = true;
    this._say(this.mode === 'signup' ? 'Creating your account…' : 'Signing in…');
    const result = this.mode === 'signup'
      ? await this.auth.signUp({ email, password, name })
      : await this.auth.signIn({ email, password });
    this.submitBtn.disabled = false;

    if (result.error) {
      this._say(result.error, true);
      return;
    }
    document.getElementById('accountPassword').value = '';
    if (result.needsConfirmation) {
      this._setMode('signin');
      this._say('Account created. Check your email and click the link to confirm, then sign in.');
      return;
    }
    this._setUser(result.user);
    this.hooks.notify('Signed in.');
  }

  async _signOut() {
    await this.auth.signOut();
    this._setUser(null);
    this.hooks.notify('Signed out. Your tasks are still on this device.');
  }

  async _deleteAccount() {
    const error = await this.auth.deleteAccount();
    if (error) {
      this._say(error, true);
      return;
    }
    this._setUser(null);
    this.close();
    this.hooks.notify('Your account and cloud data were deleted. Tasks on this device were kept.');
  }

  _render() {
    const signedIn = Boolean(this.user);
    const meta = (this.user && this.user.user_metadata) || {};
    const name = meta.display_name || '';
    const email = (this.user && this.user.email) || '';

    // Header button: "Sign in" for guests, initials for a signed-in user.
    this.button.textContent = signedIn ? initialsFor(name, email) : 'Sign in';
    this.button.classList.toggle('is-avatar', signedIn);
    this.button.setAttribute('aria-label', signedIn ? `Account: ${name || email}` : 'Sign in or create an account');

    this.guestView.hidden = signedIn;
    this.userView.hidden = !signedIn;

    if (!signedIn) {
      const isSignUp = this.mode === 'signup';
      this.nameField.hidden = !isSignUp;
      this.submitBtn.textContent = isSignUp ? 'Create account' : 'Sign in';
      document.getElementById('accountPassword').autocomplete = isSignUp ? 'new-password' : 'current-password';
      document.getElementById('accountModeSignIn').classList.toggle('is-active', !isSignUp);
      document.getElementById('accountModeSignUp').classList.toggle('is-active', isSignUp);
      document.getElementById('accountUnavailable').hidden = this.auth.isAvailable();
      this.form.hidden = !this.auth.isAvailable();
    } else {
      document.getElementById('accountAvatar').textContent = initialsFor(name, email);
      document.getElementById('accountDisplayName').textContent = name || 'No name set';
      document.getElementById('accountEmailShown').textContent = email;
    }
  }
}

/* Lets the automated tests load this file in Node. Browsers skip this block. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AccountPanel };
}
