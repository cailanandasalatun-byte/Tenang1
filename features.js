/* =============================================================
   TENANG – features.js
   Halaman fitur tambahan: Napas, Grounding, Aktivitas,
   Jurnal, Tantangan, Edukasi
   ============================================================= */
'use strict';

/* Ambil semua referensi dari window (dideklarasikan di app.js) */
const Pages      = window.Pages;
const UI         = window.UI;
const DB         = window.DB;
const State      = window.State;
const fmt        = window.fmt;
const nanoid     = window.nanoid;
const MOOD_EMOJI = window.MOOD_EMOJI;

// ══════════════════════════════════════════════════════════════
// LATIHAN NAPAS
// ══════════════════════════════════════════════════════════════
Pages.breathe = function () {
  const el = document.createElement('div');
  el.className = 'container';

  const TECHS = {
    box: {
      name: 'Box Breathing',
      desc: 'Teknik favorit para atlet & tentara untuk menenangkan diri.',
      phases: [
        { label: 'Hirup',     dur: 4, color: '#6B9E78' },
        { label: 'Tahan',     dur: 4, color: '#7BA7BC' },
        { label: 'Hembuskan', dur: 4, color: '#D4A843' },
        { label: 'Tahan',     dur: 4, color: '#9ac4a1' },
      ],
    },
    t478: {
      name: 'Teknik 4-7-8',
      desc: 'Membantu tidur lebih cepat dan mengurangi kecemasan.',
      phases: [
        { label: 'Hirup',     dur: 4, color: '#6B9E78' },
        { label: 'Tahan',     dur: 7, color: '#7BA7BC' },
        { label: 'Hembuskan', dur: 8, color: '#D4A843' },
      ],
    },
  };

  let key = 'box', phIdx = 0, elapsed = 0, running = false, ivId = null, cycles = 0;

  function renderPage() {
    const t = TECHS[key];
    el.innerHTML = `
      ${UI.backHeader('Latihan Napas &#127744;', 'more')}

      <div class="tab-bar mb-4">
        <button class="tab-btn ${key === 'box' ? 'active' : ''}" onclick="brSwitch('box')">Box Breathing</button>
        <button class="tab-btn ${key === 't478' ? 'active' : ''}" onclick="brSwitch('t478')">4-7-8</button>
      </div>

      <div class="card card-lg mb-4">
        <p class="font-600 mb-1" id="br-tech-name">${t.name}</p>
        <p class="text-sm text-2" id="br-tech-desc">${t.desc}</p>
        <div class="flex gap-2 mt-3 flex-wrap" id="br-badges">
          ${t.phases.map(p => `<span class="badge" style="background:${p.color}22;color:${p.color}">${p.label} ${p.dur}s</span>`).join('')}
        </div>
      </div>

      <div style="display:flex;justify-content:center;padding:24px 0">
        <div id="br-ring" style="
          width:200px;height:200px;border-radius:50%;
          border:8px solid var(--sage-300);
          display:flex;align-items:center;justify-content:center;
          transition:transform 1s ease,border-color .5s ease;
          box-shadow:0 0 40px rgba(107,158,120,.15)">
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <p id="br-phase" style="font-size:1.2rem;font-weight:700" aria-live="polite">Siap</p>
            <p id="br-count" style="font-size:2.5rem;font-weight:700;color:var(--sage-500);line-height:1">&#8211;</p>
            <p id="br-cycles" class="text-xs text-2"></p>
          </div>
        </div>
      </div>

      <div class="flex gap-3 mt-2">
        <button class="btn btn-primary btn-lg flex-1" id="br-start-btn" onclick="brToggle()">&#9654; Mulai</button>
        <button class="btn btn-secondary btn-lg flex-1" id="br-reset-btn" style="display:none" onclick="brReset()">&#8635; Reset</button>
      </div>
      <p class="text-xs text-2 text-center mt-3">Tarik napas melalui hidung, hembuskan melalui mulut.</p>
    `;
  }

  function tick() {
    const phases = TECHS[key].phases;
    const phase = phases[phIdx];
    const remaining = phase.dur - elapsed;

    const ring = document.getElementById('br-ring');
    const ph   = document.getElementById('br-phase');
    const cnt  = document.getElementById('br-count');

    if (ring) {
      ring.style.borderColor = phase.color;
      if (phase.label === 'Hirup') {
        ring.style.transform = `scale(${(1 + elapsed / phase.dur * 0.25).toFixed(2)})`;
      } else if (phase.label === 'Hembuskan') {
        ring.style.transform = `scale(${Math.max(1, 1.25 - elapsed / phase.dur * 0.25).toFixed(2)})`;
      }
    }
    if (ph)  ph.textContent = phase.label;
    if (cnt) { cnt.textContent = remaining; cnt.style.color = phase.color; }

    elapsed++;
    if (elapsed >= phase.dur) {
      elapsed = 0;
      phIdx = (phIdx + 1) % phases.length;
      if (phIdx === 0) {
        cycles++;
        const cy = document.getElementById('br-cycles');
        if (cy) cy.textContent = cycles + ' siklus selesai';
      }
    }
  }

  window.brSwitch = function (k) {
    brReset();
    key = k;
    renderPage();
  };

  window.brToggle = function () {
    if (running) {
      running = false; clearInterval(ivId); ivId = null;
      const sb = document.getElementById('br-start-btn');
      if (sb) sb.textContent = '▶ Lanjut';
    } else {
      running = true;
      const sb = document.getElementById('br-start-btn');
      const rb = document.getElementById('br-reset-btn');
      if (sb) sb.textContent = '⏸ Jeda';
      if (rb) rb.style.display = '';
      ivId = setInterval(tick, 1000);
    }
  };

  window.brReset = function () {
    running = false; clearInterval(ivId); ivId = null;
    phIdx = 0; elapsed = 0; cycles = 0;
    const ring = document.getElementById('br-ring');
    const ph   = document.getElementById('br-phase');
    const cnt  = document.getElementById('br-count');
    const cy   = document.getElementById('br-cycles');
    const sb   = document.getElementById('br-start-btn');
    const rb   = document.getElementById('br-reset-btn');
    if (ring) { ring.style.transform = 'scale(1)'; ring.style.borderColor = 'var(--sage-300)'; }
    if (ph)  ph.textContent  = 'Siap';
    if (cnt) cnt.textContent = '–';
    if (cy)  cy.textContent  = '';
    if (sb)  sb.textContent  = '▶ Mulai';
    if (rb)  rb.style.display = 'none';
  };

  renderPage();
  return el;
};

