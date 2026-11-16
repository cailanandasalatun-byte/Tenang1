/* =============================================================
   TENANG – App.js  (Vanilla JS, zero dependencies)
   Works directly on GitHub Pages – no build step needed.
   ============================================================= */
'use strict';

// ─── Storage ────────────────────────────────────────────────
const DB = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── State ──────────────────────────────────────────────────
const State = {
  profile: DB.get('tenang_profile', {
    name:'', goals:[], dailyLimitMinutes:60, riskyHours:null, onboardingDone:false,
    theme:'system', language:'id', defaultSessionMinutes:15, createdAt:new Date().toISOString(),
  }),
  sessions: DB.get('tenang_sessions', []),
  daily:    DB.get('tenang_daily', {}),

  saveProfile()  { DB.set('tenang_profile',  this.profile); },
  saveSessions() { DB.set('tenang_sessions', this.sessions); },
  saveDaily()    { DB.set('tenang_daily',    this.daily); },
  todayKey()     { return new Date().toISOString().slice(0,10); },

  getDaily(dk) {
    return this.daily[dk] ?? { date:dk, totalMinutes:0, sessionCount:0,
      limitMinutes:this.profile.dailyLimitMinutes, underLimit:true,
      avgMoodBefore:null, avgMoodAfter:null };
  },

  addSession(s) {
    this.sessions.push(s);
    this.saveSessions();
    this._rebuildDay(s.date ?? this.todayKey());
  },

  _rebuildDay(dk) {
    const ss = this.sessions.filter(s => s.date === dk);
    const total = ss.reduce((a,s) => a + (s.actualMinutes ?? s.plannedMinutes), 0);
    const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
    this.daily[dk] = {
      date:dk, totalMinutes:total, sessionCount:ss.length,
      limitMinutes:this.profile.dailyLimitMinutes,
      underLimit: total <= this.profile.dailyLimitMinutes,
      avgMoodBefore: avg(ss.map(s=>s.moodBefore).filter(Boolean)),
      avgMoodAfter:  avg(ss.map(s=>s.moodAfter).filter(Boolean)),
    };
    this.saveDaily();
  },

  getStreak() {
    let cur = 0, best = DB.get('tenang_best_streak', 0);
    const d = new Date();
    while (true) {
      const k = d.toISOString().slice(0,10);
      const r = this.daily[k];
      if (!r || r.sessionCount === 0 || !r.underLimit) break;
      cur++; d.setDate(d.getDate()-1);
    }
    if (cur > best) { best = cur; DB.set('tenang_best_streak', best); }
    return { current:cur, best };
  },
};

// ─── Timer ──────────────────────────────────────────────────
const Timer = {
  intervalId:null, targetEndTime:null, plannedMinutes:0, notified5:false, notifiedEnd:false,
  start(m) {
    this.plannedMinutes=m; this.targetEndTime=Date.now()+m*60000;
    this.notified5=false; this.notifiedEnd=false;
    clearInterval(this.intervalId);
    this.intervalId = setInterval(()=>Router.tick(), 1000);
  },
  remaining() { return this.targetEndTime ? Math.max(0, Math.round((this.targetEndTime-Date.now())/1000)) : 0; },
  stop()  { clearInterval(this.intervalId); this.targetEndTime=null; },
  reset() { this.stop(); this.plannedMinutes=0; this.notified5=false; this.notifiedEnd=false; },
};

// ─── Notifications ──────────────────────────────────────────
const Notify = {
  async request() { if ('Notification' in window && Notification.permission==='default') await Notification.requestPermission(); },
  send(title, body) {
    if ('Notification' in window && Notification.permission==='granted') {
      try { new Notification(title, {body, icon:'./icons/icon.svg'}); return; } catch {}
    }
    UI.showBanner(body);
  },
};

