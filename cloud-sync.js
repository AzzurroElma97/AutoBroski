(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    supabaseUrl: (window.CONFIG && window.CONFIG.supabaseUrl) || '',
    supabaseAnonKey: (window.CONFIG && window.CONFIG.supabaseAnonKey) || '',
    workspaceId: (window.CONFIG && window.CONFIG.workspaceId) || 'autobroski-main',
    pin: (window.CONFIG && window.CONFIG.pin) || '845620',
    autosaveMs: (window.CONFIG && window.CONFIG.autosaveMs) || 1200,
    appName: (window.CONFIG && window.CONFIG.appName) || 'AutoBroskiGroup'
  };

  const STORAGE_KEY = 'autoBroskiData';
  const CLOUD_TS_KEY = 'autoBroskiCloudLastSync';
  const MODE_KEY = 'autoBroskiCloudMode';

  let supabaseClient = null;
  let autosaveTimer = null;
  let isSaving = false;
  let lastSerialized = '';

  function safeParse(json, fallback = null) {
    try {
      return JSON.parse(json);
    } catch (err) {
      return fallback;
    }
  }

  function getConfig() {
    return { ...DEFAULT_CONFIG, ...(window.CONFIG || {}) };
  }

  function getAppData() {
    if (window.appData && typeof window.appData === 'object') return window.appData;
    const raw = localStorage.getItem(STORAGE_KEY);
    return safeParse(raw, {});
  }

  function setAppData(data) {
    window.appData = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getMode() {
    return localStorage.getItem(MODE_KEY) || 'local';
  }

  function setMode(mode) {
    localStorage.setItem(MODE_KEY, mode);
    updateStatusBadge();
  }

  function getLastSync() {
    return localStorage.getItem(CLOUD_TS_KEY) || '';
  }

  function setLastSync(ts) {
    localStorage.setItem(CLOUD_TS_KEY, ts || new Date().toISOString());
    updateStatusBadge();
  }

  function isSupabaseConfigured() {
    const config = getConfig();
    return Boolean(config.supabaseUrl && config.supabaseAnonKey);
  }

  async function loadSupabaseLibrary() {
    if (window.supabase && window.supabase.createClient) return true;
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-supabase-cdn="1"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.dataset.supabaseCdn = '1';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Impossibile caricare libreria Supabase'));
      document.head.appendChild(script);
    });
  }

  async function initSupabase() {
    if (!isSupabaseConfigured()) {
      setMode('local');
      return null;
    }
    if (supabaseClient) return supabaseClient;
    await loadSupabaseLibrary();
    const config = getConfig();
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    setMode('cloud');
    return supabaseClient;
  }

  async function saveToCloud(force = false) {
    if (isSaving) return { ok: false, reason: 'busy' };
    if (!isSupabaseConfigured()) {
      setMode('local');
      return { ok: false, reason: 'not-configured' };
    }

    const data = getAppData();
    const serialized = JSON.stringify(data);
    if (!force && serialized === lastSerialized) {
      return { ok: true, skipped: true };
    }

    isSaving = true;
    try {
      const client = await initSupabase();
      const config = getConfig();
      const payload = {
        workspace_id: config.workspaceId,
        data,
        updated_at: new Date().toISOString()
      };

      const { error } = await client
        .from('abg_workspaces')
        .upsert(payload, { onConflict: 'workspace_id' });

      if (error) throw error;
      lastSerialized = serialized;
      setLastSync(new Date().toLocaleString('it-IT'));
      setMode('cloud');
      emitSyncEvent('cloud-save-success');
      return { ok: true };
    } catch (err) {
      console.error('[cloud-sync] saveToCloud error:', err);
      setMode('local');
      emitSyncEvent('cloud-save-error', err);
      return { ok: false, reason: err.message || 'save-error' };
    } finally {
      isSaving = false;
    }
  }

  async function loadFromCloud() {
    if (!isSupabaseConfigured()) {
      setMode('local');
      return { ok: false, reason: 'not-configured' };
    }
    try {
      const client = await initSupabase();
      const config = getConfig();
      const { data, error } = await client
        .from('abg_workspaces')
        .select('workspace_id,data,updated_at')
        .eq('workspace_id', config.workspaceId)
        .maybeSingle();

      if (error) throw error;
      if (!data || !data.data) {
        emitSyncEvent('cloud-load-empty');
        return { ok: true, empty: true };
      }

      setAppData(data.data);
      lastSerialized = JSON.stringify(data.data);
      setLastSync(new Date(data.updated_at || Date.now()).toLocaleString('it-IT'));
      setMode('cloud');
      emitSyncEvent('cloud-load-success', data.data);
      return { ok: true, data: data.data };
    } catch (err) {
      console.error('[cloud-sync] loadFromCloud error:', err);
      setMode('local');
      emitSyncEvent('cloud-load-error', err);
      return { ok: false, reason: err.message || 'load-error' };
    }
  }

  function exportCloudBackup() {
    const data = getAppData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AutoBroskiGroup-cloud-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    emitSyncEvent('cloud-backup-exported');
  }

  async function forceSync() {
    const result = await saveToCloud(true);
    updateStatusBadge();
    return result;
  }

  function startAutosave() {
    stopAutosave();
    const config = getConfig();
    autosaveTimer = setInterval(async () => {
      const data = getAppData();
      const serialized = JSON.stringify(data);
      if (serialized === lastSerialized) return;
      localStorage.setItem(STORAGE_KEY, serialized);
      if (isSupabaseConfigured()) await saveToCloud(false);
    }, config.autosaveMs || 1200);
    emitSyncEvent('autosave-started');
  }

  function stopAutosave() {
    if (autosaveTimer) clearInterval(autosaveTimer);
    autosaveTimer = null;
  }

  function clearCloudStatus() {
    localStorage.removeItem(CLOUD_TS_KEY);
    localStorage.removeItem(MODE_KEY);
    updateStatusBadge();
  }

  function emitSyncEvent(name, detail = null) {
    window.dispatchEvent(new CustomEvent('abg-cloud-sync', { detail: { name, detail } }));
  }

  function ensureStatusContainer() {
    let box = document.getElementById('cloudSyncStatus');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'cloudSyncStatus';
    box.style.marginTop = '12px';
    box.style.padding = '12px 14px';
    box.style.borderRadius = '12px';
    box.style.background = 'rgba(255,255,255,.04)';
    box.style.border = '1px solid rgba(255,255,255,.08)';
    box.style.fontSize = '14px';

    const settingsPage = document.getElementById('page-impostazioni');
    const inner = settingsPage ? settingsPage.querySelector('.section-inner') : null;
    if (inner) inner.appendChild(box);
    return box;
  }

  function updateStatusBadge() {
    const box = ensureStatusContainer();
    const mode = getMode();
    const lastSync = getLastSync();
    box.innerHTML = `
      <strong>Cloud Sync</strong><br>
      Modalità: <span>${mode === 'cloud' ? 'Cloud' : 'Locale'}</span><br>
      Ultima sincronizzazione: <span>${lastSync || 'mai'}</span><br>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button id="btnCloudLoad" style="min-height:40px;padding:8px 12px;border-radius:10px;border:0;cursor:pointer;">Carica da Cloud</button>
        <button id="btnCloudSave" style="min-height:40px;padding:8px 12px;border-radius:10px;border:0;cursor:pointer;">Forza Sync</button>
        <button id="btnCloudExport" style="min-height:40px;padding:8px 12px;border-radius:10px;border:0;cursor:pointer;">Export Backup</button>
        <button id="btnCloudReset" style="min-height:40px;padding:8px 12px;border-radius:10px;border:0;cursor:pointer;">Reset Stato</button>
      </div>
    `;

    box.querySelector('#btnCloudLoad').onclick = async () => {
      const result = await loadFromCloud();
      if (result.ok && window.location) setTimeout(() => window.location.reload(), 400);
    };
    box.querySelector('#btnCloudSave').onclick = async () => {
      await forceSync();
      updateStatusBadge();
    };
    box.querySelector('#btnCloudExport').onclick = () => exportCloudBackup();
    box.querySelector('#btnCloudReset').onclick = () => clearCloudStatus();
  }

  async function initCloudSync() {
    const localRaw = localStorage.getItem(STORAGE_KEY);
    const localData = safeParse(localRaw, null);
    if (localData) lastSerialized = JSON.stringify(localData);

    if (isSupabaseConfigured()) {
      await initSupabase();
    } else {
      setMode('local');
    }

    updateStatusBadge();
    startAutosave();
    emitSyncEvent('cloud-sync-ready');
  }

  window.AutoBroskiCloudSync = {
    getConfig,
    initSupabase,
    loadFromCloud,
    saveToCloud,
    startAutosave,
    stopAutosave,
    forceSync,
    exportCloudBackup,
    clearCloudStatus,
    updateStatusBadge,
    initCloudSync
  };

  window.addEventListener('load', function () {
    initCloudSync().catch(err => {
      console.error('[cloud-sync] init error:', err);
      setMode('local');
      updateStatusBadge();
    });
  });
})();
