'use strict';
// One screen at a time, driven by the URL hash:
//   #/                      map: four isometric rooms
//   #/room/1                one room: its missions, checkpoint and project
//   #/mission/1.1/learn     lesson pages   (also /quiz and /build)
//   #/boss/1                boss project
//   #/gate/1                checkpoint quiz intro
//   #/quiz                  active quiz
//   #/review  #/progress  #/help

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// Escaped text with `code` and **bold** spans.
const md = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

const WORLD_TOPICS = ['Python foundations', 'Backend services', 'Retrieval & RAG', 'Agents & shipping'];
const WORLD_BLURBS = [
  'Variables, loops, JSON and your first secure call to an AI model.',
  'Build web APIs with FastAPI, validate input, and store data in SQLite.',
  'Split documents, compare embeddings, search a vector database and ground answers in evidence.',
  'Give AI tools, run a bounded agent loop, build a small UI and package it with Docker.',
];

let state, curriculum, verifyResults = {}, quizFeedback = null, timer = null;
const checkOrder = {};   // shuffled option order per lesson check, stable while the page is open

// ---------------------------------------------------------------- data

async function api(path, data) {
  const r = await fetch('/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {'Content-Type': 'application/json', 'X-Gauntlet': 'local'},
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail));
  return result;
}

async function refresh() {
  [state, curriculum] = await Promise.all([api('state'), api('curriculum')]);
  meters();
}

const item = id => curriculum.items.find(x => x.id === id);
const levels = w => curriculum.items.filter(x => x.world === w && !x.id.endsWith('boss'));
const worldOpen = w => w === 1 || state.bosses.includes(String(w - 1));
const quizPassed = id => state.quiz_passed.includes(id);
const built = id => state.completed.includes(id);

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
}
const lessonPage = id => store('lesson:' + id) || 0;

// The single most useful next action for a mission, or null when it is finished.
function missionNext(l) {
  if (!l.unlocked) return null;
  if (!l.lesson_done) {
    const p = lessonPage(l.id);
    return {step: 'learn', label: p ? `Continue lesson (page ${p + 1} of ${l.lesson_pages.length})` : 'Start the lesson'};
  }
  if (!quizPassed(l.id)) return {step: 'quiz', label: 'Take the 3-question quiz'};
  if (!built(l.id)) return {step: 'build', label: 'Build and test your code'};
  return null;
}

// The next thing to do in room w, or null once its project is beaten.
function roomNext(w) {
  for (const l of levels(w)) {
    const n = missionNext(l);
    if (n) return {title: l.title, eyebrow: `Mission ${l.id}`, label: n.label, href: `#/mission/${l.id}/${n.step}`};
  }
  if (state.bosses.includes(String(w))) return null;
  const boss = item(w + '.boss');
  if (!state.keys.includes(String(w))) return {title: 'Checkpoint quiz', eyebrow: `Room ${w}`, label: '10 questions · score 8 or more to unlock the project', href: `#/gate/${w}`};
  return {title: boss.title, eyebrow: `Room ${w} project`, label: 'Build the room project', href: `#/boss/${w}`};
}

function upNext() {
  return roomNext(state.current_world) || {title: 'Campaign complete', eyebrow: 'All four rooms', label: 'Keep skills fresh in Review', href: '#/review'};
}

// Six milestones per room: four missions, the checkpoint and the project.
function roomProgress(w) {
  const pads = levels(w).map(l => built(l.id));
  const done = pads.filter(Boolean).length + state.keys.includes(String(w)) + state.bosses.includes(String(w));
  return {pads, done, next: pads.findIndex(x => !x), cleared: state.bosses.includes(String(w))};
}

// ---------------------------------------------------------------- chrome

function meters() {
  $('#level').textContent = 'Lv ' + state.level;
  $('#xp').textContent = state.xp + ' XP';
  $('#hp').textContent = state.hp;
  $('.meter.hp').classList.toggle('low', state.hp <= 30);
}

function themeLabel() {
  const b = $('#theme-toggle');
  b.setAttribute('aria-label', `Switch to ${document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'} mode`);
}
$('#theme-toggle').onclick = () => { toggleTheme(); themeLabel(); };
themeLabel();

function setNav(name) {
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
}

function render(html, nav = 'learn') {
  clearInterval(timer);
  setNav(nav);
  const screen = $('#screen');
  screen.innerHTML = html;
  // Restart the entrance animation on every navigation, then drop it so rerenders don't replay it.
  if (screen.classList.contains('enter')) {
    screen.classList.remove('enter');
    screen.getBoundingClientRect();
    screen.classList.add('enter');
    clearTimeout(render.settle);
    render.settle = setTimeout(() => screen.classList.remove('enter'), 900);
  }
}

function toast(message, kind = '') {
  const t = $('#toast');
  t.textContent = message;
  t.className = 'show ' + kind;
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => t.className = '', 4000);
}

function hpBanner() {
  if (state.hp > 0) return '';
  return `<div class="banner bad"><div><strong>Out of health.</strong> Your progress is safe — restore your health to keep going.</div><button class="btn small" data-heal>Restore health</button></div>`;
}

