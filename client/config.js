/**
 * KART BRAWL - Client Environment & Production Configuration
 * 
 * Provides runtime resolution of:
 * - Multiplayer Socket.IO Server URL (Render Web Service vs Localhost)
 * - REST API Endpoints (/api/config, /health)
 * - Supabase Credentials
 * 
 * Hierarchy for Server URL:
 * 1. window.KB_SERVER_URL (explicit global override)
 * 2. URL query parameter: ?server=https://your-app.onrender.com (persisted to localStorage)
 * 3. <meta name="kb-server-url" content="..."> tag
 * 4. localStorage key: 'kb_server_url'
 * 5. Production Default: https://kart-brawl.onrender.com (when hosted on Netlify / non-localhost)
 * 6. Localhost Default: "" (relative URL for local development server)
 */

(function(window) {
  'use strict';

  const hostname = window.location.hostname || '';
  const isLocal = ['localhost', '127.0.0.1', ''].includes(hostname) || hostname.endsWith('.local');

  const DEFAULT_PROD_SERVER = 'https://kart-brawl.onrender.com';
  const DEFAULT_SUPABASE_URL = 'https://jhnmeistdjzvmpafreum.supabase.co';
  const DEFAULT_SUPABASE_KEY = 'sb_publishable_BPAbRXUJxiOqL2TZRDJp8g_HRcQ78VZ';

  // 1. Check for URL parameter override (useful for testing backend before DNS cutover)
  let paramServerUrl = null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const sParam = urlParams.get('server');
    if (sParam && (sParam.startsWith('http://') || sParam.startsWith('https://'))) {
      paramServerUrl = sParam.replace(/\/+$/, '');
      localStorage.setItem('kb_server_url', paramServerUrl);
      console.log(`[KB Config] Server URL overridden from query parameter: ${paramServerUrl}`);
    }
  } catch (e) {}

  // 2. Check for meta tags
  const metaServerEl = document.querySelector('meta[name="kb-server-url"]');
  const metaServerUrl = metaServerEl && metaServerEl.content && !metaServerEl.content.includes('your-render-app')
    ? metaServerEl.content.trim().replace(/\/+$/, '')
    : null;

  const metaSupabaseUrlEl = document.querySelector('meta[name="supabase-url"]');
  const metaSupabaseUrl = metaSupabaseUrlEl && metaSupabaseUrlEl.content && !metaSupabaseUrlEl.content.includes('your-project')
    ? metaSupabaseUrlEl.content.trim()
    : null;

  const metaSupabaseKeyEl = document.querySelector('meta[name="supabase-publishable-key"]');
  const metaSupabaseKey = metaSupabaseKeyEl && metaSupabaseKeyEl.content && !metaSupabaseKeyEl.content.includes('your-key')
    ? metaSupabaseKeyEl.content.trim()
    : null;

  // 3. Resolve active Server URL
  let resolvedServerUrl = '';
  if (isLocal) {
    // In local development, always connect to local server by default
    resolvedServerUrl = window.KB_SERVER_URL || paramServerUrl || '';
  } else {
    // In production (e.g. Netlify), connect to Render backend
    resolvedServerUrl = window.KB_SERVER_URL ||
      paramServerUrl ||
      metaServerUrl ||
      localStorage.getItem('kb_server_url') ||
      DEFAULT_PROD_SERVER;
  }

  const resolvedSupabaseUrl = metaSupabaseUrl || (!isLocal ? DEFAULT_SUPABASE_URL : '');
  const resolvedSupabaseKey = metaSupabaseKey || (!isLocal ? DEFAULT_SUPABASE_KEY : '');

  const KB_CONFIG = {
    isLocal: isLocal,
    serverUrl: resolvedServerUrl,
    supabaseUrl: resolvedSupabaseUrl,
    supabasePublishableKey: resolvedSupabaseKey,

    /**
     * Resolves the target URL for Socket.IO connection.
     * Returns undefined for same-host (io() default on localhost), or full URL string for Render server.
     */
    getSocketUrl() {
      return this.serverUrl || undefined;
    },

    /**
     * Resolves an HTTP API endpoint (e.g. /api/config, /health)
     * Prefixing server URL if cross-origin, or returning relative path if same-origin.
     */
    getApiUrl(endpoint) {
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
      if (!this.serverUrl) return cleanEndpoint;
      return this.serverUrl + cleanEndpoint;
    },

    /**
     * Set a new server URL dynamically and persist it
     */
    setServerUrl(newUrl) {
      if (!newUrl) {
        this.serverUrl = isLocal ? '' : DEFAULT_PROD_SERVER;
        localStorage.removeItem('kb_server_url');
      } else {
        this.serverUrl = newUrl.replace(/\/+$/, '');
        localStorage.setItem('kb_server_url', this.serverUrl);
      }
      console.log(`[KB Config] Active Server URL updated: ${this.serverUrl || '(relative/local)'}`);
    }
  };

  window.KB_CONFIG = KB_CONFIG;
  console.log(`[KB Config] Initialized. Mode: ${isLocal ? 'DEVELOPMENT (local)' : 'PRODUCTION'}. Target Server: ${KB_CONFIG.serverUrl || '(same origin)'}`);

})(window);
