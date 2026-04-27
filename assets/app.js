(() => {
  const APP_KEY = 'ege_pwa_state_v1';
  const TASK_CACHE = new Map();
  const DATA = { content:null, taskIndex:null };
  let deferredPrompt = null;
  const qs = (s, root=document) => root.querySelector(s);
  const qsa = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const app = qs('#app');

  const defaultState = () => ({
    theme:'light',
    hardFormulaIds:[],
    solvedTaskIds:[],
    correctCount:0,
    wrongCount:0,
    errors:{},
    viewedTheoryIds:[],
    lastSubject:'physics',
    lastTaskId:null,
    training:{},
  });
  let state = loadState();
  function loadState(){
    try { return {...defaultState(), ...(JSON.parse(localStorage.getItem(APP_KEY)||'{}'))}; }
    catch { return defaultState(); }
  }
  function saveState(){ localStorage.setItem(APP_KEY, JSON.stringify(state)); applyTheme(); }
  function applyTheme(){
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
    const meta = qs('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', state.theme === 'dark' ? '#0d1321' : '#2f5aa8');
  }
  applyTheme();

  async function fetchJSON(url){
    const res = await fetch(url, {cache:'force-cache'});
    if(!res.ok) throw new Error('Не удалось загрузить ' + url);
    return res.json();
  }
  async function loadContent(){
    if(!DATA.content) DATA.content = await fetchJSON('/data/content.json');
    return DATA.content;
  }
  async function loadTaskIndex(){
    if(!DATA.taskIndex) DATA.taskIndex = await fetchJSON('/data/tasks/index.json');
    return DATA.taskIndex;
  }
  async function loadTaskChunk(subject, egeNumber){
    const key = subject + ':' + egeNumber;
    if(TASK_CACHE.has(key)) return TASK_CACHE.get(key);
    const url = `/data/tasks/${subject}/ege-${egeNumber || 'other'}.json`;
    const data = await fetchJSON(url);
    TASK_CACHE.set(key, data);
    return data;
  }
  async function loadTask(subject, taskId){
    const index = await loadTaskIndex();
    const meta = index.tasks.find(t => t.id === taskId);
    if(!meta) return null;
    const chunk = await loadTaskChunk(subject || meta.subject, meta.egeNumber);
    return chunk.find(t => t.id === taskId) || null;
  }

  const getHash = () => location.hash.replace(/^#\/?/, '') || '';
  function go(path){ location.hash = '#/' + path.replace(/^\//,''); }
  window.addEventListener('hashchange', render);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; const b=qs('#installBanner'); if(b) b.classList.add('show'); });

  function subjectTitle(subject){ return subject === 'math' ? 'Математика' : 'Физика'; }
  function subjectIcon(subject){ return subject === 'math' ? '∑' : '⚡'; }
  function routeParts(){ return getHash().split('/').filter(Boolean).map(decodeURIComponent); }
  function setShell(title, subtitle='', back=true){
    return `
      <div class="shell">
        <header class="header">
          ${back ? `<button class="icon-btn" data-action="back" aria-label="Назад">‹</button>` : ''}
          <div class="header-title"><div>${esc(title)}</div>${subtitle ? `<div class="header-subtitle">${esc(subtitle)}</div>`:''}</div>
          <button class="icon-btn" data-action="theme" aria-label="Тема">${state.theme === 'dark' ? '☀' : '☾'}</button>
        </header>
        <main id="page" class="page"></main>
      </div>
      ${installBanner()}
    `;
  }
  function installBanner(){
    return `<div id="installBanner" class="install-banner"><b>Установить приложение?</b><div class="small muted">После установки ЕГЭ откроется как обычное приложение на телефоне.</div><div class="btn-row"><button class="btn" data-action="install">Установить</button><button class="btn secondary" data-action="hide-install">Позже</button></div></div>`;
  }
  function attachGlobalEvents(){
    qsa('[data-action="back"]').forEach(b => b.onclick = () => history.length > 1 ? history.back() : go(''));
    qsa('[data-action="theme"]').forEach(b => b.onclick = () => { state.theme = state.theme === 'dark' ? 'light':'dark'; saveState(); render(); });
    qsa('[data-action="hide-install"]').forEach(b => b.onclick = () => qs('#installBanner')?.classList.remove('show'));
    qsa('[data-action="install"]').forEach(b => b.onclick = async () => { if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; } qs('#installBanner')?.classList.remove('show'); });
  }

  async function render(){
    try{
      const parts = routeParts();
      if(!parts.length){ app.innerHTML = setShell('ЕГЭ', 'Математика и физика', false); attachGlobalEvents(); return renderSubjectSelect(); }
      const [first, second, third, fourth] = parts;
      if(first === 'task') return renderTaskPage(second, third);
      if(first === 'formula') return renderFormulaDetail(second, third);
      if(first === 'theory') return renderTheoryDetail(second, third);
      const subject = first;
      state.lastSubject = subject; saveState();
      if(!second) return renderSubjectHome(subject);
      if(second === 'theory') return renderTheoryList(subject);
      if(second === 'formulas') return renderFormulaList(subject);
      if(second === 'training') return renderTraining(subject);
      if(second === 'tasks') return renderTasks(subject);
      if(second === 'hard') return renderHard(subject);
      if(second === 'errors') return renderErrors(subject);
      if(second === 'settings') return renderSettings(subject);
      return renderSubjectHome(subject);
    } catch(e){
      console.error(e);
      app.innerHTML = setShell('Ошибка', 'Что-то не загрузилось', true);
      attachGlobalEvents();
      qs('#page').innerHTML = `<div class="card"><h2>Не получилось открыть экран</h2><p class="muted">${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Перезагрузить</button></div>`;
    }
  }

  async function renderSubjectSelect(){
    const content = await loadContent();
    qs('#page').innerHTML = `
      <section class="hero">
        <h1>ЕГЭ</h1>
        <p>Тренажёр по математике и физике: теория, формулы, задачи, ошибки и локальный прогресс.</p>
      </section>
      <div class="subject-grid">
        ${content.subjects.map(s => `<button class="subject-card" data-go="${s.id}"><h2>${esc(s.title)}</h2><p>${esc(s.subtitle)}</p><div class="subject-icon">${subjectIcon(s.id)}</div></button>`).join('')}
      </div>
      <div class="footer-note">Данные хранятся только на этом устройстве. Регистрация не нужна.</div>
    `;
    qsa('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  }

  function progressStats(subject){
    const solved = state.solvedTaskIds.filter(id => id.startsWith(subject+'-')).length;
    const errors = Object.values(state.errors).filter(e => e.subject === subject).length;
    const hard = state.hardFormulaIds.filter(id => formulaById(id)?.subject === subject).length;
    return {solved, correct:state.correctCount, wrong:state.wrongCount, errors, hard};
  }
  let formulaMap = null;
  function formulaById(id){ if(!DATA.content) return null; if(!formulaMap) formulaMap = new Map(DATA.content.formulas.map(f => [f.id,f])); return formulaMap.get(id); }

  async function renderSubjectHome(subject){
    await loadContent();
    app.innerHTML = setShell('ЕГЭ ' + subjectTitle(subject), 'Выбери раздел', true);
    attachGlobalEvents();
    const st = progressStats(subject);
    qs('#page').innerHTML = `
      <div class="stats">
        <div class="stat"><b>${st.solved}</b><span>задач решено</span></div>
        <div class="stat"><b>${st.correct}</b><span>верных ответов</span></div>
        <div class="stat"><b>${st.errors}</b><span>задач в ошибках</span></div>
        <div class="stat"><b>${st.hard}</b><span>сложных формул</span></div>
      </div>
      ${state.lastTaskId && state.lastTaskId.startsWith(subject+'-') ? `<button class="menu-card plain" data-go="task/${subject}/${state.lastTaskId}"><div><h2>Продолжить</h2><small>Открыть последнюю задачу</small></div><span>↗</span></button>`:''}
      <div class="menu-grid">
        ${menuCard(subject,'theory','Теория','Краткие шпаргалки','📘')}
        ${menuCard(subject,'formulas','Формулы','Пояснения и примеры','ƒ')}
        ${menuCard(subject,'training','Тренировка','7 режимов формул','⚡')}
        ${menuCard(subject,'tasks','Задачи','По номерам и темам','✎')}
        ${menuCard(subject,'hard','Сложные','Повторение формул','★')}
        ${menuCard(subject,'errors','Ошибки','Решить снова','!')}
        ${menuCard(subject,'settings','Настройки','Тема, сброс и кэш','⚙')}
      </div>
    `;
    qsa('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  }
  function menuCard(subject, path, title, sub, icon){ return `<button class="menu-card" data-go="${subject}/${path}"><div><h2>${esc(title)}</h2><small>${esc(sub)}</small></div><span>${icon}</span></button>`; }

  async function renderTheoryList(subject){
    const content = await loadContent();
    app.innerHTML = setShell('Теория', 'ЕГЭ ' + subjectTitle(subject), true); attachGlobalEvents();
    const list = content.theory.filter(t => t.subject === subject);
    const topics = [...new Set(list.map(t => t.topic))];
    qs('#page').innerHTML = `
      <input class="search" id="search" placeholder="Поиск по теории" />
      <div class="chip-row" id="topicChips"><button class="chip active" data-topic="">Все</button>${topics.map(t=>`<button class="chip" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div id="list"></div>`;
    let activeTopic='';
    function draw(){
      const s=qs('#search').value.toLowerCase();
      const filtered=list.filter(t=>(!activeTopic||t.topic===activeTopic) && (`${t.title} ${t.topic} ${t.subtopic}`.toLowerCase().includes(s)));
      qs('#list').innerHTML = filtered.map(t => `<button class="card" data-id="${t.id}" style="width:100%;text-align:left"><h3 class="card-title">${esc(t.title)}</h3><div class="card-meta"><span class="badge">${esc(t.topic)}</span><span class="badge">${t.formulas.length} формул</span></div><p class="muted">${esc(t.summary)}</p></button>`).join('') || `<div class="list-empty">Ничего не найдено</div>`;
      qsa('[data-id]',qs('#list')).forEach(b=>b.onclick=()=>go(`theory/${subject}/${b.dataset.id}`));
    }
    qs('#search').oninput=draw;
    qsa('#topicChips .chip').forEach(ch=>ch.onclick=()=>{activeTopic=ch.dataset.topic; qsa('#topicChips .chip').forEach(x=>x.classList.remove('active')); ch.classList.add('active'); draw();});
    draw();
  }
  async function renderTheoryDetail(subject, id){
    const content = await loadContent();
    const t = content.theory.find(x => x.id === id);
    app.innerHTML = setShell(t ? t.title : 'Теория', t ? `${subjectTitle(subject)} · ${t.topic}` : '', true); attachGlobalEvents();
    if(!t){ qs('#page').innerHTML = `<div class="list-empty">Теория не найдена</div>`; return; }
    if(!state.viewedTheoryIds.includes(id)){ state.viewedTheoryIds.push(id); saveState(); }
    const formulas = t.formulas.map(fid => content.formulas.find(f=>f.id===fid)).filter(Boolean);
    qs('#page').innerHTML = `
      <article class="card">
        <div class="card-meta"><span class="badge">${esc(t.topic)}</span><span class="badge">${esc(t.subtopic)}</span></div>
        <p>${esc(t.summary)}</p>
        ${t.diagram ? `<img class="diagram" src="/assets/diagrams/${t.diagram}" alt="схема по теме">` : ''}
        <h3>Главные идеи</h3>${ul(t.keyIdeas)}
        <h3>Основные формулы</h3>
        ${formulas.map(f=>`<button class="card" data-formula="${f.id}" style="width:100%;text-align:left"><div class="formula-mini">${esc(f.formula)}</div><b>${esc(f.title)}</b><p class="small muted">${esc(f.explanation)}</p></button>`).join('')}
        <h3>Типовые задачи</h3>${ul(t.typicalTasks)}
        <h3>Частые ошибки</h3>${ul(t.commonMistakes)}
        <div class="status warn"><b>Мини-пример:</b><br>${esc(t.example)}</div>
      </article>`;
    qsa('[data-formula]').forEach(b=>b.onclick=()=>go(`formula/${subject}/${b.dataset.formula}`));
  }
  function ul(items=[]){ return `<ul>${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`; }

  async function renderFormulaList(subject){
    const content = await loadContent();
    app.innerHTML = setShell('Формулы', 'ЕГЭ ' + subjectTitle(subject), true); attachGlobalEvents();
    const list = content.formulas.filter(f => f.subject === subject);
    const topics = [...new Set(list.map(f => f.topic))];
    qs('#page').innerHTML = `<input class="search" id="search" placeholder="Поиск формулы"/><div class="chip-row" id="topicChips"><button class="chip active" data-topic="">Все</button>${topics.map(t=>`<button class="chip" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}</div><div id="list"></div>`;
    let activeTopic='';
    function draw(){
      const s=qs('#search').value.toLowerCase();
      const filtered=list.filter(f=>(!activeTopic||f.topic===activeTopic) && (`${f.title} ${f.formula} ${f.topic} ${f.subtopic} ${f.explanation}`.toLowerCase().includes(s)));
      qs('#list').innerHTML = filtered.map(f=>formulaCard(f)).join('') || `<div class="list-empty">Ничего не найдено</div>`;
      qsa('[data-formula]').forEach(b=>b.onclick=()=>go(`formula/${subject}/${b.dataset.formula}`));
      qsa('[data-hard]').forEach(b=>b.onclick=(e)=>{e.stopPropagation(); toggleHard(b.dataset.hard); draw();});
    }
    qs('#search').oninput=draw;
    qsa('#topicChips .chip').forEach(ch=>ch.onclick=()=>{activeTopic=ch.dataset.topic; qsa('#topicChips .chip').forEach(x=>x.classList.remove('active')); ch.classList.add('active'); draw();});
    draw();
  }
  function formulaCard(f){ const hard=state.hardFormulaIds.includes(f.id); return `<button class="card" data-formula="${f.id}" style="width:100%;text-align:left"><h3 class="card-title">${esc(f.title)}</h3><div class="formula-mini">${esc(f.formula)}</div><div class="card-meta"><span class="badge">${esc(f.topic)}</span><span class="badge">${esc(f.subtopic)}</span>${hard?'<span class="badge yellow">★ сложная</span>':''}</div><p class="small muted">${esc(f.explanation)}</p><div class="btn-row"><span class="btn soft">Открыть</span><span class="btn secondary" data-hard="${f.id}">${hard?'Убрать из сложных':'Добавить в сложные'}</span></div></button>`; }
  async function renderFormulaDetail(subject, id){
    const content = await loadContent();
    const f = content.formulas.find(x => x.id === id);
    app.innerHTML = setShell(f ? f.title : 'Формула', f ? `${subjectTitle(subject)} · ${f.topic}` : '', true); attachGlobalEvents();
    if(!f){ qs('#page').innerHTML = `<div class="list-empty">Формула не найдена</div>`; return; }
    const hard = state.hardFormulaIds.includes(f.id);
    qs('#page').innerHTML = `
      <article class="card">
        <div class="card-meta"><span class="badge">${esc(f.topic)}</span><span class="badge">${esc(f.subtopic)}</span><span class="badge">сложность ${f.difficulty}</span></div>
        <div class="formula-box">${esc(f.formula)}</div>
        ${f.diagram ? `<img class="diagram" src="/assets/diagrams/${f.diagram}" alt="схема">` : ''}
        <h3>Что означает</h3><p>${esc(f.explanation)}</p>
        <h3>Величины</h3>${varTable(f.variables)}
        ${f.constants ? `<h3>Постоянные</h3>${varTable(f.constants.map(c=>({symbol:c.symbol,name:c.value,unit:c.unit})))}`:''}
        <div class="status warn"><b>Пример:</b><br>${esc(f.example)}</div>
        <div class="btn-row"><button class="btn" data-go="${subject}/training?formula=${f.id}">Тренировать</button><button class="btn secondary" data-hard="${f.id}">${hard?'Убрать из сложных':'Добавить в сложные'}</button></div>
      </article>`;
    qsa('[data-hard]').forEach(b=>b.onclick=()=>{toggleHard(b.dataset.hard); renderFormulaDetail(subject,id);});
    qsa('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  }
  function varTable(vars=[]){ return `<div class="card" style="box-shadow:none;background:var(--surface-2);padding:0;overflow:hidden"><table class="task-table" style="width:100%"><tbody>${vars.map(v=>`<tr><td><b>${esc(v.symbol)}</b></td><td>${esc(v.name)}</td><td class="muted">${esc(v.unit||'')}</td></tr>`).join('')}</tbody></table></div>`; }
  function toggleHard(id){ state.hardFormulaIds = state.hardFormulaIds.includes(id) ? state.hardFormulaIds.filter(x=>x!==id) : [...state.hardFormulaIds,id]; saveState(); }

  async function renderTasks(subject){
    app.innerHTML = setShell('Задачи', 'ЕГЭ ' + subjectTitle(subject), true); attachGlobalEvents();
    qs('#page').innerHTML = `<div class="loading">Загружаю список задач…</div>`;
    const idx = await loadTaskIndex();
    const tasks = idx.tasks.filter(t => t.subject === subject);
    const eges = [...new Set(tasks.map(t=>t.egeNumber).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
    const topics = [...new Set(tasks.map(t=>t.topic))].sort();
    qs('#page').innerHTML = `
      <input class="search" id="search" placeholder="Поиск по условию, теме или номеру" />
      <div class="field-row"><select class="select" id="ege"><option value="">Все номера ЕГЭ</option>${eges.map(n=>`<option value="${n}">Задание ${n}</option>`).join('')}</select><select class="select" id="topic"><option value="">Все темы</option>${topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div>
      <div class="small muted" id="count"></div><div id="list"></div><button class="btn secondary full" id="more">Показать ещё</button>`;
    let limit = 40;
    function draw(){
      const s=qs('#search').value.toLowerCase(), e=qs('#ege').value, topic=qs('#topic').value;
      const filtered=tasks.filter(t=>(!e||String(t.egeNumber)===e)&&(!topic||t.topic===topic)&&(`${t.egeNumber} ${t.topic} ${t.subtopic} ${t.preview}`.toLowerCase().includes(s)));
      qs('#count').textContent = `Найдено: ${filtered.length}. Показано: ${Math.min(limit, filtered.length)}.`;
      qs('#list').innerHTML = filtered.slice(0,limit).map(t=>taskPreviewCard(t)).join('') || `<div class="list-empty">Задачи не найдены</div>`;
      qs('#more').style.display = filtered.length > limit ? 'flex':'none';
      qsa('[data-task]').forEach(b=>b.onclick=()=>go(`task/${subject}/${b.dataset.task}`));
    }
    ['search','ege','topic'].forEach(id=>qs('#'+id).oninput=()=>{limit=40;draw();});
    qs('#more').onclick=()=>{limit+=40;draw();};
    draw();
  }
  function taskPreviewCard(t){ const solved=state.solvedTaskIds.includes(t.id), err=state.errors[t.id]; return `<button class="card" data-task="${t.id}" style="width:100%;text-align:left"><div class="card-meta"><span class="badge">№ ${esc(t.egeNumber)}</span><span class="badge">${esc(t.topic)}</span>${solved?'<span class="badge green">решено</span>':''}${err?'<span class="badge red">ошибка</span>':''}${t.hasImages?'<span class="badge">рисунок</span>':''}</div><p>${esc(t.preview || 'Открыть задачу')}</p><div class="small muted">${esc(t.subtopic)} · ${esc(t.taskTypeLabel||'задача')}</div></button>`; }

  async function renderTaskPage(subject, taskId){
    app.innerHTML = setShell('Задача', subjectTitle(subject), true); attachGlobalEvents();
    qs('#page').innerHTML = `<div class="loading">Открываю задачу…</div>`;
    const task = await loadTask(subject, taskId);
    if(!task){ qs('#page').innerHTML = `<div class="list-empty">Задача не найдена</div>`; return; }
    state.lastTaskId = task.id; saveState();
    let hintsShown = 0, checked = false, message = '', answerClass='', showSolution=false;
    function draw(){
      qs('#page').innerHTML = `
        <div class="task-layout">
          <article class="card">
            <div class="card-meta"><span class="badge">ЕГЭ №${esc(task.egeNumber)}</span><span class="badge">${esc(task.topic)}</span><span class="badge">${esc(task.subtopic)}</span>${task.hasImages?'<span class="badge">рисунок</span>':''}</div>
            <div class="task-html">${task.conditionHtml}</div>
            <div id="missingImages"></div>
          </article>
          <aside>
            <div class="answer-panel">
              ${message ? `<div class="status ${answerClass}">${message}</div>`:''}
              <label class="small muted">Ответ</label>
              <input class="input" id="answer" placeholder="Например: 6 Н" autocomplete="off" />
              <button class="btn full" id="check">Проверить</button>
              <div class="btn-row"><button class="btn secondary" id="hint">Подсказка</button><button class="btn secondary" id="solution">Показать решение</button></div>
            </div>
            <div id="hintsBox"></div><div id="solutionBox"></div>
          </aside>
        </div>`;
      attachImageFallbacks(task);
      qs('#check').onclick = () => {
        const val = qs('#answer').value;
        const ok = checkAnswer(val, task.answer, task.answerUnit, task.answerVariants);
        checked = true;
        if(ok){ message='Верно ✅'; answerClass='ok'; markSolved(task); }
        else { message='Неверно. Решение и правильный ответ появятся только после нажатия «Показать решение». ❌'; answerClass='bad'; markError(task,val); }
        draw();
      };
      qs('#hint').onclick = () => { hintsShown = Math.min(hintsShown + 1, task.hints.length || 1); drawHints(); };
      qs('#solution').onclick = () => { showSolution = true; drawSolution(); };
      drawHints(); if(showSolution) drawSolution();
    }
    function drawHints(){
      const hints = (task.hints||[]).slice(0,hintsShown);
      qs('#hintsBox').innerHTML = hints.map((h,i)=>`<div class="status warn"><b>${esc(h.title || 'Подсказка ' + (i+1))}</b><br>${esc(h.text || h)}</div>`).join('') || (hintsShown ? `<div class="status warn">Попробуй выписать данные и найти формулу с искомой величиной.</div>`:'');
    }
    function drawSolution(){
      qs('#solutionBox').innerHTML = `<div class="card"><h3>Решение</h3><div class="status ok"><b>Правильный ответ:</b> ${esc(task.answer)} ${esc(task.answerUnit||'')}</div>${(task.given&&task.given.length)?`<h4>Дано</h4>${ul(task.given.map(String))}`:''}${(task.find&&task.find.length)?`<h4>Найти</h4>${ul(task.find.map(String))}`:''}${(task.solutionSteps||[]).map(s=>`<div class="solution-step"><b>${esc(s.title)}</b><br>${esc(s.text)}</div>`).join('') || '<p class="muted">Подробное решение пока не добавлено.</p>'}</div>`;
    }
    draw();
  }
  function attachImageFallbacks(task){
    qsa('.task-image').forEach(img => {
      img.addEventListener('error', () => {
        const box=document.createElement('div');
        box.className='image-missing';
        box.innerHTML=`Картинка пока не найдена в dist.<br><span class="kbd">${esc(img.getAttribute('src'))}</span><br>Добавь файл по этому пути, и она появится.`;
        img.replaceWith(box);
      }, {once:true});
    });
  }
  function normalizeAnswer(s){ return String(s||'').toLowerCase().replace(',', '.').replace(/ё/g,'е').replace(/[−–—]/g,'-').replace(/\s+/g,'').replace(/\*/g,'').replace(/ньютона|ньютон|newton/g,'н').replace(/n$/,'н'); }
  function extractNumber(s){ const m=String(s||'').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; }
  function checkAnswer(user, correct, unit='', variants=[]){
    const u=normalizeAnswer(user), c=normalizeAnswer(correct);
    if(!u) return false;
    const all = [correct, ...(variants||[])].filter(Boolean).map(normalizeAnswer);
    if(all.includes(u)) return true;
    if(unit){ const unitNorm=normalizeAnswer(unit); if(all.includes(u.replace(unitNorm,''))) return true; if(all.map(x=>x+unitNorm).includes(u)) return true; }
    const un=extractNumber(user), cn=extractNumber(correct);
    if(Number.isFinite(un) && Number.isFinite(cn)){
      const tol = Math.max(0.000001, Math.abs(cn)*0.005);
      return Math.abs(un-cn) <= tol;
    }
    return false;
  }
  function markSolved(task){
    if(!state.solvedTaskIds.includes(task.id)) state.solvedTaskIds.push(task.id);
    state.correctCount += 1;
    saveState();
  }
  function markError(task, userAnswer){
    state.wrongCount += 1;
    const prev=state.errors[task.id];
    state.errors[task.id] = { taskId:task.id, subject:task.subject, date:new Date().toISOString(), userAnswer, correctAnswer:task.answer, answerUnit:task.answerUnit, topic:task.topic, subtopic:task.subtopic, egeNumber:task.egeNumber, count:(prev?.count||0)+1 };
    saveState();
  }

  async function renderHard(subject){
    const content = await loadContent();
    app.innerHTML = setShell('Сложные формулы', 'ЕГЭ ' + subjectTitle(subject), true); attachGlobalEvents();
    const list = state.hardFormulaIds.map(id=>content.formulas.find(f=>f.id===id)).filter(f=>f&&f.subject===subject);
    qs('#page').innerHTML = list.length ? `${list.map(f=>formulaCard(f)).join('')}<button class="btn full" data-go="${subject}/training?scope=hard">Тренировать сложные</button>` : `<div class="list-empty">Пока нет сложных формул. Добавляй их на карточках формул или в режиме “Знал / не знал”.</div>`;
    qsa('[data-formula]').forEach(b=>b.onclick=()=>go(`formula/${subject}/${b.dataset.formula}`));
    qsa('[data-hard]').forEach(b=>b.onclick=(e)=>{e.stopPropagation(); toggleHard(b.dataset.hard); renderHard(subject);});
    qsa('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  }

  async function renderErrors(subject){
    app.innerHTML = setShell('Мои ошибки', 'ЕГЭ ' + subjectTitle(subject), true); attachGlobalEvents();
    const list = Object.values(state.errors).filter(e=>e.subject===subject).sort((a,b)=>new Date(b.date)-new Date(a.date));
    qs('#page').innerHTML = list.length ? list.map(e=>`<div class="card"><div class="card-meta"><span class="badge red">ошибок: ${e.count}</span><span class="badge">ЕГЭ №${esc(e.egeNumber)}</span><span class="badge">${esc(e.topic)}</span></div><h3 class="card-title">${esc(e.subtopic)}</h3><p class="small muted">Твой ответ: ${esc(e.userAnswer||'пусто')}</p><p class="small muted">Дата: ${new Date(e.date).toLocaleString('ru-RU')}</p><div class="btn-row"><button class="btn" data-task="${e.taskId}">Решить снова</button><button class="btn secondary" data-remove="${e.taskId}">Удалить</button></div></div>`).join('') : `<div class="list-empty">Ошибок пока нет 🎉</div>`;
    qsa('[data-task]').forEach(b=>b.onclick=()=>go(`task/${subject}/${b.dataset.task}`));
    qsa('[data-remove]').forEach(b=>b.onclick=()=>{delete state.errors[b.dataset.remove]; saveState(); renderErrors(subject);});
  }

  async function renderTraining(subject){
    const content = await loadContent();
    app.innerHTML = setShell('Тренировка', 'ЕГЭ ' + subjectTitle(subject), true); attachGlobalEvents();
    let formulas = content.formulas.filter(f=>f.subject===subject);
    const topics=[...new Set(formulas.map(f=>f.topic))];
    const params = new URLSearchParams((getHash().split('?')[1]||''));
    const fixedFormula = params.get('formula');
    const startScope = params.get('scope') || 'all';
    qs('#page').innerHTML = `
      <div class="field-row">
        <select class="select" id="mode">
          <option value="write">1. Напиши формулу</option>
          <option value="choice">2. Выбери правильную формулу</option>
          <option value="express">3. Вырази величину</option>
          <option value="calc">4. Найди величину по данным</option>
          <option value="mistake">5. Найди ошибку в формуле</option>
          <option value="identify">6. Определи формулу по условию</option>
          <option value="flash">7. Карточки “знал / не знал”</option>
        </select>
        <select class="select" id="scope"><option value="all">Все формулы</option><option value="hard">Только сложные</option>${topics.map(t=>`<option value="topic:${esc(t)}">${esc(t)}</option>`).join('')}</select>
      </div>
      <div id="trainBox"></div>`;
    qs('#scope').value=startScope;
    let current = null, revealed=false, checked=false;
    function pool(){
      let p=[...formulas];
      const scope=qs('#scope').value;
      if(fixedFormula) p = p.filter(f=>f.id===fixedFormula);
      if(scope==='hard') p=p.filter(f=>state.hardFormulaIds.includes(f.id));
      if(scope.startsWith('topic:')) p=p.filter(f=>f.topic===scope.slice(6));
      return p.length ? p : formulas.slice(0,1);
    }
    function next(){ const p=pool(); current=p[Math.floor(Math.random()*p.length)]; revealed=false; checked=false; draw(); }
    function draw(){
      const mode=qs('#mode').value;
      if(!current){ next(); return; }
      let html='';
      if(mode==='write') html = trainWrite(current);
      if(mode==='choice') html = trainChoice(current, formulas);
      if(mode==='express') html = trainExpress(current);
      if(mode==='calc') html = trainCalc(current);
      if(mode==='mistake') html = trainMistake(current);
      if(mode==='identify') html = trainIdentify(current);
      if(mode==='flash') html = trainFlash(current, revealed);
      qs('#trainBox').innerHTML = html;
      attachTrainingEvents(mode);
    }
    function attachTrainingEvents(mode){
      const nextBtn=qs('#next'); if(nextBtn) nextBtn.onclick=next;
      const show=qs('#show'); if(show) show.onclick=()=>{revealed=true;draw();};
      const check=qs('#checkTrain'); if(check) check.onclick=()=>checkTrain(mode);
      qsa('[data-pick]').forEach(b=>b.onclick=()=>{qsa('[data-pick]').forEach(x=>x.classList.remove('correct','wrong')); if(b.dataset.pick===current.id){b.classList.add('correct');}else{b.classList.add('wrong'); const good=qs(`[data-pick="${current.id}"]`); if(good) good.classList.add('correct');}});
      qsa('[data-flash]').forEach(b=>b.onclick=()=>{ if(b.dataset.flash==='hard') toggleHard(current.id); next(); });
    }
    function checkTrain(mode){
      const val=qs('#trainAnswer')?.value || '';
      let correct = current.formula;
      if(mode==='express') correct=current.practice?.express?.answer || current.formula;
      if(mode==='calc') correct=current.practice?.calc?.answer || '';
      if(mode==='mistake') correct=current.practice?.wrong?.correct || current.formula;
      const variants = current.practice?.answers || [current.formula];
      const ok = mode==='calc' ? checkAnswer(val, correct, current.practice?.calc?.unit||'', [correct]) : variants.map(normalizeAnswer).includes(normalizeAnswer(val)) || normalizeAnswer(val)===normalizeAnswer(correct);
      const box=qs('#result'); if(box) box.innerHTML = ok ? `<div class="status ok">Верно ✅</div>` : `<div class="status bad">Пока неверно. Правильно: <b>${esc(correct)}</b></div>`;
    }
    qs('#mode').onchange=next; qs('#scope').onchange=next; next();
  }
  function trainBase(f, inner){ return `<div class="card"><div class="card-meta"><span class="badge">${esc(f.topic)}</span><span class="badge">${esc(f.subtopic)}</span></div>${inner}<div id="result"></div><div class="btn-row"><button class="btn" id="checkTrain">Проверить</button><button class="btn secondary" id="next">Следующая</button></div></div>`; }
  function trainWrite(f){ return trainBase(f, `<h3>Напиши формулу</h3><p>Напиши формулу: <b>${esc(f.title)}</b></p><input class="input" id="trainAnswer" placeholder="Введи формулу"/>`); }
  function trainChoice(f, all){ const opts=[f,...shuffle(all.filter(x=>x.id!==f.id)).slice(0,3)]; return `<div class="card"><h3>Выбери правильную формулу</h3><p>${esc(f.title)}</p>${shuffle(opts).map(o=>`<button class="option" data-pick="${o.id}">${esc(o.formula)}</button>`).join('')}<button class="btn secondary full" id="next">Следующая</button></div>`; }
  function trainExpress(f){ const ex=f.practice?.express; return trainBase(f, `<h3>Вырази величину</h3><div class="formula-box">${esc(f.formula)}</div><p>Вырази: <b>${esc(ex?.symbol || 'одну из величин')}</b></p><input class="input" id="trainAnswer" placeholder="Например: m = F / a"/>`); }
  function trainCalc(f){ const c=f.practice?.calc; return trainBase(f, `<h3>Найди величину по данным</h3><p>${esc(c?.given || f.example)}</p><p>Найди: <b>${esc(c?.find || 'ответ')}</b></p><input class="input" id="trainAnswer" placeholder="Ответ"/>`); }
  function trainMistake(f){ const w=f.practice?.wrong; return trainBase(f, `<h3>Найди ошибку</h3><p>В формуле есть ошибка:</p><div class="formula-box">${esc(w?.wrongFormula || f.formula.replace('=','≈'))}</div><input class="input" id="trainAnswer" placeholder="Запиши правильную формулу"/>`); }
  function trainIdentify(f){ return trainBase(f, `<h3>Определи формулу по условию</h3><p>${esc(f.practice?.scenario || f.explanation)}</p><input class="input" id="trainAnswer" placeholder="Какая формула нужна?"/>`); }
  function trainFlash(f, revealed){ return `<div class="card"><h3>Карточка</h3><p>${esc(f.title)}</p>${revealed?`<div class="formula-box">${esc(f.formula)}</div><p>${esc(f.explanation)}</p><div class="btn-row"><button class="btn green" data-flash="known">Знал</button><button class="btn secondary" data-flash="unknown">Не знал</button><button class="btn" data-flash="hard">Сложно</button></div>`:`<button class="btn full" id="show">Показать ответ</button>`}<button class="btn secondary full" id="next">Следующая</button></div>`; }
  function shuffle(a){ return a.map(x=>[Math.random(),x]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]); }

  async function renderSettings(subject){
    app.innerHTML = setShell('Настройки', 'ЕГЭ ' + subjectTitle(subject), true); attachGlobalEvents();
    qs('#page').innerHTML = `
      <div class="card"><h3>Тема</h3><p class="muted">Сейчас: ${state.theme === 'dark' ? 'тёмная' : 'светлая'}</p><button class="btn" id="themeToggle">Переключить тему</button></div>
      <div class="card"><h3>Данные на устройстве</h3><p class="muted">Прогресс хранится локально в браузере.</p><div class="btn-row"><button class="btn danger" id="resetProgress">Сбросить прогресс</button><button class="btn secondary" id="resetErrors">Сбросить ошибки</button></div></div>
      <div class="card"><h3>Кэш и офлайн</h3><p class="muted">Приложение, теория и формулы доступны офлайн. Задачи и картинки сохраняются по мере открытия.</p><div class="btn-row"><button class="btn secondary" id="clearDynamic">Очистить сохранённые задачи и картинки</button><button class="btn secondary" id="clearAllCache">Очистить весь кэш приложения</button></div><div id="cacheMsg"></div></div>
      <div class="card"><h3>О приложении</h3><p>ЕГЭ — локальный PWA-тренажёр без регистрации, сервера и встроенного ИИ.</p><p class="small muted">База задач лежит внутри проекта. Картинки к задачам можно добавить в папки <span class="kbd">assets/ege_math/problem_images</span> и <span class="kbd">assets/ege_phys/problem_images</span>.</p></div>`;
    qs('#themeToggle').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';saveState();renderSettings(subject);};
    qs('#resetErrors').onclick=()=>{ if(confirm('Удалить все ошибки?')){ state.errors={}; saveState(); renderSettings(subject); } };
    qs('#resetProgress').onclick=()=>{ if(confirm('Сбросить решённые задачи, ошибки и сложные формулы?')){ state=defaultState(); state.theme=document.documentElement.classList.contains('dark')?'dark':'light'; saveState(); renderSettings(subject); } };
    qs('#clearDynamic').onclick=async()=>{ await clearCaches(true); qs('#cacheMsg').innerHTML='<div class="status ok">Кэш задач и картинок очищен.</div>'; };
    qs('#clearAllCache').onclick=async()=>{ await clearCaches(false); qs('#cacheMsg').innerHTML='<div class="status ok">Кэш приложения очищен. Перезагрузи страницу онлайн.</div>'; };
  }
  async function clearCaches(dynamicOnly){
    if(!('caches' in window)) return;
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>dynamicOnly ? k.includes('dynamic') : true).map(k=>caches.delete(k)));
  }

  if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn)); }
  render();
})();
