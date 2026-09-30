/**
 * KART BRAWL - Supabase Authentication & Player Profiles Foundation (Phase 7.2)
 * Client Authentication & Cloud Profile Synchronization Module
 */

(function(window) {
  'use strict';

  const AuthSystem = {
    client: null,
    isConfigured: false,
    user: null,
    profile: null,
    session: null,
    listeners: [],

    async init() {
      // 1. Check for server-provided Supabase configuration
      try {
        let pubKey = (window.KB_CONFIG && window.KB_CONFIG.supabasePublishableKey) || null;
        let url = (window.KB_CONFIG && window.KB_CONFIG.supabaseUrl) || null;

        // If not already provided via meta tags / client config, query server endpoint
        if (!url || !pubKey) {
          const configEndpoint = (window.KB_CONFIG && window.KB_CONFIG.getApiUrl)
            ? window.KB_CONFIG.getApiUrl('/api/config')
            : '/api/config';

          const res = await fetch(configEndpoint);
          if (res.ok) {
            const config = await res.json();
            pubKey = config.supabasePublishableKey || config.supabaseAnonKey;
            url = config.supabaseUrl;
          }
        }

        if (url && pubKey && typeof url === 'string' && url.startsWith('http') && !url.includes('your-project') && !url.includes('...')) {
          if (window.supabase && typeof window.supabase.createClient === 'function') {
            this.client = window.supabase.createClient(url, pubKey);
            this.isConfigured = true;
            console.log('⚡ Supabase Client initialized successfully with publishable key.');
          } else {
            console.warn('⚠️ Supabase JS SDK not loaded in browser.');
          }
        }
      } catch (err) {
        console.warn('Could not load Supabase configuration (offline/guest fallback active):', err);
      }

      // 2. Set up Auth State Observer if configured
      if (this.isConfigured && this.client) {
        try {
          const { data: { session } } = await this.client.auth.getSession();
          if (session && session.user) {
            this.session = session;
            this.user = session.user;
            await this.loadProfile();
          }

          this.client.auth.onAuthStateChange(async (event, session) => {
            console.log(`[Auth Event] ${event}`);
            this.session = session;
            this.user = session ? session.user : null;
            if (this.user) {
              await this.loadProfile();
            } else {
              this.profile = null;
            }
            this.notifyListeners();
            this.renderUI();
          });
        } catch (err) {
          console.warn('Session check failed:', err);
        }
      }

      this.renderUI();
      return this.isConfigured;
    },

    onAuthStateChange(cb) {
      if (typeof cb === 'function') this.listeners.push(cb);
    },

    notifyListeners() {
      this.listeners.forEach(cb => {
        try { cb(this.user, this.profile); } catch(e){}
      });
    },

    getUsername() {
      if (this.profile && this.profile.username) return this.profile.username;
      if (this.user && this.user.user_metadata && this.user.user_metadata.username) {
        return this.user.user_metadata.username;
      }
      return localStorage.getItem('kb_player_name') || 'KartPlayer';
    },

    isLoggedIn() {
      return !!this.user;
    },

    async loadProfile() {
      if (!this.client || !this.user) return null;
      try {
        const { data, error } = await this.client
          .from('profiles')
          .select('*')
          .eq('id', this.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error loading profile from Supabase:', error.message);
        }

        if (data) {
          this.profile = data;
          console.log(`👤 Loaded cloud profile for ${data.username} (Level ${data.level})`);

          // Apply saved loadout to client EquipmentSystem
          if (data.equipped_character && typeof window.EquipmentSystem !== 'undefined') {
            window.EquipmentSystem.equipItem('character', data.equipped_character);
          }
          if (data.equipped_kart && typeof window.EquipmentSystem !== 'undefined') {
            window.EquipmentSystem.equipItem('kartClass', data.equipped_kart);
          }
          if (data.username) {
            localStorage.setItem('kb_player_name', data.username);
          }
        } else {
          // If profile row doesn't exist yet, attempt creating one
          await this.createInitialProfile();
        }
      } catch (err) {
        console.warn('Failed to query profiles table:', err);
      }
      return this.profile;
    },

    async createInitialProfile() {
      if (!this.client || !this.user) return null;
      const rawName = (this.user.user_metadata && this.user.user_metadata.username) 
        || localStorage.getItem('kb_player_name') 
        || 'Racer_' + this.user.id.substring(0, 6);

      const newProfile = {
        id: this.user.id,
        username: rawName,
        display_name: rawName,
        equipped_character: localStorage.getItem('kb_equipped_character') || 'racer',
        equipped_kart: localStorage.getItem('kb_equipped_kart_class') || 'tank'
      };

      try {
        const { data, error } = await this.client
          .from('profiles')
          .insert([newProfile])
          .select()
          .single();

        if (!error && data) {
          this.profile = data;
        }
      } catch (err) {
        console.warn('Profile creation error:', err);
      }
      return this.profile;
    },

    async signUp(username, email, password) {
      // 1. Validation Checks
      const cleanUser = String(username || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      if (!cleanUser) return { success: false, error: 'Username is required.' };
      if (cleanUser.length < 3 || cleanUser.length > 20) {
        return { success: false, error: 'Username must be between 3 and 20 characters.' };
      }
      if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
        return { success: false, error: 'Username may only contain letters, numbers, and underscores.' };
      }
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (cleanPass.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }

      if (!this.isConfigured || !this.client) {
        return {
          success: false,
          error: 'Supabase credentials are not configured yet in .env! (Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env).'
        };
      }

      try {
        const { data, error } = await this.client.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: {
            data: {
              username: cleanUser,
              display_name: cleanUser
            }
          }
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data && data.user) {
          this.user = data.user;
          this.session = data.session;
          localStorage.setItem('kb_player_name', cleanUser);
          await this.loadProfile();
          this.renderUI();
          return { success: true, user: data.user, session: data.session };
        }

        return { success: true, message: 'Check your email for confirmation link if required!' };
      } catch (err) {
        return { success: false, error: err.message || 'Network error during signup.' };
      }
    },

    async signIn(email, password) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (!cleanPass) {
        return { success: false, error: 'Password is required.' };
      }

      if (!this.isConfigured || !this.client) {
        return {
          success: false,
          error: 'Supabase credentials are not configured yet in .env! (Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env).'
        };
      }

      try {
        const { data, error } = await this.client.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass
        });

        if (error) {
          return { success: false, error: error.message };
        }

        if (data && data.user) {
          this.user = data.user;
          this.session = data.session;
          await this.loadProfile();
          this.renderUI();
          return { success: true, user: data.user, session: data.session };
        }

        return { success: false, error: 'Login failed to return an authenticated session.' };
      } catch (err) {
        return { success: false, error: err.message || 'Network error during login.' };
      }
    },

    async signOut() {
      if (this.client) {
        try {
          await this.client.auth.signOut();
        } catch (e) {
          console.warn('Signout warning:', e);
        }
      }
      this.user = null;
      this.session = null;
      this.profile = null;
      this.renderUI();
      this.notifyListeners();
      return { success: true };
    },

    async updateProfile(updates = {}) {
      if (!this.client || !this.user) return false;
      try {
        const { error } = await this.client
          .from('profiles')
          .update(updates)
          .eq('id', this.user.id);

        if (!error) {
          if (this.profile) Object.assign(this.profile, updates);
          console.log('Cloud profile updated:', updates);
          return true;
        } else {
          console.warn('Profile update error:', error.message);
          return false;
        }
      } catch (err) {
        console.warn('Profile update network error:', err);
        return false;
      }
    },

    renderUI() {
      // 1. Update Menu Display Name
      const nameEl = document.getElementById('menuPlayerNameDisplay');
      const avatarEl = document.getElementById('menuAvatar');
      const authStatusBtn = document.getElementById('menuAuthBtn');
      const inputEl = document.getElementById('playerNameInput');

      const uname = this.getUsername();
      if (nameEl) nameEl.textContent = uname;
      if (avatarEl) {
        avatarEl.textContent = uname.substring(0, 2).toUpperCase();
      }
      if (inputEl && !this.user) {
        inputEl.value = uname;
      }

      // 2. Auth Status Pill / Action Button
      if (authStatusBtn) {
        if (this.user) {
          authStatusBtn.innerHTML = 'LOG OUT 🚪';
          authStatusBtn.className = 'kb-btn-auth kb-btn-logout';
          authStatusBtn.title = 'Log out of account';
          authStatusBtn.onclick = () => {
            this.signOut().then(() => {
              if (typeof window.flashCenterMsg === 'function') {
                window.flashCenterMsg('👋 LOGGED OUT — PLAYING AS GUEST');
              }
            });
          };
        } else {
          authStatusBtn.innerHTML = 'LOGIN / SIGN UP 🔑';
          authStatusBtn.className = 'kb-btn-auth kb-btn-login';
          authStatusBtn.title = 'Create an account or login';
          authStatusBtn.onclick = () => {
            window.openAuthModal();
          };
        }
      }
    }
  };

  window.AuthSystem = AuthSystem;

  // Initialize on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AuthSystem.init());
  } else {
    AuthSystem.init();
  }

})(window);
