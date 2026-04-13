// AutoBroskiGroup - Cloud Sync Module
// Gestisce sincronizzazione dati con Supabase, autosalvataggio e cronologia

(function() {
  'use strict';

  // Configurazione
  const CONFIG = window.ABG_CONFIG || {
    supabaseUrl: '',
    supabaseAnonKey: '',
    workspaceId: 'autobroski-main',
    pin: '845620',
    autosaveMs: 1200,
    appName: 'AutoBroskiGroup'
  };

  // Stato sincronizzazione
  let supabaseClient = null;
  let isOnline = false;
  let autosaveTimer = null;
  let lastSyncTime = null;

  // Inizializza Supabase se configurato
  function initSupabase() {
    if (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
        isOnline = true;
        console.log('[CloudSync] Supabase connesso');
        loadFromCloud();
        startAutosave();
      } catch (e) {
        console.warn('[CloudSync] Errore connessione Supabase:', e);
        isOnline = false;
      }
    } else {
      console.log('[CloudSync] Modalità locale (Supabase non configurato)');
      isOnline = false;
    }
  }

  // Carica dati dal cloud
  async function loadFromCloud() {
    if (!isOnline || !supabaseClient) return;
    
    try {
      const { data, error } = await supabaseClient
        .from('abg_workspaces')
        .select('*')
        .eq('workspace_id', CONFIG.workspaceId)
        .single();

      if (error) {
        console.warn('[CloudSync] Workspace non trovato, verrà creato al primo salvataggio');
        return;
      }

      if (data && data.data) {
        const cloudData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
        window.appData = { ...window.appData, ...cloudData };
        localStorage.setItem('autoBroskiData', JSON.stringify(window.appData));
        lastSyncTime = new Date();
        console.log('[CloudSync] Dati caricati dal cloud');
        
        // Aggiorna UI se necessario
        if (typeof window.updateLogo === 'function') window.updateLogo();
        if (typeof window.updateHistory === 'function') window.updateHistory();
      }
    } catch (e) {
      console.error('[CloudSync] Errore caricamento:', e);
    }
  }

  // Salva dati sul cloud
  async function saveToCloud() {
    if (!isOnline || !supabaseClient) return;
    
    try {
      const dataToSave = {
        workspace_id: CONFIG.workspaceId,
        data: window.appData,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabaseClient
        .from('abg_workspaces')
        .upsert(dataToSave);

      if (error) throw error;

      lastSyncTime = new Date();
      console.log('[CloudSync] Dati sincronizzati sul cloud');
    } catch (e) {
      console.error('[CloudSync] Errore salvataggio:', e);
    }
  }

  // Autosalvataggio
  function startAutosave() {
    if (autosaveTimer) clearInterval(autosaveTimer);
    
    autosaveTimer = setInterval(() => {
      if (window.appData) {
        localStorage.setItem('autoBroskiData', JSON.stringify(window.appData));
        if (isOnline) saveToCloud();
      }
    }, CONFIG.autosaveMs);
    
    console.log(`[CloudSync] Autosave attivo ogni ${CONFIG.autosaveMs}ms`);
  }

  // Verifica PIN
  function checkPIN() {
    const savedData = localStorage.getItem('autoBroskiData');
    const currentPIN = savedData ? JSON.parse(savedData).pin : CONFIG.pin;
    
    const userPIN = prompt(`Inserisci il PIN di accesso a ${CONFIG.appName}:`);
    
    if (userPIN !== currentPIN) {
      alert('PIN non corretto');
      window.location.href = 'about:blank';
      return false;
    }
    
    return true;
  }

  // Gestione cronologia
  window.addHistory = function(type, action) {
    if (!window.appData) return;
    
    const entry = {
      date: new Date().toLocaleString('it-IT'),
      type: type,
      action: action
    };
    
    if (!window.appData.history) window.appData.history = [];
    window.appData.history.unshift(entry);
    
    if (window.appData.history.length > 50) {
      window.appData.history = window.appData.history.slice(0, 50);
    }
    
    if (typeof window.saveData === 'function') window.saveData();
    if (typeof window.updateHistory === 'function') window.updateHistory();
  };

  // Export/Import dati
  window.exportData = function() {
    const dataStr = JSON.stringify(window.appData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AutoBroskiGroup-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addHistory('Sistema', 'Dati esportati');
  };

  window.importData = function(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const imported = JSON.parse(e.target.result);
        if (confirm('Importare questi dati? I dati attuali verranno sovrascritti.')) {
          window.appData = imported;
          if (typeof window.saveData === 'function') window.saveData();
          if (isOnline) saveToCloud();
          addHistory('Sistema', 'Dati importati');
          alert('Dati importati con successo!');
          location.reload();
        }
      } catch (err) {
        alert('Errore: file non valido');
      }
    };
    reader.readAsText(file);
  };

  // Inizializzazione al caricamento pagina
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }

  // Esponi stato sync
  window.CloudSync = {
    isOnline: () => isOnline,
    lastSync: () => lastSyncTime,
    forceSync: saveToCloud
  };

})();