function bindCommon() {
  $$('[data-heal]').forEach(b => b.onclick = heal);
  $$('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
}

async function heal() {
  try {
    state = await api('recover', {});
    meters();
    toast('Health restored to 100.', 'good');
    route();
  } catch (e) { toast(e.message, 'bad'); }
}

// ---------------------------------------------------------------- map

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function resumeBanner() {
  const s = state.session;
  return s && !s.finished
    ? `<div class="banner"><div>You have an unfinished quiz (question ${s.index + 1} of ${s.total}).</div><button class="btn small secondary" data-go="#/quiz">Resume</button></div>` : '';
}

function roomTile(w) {
  const open = worldOpen(w), p = roomProgress(w), place = Iso.place(w), label = Iso.labelAt(w);
  const status = !open ? 'locked' : p.cleared ? 'cleared' : w === state.current_world ? 'current' : 'open';
  const name = curriculum.worlds[w - 1];
  const note = !open ? `Beat Room ${w - 1}'s project to open` : p.cleared ? 'Cleared' : `${p.done} of 6 complete`;
  return `<div class="room ${status}" data-room="${w}" style="--room:${Iso.accent(w)};--z:${[3, 1, 3, 5][w - 1]}">
    <div class="room-art" data-enter="${w}" style="left:${place.left};top:${place.top};width:${place.width};height:${place.height}">${Iso.room(w, open ? p : undefined)}</div>
    <button class="room-label" data-enter="${w}" style="left:${label.left};top:${label.top}"
      aria-label="Room ${w}, ${esc(name)}: ${open ? note : 'locked. ' + note}">
      <span class="room-num">${open ? (p.cleared ? '✓' : w) : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="7" width="10" height="7.5" rx="2" fill="currentColor"/></svg>'}</span>
      <span class="room-text">
        <span class="room-eyebrow">Room ${w} · ${WORLD_TOPICS[w - 1]}</span>
        <b>${esc(name)}</b>
        <span class="room-meter"><i style="width:${p.done / 6 * 100}%"></i></span>
        <small>${note}</small>
      </span>
    </button>
  </div>`;
}

function home() {
  const next = upNext();
  const opened = [1, 2, 3, 4].filter(worldOpen).length, seen = store('roomsOpen');
  const unlocking = seen && opened > seen ? opened : 0;
  store('roomsOpen', opened);
  const last = Number(store('lastRoom'));
  const back = prevHash.startsWith('#/room/') && last && !calm();

  render(`<div class="map-page ${back ? 'zoom-out' : ''}">
    <header class="map-head">
      <span class="eyebrow">ECE → AI · The Gauntlet</span>
      <h1>Choose your room</h1>
      <p>Four rooms, one path. Each door opens when you beat the project in the room before it.</p>
    </header>
    <div class="wrap">${hpBanner()}${resumeBanner()}</div>
    <div class="map">
      <div class="stage">
        ${[1, 2, 3].map(w => Iso.bridge(w, worldOpen(w + 1))).join('')}
        ${[1, 2, 3, 4].map(roomTile).join('')}
      </div>
    </div>
    <aside class="next-dock" style="--room:${Iso.accent(state.current_world)}">
      <div class="next-text">
        <span class="eyebrow">Up next · ${esc(next.eyebrow)}</span>
        <b>${esc(next.title)}</b>
        <small>${esc(next.label)}</small>
      </div>
      <button class="btn" data-go="${next.href}">Continue <span aria-hidden="true">→</span></button>
    </aside>
    <div class="veil"></div>
  </div>`);

  $$('[data-enter]').forEach(el => el.onclick = () => enterRoom(Number(el.dataset.enter)));
  bindCommon();

  if (unlocking) {
    $(`.room[data-room="${unlocking}"]`).classList.add('unlocking');
    toast(`Room ${unlocking} is open: ${curriculum.worlds[unlocking - 1]}`, 'good');
  }
  // Coming back out of a room: start zoomed into it and pull back to the whole map.
  if (back) {
    const stage = $('.stage');
    zoomTo(stage, $(`.room[data-room="${last}"] .room-art`), false);
    $('.map-page').classList.add('returning');
    stage.getBoundingClientRect();
    requestAnimationFrame(() => stage.style.transform = '');
    // Labels and walkways fade back in once the camera has mostly pulled back.
    setTimeout(() => $('.map-page.returning')?.classList.remove('returning'), 550);
  }
}

// Scale the stage so `art` fills the viewport, keeping its centre under the screen centre.
function zoomTo(stage, art, animate = true) {
  const r = art.getBoundingClientRect(), s = stage.getBoundingClientRect();
  const k = Math.min(innerWidth / r.width, innerHeight / r.height) * 0.9;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  stage.style.transition = animate ? '' : 'none';
  stage.style.transformOrigin = `${cx - s.left}px ${cy - s.top}px`;
  stage.style.transform = `translate(${innerWidth / 2 - cx}px, ${innerHeight / 2 - cy}px) scale(${k})`;
  if (!animate) { stage.getBoundingClientRect(); stage.style.transition = ''; }
}

function enterRoom(w) {
  const tile = $(`.room[data-room="${w}"]`);
  if (!worldOpen(w)) {
    tile.classList.remove('nope');
    tile.getBoundingClientRect();
    tile.classList.add('nope');
    return toast(`Room ${w} is locked. Beat the Room ${w - 1} project to open it.`, 'bad');
  }
  store('lastRoom', w);
  if (calm()) { location.hash = `#/room/${w}`; return; }
  tile.classList.add('target');
  $('.map-page').classList.add('zooming');
  zoomTo($('.stage'), tile.querySelector('.room-art'));
  setTimeout(() => location.hash = `#/room/${w}`, 760);
}

// ---------------------------------------------------------------- room

function room(w) {
  if (!worldOpen(w) || !curriculum.worlds[w - 1]) {
    return render(`<div class="wrap narrow"><a class="back" href="#/">← Map</a><div class="card center"><h2>🔒 Room ${w} is locked</h2><p>Beat the project in Room ${w - 1} to open this door.</p></div></div>`);
  }
  const p = roomProgress(w), next = roomNext(w);
  render(`<div class="wrap room-page" style="--room:${Iso.accent(w)}">
    <a class="back" href="#/">← Map</a>
    ${hpBanner()}${resumeBanner()}
    <section class="room-hero">
      <div class="hero-art">${Iso.room(w, p)}</div>
      <div class="hero-text">
        <span class="eyebrow">Room ${w} of 4 · ${WORLD_TOPICS[w - 1]}</span>
        <h1>${esc(curriculum.worlds[w - 1])}</h1>
        <p>${esc(WORLD_BLURBS[w - 1])}</p>
        <div class="hero-progress"><div class="bar"><i style="width:${p.done / 6 * 100}%"></i></div><span>${p.done} of 6</span></div>
        ${next ? `<button class="btn big" data-go="${next.href}"><span class="btn-stack"><small>${esc(next.eyebrow)}</small>${esc(next.title)}</span><span aria-hidden="true">→</span></button>`
          : `<div class="banner good"><div><strong>Room cleared.</strong> ${w < 4 ? `Room ${w + 1} is open.` : 'You have beaten the Gauntlet.'}</div>${w < 4 ? `<button class="btn small" data-go="#/">Back to the map</button>` : ''}</div>`}
      </div>
    </section>
    <h2 class="track-title">Your path through this room</h2>
    <ol class="missions track">${levels(w).map(missionRow).join('')}${checkpointRow(w)}</ol>
    <p class="how">Each mission has three steps: <b>Learn</b> the idea with short pages and practice questions → pass a <b>Quiz</b> of 3 questions → <b>Build</b> real code that the tests check.</p>
  </div>`);
  bindCommon();
}

function stepDots(l) {
  const dot = (done, label) => `<span class="dot ${done ? 'done' : ''}">${done ? '✓' : '○'} ${label}</span>`;
  return `<span class="dots">${dot(l.lesson_done, 'Learn')}${dot(quizPassed(l.id), 'Quiz')}${dot(built(l.id), 'Build')}</span>`;
}

function missionRow(l) {
  const n = missionNext(l), done = built(l.id);
  const action = !l.unlocked ? '<span class="muted">🔒 Finish the previous mission</span>'
    : `<button class="btn small ${n ? '' : 'secondary'}" data-go="#/mission/${l.id}/${n ? n.step : 'learn'}">${n ? (n.step === 'learn' && !lessonPage(l.id) ? 'Start' : 'Continue') : 'Revisit'}</button>`;
  return `<li class="mission ${l.unlocked ? '' : 'locked'} ${done ? 'complete' : ''}">
    <span class="num">${done ? '✓' : esc(l.id.split('.')[1])}</span>
    <div class="mission-body">
      <h3>${esc(l.title)}</h3>
      <p>${esc(l.summary)}</p>
      ${l.unlocked ? stepDots(l) : ''}
    </div>
    <div class="mission-action">${action}</div>
  </li>`;
}

function checkpointRow(w) {
  const boss = item(w + '.boss'), allBuilt = levels(w).every(l => built(l.id));
  const key = state.keys.includes(String(w)), beaten = state.bosses.includes(String(w));
  const gateBtn = allBuilt ? `<button class="btn small ${key ? 'secondary' : ''}" data-go="#/gate/${w}">${key ? 'Retake' : 'Start'}</button>` : '<span class="muted">🔒 Finish all four missions</span>';
  const bossBtn = boss.unlocked ? `<button class="btn small ${beaten ? 'secondary' : ''}" data-go="#/boss/${w}">${beaten ? 'Revisit' : 'Open'}</button>` : '<span class="muted">🔒 Pass the checkpoint quiz</span>';
  return `<li class="mission checkpoint ${allBuilt ? '' : 'locked'}">
      <span class="num">${key ? '✓' : '★'}</span>
      <div class="mission-body"><h3>Checkpoint quiz</h3><p>10 questions across the room. Score 8 or more to unlock the room project.</p></div>
      <div class="mission-action">${gateBtn}</div>
    </li>
    <li class="mission checkpoint ${boss.unlocked ? '' : 'locked'} ${beaten ? 'complete' : ''}">
      <span class="num">${beaten ? '✓' : '◆'}</span>
      <div class="mission-body"><h3>Room project: ${esc(boss.title)}</h3><p>A bigger build that combines the four missions. Finishing it opens the next room.</p></div>
      <div class="mission-action">${bossBtn}</div>
    </li>`;
}

// ---------------------------------------------------------------- mission shell

function stepper(l, current) {
  const steps = [
    ['learn', 'Learn', l.lesson_done, true],
    ['quiz', 'Quiz', quizPassed(l.id), l.lesson_done],
    ['build', 'Build', built(l.id), quizPassed(l.id)],
  ];
  return `<nav class="stepper" aria-label="Mission steps">${steps.map(([key, label, done, open], i) =>
    `<button class="step ${key === current ? 'current' : ''} ${done ? 'done' : ''}" ${open ? `data-go="#/mission/${l.id}/${key}"` : 'disabled'} ${key === current ? 'aria-current="step"' : ''}>
      <span class="step-num">${done ? '✓' : i + 1}</span>${label}</button>`).join('<span class="step-line"></span>')}</nav>`;
}

function missionHeader(l, step) {
  return `<a class="back" href="#/room/${l.world}">← Room ${l.world}</a>
    <header class="mission-head"><span class="eyebrow">Mission ${esc(l.id)}</span><h1>${esc(l.title)}</h1></header>
    ${stepper(l, step)}`;
}

function mission(id, step) {
  const l = item(id);
  if (!l || id.endsWith('boss')) return notFound();
  if (!l.unlocked) return render(`<div class="wrap narrow"><a class="back" href="#/room/${l.world}">← Room ${l.world}</a><div class="card center"><h2>🔒 Not unlocked yet</h2><p>Finish the previous mission first.</p></div></div>`);
  // Send people to the earliest step they can actually use.
  if (step === 'quiz' && !l.lesson_done) step = 'learn';
  if (step === 'build' && !quizPassed(id)) step = l.lesson_done ? 'quiz' : 'learn';
  if (step === 'learn') return learn(l);
  if (step === 'quiz') return quizStep(l);
  return build(l);
}

// ---------------------------------------------------------------- learn

function learn(l) {
  const pages = l.lesson_pages, total = pages.length;
  let i = Math.min(lessonPage(l.id), total);
  if (i === total) return lessonDone(l);
  const p = pages[i];
  const key = l.id + ':' + i;
  const answered = store('checked:' + key);
  const canGoOn = p.type !== 'check' || answered || l.lesson_done;

  render(`<div class="wrap narrow">
    ${missionHeader(l, 'learn')}
    ${hpBanner()}
    <div class="page-progress"><span>Page ${i + 1} of ${total}</span><div class="bar"><i style="width:${(i + 1) / total * 100}%"></i></div></div>
    <article class="card lesson">${p.type === 'check' ? checkHTML(p, key, answered) : pageHTML(p)}</article>
    <div class="pager">
      <button class="btn ghost" id="prev" ${i === 0 ? 'disabled' : ''}>← Back</button>
      <button class="btn" id="next" ${canGoOn ? '' : 'disabled'}>${i === total - 1 ? 'Finish lesson ✓' : 'Next →'}</button>
    </div>
    <p class="hint-line">${p.type === 'check' && !canGoOn ? 'Answer the practice question to continue. It doesn\'t cost health.' : 'Tip: use ← and → keys to move between pages.'}</p>
  </div>`);

  const go = n => {
    store('lesson:' + l.id, n);
    learn(l);
    const card = $('.lesson');
    if (card) card.classList.add(n > i ? 'from-right' : 'from-left');
    window.scrollTo({top: 0, behavior: calm() ? 'auto' : 'smooth'});
  };
  $('#prev').onclick = () => i > 0 && go(i - 1);
  $('#next').onclick = async () => {
    if ($('#next').disabled) return;
    if (i < total - 1) return go(i + 1);
    try {
      await api('lesson/complete', {id: l.id});
      await refresh();
      go(total);
    } catch (e) { toast(e.message, 'bad'); }
  };
  if (p.type === 'check') bindCheck(l, p, key);
  keyNav = e => {
    if (e.key === 'ArrowRight' && !$('#next').disabled) $('#next').click();
    if (e.key === 'ArrowLeft' && i > 0) $('#prev').click();
  };
  bindCommon();
}

function pageHTML(p) {
  return `<h2>${esc(p.title)}</h2>
    ${p.body.map(t => `<p>${md(t)}</p>`).join('')}
    ${p.code ? `<pre class="code"><code>${esc(p.code)}</code></pre>` : ''}
    ${p.output ? `<div class="output"><span>Output</span><pre><code>${esc(p.output)}</code></pre></div>` : ''}
    ${p.note ? `<div class="note">${md(p.note)}</div>` : ''}`;
}

function shuffled(key, n) {
  if (!checkOrder[key]) {
    const order = [...Array(n).keys()];
    for (let j = n - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [order[j], order[k]] = [order[k], order[j]]; }
    checkOrder[key] = order;
  }
  return checkOrder[key];
}

function checkHTML(p, key, answered) {
  const order = shuffled(key, p.options.length);
  return `<span class="eyebrow">Practice question · no health cost</span>
    <h2>${md(p.prompt)}</h2>
    ${p.code ? `<pre class="code"><code>${esc(p.code)}</code></pre>` : ''}
    <div class="options">${order.map((o, n) => `<button class="option ${answered && o === p.answer ? 'right' : ''}" data-opt="${o}" ${answered ? 'disabled' : ''}>
      <b>${'ABCD'[n]}</b><span>${md(p.options[o])}</span></button>`).join('')}</div>
    <div id="check-feedback">${answered ? `<div class="feedback good"><strong>Correct.</strong> ${md(p.explain)}</div>` : ''}</div>`;
}

function bindCheck(l, p, key) {
  $$('[data-opt]').forEach(b => b.onclick = () => {
    const right = Number(b.dataset.opt) === p.answer;
    if (right) {
      store('checked:' + key, true);
      $$('[data-opt]').forEach(x => x.disabled = true);
      b.classList.add('right');
      $('#check-feedback').innerHTML = `<div class="feedback good"><strong>Correct.</strong> ${md(p.explain)}</div>`;
      $('#next').disabled = false;
      $('.hint-line').textContent = 'Nice. Continue when you\'re ready.';
    } else {
      b.classList.add('wrong');
      b.disabled = true;
      $('#check-feedback').innerHTML = `<div class="feedback bad"><strong>Not quite — try another answer.</strong></div>`;
    }
  });
}

function lessonDone(l) {
  render(`<div class="wrap narrow">
    ${missionHeader(l, 'learn')}
    <div class="card center done-card">
      <div class="big-check">✓</div>
      <h2>Lesson complete</h2>
      <p>Next is a short quiz: 3 questions on this lesson. Get all 3 right to unlock the Build step.</p>
      <div class="actions center">
        <button class="btn" data-go="#/mission/${l.id}/quiz">Go to the quiz →</button>
        <button class="btn ghost" id="reread">Read the lesson again</button>
      </div>
    </div>
  </div>`);
  $('#reread').onclick = () => { store('lesson:' + l.id, 0); learn(l); };
  bindCommon();
}

// ---------------------------------------------------------------- quiz step

function quizStep(l) {
  const passed = quizPassed(l.id);
  const best = state.quiz_scores['level:' + l.id];
  const s = state.session;
  const resume = s && !s.finished && s.kind === 'level' && s.target === l.id
    ? `<div class="banner"><div>You're partway through this quiz (question ${s.index + 1} of ${s.total}).</div><button class="btn small secondary" data-go="#/quiz">Resume</button></div>` : '';
  render(`<div class="wrap narrow">
    ${missionHeader(l, 'quiz')}
    ${hpBanner()}${resume}
    <div class="card">
      ${passed ? `<h2>✓ Quiz passed</h2><p>The Build step is open. You can retake the quiz any time for practice — it won't change your rewards.</p>`
        : `<h2>Quick quiz</h2>
           <p>3 questions about this lesson: one asks you to predict output, one to spot a bug, and one checks the concept.</p>
           <ul class="rules"><li>Get all <b>3 right</b> in one go to unlock Build.</li><li>Each wrong answer costs <b>10 health</b> and shows an explanation.</li><li>You can retry as many times as you like.</li></ul>
           ${best !== undefined ? `<p class="muted">Your best so far: ${best} / 3</p>` : ''}`}
      <div class="actions">
        ${passed ? `<button class="btn" data-go="#/mission/${l.id}/build">Go to Build →</button><button class="btn ghost" id="start">Retake quiz</button>`
          : `<button class="btn" id="start" ${state.hp > 0 ? '' : 'disabled'}>Start quiz</button><button class="btn ghost" data-go="#/mission/${l.id}/learn">Review the lesson</button>`}
      </div>
    </div>
  </div>`);
  $('#start').onclick = () => startQuiz('level', l.id, false);
  bindCommon();
}

async function startQuiz(kind, target, timed) {
  try {
    await api('quiz/start', {kind, target, timed});
    await refresh();
    quizFeedback = null;
    if (location.hash === '#/quiz') route();
    else location.hash = '#/quiz';
  } catch (e) { toast(e.message, 'bad'); }
}

function quizTitle(t) {
  if (t.kind === 'daily') return {name: 'Daily review', back: '#/review', backLabel: 'Review'};
  if (t.kind === 'gate') return {name: `Room ${t.target} checkpoint`, back: `#/room/${t.target}`, backLabel: 'Room'};
  return {name: `Quiz · ${item(t.target).title}`, back: `#/mission/${t.target}/quiz`, backLabel: 'Mission'};
}

function quiz() {
  const t = state.session;
  if (!t) return home();
  if (t.finished && !quizFeedback) return quizResult(t);
  const info = quizTitle(t);
  const q = quizFeedback ? quizFeedback.question : t.question;
  const idx = quizFeedback ? quizFeedback.index : t.index;
  const f = quizFeedback;

  render(`<div class="wrap narrow">
    <a class="back" href="${info.back}">← Leave quiz (progress is saved)</a>
    <div class="quiz-top"><span class="eyebrow">${esc(info.name)}</span><span id="timer" class="timer"></span></div>
    <div class="page-progress"><span>Question ${idx + 1} of ${t.total}</span><div class="bar"><i style="width:${(idx + (f ? 1 : 0)) / t.total * 100}%"></i></div></div>
    <article class="card">
      <span class="eyebrow">${esc(q.kind)}</span>
      <h2>${esc(q.prompt)}</h2>
      ${q.code ? `<pre class="code numbered"><code>${q.code.split('\n').map(line => `<span>${esc(line)}</span>`).join('\n')}</code></pre>` : ''}
      <div class="options">${q.options.map((o, i) => `<button class="option" data-choice="${i}" ${f ? 'disabled' : ''}><b>${'ABCD'[i]}</b><span>${esc(o)}</span></button>`).join('')}</div>
      ${f ? `<div class="feedback ${f.correct ? 'good' : 'bad'}"><strong>${f.correct ? 'Correct.' : 'Not quite. −10 health.'}</strong> ${esc(f.explanation)}
        ${f.correct ? '' : `<div class="answer">Correct answer: <b>${esc(f.correct_answer)}</b></div>`}</div>` : ''}
    </article>
    <div class="pager"><span class="muted">${t.correct} correct so far · ♥ ${state.hp}</span>
      ${f ? `<button class="btn" id="next">${t.finished ? 'See results' : 'Next question →'}</button>` : ''}</div>
  </div>`);

  if (f) {
    // Highlight the choice that was made.
    const picked = $(`[data-choice="${f.choice}"]`);
    if (picked) picked.classList.add(f.correct ? 'right' : 'wrong');
    $('#next').onclick = () => { quizFeedback = null; quiz(); };
    keyNav = e => { if (e.key === 'Enter' || e.key === 'ArrowRight') $('#next').click(); };
  }
  $$('[data-choice]').forEach(b => b.onclick = async () => {
    $$('[data-choice]').forEach(x => x.disabled = true);
    try {
      const question = t.question, index = t.index, choice = Number(b.dataset.choice);
      const r = await api('quiz/answer', {session_id: t.id, index: t.index, choice});
      state = r.state;
      meters();
      quizFeedback = {...r, question, index, choice};
      quiz();
    } catch (e) {
      toast(e.message, 'bad');
      await refresh();
      quiz();
    }
  });
  if (t.deadline && !t.finished) {
    const tick = () => {
      const n = Math.max(0, Math.ceil(t.deadline - Date.now() / 1000));
      if ($('#timer')) $('#timer').textContent = `⏱ ${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
      if (n === 0) { clearInterval(timer); toast('Time is up. Start a fresh attempt.', 'bad'); }
    };
    tick();
    timer = setInterval(tick, 1000);
  }
}

function quizResult(t) {
  const info = quizTitle(t), level = t.kind === 'level', daily = t.kind === 'daily';
  const need = level ? 3 : t.kind === 'gate' ? 8 : 0;
  let title, text, primary;
  if (daily) {
    title = 'Review done'; text = 'Bonus XP is awarded for your first review each day. Practice as much as you like after that.';
    primary = ['Back to Review', '#/review'];
  } else if (t.passed) {
    title = level ? 'Quiz passed — Build unlocked' : 'Checkpoint passed — project unlocked';
    text = level ? 'Your first successful build of this mission earns a 1.5× XP bonus.' : 'You\'ve earned the key for this room\'s project.';
    primary = level ? ['Go to Build →', `#/mission/${t.target}/build`] : ['Open the room project →', `#/boss/${t.target}`];
  } else {
    title = state.hp === 0 ? 'Out of health' : 'Not this time';
    text = `You needed ${need} correct. Read the explanations, review the material, and try again — nothing you've unlocked is lost.`;
    primary = level ? ['Review the lesson', `#/mission/${t.target}/learn`] : ['Back to the room', `#/room/${t.target}`];
  }
  render(`<div class="wrap narrow">
    <a class="back" href="${info.back}">← ${info.backLabel}</a>
    <div class="card center done-card">
      <span class="eyebrow">${esc(info.name)}</span>
      <div class="score ${t.passed || daily ? 'good' : 'bad'}">${t.correct}<small> / ${t.total}</small></div>
      <h2>${title}</h2>
      <p>${text}</p>
      <div class="actions center">
        <button class="btn" data-go="${primary[1]}">${primary[0]}</button>
        ${state.hp === 0 ? '<button class="btn secondary" data-heal>Restore health</button>' : `<button class="btn ghost" id="retry">Try again</button>`}
      </div>
    </div>
  </div>`, daily ? 'review' : 'learn');
  if ($('#retry')) $('#retry').onclick = () => startQuiz(t.kind, t.target, !!t.deadline);
  bindCommon();
}

// ---------------------------------------------------------------- build

function buildPanel(l, boss) {
  const id = l.id, done = built(id), path = state.workspace + '/' + l.path;
  const created = store('created:' + id);
  const hintsShown = store('hints:' + id) || 0;
  const result = verifyResults[id];
  return `
    ${done ? `<div class="banner good"><div><strong>✓ ${boss ? 'Project complete.' : 'Mission complete.'}</strong> You can keep improving your code and rerun the tests.</div>
      ${boss ? '' : nextMissionButton(l)}</div>` : ''}
    <section class="card">
      <span class="eyebrow">What to build</span>
      <p class="contract">${md(l.quest)}</p>
    </section>
    <ol class="build-steps">
      <li class="card ${created ? 'ok' : ''}">
        <h3><span class="step-num">1</span> Create your starter file${boss ? 's' : ''}</h3>
        <p>This copies a starter file into your workspace. If the file already exists, your work is kept.</p>
        <div class="path"><code>${esc(path)}</code><button class="btn small ghost" id="copy">Copy path</button></div>
        <div class="actions"><button class="btn ${created ? 'secondary' : ''}" id="init">${created ? 'Create again (keeps your work)' : 'Create file'}</button></div>
      </li>
      <li class="card">
        <h3><span class="step-num">2</span> Write your code</h3>
        <p>Open the file in your editor, replace the <code>TODO</code> / <code>NotImplementedError</code> with your solution, and save.</p>
        <div class="actions"><a class="btn secondary" href="vscode://file${encodeURI(path)}">Open in VS Code</a></div>
        ${l.hints.length ? `<div class="hints">
          ${l.hints.slice(0, hintsShown).map((h, i) => `<div class="hint"><b>Hint ${i + 1}</b> ${md(h)}</div>`).join('')}
          ${hintsShown < l.hints.length ? `<button class="btn small ghost" id="hint">Show a hint (${hintsShown + 1} of ${l.hints.length})</button>` : ''}
        </div>` : ''}
      </li>
      <li class="card">
        <h3><span class="step-num">3</span> Check your work</h3>
        <p>Runs the automated tests against your file. ${done ? 'Reruns are free.' : 'A failed run costs 10 health; read the output to see what to fix.'}</p>
        <div class="actions"><button class="btn" id="verify" ${state.hp > 0 ? '' : 'disabled'}>Run tests</button></div>
        <div id="result">${result ? resultHTML(result) : ''}</div>
      </li>
    </ol>`;
}

function nextMissionButton(l) {
  const [w, n] = l.id.split('.').map(Number);
  if (n < 4) return `<button class="btn small" data-go="#/mission/${w}.${n + 1}/learn">Next mission →</button>`;
  return `<button class="btn small" data-go="#/gate/${w}">Checkpoint quiz →</button>`;
}

// Pull the useful lines out of pytest output so failures are readable.
function summarize(output) {
  const lines = output.split('\n');
  const tally = lines.find(x => /\d+ (passed|failed|error)/.test(x)) || '';
  const errors = lines.filter(x => /^E\s/.test(x)).map(x => x.replace(/^E\s+/, '')).slice(0, 6);
  return {tally: tally.replace(/=+/g, '').trim(), errors};
}

function resultHTML(r) {
  const s = summarize(r.output);
  return `<div class="feedback ${r.passed ? 'good' : 'bad'}">
      <strong>${r.passed ? '✓ All tests passed.' : '✕ Some tests failed.'}</strong> ${esc(s.tally)}
      ${!r.passed && s.errors.length ? `<ul class="errors">${s.errors.map(e => `<li><code>${esc(e)}</code></li>`).join('')}</ul>` : ''}
    </div>
    <details class="log"><summary>Show full test output</summary><pre><code>${esc(r.output)}</code></pre></details>`;
}

function bindBuild(l, rerender) {
  const id = l.id, path = state.workspace + '/' + l.path;
  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(path); toast('Path copied.', 'good'); }
    catch { toast('Could not copy — select the path and copy it manually.', 'bad'); }
  };
  $('#init').onclick = async () => {
    try {
      const r = await api('initialize', {id});
      store('created:' + id, true);
      toast(r.message, 'good');
      rerender();
    } catch (e) { toast(e.message, 'bad'); }
  };
  if ($('#hint')) $('#hint').onclick = () => { store('hints:' + id, (store('hints:' + id) || 0) + 1); rerender(); };
  $('#verify').onclick = async () => {
    const b = $('#verify');
    b.disabled = true;
    b.textContent = 'Running tests… (up to 45 s)';
    try {
      const r = await api('verify', {id});
      verifyResults[id] = r;
      await refresh();
      if (r.passed) toast(r.reward ? `Passed! +${r.reward} XP` : 'All tests passed.', 'good');
      else toast('Some tests failed — see the details below. −10 health', 'bad');
    } catch (e) { toast(e.message, 'bad'); }
    rerender();
    const res = $('#result');
    if (res) res.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  };
  bindCommon();
}