// ─── Theme ──────────────────────────────────────────────────
const Theme = {
  apply(pref) {
    const root = document.documentElement;
    if (pref==='dark')  { root.dataset.theme='dark';  return; }
    if (pref==='light') { root.dataset.theme='light'; return; }
    root.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
};

// ─── Utils ──────────────────────────────────────────────────
const fmt = {
  minutes(m) { if(m<60) return m+' menit'; const h=Math.floor(m/60),r=m%60; return r===0?h+' jam':h+' jam '+r+' menit'; },
  countdown(s) { const m=Math.floor(Math.max(0,s)/60),sec=Math.max(0,s)%60; return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); },
  greet() { const h=new Date().getHours(); if(h>=4&&h<11)return'Selamat pagi'; if(h>=11&&h<15)return'Selamat siang'; if(h>=15&&h<18)return'Selamat sore'; return'Selamat malam'; },
  dateLabel(dk,mode) { const d=new Date(dk+'T00:00:00'); if(mode==='week')return['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()]; if(mode==='month')return d.getDate().toString(); return'Hari ini'; },
  today() { return new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'}); },
};

const QUOTES = [
  '"Kesadaran adalah langkah pertama menuju perubahan."',
  '"Setiap detik yang kamu sadari adalah kemenangan kecil."',
  '"Scroll lebih sedikit, rasakan lebih banyak."',
  '"Pikiranmu butuh jeda, bukan konten tak berujung."',
  '"Satu langkah kecil lebih baik dari diam di tempat."',
  '"Waktu yang tersadar adalah waktu yang bermakna."',
  '"Kamu lebih dari sekadar jempol yang terus menggulir."',
];
const MOOD_EMOJI  = {1:'😞',2:'😕',3:'😐',4:'🙂',5:'😄'};
const MOOD_LABEL  = {1:'Buruk',2:'Kurang',3:'Netral',4:'Baik',5:'Bagus'};
const INTENT_LABEL = {news:'Baca berita',friends:'Lihat teman',entertainment:'Hiburan',relax:'Santai',other:'Lainnya'};

function nanoid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function getDateRange(days) {
  const out=[],today=new Date();
  for(let i=days-1;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); out.push(d.toISOString().slice(0,10)); }
  return out;
}
function seedDemoData() {
  if(DB.get('tenang_seeded')) return;
  const intents=['news','friends','entertainment','relax','other'], moods=[2,3,3,4,4,5], today=new Date();
  for(let i=13;i>=0;i--) {
    const d=new Date(today); d.setDate(d.getDate()-i);
    const dk=d.toISOString().slice(0,10), cnt=Math.floor(Math.random()*3)+1;
    for(let s=0;s<cnt;s++){
      const hrs=[7,13,22][s%3], sd=new Date(d); sd.setHours(hrs,Math.floor(Math.random()*30));
      const pl=[15,20,30][Math.floor(Math.random()*3)], ac=Math.max(5,pl+Math.floor(Math.random()*15)-5);
      State.sessions.push({id:Math.random().toString(36).slice(2),date:dk,startedAt:sd.toISOString(),
        plannedMinutes:pl,actualMinutes:ac,intent:intents[Math.floor(Math.random()*intents.length)],
        moodBefore:moods[Math.floor(Math.random()*moods.length)],moodAfter:moods[Math.floor(Math.random()*moods.length)],source:'timer'});
    }
  }
  State.saveSessions();
  new Set(State.sessions.map(s=>s.date)).forEach(dk=>State._rebuildDay(dk));
  DB.set('tenang_seeded',true);
}

// ─── UI helpers ─────────────────────────────────────────────
const UI = {
  _banner:null,
  showBanner(msg) {
    if(this._banner) return;
    const el=document.createElement('div');
    el.style.cssText='position:fixed;top:16px;left:50%;transform:translateX(-50%);background:var(--sage-400);color:#fff;padding:10px 20px;border-radius:12px;font-size:.9rem;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:90%;text-align:center;';
    el.textContent=msg; document.body.appendChild(el); this._banner=el;
    setTimeout(()=>{ el.remove(); this._banner=null; },4000);
  },
  moodPicker(id,label) {
    return `<div class="mb-3"><p class="text-sm text-2 mb-2">${label}</p>
      <div class="mood-picker" id="${id}">
        ${[1,2,3,4,5].map(s=>`<button class="mood-btn" data-score="${s}" onclick="UI.selectMood('${id}',${s})" aria-pressed="false"><span>${MOOD_EMOJI[s]}</span><span>${MOOD_LABEL[s]}</span></button>`).join('')}
      </div></div>`;
  },
  selectMood(id,score) {
    const w=document.getElementById(id); if(!w) return;
    w.querySelectorAll('.mood-btn').forEach(b=>{ b.classList.toggle('selected',+b.dataset.score===score); b.setAttribute('aria-pressed',String(+b.dataset.score===score)); });
    w.dataset.value=score;
  },
  getMood(id) { const w=document.getElementById(id); return w?.dataset.value ? +w.dataset.value : null; },
  slider(id,min,max,step,val,label,unit) {
    return `<div class="slider-wrap">
      <div class="slider-header"><span class="slider-label">${label}</span>
        <span class="slider-value" id="${id}_val">${val}<small style="font-size:.7em;font-weight:500;margin-left:2px">${unit}</small></span></div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"
        oninput="document.getElementById('${id}_val').innerHTML=this.value+'<small style=\\'font-size:.7em;font-weight:500;margin-left:2px\\'>${unit}</small>'"
        aria-label="${label}" />
      <div class="slider-minmax"><span>${min}${unit}</span><span>${max}${unit}</span></div></div>`;
  },
  progressBar(pct) {
    const cls=pct<60?'green':pct<85?'yellow':'red';
    return `<div class="progress-wrap"><div class="progress-track"><div class="progress-fill ${cls}" style="width:${Math.min(100,pct)}%"></div></div></div>`;
  },
  backHeader(title, route) {
    return `<div class="flex items-center gap-3 mb-6" style="padding-top:16px">
      <button class="btn-back" onclick="Router.go('${route}')" aria-label="Kembali">
        <svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg></button>
      <h2>${title}</h2></div>`;
  },
};

// ─── Router ──────────────────────────────────────────────────
const Router = {
  current:null, sessionSubPage:'setup', sessionData:{}, statsRange:'week',

  init() {
    Theme.apply(State.profile.theme);
    this.go(State.profile.onboardingDone ? 'dashboard' : 'onboarding');
  },

  go(page, opts={}) {
    this.current=page;
    const app=document.getElementById('app');
    app.innerHTML='';
    const NAV_PAGES=['dashboard','session','focus','stats','more'];
    if(NAV_PAGES.includes(page)) app.appendChild(this._buildNav(page));
    const content=document.createElement('div');
    content.className='fade-in'; content.style.flex='1';
    const map={
      onboarding:()=>Pages.onboarding(),
      dashboard:()=>Pages.dashboard(),
      session:()=>Pages.session(opts),
      focus:()=>Pages.focus(),
      stats:()=>Pages.stats(this.statsRange),
      more:()=>Pages.more(),
      settings:()=>Pages.settings(),
      privacy:()=>Pages.privacy(),
      breathe:()=>Pages.breathe(),
      grounding:()=>Pages.grounding(),
      activities:()=>Pages.activities(),
      journal:()=>Pages.journal(),
      challenges:()=>Pages.challenges(),
      education:()=>Pages.education(),
    };
    if(map[page]) content.appendChild(map[page]());
    else content.innerHTML='<p style="padding:32px">Halaman tidak ditemukan.</p>';
    app.appendChild(content);
    window.scrollTo(0,0);
  },

  _buildNav(active) {
    const nav=document.createElement('nav');
    nav.className='bottom-nav'; nav.setAttribute('aria-label','Navigasi utama');
    const items=[
      {id:'dashboard',label:'Beranda',   icon:'<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/>'},
      {id:'session',  label:'Sesi',      icon:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'},
      {id:'focus',    label:'Fokus',     icon:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'},
      {id:'stats',    label:'Statistik', icon:'<rect x="3" y="14" width="4" height="7" rx="1"/><rect x="10" y="9" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="17" rx="1"/>'},
      {id:'more',     label:'Lainnya',   icon:'<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>'},
    ];
    nav.innerHTML=items.map(it=>`
      <button class="nav-item${active===it.id?' active':''}" onclick="Router.go('${it.id}')" aria-label="${it.label}">
        <svg viewBox="0 0 24 24">${it.icon}</svg><span>${it.label}</span>
      </button>`).join('');
    return nav;
  },

  tick() {
    const rem=Timer.remaining();
    if(!Timer.notified5&&rem<=300&&rem>0){ Timer.notified5=true; Notify.send('Hampir selesai! 🌿','Sisa 5 menit untuk sesi scrollmu.'); }
    if(!Timer.notifiedEnd&&rem===0){
      Timer.notifiedEnd=true; Notify.send('Waktu habis! ✅','Sesimu sudah selesai. Yuk kembali ke aktivitas lain 💚');
      Timer.stop(); this.sessionData.actualMinutes=this.sessionData.plannedMinutes;
      this.go('session',{sub:'summary'}); return;
    }
    const cd=document.getElementById('timer-countdown'), arc=document.getElementById('timer-arc'), bar=document.getElementById('timer-bar');
    if(cd){ cd.textContent=fmt.countdown(rem); const l5=rem<=300&&rem>0; cd.style.color=rem===0?'var(--success)':l5?'var(--warning)':'var(--text-1)'; }
    if(arc){ const tot=this.sessionData.plannedMinutes*60,el=tot-rem,pct=tot>0?el/tot:0,C=2*Math.PI*85;
      arc.setAttribute('stroke-dashoffset',C*(1-pct)); arc.setAttribute('stroke',rem<=300&&rem>0?'var(--warning)':'var(--sage-400)'); }
    if(bar){ const tot=this.sessionData.plannedMinutes*60,el=tot-rem,pct=tot>0?(el/tot)*100:0; bar.style.width=pct+'%'; }
  },
};

// ─── Pages ──────────────────────────────────────────────────
// Expose ke window agar features.js bisa mengakses semua helper
window.Pages      = {};
window.UI         = UI;
window.DB         = DB;
window.State      = State;
window.fmt        = fmt;
window.nanoid     = nanoid;
window.MOOD_EMOJI = MOOD_EMOJI;
window.MOOD_LABEL = MOOD_LABEL;

const Pages = window.Pages;

// ══════════════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════════════
Pages.onboarding = function() {
  const wrap=document.createElement('div');
  let step=1; const TOTAL=4;
  const draft={goals:[...State.profile.goals],dailyLimit:State.profile.dailyLimitMinutes,
    riskyStart:State.profile.riskyHours?.start??'22:00',riskyEnd:State.profile.riskyHours?.end??'07:00',
    hasRisky:!!State.profile.riskyHours,name:State.profile.name??''};

  function render(){
    const dots=Array.from({length:TOTAL},(_,i)=>`<div class="step-dot ${i<step?'done':'pending'}" style="width:${i<step?28:14}px"></div>`).join('');
    let c='';
    if(step===1)c=s1();
    if(step===2)c=s2();
    if(step===3)c=s3();
    if(step===4)c=s4();
    wrap.innerHTML=`<div class="onboarding-page">
      <div class="onboarding-logo">🌿</div>
      <h2 style="margin-bottom:4px">Tenang</h2>
      <p class="text-sm text-2 mb-4">Scroll lebih sadar, hidup lebih tenang.</p>
      <div class="step-indicator">${dots}</div>
      <div class="w-full" style="max-width:360px">${c}</div>
      ${step<TOTAL?`<div class="flex gap-3 mt-4 w-full" style="max-width:360px">
        ${step>1?'<button class="btn btn-secondary flex-1" onclick="obBack()">← Kembali</button>':''}
        <button class="btn btn-primary btn-lg flex-1" id="ob-next" onclick="obNext()"
          ${step===1&&draft.goals.length===0?'disabled':''}>Lanjut →</button>
      </div>`:''}
    </div>`;
  }

  window.obNext=()=>{ if(step===1)draft.name=document.getElementById('ob-name')?.value??''; if(step===2)draft.dailyLimit=+document.getElementById('ob-limit').value; if(step===3){draft.hasRisky=document.getElementById('ob-risky-toggle').dataset.on==='true';draft.riskyStart=document.getElementById('ob-risky-start')?.value??'22:00';draft.riskyEnd=document.getElementById('ob-risky-end')?.value??'07:00';} if(step<TOTAL){step++;render();} };
  window.obBack=()=>{ if(step>1){step--;render();} };
  window.obToggleGoal=key=>{ const i=draft.goals.indexOf(key); if(i>=0)draft.goals.splice(i,1);else draft.goals.push(key); document.querySelectorAll('.goal-btn').forEach(b=>b.classList.toggle('selected',draft.goals.includes(b.dataset.goal))); document.getElementById('ob-next').disabled=draft.goals.length===0; };
  window.obToggleRisky=()=>{ const b=document.getElementById('ob-risky-toggle'); const on=b.dataset.on!=='true'; b.dataset.on=on; b.classList.toggle('on',on); document.getElementById('ob-risky-times').classList.toggle('hidden',!on); };
  window.obFinish=withSeed=>{ State.profile.goals=draft.goals; State.profile.dailyLimitMinutes=draft.dailyLimit; State.profile.riskyHours=draft.hasRisky?{start:draft.riskyStart,end:draft.riskyEnd}:null; if(draft.name.trim())State.profile.name=draft.name.trim(); State.profile.onboardingDone=true; State.saveProfile(); if(withSeed)seedDemoData(); Router.go('dashboard'); };

  function s1(){const GOALS=[{key:'save-time',emoji:'⏰',label:'Hemat Waktu'},{key:'better-sleep',emoji:'🌙',label:'Tidur Lebih Baik'},{key:'study-focus',emoji:'📚',label:'Fokus Belajar'},{key:'mental-health',emoji:'💚',label:'Kesehatan Mental'}];return`<h2 class="mb-1">Apa tujuanmu?</h2><p class="text-sm text-2 mb-4">Pilih satu atau lebih.</p><input type="text" id="ob-name" placeholder="Siapa namamu? (opsional)" maxlength="30" value="${draft.name}" style="margin-bottom:16px" /><div class="goal-grid mb-4">${GOALS.map(g=>`<button class="goal-btn${draft.goals.includes(g.key)?' selected':''}" data-goal="${g.key}" onclick="obToggleGoal('${g.key}')" type="button"><span class="goal-emoji">${g.emoji}</span><span class="goal-label">${g.label}</span></button>`).join('')}</div>`;}
  function s2(){return`<h2 class="mb-1">Berapa batas harianmu?</h2><p class="text-sm text-2 mb-4">Total waktu scrolling per hari.</p><div class="card card-lg mb-3"><div class="text-center mb-4"><span style="font-size:3rem;font-weight:700;color:var(--sage-500)" id="ob-limit-disp">${draft.dailyLimit}</span><p class="text-sm text-2 mt-1">menit / hari</p></div><input type="range" id="ob-limit" min="15" max="240" step="5" value="${draft.dailyLimit}" oninput="document.getElementById('ob-limit-disp').textContent=this.value" aria-label="Batas harian"/><div class="slider-minmax"><span>15 mnt</span><span>240 mnt</span></div></div><div class="privacy-box"><p class="text-xs text-2">💡 Rata-rata orang scroll 2–3 jam per hari. Mulai dari yang realistis!</p></div>`;}
  function s3(){return`<h2 class="mb-1">Jam rawan scrollmu?</h2><p class="text-sm text-2 mb-4">Kamu akan diingatkan pada waktu ini.</p><div class="card card-lg mb-3"><div class="toggle-wrap mb-3"><span class="font-600">Aktifkan jam rawan</span><button class="toggle${draft.hasRisky?' on':''}" id="ob-risky-toggle" data-on="${draft.hasRisky}" onclick="obToggleRisky()" role="switch" aria-checked="${draft.hasRisky}"></button></div><div id="ob-risky-times" class="${draft.hasRisky?'':'hidden'}"><div class="time-grid"><div><label class="text-xs text-2 mb-1" style="display:block">Mulai</label><input type="time" id="ob-risky-start" value="${draft.riskyStart}"/></div><div><label class="text-xs text-2 mb-1" style="display:block">Selesai</label><input type="time" id="ob-risky-end" value="${draft.riskyEnd}"/></div></div></div></div>`;}
  function s4(){const GL={'save-time':'Hemat Waktu','better-sleep':'Tidur Baik','study-focus':'Fokus Belajar','mental-health':'Kes. Mental'};return`<h2 class="mb-1">Siap untuk mulai? 🌿</h2><p class="text-sm text-2 mb-4">Ringkasan preferensimu:</p><div class="card card-lg mb-4"><div class="flex justify-between mb-3"><span class="text-sm text-2">Tujuan</span><div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end">${draft.goals.length===0?'<span class="text-sm text-2">–</span>':draft.goals.map(g=>`<span class="badge badge-green">${GL[g]}</span>`).join('')}</div></div><div class="flex justify-between mb-3"><span class="text-sm text-2">Batas harian</span><span class="font-600 text-sage">${draft.dailyLimit} menit/hari</span></div><div class="flex justify-between"><span class="text-sm text-2">Jam rawan</span><span class="font-600">${draft.hasRisky?draft.riskyStart+' – '+draft.riskyEnd:'Belum diset'}</span></div></div><div class="card card-lg mb-3"><p class="font-600 mb-1 text-sm">Mau lihat tampilannya dulu?</p><p class="text-xs text-2 mb-3">Isi dashboard dengan data contoh agar kamu bisa langsung eksplorasi.</p><button class="btn btn-primary btn-lg btn-full mb-2" onclick="obFinish(true)">✨ Isi dengan data contoh</button><button class="btn btn-ghost btn-full" onclick="obFinish(false)">Mulai kosong</button></div>`;}

  render(); return wrap;
};

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
Pages.dashboard = function() {
  const wrap=document.createElement('div');
  const today=State.todayKey(), rec=State.getDaily(today), {current,best}=State.getStreak();
  const limit=State.profile.dailyLimitMinutes, used=rec.totalMinutes, pct=Math.min(100,Math.round(used/limit*100));
  const rem=Math.max(0,limit-used), over=used>limit, name=State.profile.name?`, ${State.profile.name}`:'';
  const avgMood=rec.avgMoodAfter?Math.round(rec.avgMoodAfter):null;
  const q=QUOTES[Math.floor(Date.now()/86400000)%QUOTES.length];
  wrap.innerHTML=`<div class="container">
    <p class="text-xs text-2 mb-1">${fmt.today()}</p>
    <h1 style="font-size:1.5rem;margin-bottom:20px">${fmt.greet()}${name} 👋</h1>
    <div class="card card-lg mb-3">
      <div class="flex justify-between items-center mb-3">
        <span class="text-xs font-700 text-2" style="text-transform:uppercase;letter-spacing:.06em">Batas Harian</span>
        <span class="badge ${over?'badge-red':'badge-green'}">${over?'⚠ Melebihi batas':pct+'%'}</span>
      </div>
      ${UI.progressBar(pct)}
      <div class="flex justify-between items-end mt-3">
        <div><p style="font-size:1.6rem;font-weight:700">${fmt.minutes(used)}</p><p class="text-xs text-2">terpakai</p></div>
        <div style="text-align:right">${over?`<p class="text-sm font-600" style="color:var(--danger)">Batas tercapai 🎉</p>`:`<p style="font-size:1.2rem;font-weight:700;color:var(--sage-500)">${fmt.minutes(rem)}</p><p class="text-xs text-2">tersisa</p>`}</div>
      </div>
    </div>
    <div class="flex gap-3 mb-3">
      <div class="card flex-col" style="flex:1;gap:4px">
        <p class="text-xs font-700 text-2" style="text-transform:uppercase;letter-spacing:.06em">Hari Berturut</p>
        <p style="font-size:2.2rem;font-weight:700;color:var(--sage-500)">${current}</p>
        <p class="text-xs text-2">hari</p><p class="text-xs text-2 mt-1">🏆 Rekor: ${best}</p>
      </div>
      <div class="card flex-col" style="flex:1;gap:4px">
        <p class="text-xs font-700 text-2" style="text-transform:uppercase;letter-spacing:.06em">Sesi Hari Ini</p>
        ${rec.sessionCount>0?`<p style="font-size:2.2rem;font-weight:700;color:var(--sky)">${rec.sessionCount}</p><p class="text-xs text-2">sesi</p><p class="text-xs text-2 mt-1">Mood: ${avgMood?MOOD_EMOJI[avgMood]:'–'}</p>`:`<p class="text-2 mt-2">–</p>`}
      </div>
    </div>
    <div class="flex gap-3 mb-3">
      <button class="btn btn-primary btn-lg flex-1" onclick="Router.go('session')">⏱ Mulai Sesi</button>
      <button class="btn btn-secondary btn-lg flex-1" onclick="dashShowLog()">+ Catat Scroll</button>
    </div>
    ${rec.sessionCount===0?`<div class="card mb-3 empty-state"><div class="empty-emoji">🌱</div><h3>Belum ada aktivitas hari ini.</h3><p>Yuk mulai catat atau mulai sesi!</p></div>`:''}
    <div class="quote-box mb-3"><p>${q}</p></div>
    <p class="text-xs text-3 text-center">🔒 Semua data tersimpan hanya di perangkat kamu</p>
  </div>
  <div id="log-modal" style="display:none;position:fixed;inset:0;z-index:200;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,.4);backdrop-filter:blur(6px)">
    <div style="width:100%;max-width:480px;background:var(--card-bg);border-radius:24px;padding:24px" class="slide-in">
      <h3 class="mb-1">Catat Scroll</h3>
      <p class="text-sm text-2 mb-4">Catat waktu scroll yang terjadi di luar aplikasi.</p>
      ${UI.slider('log-dur',1,120,1,15,'Berapa menit tadi kamu scroll?',' mnt')}
      <div class="mt-3">${UI.moodPicker('log-mood-before','Mood sebelum scroll')}</div>
      <div class="mt-3">${UI.moodPicker('log-mood-after','Mood sesudah scroll')}</div>
      <textarea id="log-notes" rows="2" placeholder="Catatan (opsional)" maxlength="200" style="margin-top:12px"></textarea>
      <div class="privacy-box mb-4"><p class="text-xs text-2">ℹ️ Tenang tidak bisa otomatis melacak app lain. Pencatatan ini berdasarkan ingatanmu sendiri.</p></div>
      <div class="flex gap-3">
        <button class="btn btn-secondary flex-1" onclick="dashHideLog()">Batal</button>
        <button class="btn btn-primary flex-1" onclick="dashSaveLog()">Simpan</button>
      </div>
    </div>
  </div>`;
  window.dashShowLog=()=>{ document.getElementById('log-modal').style.display='flex'; };
  window.dashHideLog=()=>{ document.getElementById('log-modal').style.display='none'; };
  window.dashSaveLog=()=>{ const dur=+document.getElementById('log-dur').value; State.addSession({id:nanoid(),date:State.todayKey(),startedAt:new Date().toISOString(),plannedMinutes:dur,actualMinutes:dur,intent:'other',moodBefore:UI.getMood('log-mood-before'),moodAfter:UI.getMood('log-mood-after'),source:'manual',notes:document.getElementById('log-notes').value.trim()||undefined}); Router.go('dashboard'); };
  return wrap;
};

// ══════════════════════════════════════════════════════════════
// SESSION
// ══════════════════════════════════════════════════════════════
Pages.session = function(opts={}) {
  const sub=opts.sub??Router.sessionSubPage??'setup'; Router.sessionSubPage=sub;
  const wrap=document.createElement('div');
  if(sub==='setup') wrap.appendChild(Pages._sessSetup());
  else if(sub==='running') wrap.appendChild(Pages._sessRunning());
  else wrap.appendChild(Pages._sessSummary());
  return wrap;
};
Pages._sessSetup = function() {
  const el=document.createElement('div'); el.className='container';
  const d=Router.sessionData, intents=['news','friends','entertainment','relax','other'];
  el.innerHTML=`<div class="flex items-center gap-3 mb-6" style="padding-top:16px">
    <button class="btn-back" onclick="Router.go('dashboard')" aria-label="Kembali"><svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg></button>
    <h2>Sesi Scroll</h2></div>
    <div class="card card-lg mb-3">
      <h3 class="mb-3">Mau ngapain?</h3>
      <p class="text-sm text-2 mb-2">Niatmu:</p>
      <div class="intent-grid mb-3" id="intent-grid">
        ${intents.map(i=>`<button class="intent-btn${(d.intent||'entertainment')===i?' selected':''}" onclick="sessSelectIntent('${i}')" data-intent="${i}">${INTENT_LABEL[i]}</button>`).join('')}
      </div>
      <input type="text" id="intent-note" placeholder="Tulis niatmu..." maxlength="80" value="${d.intentNote||''}" style="display:${(d.intent||'entertainment')==='other'?'block':'none'}"/>
    </div>
    <div class="card card-lg mb-3">${UI.slider('sess-dur',5,60,5,d.plannedMinutes||State.profile.defaultSessionMinutes,'Durasi',' mnt')}</div>
    <div class="card card-lg mb-4">${UI.moodPicker('sess-mood-before','Mood sekarang?')}</div>
    <button class="btn btn-primary btn-lg btn-full" onclick="sessStart()">▶ Mulai Sesi</button>`;
  window.sessSelectIntent=i=>{ Router.sessionData.intent=i; document.querySelectorAll('.intent-btn').forEach(b=>b.classList.toggle('selected',b.dataset.intent===i)); document.getElementById('intent-note').style.display=i==='other'?'block':'none'; };
  window.sessStart=async()=>{ await Notify.request(); const dur=+document.getElementById('sess-dur').value; Router.sessionData={id:nanoid(),date:State.todayKey(),startedAt:new Date().toISOString(),intent:Router.sessionData.intent??'entertainment',intentNote:document.getElementById('intent-note').value.trim(),moodBefore:UI.getMood('sess-mood-before'),plannedMinutes:dur,actualMinutes:null}; Timer.start(dur); Router.sessionSubPage='running'; Router.go('session',{sub:'running'}); };
  return el;
};
Pages._sessRunning = function() {
  const el=document.createElement('div'); el.className='container';
  const d=Router.sessionData, R=85, C=+(2*Math.PI*R).toFixed(2), rem=Timer.remaining();
  el.innerHTML=`<div class="flex justify-between items-center mb-4" style="padding-top:16px"><h2>Sesi Berjalan</h2></div>
    <div class="timer-wrap">
      <div class="timer-circle-container">
        <svg class="timer-circle" width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--sage-100)" stroke-width="10"/>
          <circle id="timer-arc" cx="100" cy="100" r="${R}" fill="none" stroke="var(--sage-400)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 100 100)"/>
        </svg>
        <div class="timer-display">
          <span id="timer-countdown" class="timer-countdown" aria-live="polite">${fmt.countdown(rem)}</span>
          <span class="timer-label">tersisa</span>
        </div>
      </div>
      <div class="card w-full text-center"><p class="text-xs text-2 mb-1">Niat</p><p class="font-600">${d.intent==='other'&&d.intentNote?d.intentNote:INTENT_LABEL[d.intent]}</p></div>
      <div class="w-full">
        <div class="flex justify-between text-xs text-2 mb-1"><span>0 mnt</span><span>${d.plannedMinutes} mnt</span></div>
        <div class="progress-track" style="height:8px"><div id="timer-bar" class="progress-fill green" style="width:0%"></div></div>
      </div>
      <button class="btn btn-secondary btn-lg btn-full" onclick="sessEndEarly()">Akhiri Sekarang</button>
    </div>`;
  window.sessEndEarly=()=>{ const el=d.plannedMinutes-Math.ceil(Timer.remaining()/60); Router.sessionData.actualMinutes=Math.max(1,el); Timer.stop(); Router.sessionSubPage='summary'; Router.go('session',{sub:'summary'}); };
  return el;
};
Pages._sessSummary = function() {
  const el=document.createElement('div'); el.className='container';
  const d=Router.sessionData;
  el.innerHTML=`<div class="text-center mb-4" style="padding-top:16px"><p style="font-size:3rem">🌿</p><h2>Sesi selesai!</h2></div>
    <div class="card card-lg mb-3">
      <div class="stat-grid mb-3">
        <div class="stat-card"><p class="stat-value">${d.actualMinutes??d.plannedMinutes}</p><p class="stat-label">Durasi aktual (mnt)</p></div>
        <div class="stat-card"><p class="stat-value text-2">${d.plannedMinutes}</p><p class="stat-label">Direncanakan (mnt)</p></div>
      </div>
      <p class="text-xs text-2 text-center">Niat: ${INTENT_LABEL[d.intent]}</p>
    </div>
    <div class="card card-lg mb-4">${UI.moodPicker('sum-mood-after','Bagaimana perasaanmu sekarang?')}</div>
    <button class="btn btn-primary btn-lg btn-full mb-2" onclick="sessSave()">💾 Simpan & Selesai</button>
    <button class="btn btn-ghost btn-full" onclick="sessSkip()">Lewati</button>`;
  window.sessSave=()=>{ d.moodAfter=UI.getMood('sum-mood-after'); d.endedAt=new Date().toISOString(); State.addSession({...d,source:'timer'}); Timer.reset(); Router.sessionSubPage='setup'; Router.sessionData={}; Router.go('dashboard'); };
  window.sessSkip=()=>{ Timer.reset(); Router.sessionSubPage='setup'; Router.sessionData={}; Router.go('dashboard'); };
  return el;
};

// ══════════════════════════════════════════════════════════════
// FOCUS – Pomodoro
// ══════════════════════════════════════════════════════════════
Pages.focus = function() {
  const el=document.createElement('div'); el.className='container';
  let running=false, isBreak=false, endTime=null, ivId=null;
  let workMin=DB.get('tenang_pom_work',25), breakMin=DB.get('tenang_pom_break',5);
  let cycles=DB.get('tenang_pom_cycles',0);
  let todos=DB.get('tenang_todos',[]);

  function render(){
    const rem=endTime?Math.max(0,Math.round((endTime-Date.now())/1000)):workMin*60;
    el.innerHTML=`<h2 style="padding-top:16px;margin-bottom:4px">Mode Fokus 🎯</h2>
      <p class="text-xs text-2 mb-4">Pomodoro timer untuk sesi kerja produktif.</p>
      <div class="card card-lg mb-4 text-center">
        <p class="text-xs font-700 mb-3" style="text-transform:uppercase;letter-spacing:.06em;color:${isBreak?'var(--sky)':'var(--sage-400)'}">${isBreak?'☕ Waktu Istirahat':'🎯 Waktu Fokus'} · Siklus #${cycles+1}</p>
        <div class="timer-wrap" style="gap:16px">
          <div class="timer-circle-container">
            <svg width="180" height="180" viewBox="0 0 180 180" style="transform:rotate(-90deg)">
              <circle cx="90" cy="90" r="76" fill="none" stroke="var(--sage-100)" stroke-width="8"/>
              <circle id="focus-arc" cx="90" cy="90" r="76" fill="none" stroke="${isBreak?'var(--sky)':'var(--sage-400)'}" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${(2*Math.PI*76).toFixed(2)}" stroke-dashoffset="${(2*Math.PI*76).toFixed(2)}"/>
            </svg>
            <div class="timer-display"><span id="focus-cd" class="timer-countdown" style="font-size:2.4rem">${fmt.countdown(rem)}</span><span class="timer-label">${isBreak?'istirahat':'fokus'}</span></div>
          </div>
        </div>
        <div class="flex gap-3 mb-4 mt-2" style="${running?'display:none':''}">
          <div style="flex:1"><p class="text-xs text-2 mb-1">Fokus (mnt)</p><input type="number" id="foc-work" value="${workMin}" min="1" max="120" style="text-align:center;padding:8px"/></div>
          <div style="flex:1"><p class="text-xs text-2 mb-1">Istirahat (mnt)</p><input type="number" id="foc-break" value="${breakMin}" min="1" max="30" style="text-align:center;padding:8px"/></div>
        </div>
        <div class="flex gap-3">
          <button class="btn btn-primary btn-lg flex-1" onclick="focToggle()">${running?'⏸ Jeda':'▶ Mulai'}</button>
          ${running||cycles>0?'<button class="btn btn-secondary" style="padding:12px 16px" onclick="focReset()">↺</button>':''}
        </div>
      </div>
      <div class="card card-lg mb-4">
        <h3 class="mb-3">📋 Tugas Sesi Ini</h3>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
          ${todos.length===0?'<p class="text-sm text-2">Belum ada tugas. Tambahkan di bawah!</p>':todos.map(t=>`
            <div class="flex gap-2 items-center">
              <button onclick="focToggleTodo('${t.id}')" style="width:22px;height:22px;border-radius:6px;border:2px solid var(--sage-400);background:${t.done?'var(--sage-400)':'transparent'};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.8rem">${t.done?'✓':''}</button>
              <span style="flex:1;font-size:.9rem;text-decoration:${t.done?'line-through':''};color:${t.done?'var(--text-3)':'var(--text-1)'}">${t.text}</span>
              <button onclick="focDeleteTodo('${t.id}')" style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:1.1rem;padding:0 4px">×</button>
            </div>`).join('')}
        </div>
        <div class="flex gap-2">
          <input type="text" id="todo-input" placeholder="Tambah tugas..." maxlength="60" onkeydown="if(event.key==='Enter')focAddTodo()" style="flex:1"/>
          <button class="btn btn-primary" style="padding:10px 16px" onclick="focAddTodo()">+</button>
        </div>
      </div>`;
    if(running&&!ivId) ivId=setInterval(focTick,1000);
  }

  function focTick(){
    const rem=Math.max(0,Math.round((endTime-Date.now())/1000));
    const cd=document.getElementById('focus-cd'), arc=document.getElementById('focus-arc');
    if(cd) cd.textContent=fmt.countdown(rem);
    if(arc){ const tot=(isBreak?breakMin:workMin)*60, elapsed=tot-rem, pct=tot>0?elapsed/tot:0, C=2*Math.PI*76; arc.setAttribute('stroke-dashoffset',C*(1-pct)); }
    if(rem===0){ clearInterval(ivId); ivId=null; running=false;
      if(!isBreak){ cycles++; DB.set('tenang_pom_cycles',cycles); isBreak=true; endTime=Date.now()+breakMin*60000; Notify.send('Sesi fokus selesai! ☕',`Istirahat ${breakMin} menit.`); }
      else { isBreak=false; endTime=null; Notify.send('Istirahat selesai! 🎯','Siap untuk sesi berikutnya?'); }
      render();
    }
  }

  window.focToggle=()=>{ if(running){ clearInterval(ivId); ivId=null; running=false; }
    else { workMin=+document.getElementById('foc-work')?.value||workMin; breakMin=+document.getElementById('foc-break')?.value||breakMin; DB.set('tenang_pom_work',workMin); DB.set('tenang_pom_break',breakMin); running=true; if(!endTime) endTime=Date.now()+workMin*60000; ivId=setInterval(focTick,1000); } render(); };
  window.focReset=()=>{ clearInterval(ivId); ivId=null; running=false; isBreak=false; endTime=null; cycles=0; DB.set('tenang_pom_cycles',0); render(); };
  window.focAddTodo=()=>{ const inp=document.getElementById('todo-input'); const t=inp?.value.trim(); if(!t) return; todos.push({id:nanoid(),text:t,done:false}); DB.set('tenang_todos',todos); render(); };
  window.focToggleTodo=id=>{ const t=todos.find(x=>x.id===id); if(t) t.done=!t.done; DB.set('tenang_todos',todos); render(); };
  window.focDeleteTodo=id=>{ todos=todos.filter(x=>x.id!==id); DB.set('tenang_todos',todos); render(); };

  render(); return el;
};

// ══════════════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════════════
Pages.stats = function(range='week') {
  Router.statsRange=range;
  const el=document.createElement('div'); el.className='container';
  const days=range==='today'?1:range==='week'?7:30, keys=getDateRange(days), limit=State.profile.dailyLimitMinutes;
  const records=keys.map(k=>State.getDaily(k));
  const total=records.reduce((s,r)=>s+r.totalMinutes,0), avg=records.length?Math.round(total/records.length):0;
  const under=records.filter(r=>r.underLimit).length, active=records.filter(r=>r.sessionCount>0).length;
  const success=active?Math.round(under/active*100):0, over=records.filter(r=>!r.underLimit&&r.sessionCount>0).length;
  const maxVal=Math.max(...records.map(r=>r.totalMinutes),limit,1);
  const bars=records.map(r=>{ const h=Math.round((r.totalMinutes/maxVal)*100), cls=r.sessionCount===0?'empty':r.underLimit?'under':'over'; return `<div class="chart-bar-col"><div class="chart-bar-container"><div class="chart-bar ${cls}" style="height:${h}%"></div></div><span class="chart-x-label">${fmt.dateLabel(r.date,range)}</span></div>`; }).join('');
  const limitPct=Math.round((limit/maxVal)*100);
  const allSess=State.sessions.filter(s=>keys.includes(s.date));
  const hb=Array.from({length:24},(_,i)=>({h:i,count:0}));
  allSess.forEach(s=>{ const h=new Date(s.startedAt).getHours(); hb[h].count++; });
  const maxH=Math.max(...hb.map(b=>b.count),1);
  const heatmap=hb.map((b,i)=>{ const bg=b.count===0?'rgba(107,158,120,.1)':`rgba(107,158,120,${.2+b.count/maxH*.8})`; return `<div class="heatmap-cell" style="background:${bg}" title="${String(i).padStart(2,'0')}:00 – ${b.count} sesi"></div>`; }).join('');
  const heatLabels=hb.map((_,i)=>`<div class="heatmap-label">${i%4===0?String(i).padStart(2,'0'):''}</div>`).join('');
  el.innerHTML=`<h2 style="padding-top:16px;margin-bottom:16px">Statistik</h2>
    <div class="tab-bar">
      <button class="tab-btn${range==='today'?' active':''}" onclick="Router.statsRange='today';Router.go('stats')">Hari Ini</button>
      <button class="tab-btn${range==='week'?' active':''}"  onclick="Router.statsRange='week';Router.go('stats')">7 Hari</button>
      <button class="tab-btn${range==='month'?' active':''}" onclick="Router.statsRange='month';Router.go('stats')">30 Hari</button>
    </div>
    <div class="stat-grid mb-4">
      <div class="card stat-card"><p class="stat-value">${avg}<span style="font-size:.9rem">mnt</span></p><p class="stat-label">Rata-rata/Hari</p></div>
      <div class="card stat-card"><p class="stat-value" style="color:var(--success)">${success}%</p><p class="stat-label">Keberhasilan</p></div>
      <div class="card stat-card"><p class="stat-value" style="color:var(--success)">${under}</p><p class="stat-label">Hari Di Bawah Target</p></div>
      <div class="card stat-card"><p class="stat-value" style="color:var(--danger)">${over}</p><p class="stat-label">Hari Melebihi Target</p></div>
    </div>
    <div class="card card-lg mb-4">
      <p class="font-600 mb-3">📊 Waktu Scroll Harian</p>
      ${active===0?'<div class="empty-state"><p>Belum ada data.</p></div>':`
      <div style="position:relative"><div class="chart-wrap">${bars}</div>
        <div style="position:absolute;bottom:${limitPct}%;left:0;right:0;height:1px;background:var(--warning)">
          <span style="position:absolute;right:0;top:-14px;font-size:.6rem;color:var(--warning);font-weight:700">Batas</span>
        </div></div>
      <div class="flex gap-3 mt-3 justify-center flex-wrap">
        <div class="flex gap-1 items-center"><div style="width:10px;height:10px;border-radius:50%;background:var(--success)"></div><span class="text-xs text-2">Di bawah batas</span></div>
        <div class="flex gap-1 items-center"><div style="width:10px;height:10px;border-radius:50%;background:var(--danger)"></div><span class="text-xs text-2">Melebihi batas</span></div>
      </div>`}
    </div>
    <div class="card card-lg mb-4">
      <p class="font-600 mb-3">⏰ Jam Paling Rawan</p>
      ${active===0?'<p class="text-sm text-2">Belum ada data.</p>':`<div class="heatmap">${heatmap}</div><div class="heatmap-labels">${heatLabels}</div><p class="text-xs text-2 text-center mt-2">Warna lebih gelap = lebih sering scroll</p>`}
    </div>`;
  return el;
};

// ══════════════════════════════════════════════════════════════
// MORE
// ══════════════════════════════════════════════════════════════
Pages.more = function() {
  const el=document.createElement('div'); el.className='container';
  const items=[
    {emoji:'⚙️',label:'Pengaturan',       desc:'Batas waktu, tema, jam rawan',  route:'settings'},
    {emoji:'🌬️',label:'Latihan Napas',    desc:'Box breathing & 4-7-8',         route:'breathe'},
    {emoji:'🖐️',label:'Teknik Grounding', desc:'Teknik 5-4-3-2-1 interaktif',   route:'grounding'},
    {emoji:'💡',label:'Bank Aktivitas',    desc:'50+ ide kegiatan pengganti',    route:'activities'},
    {emoji:'📖',label:'Jurnal',            desc:'Jurnal harian & mood tracker',  route:'journal'},
    {emoji:'🏆',label:'Tantangan',         desc:'Tantangan mingguan & badge',    route:'challenges'},
    {emoji:'📚',label:'Edukasi',           desc:'Dopamin loop, tips digital',    route:'education'},
    {emoji:'🔒',label:'Privasi & Data',    desc:'Data tersimpan lokal',          route:'privacy'},
  ];
  el.innerHTML=`<h2 style="padding-top:16px;margin-bottom:20px">Lainnya</h2>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${items.map((it,i)=>`<div class="menu-item" data-idx="${i}" role="button" tabindex="0">
        <span class="menu-icon">${it.emoji}</span>
        <span class="menu-text"><strong>${it.label}</strong><small>${it.desc}</small></span>
        <span class="menu-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></span>
      </div>`).join('')}
    </div>
    <p class="text-xs text-3 text-center mt-4">Tenang v1.0.0 · Dibuat dengan 💚</p>`;
  el.querySelectorAll('.menu-item').forEach(item=>{
    const route=items[+item.dataset.idx]?.route;
    if(route){ item.addEventListener('click',()=>Router.go(route)); item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')Router.go(route);}); }
  });
  return el;
};

// ══════════════════════════════════════════════════════════════
// LATIHAN NAPAS
// ══════════════════════════════════════════════════════════════
Pages.breathe = function() {
  const el=document.createElement('div'); el.className='container';
  const TECHS={
    box:{ name:'Box Breathing', desc:'Teknik favorit para atlet & tentara untuk menenangkan diri.',
      phases:[{label:'Hirup',dur:4,color:'#6B9E78'},{label:'Tahan',dur:4,color:'#7BA7BC'},{label:'Hembuskan',dur:4,color:'#D4A843'},{label:'Tahan',dur:4,color:'#9ac4a1'}]},
    t478:{ name:'Teknik 4-7-8', desc:'Membantu tidur lebih cepat dan mengurangi kecemasan.',
      phases:[{label:'Hirup',dur:4,color:'#6B9E78'},{label:'Tahan',dur:7,color:'#7BA7BC'},{label:'Hembuskan',dur:8,color:'#D4A843'}]},
  };
  let key='box', phIdx=0, elapsed=0, running=false, ivId=null, cycles=0;

  function renderBadges(){
    const t=TECHS[key];
    const pb=document.getElementById('phase-badges');
    if(pb) pb.innerHTML=t.phases.map(p=>`<span class="badge" style="background:${p.color}22;color:${p.color}">${p.label} ${p.dur}s</span>`).join('');
    const tn=document.getElementById('tech-name'); if(tn) tn.textContent=t.name;
    const td=document.getElementById('tech-desc'); if(td) td.textContent=t.desc;
  }

  function render(){
    el.innerHTML=`${UI.backHeader('Latihan Napas 🌬️','more')}
      <div class="tab-bar mb-4">
        <button class="tab-btn${key==='box'?' active':''}" id="tab-box" onclick="brSwitchTech('box')">Box Breathing</button>
        <button class="tab-btn${key==='t478'?' active':''}" id="tab-t478" onclick="brSwitchTech('t478')">4-7-8</button>
      </div>
      <div class="card card-lg mb-4">
        <p class="font-600 mb-1" id="tech-name">${TECHS[key].name}</p>
        <p class="text-sm text-2" id="tech-desc">${TECHS[key].desc}</p>
        <div class="flex gap-2 mt-3 flex-wrap" id="phase-badges">
          ${TECHS[key].phases.map(p=>`<span class="badge" style="background:${p.color}22;color:${p.color}">${p.label} ${p.dur}s</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;justify-content:center;padding:24px 0">
        <div id="br-ring" style="width:200px;height:200px;border-radius:50%;border:8px solid var(--sage-300);display:flex;align-items:center;justify-content:center;transition:transform 1s ease,border-color .5s ease;box-shadow:0 0 40px rgba(107,158,120,.15)">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <p id="br-phase" style="font-size:1.2rem;font-weight:700" aria-live="polite">Siap</p>
            <p id="br-count" style="font-size:2.5rem;font-weight:700;color:var(--sage-500);line-height:1">–</p>
            <p id="br-cycles" class="text-xs text-2"></p>
          </div>
        </div>
      </div>
      <div class="flex gap-3 mt-2">
        <button class="btn btn-primary btn-lg flex-1" id="br-start-btn" onclick="brToggle()">▶ Mulai</button>
        <button class="btn btn-secondary btn-lg flex-1" id="br-reset-btn" style="${running?'':'display:none'}" onclick="brReset()">↺ Reset</button>
      </div>
      <p class="text-xs text-2 text-center mt-3">Tarik napas melalui hidung, hembuskan melalui mulut.</p>`;
  }

  function tick(){
    const phases=TECHS[key].phases, phase=phases[phIdx], remaining=phase.dur-elapsed;
    const ring=document.getElementById('br-ring'), ph=document.getElementById('br-phase'), cnt=document.getElementById('br-count');
    if(ring){ ring.style.borderColor=phase.color; if(phase.label==='Hirup') ring.style.transform=`scale(${(1+elapsed/phase.dur*0.25).toFixed(2)})`; else if(phase.label==='Hembuskan') ring.style.transform=`scale(${Math.max(1,1.25-elapsed/phase.dur*0.25).toFixed(2)})`; }
    if(ph) ph.textContent=phase.label;
    if(cnt) { cnt.textContent=remaining; cnt.style.color=phase.color; }
    elapsed++;
    if(elapsed>=phase.dur){ elapsed=0; phIdx=(phIdx+1)%phases.length; if(phIdx===0){ cycles++; const c=document.getElementById('br-cycles'); if(c) c.textContent=cycles+' siklus selesai'; } }
  }

  window.brSwitchTech=function(k){ brReset(); key=k; render(); };
  window.brToggle=function(){
    if(running){ running=false; clearInterval(ivId); ivId=null; document.getElementById('br-start-btn').textContent='▶ Lanjut'; }
    else { running=true; document.getElementById('br-start-btn').textContent='⏸ Jeda'; document.getElementById('br-reset-btn').style.display=''; ivId=setInterval(tick,1000); }
  };
  window.brReset=function(){
    running=false; clearInterval(ivId); ivId=null; phIdx=0; elapsed=0; cycles=0;
    const ring=document.getElementById('br-ring'), ph=document.getElementById('br-phase'), cnt=document.getElementById('br-count'), cy=document.getElementById('br-cycles'), sb=document.getElementById('br-start-btn'), rb=document.getElementById('br-reset-btn');
    if(ring){ ring.style.transform='scale(1)'; ring.style.borderColor='var(--sage-300)'; }
    if(ph) ph.textContent='Siap'; if(cnt) cnt.textContent='–'; if(cy) cy.textContent=''; if(sb) sb.textContent='▶ Mulai'; if(rb) rb.style.display='none';
  };

  render(); return el;
};

// ══════════════════════════════════════════════════════════════
// TEKNIK GROUNDING
// ══════════════════════════════════════════════════════════════
Pages.grounding = function() {
  const el=document.createElement('div'); el.className='container';
  const STEPS=[
    {num:5,sense:'lihat',  emoji:'👁️',instruction:'Sebutkan 5 hal yang bisa kamu lihat sekarang.',      ph:'Contoh: meja, lampu, tembok, tanaman, gelas...'},
    {num:4,sense:'sentuh', emoji:'🖐️',instruction:'Sebutkan 4 hal yang bisa kamu sentuh atau rasakan.', ph:'Contoh: kursi di bawahku, permukaan meja, udara...'},
    {num:3,sense:'dengar', emoji:'👂',instruction:'Sebutkan 3 suara yang bisa kamu dengar.',             ph:'Contoh: kipas angin, suara motor, nafasku...'},
    {num:2,sense:'cium',   emoji:'👃',instruction:'Sebutkan 2 aroma yang bisa kamu cium.',              ph:'Contoh: udara segar, makanan, deodoranku...'},
    {num:1,sense:'rasa',   emoji:'👄',instruction:'Sebutkan 1 rasa yang ada di mulutmu.',               ph:'Contoh: sedikit manis, hambar, rasa kopi...'},
  ];
  let step=0; const answers=Array(5).fill('');

  function render(){
    if(step>=STEPS.length){
      el.innerHTML=`${UI.backHeader('Teknik Grounding 🖐️','more')}
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 0">
          <p style="font-size:4rem;margin-bottom:16px">🌿</p>
          <h2 class="mb-2">Selesai! Bagus sekali.</h2>
          <p class="text-sm text-2 mb-4" style="line-height:1.7">Kamu telah berhasil membawa dirimu kembali ke momen sekarang.</p>
          <div class="card card-lg mb-4 w-full" style="text-align:left">
            ${answers.map((a,i)=>`<div class="flex gap-2 items-start mb-2"><span style="font-size:1.2rem">${STEPS[i].emoji}</span><div><p class="text-xs text-2">${STEPS[i].num} hal yang ${STEPS[i].sense}</p><p class="text-sm font-600">${a||'(dilewati)'}</p></div></div>`).join('')}
          </div>
          <button class="btn btn-primary btn-lg btn-full mb-2" onclick="groundRestart()">Ulangi</button>
          <button class="btn btn-ghost btn-full" onclick="Router.go('more')">Kembali</button>
        </div>`; return;
    }
    const s=STEPS[step];
    el.innerHTML=`${UI.backHeader('Teknik Grounding 🖐️','more')}
      <div class="flex gap-2 mb-6">${STEPS.map((_,i)=>`<div style="flex:1;height:4px;border-radius:99px;background:${i<step?'var(--sage-400)':i===step?'var(--sage-300)':'var(--sage-100)'}"></div>`).join('')}</div>
      <div class="card card-lg mb-4 fade-in" style="text-align:center">
        <div style="font-size:3.5rem;margin-bottom:12px">${s.emoji}</div>
        <div style="font-size:4rem;font-weight:700;color:var(--sage-400);line-height:1;margin-bottom:8px">${s.num}</div>
        <h3 class="mb-1">${s.instruction}</h3>
        <p class="text-sm text-2 mb-4">Langkah ${step+1} dari 5</p>
        <textarea id="ground-input" rows="3" placeholder="${s.ph}" style="text-align:left;margin-bottom:0">${answers[step]}</textarea>
      </div>
      <div class="flex gap-3">
        ${step>0?'<button class="btn btn-secondary flex-1" onclick="groundPrev()">← Kembali</button>':''}
        <button class="btn btn-primary btn-lg flex-1" onclick="groundNext()">${step===STEPS.length-1?'Selesai ✓':'Lanjut →'}</button>
      </div>`;
  }

  window.groundNext=()=>{ answers[step]=document.getElementById('ground-input')?.value??''; step++; render(); };
  window.groundPrev=()=>{ answers[step]=document.getElementById('ground-input')?.value??''; step=Math.max(0,step-1); render(); };
  window.groundRestart=()=>{ step=0; answers.fill(''); render(); };
  render(); return el;
};

// ══════════════════════════════════════════════════════════════
// BANK AKTIVITAS
// ══════════════════════════════════════════════════════════════
Pages.activities = function() {
  const el=document.createElement('div'); el.className='container';
  const BASE=[
    {id:'a1', dur:2,  mood:['bosan','stres'],    emoji:'🌬️',title:'Napas dalam',       desc:'3 tarikan napas dalam perlahan.'},
    {id:'a2', dur:2,  mood:['bosan','iseng'],    emoji:'🚰',title:'Minum air',          desc:'Bangkit dan minum segelas air putih.'},
    {id:'a3', dur:2,  mood:['stres','gelisah'],  emoji:'✋',title:'Regangkan tangan',   desc:'Rentangkan dan pijat jari-jarimu.'},
    {id:'a4', dur:2,  mood:['bosan'],            emoji:'🪟',title:'Lihat keluar',       desc:'Perhatikan sesuatu di luar selama 2 menit.'},
    {id:'a5', dur:2,  mood:['iseng','kesepian'], emoji:'😄',title:'Kirim pesan singkat',desc:'Kirim pesan tulus ke teman atau keluarga.'},
    {id:'a6', dur:2,  mood:['stres'],            emoji:'🙆',title:'Peregangan leher',   desc:'Miringkan kepala kiri-kanan perlahan.'},
    {id:'a7', dur:10, mood:['bosan','stres'],    emoji:'🚶',title:'Jalan kaki',         desc:'Jalan kaki di sekitar rumah atau kamar.'},
    {id:'a8', dur:10, mood:['iseng','bosan'],    emoji:'📓',title:'Tulis jurnal',       desc:'Tulis 3 hal yang kamu syukuri hari ini.'},
    {id:'a9', dur:10, mood:['stres','gelisah'],  emoji:'🎵',title:'Dengarkan musik',    desc:'Pilih 2-3 lagu favorit dan nikmati.'},
    {id:'a10',dur:10, mood:['bosan'],            emoji:'📖',title:'Baca 10 halaman',    desc:'Ambil buku dan baca tanpa gangguan.'},
    {id:'a11',dur:10, mood:['stres','kesepian'], emoji:'🍵',title:'Buat minuman hangat',desc:'Nikmati proses membuat teh atau kopi.'},
    {id:'a12',dur:10, mood:['iseng'],            emoji:'🎨',title:'Corat-coret bebas',  desc:'Gambar apa saja tanpa tujuan tertentu.'},
    {id:'a13',dur:10, mood:['gelisah','stres'],  emoji:'🧘',title:'Meditasi singkat',   desc:'Duduk diam dan fokus pada napas.'},
    {id:'a14',dur:10, mood:['bosan','iseng'],    emoji:'🧩',title:'Puzzle / teka-teki', desc:'Mainkan sudoku, teka-teki silang, dll.'},
    {id:'a15',dur:30, mood:['bosan','stres'],    emoji:'🏃',title:'Olahraga ringan',    desc:'Yoga, senam, atau jogging singkat.'},
    {id:'a16',dur:30, mood:['iseng','bosan'],    emoji:'🍳',title:'Masak sesuatu',      desc:'Coba resep baru atau buat camilan.'},
    {id:'a17',dur:30, mood:['stres','kesepian'], emoji:'📞',title:'Telepon teman',      desc:'Ngobrol langsung dengan seseorang.'},
    {id:'a18',dur:30, mood:['bosan'],            emoji:'🎮',title:'Game offline',       desc:'Main game yang tidak terhubung internet.'},
    {id:'a19',dur:30, mood:['iseng','gelisah'],  emoji:'🧹',title:'Beres-beres',        desc:'Rapikan satu area di rumahmu.'},
    {id:'a20',dur:30, mood:['stres','bosan'],    emoji:'🎬',title:'Tonton 1 episode',   desc:'Pilih 1 episode, bukan autoplay.'},
  ];
  const MOODS=['semua','bosan','stres','iseng','gelisah','kesepian'];
  let fMood='semua', fDur=0, custom=DB.get('tenang_custom_activities',[]);

  function list(){ return[...BASE,...custom].filter(a=>(fMood==='semua'||a.mood.includes(fMood))&&(fDur===0||a.dur===fDur)); }

  function render(){
    const l=list(), rand=l.length?l[Math.floor(Math.random()*l.length)]:null;
    el.innerHTML=`${UI.backHeader('Bank Aktivitas 💡','more')}
      <div class="card card-lg mb-4" style="background:var(--sage-50);border-color:var(--sage-200)">
        <p class="text-xs font-700 text-2 mb-2" style="text-transform:uppercase;letter-spacing:.06em">Acak Untukmu</p>
        ${rand?`<div class="flex gap-3 items-start mb-3"><span style="font-size:2rem">${rand.emoji}</span><div><p class="font-600">${rand.title}</p><p class="text-sm text-2">${rand.desc}</p></div></div>`:'<p class="text-sm text-2 mb-3">Tidak ada aktivitas cocok.</p>'}
        <button class="btn btn-primary btn-full" onclick="actRender()">🎲 Acak Lagi</button>
      </div>
      <div style="overflow-x:auto;margin-bottom:8px"><div style="display:flex;gap:6px;padding-bottom:4px;min-width:max-content">
        ${MOODS.map(m=>`<button class="btn ${fMood===m?'btn-primary':'btn-secondary'}" style="padding:6px 12px;font-size:.8rem;border-radius:99px" onclick="actMood('${m}')">${m.charAt(0).toUpperCase()+m.slice(1)}</button>`).join('')}
      </div></div>
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
        ${[0,2,10,30].map(d=>`<button class="btn ${fDur===d?'btn-primary':'btn-secondary'}" style="padding:6px 12px;font-size:.8rem;border-radius:99px" onclick="actDur(${d})">${d===0?'Semua':d+' mnt'}</button>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${l.length===0?'<div class="empty-state"><div class="empty-emoji">😔</div><p>Tidak ada aktivitas untuk filter ini.</p></div>':l.map(a=>`
          <div class="card"><div class="flex gap-3 items-start">
            <span style="font-size:1.6rem">${a.emoji}</span>
            <div style="flex:1"><div class="flex justify-between"><p class="font-600">${a.title}</p><span class="badge badge-green">${a.dur} mnt</span></div><p class="text-sm text-2">${a.desc}</p></div>
          </div></div>`).join('')}
      </div>
      <div class="card card-lg mt-4">
        <h3 class="mb-3">+ Tambah Aktivitas Sendiri</h3>
        <input type="text" id="act-title" placeholder="Nama aktivitas" maxlength="50" class="mb-2"/>
        <input type="text" id="act-desc"  placeholder="Deskripsi singkat" maxlength="100" class="mb-2"/>
        <div class="flex gap-2 mb-3">
          <select id="act-dur" style="flex:1"><option value="2">2 menit</option><option value="10">10 menit</option><option value="30">30 menit</option></select>
          <input type="text" id="act-emoji" placeholder="Emoji" maxlength="2" style="width:60px" value="✨"/>
        </div>
        <button class="btn btn-secondary btn-full" onclick="actAdd()">Tambah</button>
      </div>`;
  }

  window.actRender=render;
  window.actMood=m=>{ fMood=m; render(); };
  window.actDur=d=>{ fDur=d; render(); };
  window.actAdd=()=>{
    const t=document.getElementById('act-title')?.value.trim(); if(!t) return;
    custom.push({id:'c'+nanoid(),dur:+document.getElementById('act-dur').value,mood:['bosan','iseng','stres'],emoji:document.getElementById('act-emoji')?.value.trim()||'✨',title:t,desc:document.getElementById('act-desc')?.value.trim()||'Aktivitas tambahan.'});
    DB.set('tenang_custom_activities',custom); render();
  };

  render(); return el;
};

// ══════════════════════════════════════════════════════════════
// JURNAL
// ══════════════════════════════════════════════════════════════
Pages.journal = function() {
  const el=document.createElement('div'); el.className='container';
  let entries=DB.get('tenang_journal',[]), view='list';

  function renderList(){
    const sorted=[...entries].sort((a,b)=>b.date.localeCompare(a.date));
    el.innerHTML=`<div class="flex items-center gap-3 mb-6" style="padding-top:16px">
      <button class="btn-back" onclick="Router.go('more')" aria-label="Kembali"><svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg></button>
      <h2 style="flex:1">Jurnal 📖</h2>
      <button class="btn btn-primary" style="padding:8px 14px" onclick="jWrite()">+ Tulis</button>
    </div>
    ${sorted.length===0?`<div class="empty-state card"><div class="empty-emoji">📝</div><h3>Belum ada jurnal</h3><p>Tulis hal pertama hari ini!</p></div><button class="btn btn-primary btn-lg btn-full mt-3" onclick="jWrite()">✏️ Tulis Sekarang</button>`:
    `<div style="display:flex;flex-direction:column;gap:10px">${sorted.map(e=>`
      <div class="card card-lg">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs text-2">${new Date(e.date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}</span>
          <span style="font-size:1.4rem">${e.mood?MOOD_EMOJI[e.mood]||'😐':'😐'}</span>
        </div>
        <p class="text-sm" style="line-height:1.6;white-space:pre-wrap">${e.text}</p>
        <button class="btn btn-ghost" style="padding:4px 8px;font-size:.75rem;margin-top:8px;color:var(--danger)" onclick="jDelete('${e.id}')">Hapus</button>
      </div>`).join('')}</div>`}`;
  }

  function renderWrite(){
    const today=State.todayKey(), ex=entries.find(e=>e.date===today);
    el.innerHTML=`<div class="flex items-center gap-3 mb-6" style="padding-top:16px">
      <button class="btn-back" onclick="jBack()" aria-label="Kembali"><svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg></button>
      <h2>Tulis Jurnal</h2>
    </div>
    <div class="card card-lg mb-4">
      <p class="text-sm text-2 mb-1">${fmt.today()}</p>
      <h3 class="mb-3">Apa yang kamu rasakan hari ini?</h3>
      <textarea id="j-text" rows="6" placeholder="Tulis 1-3 kalimat tentang hari ini, perasaanmu, atau apa pun yang ingin kamu catat..." maxlength="500" style="margin-bottom:0">${ex?.text||''}</textarea>
      <p id="j-char" class="text-xs text-3 text-right mt-1">${(ex?.text||'').length}/500</p>
    </div>
    <div class="card card-lg mb-4">${UI.moodPicker('j-mood','Bagaimana mood-mu hari ini?')}</div>
    <button class="btn btn-primary btn-lg btn-full" onclick="jSave()">💾 Simpan Jurnal</button>`;
    const ta=document.getElementById('j-text'), cc=document.getElementById('j-char');
    if(ta&&cc){ ta.addEventListener('input',()=>cc.textContent=ta.value.length+'/500'); }
    if(ex?.mood) setTimeout(()=>UI.selectMood('j-mood',ex.mood),50);
  }

  window.jWrite=()=>{ view='write'; renderWrite(); };
  window.jBack=()=>{ view='list'; renderList(); };
  window.jDelete=id=>{ entries=entries.filter(e=>e.id!==id); DB.set('tenang_journal',entries); renderList(); };
  window.jSave=()=>{
    const text=document.getElementById('j-text')?.value.trim(), mood=UI.getMood('j-mood');
    if(!text){ UI.showBanner('Tulis sesuatu dulu ya!'); return; }
    const today=State.todayKey(), ex=entries.find(e=>e.date===today);
    if(ex){ ex.text=text; ex.mood=mood; ex.updatedAt=new Date().toISOString(); }
    else entries.push({id:nanoid(),date:today,text,mood,createdAt:new Date().toISOString()});
    DB.set('tenang_journal',entries); UI.showBanner('Jurnal tersimpan! 💚'); view='list'; renderList();
  };

  renderList(); return el;
};

// ══════════════════════════════════════════════════════════════
// TANTANGAN
// ══════════════════════════════════════════════════════════════
Pages.challenges = function() {
  const el=document.createElement('div'); el.className='container';
  const CHS=[
    {id:'c1',title:'Tidak scroll 1 jam sebelum tidur',desc:'Selama 5 hari, hindari medsos 1 jam sebelum tidur.',target:5,badge:'🌙',badgeName:'Penjaga Tidur'},
    {id:'c2',title:'Sesi scroll maksimal 15 menit',   desc:'Selama 7 hari, catat sesi ≤15 menit.',            target:7,badge:'⏱️',badgeName:'Master Waktu'},
    {id:'c3',title:'3 hari tanpa doomscroll',          desc:'Tetap di bawah batas 3 hari berturut-turut.',     target:3,badge:'🌟',badgeName:'Pemula Tenang'},
    {id:'c4',title:'Ganti scroll dengan jalan kaki',   desc:'Selama 5 hari, ganti scroll dengan aktivitas.',   target:5,badge:'🚶',badgeName:'Pejalan Aktif'},
    {id:'c5',title:'Tulis jurnal 5 hari berturut',     desc:'Tulis jurnal setidaknya 5 hari berturut-turut.',  target:5,badge:'📖',badgeName:'Penulis Hati'},
    {id:'c6',title:'7 hari di bawah batas',            desc:'Tetap di bawah batas harian selama 7 hari penuh.',target:7,badge:'🏅',badgeName:'Pahlawan Mingguan'},
  ];
  let prog=DB.get('tenang_challenges',{}), badges=DB.get('tenang_badges',[]);

  function render(){
    el.innerHTML=`${UI.backHeader('Tantangan 🏆','more')}
      ${badges.length>0?`<div class="card card-lg mb-4" style="background:var(--sage-50)">
        <p class="text-xs font-700 text-2 mb-3" style="text-transform:uppercase;letter-spacing:.06em">Badge Kamu</p>
        <div style="display:flex;flex-wrap:wrap;gap:12px">
          ${badges.map(id=>{ const c=CHS.find(x=>x.id===id); return c?`<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:2.2rem">${c.badge}</span><span style="font-size:.65rem;color:var(--text-2);text-align:center;max-width:60px">${c.badgeName}</span></div>`:''; }).join('')}
        </div>
      </div>`:''}
      <div style="display:flex;flex-direction:column;gap:12px">
        ${CHS.map(c=>{ const p=prog[c.id]??0, done=p>=c.target, pct=Math.round(p/c.target*100); return `
          <div class="card card-lg" style="${done?'border-color:var(--success);background:rgba(76,175,125,.05)':''}">
            <div class="flex justify-between items-start mb-2">
              <div style="flex:1;margin-right:8px"><p class="font-600 mb-1">${c.badge} ${c.title}</p><p class="text-xs text-2">${c.desc}</p></div>
              <span class="badge ${done?'badge-green':'badge-yellow'}">${done?'Selesai!':p+'/'+c.target}</span>
            </div>
            <div class="progress-track" style="height:6px;margin-bottom:10px"><div class="progress-fill ${done?'green':'yellow'}" style="width:${pct}%"></div></div>
            ${done?`<p class="text-xs text-2 text-center">🎉 Kamu mendapat badge <strong>${c.badgeName}</strong>!</p>`:
            `<div class="flex gap-2">
              <button class="btn btn-secondary flex-1" style="padding:8px;font-size:.82rem" onclick="chalAdd('${c.id}',1)">+ Tandai Hari Ini</button>
              ${p>0?`<button class="btn btn-ghost" style="padding:8px;font-size:.78rem;color:var(--text-3)" onclick="chalAdd('${c.id}',-1)">Batalkan</button>`:''}
            </div>`}
          </div>`; }).join('')}
      </div>
      <div class="privacy-box mt-4"><p class="text-xs text-2">💡 Tantangan ini berdasarkan kejujuranmu sendiri. Tidak ada yang mengawasi — ini untukmu!</p></div>`;
  }

  window.chalAdd=function(id,delta){
    const c=CHS.find(x=>x.id===id); if(!c) return;
    prog[id]=Math.min(Math.max(0,(prog[id]??0)+delta),c.target);
    DB.set('tenang_challenges',prog);
    if(prog[id]>=c.target&&!badges.includes(id)){ badges.push(id); DB.set('tenang_badges',badges); UI.showBanner(`Badge baru: ${c.badge} ${c.badgeName}!`); }
    render();
  };

  render(); return el;
};

// ══════════════════════════════════════════════════════════════
// EDUKASI
// ══════════════════════════════════════════════════════════════
Pages.education = function() {
  const el=document.createElement('div'); el.className='container';
  const ARTS=[
    {id:'e1',emoji:'🧠',title:'Dopamin Loop & Doom Scrolling',summary:'Kenapa kita susah berhenti scroll? Ini tentang cara kerja otak kita.',content:`<p>Setiap kali kamu scroll dan menemukan konten menarik, otakmu melepas <strong>dopamin</strong> — zat kimia yang membuat kamu merasa senang dan ingin terus melanjutkan.</p><br><p>Media sosial dirancang untuk memaksimalkan ini. <strong>Infinite scroll</strong> menghilangkan "ujung alami" konten. <strong>Variabel reward</strong> — kamu tidak tahu kapan konten bagus berikutnya muncul — membuat otak terus mencari, mirip mesin slot.</p><br><h3>Yang bisa kamu lakukan:</h3><ul style="padding-left:16px;line-height:2;margin-top:8px"><li>Set niat sebelum membuka medsos</li><li>Gunakan timer/alarm</li><li>Nonaktifkan infinite scroll</li><li>Hapus app dari halaman utama HP</li></ul>`},
    {id:'e2',emoji:'📰',title:'Bad News Bias',summary:'Kenapa berita buruk lebih "menarik" dari berita baik untuk otak kita.',content:`<p>Otak manusia secara evolusi lebih waspada terhadap ancaman — disebut <strong>negativity bias</strong>. Berita buruk mendapat perhatian lebih besar dari berita baik dengan intensitas yang sama.</p><br><p><strong>Doom scrolling</strong> adalah siklus mencari berita buruk yang tidak bisa dihentikan, seringkali memperburuk kecemasan dan perasaan tidak berdaya.</p><br><h3>Tips:</h3><ul style="padding-left:16px;line-height:2;margin-top:8px"><li>Batasi konsumsi berita ke 1-2 kali sehari</li><li>Pilih sumber terpercaya dan tidak sensasional</li><li>Seimbangkan dengan konten positif</li><li>Perhatikan perasaanmu setelah membaca berita</li></ul>`},
    {id:'e3',emoji:'📱',title:'Panduan Setup Perangkat',summary:'Cara mengaktifkan pembatas app di iOS, Android, dan browser.',content:`<h3>📱 iPhone / iOS (Screen Time)</h3><p style="margin:8px 0">Pengaturan → Screen Time → App Limits → Tambah Batas → pilih Social Networking → set durasi.</p><br><h3>🤖 Android (Digital Wellbeing)</h3><p style="margin:8px 0">Pengaturan → Digital Wellbeing & Parental Controls → Dashboard → ketuk app → Timer → set durasi.</p><br><h3>💻 Browser (Ekstensi)</h3><ul style="padding-left:16px;line-height:2;margin-top:8px"><li><strong>StayFocusd</strong> (Chrome)</li><li><strong>LeechBlock</strong> (Firefox)</li><li><strong>Cold Turkey</strong> – pemblokir sangat tegas</li></ul><br><h3>🎨 Mode Grayscale</h3><p style="margin:8px 0">Mengubah layar HP jadi hitam putih membuat konten kurang menarik.</p><ul style="padding-left:16px;line-height:2;margin-top:4px"><li>iOS: Pengaturan → Aksesibilitas → Filter Warna</li><li>Android: Pengaturan → Aksesibilitas → Koreksi Warna (Grayscale)</li></ul>`},
    {id:'e4',emoji:'😴',title:'Scroll & Kualitas Tidur',summary:'Kenapa scroll sebelum tidur buruk, dan apa yang lebih baik.',content:`<p>Layar HP memancarkan <strong>cahaya biru</strong> yang menekan produksi melatonin — hormon tidur alami. Konten stimulatif juga membuat otak tetap aktif dan sulit tenang.</p><br><h3>Ritual malam yang lebih baik:</h3><ul style="padding-left:16px;line-height:2;margin-top:8px"><li>Stop layar 30-60 menit sebelum tidur</li><li>Baca buku fisik</li><li>Tulis jurnal atau 3 hal yang kamu syukuri</li><li>Latihan napas (coba fitur Latihan Napas!)</li><li>Dengarkan musik tenang</li></ul>`},
    {id:'e5',emoji:'🎯',title:'Mengapa Niat Itu Penting',summary:'Perbedaan antara scroll sadar dan scroll tanpa tujuan.',content:`<p>Penelitian menunjukkan <strong>mindful scrolling</strong> — scroll dengan tujuan jelas — jauh lebih tidak merusak dari scroll tanpa tujuan. Ketika membuka dengan tujuan spesifik, kamu lebih mudah berhenti setelah tujuan tercapai.</p><br><h3>Praktikkan:</h3><ul style="padding-left:16px;line-height:2;margin-top:8px"><li>Sebelum membuka app, tanyakan: "Apa yang aku mau lihat?"</li><li>Gunakan fitur Sesi di Tenang untuk menetapkan niat</li><li>Setelah tujuan tercapai, tutup app dengan sadar</li><li>Perhatikan bagaimana perasaanmu — ini data berharga</li></ul>`},
  ];
  let openId=null;

  function render(){
    if(openId){
      const a=ARTS.find(x=>x.id===openId);
      el.innerHTML=`${UI.backHeader(a.emoji+' '+a.title,'more')}
        <div class="card card-lg" style="line-height:1.8;font-size:.9rem">${a.content}</div>
        <button class="btn btn-secondary btn-full mt-4" onclick="eduBack()">← Kembali ke Edukasi</button>`;
      return;
    }
    el.innerHTML=`${UI.backHeader('Edukasi 📚','more')}
      <p class="text-sm text-2 mb-4">Pahami kenapa doom scrolling terjadi dan cara mengatasinya.</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${ARTS.map(a=>`<div class="card card-lg menu-item" role="button" tabindex="0" data-edu="${a.id}">
          <div class="flex gap-3 items-center">
            <span style="font-size:2rem;width:36px;text-align:center">${a.emoji}</span>
            <div style="flex:1"><p class="font-600 mb-1">${a.title}</p><p class="text-xs text-2">${a.summary}</p></div>
            <span class="menu-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></span>
          </div></div>`).join('')}
      </div>`;
    el.querySelectorAll('[data-edu]').forEach(item=>item.addEventListener('click',()=>{ openId=item.dataset.edu; render(); }));
  }

  window.eduBack=()=>{ openId=null; render(); };
  render(); return el;
};

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════
Pages.settings = function() {
  const el=document.createElement('div'); el.className='container';
  const p=State.profile;
  el.innerHTML=`${UI.backHeader('Pengaturan','more')}
    <div class="settings-section"><p class="settings-label">Profil</p>
      <div class="card card-lg"><label class="text-sm font-600 mb-2" style="display:block">Nama Kamu</label><input type="text" id="s-name" value="${p.name||''}" placeholder="Opsional" maxlength="30"/></div>
    </div>
    <div class="settings-section"><p class="settings-label">Batas Harian</p>
      <div class="card card-lg">${UI.slider('s-limit',15,240,5,p.dailyLimitMinutes,'Batas scroll harian',' mnt')}</div>
    </div>
    <div class="settings-section"><p class="settings-label">Jam Rawan</p>
      <div class="card card-lg">
        <div class="toggle-wrap mb-3"><span class="font-600">Aktifkan jam rawan</span>
          <button class="toggle${p.riskyHours?' on':''}" id="s-risky-toggle" data-on="${!!p.riskyHours}"
            onclick="this.dataset.on=this.dataset.on!=='true';this.classList.toggle('on');document.getElementById('s-risky-times').style.display=this.dataset.on==='true'?'grid':'none'"
            role="switch" aria-checked="${!!p.riskyHours}"></button>
        </div>
        <div id="s-risky-times" class="time-grid" style="display:${p.riskyHours?'grid':'none'}">
          <div><label class="text-xs text-2" style="display:block;margin-bottom:4px">Mulai</label><input type="time" id="s-risky-start" value="${p.riskyHours?.start||'22:00'}"/></div>
          <div><label class="text-xs text-2" style="display:block;margin-bottom:4px">Selesai</label><input type="time" id="s-risky-end" value="${p.riskyHours?.end||'07:00'}"/></div>
        </div>
      </div>
    </div>
    <div class="settings-section"><p class="settings-label">Tema</p>
      <div class="theme-grid">
        ${[['system','Ikuti Sistem'],['light','Terang'],['dark','Gelap']].map(([v,l])=>`<button class="theme-btn${p.theme===v?' selected':''}" data-theme-val="${v}" onclick="document.querySelectorAll('.theme-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected')">${l}</button>`).join('')}
      </div>
    </div>
    <div class="settings-section"><p class="settings-label">Privasi</p>
      <div class="card card-lg flex gap-3 items-center">
        <span style="font-size:1.4rem">🔒</span>
        <p class="text-sm text-2" style="flex:1;line-height:1.5">Semua data tersimpan hanya di perangkat kamu. Tidak ada yang dikirim ke server.</p>
      </div>
    </div>
    <button class="btn btn-primary btn-lg btn-full mb-3" id="s-save-btn" onclick="settSave()">Simpan Pengaturan</button>
    <button class="btn btn-danger btn-full" onclick="settConfirmDelete()">🗑 Hapus Semua Data</button>
    <div id="del-confirm" style="display:none;position:fixed;inset:0;z-index:300;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.5)">
      <div style="background:var(--card-bg);border-radius:20px;padding:24px;max-width:360px;width:100%">
        <h3 class="mb-2">Hapus Semua Data?</h3>
        <p class="text-sm text-2 mb-4">Yakin? Semua data akan dihapus permanen.</p>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" onclick="document.getElementById('del-confirm').style.display='none'">Batal</button>
          <button class="btn btn-danger flex-1" onclick="settDeleteAll()">Ya, Hapus</button>
        </div>
      </div>
    </div>`;
  window.settSave=()=>{ const n=document.getElementById('s-name').value.trim(), lim=+document.getElementById('s-limit').value, hasR=document.getElementById('s-risky-toggle').dataset.on==='true', rS=document.getElementById('s-risky-start')?.value??'22:00', rE=document.getElementById('s-risky-end')?.value??'07:00', th=document.querySelector('.theme-btn.selected')?.dataset.themeVal??'system'; State.profile.name=n||''; State.profile.dailyLimitMinutes=lim; State.profile.riskyHours=hasR?{start:rS,end:rE}:null; State.profile.theme=th; State.saveProfile(); Theme.apply(th); const btn=document.getElementById('s-save-btn'); btn.textContent='✓ Tersimpan!'; setTimeout(()=>btn.textContent='Simpan Pengaturan',2000); };
  window.settConfirmDelete=()=>{ document.getElementById('del-confirm').style.display='flex'; };
  window.settDeleteAll=()=>{ localStorage.clear(); location.reload(); };
  return el;
};

// ══════════════════════════════════════════════════════════════
// PRIVACY
// ══════════════════════════════════════════════════════════════
Pages.privacy = function() {
  const el=document.createElement('div'); el.className='container';
  el.innerHTML=`${UI.backHeader('Privasi & Data','more')}
    <div class="card card-lg mb-3"><h3 class="mb-3">🔒 Komitmen Privasi Kami</h3>
      <p class="text-sm text-2 mb-3" style="line-height:1.7"><strong>Semua data tersimpan lokal.</strong> Tenang tidak mengirim data apapun ke server. Semua informasi tersimpan hanya di perangkatmu (localStorage browser).</p>
      <p class="text-sm text-2 mb-3" style="line-height:1.7"><strong>Tanpa akun.</strong> Tidak perlu mendaftar atau login.</p>
      <p class="text-sm text-2" style="line-height:1.7"><strong>Tanpa tracking.</strong> Tidak ada Google Analytics, Facebook Pixel, atau tracking pihak ketiga.</p>
    </div>
    <div class="card card-lg mb-3"><h3 class="mb-3">⚠️ Batasan Aplikasi</h3>
      <p class="text-sm text-2 mb-3" style="line-height:1.7">Tenang <strong>tidak dapat</strong> membaca atau memblokir penggunaan aplikasi lain. Gunakan: <strong>App Timer</strong> (iOS) · <strong>Digital Wellbeing</strong> (Android) · <strong>Focus</strong> (macOS).</p>
    </div>
    <div class="card card-lg mb-3"><h3 class="mb-3">💛 Disclaimer</h3>
      <p class="text-sm text-2 mb-3" style="line-height:1.7">Tenang bukan aplikasi medis dan tidak memberikan diagnosis. Jika kamu merasa scrolling terkait kecemasan berat, cari bantuan profesional.</p>
      <div class="privacy-box"><p class="text-sm font-600 mb-1">Sumber bantuan (Indonesia):</p><p class="text-sm text-2">Into The Light Indonesia · Yayasan Pulih · Hotline Kemenkes: 119 ext 8</p></div>
    </div>`;
  return el;
};

// ─── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Router.init();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (State.profile.theme === 'system') Theme.apply('system');
  });
});
