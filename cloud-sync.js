(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    supabaseUrl: (window.ABG_CONFIG && window.ABG_CONFIG.supabaseUrl) || '',
    supabaseAnonKey: (window.ABG_CONFIG && window.ABG_CONFIG.supabaseAnonKey) || '',
    workspaceId: (window.ABG_CONFIG && window.ABG_CONFIG.workspaceId) || 'autobroski-main',
    pin: (window.ABG_CONFIG && window.ABG_CONFIG.pin) || '123456',
    autosaveMs: (window.ABG_CONFIG && window.ABG_CONFIG.autosaveMs) || 300,
    appName: (window.ABG_CONFIG && window.ABG_CONFIG.appName) || 'AutoBroskiGroup'
  };

  const STORAGE_KEY = 'autoBroskiData';
  let supabaseClient = null;

  function getConfig() {
    return { ...DEFAULT_CONFIG, ...(window.ABG_CONFIG || {}) };
  }

  function safeParse(v, fallback = null) {
    try { return JSON.parse(v); } catch (e) { return fallback; }
  }

  function getAppData() {
    if (window.appData && typeof window.appData === 'object') return window.appData;
    return safeParse(localStorage.getItem(STORAGE_KEY), {});
  }

  function setAppData(data) {
    window.appData = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function setUiConnectionState(mode, message) {
    const banner = document.getElementById('connectionBanner');
    const mini = document.getElementById('syncStatusMini');
    if (!banner || !mini) return;

    if (mode === 'offline') {
      banner.classList.remove('hidden');
      banner.classList.add('offline');
      banner.textContent = 'OFFLINE OFFLINE OFFLINE';
      mini.textContent = message || 'Stato: offline locale';
    } else if (mode === 'syncing') {
      banner.classList.add('hidden');
      mini.textContent = message || 'Stato: sincronizzazione...';
    } else {
      banner.classList.add('hidden');
      mini.textContent = message || 'Stato: cloud attivo';
    }
  }

  function isSupabaseConfigured() {
    const c = getConfig();
    return Boolean(c.supabaseUrl && c.supabaseAnonKey);
  }

  async function loadSupabaseLibrary() {
    if (window.supabase && window.supabase.createClient) return true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Supabase CDN non disponibile'));
      document.head.appendChild(script);
    });
  }

  async function initSupabase() {
    if (!isSupabaseConfigured()) {
      setUiConnectionState('offline', 'Stato: config cloud mancante');
      return null;
    }
    if (supabaseClient) return supabaseClient;
    await loadSupabaseLibrary();
    const c = getConfig();
    supabaseClient = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey);
    return supabaseClient;
  }

  async function saveToCloud() {
    if (!navigator.onLine) {
      setUiConnectionState('offline', 'Stato: offline locale');
      return { ok: false, reason: 'browser-offline' };
    }
    if (!isSupabaseConfigured()) {
      setUiConnectionState('offline', 'Stato: config cloud mancante');
      return { ok: false, reason: 'not-configured' };
    }
    try {
      setUiConnectionState('syncing', 'Stato: sincronizzazione...');
      const client = await initSupabase();
      const config = getConfig();
      const data = getAppData();
      const payload = {
        workspace_id: config.workspaceId,
        payload: data,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('abg_workspaces').upsert(payload, { onConflict: 'workspace_id' });
      if (error) throw error;
      setUiConnectionState('online', 'Stato: cloud attivo');
      return { ok: true };
    } catch (err) {
      console.error('[cloud-sync] saveToCloud error:', err);
      setUiConnectionState('offline', 'Stato: offline locale');
      return { ok: false, reason: err.message || 'save-error' };
    }
  }

  async function loadFromCloud() {
    if (!navigator.onLine) {
      setUiConnectionState('offline', 'Stato: offline locale');
      return { ok: false, reason: 'browser-offline' };
    }
    if (!isSupabaseConfigured()) {
      setUiConnectionState('offline', 'Stato: config cloud mancante');
      return { ok: false, reason: 'not-configured' };
    }
    try {
      setUiConnectionState('syncing', 'Stato: caricamento cloud...');
      const client = await initSupabase();
      const config = getConfig();
      const { data, error } = await client
        .from('abg_workspaces')
        .select('workspace_id,payload,updated_at')
        .eq('workspace_id', config.workspaceId)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.payload) {
        setUiConnectionState('online', 'Stato: cloud vuoto');
        return { ok: true, empty: true };
      }
      setAppData(data.payload);
      setUiConnectionState('online', 'Stato: cloud attivo');
      return { ok: true, data: data.payload };
    } catch (err) {
      console.error('[cloud-sync] loadFromCloud error:', err);
      setUiConnectionState('offline', 'Stato: offline locale');
      return { ok: false, reason: err.message || 'load-error' };
    }
  }

  async function syncNow() {
    return await saveToCloud();
  }

  window.addEventListener('online', async () => {
    setUiConnectionState('syncing', 'Stato: connessione ripristinata');
    await syncNow();
  });

  window.addEventListener('offline', () => {
    setUiConnectionState('offline', 'Stato: offline locale');
  });

  window.AutoBroskiCloudSync = {
    getConfig,
    initSupabase,
    saveToCloud,
    loadFromCloud,
    syncNow,
    forceSync: syncNow
  };

  window.addEventListener('load', async () => {
    if (!navigator.onLine) {
      setUiConnectionState('offline', 'Stato: offline locale');
      return;
    }
    if (!isSupabaseConfigured()) {
      setUiConnectionState('offline', 'Stato: config cloud mancante');
      return;
    }
    const result = await loadFromCloud();
    if (!result.ok) setUiConnectionState('offline', 'Stato: offline locale');
  });
})();