function build(l) {
  render(`<div class="wrap narrow">${missionHeader(l, 'build')}${hpBanner()}${buildPanel(l, false)}</div>`);
  bindBuild(l, () => build(item(l.id)));
}

// ---------------------------------------------------------------- checkpoint + boss

function gate(w) {
  if (!worldOpen(w) || !levels(w).every(l => built(l.id))) {
    return render(`<div class="wrap narrow"><a class="back" href="#/room/${w}">← Room ${w}</a><div class="card center"><h2>🔒 Not unlocked yet</h2><p>Finish all four missions in this room first.</p></div></div>`);
  }
  const key = state.keys.includes(String(w)), best = state.quiz_scores['gate:' + w];
  render(`<div class="wrap narrow">
    <a class="back" href="#/room/${w}">← Room ${w}</a>
    ${hpBanner()}
    <div class="card">
      <span class="eyebrow">Room ${w} checkpoint</span>
      <h1>${key ? '✓ Checkpoint passed' : 'Checkpoint quiz'}</h1>
      <p>10 questions covering all four missions in this room.</p>
      <ul class="rules"><li>Score <b>8 or more</b> to unlock the room project.</li><li>Each wrong answer costs <b>10 health</b>.</li><li>Your answers are saved as you go.</li></ul>
      ${best !== undefined ? `<p class="muted">Your best so far: ${best} / 10</p>` : ''}
      <label class="check"><input type="checkbox" id="timed"> Add a 5-minute timer (optional challenge)</label>
      <div class="actions">
        <button class="btn" id="start" ${state.hp > 0 ? '' : 'disabled'}>${key ? 'Retake quiz' : 'Start quiz'}</button>
        ${key ? `<button class="btn secondary" data-go="#/boss/${w}">Open the room project →</button>` : ''}
      </div>
    </div>
  </div>`);
  $('#start').onclick = () => startQuiz('gate', String(w), $('#timed').checked);
  bindCommon();
}

