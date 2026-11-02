'use strict';
/* 뱀파이어 서바이벌 미니
 * 원작 방식을 유지하되 과제 조건(T02-C01~C31)과 충돌하는 부분만 조정했다.
 *  - 한 판의 끝: 5:00 보스 처치 = 성공, HP 0 = 실패 (원작: 30분 생존)
 *  - 난이도: 값 하나(적 배율 D)가 적 체력과 등장 속도를 함께 바꾼다
 *  - 입력: 키 반복(e.repeat) 무시, 카드 선택 1회 잠금, 포커스 이탈 시 자동 일시정지
 *  - 효과: 선언한 사건(EFFECTS)에서만 재생, 음소거·움직임 줄이기 즉시 반영
 *  - 저장: 보존(최고 기록·기록표·설정) / 초기화(그 외 모든 판 상태)를 구분, 손상 값은 기본값으로 복구
 */
(function () {
  if (window.__vsMini) return;            // 이벤트 중복 등록 방지
  window.__vsMini = {};

  const W = 960, H = 540, BOSS_TIME = 300, MAX_E = 260;
  const DIFFS = { easy: { label: '쉬움', v: 0.7 }, normal: { label: '보통', v: 1.0 }, hard: { label: '어려움', v: 1.5 } };
  const EFFECTS = new Set(['playerHit', 'levelUp', 'bossSpawn', 'enemyDeath', 'enemyHit', 'victory', 'defeat']);
  const TAU = Math.PI * 2, rnd = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (id) => document.getElementById(id);
  const mmss = (s) => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  const cv = $('cv'), ctx = cv.getContext('2d'), ov = $('ov'), wrap = $('wrap'), stage = $('stage');

  /* ───────── 저장소 (보존: best, runs, settings) ───────── */
  const STORE_KEY = 'vsmini.v1';
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  function cleanRun(r) {
    if (!r || typeof r !== 'object') return null;
    if (!(isNum(r.time) && isNum(r.kills) && isNum(r.level) && isNum(r.score) && isNum(r.d))) return null;
    if (r.result !== 'win' && r.result !== 'lose') return null;
    return {
      n: isNum(r.n) ? r.n : 0, at: String(r.at || '').slice(0, 24), d: r.d,
      diff: DIFFS[r.diff] ? r.diff : 'normal', result: r.result, time: r.time, kills: r.kills,
      level: r.level, score: r.score, cause: String(r.cause || '').slice(0, 24)
    };
  }
  function loadStore() {
    const s = { best: null, runs: [], settings: { mute: false, reduce: null, diff: 'normal' } };
    try {
      const o = JSON.parse(localStorage.getItem(STORE_KEY));
      if (o && typeof o === 'object') {
        if (Array.isArray(o.runs)) s.runs = o.runs.map(cleanRun).filter(Boolean).slice(-200);
        s.best = cleanRun(o.best);
        if (!s.best && s.runs.length) s.best = s.runs.reduce((a, b) => (b.score > a.score ? b : a));
        const t = o.settings;
        if (t && typeof t === 'object') {
          if (typeof t.mute === 'boolean') s.settings.mute = t.mute;
          if (typeof t.reduce === 'boolean') s.settings.reduce = t.reduce;
          if (DIFFS[t.diff]) s.settings.diff = t.diff;
        }
      }
    } catch (e) { /* 비었거나 손상 → 기본값 */ }
    return s;
  }
  const store = loadStore();
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* 저장 불가여도 게임은 계속 */ } }
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => (store.settings.reduce === null ? mq.matches : store.settings.reduce);

  /* ───────── 데이터 ───────── */
  // ic = items.png 칸 번호 (0~2 보석, 3 회복, 4 마법탄, 5 단검, 6 도끼, 7 십자가, 8 성서, 9 적 탄, 10 마늘, 11~16 능력)
  const WDEF = {
    wand:   { n: '부적',       d: '가장 가까운 적에게 부적을 날린다. 레벨이 오르면 여러 장을 퍼뜨려 날리고 관통한다.', ix: 0, col: '#ffd86b', ic: 4 },
    knife:  { n: '쿠나이',     d: '바라보는 방향으로 쿠나이를 연사한다. 이동하면서 싸우기 좋다.', ix: 1, col: '#dfe6ff', ic: 5 },
    axe:    { n: '낫',         d: '위로 던져 포물선으로 떨어지는 관통 낫. 높은 피해로 무리를 벤다.', ix: 2, col: '#ffb25b', ic: 6 },
    bible:  { n: '도깨비불',   d: '몸 주위를 도는 푸른 혼불이 적을 태우고 밀어낸다. 자동 방어막 역할을 한다.', ix: 3, col: '#6fd0ff', ic: 8 },
    garlic: { n: '향로',       d: '피어오르는 향 연기가 주변 적에게 지속 피해를 주고 밀어낸다. 레벨이 오르면 범위가 넓어진다.', ix: 4, col: '#e9f5c8', ic: 10 },
    cross:  { n: '풍차 수리검', d: '적을 향해 날아갔다 돌아오는 관통 수리검. 두 번 맞힐 수 있다.', ix: 5, col: '#c9d3e6', ic: 7 }
  };
  // 무기 수치(레벨별). 발사 로직과 카드 설명이 같은 표를 쓴다.
  const WSTAT = {
    wand:   (l) => ({ dmg: 9 + 2 * l, cd: 1.2 - 0.1 * l, n: [1, 2, 2, 3, 3][l - 1], pierce: l >= 4 ? 2 : 1 }),
    knife:  (l) => ({ dmg: 6 + 1.5 * l, cd: 0.85 - 0.07 * l, n: [1, 2, 2, 3, 4][l - 1], pierce: 2 }),
    axe:    (l) => ({ dmg: 18 + 4 * l, cd: 1.6 - 0.1 * l, n: [1, 1, 2, 2, 3][l - 1] }),
    cross:  (l) => ({ dmg: 12 + 2.5 * l, cd: 2.2 - 0.12 * l, n: [1, 1, 2, 2, 3][l - 1] }),
    garlic: (l) => ({ dmg: 4 + 1.5 * l, cd: 0.45, rad: 50 + 10 * l }),
    bible:  (l) => ({ dmg: 7 + 2 * l, n: [2, 2, 3, 3, 4][l - 1], rad: 70 + 4 * l, spd: +(2.4 * (1 + 0.1 * l)).toFixed(1) })
  };
  const STAT_LABEL = { dmg: '피해', cd: '쿨다운', n: '개수', pierce: '관통', rad: '범위', spd: '회전 속도' };
  const fmtStat = (k, v) => (k === 'cd' ? v.toFixed(2) + '초' : k === 'dmg' ? String(+v.toFixed(1)) : k === 'n' ? v + '개' : k === 'pierce' ? v + '회' : k === 'rad' ? v + 'px' : v + '배');
  function weaponLines(id, cur) {
    const next = WSTAT[id](cur + 1), base = cur ? WSTAT[id](cur) : null;
    return Object.keys(next).map((k) => (base ? (base[k] === next[k] ? null : STAT_LABEL[k] + ' ' + fmtStat(k, base[k]) + ' → ' + fmtStat(k, next[k]))
      : STAT_LABEL[k] + ' ' + fmtStat(k, next[k]))).filter(Boolean);
  }
  const PFX = {
    might:  (l) => '공격력 +' + 10 * l + '%', armor: (l) => '받는 피해 -' + l, hp: (l) => '최대 체력 +' + 20 * l + '%',
    speed:  (l) => '이동 속도 +' + 10 * l + '%', cool: (l) => '쿨다운 -' + 8 * l + '%', magnet: (l) => '획득 범위 +' + 30 * l + '%'
  };
  const PDEF = {
    might:  { n: '인장',      d: '모든 무기의 피해량이 늘어난다.', ic: 11 },
    armor:  { n: '투구',      d: '적에게 받는 피해가 줄어든다.', ic: 12 },
    hp:     { n: '호리병',    d: '최대 체력이 늘고 그만큼 회복된다.', ic: 13 },
    speed:  { n: '나막신',    d: '더 빠르게 움직인다.', ic: 14 },
    cool:   { n: '태극',      d: '기운의 균형으로 무기를 더 자주 사용한다.', ic: 15 },
    magnet: { n: '엽전',      d: '구슬을 더 멀리서 끌어당긴다.', ic: 16 }
  };
  const ET = {
    bat:    { n: '불꽃 귀신',  hp: 5,   spd: 80, dmg: 5,  r: 9,  xp: 1,  col: '#ff8a3a' },
    zombie: { n: '갓파',     hp: 22,  spd: 40, dmg: 8,  r: 13, xp: 2,  col: '#6fae5a' },
    skel:   { n: '해골불',   hp: 14,  spd: 90, dmg: 7,  r: 11, xp: 2,  col: '#ff5b4a' },
    wraith: { n: '원귀',     hp: 30,  spd: 55, dmg: 10, r: 12, xp: 4,  col: '#9fd8ee' },
    brute:  { n: '텐구',     hp: 260, spd: 46, dmg: 16, r: 21, xp: 20, col: '#c0562f', elite: true },
    boss:   { n: '오니 무사 보스', hp: 3800, spd: 42, dmg: 24, r: 38, xp: 0,  col: '#c8322e', boss: true }
  };

  /* ───────── 풀 (개체 수 상한 → 10분 실행 안정) ───────── */
  const mk = (n, f) => Array.from({ length: n }, f);
  const enemies = mk(MAX_E, () => ({ on: false, x: 0, y: 0, hp: 0, maxHp: 0, t: ET.bat, tn: 'bat', hitT: [0, 0, 0, 0, 0, 0], flash: 0, id: 0, kx: 0, ky: 0, ph: 0, sh: 0, dir: 1 }));
  const shots = mk(160, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, dmg: 0, pierce: 0, life: 0, kind: '', g: 0, ax: 0, ay: 0, hits: [], rot: 0, tx: new Float32Array(8), ty: new Float32Array(8), th: 0, tn: 0, ret: false, life0: 1, col: '#fff' }));
  const ebul = mk(120, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
  const gems = mk(400, () => ({ on: false, x: 0, y: 0, v: 1, kind: 0, mag: false }));
  const parts = mk(300, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: '#fff', s: 3 }));
  const texts = mk(48, () => ({ on: false, x: 0, y: 0, v: 0, life: 0 }));
  let textCur = 0;
  const grid = mk(512, () => []);

  /* ───────── 상태 ───────── */
  let state = 'title';      // title | playing | paused | levelup | won | lost
  let run = null;
  const p = { x: 0, y: 0, hp: 100, maxHp: 100, xp: 0, level: 1, fx: 1, fy: 0, inv: 0, weapons: [], pas: {} };
  const keys = new Set();
  const io = { rx: 0, ok: 0 };
  const bot = { on: false, t: 0 };
  let clearArm = 0, panelT = 0, last = 0;

  const xpNeed = (l) => 5 + (l - 1) * 6;
  const pausedReason = { v: '' };

  function resetRun() {
    for (const a of [enemies, shots, ebul, gems, parts, texts]) for (const o of a) o.on = false;
    const dk = store.settings.diff;
    run = {
      t: 0, kills: 0, spawnAcc: 0, eliteT: 20, boss: null, bossSpawned: false, pending: 0, choices: [], locked: false,
      ended: false, shake: 0, ox: 0, oy: 0, flash: 0, banner: '', bannerT: 0, cause: '', D: DIFFS[dk].v, diff: dk,
      eid: 0, ring: 0, newBest: false, result: ''
    };
    Object.assign(p, {
      x: 0, y: 0, hp: 100, maxHp: 100, xp: 0, level: 1, fx: 1, fy: 0, inv: 0, weapons: [],
      pas: { might: 0, armor: 0, hp: 0, speed: 0, cool: 0, magnet: 0 }
    });
    addWeapon('wand');
  }
  function addWeapon(id) { p.weapons.push({ id, lvl: 1, t: 0.3, ang: 0, ix: WDEF[id].ix }); }

  function startRun() { resetRun(); setState('playing'); }

  /* ───────── 상태 전환·오버레이 ───────── */
  const STATE_LABEL = { title: '시작 전', playing: '진행 중', paused: '일시정지', levelup: '레벨업 선택', won: '성공', lost: '실패' };
  function setState(s, reason) {
    state = s;
    pausedReason.v = reason || '';
    renderOverlay();
    updatePanel();
  }
  function renderOverlay() {
    let h = '';
    if (state === 'title') {
      h = '<div class="box"><h2>뱀파이어 서바이벌 미니</h2>' +
        '<p>자동 공격으로 몰려오는 적을 막고 <b>5:00 보스</b>를 처치하세요.</p>' +
        '<p>이동 WASD/방향키 · 일시정지 P/Esc · 다시 시작 R</p>' +
        '<button type="button" data-act="start">시작 (Enter)</button></div>';
    } else if (state === 'paused') {
      h = '<div class="box"><h2>일시정지</h2>' + (pausedReason.v ? '<p>' + pausedReason.v + '</p>' : '') +
        '<button type="button" data-act="resume">재개 (P)</button><button type="button" class="sub" data-act="restart">다시 시작 (R)</button></div>';
    } else if (state === 'levelup') {
      h = '<div class="box"><h2>레벨 업!</h2><p>카드를 1장 고르세요 (1·2·3)</p><div class="cards">' +
        run.choices.map((c, i) => {
          const info = c.type === 'weapon' ? WDEF[c.id] : c.type === 'pas' ? PDEF[c.id] : { n: '복숭아', d: '불로장생의 복숭아. 체력을 30% 회복한다.', ic: 3 };
          const lv = c.type === 'heal' ? '' : c.cur === 0 ? 'NEW' : 'Lv ' + c.cur + ' → ' + (c.cur + 1) + (c.cur + 1 === 5 ? ' (MAX)' : '');
          const lines = c.type === 'weapon' ? weaponLines(c.id, c.cur)
            : c.type === 'pas' ? [(c.cur ? PFX[c.id](c.cur) + ' → ' : '') + PFX[c.id](c.cur + 1)] : ['+' + Math.round(p.maxHp * 0.3) + ' HP'];
          return '<button type="button" class="card" data-act="pick" data-i="' + i + '"><i class="ico" style="--i:' + info.ic + '"></i><b>' + info.n + '</b><span class="lv">' + lv +
            '</span><span class="st">' + lines.join('<br>') + '</span><span class="ds">' + info.d + '</span><span class="key">[' + (i + 1) + ']</span></button>';
        }).join('') + '</div></div>';
    } else if (state === 'won' || state === 'lost') {
      const win = state === 'won';
      h = '<div class="box"><h2 class="' + (win ? 'win' : 'lose') + '">' + (win ? '성공! 보스를 처치했습니다' : '실패… 쓰러졌습니다') + '</h2>' +
        '<div class="stats"><span>생존 시간</span><span>' + mmss(run.t) + '</span><span>처치</span><span>' + run.kills +
        '</span><span>레벨</span><span>' + p.level + '</span><span>점수</span><span>' + score(win) + '</span>' +
        (win ? '' : '<span>실패 원인</span><span>' + run.cause + '</span>') + '</div>' +
        (run.newBest ? '<p class="win">최고 기록 갱신!</p>' : '') +
        '<button type="button" data-act="restart">다시 시작 (R)</button></div>';
    }
    ov.innerHTML = h;
    ov.style.display = h ? 'flex' : 'none';
  }
  const score = (win) => run.kills * 10 + p.level * 100 + Math.floor(run.t) * 2 + (win ? 1000 : 0);

  /* ───────── 입력 ───────── */
  const KEYMAP = { w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', p: 'KeyP', r: 'KeyR', b: 'KeyB', escape: 'Escape', enter: 'Enter', ' ': 'Space',
    arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', '1': 'Digit1', '2': 'Digit2', '3': 'Digit3' };
  const MOVE = { KeyW: 'u', ArrowUp: 'u', KeyA: 'l', ArrowLeft: 'l', KeyS: 'd', ArrowDown: 'd', KeyD: 'r', ArrowRight: 'r' };
  const normKey = (e) => (e.code && /^(Key[WASDPRB]|Arrow(Up|Down|Left|Right)|Escape|Enter|Space|Digit[123])$/.test(e.code)) ? e.code : (KEYMAP[String(e.key || '').toLowerCase()] || '');

  function count(fn) { io.rx++; if (fn()) io.ok++; }
  function togglePause(reason) {
    if (state === 'playing') { setState('paused', reason); return true; }
    if (state === 'paused') { setState('playing'); return true; }
    return false;
  }
  function pick(i) {
    if (state !== 'levelup' || run.locked) return false;
    const c = run.choices[i];
    if (!c) return false;
    run.locked = true;                         // 같은 카드 이중 선택 방지
    applyChoice(c);
    run.pending--;
    if (run.pending > 0) { run.choices = rollChoices(); run.locked = false; renderOverlay(); }
    else setState('playing');
    return true;
  }
  function tryStart() {
    if (state === 'title') { startRun(); return true; }
    return false;
  }

  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'range')) return;
    const k = normKey(e);
    if (!k) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (tag === 'BUTTON' && (k === 'Enter' || k === 'Space')) return;   // 버튼 클릭과 이중 처리 방지
    if (k.startsWith('Arrow') || k === 'Space') e.preventDefault();
    if (MOVE[k]) { keys.add(MOVE[k]); return; }
    if (e.repeat) return;                       // 키를 누르고 있어도 한 번만
    if (k === 'KeyP' || k === 'Escape') count(() => togglePause());
    else if (k === 'KeyR') count(() => { if (state === 'title') return false; startRun(); return true; });
    else if (k === 'Enter' || k === 'Space') count(tryStart);
    else if (k === 'Digit1') count(() => pick(0));
    else if (k === 'Digit2') count(() => pick(1));
    else if (k === 'Digit3') count(() => pick(2));
    else if (k === 'KeyB') count(() => { bot.on = !bot.on; bot.t = 0; return true; });
    updateIO();
  });
  window.addEventListener('keyup', (e) => { const k = normKey(e); if (MOVE[k]) keys.delete(MOVE[k]); });
  function losePausedFocus() {
    keys.clear();
    if (state === 'playing') setState('paused', '화면 포커스를 잃어 일시정지했습니다');
  }
  window.addEventListener('blur', losePausedFocus);
  document.addEventListener('visibilitychange', () => { if (document.hidden) losePausedFocus(); });

  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'start') tryStart();
    else if (a === 'resume') togglePause();
    else if (a === 'restart') startRun();
    else if (a === 'pick') pick(+b.dataset.i);
    b.blur();
  });
  $('btnPause').addEventListener('click', (e) => { togglePause(); e.currentTarget.blur(); });
  $('btnRestart').addEventListener('click', (e) => { if (state === 'title') tryStart(); else startRun(); e.currentTarget.blur(); });

  /* ───────── 설정 UI ───────── */
  const selDiff = $('selDiff'), chkMute = $('chkMute'), chkReduce = $('chkReduce');
  selDiff.value = store.settings.diff;
  chkMute.checked = store.settings.mute;
  chkReduce.checked = reduced();
  selDiff.addEventListener('change', () => {
    if (state === 'playing' || state === 'paused' || state === 'levelup') { selDiff.value = store.settings.diff; selDiff.blur(); return; }
    store.settings.diff = selDiff.value; saveStore(); updatePanel(); selDiff.blur();
  });
  chkMute.addEventListener('change', () => { store.settings.mute = chkMute.checked; applyMute(); saveStore(); chkMute.blur(); });
  chkReduce.addEventListener('change', () => {
    store.settings.reduce = chkReduce.checked; saveStore();
    if (chkReduce.checked && run) { run.shake = 0; run.ox = run.oy = 0; run.flash = 0; run.ring = 0; for (const o of parts) o.on = false; }
    chkReduce.blur();
  });

  /* ───────── 소리 (선언한 사건에서만) ───────── */
  let ac = null, master = null;
  const activeOsc = new Set();
  function audio() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = store.settings.mute ? 0 : 0.5; master.connect(ac.destination);
      } catch (e) { ac = null; }
    }
    return ac;
  }
  function applyMute() {
    if (master) master.gain.value = store.settings.mute ? 0 : 0.5;
    if (store.settings.mute) { for (const o of activeOsc) { try { o.stop(); } catch (e) { /* 이미 끝남 */ } } activeOsc.clear(); }
  }
  function tone(freq, dur, type, vol, slide, delay) {
    if (store.settings.mute) return;
    const a = audio(); if (!a) return;
    if (a.state === 'suspended') a.resume();
    const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
    activeOsc.add(o); o.onended = () => activeOsc.delete(o);
  }
  function fx(ev, x, y, col) {
    if (!EFFECTS.has(ev)) return;
    const red = reduced();
    switch (ev) {
      case 'playerHit': tone(170, 0.14, 'sawtooth', 0.25, 70); if (!red) { run.shake = 0.22; run.flash = 0.28; } break;
      case 'levelUp': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, 0, i * 0.07)); if (!red) run.ring = 0.6; break;
      case 'bossSpawn': tone(80, 0.7, 'square', 0.3, 38); run.banner = '보스 출현!'; run.bannerT = 3; if (!red) run.shake = 0.5; break;
      case 'enemyDeath': if (!red) for (let i = 0; i < 6; i++) spawnPart(x, y, col); break;
      case 'enemyHit': if (!red) for (let i = 0; i < 2; i++) spawnPart(x, y, col, 0.55); break;
      case 'victory': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.25, 0, i * 0.1)); break;
      case 'defeat': [440, 349, 262, 196].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.2, 0, i * 0.14)); break;
    }
  }
  function spawnPart(x, y, col, k) {
    const o = parts.find((q) => !q.on); if (!o) return;
    const a = rnd() * TAU, sp = (40 + rnd() * 90) * (k || 1), life = 0.4 * (k || 1) + 0.1;
    Object.assign(o, { on: true, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, col: col || '#fff', s: 2 + rnd() * 2 });
  }

  /* ───────── 레벨업 ───────── */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function rollChoices() {
    const o = [];
    for (const id in WDEF) {
      const w = p.weapons.find((x) => x.id === id);
      if (w) { if (w.lvl < 5) o.push({ type: 'weapon', id, cur: w.lvl }); }
      else if (p.weapons.length < 6) o.push({ type: 'weapon', id, cur: 0 });
    }
    for (const id in PDEF) if (p.pas[id] < 5) o.push({ type: 'pas', id, cur: p.pas[id] });
    const c = shuffle(o).slice(0, 3);
    if (c.length < 3) c.push({ type: 'heal' });
    return c;
  }
  function applyChoice(c) {
    if (c.type === 'weapon') { const w = p.weapons.find((x) => x.id === c.id); if (w) w.lvl++; else addWeapon(c.id); }
    else if (c.type === 'pas') {
      p.pas[c.id]++;
      if (c.id === 'hp') { const old = p.maxHp; p.maxHp = Math.round(100 * (1 + 0.2 * p.pas.hp)); p.hp += p.maxHp - old; }
    } else p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
  }
  function openLevelUp() {
    run.choices = rollChoices(); run.locked = false;
    fx('levelUp');
    setState('levelup');
  }

  /* ───────── 적 ───────── */
  function ringPos(r) { const a = rnd() * TAU; return [p.x + Math.cos(a) * r, p.y + Math.sin(a) * r]; }
  function spawnEnemy(tn, pos) {
    const e = enemies.find((q) => !q.on); if (!e) return null;
    const t = ET[tn], m = run.t / 60;
    const [x, y] = pos || ringPos(590 + rnd() * 60);
    const hp = t.boss ? t.hp * run.D : t.hp * run.D * (1 + m * 0.35);
    Object.assign(e, { on: true, x, y, hp, maxHp: hp, t, tn, flash: 0, id: ++run.eid, kx: 0, ky: 0, ph: rnd() * TAU, sh: 2, dir: 1 });
    e.hitT.fill(-9);
    return e;
  }
  function pickType(m) {
    const w = [['bat', 4]];
    if (m >= 0.4) w.push(['zombie', 3 + m]);
    if (m >= 1.5) w.push(['skel', 3]);
    if (m >= 2.5) w.push(['wraith', 2]);
    let s = 0; for (const x of w) s += x[1];
    let r = rnd() * s; for (const x of w) { r -= x[1]; if (r <= 0) return x[0]; }
    return 'bat';
  }
  function spawnStep(dt) {
    const m = run.t / 60;
    run.spawnAcc += (1.3 + m * 1.3) * run.D * dt * (run.bossSpawned ? 0.5 : 1);
    while (run.spawnAcc >= 1) { run.spawnAcc -= 1; spawnEnemy(pickType(m)); }
    run.eliteT -= dt;
    if (m >= 2.5 && run.eliteT <= 0 && !run.bossSpawned) { spawnEnemy('brute'); run.eliteT = 28 / run.D; }
    if (!run.bossSpawned && run.t >= BOSS_TIME) {
      run.bossSpawned = true;
      run.boss = spawnEnemy('boss', ringPos(480));
      fx('bossSpawn');
    }
  }
  function hitEnemy(e, dmg, dx, dy, kb, col) {
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.1;
    if (kb && !e.t.boss) { const l = Math.hypot(dx, dy) || 1; e.kx += (dx / l) * kb; e.ky += (dy / l) * kb; }
    const tx = texts[textCur]; textCur = (textCur + 1) % texts.length;
    Object.assign(tx, { on: true, x: e.x, y: e.y - e.t.r, v: dmg, life: 0.6 });
    if (col) fx('enemyHit', e.x, e.y, col);
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.on = false; run.kills++;
    const t = e.t;
    if (t.xp) dropGem(e.x, e.y, t.xp, 0);
    if (rnd() < (t.elite ? 0.6 : 0.012)) dropGem(e.x + 6, e.y + 6, 30, 1);
    fx('enemyDeath', e.x, e.y, t.col);
    if (t.boss) { run.boss = null; for (const b of ebul) b.on = false; endRun(true); }
  }
  function dropGem(x, y, v, kind) {
    let g = gems.find((q) => !q.on);
    if (!g) {                                   // 가득 차면 기존 경험치 보석에 합친다
      if (kind === 1) return;
      g = gems[(rnd() * gems.length) | 0];
      if (g.kind === 0) { g.v += v; return; }
      return;
    }
    Object.assign(g, { on: true, x, y, v, kind, mag: false });
  }
  function updateEnemies(dt) {
    for (const b of grid) b.length = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]; if (!e.on) continue;
      const t = e.t;
      let dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d > 1100 && !t.boss) { const [nx, ny] = ringPos(600); e.x = nx; e.y = ny; dx = p.x - e.x; dy = p.y - e.y; d = Math.hypot(dx, dy) || 1; }
      let vx = dx / d, vy = dy / d;
      if (e.tn === 'wraith' || e.tn === 'bat') { const w = Math.sin(run.t * 3 + e.ph) * 0.6; const nx = -vy * w, ny = vx * w; vx += nx; vy += ny; }
      e.x += (vx * t.spd + e.kx) * dt; e.y += (vy * t.spd + e.ky) * dt;
      const kd = Math.max(0, 1 - 7 * dt); e.kx *= kd; e.ky *= kd;
      if (Math.abs(dx) > 2) e.dir = dx > 0 ? 1 : -1;
      if (e.flash > 0) e.flash -= dt;
      if (t.boss) {
        e.sh -= dt;
        if (e.sh <= 0) {
          const ph2 = e.hp < e.maxHp * 0.5, n = ph2 ? 20 : 14, base = rnd() * TAU;
          for (let k = 0; k < n; k++) fireEBullet(e.x, e.y, base + (k / n) * TAU, 150);
          const aim = Math.atan2(p.y - e.y, p.x - e.x);
          for (let k = -1; k <= 1; k++) fireEBullet(e.x, e.y, aim + k * 0.18, 210);
          e.sh = ph2 ? 2.4 : 3.6;
        }
      }
      const cx = Math.floor(e.x / 48), cy = Math.floor(e.y / 48);
      grid[(((cx * 92837111) ^ (cy * 689287499)) >>> 0) % 512].push(i);
    }
    // 겹침 해소 (이웃 칸만 검사)
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i]; if (!a.on) continue;
      const cx = Math.floor(a.x / 48), cy = Math.floor(a.y / 48);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const bucket = grid[((((cx + ox) * 92837111) ^ ((cy + oy) * 689287499)) >>> 0) % 512];
        for (let k = 0; k < bucket.length; k++) {
          const j = bucket[k]; if (j <= i) continue;
          const b = enemies[j];
          const dx = b.x - a.x, dy = b.y - a.y, min = (a.t.r + b.t.r) * 0.8, d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < min * min) {
            const d = Math.sqrt(d2), push = (min - d) * 0.5, tot = a.t.r + b.t.r;
            const fa = b.t.r / tot, fb = a.t.r / tot;
            a.x -= (dx / d) * push * fa * 2; a.y -= (dy / d) * push * fa * 2;
            b.x += (dx / d) * push * fb * 2; b.y += (dy / d) * push * fb * 2;
          }
        }
      }
    }
  }
  function fireEBullet(x, y, a, sp) {
    const b = ebul.find((q) => !q.on); if (!b) return;
    Object.assign(b, { on: true, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 5 });
  }

  /* ───────── 무기 ───────── */
  function nearest(range) {
    let best = null, bd = range * range;
    for (const e of enemies) {
      if (!e.on) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function shoot(o) {
    const s = shots.find((q) => !q.on); if (!s) return;
    Object.assign(s, { on: true, x: p.x, y: p.y, vx: Math.cos(o.ang) * o.sp, vy: Math.sin(o.ang) * o.sp, r: o.r, dmg: o.dmg, pierce: o.pierce, life: o.life, kind: o.kind, g: o.g || 0, ax: o.ax || 0, ay: o.ay || 0, rot: rnd() * TAU, th: 0, tn: 0, ret: false, life0: o.life, col: WDEF[o.kind].col });
    if (o.vy0 !== undefined) { s.vy = o.vy0; s.vx = o.vx0; }
    s.hits.length = 0;
  }
  function updateWeapons(dt) {
    const cm = 1 - 0.08 * p.pas.cool, dm = 1 + 0.1 * p.pas.might;
    for (const w of p.weapons) {
      const L = w.lvl, S = WSTAT[w.id](L), col = WDEF[w.id].col;
      if (w.pulse > 0) w.pulse -= dt;
      if (w.id === 'bible') {                          // 상시 공전: 쿨다운 없음
        w.ang += dt * S.spd;
        for (let i = 0; i < S.n; i++) {
          const a = w.ang + (i / S.n) * TAU, bx = p.x + Math.cos(a) * S.rad, by = p.y + Math.sin(a) * S.rad;
          for (const e of enemies) {
            if (!e.on) continue;
            const dx = e.x - bx, dy = e.y - by, rr = e.t.r + 14;
            if (dx * dx + dy * dy < rr * rr && run.t - e.hitT[w.ix] > 0.6) { e.hitT[w.ix] = run.t; hitEnemy(e, S.dmg * dm, dx, dy, 120, col); }
          }
        }
        continue;
      }
      w.t -= dt;
      if (w.t > 0) continue;
      if (w.id === 'garlic') {
        w.t = w.cdMax = S.cd * cm; w.pulse = 0.3;
        for (const e of enemies) {
          if (!e.on) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          if (dx * dx + dy * dy < (S.rad + e.t.r) * (S.rad + e.t.r)) hitEnemy(e, S.dmg * dm, dx, dy, 90, col);
        }
        continue;
      }
      if (w.id === 'knife') {
        w.t = w.cdMax = S.cd * cm;
        const base = Math.atan2(p.fy, p.fx);
        for (let i = 0; i < S.n; i++) shoot({ kind: 'knife', ang: base + (i - (S.n - 1) / 2) * 0.12, sp: 520, r: 6, dmg: S.dmg * dm, pierce: S.pierce, life: 1.1 });
        continue;
      }
      if (w.id === 'axe') {
        w.t = w.cdMax = S.cd * cm;
        for (let i = 0; i < S.n; i++) shoot({ kind: 'axe', ang: 0, sp: 0, vx0: (rnd() - 0.5) * 260, vy0: -420 - rnd() * 60, r: 14, dmg: S.dmg * dm, pierce: 99, life: 2.4, g: 700 });
        continue;
      }
      const tg = nearest(w.id === 'cross' ? 500 : 450);   // 조준형: 마법 지팡이, 십자가
      if (!tg) { w.t = 0.15; continue; }
      w.t = w.cdMax = S.cd * cm;
      const base = Math.atan2(tg.y - p.y, tg.x - p.x);
      if (w.id === 'wand') {
        for (let i = 0; i < S.n; i++) shoot({ kind: 'wand', ang: base + (i - (S.n - 1) / 2) * 0.14, sp: 380, r: 7, dmg: S.dmg * dm, pierce: S.pierce, life: 1.6 });
      } else {
        for (let i = 0; i < S.n; i++) {
          const a = base + (i - (S.n - 1) / 2) * 0.3;
          shoot({ kind: 'cross', ang: a, sp: 340, r: 12, dmg: S.dmg * dm, pierce: 99, life: 2.2, ax: -Math.cos(a) * 310, ay: -Math.sin(a) * 310 });
        }
      }
    }
  }
  function updateShots(dt) {
    for (const s of shots) {
      if (!s.on) continue;
      s.life -= dt;
      s.vy += s.g * dt; s.vx += s.ax * dt; s.vy += s.ay * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 9;
      s.tx[s.th] = s.x; s.ty[s.th] = s.y; s.th = (s.th + 1) & 7; if (s.tn < 8) s.tn++;
      if (s.kind === 'cross' && !s.ret && s.life < s.life0 / 2) { s.ret = true; s.hits.length = 0; }   // 돌아오는 길에 다시 맞힌다
      if (s.life <= 0 || Math.abs(s.x - p.x) > 900 || Math.abs(s.y - p.y) > 900) { s.on = false; continue; }
      for (const e of enemies) {
        if (!e.on) continue;
        const dx = e.x - s.x, dy = e.y - s.y, rr = e.t.r + s.r;
        if (dx * dx + dy * dy < rr * rr && !s.hits.includes(e.id)) {
          s.hits.push(e.id);
          hitEnemy(e, s.dmg, s.vx, s.vy, 110, s.col);
          if (--s.pierce <= 0) { s.on = false; break; }
        }
      }
    }
  }

  /* ───────── 플레이어·충돌·아이템 ───────── */
  function botMove() {
    let mx = 0, my = 0, near = false;
    for (const e of enemies) {
      if (!e.on) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 < 170 * 170) { const d = Math.sqrt(d2) || 1, w = 1 / (d * 0.02 + 0.5); mx += (dx / d) * w; my += (dy / d) * w; near = true; }
    }
    for (const b of ebul) {
      if (!b.on) continue;
      const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 120 * 120) { const d = Math.sqrt(d2) || 1; mx += (dx / d) * 2; my += (dy / d) * 2; near = true; }
    }
    if (!near) {
      let bg = null, bd = 380 * 380;
      for (const g of gems) { if (!g.on) continue; const dx = g.x - p.x, dy = g.y - p.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bg = g; } }
      if (bg) { mx = bg.x - p.x; my = bg.y - p.y; } else { mx = Math.cos(run.t * 0.5); my = Math.sin(run.t * 0.5); }
    } else {
      mx += -p.y * 0.0006; my += p.x * 0.0006;
    }
    return [mx, my];
  }
  function movePlayer(dt) {
    let mx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), my = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
    if (bot.on) [mx, my] = botMove();
    const l = Math.hypot(mx, my);
    if (l > 0) { mx /= l; my /= l; p.fx = mx; p.fy = my; }
    const sp = 135 * (1 + 0.1 * p.pas.speed);
    p.x += mx * sp * dt; p.y += my * sp * dt;
    p.moving = l > 0;
  }
  function damagePlayer(dmg, cause) {
    p.hp -= Math.max(1, dmg - p.pas.armor);
    p.inv = 0.55; run.cause = cause;
    fx('playerHit');
  }
  function contacts(dt) {
    if (p.inv > 0) p.inv -= dt;
    if (p.inv > 0) return;
    for (const e of enemies) {
      if (!e.on) continue;
      const dx = e.x - p.x, dy = e.y - p.y, rr = e.t.r + 10;
      if (dx * dx + dy * dy < rr * rr) { damagePlayer(e.t.dmg, e.t.n); return; }
    }
    for (const b of ebul) {
      if (!b.on) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < 16 * 16) { b.on = false; damagePlayer(12, '보스의 탄막'); return; }
    }
  }
  function updateEBullets(dt) {
    for (const b of ebul) {
      if (!b.on) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) b.on = false;
    }
  }
  function updateGems(dt) {
    const mr = 55 * (1 + 0.3 * p.pas.magnet);
    for (const g of gems) {
      if (!g.on) continue;
      const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
      if (d > 2000) { g.on = false; continue; }
      if (d < mr) g.mag = true;
      if (g.mag) { const sp = 330 + (mr - Math.min(d, mr)) * 2; g.x += (dx / (d || 1)) * sp * dt; g.y += (dy / (d || 1)) * sp * dt; }
      if (d < 14) {
        g.on = false;
        if (g.kind === 1) p.hp = Math.min(p.maxHp, p.hp + g.v);
        else {
          p.xp += g.v;
          while (p.xp >= xpNeed(p.level)) { p.xp -= xpNeed(p.level); p.level++; run.pending++; }
        }
      }
    }
  }
  function updateFx(dt) {
    if (run.shake > 0) { run.shake -= dt; const m = Math.max(run.shake, 0) * 16; run.ox = (rnd() - 0.5) * m; run.oy = (rnd() - 0.5) * m; } else { run.ox = run.oy = 0; }
    if (run.flash > 0) run.flash -= dt;
    if (run.bannerT > 0) run.bannerT -= dt;
    if (run.ring > 0) run.ring -= dt;
    const red = reduced();
    for (const o of parts) { if (!o.on) continue; o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt; if (o.life <= 0) o.on = false; }
    for (const o of texts) { if (!o.on) continue; o.life -= dt; if (!red) o.y -= 30 * dt; if (o.life <= 0) o.on = false; }
  }

  /* ───────── 진행·종료 ───────── */
  function update(dt) {
    run.t += dt;
    movePlayer(dt);
    spawnStep(dt);
    updateWeapons(dt);
    updateShots(dt);
    updateEnemies(dt);
    updateEBullets(dt);
    contacts(dt);
    updateGems(dt);
    updateFx(dt);
    if (state !== 'playing') return;
    if (p.hp <= 0) { p.hp = 0; endRun(false); return; }
    if (run.pending > 0) openLevelUp();
  }
  function endRun(win) {
    if (run.ended) return;
    run.ended = true; run.result = win ? 'win' : 'lose';
    keys.clear();
    const rec = {
      n: store.runs.length ? store.runs[store.runs.length - 1].n + 1 : 1, at: new Date().toISOString().slice(0, 19),
      d: run.D, diff: run.diff, result: run.result, time: Math.floor(run.t), kills: run.kills, level: p.level,
      score: score(win), cause: win ? '-' : run.cause
    };
    store.runs.push(rec);
    if (store.runs.length > 200) store.runs.shift();
    if (!store.best || rec.score > store.best.score) { store.best = rec; run.newBest = true; }
    saveStore();
    fx(win ? 'victory' : 'defeat');
    setState(win ? 'won' : 'lost');
    renderRecords();
  }

  /* ───────── 그리기 ───────── */
  const groundPat = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#1d2a21'; g.fillRect(0, 0, 256, 256);
    let s = 12345; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 160; i++) {
      g.fillStyle = 'rgba(' + (55 + r() * 30 | 0) + ',' + (90 + r() * 45 | 0) + ',' + (55 + r() * 30 | 0) + ',' + (0.12 + r() * 0.2) + ')';
      g.fillRect(r() * 252, r() * 248, 1 + r() * 2, 4 + r() * 6);
    }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(120,125,135,' + (0.12 + r() * 0.12) + ')';
      g.beginPath(); g.ellipse(r() * 240 + 8, r() * 240 + 8, 3 + r() * 4, 2 + r() * 3, 0, 0, TAU); g.fill();
    }
    return ctx.createPattern(c, 'repeat');
  })();
  const FONT = '"Segoe UI","Malgun Gothic",sans-serif';

  /* 픽셀 스프라이트 (assets/, tools/make_sprites.py로 생성). 못 불러오면 도형 그리기로 대체 */
  const IMG = {};
  ['player', 'bat', 'zombie', 'skel', 'wraith', 'brute', 'boss', 'items', 'ground', 'decor'].forEach((n) => { const i = new Image(); i.src = 'assets/' + n + '.png'; IMG[n] = i; });
  const ready = (n) => IMG[n].complete && IMG[n].naturalWidth > 0;
  const SPR = window.SPRITES || {};                 // assets/sprites.js: 프레임 수·속도·그리기 배율
  // 보이는 몸통의 중심이 충돌 원의 중심에 오도록 한 y 보정
  const spriteDy = (m) => ((m.feetY - m.native[1] * m.k / 2) - m.ch / 2) * m.draw;
  let groundPat2 = null;
  function groundPattern() { if (!groundPat2 && ready('ground')) groundPat2 = ctx.createPattern(IMG.ground, 'repeat'); return groundPat2; }
  function spr(name, frame, x, y, sc, dir) {
    const m = SPR[name], w = m.cw * sc, h = m.ch * sc;
    ctx.save(); ctx.translate(x, y); if (dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(IMG[name], frame * m.cw, 0, m.cw, m.ch, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  // items.png 칸: 0~2 보석(파랑·초록·빨강), 3 회복, 4 마법탄, 5 단검, 6 도끼, 7 십자가, 8 성서, 9 적 탄
  function item(idx, x, y, sc, rot) {
    const s = 72 * sc;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.drawImage(IMG.items, idx * 72, 0, 72, 72, -s / 2, -s / 2, s, s);
    ctx.restore();
  }

  function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r, r * 0.4, 0, 0, TAU); ctx.fill(); }
  function drawEnemy(e, cx, cy) {
    const m = SPR[e.tn];
    if (!m || !ready(e.tn)) { drawEnemyVector(e, cx, cy); return; }
    const x = e.x - cx, y = e.y - cy, r = e.t.r;
    shadow(x, y, r);
    if (e.tn === 'boss') { ctx.fillStyle = 'rgba(255,60,120,.2)'; ctx.beginPath(); ctx.arc(x, y, r + 10 + Math.sin(run.t * 3) * 3, 0, TAU); ctx.fill(); }
    if (e.flash > 0) ctx.filter = 'brightness(3)';
    spr(e.tn, Math.floor(run.t * m.fps + e.ph) % m.n, x, y - spriteDy(m), m.draw, e.dir * m.face);
    ctx.filter = 'none';
  }
  function drawEnemyVector(e, cx, cy) {
    const x = e.x - cx, y = e.y - cy, r = e.t.r, t = run.t, f = e.flash > 0;
    shadow(x, y, r);
    const col = f ? '#fff' : e.t.col;
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir, 1);
    ctx.fillStyle = col;
    switch (e.tn) {
      case 'bat': {
        const w = Math.sin(t * 18 + e.ph) * 6;
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 7, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-14, -6 + w); ctx.lineTo(-9, 3); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(14, -6 + w); ctx.lineTo(9, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff4d4d'; ctx.fillRect(1, -3, 2, 2); ctx.fillRect(-3, -3, 2, 2); break;
      }
      case 'zombie': {
        const b = Math.sin(t * 6 + e.ph) * 1.5;
        ctx.fillRect(-9, -9 + b, 18, 20); ctx.beginPath(); ctx.arc(0, -12 + b, 8, 0, TAU); ctx.fill();
        ctx.fillRect(7, -4 + b, 9, 4); ctx.fillStyle = f ? '#ccc' : '#2c4a2c'; ctx.fillRect(-5, 3 + b, 10, 3);
        ctx.fillStyle = '#111'; ctx.fillRect(1, -14 + b, 3, 3); ctx.fillRect(-4, -14 + b, 3, 3); break;
      }
      case 'skel': {
        const b = Math.sin(t * 10 + e.ph) * 1.5;
        ctx.beginPath(); ctx.arc(0, -9 + b, 7, 0, TAU); ctx.fill();
        ctx.fillRect(-5, -3 + b, 10, 11);
        ctx.fillStyle = '#222'; ctx.fillRect(-4, -11 + b, 3, 3); ctx.fillRect(1, -11 + b, 3, 3); ctx.fillRect(-3, 2 + b, 6, 1); ctx.fillRect(-3, 5 + b, 6, 1); break;
      }
      case 'wraith': {
        ctx.globalAlpha = f ? 1 : 0.8; const w = Math.sin(t * 5 + e.ph) * 2;
        ctx.beginPath(); ctx.arc(0, -3, 11, Math.PI, 0); ctx.lineTo(11, 12 + w); ctx.lineTo(4, 8); ctx.lineTo(-1, 13 - w); ctx.lineTo(-6, 8); ctx.lineTo(-11, 12 + w); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#06323d'; ctx.fillRect(-5, -5, 3, 4); ctx.fillRect(2, -5, 3, 4); break;
      }
      case 'brute': {
        const b = Math.sin(t * 5 + e.ph) * 2;
        ctx.fillRect(-16, -12 + b, 32, 30); ctx.beginPath(); ctx.arc(0, -17 + b, 11, 0, TAU); ctx.fill();
        ctx.fillStyle = f ? '#eee' : '#f2e6c0';
        ctx.beginPath(); ctx.moveTo(-9, -24 + b); ctx.lineTo(-14, -35 + b); ctx.lineTo(-4, -26 + b); ctx.fill();
        ctx.beginPath(); ctx.moveTo(9, -24 + b); ctx.lineTo(14, -35 + b); ctx.lineTo(4, -26 + b); ctx.fill();
        ctx.fillStyle = '#ffdd55'; ctx.fillRect(-6, -19 + b, 4, 3); ctx.fillRect(2, -19 + b, 4, 3); break;
      }
      case 'boss': {
        const b = Math.sin(t * 3) * 3;
        ctx.fillStyle = f ? '#fff' : 'rgba(255,60,120,.25)'; ctx.beginPath(); ctx.arc(0, 0, r + 10 + b, 0, TAU); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-r, r); ctx.lineTo(-r * 0.8, -r * 0.4 + b); ctx.quadraticCurveTo(0, -r * 1.3 + b, r * 0.8, -r * 0.4 + b); ctx.lineTo(r, r); ctx.closePath(); ctx.fill();
        ctx.fillStyle = f ? '#eee' : '#2a0a16'; ctx.beginPath(); ctx.arc(0, -8 + b, 17, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd24d'; ctx.fillRect(-10, -11 + b, 6, 5); ctx.fillRect(4, -11 + b, 6, 5);
        ctx.beginPath(); ctx.moveTo(-14, -22 + b); ctx.lineTo(-10, -36 + b); ctx.lineTo(-3, -24 + b); ctx.lineTo(0, -38 + b); ctx.lineTo(3, -24 + b); ctx.lineTo(10, -36 + b); ctx.lineTo(14, -22 + b); ctx.closePath(); ctx.fill(); break;
      }
    }
    ctx.restore();
  }
  function drawPlayer(cx, cy) {
    const x = p.x - cx, y = p.y - cy;
    if (p.inv > 0 && Math.floor(run.t * 20) % 2 === 0) return;
    shadow(x, y, 11);
    if (SPR.player && ready('player')) {
      const m = SPR.player;
      spr('player', p.moving ? Math.floor(run.t * m.fps) % m.n : 0, x, y - spriteDy(m), m.draw, (p.fx >= 0 ? 1 : -1) * m.face);
      ctx.fillStyle = '#000a'; ctx.fillRect(x - 15, y + 17, 30, 5);
      ctx.fillStyle = '#e24a4a'; ctx.fillRect(x - 14, y + 18, 28 * clamp(p.hp / p.maxHp, 0, 1), 3);
      return;
    }
    const moving = keys.size > 0 || bot.on, bob = moving ? Math.sin(run.t * 14) * 1.5 : 0;
    ctx.save(); ctx.translate(x, y + bob);
    ctx.fillStyle = '#4b3aa8'; ctx.beginPath(); ctx.moveTo(-10, 12); ctx.lineTo(-7, -6); ctx.quadraticCurveTo(0, -12, 7, -6); ctx.lineTo(10, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8c9a6'; ctx.beginPath(); ctx.arc(0, -10, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1f66'; ctx.beginPath(); ctx.arc(0, -13, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(p.fx >= 0 ? 1 : -4, -11, 3, 3);
    ctx.strokeStyle = '#a27c3f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.fx >= 0 ? 8 : -8, 8); ctx.lineTo(p.fx >= 0 ? 12 : -12, -8); ctx.stroke();
    ctx.fillStyle = '#7fd0ff'; ctx.beginPath(); ctx.arc(p.fx >= 0 ? 12 : -12, -9, 3, 0, TAU); ctx.fill();
    ctx.restore();
    // 체력 바
    ctx.fillStyle = '#000a'; ctx.fillRect(x - 15, y + 17, 30, 5);
    ctx.fillStyle = '#e24a4a'; ctx.fillRect(x - 14, y + 18, 28 * clamp(p.hp / p.maxHp, 0, 1), 3);
  }
  /* 맵 장식: 160px 칸마다 위치·종류를 해시로 정해 항상 같은 모습이다. 바이옴(숲·평지·묘지)은 저주파 노이즈로 나눈다. */
  const DC = 160;
  function h2(x, y, sd) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(sd | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, sd) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h2(xi, yi, sd), b = h2(xi + 1, yi, sd), c = h2(xi, yi + 1, sd), d = h2(xi + 1, yi + 1, sd);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const biomeAt = (x, y) => { const n = vnoise(x / 900, y / 900, 11); return n < 0.38 ? 'forest' : n > 0.62 ? 'grave' : 'plain'; };
  // decor.png 칸: 0·1 흙 / 2 꽃 / 3 풀 / 4 괴석 / 5 대나무 / 6 소나무 / 7 벚나무 / 8 마른 나무 / 9 비석 / 10 봉분 / 11 석등 / 12 장승 / 13 해골 / 14 디딤돌 / 15 홍살문 / 16 연못
  // 반환 [칸, 배율, 종류(0 바닥 데칼, 1 세워 두는 물체)]
  function decorPick(bm, r, q) {
    if (r > 0.93) return q < 0.5 ? [0, 1.8, 0] : [1, 1.6, 0];
    if (r < 0.015 && bm !== 'grave') return [15, 1.4, 1];                   // 홍살문
    if (r > 0.62 && r < 0.68 && bm === 'forest') return [16, 1.7, 0];       // 연못
    if (r > 0.46 && r < 0.53 && bm === 'plain') return [16, 1.7, 0];
    if (bm === 'forest') {
      if (r < 0.5) return q < 0.42 ? [6, 1.25, 1] : q < 0.72 ? [7, 1.25, 1] : q < 0.88 ? [5, 1, 1] : [12, 0.9, 1];
      if (r < 0.62) return q < 0.5 ? [2, 1.3, 0] : [3, 1, 0];
    } else if (bm === 'grave') {
      if (r < 0.4) return q < 0.34 ? [9, 1, 1] : q < 0.58 ? [10, 1, 1] : q < 0.76 ? [8, 1.2, 1] : q < 0.88 ? [11, 1, 1] : [4, 0.9, 1];
      if (r < 0.58) return q < 0.5 ? [13, 1, 0] : [14, 1.2, 0];
    } else {
      if (r < 0.2) return q < 0.3 ? [7, 1.25, 1] : q < 0.5 ? [5, 1, 1] : q < 0.75 ? [4, 0.9, 1] : [6, 1.25, 1];
      if (r < 0.46) return q < 0.5 ? [2, 1.3, 0] : [3, 1, 0];
    }
    return null;
  }
  const decorObjs = [];
  function decorDraw(idx, x, y, sc, upright) {
    const sz = 72 * sc, cyy = upright ? y - 32 * sc : y;
    if (upright) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y, 11 * sc, 4 * sc, 0, 0, TAU); ctx.fill(); }
    ctx.drawImage(IMG.decor, idx * 72, 0, 72, 72, x - sz / 2, cyy - sz / 2, sz, sz);
  }
  function drawMapDecor(camX, camY) {
    if (!ready('decor')) return;
    decorObjs.length = 0;
    const c0 = Math.floor((camX - 110) / DC), c1 = Math.floor((camX + W + 110) / DC);
    const r0 = Math.floor((camY - 130) / DC), r1 = Math.floor((camY + H + 90) / DC);
    for (let gy = r0; gy <= r1; gy++) for (let gx = c0; gx <= c1; gx++) for (let k = 0; k < 3; k++) {
      const wx = (gx + h2(gx, gy, k * 11 + 2)) * DC, wy = (gy + h2(gx, gy, k * 11 + 3)) * DC;
      if (wx * wx + wy * wy < 12100) continue;                      // 시작 지점 주변은 비워 둔다
      const d = decorPick(biomeAt(wx, wy), h2(gx, gy, k * 11 + 1), h2(gx, gy, k * 11 + 4));
      if (!d) continue;
      if (d[2] === 0) decorDraw(d[0], wx - camX, wy - camY, d[1], false);
      else decorObjs.push({ x: wx, y: wy, i: d[0], s: d[1] });
    }
    decorObjs.sort((a, b) => a.y - b.y);
    for (const o of decorObjs) {
      decorDraw(o.i, o.x - camX, o.y - camY, o.s, true);
      if (o.i === 11) {                                              // 횃불 불빛
        const fl = reduced() ? 1 : 1 + 0.08 * Math.sin(run.t * 9 + o.x), gx0 = o.x - camX, gy0 = o.y - camY - 30 * o.s;
        const g = ctx.createRadialGradient(gx0, gy0, 4, gx0, gy0, 70 * fl);
        g.addColorStop(0, 'rgba(255,170,70,.30)'); g.addColorStop(1, 'rgba(255,170,70,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(gx0 - 75, gy0 - 75, 150, 150); ctx.restore();
      }
    }
  }

  /* 스킬 연출: 궤적·오라·잔상은 '움직임 줄이기'를 켜면 꺼지는 장식이다 */
  function drawWeaponsWorld(cx, cy) {
    const fxOn = !reduced();
    for (const w of p.weapons) {
      const x = p.x - cx, y = p.y - cy, S = WSTAT[w.id](w.lvl);
      if (w.id === 'garlic') {
        const rad = S.rad;
        const gr = ctx.createRadialGradient(x, y, rad * 0.3, x, y, rad);
        gr.addColorStop(0, 'rgba(233,245,200,0.03)'); gr.addColorStop(1, 'rgba(233,245,200,0.24)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        ctx.save(); ctx.strokeStyle = 'rgba(233,245,200,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = fxOn ? -run.t * 20 : 0; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.stroke(); ctx.restore();
        if (fxOn && w.pulse > 0) {                                     // 피해를 줄 때마다 퍼지는 파동
          const k = 1 - w.pulse / 0.3;
          ctx.strokeStyle = 'rgba(255,255,230,' + (0.6 * (1 - k)).toFixed(2) + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y, rad * (0.6 + 0.4 * k), 0, TAU); ctx.stroke();
        }
      } else if (w.id === 'bible') {
        ctx.strokeStyle = 'rgba(143,123,255,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, S.rad, 0, TAU); ctx.stroke();
        for (let i = 0; i < S.n; i++) {
          const a = w.ang + (i / S.n) * TAU;
          if (ready('items')) {
            if (fxOn) for (let j = 4; j >= 1; j--) {                    // 잔상
              const aj = a - j * 0.13;
              ctx.globalAlpha = 0.13 * (5 - j); item(8, x + Math.cos(aj) * S.rad, y + Math.sin(aj) * S.rad, 0.5, aj + Math.PI / 2);
            }
            ctx.globalAlpha = 1;
            ctx.shadowColor = '#8f7bff'; ctx.shadowBlur = 10; item(8, x + Math.cos(a) * S.rad, y + Math.sin(a) * S.rad, 0.5, a + Math.PI / 2); ctx.shadowBlur = 0;
          } else {
            ctx.save(); ctx.translate(x + Math.cos(a) * S.rad, y + Math.sin(a) * S.rad); ctx.rotate(a + Math.PI / 2);
            ctx.fillStyle = '#5a45c9'; ctx.fillRect(-8, -10, 16, 20); ctx.fillStyle = '#e8e0ff'; ctx.fillRect(-6, -8, 12, 16); ctx.restore();
          }
        }
      }
    }
  }
  function drawTrail(s, cx, cy) {
    const n = s.tn, last = (s.th + 7) & 7, first = (s.th - n + 8) & 7;
    if (s.kind === 'knife') {                                          // 칼날 궤적: 한 줄 잔광
      ctx.strokeStyle = 'rgba(223,230,255,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.tx[first] - cx, s.ty[first] - cy); ctx.lineTo(s.tx[last] - cx, s.ty[last] - cy); ctx.stroke();
      return;
    }
    for (let k = 0; k < n; k++) {
      const idx = (s.th - n + k + 8) & 7, t = (k + 1) / n;
      ctx.globalAlpha = 0.38 * t; ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.arc(s.tx[idx] - cx, s.ty[idx] - cy, (s.kind === 'wand' ? 6 : 5) * t, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawShot(s, cx, cy) {
    const x = s.x - cx, y = s.y - cy;
    if (s.tn > 1 && !reduced()) drawTrail(s, cx, cy);
    if (ready('items')) {
      if (s.kind === 'wand') { ctx.shadowColor = '#ffd86b'; ctx.shadowBlur = 8; item(4, x, y, 0.5, Math.atan2(s.vy, s.vx) + Math.PI / 2); ctx.shadowBlur = 0; return; }
      if (s.kind === 'knife') { item(5, x, y, 0.55, Math.atan2(s.vy, s.vx)); return; }
      if (s.kind === 'axe') { item(6, x, y, 0.6, s.rot); return; }
      if (s.kind === 'cross') { ctx.shadowColor = s.ret ? '#fff2b0' : '#ffe36b'; ctx.shadowBlur = s.ret ? 12 : 8; item(7, x, y, 0.55, s.rot); ctx.shadowBlur = 0; return; }
    }
    ctx.save(); ctx.translate(x, y);
    if (s.kind === 'wand') {
      ctx.shadowColor = '#7fd0ff'; ctx.shadowBlur = 10; ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    } else if (s.kind === 'knife') {
      ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.fillStyle = '#dfe6ff'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -3.5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 3.5); ctx.closePath(); ctx.fill();
    } else if (s.kind === 'axe') {
      ctx.rotate(s.rot); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-2, -13, 4, 26); ctx.fillStyle = '#ccd3e0';
      ctx.beginPath(); ctx.moveTo(2, -12); ctx.lineTo(14, -9); ctx.lineTo(14, 3); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill();
    } else if (s.kind === 'cross') {
      ctx.rotate(s.rot); ctx.shadowColor = '#ffe36b'; ctx.shadowBlur = 8; ctx.fillStyle = '#ffd24d'; ctx.fillRect(-3, -12, 6, 24); ctx.fillRect(-12, -3, 24, 6);
    }
    ctx.restore();
  }
  function drawGem(g, cx, cy) {
    const x = g.x - cx, y = g.y - cy;
    if (ready('items')) { item(g.kind === 1 ? 3 : g.v >= 10 ? 2 : g.v >= 3 ? 1 : 0, x, y, g.kind === 1 ? 0.45 : 0.4, 0); return; }
    if (g.kind === 1) { ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.arc(x - 3, y - 2, 4, 0, TAU); ctx.arc(x + 3, y - 2, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x, y + 8); ctx.lineTo(x + 7, y); ctx.fill(); return; }
    const c = g.v >= 10 ? '#ff6b6b' : g.v >= 3 ? '#62e08a' : '#5fb4ff', s = g.v >= 10 ? 7 : 5;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.closePath(); ctx.fill();
  }
  function bar(x, y, w, h, f, c, bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = c; ctx.fillRect(x, y, w * clamp(f, 0, 1), h); }
  function drawHUD() {
    bar(0, 0, W, 14, p.xp / xpNeed(p.level), '#4aa3ff', '#10162b');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px ' + FONT; ctx.textAlign = 'right'; ctx.fillText('LV ' + p.level, W - 8, 11);
    ctx.textAlign = 'center'; ctx.font = 'bold 26px ' + FONT; ctx.lineWidth = 4; ctx.strokeStyle = '#000b'; ctx.strokeText(mmss(run.t), W / 2, 44); ctx.fillStyle = '#fff'; ctx.fillText(mmss(run.t), W / 2, 44);
    ctx.font = '12px ' + FONT; ctx.fillStyle = '#c9d2f0';
    ctx.fillText(run.bossSpawned ? (run.boss ? '보스를 처치하세요!' : '') : '보스 출현 ' + mmss(BOSS_TIME), W / 2, 62);
    ctx.textAlign = 'right'; ctx.font = 'bold 14px ' + FONT; ctx.fillStyle = '#fff'; ctx.fillText('처치 ' + run.kills, W - 10, 34);
    ctx.textAlign = 'left'; ctx.fillText('HP ' + Math.ceil(p.hp) + ' / ' + p.maxHp, 10, H - 12);
    let ix = 8;
    for (const w of p.weapons) {
      const d = WDEF[w.id];
      ctx.fillStyle = '#10162bdd'; ctx.fillRect(ix, 20, 34, 34); ctx.strokeStyle = d.col; ctx.lineWidth = 1.5; ctx.strokeRect(ix + 0.5, 20.5, 33, 33);
      if (ready('items')) item(d.ic, ix + 17, 34, 0.42, 0);
      else { ctx.fillStyle = d.col; ctx.font = 'bold 13px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(d.n[0], ix + 17, 40); }
      if (w.cdMax && w.t > 0) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(ix + 1, 21, 32, 32 * clamp(w.t / w.cdMax, 0, 1)); }   // 쿨다운
      for (let k = 0; k < 5; k++) { ctx.fillStyle = k < w.lvl ? d.col : '#2a3150'; ctx.fillRect(ix + 3 + k * 6, 49, 5, 3); }            // 레벨 칸
      ix += 38;
    }
    let px = 8;
    for (const id in PDEF) if (p.pas[id] > 0) {
      ctx.fillStyle = '#10162bdd'; ctx.fillRect(px, 58, 26, 26); ctx.strokeStyle = '#4d9f6a'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, 58.5, 25, 25);
      if (ready('items')) item(PDEF[id].ic, px + 13, 70, 0.34, 0);
      else { ctx.fillStyle = '#9fe3b0'; ctx.font = '10px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(PDEF[id].n.slice(0, 2), px + 13, 74); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px ' + FONT; ctx.textAlign = 'right'; ctx.fillText(p.pas[id], px + 24, 82);
      px += 30;
    }
    if (run.boss && run.boss.on) {
      bar(W / 2 - 160, H - 30, 320, 12, run.boss.hp / run.boss.maxHp, '#d63a6a', '#2a0f1b');
      ctx.textAlign = 'center'; ctx.font = 'bold 11px ' + FONT; ctx.fillStyle = '#fff'; ctx.fillText('보스', W / 2, H - 33);
    }
    if (run.bannerT > 0) { ctx.textAlign = 'center'; ctx.font = 'bold 44px ' + FONT; ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(run.banner, W / 2, 150); ctx.fillStyle = '#ff5d7e'; ctx.fillText(run.banner, W / 2, 150); }
    if (bot.on) { ctx.textAlign = 'left'; ctx.font = '11px ' + FONT; ctx.fillStyle = '#ffd86b'; ctx.fillText('자동 조작 중 (B)', 10, H - 30); }
  }
  function render() {
    const s = cv.width / W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0;
    const cx = p.x - W / 2 + run.ox, cy = p.y - H / 2 + run.oy;
    ctx.imageSmoothingEnabled = false;
    const gp = groundPattern(), tile = gp ? 72 : 256;
    ctx.save(); ctx.translate(-(((cx % tile) + tile) % tile), -(((cy % tile) + tile) % tile)); ctx.fillStyle = gp || groundPat; ctx.fillRect(0, 0, W + tile, H + tile); ctx.restore();
    drawMapDecor(cx, cy);
    for (const g of gems) if (g.on) drawGem(g, cx, cy);
    drawWeaponsWorld(cx, cy);
    const list = [];
    for (const e of enemies) if (e.on && Math.abs(e.x - cx - W / 2) < W / 2 + 60 && Math.abs(e.y - cy - H / 2) < H / 2 + 60) list.push(e);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) drawEnemy(e, cx, cy);
    drawPlayer(cx, cy);
    for (const sh of shots) if (sh.on) drawShot(sh, cx, cy);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff4d6a'; for (const b of ebul) if (b.on && ready('items')) item(9, b.x - cx, b.y - cy, 0.4, 0); else if (b.on) { ctx.beginPath(); ctx.arc(b.x - cx, b.y - cy, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd0d8'; ctx.beginPath(); ctx.arc(b.x - cx, b.y - cy, 2.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff4d6a'; }
    for (const o of parts) if (o.on) { ctx.globalAlpha = clamp(o.life / o.max, 0, 1); ctx.fillStyle = o.col; ctx.fillRect(o.x - cx, o.y - cy, o.s, o.s); }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 12px ' + FONT; ctx.textAlign = 'center';
    for (const o of texts) if (o.on) { ctx.globalAlpha = clamp(o.life / 0.4, 0, 1); ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = '#000a'; ctx.strokeText(o.v, o.x - cx, o.y - cy); ctx.fillText(o.v, o.x - cx, o.y - cy); }
    ctx.globalAlpha = 1;
    if (run.ring > 0) { ctx.strokeStyle = 'rgba(255,230,120,' + clamp(run.ring / 0.6, 0, 1) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x - cx, p.y - cy, (0.6 - run.ring) * 300, 0, TAU); ctx.stroke(); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (run.flash > 0) { ctx.fillStyle = 'rgba(255,40,40,' + clamp(run.flash, 0, 0.3) + ')'; ctx.fillRect(0, 0, W, H); }
    drawHUD();
  }

  /* ───────── 패널·기록 ───────── */
  const el = { st: $('stState'), df: $('stDiff'), tm: $('stTime'), hp: $('stHp'), lv: $('stLv'), kl: $('stKills'), rx: $('ioRx'), ok: $('ioOk'), bt: $('ioBot') };
  function updateIO() { el.rx.textContent = io.rx; el.ok.textContent = io.ok; el.bt.textContent = bot.on ? '켜짐' : '꺼짐'; }
  function updatePanel() {
    el.st.textContent = STATE_LABEL[state];
    el.df.textContent = DIFFS[store.settings.diff].v.toFixed(1) + ' (' + DIFFS[store.settings.diff].label + ')';
    el.tm.textContent = mmss(run.t);
    el.hp.textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
    el.lv.textContent = p.level;
    el.kl.textContent = run.kills;
    selDiff.disabled = state === 'playing' || state === 'paused' || state === 'levelup';
    updateIO();
  }
  function renderRecords() {
    const b = store.best;
    $('recBest').textContent = b ? '최고 기록: ' + b.score + '점 · ' + mmss(b.time) + ' · ' + DIFFS[b.diff].label : '최고 기록 없음';
    const list = $('recList'); list.innerHTML = '';
    store.runs.slice(-5).reverse().forEach((r) => {
      const li = document.createElement('li');
      li.value = r.n;
      li.textContent = DIFFS[r.diff].label + ' ' + (r.result === 'win' ? '성공' : '실패') + ' ' + mmss(r.time) + ' · ' + r.score + '점' + (r.result === 'lose' ? ' · ' + r.cause : '');
      list.appendChild(li);
    });
  }
  $('btnCsv').addEventListener('click', (e) => {
    const rows = [['번호', '일시', '난이도', '난이도값', '결과', '시간(초)', '처치', '레벨', '점수', '실패원인']];
    store.runs.forEach((r) => rows.push([r.n, r.at, DIFFS[r.diff].label, r.d, r.result === 'win' ? '성공' : '실패', r.time, r.kills, r.level, r.score, r.cause]));
    const csv = '﻿' + rows.map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'vsmini-records.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    e.currentTarget.blur();
  });
  $('btnClear').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (clearArm > 0) { store.best = null; store.runs = []; saveStore(); renderRecords(); clearArm = 0; btn.textContent = '기록 삭제'; }
    else { clearArm = 3; btn.textContent = '한 번 더 누르면 삭제'; }
    btn.blur();
  });

  /* ───────── 크기 맞춤 (1366×768, 1920×1080에서 잘림 없음) ───────── */
  function fit() {
    const aw = Math.max(200, stage.clientWidth - 16), ah = Math.max(120, stage.clientHeight - 16);
    const w = Math.floor(Math.min(aw, ah * 16 / 9)), h = Math.floor(w * 9 / 16);
    wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
    wrap.style.setProperty('--u', (w / W).toFixed(3));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  }
  window.addEventListener('resize', fit);

  /* ───────── 루프 (한 번만 시작) ───────── */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000) || 0); last = now;
    tick(dt);
  }
  function tick(dt) {
    if (bot.on) {
      bot.t += dt;
      if (state === 'title') startRun();
      else if (state === 'levelup' && bot.t > 0.4) { bot.t = 0; pick(0); }
      else if ((state === 'won' || state === 'lost') && bot.t > 2) { bot.t = 0; startRun(); }
    }
    if (clearArm > 0) { clearArm -= dt; if (clearArm <= 0) $('btnClear').textContent = '기록 삭제'; }
    if (state === 'playing') update(dt);
    render();
    panelT += dt;
    if (panelT > 0.2) { panelT = 0; updatePanel(); }
  }

  window.__vsMini = { get state() { return state; }, get run() { return run; }, p, io, enemies, store, tick, biomeAt };
  resetRun();
  fit();
  renderRecords();
  setState('title');
  requestAnimationFrame((t) => { last = t; frame(t); });
})();
