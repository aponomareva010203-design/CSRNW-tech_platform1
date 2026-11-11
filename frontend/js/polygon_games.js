/* ============================================================
   Игровые полигоны (polygons.html): движок и интерфейс симуляторов.
   Сценарии — js/polygon_games_data.js (window.AIOS_POLYGON_GAMES).

   - Пошаговые игры (kind 'turns'): ход = квартал/год. В начале хода —
     случайное событие (часто с выбором), затем участник выбирает до
     N решений (и/или распределяет бюджет ползунками), «Завершить ход»
     применяет решения и динамику, пишет журнал и графики.
   - Кейсы (kind 'cases'): ветвящиеся ситуации → профиль и архетип.
   - Код сессии задаёт зерно случайностей: у всех команд одной сессии
     одинаковые события. Итог команды отправляется в таблицу сессии:
     POST /api/polygons/games/results, таблица — GET .../leaderboard.
   - Незаконченная игра хранится в браузере (localStorage) и
     продолжается после перезагрузки страницы.
   ============================================================ */

(function () {
  var G = window.AIOS_POLYGON_GAMES;
  var grid = document.getElementById('pgsGrid');
  var work = document.getElementById('pgsWork');
  if (!G || !grid || !work) return;

  var API = window.AIOS_API;
  var $ = function (id) { return document.getElementById(id); };
  var SAVE_KEY = 'aios-pgs-v1:';
  var PREF_KEY = 'aios-pgs-pref-v1';
  var fmtMoney = G.fmtMoney, fmtNum = G.fmtNum;
  var BY_ID = {};
  G.games.forEach(function (g) { BY_ID[g.id] = g; });

  var cur = null;   // текущая партия
  var def = null;   // описание игры

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function token() {
    try { var s = JSON.parse(localStorage.getItem('aios-auth-v1') || 'null'); return s && s.token; } catch (e) { return null; }
  }
  function fmt(v, kind) {
    if (kind === 'money') return fmtMoney(v);
    if (kind === 'pct') return Math.round(v) + '%';
    return fmtNum(v);
  }

  /* ---------- повторяемые случайности ---------- */

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seedStr) {
    var a = hash(seedStr);
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seed(part) { return [cur.code || 'SOLO', cur.game, part, cur.t].join('|'); }

  /* ---------- сессия и команда ---------- */

  function prefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; }
  }
  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ code: $('pgsCode').value.trim(), team: $('pgsTeam').value.trim() })); } catch (e) { /* без сохранения */ }
  }
  function sessionCode() { return ($('pgsCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); }

  function persist() {
    if (!cur) return;
    try { localStorage.setItem(SAVE_KEY + cur.game + ':' + (cur.code || 'SOLO'), JSON.stringify(cur)); } catch (e) { /* без сохранения */ }
  }
  function loadSaved(gameId, code) {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY + gameId + ':' + (code || 'SOLO')) || 'null'); } catch (e) { return null; }
  }
  function dropSaved(gameId, code) {
    try { localStorage.removeItem(SAVE_KEY + gameId + ':' + (code || 'SOLO')); } catch (e) { /* ок */ }
  }

  /* ---------- карточки игр ---------- */

  function renderCards() {
    grid.innerHTML = '';
    G.games.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mdl-card imdl-card pgs-card';
      b.innerHTML =
        '<span class="mdl-card-top"><span class="mdl-kind">' + (g.kind === 'cases' ? 'кейс-тренажёр' : 'симулятор') + '</span>' +
        '<span class="mdl-status mdl-status--published">' + esc((g.tags || [])[0] || '') + '</span></span>' +
        '<span class="mdl-card-name">' + esc(g.title) + '</span>' +
        '<span class="pgs-card-role">' + esc(g.role) + '</span>' +
        '<span class="mdl-card-out">' + esc(g.summary) + '</span>' +
        '<span class="mdl-card-foot">' + esc((g.tags || []).slice(1).join(' · ')) + '</span>';
      b.addEventListener('click', function () { start(g.id); });
      grid.appendChild(b);
    });
  }

  function start(gameId) {
    savePrefs();
    var code = sessionCode();
    var saved = loadSaved(gameId, code);
    def = BY_ID[gameId];
    if (saved && !saved.finished && confirm('Есть незаконченная игра «' + BY_ID[gameId].title + '»' + (code ? ' в сессии ' + code : '') + '. Продолжить её?')) {
      cur = saved;
    } else {
      cur = newGame(gameId, code);
    }
    work.hidden = false;
    if (def.kind === 'cases' && !cur.track) renderTrackPick();
    else render();
    work.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function newGame(gameId, code) {
    var g = BY_ID[gameId];
    var c = { game: gameId, code: code, team: $('pgsTeam').value.trim(), t: 0, finished: false, journal: [], history: [] };
    if (g.kind === 'cases') {
      c.track = null; c.node = null; c.path = []; c.traits = {};
      return c;
    }
    c.s = g.init();
    if (g.allocations) c.s.alloc = Object.assign({}, g.defaultAlloc);
    c.selected = [];
    c.event = null;
    c.lastEvent = null;
    cur = c;
    snapshot();
    startTurn();
    return c;
  }

  /* ---------- пошаговая игра: ход ---------- */

  function logger(lines) { return function (text) { lines.push(text); }; }

  function snapshot() {
    var row = { t: cur.t };
    BY_ID[cur.game].charts.forEach(function (c) { row[c[0]] = cur.s[c[0]]; });
    cur.history.push(row);
  }

  function evText(ev) { return typeof ev.text === 'function' ? ev.text(cur.s) : ev.text; }

  function startTurn() {
    var g = BY_ID[cur.game];
    cur.selected = [];
    cur.event = null;
    var r = rng(seed('ev'));
    if (r() >= g.eventChance) return;
    var pool = g.events.filter(function (e) { return e.id !== cur.lastEvent && (!e.when || e.when(cur.s)); });
    var total = pool.reduce(function (a, e) { return a + (e.weight || 1); }, 0);
    var x = r() * total, ev = null;
    for (var i = 0; i < pool.length; i++) { x -= pool[i].weight || 1; if (x <= 0) { ev = pool[i]; break; } }
    if (!ev) return;
    cur.lastEvent = ev.id;
    var lines = [];
    if (ev.effect) ev.effect(cur.s, rng(seed('eve')), logger(lines));
    var entry = { t: cur.t, label: g.turnLabel(cur.t), title: '⚡ ' + ev.title, lines: [evText(ev)].concat(lines) };
    cur.journal.unshift(entry);
    if (ev.choices && ev.choices.length) cur.event = { id: ev.id, title: ev.title, text: evText(ev) };
  }

  function resolveEvent(i) {
    var g = def;
    var ev = g.events.filter(function (e) { return e.id === cur.event.id; })[0];
    var choice = ev && ev.choices[i];
    if (!choice) return;
    var lines = [];
    choice.effect(cur.s, rng(seed('evc')), logger(lines));
    cur.journal.unshift({ t: cur.t, label: g.turnLabel(cur.t), title: 'Решение: ' + choice.label, lines: lines });
    cur.event = null;
    var o = g.over(cur.s);
    if (o) { finish(o); return; }
    persist();
    render();
  }

  function costOf(id) {
    var a = def.actions.filter(function (x) { return x.id === id; })[0];
    return a ? a.cost || 0 : 0;
  }
  function selectedCost() { return cur.selected.reduce(function (s, id) { return s + costOf(id); }, 0); }
  function wallet() { return def.allocations ? cur.s.budget : cur.s.cash; }

  function toggleAction(id) {
    var i = cur.selected.indexOf(id);
    if (i >= 0) { cur.selected.splice(i, 1); render(); return; }
    if (cur.selected.length >= def.actionsPerTurn) { flash('За ход — не больше ' + def.actionsPerTurn + ' решений. Снимите одно из выбранных.'); return; }
    if (selectedCost() + costOf(id) > Math.max(0, wallet())) { flash('Не хватает денег на это решение вместе с уже выбранными.'); return; }
    cur.selected.push(id);
    render();
  }

  function endTurn() {
    if (cur.event) { flash('Сначала примите решение по событию.'); return; }
    var g = def;
    var r = rng(seed('fx'));
    var lines = [];
    var log = logger(lines);
    if (g.allocations) {
      var sum = g.allocations.reduce(function (s, a) { return s + (Number(cur.s.alloc[a[0]]) || 0); }, 0) || 1;
      g.allocations.forEach(function (a) { cur.s.alloc[a[0]] = Math.round((Number(cur.s.alloc[a[0]]) || 0) / sum * 100); });
      cur.s.spentInitiatives = selectedCost();
    } else {
      cur.s.cash -= selectedCost();
    }
    cur.selected.forEach(function (id) {
      var a = g.actions.filter(function (x) { return x.id === id; })[0];
      if (a) a.effect(cur.s, r, log);
    });
    if (!cur.selected.length) log(g.allocations ? 'Год без новых инициатив' : 'Ход без новых решений');
    g.tick(cur.s, r, log);
    cur.journal.unshift({ t: cur.t, label: g.turnLabel(cur.t), title: 'Итоги хода', lines: lines });
    cur.t += 1;
    snapshot();
    var o = g.over(cur.s);
    if (o) { finish(o); return; }
    if (cur.t >= g.turns) { finish(null); return; }
    startTurn();
    o = g.over(cur.s);
    if (o) { finish(o); return; }
    persist();
    render();
    var head = work.querySelector('.pgs-head');
    if (head) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function finish(over) {
    var res = def.finish(cur.s);
    cur.finished = true;
    cur.result = {
      score: res.score,
      outcome: over ? over.outcome : (res.outcome || 'draw'),
      text: over ? over.text : (res.text || 'Игра завершена: прошли все ходы.'),
      badges: res.badges || [],
      metrics: res.metrics || {}
    };
    persist();
    render();
  }

  /* ---------- отрисовка пошаговой игры ---------- */

  function flash(text, ok) {
    var m = $('pgsMsg');
    if (!m) return;
    m.textContent = text;
    m.classList.toggle('pg-msg--err', !ok);
  }

  function header(sub) {
    return '<div class="pgs-head"><div><div class="pgs-eyebrow">' + esc(def.kind === 'cases' ? 'Кейс-тренажёр' : 'Симулятор') +
      (cur.code ? ' · сессия ' + esc(cur.code) : ' · одиночная игра') + (cur.team ? ' · команда «' + esc(cur.team) + '»' : '') + '</div>' +
      '<h2 class="pgs-title">' + esc(def.title) + '</h2><p class="pgs-sub">' + sub + '</p></div>' +
      '<div class="pg-work-actions"><button class="btn-register pg-btn-quiet" type="button" data-pgs="restart">Начать заново</button>' +
      '<button class="btn-register pg-btn-quiet" type="button" data-pgs="close">Закрыть</button></div></div>' +
      '<p class="pg-msg" id="pgsMsg" role="status"></p>';
  }

  function render() {
    if (def.kind === 'cases') { renderCases(); return; }
    var g = def, s = cur.s;
    var html = header(cur.finished ? 'Игра завершена' : esc(g.turnLabel(cur.t)) + ' · ход ' + (cur.t + 1) + ' из ' + g.turns + ' · ' + esc(g.role));
    html += '<div class="pgs-progress"><span style="width:' + (Math.min(cur.t, g.turns) / g.turns * 100) + '%"></span></div>';
    html += '<div class="pgs-metrics">' + g.metrics.map(function (m) {
      var alert = m.alert && m.alert(s);
      return '<div class="kpi' + (alert ? ' kpi--alert' : '') + '"><div class="kpi-label">' + esc(m.title) + '</div>' +
        '<div class="kpi-value">' + esc(fmt(s[m.key], m.fmt)) + '</div><div class="kpi-note">' + esc(m.note ? m.note(s) : '') + '</div></div>';
    }).join('') + '</div>';

    html += '<div class="pg-grid2 pgs-grid">';
    html += '<div class="pg-col">';
    if (cur.finished) html += finalHtml();
    else if (cur.event) html += eventHtml();
    else html += decisionsHtml();
    html += '<details class="pg-details pgs-rules"><summary>Правила и цель</summary><p>' + esc(g.goals) + '</p></details>';
    html += '</div>';
    html += '<div class="pg-col">' + chartsHtml() + journalHtml() + '</div>';
    html += '</div>';
    work.innerHTML = html;
    bindWork();
    if (cur.finished) loadBoard();
  }

  function eventHtml() {
    var ev = def.events.filter(function (e) { return e.id === cur.event.id; })[0];
    return '<div class="pgs-event"><div class="pgs-event-tag">Событие</div><h3>' + esc(cur.event.title) + '</h3><p>' + esc(cur.event.text) + '</p>' +
      '<div class="pgs-choices">' + ev.choices.map(function (c, i) {
        return '<button type="button" class="btn-register" data-choice="' + i + '">' + esc(c.label) + '</button>';
      }).join('') + '</div></div>';
  }

  function decisionsHtml() {
    var g = def, s = cur.s, html = '';
    if (g.allocations) {
      var sum = g.allocations.reduce(function (a, x) { return a + (Number(s.alloc[x[0]]) || 0); }, 0);
      var spend = Math.max(0, s.budget - selectedCost());
      html += '<fieldset class="pg-box"><legend>Бюджет года: ' + esc(fmtMoney(s.budget)) + '</legend>' +
        '<p class="pg-hint">Распределите бюджет по направлениям. Сумма приводится к 100% при завершении хода. Инициатива оплачивается из того же бюджета.</p>' +
        g.allocations.map(function (a) {
          var v = Number(s.alloc[a[0]]) || 0;
          return '<label class="pgs-alloc"><span class="pgs-alloc-title">' + esc(a[1]) + '<small>' + esc(a[2]) + '</small></span>' +
            '<input type="range" min="0" max="60" step="5" value="' + v + '" data-alloc="' + a[0] + '">' +
            '<span class="pgs-alloc-val"><b>' + v + '%</b><small>' + esc(fmtMoney(spend * v / (sum || 1))) + '</small></span></label>';
        }).join('') +
        '<div class="pgs-alloc-sum' + (sum === 100 ? '' : ' is-off') + '">Сумма: ' + sum + '%' + (sum === 100 ? '' : ' — будет приведена к 100%') + '</div></fieldset>';
    }
    var n = cur.selected.length;
    html += '<fieldset class="pg-box"><legend>' + (g.allocations ? 'Инициатива года (не больше одной)' : 'Решения квартала: выбрано ' + n + ' из ' + g.actionsPerTurn) + '</legend>' +
      '<div class="pgs-actions">' + g.actions.map(function (a) {
        var av = a.available ? a.available(s) : true;
        var on = cur.selected.indexOf(a.id);
        var dis = av !== true;
        return '<button type="button" class="pgs-action' + (on >= 0 ? ' is-on' : '') + '" data-action="' + a.id + '"' + (dis ? ' disabled' : '') + '>' +
          (on >= 0 ? '<span class="pgs-ord">' + (on + 1) + '</span>' : '') +
          '<b>' + esc(a.title) + '</b><span class="pgs-cost">' + (a.cost ? esc(fmtMoney(a.cost)) : 'бесплатно') + '</span>' +
          '<span class="pgs-note">' + esc(dis ? '🔒 ' + av : a.note) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="pgs-endturn"><span>' + (g.allocations ? '' : 'Расходы на решения: <b>' + esc(fmtMoney(selectedCost())) + '</b> · после хода зарплаты и аренда') + '</span>' +
      '<button class="btn-primary" type="button" data-pgs="end">' + (cur.t + 1 >= g.turns ? 'Завершить последний ход' : 'Завершить ход →') + '</button></div></fieldset>';
    return html;
  }

  function spark(key, title, kind, color) {
    var pts = cur.history.map(function (h) { return Number(h[key]) || 0; });
    var w = 240, h = 64;
    var min = Math.min.apply(null, pts.concat([0])), max = Math.max.apply(null, pts.concat([1]));
    var span = max - min || 1;
    var step = pts.length > 1 ? w / (pts.length - 1) : w;
    var coords = pts.map(function (v, i) { return [Math.round(i * step * 10) / 10, Math.round((h - 4 - (v - min) / span * (h - 8)) * 10) / 10]; });
    var line = coords.map(function (c) { return c.join(','); }).join(' ');
    var zero = min < 0 ? '<line x1="0" x2="' + w + '" y1="' + (h - 4 - (0 - min) / span * (h - 8)) + '" y2="' + (h - 4 - (0 - min) / span * (h - 8)) + '" class="pgs-zero"></line>' : '';
    return '<div class="pgs-spark"><div class="pgs-spark-head"><span>' + esc(title) + '</span><b>' + esc(fmt(pts[pts.length - 1], kind)) + '</b></div>' +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' + zero +
      (pts.length > 1 ? '<polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.2" vector-effect="non-scaling-stroke"></polyline>' : '') +
      coords.map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="2.4" fill="' + color + '"></circle>'; }).join('') + '</svg></div>';
  }

  function chartsHtml() {
    var colors = ['var(--green)', 'var(--gold)', 'var(--amber)', 'var(--red)'];
    return '<fieldset class="pg-box"><legend>Динамика</legend><div class="pgs-sparks">' +
      def.charts.map(function (c, i) { return spark(c[0], c[1], c[2], colors[i % colors.length]); }).join('') + '</div></fieldset>';
  }

  function journalHtml() {
    return '<fieldset class="pg-box"><legend>Журнал решений и событий</legend><div class="pgs-journal">' +
      (cur.journal.length ? cur.journal.map(function (j) {
        return '<div class="pgs-j"><div class="pgs-j-head"><span>' + esc(j.label) + '</span><b>' + esc(j.title) + '</b></div>' +
          (j.lines.length ? '<ul>' + j.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      }).join('') : '<p class="pg-hint">Здесь появятся события и итоги каждого хода.</p>') + '</div></fieldset>';
  }

  /* ---------- итог и таблица сессии ---------- */

  var OUTCOME = { win: ['Победа', 'ok'], lose: ['Поражение', 'bad'], draw: ['Итог', 'warn'] };

  function finalHtml() {
    var r = cur.result;
    var o = OUTCOME[r.outcome] || OUTCOME.draw;
    var html = '<div class="pgs-final pgs-final--' + o[1] + '"><div class="pgs-event-tag">' + esc(o[0]) + '</div>' +
      '<h3>' + esc(r.text) + '</h3>' +
      (r.score != null ? '<div class="pgs-score"><b>' + esc(fmtNum(r.score)) + '</b><span>очков</span></div>' : '') +
      (r.badges.length ? '<div class="pgs-badges">' + r.badges.map(function (b) { return '<span class="pill pill--done">★ ' + esc(b) + '</span>'; }).join('') + '</div>' : '') +
      '<table class="pg-table pgs-res"><tbody>' + Object.keys(r.metrics).map(function (k) {
        var v = r.metrics[k];
        return '<tr><td>' + esc(k) + '</td><td class="num"><b>' + esc(typeof v === 'number' ? fmtNum(v) : v) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>';
    html += submitHtml();
    return html;
  }

  function submitHtml() {
    var canSend = !!cur.code;
    return '<fieldset class="pg-box"><legend>Таблица результатов сессии</legend>' +
      (canSend
        ? '<div class="pgs-submit"><label class="mdl-field"><span>Команда</span><input id="pgsTeamFinal" maxlength="60" value="' + esc(cur.team || $('pgsTeam').value || '') + '" placeholder="Название команды"></label>' +
          '<button class="btn-primary" type="button" data-pgs="submit"' + (cur.submitted ? ' disabled' : '') + '>' + (cur.submitted ? 'Результат отправлен' : 'Отправить результат') + '</button></div>' +
          '<div id="pgsBoard" class="pgs-board"><p class="pg-hint">Загрузка таблицы…</p></div>' +
          '<button class="btn-register pg-btn-small" type="button" data-pgs="board">Обновить таблицу</button>'
        : '<p class="pg-hint">Чтобы сравнить результаты команд, укажите код сессии над карточками игр (одинаковый у всех команд) и начните игру заново — у всех будут одни и те же события.</p>') +
      '</fieldset>';
  }

  function loadBoard() {
    var box = $('pgsBoard');
    if (!box || !cur.code || !API) return;
    API.request('GET', '/polygons/games/leaderboard?code=' + encodeURIComponent(cur.code) + '&game=' + encodeURIComponent(cur.game)).then(function (data) {
      var items = data.items || [];
      if (!items.length) { box.innerHTML = '<p class="pg-hint">В сессии ' + esc(cur.code) + ' пока нет результатов — будьте первыми.</p>'; return; }
      var isCases = def.kind === 'cases';
      box.innerHTML = '<div class="pg-table-wrap"><table class="pg-table"><thead><tr><th>#</th><th>Команда</th>' +
        (isCases ? '<th>Архетип</th>' : '<th class="num">Лучший</th><th class="num">Последний</th>') + '<th class="num">Попыток</th></tr></thead><tbody>' +
        items.map(function (it, i) {
          var mine = cur.team && String(it.team).toLowerCase() === String(cur.team).toLowerCase();
          return '<tr' + (mine ? ' class="pgs-mine"' : '') + '><td>' + (i + 1) + '</td><td><b>' + esc(it.team) + '</b>' +
            (isCases ? '' : '<div class="cell-sub">' + esc(it.outcome) + '</div>') + '</td>' +
            (isCases ? '<td>' + esc(it.outcome) + '</td>' : '<td class="num"><b>' + esc(fmtNum(it.best)) + '</b></td><td class="num">' + esc(fmtNum(it.score)) + '</td>') +
            '<td class="num">' + esc(it.attempts) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).catch(function () { box.innerHTML = '<p class="pg-hint">Не удалось загрузить таблицу.</p>'; });
  }

  function submit() {
    var team = ($('pgsTeamFinal') && $('pgsTeamFinal').value.trim()) || '';
    if (!team) { flash('Укажите название команды'); return; }
    if (!token()) { flash('Чтобы отправить результат, войдите на платформу (кнопка «Войти» внизу меню).'); return; }
    cur.team = team;
    $('pgsTeam').value = team;
    savePrefs();
    var r = cur.result;
    var o = OUTCOME[r.outcome] || OUTCOME.draw;
    var payload = {
      code: cur.code, game: cur.game, team: team, score: r.score || 0,
      outcome: def.kind === 'cases' ? r.archetype : o[0] + ': ' + r.text,
      metrics: r.metrics
    };
    API.request('POST', '/polygons/games/results', payload, token()).then(function () {
      cur.submitted = true;
      persist();
      flash('Результат команды отправлен в таблицу сессии ' + cur.code, true);
      var btn = work.querySelector('[data-pgs="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Результат отправлен'; }
      loadBoard();
    }).catch(function (err) { flash('Не удалось отправить: ' + ((err && err.message) || 'ошибка')); });
  }

  /* ---------- кейс-тренажёр ---------- */

  function renderTrackPick() {
    work.innerHTML = header(esc(def.role)) +
      '<p class="section-lead pgs-lead">' + esc(def.summary) + '</p>' +
      '<div class="mdl-grid pgs-tracks">' + def.tracks.map(function (t) {
        return '<button type="button" class="mdl-card imdl-card" data-track="' + t.id + '"><span class="mdl-card-name">' + esc(t.title) + '</span>' +
          '<span class="mdl-card-out">' + Object.keys(t.nodes).length + ' ситуаций с ветвлениями</span></button>';
      }).join('') + '</div>';
    bindWork();
  }

  function track() { return def.tracks.filter(function (t) { return t.id === cur.track; })[0]; }

  function profile() {
    var steps = Math.max(1, cur.path.length);
    var v = {};
    def.traits.forEach(function (t) { v[t[0]] = Math.max(-1, Math.min(1, (cur.traits[t[0]] || 0) / steps)); });
    var norm = function (o) { return Math.sqrt(def.traits.reduce(function (s, t) { return s + Math.pow(o[t[0]] || 0, 2); }, 0)) || 1; };
    var ranked = def.archetypes.map(function (a) {
      var dot = def.traits.reduce(function (s, t) { return s + (v[t[0]] || 0) * (a.v[t[0]] || 0); }, 0);
      return { a: a, match: Math.round(Math.max(0, dot / (norm(v) * norm(a.v))) * 100) };
    }).sort(function (x, y) { return y.match - x.match; });
    return { v: v, ranked: ranked };
  }

  function renderCases() {
    var tr = track();
    var node = tr.nodes[cur.node];
    var html = header(esc(tr.title) + (cur.finished ? ' · профиль готов' : ' · ситуация ' + (cur.path.length + 1)));
    html += '<div class="pg-grid2 pgs-grid"><div class="pg-col">';
    if (cur.finished) {
      var p = profile();
      var top = p.ranked[0];
      html += '<div class="pgs-final pgs-final--ok"><div class="pgs-event-tag">Ваш архетип</div><h3>' + esc(top.a.title) + ' · совпадение ' + top.match + '%</h3>' +
        '<p>' + esc(top.a.text) + '</p>' +
        '<div class="pgs-two"><div><b>Сильные стороны</b><ul>' + top.a.strengths.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><b>Зоны роста</b><ul>' + top.a.growth.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>' +
        '<p class="pg-hint">Также близко: ' + p.ranked.slice(1, 3).map(function (x) { return esc(x.a.title) + ' (' + x.match + '%)'; }).join(', ') + '</p></div>';
      html += submitHtml();
    } else {
      html += '<div class="pgs-event"><div class="pgs-event-tag">Ситуация</div><h3>' + esc(node.title) + '</h3><p>' + esc(node.text) + '</p>' +
        '<div class="pgs-choices pgs-choices--col">' + node.choices.map(function (c, i) {
          return '<button type="button" class="btn-register" data-case="' + i + '">' + esc(c.label) + '</button>';
        }).join('') + '</div><p class="pg-hint">Правильных ответов нет — выбирайте так, как поступили бы на самом деле.</p></div>';
    }
    html += '</div><div class="pg-col">';
    var pr = profile();
    html += '<fieldset class="pg-box"><legend>Профиль' + (cur.finished ? '' : ' (складывается по ходу)') + '</legend>' +
      def.traits.map(function (t) {
        var x = pr.v[t[0]] || 0;
        var left = x < 0 ? 50 + x * 50 : 50, width = Math.abs(x) * 50;
        return '<div class="pgs-trait"><div class="pgs-trait-labels"><span>' + esc(t[2]) + '</span><span>' + esc(t[1]) + '</span></div>' +
          '<div class="pgs-trait-track"><i></i><span style="left:' + left + '%;width:' + width + '%"></span></div></div>';
      }).join('') + '</fieldset>';
    html += '<fieldset class="pg-box"><legend>Ваш путь</legend><div class="pgs-journal">' +
      (cur.path.length ? cur.path.slice().reverse().map(function (st) {
        return '<div class="pgs-j"><div class="pgs-j-head"><b>' + esc(st.title) + '</b></div><ul><li>' + esc(st.label) + '</li>' + (st.c ? '<li class="pgs-cons">→ ' + esc(st.c) + '</li>' : '') + '</ul></div>';
      }).join('') : '<p class="pg-hint">Здесь появятся ваши решения и их последствия.</p>') + '</div></fieldset>';
    html += '</div></div>';
    work.innerHTML = html;
    bindWork();
    if (cur.finished) loadBoard();
  }

  function chooseCase(i) {
    var tr = track();
    var node = tr.nodes[cur.node];
    var c = node.choices[i];
    if (!c) return;
    Object.keys(c.t).forEach(function (k) { cur.traits[k] = (cur.traits[k] || 0) + c.t[k]; });
    cur.path.push({ node: cur.node, title: node.title, label: c.label, c: c.c });
    if (c.next && tr.nodes[c.next]) {
      cur.node = c.next;
    } else {
      cur.finished = true;
      var p = profile();
      var metrics = {};
      def.traits.forEach(function (t) {
        var x = p.v[t[0]] || 0;
        metrics[x >= 0 ? t[1] : t[2]] = Math.round(Math.abs(x) * 100) + '%';
      });
      cur.result = { score: p.ranked[0].match, archetype: p.ranked[0].a.title + ' (' + tr.title + ')', metrics: metrics, badges: [], outcome: 'draw', text: '' };
    }
    persist();
    renderCases();
  }

  /* ---------- события интерфейса ---------- */

  function bindWork() {
    work.querySelectorAll('[data-pgs]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-pgs');
        if (act === 'close') { work.hidden = true; $('pgsGames').scrollIntoView({ behavior: 'smooth' }); }
        if (act === 'restart') {
          if (!cur.finished && !confirm('Начать игру заново? Текущий прогресс пропадёт.')) return;
          dropSaved(cur.game, cur.code);
          var id = cur.game;
          cur = newGame(id, sessionCode());
          if (def.kind === 'cases') renderTrackPick(); else render();
        }
        if (act === 'end') endTurn();
        if (act === 'submit') submit();
        if (act === 'board') loadBoard();
      });
    });
    work.querySelectorAll('[data-choice]').forEach(function (b) {
      b.addEventListener('click', function () { resolveEvent(Number(b.getAttribute('data-choice'))); });
    });
    work.querySelectorAll('[data-action]').forEach(function (b) {
      b.addEventListener('click', function () { toggleAction(b.getAttribute('data-action')); });
    });
    work.querySelectorAll('[data-alloc]').forEach(function (inp) {
      /* во время перетаскивания обновляем только подписи, по отпусканию — всю панель */
      inp.addEventListener('input', function () {
        cur.s.alloc[inp.getAttribute('data-alloc')] = Number(inp.value);
        var val = inp.parentNode.querySelector('.pgs-alloc-val b');
        if (val) val.textContent = inp.value + '%';
        var sum = def.allocations.reduce(function (a, x) { return a + (Number(cur.s.alloc[x[0]]) || 0); }, 0);
        var box = work.querySelector('.pgs-alloc-sum');
        if (box) {
          box.textContent = 'Сумма: ' + sum + '%' + (sum === 100 ? '' : ' — будет приведена к 100%');
          box.classList.toggle('is-off', sum !== 100);
        }
      });
      inp.addEventListener('change', function () {
        persist();
        var scroll = window.scrollY;
        render();
        window.scrollTo(0, scroll);
      });
    });
    work.querySelectorAll('[data-track]').forEach(function (b) {
      b.addEventListener('click', function () {
        cur.track = b.getAttribute('data-track');
        cur.node = track().start;
        persist();
        renderCases();
      });
    });
    work.querySelectorAll('[data-case]').forEach(function (b) {
      b.addEventListener('click', function () { chooseCase(Number(b.getAttribute('data-case'))); });
    });
  }

  var p = prefs();
  if (p.code) $('pgsCode').value = p.code;
  if (p.team) $('pgsTeam').value = p.team;
  $('pgsCode').addEventListener('change', function () { $('pgsCode').value = sessionCode(); savePrefs(); });
  $('pgsTeam').addEventListener('change', savePrefs);
  renderCards();
})();