function boss(w) {
  const b = item(w + '.boss');
  if (!b) return notFound();
  if (!b.unlocked) {
    return render(`<div class="wrap narrow"><a class="back" href="#/room/${w}">← Room ${w}</a><div class="card center"><h2>🔒 Not unlocked yet</h2><p>Pass the Room ${w} checkpoint quiz to unlock this project.</p></div></div>`);
  }
  const rerender = () => boss(w);
  render(`<div class="wrap narrow">
    <a class="back" href="#/room/${w}">← Room ${w}</a>
    <header class="mission-head"><span class="eyebrow">Room ${w} project</span><h1>${esc(b.title)}</h1></header>
    ${hpBanner()}
    <section class="card lesson">
      <h2>Briefing</h2>
      ${b.lesson.split(/(?<=\.)\s+(?=[A-Z])/).reduce((acc, s, i) => { acc[Math.floor(i / 3)] = (acc[Math.floor(i / 3)] || '') + s + ' '; return acc; }, []).map(p => `<p>${md(p.trim())}</p>`).join('')}
      <h3>Example</h3>
      <pre class="code"><code>${esc(b.example)}</code></pre>
      <div class="note">Tests use fake AI clients, so no API key is needed to pass. To run your finished project against Gemini, put your key in the project's <code>.env</code> file. See Help.</div>
    </section>
    ${buildPanel(b, true)}
  </div>`);
  bindBuild(b, rerender);
}

