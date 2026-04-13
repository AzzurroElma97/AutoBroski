(function(){
  const STORAGE_KEY = 'abg_v5';
  const cfg = window.ABG_CONFIG || {};
  let supabase = null;
  let saveTimer = null;
  let syncing = false;
  let channel = null;
  let lastStamp = '';

  function $(id){ return document.getElementById(id); }
  function safeJson(v){ try { return JSON.parse(v); } catch(e){ return null; } }
  function hasCloud(){ return !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase); }
  function status(text, tone){
    const el = $('abgSyncStatus');
    if(!el) return;
    el.textContent = text;
    el.dataset.tone = tone || 'idle';
  }
  function collectSnapshot(){
    return {
      cars: Array.isArray(window.state?.cars) ? window.state.cars : [],
      clients: Array.isArray(window.state?.clients) ? window.state.clients : [],
      deadlines: Array.isArray(window.state?.deadlines) ? window.state.deadlines : [],
      docs: Array.isArray(window.state?.docs) ? window.state.docs : [],
      settings: typeof window.collectSettings === 'function' ? window.collectSettings() : (window.state?.settings || {}),
      theme: document.documentElement.dataset.theme || 'dark'
    };
  }
  function applySnapshot(d){
    if(!window.state || !d) return;
    window.state.cars = d.cars || [];
    window.state.clients = d.clients || [];
    window.state.deadlines = d.deadlines || [];
    window.state.docs = d.docs || [];
    window.state.settings = d.settings || {};
    if(d.theme) document.documentElement.dataset.theme = d.theme;
    if(typeof window.fillSettings === 'function') window.fillSettings();
    if(typeof window.updateThemeThumb === 'function') window.updateThemeThumb();
    if(typeof window.renderAll === 'function') window.renderAll();
  }
  function persistLocal(snapshot){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot || collectSnapshot()));
  }
  async function saveRemote(snapshot){
    if(!supabase || syncing) return;
    syncing = true;
    status('Sincronizzazione...', 'busy');
    const payload = snapshot || collectSnapshot();
    const stamp = new Date().toISOString();
    const row = { workspace_id: cfg.workspaceId || 'autobroski-main', payload, updated_at: stamp };
    const { error } = await supabase.from('abg_workspaces').upsert(row);
    syncing = false;
    if(error){ status('Errore sync', 'err'); return; }
    lastStamp = stamp;
    status('Salvato online', 'ok');
  }
  function queueRemoteSave(){
    persistLocal();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(()=>saveRemote(), Number(cfg.autosaveMs || 1200));
  }
  async function loadRemote(){
    if(!supabase) return null;
    const { data, error } = await supabase.from('abg_workspaces').select('payload,updated_at').eq('workspace_id', cfg.workspaceId || 'autobroski-main').maybeSingle();
    if(error) return null;
    return data || null;
  }
  function installOverrides(){
    window.persist = function(){ queueRemoteSave(); };
    window.hydrate = function(){
      const raw = localStorage.getItem(STORAGE_KEY);
      const d = raw ? safeJson(raw) : null;
      if(d) applySnapshot(d);
    };
  }
  async function connectRealtime(){
    if(!supabase) return;
    if(channel){ try { await supabase.removeChannel(channel); } catch(e){} }
    channel = supabase.channel('abg-sync-' + (cfg.workspaceId || 'autobroski-main'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'abg_workspaces', filter: 'workspace_id=eq.' + (cfg.workspaceId || 'autobroski-main') }, payload => {
        const row = payload.new || {};
        if(!row.payload) return;
        if(row.updated_at && row.updated_at === lastStamp) return;
        lastStamp = row.updated_at || '';
        persistLocal(row.payload);
        applySnapshot(row.payload);
        status('Aggiornato da un altro dispositivo', 'ok');
      })
      .subscribe();
  }
  async function bootCloud(){
    if(!hasCloud()){
      status('Modalità locale', 'idle');
      return;
    }
    supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    installOverrides();
    const remote = await loadRemote();
    const local = safeJson(localStorage.getItem(STORAGE_KEY) || 'null');
    if(remote && remote.payload){
      lastStamp = remote.updated_at || '';
      persistLocal(remote.payload);
      applySnapshot(remote.payload);
      status('Dati cloud caricati', 'ok');
    } else if(local){
      applySnapshot(local);
      await saveRemote(local);
    } else {
      await saveRemote(collectSnapshot());
    }
    connectRealtime();
  }
  function buildOverlay(){
    const style = document.createElement('style');
    style.textContent = `
    .abg-lock{position:fixed;inset:0;background:rgba(5,10,20,.82);backdrop-filter:blur(10px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
    .abg-card{width:min(420px,100%);background:#071225;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:22px;color:#eef6ff;box-shadow:0 20px 60px rgba(0,0,0,.35)}
    .abg-card h2{margin:0 0 8px;font-size:1.45rem}.abg-card p{margin:0 0 14px;color:#9bb0c8;line-height:1.5}
    .abg-pin{width:100%;padding:16px 18px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:#0e1a30;color:#fff;font-size:1.25rem;letter-spacing:.35em;text-align:center;outline:none}
    .abg-btn{margin-top:12px;width:100%;padding:14px 18px;border:none;border-radius:18px;background:linear-gradient(135deg,#2fb4ff,#1d6fff);color:#fff;font-weight:800;cursor:pointer}
    .abg-mini{margin-top:12px;font-size:.88rem;color:#8da2ba}.abg-error{margin-top:10px;color:#ff8f8f;min-height:1.2em}
    .abg-sync{position:fixed;right:14px;bottom:14px;z-index:80;padding:10px 12px;border-radius:999px;background:rgba(7,18,37,.82);border:1px solid rgba(255,255,255,.08);color:#dfeaff;font-size:.8rem;backdrop-filter:blur(10px)}
    .abg-sync[data-tone="ok"]{border-color:rgba(47,180,255,.35);color:#86dbff}.abg-sync[data-tone="err"]{border-color:rgba(255,102,102,.35);color:#ffabab}
    .abg-sync[data-tone="busy"]{border-color:rgba(226,161,44,.35);color:#ffd56c}`;
    document.head.appendChild(style);

    const sync = document.createElement('div');
    sync.id = 'abgSyncStatus';
    sync.className = 'abg-sync';
    sync.dataset.tone = 'idle';
    sync.textContent = 'Avvio...';
    document.body.appendChild(sync);

    const wrap = document.createElement('div');
    wrap.id = 'abgLock';
    wrap.className = 'abg-lock';
    wrap.innerHTML = `
      <div class="abg-card">
        <h2>${cfg.appName || 'AutoBroskiGroup'}</h2>
        <p>Accesso rapido con PIN a 6 cifre. È semplice da usare su più dispositivi. Per un livello di sicurezza alto conviene poi aggiungere un vero login.</p>
        <input id="abgPin" class="abg-pin" type="password" inputmode="numeric" maxlength="6" placeholder="123456" />
        <button id="abgEnter" class="abg-btn">Entra</button>
        <div id="abgErr" class="abg-error"></div>
        <div class="abg-mini">Se configuri Supabase, i dati si salvano online e si sincronizzano in tempo reale.</div>
      </div>`;
    document.body.appendChild(wrap);

    const go = async () => {
      const pin = ($('abgPin').value || '').trim();
      if(pin !== String(cfg.pin || '123456')){
        $('abgErr').textContent = 'PIN non corretto';
        return;
      }
      wrap.remove();
      status(hasCloud() ? 'Connessione cloud...' : 'Modalità locale', 'idle');
      await bootCloud();
    };
    $('abgEnter').addEventListener('click', go);
    $('abgPin').addEventListener('keydown', e => { if(e.key === 'Enter') go(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    installOverrides();
    buildOverlay();
    document.addEventListener('input', e => {
      if(!document.body.contains(e.target)) return;
      if(e.target && e.target.id !== 'abgPin') queueRemoteSave();
    }, true);
    document.addEventListener('change', e => {
      if(!document.body.contains(e.target)) return;
      queueRemoteSave();
    }, true);
    window.addEventListener('beforeunload', () => { try { persistLocal(); } catch(e){} });
  });
})();