// ══════════════════════════════════════════════════════════════
// TEKNIK GROUNDING
// ══════════════════════════════════════════════════════════════
Pages.grounding = function () {
  const el = document.createElement('div');
  el.className = 'container';

  const STEPS = [
    { num:5, sense:'lihat',  emoji:'👁️', instruction:'Sebutkan 5 hal yang bisa kamu lihat sekarang.',       ph:'Contoh: meja, lampu, tembok, tanaman, gelas...' },
    { num:4, sense:'sentuh', emoji:'🖐️', instruction:'Sebutkan 4 hal yang bisa kamu sentuh atau rasakan.',  ph:'Contoh: kursi di bawahku, permukaan meja, udara...' },
    { num:3, sense:'dengar', emoji:'👂', instruction:'Sebutkan 3 suara yang bisa kamu dengar.',              ph:'Contoh: kipas angin, suara motor, nafasku...' },
    { num:2, sense:'cium',   emoji:'👃', instruction:'Sebutkan 2 aroma yang bisa kamu cium.',               ph:'Contoh: udara segar, makanan, deodoranku...' },
    { num:1, sense:'rasa',   emoji:'👄', instruction:'Sebutkan 1 rasa yang ada di mulutmu.',                ph:'Contoh: sedikit manis, hambar, rasa kopi...' },
  ];

  let step = 0;
  const answers = Array(5).fill('');

  function render() {
    if (step >= STEPS.length) {
      el.innerHTML = `
        ${UI.backHeader('Teknik Grounding 🖐️', 'more')}
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 0">
          <p style="font-size:4rem;margin-bottom:16px">🌿</p>
          <h2 class="mb-2">Selesai! Bagus sekali.</h2>
          <p class="text-sm text-2 mb-4" style="line-height:1.7">
            Kamu telah berhasil membawa dirimu kembali ke momen sekarang.
          </p>
          <div class="card card-lg mb-4 w-full" style="text-align:left">
            ${answers.map((a, i) => `
              <div class="flex gap-2 items-start mb-2">
                <span style="font-size:1.2rem">${STEPS[i].emoji}</span>
                <div>
                  <p class="text-xs text-2">${STEPS[i].num} hal yang ${STEPS[i].sense}</p>
                  <p class="text-sm font-600">${a || '(dilewati)'}</p>
                </div>
              </div>`).join('')}
          </div>
          <button class="btn btn-primary btn-lg btn-full mb-2" onclick="groundRestart()">Ulangi</button>
          <button class="btn btn-ghost btn-full" onclick="Router.go('more')">Kembali ke Menu</button>
        </div>`;
      return;
    }

    const s = STEPS[step];
    el.innerHTML = `
      ${UI.backHeader('Teknik Grounding 🖐️', 'more')}
      <div class="flex gap-2 mb-6">
        ${STEPS.map((_, i) => `<div style="flex:1;height:4px;border-radius:99px;background:${
          i < step ? 'var(--sage-400)' : i === step ? 'var(--sage-300)' : 'var(--sage-100)'
        }"></div>`).join('')}
      </div>
      <div class="card card-lg mb-4 fade-in" style="text-align:center">
        <div style="font-size:3.5rem;margin-bottom:12px">${s.emoji}</div>
        <div style="font-size:4rem;font-weight:700;color:var(--sage-400);line-height:1;margin-bottom:8px">${s.num}</div>
        <h3 class="mb-1">${s.instruction}</h3>
        <p class="text-sm text-2 mb-4">Langkah ${step + 1} dari 5</p>
        <textarea id="ground-input" rows="3" placeholder="${s.ph}"
          style="text-align:left;margin-bottom:0">${answers[step]}</textarea>
      </div>
      <div class="flex gap-3">
        ${step > 0 ? '<button class="btn btn-secondary flex-1" onclick="groundPrev()">← Kembali</button>' : ''}
        <button class="btn btn-primary btn-lg flex-1" onclick="groundNext()">
          ${step === STEPS.length - 1 ? 'Selesai ✓' : 'Lanjut →'}
        </button>
      </div>`;
  }

  window.groundNext    = () => { answers[step] = document.getElementById('ground-input')?.value ?? ''; step++; render(); };
  window.groundPrev    = () => { answers[step] = document.getElementById('ground-input')?.value ?? ''; step = Math.max(0, step - 1); render(); };
  window.groundRestart = () => { step = 0; answers.fill(''); render(); };

  render();
  return el;
};

// ══════════════════════════════════════════════════════════════
// BANK AKTIVITAS
// ══════════════════════════════════════════════════════════════
Pages.activities = function () {
  const el = document.createElement('div');
  el.className = 'container';

  const BASE = [
    { id:'a1',  dur:2,  mood:['bosan','stres'],    emoji:'🌬️', title:'Napas dalam',        desc:'3 tarikan napas dalam perlahan.' },
    { id:'a2',  dur:2,  mood:['bosan','iseng'],    emoji:'🚰',  title:'Minum air',           desc:'Bangkit dan minum segelas air putih.' },
    { id:'a3',  dur:2,  mood:['stres','gelisah'],  emoji:'✋',  title:'Regangkan tangan',    desc:'Rentangkan dan pijat jari-jarimu.' },
    { id:'a4',  dur:2,  mood:['bosan'],            emoji:'🪟',  title:'Lihat keluar',        desc:'Perhatikan sesuatu di luar selama 2 menit.' },
    { id:'a5',  dur:2,  mood:['iseng','kesepian'], emoji:'😄',  title:'Kirim pesan singkat', desc:'Kirim pesan tulus ke teman atau keluarga.' },
    { id:'a6',  dur:2,  mood:['stres'],            emoji:'🙆',  title:'Peregangan leher',    desc:'Miringkan kepala kiri-kanan perlahan.' },
    { id:'a7',  dur:10, mood:['bosan','stres'],    emoji:'🚶',  title:'Jalan kaki',          desc:'Jalan kaki di sekitar rumah atau kamar.' },
    { id:'a8',  dur:10, mood:['iseng','bosan'],    emoji:'📓',  title:'Tulis jurnal',        desc:'Tulis 3 hal yang kamu syukuri hari ini.' },
    { id:'a9',  dur:10, mood:['stres','gelisah'],  emoji:'🎵',  title:'Dengarkan musik',     desc:'Pilih 2-3 lagu favorit dan nikmati.' },
    { id:'a10', dur:10, mood:['bosan'],            emoji:'📖',  title:'Baca 10 halaman',     desc:'Ambil buku dan baca tanpa gangguan.' },
    { id:'a11', dur:10, mood:['stres','kesepian'], emoji:'🍵',  title:'Buat minuman hangat', desc:'Nikmati proses membuat teh atau kopi.' },
    { id:'a12', dur:10, mood:['iseng'],            emoji:'🎨',  title:'Corat-coret bebas',   desc:'Gambar apa saja tanpa tujuan tertentu.' },
    { id:'a13', dur:10, mood:['gelisah','stres'],  emoji:'🧘',  title:'Meditasi singkat',    desc:'Duduk diam dan fokus pada napas.' },
    { id:'a14', dur:10, mood:['bosan','iseng'],    emoji:'🧩',  title:'Puzzle / teka-teki',  desc:'Mainkan sudoku, teka-teki silang, dll.' },
    { id:'a15', dur:30, mood:['bosan','stres'],    emoji:'🏃',  title:'Olahraga ringan',     desc:'Yoga, senam, atau jogging singkat.' },
    { id:'a16', dur:30, mood:['iseng','bosan'],    emoji:'🍳',  title:'Masak sesuatu',       desc:'Coba resep baru atau buat camilan.' },
    { id:'a17', dur:30, mood:['stres','kesepian'], emoji:'📞',  title:'Telepon teman',       desc:'Ngobrol langsung dengan seseorang.' },
    { id:'a18', dur:30, mood:['bosan'],            emoji:'🎮',  title:'Game offline',        desc:'Main game yang tidak terhubung internet.' },
    { id:'a19', dur:30, mood:['iseng','gelisah'],  emoji:'🧹',  title:'Beres-beres',         desc:'Rapikan satu area di rumahmu.' },
    { id:'a20', dur:30, mood:['stres','bosan'],    emoji:'🎬',  title:'Tonton 1 episode',    desc:'Pilih 1 episode, bukan autoplay.' },
  ];

  const MOODS = ['semua','bosan','stres','iseng','gelisah','kesepian'];
  let fMood = 'semua', fDur = 0;
  let custom = DB.get('tenang_custom_activities', []);

  function getList() {
    return [...BASE, ...custom].filter(a =>
      (fMood === 'semua' || a.mood.includes(fMood)) &&
      (fDur === 0 || a.dur === fDur)
    );
  }

  function render() {
    const list = getList();
    const rand = list.length ? list[Math.floor(Math.random() * list.length)] : null;

    el.innerHTML = `
      ${UI.backHeader('Bank Aktivitas 💡', 'more')}

      <div class="card card-lg mb-4" style="background:var(--sage-50);border-color:var(--sage-200)">
        <p class="text-xs font-700 text-2 mb-2" style="text-transform:uppercase;letter-spacing:.06em">Acak Untukmu</p>
        ${rand
          ? `<div class="flex gap-3 items-start mb-3">
               <span style="font-size:2rem">${rand.emoji}</span>
               <div><p class="font-600">${rand.title}</p><p class="text-sm text-2">${rand.desc}</p></div>
             </div>`
          : '<p class="text-sm text-2 mb-3">Tidak ada aktivitas cocok.</p>'}
        <button class="btn btn-primary btn-full" onclick="actRender()">🎲 Acak Lagi</button>
      </div>

      <div style="overflow-x:auto;margin-bottom:8px">
        <div style="display:flex;gap:6px;padding-bottom:4px;min-width:max-content">
          ${MOODS.map(m => `<button class="btn ${fMood === m ? 'btn-primary' : 'btn-secondary'}"
            style="padding:6px 12px;font-size:.8rem;border-radius:99px"
            onclick="actMood('${m}')">${m.charAt(0).toUpperCase() + m.slice(1)}</button>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
        ${[0,2,10,30].map(d => `<button class="btn ${fDur === d ? 'btn-primary' : 'btn-secondary'}"
          style="padding:6px 12px;font-size:.8rem;border-radius:99px"
          onclick="actDur(${d})">${d === 0 ? 'Semua' : d + ' mnt'}</button>`).join('')}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        ${list.length === 0
          ? '<div class="empty-state"><div class="empty-emoji">😔</div><p>Tidak ada aktivitas untuk filter ini.</p></div>'
          : list.map(a => `
            <div class="card">
              <div class="flex gap-3 items-start">
                <span style="font-size:1.6rem">${a.emoji}</span>
                <div style="flex:1">
                  <div class="flex justify-between">
                    <p class="font-600">${a.title}</p>
                    <span class="badge badge-green">${a.dur} mnt</span>
                  </div>
                  <p class="text-sm text-2">${a.desc}</p>
                </div>
              </div>
            </div>`).join('')}
      </div>

      <div class="card card-lg mt-4">
        <h3 class="mb-3">+ Tambah Aktivitas Sendiri</h3>
        <input type="text" id="act-title" placeholder="Nama aktivitas" maxlength="50" class="mb-2"/>
        <input type="text" id="act-desc"  placeholder="Deskripsi singkat" maxlength="100" class="mb-2"/>
        <div class="flex gap-2 mb-3">
          <select id="act-dur-sel" style="flex:1">
            <option value="2">2 menit</option>
            <option value="10">10 menit</option>
            <option value="30">30 menit</option>
          </select>
          <input type="text" id="act-emoji" placeholder="Emoji" maxlength="2" style="width:60px" value="✨"/>
        </div>
        <button class="btn btn-secondary btn-full" onclick="actAdd()">Tambah</button>
      </div>`;
  }

  window.actRender = render;
  window.actMood   = m => { fMood = m; render(); };
  window.actDur    = d => { fDur  = d; render(); };
  window.actAdd    = () => {
    const title = document.getElementById('act-title')?.value.trim();
    if (!title) { UI.showBanner('Isi nama aktivitas dulu!'); return; }
    custom.push({
      id: 'c' + nanoid(),
      dur: +document.getElementById('act-dur-sel').value,
      mood: ['bosan','iseng','stres'],
      emoji: document.getElementById('act-emoji')?.value.trim() || '✨',
      title,
      desc: document.getElementById('act-desc')?.value.trim() || 'Aktivitas tambahan.',
    });
    DB.set('tenang_custom_activities', custom);
    render();
  };

  render();
  return el;
};

// ══════════════════════════════════════════════════════════════
// JURNAL
// ══════════════════════════════════════════════════════════════
Pages.journal = function () {
  const el = document.createElement('div');
  el.className = 'container';

  let entries = DB.get('tenang_journal', []);

  function renderList() {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    el.innerHTML = `
      <div class="flex items-center gap-3 mb-6" style="padding-top:16px">
        <button class="btn-back" onclick="Router.go('more')" aria-label="Kembali">
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h2 style="flex:1">Jurnal 📖</h2>
        <button class="btn btn-primary" style="padding:8px 14px" onclick="jWrite()">+ Tulis</button>
      </div>
      ${sorted.length === 0
        ? `<div class="empty-state card"><div class="empty-emoji">📝</div><h3>Belum ada jurnal</h3><p>Tulis hal pertama hari ini!</p></div>
           <button class="btn btn-primary btn-lg btn-full mt-3" onclick="jWrite()">✏️ Tulis Sekarang</button>`
        : `<div style="display:flex;flex-direction:column;gap:10px">
            ${sorted.map(e => `
              <div class="card card-lg">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-xs text-2">${new Date(e.date + 'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}</span>
                  <span style="font-size:1.4rem">${e.mood ? (MOOD_EMOJI[e.mood] || '😐') : '😐'}</span>
                </div>
                <p class="text-sm" style="line-height:1.6;white-space:pre-wrap">${e.text}</p>
                <button class="btn btn-ghost" style="padding:4px 8px;font-size:.75rem;margin-top:8px;color:var(--danger)"
                  onclick="jDelete('${e.id}')">Hapus</button>
              </div>`).join('')}
           </div>`}`;
  }

  function renderWrite() {
    const today = State.todayKey();
    const ex    = entries.find(e => e.date === today);
    el.innerHTML = `
      <div class="flex items-center gap-3 mb-6" style="padding-top:16px">
        <button class="btn-back" onclick="jBack()" aria-label="Kembali">
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h2>Tulis Jurnal</h2>
      </div>
      <div class="card card-lg mb-4">
        <p class="text-sm text-2 mb-1">${fmt.today()}</p>
        <h3 class="mb-3">Apa yang kamu rasakan hari ini?</h3>
        <textarea id="j-text" rows="6"
          placeholder="Tulis 1-3 kalimat tentang hari ini, perasaanmu, atau apa pun yang ingin kamu catat..."
          maxlength="500" style="margin-bottom:0">${ex?.text || ''}</textarea>
        <p id="j-char" class="text-xs text-3 text-right mt-1">${(ex?.text || '').length}/500</p>
      </div>
      <div class="card card-lg mb-4">${UI.moodPicker('j-mood', 'Bagaimana mood-mu hari ini?')}</div>
      <button class="btn btn-primary btn-lg btn-full" onclick="jSave()">💾 Simpan Jurnal</button>`;

    const ta = document.getElementById('j-text');
    const cc = document.getElementById('j-char');
    if (ta && cc) ta.addEventListener('input', () => cc.textContent = ta.value.length + '/500');
    if (ex?.mood) setTimeout(() => UI.selectMood('j-mood', ex.mood), 50);
  }

  window.jWrite  = () => renderWrite();
  window.jBack   = () => renderList();
  window.jDelete = id => { entries = entries.filter(e => e.id !== id); DB.set('tenang_journal', entries); renderList(); };
  window.jSave   = () => {
    const text = document.getElementById('j-text')?.value.trim();
    const mood = UI.getMood('j-mood');
    if (!text) { UI.showBanner('Tulis sesuatu dulu ya!'); return; }
    const today = State.todayKey();
    const ex    = entries.find(e => e.date === today);
    if (ex) { ex.text = text; ex.mood = mood; ex.updatedAt = new Date().toISOString(); }
    else entries.push({ id: nanoid(), date: today, text, mood, createdAt: new Date().toISOString() });
    DB.set('tenang_journal', entries);
    UI.showBanner('Jurnal tersimpan! 💚');
    renderList();
  };

  renderList();
  return el;
};

// ══════════════════════════════════════════════════════════════
// TANTANGAN
// ══════════════════════════════════════════════════════════════
Pages.challenges = function () {
  const el = document.createElement('div');
  el.className = 'container';

  const CHS = [
    { id:'c1', title:'Tidak scroll 1 jam sebelum tidur',  desc:'Selama 5 hari, hindari medsos 1 jam sebelum tidur.', target:5, badge:'🌙', badgeName:'Penjaga Tidur' },
    { id:'c2', title:'Sesi scroll maksimal 15 menit',     desc:'Selama 7 hari, catat sesi ≤15 menit.',              target:7, badge:'⏱️',badgeName:'Master Waktu' },
    { id:'c3', title:'3 hari tanpa doomscroll',           desc:'Tetap di bawah batas 3 hari berturut-turut.',       target:3, badge:'🌟', badgeName:'Pemula Tenang' },
    { id:'c4', title:'Ganti scroll dengan aktivitas',     desc:'Selama 5 hari, ganti scroll dengan kegiatan positif.', target:5, badge:'🚶', badgeName:'Pejalan Aktif' },
    { id:'c5', title:'Tulis jurnal 5 hari berturut',      desc:'Tulis jurnal setidaknya 5 hari berturut-turut.',    target:5, badge:'📖', badgeName:'Penulis Hati' },
    { id:'c6', title:'7 hari di bawah batas',             desc:'Tetap di bawah batas harian selama 7 hari penuh.', target:7, badge:'🏅', badgeName:'Pahlawan Mingguan' },
  ];

  let prog   = DB.get('tenang_challenges', {});
  let badges = DB.get('tenang_badges', []);

  function render() {
    el.innerHTML = `
      ${UI.backHeader('Tantangan 🏆', 'more')}

      ${badges.length > 0 ? `
        <div class="card card-lg mb-4" style="background:var(--sage-50)">
          <p class="text-xs font-700 text-2 mb-3" style="text-transform:uppercase;letter-spacing:.06em">Badge Kamu</p>
          <div style="display:flex;flex-wrap:wrap;gap:12px">
            ${badges.map(id => {
              const c = CHS.find(x => x.id === id);
              return c ? `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                <span style="font-size:2.2rem">${c.badge}</span>
                <span style="font-size:.65rem;color:var(--text-2);text-align:center;max-width:60px">${c.badgeName}</span>
              </div>` : '';
            }).join('')}
          </div>
        </div>` : ''}

      <div style="display:flex;flex-direction:column;gap:12px">
        ${CHS.map(c => {
          const p    = prog[c.id] ?? 0;
          const done = p >= c.target;
          const pct  = Math.round(p / c.target * 100);
          return `
            <div class="card card-lg" style="${done ? 'border-color:var(--success);background:rgba(76,175,125,.05)' : ''}">
              <div class="flex justify-between items-start mb-2">
                <div style="flex:1;margin-right:8px">
                  <p class="font-600 mb-1">${c.badge} ${c.title}</p>
                  <p class="text-xs text-2">${c.desc}</p>
                </div>
                <span class="badge ${done ? 'badge-green' : 'badge-yellow'}">${done ? 'Selesai!' : p + '/' + c.target}</span>
              </div>
              <div class="progress-track" style="height:6px;margin-bottom:10px">
                <div class="progress-fill ${done ? 'green' : 'yellow'}" style="width:${pct}%"></div>
              </div>
              ${done
                ? `<p class="text-xs text-2 text-center">🎉 Kamu mendapat badge <strong>${c.badgeName}</strong>!</p>`
                : `<div class="flex gap-2">
                    <button class="btn btn-secondary flex-1" style="padding:8px;font-size:.82rem"
                      onclick="chalAdd('${c.id}',1)">+ Tandai Hari Ini</button>
                    ${p > 0 ? `<button class="btn btn-ghost" style="padding:8px;font-size:.78rem;color:var(--text-3)"
                      onclick="chalAdd('${c.id}',-1)">Batalkan</button>` : ''}
                  </div>`}
            </div>`;
        }).join('')}
      </div>
      <div class="privacy-box mt-4">
        <p class="text-xs text-2">💡 Tantangan ini berdasarkan kejujuranmu sendiri. Tidak ada yang mengawasi — ini untukmu!</p>
      </div>`;
  }

  window.chalAdd = function (id, delta) {
    const c = CHS.find(x => x.id === id);
    if (!c) return;
    prog[id] = Math.min(Math.max(0, (prog[id] ?? 0) + delta), c.target);
    DB.set('tenang_challenges', prog);
    if (prog[id] >= c.target && !badges.includes(id)) {
      badges.push(id);
      DB.set('tenang_badges', badges);
      UI.showBanner(`Badge baru: ${c.badge} ${c.badgeName}!`);
    }
    render();
  };

  render();
  return el;
};

// ══════════════════════════════════════════════════════════════
// EDUKASI
// ══════════════════════════════════════════════════════════════
Pages.education = function () {
  const el = document.createElement('div');
  el.className = 'container';

  const ARTS = [
    {
      id:'e1', emoji:'🧠', title:'Dopamin Loop & Doom Scrolling',
      summary:'Kenapa kita susah berhenti scroll? Ini tentang cara kerja otak kita.',
      content:`<p>Setiap kali kamu scroll dan menemukan konten menarik, otakmu melepas <strong>dopamin</strong> — zat kimia yang membuat kamu merasa senang dan ingin terus melanjutkan.</p>
        <br><p>Media sosial dirancang untuk memaksimalkan ini. <strong>Infinite scroll</strong> menghilangkan "ujung alami" konten. <strong>Variabel reward</strong> — kamu tidak tahu kapan konten bagus berikutnya muncul — membuat otak terus mencari, mirip mesin slot.</p>
        <br><h3 style="margin-bottom:8px">Yang bisa kamu lakukan:</h3>
        <ul style="padding-left:16px;line-height:2"><li>Set niat sebelum membuka medsos</li><li>Gunakan timer/alarm</li><li>Nonaktifkan infinite scroll</li><li>Hapus app dari halaman utama HP</li></ul>`,
    },
    {
      id:'e2', emoji:'📰', title:'Bad News Bias',
      summary:'Kenapa berita buruk lebih menarik dari berita baik untuk otak kita.',
      content:`<p>Otak manusia secara evolusi lebih waspada terhadap ancaman — disebut <strong>negativity bias</strong>. Berita buruk mendapat perhatian lebih besar dari berita baik dengan intensitas yang sama.</p>
        <br><p><strong>Doom scrolling</strong> adalah siklus mencari berita buruk yang tidak bisa dihentikan, sering memperburuk kecemasan dan perasaan tidak berdaya.</p>
        <br><h3 style="margin-bottom:8px">Tips:</h3>
        <ul style="padding-left:16px;line-height:2"><li>Batasi konsumsi berita ke 1-2 kali sehari</li><li>Pilih sumber terpercaya dan tidak sensasional</li><li>Seimbangkan dengan konten positif</li><li>Perhatikan perasaanmu setelah membaca berita</li></ul>`,
    },
    {
      id:'e3', emoji:'📱', title:'Panduan Setup Perangkat',
      summary:'Cara mengaktifkan pembatas app di iOS, Android, dan browser.',
      content:`<h3 style="margin-bottom:6px">📱 iPhone / iOS</h3>
        <p style="margin-bottom:12px">Pengaturan → Screen Time → App Limits → Social Networking → set durasi.</p>
        <h3 style="margin-bottom:6px">🤖 Android</h3>
        <p style="margin-bottom:12px">Pengaturan → Digital Wellbeing → Dashboard → ketuk app → Timer → set durasi.</p>
        <h3 style="margin-bottom:6px">💻 Browser</h3>
        <ul style="padding-left:16px;line-height:2;margin-bottom:12px"><li><strong>StayFocusd</strong> (Chrome)</li><li><strong>LeechBlock</strong> (Firefox)</li><li><strong>Cold Turkey</strong> — sangat tegas</li></ul>
        <h3 style="margin-bottom:6px">🎨 Mode Grayscale</h3>
        <p>Layar hitam putih membuat konten kurang menarik secara visual.</p>
        <ul style="padding-left:16px;line-height:2;margin-top:4px"><li>iOS: Pengaturan → Aksesibilitas → Filter Warna</li><li>Android: Pengaturan → Aksesibilitas → Koreksi Warna (Grayscale)</li></ul>`,
    },
    {
      id:'e4', emoji:'😴', title:'Scroll & Kualitas Tidur',
      summary:'Kenapa scroll sebelum tidur buruk, dan apa yang lebih baik.',
      content:`<p>Layar HP memancarkan <strong>cahaya biru</strong> yang menekan produksi melatonin — hormon tidur alami. Konten stimulatif juga membuat otak tetap aktif dan sulit tenang.</p>
        <br><h3 style="margin-bottom:8px">Ritual malam yang lebih baik:</h3>
        <ul style="padding-left:16px;line-height:2"><li>Stop layar 30-60 menit sebelum tidur</li><li>Baca buku fisik</li><li>Tulis jurnal atau 3 hal yang kamu syukuri</li><li>Latihan napas (coba fitur Latihan Napas!)</li><li>Dengarkan musik tenang</li></ul>`,
    },
    {
      id:'e5', emoji:'🎯', title:'Mengapa Niat Itu Penting',
      summary:'Perbedaan antara scroll sadar dan scroll tanpa tujuan.',
      content:`<p>Penelitian menunjukkan <strong>mindful scrolling</strong> — scroll dengan tujuan jelas — jauh lebih tidak merusak dari scroll tanpa tujuan. Ketika membuka dengan tujuan spesifik, kamu lebih mudah berhenti setelah tujuan tercapai.</p>
        <br><h3 style="margin-bottom:8px">Praktikkan:</h3>
        <ul style="padding-left:16px;line-height:2"><li>Sebelum membuka app, tanyakan: "Apa yang aku mau lihat?"</li><li>Gunakan fitur Sesi di Tenang untuk menetapkan niat</li><li>Setelah tujuan tercapai, tutup app dengan sadar</li><li>Perhatikan bagaimana perasaanmu — ini data berharga</li></ul>`,
    },
  ];

  let openId = null;

  function render() {
    if (openId) {
      const a = ARTS.find(x => x.id === openId);
      el.innerHTML = `
        ${UI.backHeader(a.emoji + ' ' + a.title, 'more')}
        <div class="card card-lg" style="line-height:1.8;font-size:.9rem">${a.content}</div>
        <button class="btn btn-secondary btn-full mt-4" onclick="eduBack()">← Kembali ke Edukasi</button>`;
      return;
    }

    el.innerHTML = `
      ${UI.backHeader('Edukasi 📚', 'more')}
      <p class="text-sm text-2 mb-4">Pahami kenapa doom scrolling terjadi dan cara mengatasinya.</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${ARTS.map(a => `
          <div class="card card-lg menu-item" role="button" tabindex="0" data-edu="${a.id}">
            <div class="flex gap-3 items-center">
              <span style="font-size:2rem;width:36px;text-align:center">${a.emoji}</span>
              <div style="flex:1">
                <p class="font-600 mb-1">${a.title}</p>
                <p class="text-xs text-2">${a.summary}</p>
              </div>
              <span class="menu-arrow"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></span>
            </div>
          </div>`).join('')}
      </div>`;

    el.querySelectorAll('[data-edu]').forEach(item => {
      item.addEventListener('click', () => { openId = item.dataset.edu; render(); });
    });
  }

  window.eduBack = () => { openId = null; render(); };
  render();
  return el;
};