// ---------------------------------------------------------------- review / progress / help

function review() {
  const n = state.completed.filter(x => !x.endsWith('boss')).length;
  const claimed = state.daily_reward === new Date().toLocaleDateString('en-CA');
  render(`<div class="wrap narrow">
    <header class="page-head"><h1>Review</h1><p>Five quick questions from missions you've finished. Questions you missed, or haven't seen in a while, come up more often.</p></header>
    ${hpBanner()}
    <div class="card">
      ${n ? `<h2>Daily review</h2>
        <p>${claimed ? 'You\'ve claimed today\'s bonus. Extra reviews still help your memory.' : 'Your first review today earns up to <b>50 bonus XP</b> (10 per correct answer).'}</p>
        <p class="muted">${n} finished mission${n === 1 ? '' : 's'} in your question pool.${n === 1 ? ' With one mission, questions repeat.' : ''}</p>
        <div class="actions"><button class="btn" id="daily" ${state.hp > 0 ? '' : 'disabled'}>Start review</button></div>`
        : `<h2>Nothing to review yet</h2><p>Finish your first mission's Build step and its questions will show up here.</p>
        <div class="actions"><button class="btn" data-go="#/">Go to missions</button></div>`}
    </div>
    <div class="stats">
      <div class="stat"><b>${state.streak}</b><span>day streak</span></div>
      <div class="stat"><b>${state.best_streak}</b><span>best answer streak</span></div>
    </div>
  </div>`, 'review');
  if ($('#daily')) $('#daily').onclick = () => startQuiz('daily', '', false);
  bindCommon();
}

function progress() {
  const missionsDone = state.completed.filter(x => !x.endsWith('boss')).length;
  render(`<div class="wrap narrow">
    <header class="page-head"><h1>Your progress</h1></header>
    ${hpBanner()}
    <div class="stats">
      <div class="stat"><b>${state.level}</b><span>level</span><div class="bar"><i style="width:${state.level_xp / 2}%"></i></div><small>${state.level_xp} / 200 XP to next</small></div>
      <div class="stat"><b>${state.xp}</b><span>total XP</span></div>
      <div class="stat"><b>${missionsDone}<small>/16</small></b><span>missions built</span></div>
      <div class="stat"><b>${state.bosses.length}<small>/4</small></b><span>room projects</span></div>
    </div>
    <section class="card">
      <h2>Health</h2>
      <p>You have <b>${state.hp} / 100</b>. Wrong quiz answers and failed test runs cost 10; your first pass of each Build step gives back 20. Restoring is free and never loses progress (it only resets an unfinished quiz).</p>
      <div class="actions"><button class="btn secondary" data-heal ${state.hp === 100 ? 'disabled' : ''}>Restore health</button></div>
    </section>
    <section class="card">
      <h2>Badges</h2>
      ${state.badges.length ? `<div class="badges">${state.badges.map(b => `<span class="badge">◆ ${esc(b)}</span>`).join('')}</div>` : '<p class="muted">Finish Mission 1.1 to earn your first badge.</p>'}
    </section>
    <section class="card">
      <h2>Your name</h2>
      <p>Used for the greeting when you open the game. It's kept in this browser only.</p>
      <form class="name-form" id="name-form">
        <input id="name-input" maxlength="24" value="${esc(playerName())}" placeholder="Your name" aria-label="Your name" required>
        <button class="btn secondary" type="submit">Save</button>
      </form>
    </section>
    <section class="card">
      <h2>Your save</h2>
      <p>Progress is stored in <code>data/save.sqlite3</code> inside the project. Back it up with your <code>workspace/</code> folder.</p>
      <div class="actions"><a class="btn ghost" href="/api/export">Download a readable copy (JSON)</a></div>
    </section>
  </div>`, 'progress');
  $('#name-form').onsubmit = e => {
    e.preventDefault();
    const n = $('#name-input').value.trim().slice(0, 24);
    if (!n) return;
    store('playerName', n);
    toast(`Saved. See you next time, ${n}.`, 'good');
  };
  bindCommon();
}

function help() {
  render(`<div class="wrap narrow">
    <header class="page-head"><h1>How it works</h1></header>
    <section class="card">
      <h2>The three steps of every mission</h2>
      <ol class="plain">
        <li><b>Learn.</b> Short pages, one idea each, with practice questions. Practice never costs health.</li>
        <li><b>Quiz.</b> Three questions. Get all three right to unlock Build. Wrong answers cost 10 health but show the explanation.</li>
        <li><b>Build.</b> Create the starter file, write the code in your editor, and run the tests. Failed runs show exactly which checks failed.</li>
      </ol>
      <p>After four missions, a 10-question checkpoint (8 to pass) unlocks the room project. Finishing the project opens the next room.</p>
    </section>
    <section class="card">
      <h2>Where your code lives</h2>
      <p>Everything you write goes in the <code>workspace/</code> folder inside this project: <code>${esc(state.workspace)}</code>.</p>
      <pre class="code"><code>cd ECE-to-AI
source .venv/bin/activate
code workspace/
# run one mission's tests yourself:
python -m pytest verification/test_1_1.py -q</code></pre>
    </section>
    <section class="card">
      <h2>Rewards</h2>
      <p>Lesson quiz +30 XP · first Build pass +150 XP (with the quiz bonus) · checkpoint +100 XP · room project +300 XP · daily review up to +50 XP. Every 200 XP is a new level. Repeating things doesn't farm XP.</p>
    </section>
    <section class="card">
      <h2>Using Gemini for real</h2>
      <p>No API key is needed for any test. To run your projects against Gemini, set <code>GEMINI_API_KEY</code>, <code>GEMINI_MODEL</code> and <code>GEMINI_EMBED_MODEL</code> in the project's <code>.env</code> file. Live calls use your own account and may cost money. Never put a key in code you share.</p>
    </section>
    <section class="card">
      <h2>Safety note</h2>
      <p>Tests run your Python with your normal Mac user permissions. It isn't a sandbox, so only run code you trust. The game only listens on 127.0.0.1.</p>
    </section>
  </div>`, 'help');
}

function notFound() {
  render(`<div class="wrap narrow"><div class="card center"><h2>Page not found</h2><div class="actions center"><button class="btn" data-go="#/">Go home</button></div></div></div>`);
  bindCommon();
}

// ---------------------------------------------------------------- opening screen

const playerName = () => (store('playerName') || '').trim();
const wait = ms => new Promise(r => setTimeout(r, ms));

// Plays the opening screen until the data has loaded and the greeting has had its moment,
// then reveals the app underneath. Resolves with the load error, if any.
async function splash(loaded) {
  const el = $('#splash'), start = performance.now();
  let name = playerName(), skip;
  const skipped = new Promise(r => skip = r);
  const greet = (n, returning) => {
    $('#splash-hello').textContent = returning ? 'Welcome back,' : 'Welcome,';
    $('#splash-name').innerHTML = [...n].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
    $('#splash-name').setAttribute('aria-label', n);
    $('#splash-name').style.setProperty('--d', returning ? '.9s' : '.1s');
    el.classList.add('greeting');
  };

  if (name) greet(name, true);
  else {
    // First visit: ask for a name instead of guessing one.
    const form = $('#splash-form');
    form.hidden = false;
    el.classList.add('asking');
    setTimeout(() => $('#splash-input').focus(), 700);
    name = await new Promise(resolve => form.onsubmit = e => {
      e.preventDefault();
      const n = $('#splash-input').value.trim().slice(0, 24);
      if (n) resolve(n);
    });
    store('playerName', name);
    form.hidden = true;
    el.classList.remove('asking');
    greet(name, false);
  }

  const error = await loaded;
  if (!error) {
    const next = upNext();
    $('#splash-sub').textContent = `Level ${state.level} · picking up at ${next.eyebrow}: ${next.title}`;
  }
  el.classList.add('ready');
  // Returning players can skip; the greeting otherwise stays up long enough to be read.
  const onKey = () => skip();
  el.addEventListener('click', onKey);
  document.addEventListener('keydown', onKey, {once: true});
  if (!error && !calm()) await Promise.race([wait(Math.max(900, 2600 - (performance.now() - start))), skipped]);
  document.removeEventListener('keydown', onKey);

  if (!error) route();
  el.classList.add('leaving');
  setTimeout(() => el.remove(), calm() ? 0 : 900);
  return error;
}

// ---------------------------------------------------------------- routing

let keyNav = null, prevHash = '', lastHash = null;
document.addEventListener('keydown', e => {
  if (keyNav && !e.metaKey && !e.ctrlKey && !e.altKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) keyNav(e);
});

function route() {
  keyNav = null;
  const moved = location.hash !== lastHash;
  if (moved) [prevHash, lastHash] = [lastHash || '', location.hash];
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const [page, a, b] = parts;
  // Only real navigation animates in; in-place rerenders (quiz feedback, hints) stay still.
  $('#screen').classList.toggle('enter', moved);
  if (page === 'mission') mission(a, b || 'learn');
  else if (page === 'room') room(Number(a));
  else if (page === 'boss') boss(Number(a));
  else if (page === 'gate') gate(Number(a));
  else if (page === 'quiz') quiz();
  else if (page === 'review') review();
  else if (page === 'progress') progress();
  else if (page === 'help') help();
  else home();
  $('#screen').focus({preventScroll: true});
}

window.addEventListener('hashchange', async () => {
  try { await refresh(); } catch (e) { toast(e.message, 'bad'); }
  quizFeedback = location.hash === '#/quiz' ? quizFeedback : null;
  window.scrollTo(0, 0);
  route();
});

(async () => {
  const loaded = refresh().then(() => null, e => e);
  const error = await splash(loaded);
  if (error) {
    $('#screen').innerHTML = `<div class="wrap narrow"><div class="card"><h2>Can't reach the game server</h2><p>${esc(error.message)}</p><p>Make sure <code>./setup_and_run.sh</code> is still running, then reload.</p></div></div>`;
  }
})();
