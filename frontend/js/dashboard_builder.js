/* ============================================================
   Конструктор дашборда (index.html, «Рабочий стол»).

   Каждый участник проектной сессии собирает дашборд под себя:
     - шаблоны по ролям (проректор, ЦТТ, акселератор, финансы, пустой лист);
     - плитки KPI: какие показывать и в каком порядке;
     - готовые виджеты (портфель по УГТ, цепочка финансирования, РИД,
       команды, трекер обязательств) — добавить, убрать, переименовать;
     - свои виджеты: график, показатель, цель, таблица, заметка — по
       любому набору данных из data/dashboard.json и любому его полю;
     - порядок (перетаскивание за ⠿ или стрелки) и размер (S/M/L/XL);
     - несколько своих дашбордов, экспорт/импорт раскладки в JSON.

   Хранение: вошедший участник — на платформе (GET/PUT /api/dashboards,
   api/runtime/dashboards.py), гость — в этом браузере (localStorage).
   Данные — через мост window.AIOS_DASH из js/dashboard.js.
   ============================================================ */

(function () {
  var D = window.AIOS_DASH;
  var grid = document.querySelector('#dashboard .dash-grid');
  if (!D || !grid) return;

  var API = window.AIOS_API;
  var LOCAL_KEY = 'aios-dash-layouts-v1';
  var AUTH_KEY = 'aios-auth-v1';
  var esc = D.esc;

  /* ---------- готовые виджеты (разметка в index.html) ---------- */

  var BUILTINS = [
    { id: 'wTrl', title: 'Портфель проектов по УГТ', note: 'Столбцы УГТ 1–9, кандидаты на закрытие, таблица проектов', size: 'xl' },
    { id: 'wFunding', title: 'Цепочка финансирования', note: 'РНФ → Гранты → Стартап-студия → Венчур, конверсия стадий', size: 'xl' },
    { id: 'wPatents', title: 'Патенты и РИД', note: 'Перспективность и затраты на поддержку', size: 'm' },
    { id: 'wTeams', title: 'Стартап-коллективы', note: 'Команды по источнику финансирования', size: 'm' },
    { id: 'wVenture', title: 'Венчурный билдер: трекер обязательств', note: 'Обязательства стартапов, сроки и статусы', size: 'xl' }
  ];
  var BUILTIN_BY_ID = {};
  BUILTINS.forEach(function (b) { BUILTIN_BY_ID[b.id] = b; });

  var CUSTOM = [
    { type: 'chart', title: 'График', note: 'Столбцы, полосы или кольцо по любому полю', size: 'm' },
    { type: 'metric', title: 'Показатель', note: 'Одно число: количество, сумма, среднее', size: 's' },
    { type: 'goal', title: 'Цель', note: 'Факт против цели с прогресс-баром', size: 's' },
    { type: 'table', title: 'Таблица', note: 'Свой набор столбцов, сортировка, фильтр', size: 'l' },
    { type: 'note', title: 'Заметка', note: 'Цели команды, договорённости, выводы', size: 's' }
  ];
  var CUSTOM_BY_TYPE = {};
  CUSTOM.forEach(function (c) { CUSTOM_BY_TYPE[c.type] = c; });

  var SIZES = [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']];
  var SIZE_TITLES = { s: 'треть ширины', m: 'половина', l: 'две трети', xl: 'вся ширина' };

  /* ---------- наборы данных и поля ---------- */

  /* kind: cat — категория (можно группировать), num — число,
     money — сумма в тыс. ₽, text — длинный текст, date — дата */
  var DATASETS = {
    projects: {
      title: 'Проекты портфеля', key: 'projects',
      fields: {
        title: ['Проект', 'text'], id: ['Код', 'text'], department: ['Подразделение', 'cat'],
        trl: ['УГТ', 'num', true], funding_stage: ['Стадия финансирования', 'cat'],
        budget: ['Бюджет', 'money'], _years: ['Лет на текущем УГТ', 'num'], _state: ['Статус', 'cat'],
        trl_since: ['На уровне с', 'date']
      }
    },
    patents: {
      title: 'Патенты и РИД', key: 'patents',
      fields: {
        title: ['РИД', 'text'], id: ['Номер', 'text'], type: ['Тип', 'cat'], year: ['Год', 'num', true],
        department: ['Подразделение', 'cat'], perspective: ['Перспективность', 'cat'],
        support_cost: ['Поддержка в год', 'money'], licensee: ['Лицензиат', 'cat'], _licensed: ['Лицензия', 'cat']
      }
    },
    teams: {
      title: 'Стартап-коллективы', key: 'teams',
      fields: {
        name: ['Команда', 'text'], funding: ['Финансирование', 'cat'], members: ['Участников', 'num', true],
        project: ['Проект', 'cat']
      }
    },
    venture_tracker: {
      title: 'Трекер обязательств', key: 'venture_tracker',
      fields: {
        startup: ['Стартап', 'cat'], owner: ['Ответственный', 'cat'], commitment: ['Обязательство', 'text'],
        due: ['Срок', 'date'], progress: ['Выполнение, %', 'num'], _status: ['Статус', 'cat']
      }
    }
  };

  function fieldKind(ds, f) { var x = DATASETS[ds] && DATASETS[ds].fields[f]; return x ? x[1] : 'text'; }
  function fieldTitle(ds, f) { var x = DATASETS[ds] && DATASETS[ds].fields[f]; return x ? x[0] : f; }
  function groupable(ds, f) {
    var x = DATASETS[ds] && DATASETS[ds].fields[f];
    return !!x && (x[1] === 'cat' || x[2] === true);
  }
  function numeric(ds, f) { var k = fieldKind(ds, f); return k === 'num' || k === 'money'; }

  /* Строки набора с вычисленными полями и человекочитаемыми значениями */
  function rows(ds) {
    var list = D.arr(DATASETS[ds] ? DATASETS[ds].key : ds);
    var stages = D.stageTitles();
    var projects = {};
    D.arr('projects').forEach(function (p) { projects[p.id] = p; });
    var funding = {};
    D.teamFundingTitles.forEach(function (f) { funding[f.key] = f.title; });
    return list.map(function (r) {
      var o = Object.assign({}, r);
      if (ds === 'projects') {
        o._years = Math.round(D.yearsOnLevel(r) * 10) / 10;
        o._state = D.isStale(r) ? 'Кандидат на закрытие' : 'В развитии';
        o.funding_stage = stages[r.funding_stage] || r.funding_stage || '—';
      } else if (ds === 'patents') {
        o.perspective = D.perspectiveTitles[r.perspective] || r.perspective || '—';
        o._licensed = r.licensee ? 'Есть лицензиат' : 'Без лицензии';
        o.licensee = r.licensee || 'нет';
      } else if (ds === 'teams') {
        o.funding = funding[r.funding] || r.funding || '—';
        o.project = projects[r.project] ? projects[r.project].title : (r.project || '—');
      } else if (ds === 'venture_tracker') {
        o._status = D.ventureStatusTitles[D.ventureStatus(r)] || '—';
      }
      return o;
    });
  }

  function applyFilter(list, cfg) {
    if (!cfg.filterField || cfg.filterValue == null || cfg.filterValue === '') return list;
    return list.filter(function (r) { return String(r[cfg.filterField]) === String(cfg.filterValue); });
  }

  function aggregate(list, agg, field) {
    if (agg === 'count' || !field) return list.length;
    var nums = list.map(function (r) { return Number(r[field]); }).filter(function (x) { return !isNaN(x); });
    if (!nums.length) return 0;
    var sum = nums.reduce(function (a, b) { return a + b; }, 0);
    if (agg === 'sum') return sum;
    if (agg === 'avg') return sum / nums.length;
    if (agg === 'min') return Math.min.apply(null, nums);
    if (agg === 'max') return Math.max.apply(null, nums);
    return list.length;
  }

  var AGGS = { count: 'Количество', sum: 'Сумма', avg: 'Среднее', min: 'Минимум', max: 'Максимум' };

  function fmtValue(v, ds, field, agg) {
    if (agg !== 'count' && fieldKind(ds, field) === 'money') return D.money(v);
    return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 });
  }

  function cellValue(r, ds, f) {
    var k = fieldKind(ds, f);
    if (k === 'money') return D.money(r[f]);
    if (k === 'date') return D.fmtDate(r[f]);
    return esc(r[f] == null || r[f] === '' ? '—' : r[f]);
  }

  /* ---------- шаблоны по ролям ---------- */

  var uid = function () { return 'c' + Math.random().toString(36).slice(2, 9); };

  function w(type, size, title, cfg, id) {
    return { id: id || uid(), type: type, size: size, title: title || '', cfg: cfg || {} };
  }

  var PRESETS = [
    {
      id: 'rector', title: 'Проректор по инновациям', note: 'Весь портфель: УГТ, финансирование, РИД, команды, обязательства',
      make: function () {
        return {
          name: 'Проректор по инновациям', kpis: D.defaultKpis.slice(),
          widgets: BUILTINS.map(function (b) { return w('builtin', b.size, '', {}, b.id); })
        };
      }
    },
    {
      id: 'ctt', title: 'Центр трансфера технологий', note: 'РИД, лицензии, затраты на поддержку, перспективность',
      make: function () {
        return {
          name: 'ЦТТ: портфель РИД', kpis: ['patents', 'licensed', 'rid_cost'],
          widgets: [
            w('builtin', 'xl', '', {}, 'wPatents'),
            w('chart', 'm', 'Затраты на поддержку РИД по подразделениям', { dataset: 'patents', groupBy: 'department', agg: 'sum', field: 'support_cost', view: 'bars', top: 8 }),
            w('chart', 'm', 'РИД по типам', { dataset: 'patents', groupBy: 'type', agg: 'count', view: 'donut' }),
            w('goal', 's', 'Лицензионные договоры', { dataset: 'patents', agg: 'count', filterField: '_licensed', filterValue: 'Есть лицензиат', target: 8, deadline: 'к концу года' }),
            w('metric', 's', 'Поддержка РИД с низкой перспективностью', { dataset: 'patents', agg: 'sum', field: 'support_cost', filterField: 'perspective', filterValue: 'Низкая', note: 'кандидаты на отказ от поддержки' }),
            w('note', 's', 'Задачи ЦТТ', { text: '- Провести аудит РИД с низкой перспективностью\n- Найти лицензиатов для 3 патентов\n- Подготовить витрину технологий' })
          ]
        };
      }
    },
    {
      id: 'accel', title: 'Акселератор и венчурный билдер', note: 'Стартапы, команды, обязательства и их выполнение',
      make: function () {
        return {
          name: 'Акселератор', kpis: ['teams', 'overdue', 'venture_done', 'late_trl'],
          widgets: [
            w('builtin', 'xl', '', {}, 'wVenture'),
            w('chart', 'm', 'Обязательства по статусам', { dataset: 'venture_tracker', groupBy: '_status', agg: 'count', view: 'donut' }),
            w('chart', 'm', 'Средний прогресс по ответственным', { dataset: 'venture_tracker', groupBy: 'owner', agg: 'avg', field: 'progress', view: 'bars' }),
            w('builtin', 'l', '', {}, 'wTeams'),
            w('metric', 's', 'Людей в стартап-командах', { dataset: 'teams', agg: 'sum', field: 'members', note: 'суммарно по коллективам' })
          ]
        };
      }
    },
    {
      id: 'finance', title: 'Финансы портфеля', note: 'Куда идут деньги: бюджеты по стадиям, подразделениям, УГТ',
      make: function () {
        return {
          name: 'Финансы портфеля', kpis: ['budget', 'rid_cost', 'stale', 'valley'],
          widgets: [
            w('builtin', 'xl', '', {}, 'wFunding'),
            w('chart', 'm', 'Бюджет по стадиям финансирования', { dataset: 'projects', groupBy: 'funding_stage', agg: 'sum', field: 'budget', view: 'columns' }),
            w('chart', 'm', 'Бюджет по УГТ', { dataset: 'projects', groupBy: 'trl', agg: 'sum', field: 'budget', view: 'columns' }),
            w('table', 'l', 'Крупнейшие проекты', { dataset: 'projects', columns: ['title', 'trl', 'funding_stage', 'budget'], sortBy: 'budget', desc: true, limit: 6 }),
            w('metric', 's', 'Бюджет кандидатов на закрытие', { dataset: 'projects', agg: 'sum', field: 'budget', filterField: '_state', filterValue: 'Кандидат на закрытие', note: 'можно перераспределить' })
          ]
        };
      }
    },
    {
      id: 'empty', title: 'Пустой лист', note: 'Соберите всё сами из библиотеки виджетов',
      make: function () {
        return {
          name: 'Мой дашборд', kpis: [],
          widgets: [w('note', 'xl', 'С чего начать', { text: 'Нажмите «Настроить дашборд» и добавьте виджеты из библиотеки.\n- График — распределение по любому полю\n- Показатель и Цель — ключевые числа\n- Таблица — свой срез данных' })]
        };
      }
    }
  ];

  function presetLayout(id) {
    var p = PRESETS.filter(function (x) { return x.id === id; })[0] || PRESETS[0];
    var lay = p.make();
    lay.id = 'd-' + Math.random().toString(16).slice(2, 10);
    return lay;
  }

  /* ---------- состояние и хранение ---------- */

  var st = { bundle: null, edit: false, remote: false, saveTimer: null, dragId: null };

  function session() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; }
  }
  function token() { var s = session(); return s && s.token; }
  function localKey() { var s = session(); return LOCAL_KEY + ':' + ((s && s.login) || 'guest'); }

  function readLocal() {
    try {
      var raw = localStorage.getItem(localKey()) || localStorage.getItem(LOCAL_KEY + ':guest');
      var b = raw ? JSON.parse(raw) : null;
      return b && Array.isArray(b.layouts) && b.layouts.length ? b : null;
    } catch (e) { return null; }
  }
  function writeLocal() {
    try { localStorage.setItem(localKey(), JSON.stringify(st.bundle)); } catch (e) { /* приватный режим */ }
  }

  function layout() {
    var b = st.bundle;
    return b.layouts.filter(function (l) { return l.id === b.active; })[0] || b.layouts[0];
  }

  function status(text) { var el = document.getElementById('dbSaved'); if (el) el.textContent = text; }

  function save() {
    writeLocal();
    clearTimeout(st.saveTimer);
    if (!st.remote) {
      status(token() ? 'Сохранено в этом браузере (платформа недоступна)' : 'Сохранено в этом браузере · войдите, чтобы дашборд был с вами на любом компьютере');
      return;
    }
    status('Сохраняю…');
    st.saveTimer = setTimeout(function () {
      API.request('PUT', '/dashboards', st.bundle, token()).then(function () {
        status('Сохранено на платформе · ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
      }).catch(function (err) {
        status('Не удалось сохранить на платформе: ' + ((err && err.message) || 'ошибка') + ' — копия есть в браузере');
      });
    }, 600);
  }

  function load() {
    var local = readLocal();
    var fallback = function () {
      st.remote = false;
      st.bundle = local || (function () { var l = presetLayout('rector'); return { active: l.id, layouts: [l] }; })();
      apply();
      status(token() ? 'Дашборд хранится в этом браузере' : 'Дашборд хранится в этом браузере · войдите, чтобы сохранить его на платформе');
    };
    if (!API || !token()) { fallback(); return; }
    API.request('GET', '/dashboards', undefined, token()).then(function (data) {
      st.remote = true;
      if (data && Array.isArray(data.layouts) && data.layouts.length) {
        st.bundle = data;
        apply();
        status('Дашборд сохранён на платформе');
      } else {
        st.bundle = local || (function () { var l = presetLayout('rector'); return { active: l.id, layouts: [l] }; })();
        apply();
        save();
      }
    }).catch(fallback);
  }

  /* ---------- отрисовка раскладки ---------- */

  function sizeClass(size) { return 'db-size-' + (SIZE_TITLES[size] ? size : 'm'); }

  function articleFor(wd) {
    if (wd.type === 'builtin') return document.getElementById(wd.id);
    var art = document.getElementById('dbw-' + wd.id);
    if (!art) {
      art = document.createElement('article');
      art.className = 'widget db-custom db-custom--' + wd.type;
      art.id = 'dbw-' + wd.id;
      art.innerHTML = '<header class="widget-head"><div><h2></h2><p class="widget-sub"></p></div></header><div class="db-body"></div>';
    }
    return art;
  }

  function apply() {
    var lay = layout();
    if (!lay) return;
    grid.classList.add('db-grid');
    document.getElementById('dashboard').classList.toggle('db-editing', st.edit);
    D.kpiKeys = lay.kpis || [];
    D.renderKpi();

    var present = {};
    lay.widgets.forEach(function (wd) { present[wd.type === 'builtin' ? wd.id : 'dbw-' + wd.id] = true; });
    BUILTINS.forEach(function (b) {
      var a = document.getElementById(b.id);
      if (a) a.hidden = !present[b.id];
    });
    grid.querySelectorAll('.db-custom, .db-empty').forEach(function (a) {
      if (!present[a.id]) a.parentNode.removeChild(a);
    });

    lay.widgets.forEach(function (wd) {
      var art = articleFor(wd);
      if (!art) return;
      art.classList.remove('widget--wide', 'db-size-s', 'db-size-m', 'db-size-l', 'db-size-xl');
      art.classList.add(sizeClass(wd.size));
      art.setAttribute('data-db-id', wd.id);
      if (wd.type === 'builtin') {
        var h2 = art.querySelector('.widget-head h2');
        if (h2) {
          if (!h2.hasAttribute('data-db-orig')) h2.setAttribute('data-db-orig', h2.textContent);
          h2.textContent = wd.title || h2.getAttribute('data-db-orig');
        }
      }
      grid.appendChild(art);
      renderCustom(wd, art);
      tools(wd, art);
    });

    if (!lay.widgets.length) {
      var empty = document.createElement('article');
      empty.className = 'widget db-empty db-size-xl';
      empty.id = 'dbEmpty';
      empty.innerHTML = '<p>На этом дашборде пока нет виджетов. Нажмите <b>«Настроить дашборд»</b> и выберите их в библиотеке или возьмите шаблон своей роли.</p>';
      grid.appendChild(empty);
    }
    renderBar();
    if (st.edit) renderPanel();
  }

  function renderCustom(wd, art) {
    if (wd.type === 'builtin') return;
    var head = art.querySelector('.widget-head h2');
    var sub = art.querySelector('.widget-head .widget-sub');
    var body = art.querySelector('.db-body');
    var cfg = wd.cfg || {};
    head.textContent = wd.title || CUSTOM_BY_TYPE[wd.type].title;
    sub.textContent = describe(wd);
    try {
      if (wd.type === 'chart') body.innerHTML = renderChart(cfg);
      else if (wd.type === 'metric') body.innerHTML = renderMetric(cfg);
      else if (wd.type === 'goal') body.innerHTML = renderGoal(cfg);
      else if (wd.type === 'table') body.innerHTML = renderTable(cfg);
      else if (wd.type === 'note') body.innerHTML = renderNote(cfg);
    } catch (e) {
      body.innerHTML = '<p class="db-warn">Не удалось построить виджет — проверьте настройки (⚙).</p>';
    }
    bindTips(body);
  }

  function describe(wd) {
    var c = wd.cfg || {};
    if (wd.type === 'note') return '';
    if (!DATASETS[c.dataset]) return 'Настройте виджет';
    var parts = [DATASETS[c.dataset].title];
    if (wd.type === 'chart' && c.groupBy) parts.push((AGGS[c.agg] || 'Количество').toLowerCase() + (c.agg && c.agg !== 'count' && c.field ? ' «' + fieldTitle(c.dataset, c.field) + '»' : '') + ' по полю «' + fieldTitle(c.dataset, c.groupBy) + '»');
    if (c.filterField && c.filterValue !== '' && c.filterValue != null) parts.push(fieldTitle(c.dataset, c.filterField) + ' = ' + c.filterValue);
    return parts.join(' · ');
  }

  /* --- график --- */

  var PALETTE = ['var(--db-c1)', 'var(--db-c2)', 'var(--db-c3)', 'var(--db-c4)', 'var(--db-c5)', 'var(--db-c6)', 'var(--db-c7)', 'var(--db-c8)'];

  function groups(cfg) {
    var ds = cfg.dataset;
    var list = applyFilter(rows(ds), cfg);
    var map = {}, order = [];
    list.forEach(function (r) {
      var k = r[cfg.groupBy];
      k = k == null || k === '' ? '—' : String(k);
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(r);
    });
    var out = order.map(function (k) { return { key: k, value: aggregate(map[k], cfg.agg || 'count', cfg.field), n: map[k].length }; });
    if (fieldKind(ds, cfg.groupBy) === 'num') out.sort(function (a, b) { return Number(a.key) - Number(b.key); });
    else out.sort(function (a, b) { return b.value - a.value; });
    var top = Number(cfg.top) || 0;
    if (top > 0 && out.length > top) {
      var rest = out.slice(top);
      out = out.slice(0, top);
      var restVal = cfg.agg === 'avg' || cfg.agg === 'min' || cfg.agg === 'max' ? null : rest.reduce(function (s, g) { return s + g.value; }, 0);
      if (restVal !== null) out.push({ key: 'Остальные (' + rest.length + ')', value: restVal, n: rest.reduce(function (s, g) { return s + g.n; }, 0) });
    }
    return out;
  }

  function tipAttr(g, cfg) {
    return ' data-db-tip="' + esc('<b>' + esc(g.key) + '</b><br>' + fmtValue(g.value, cfg.dataset, cfg.field, cfg.agg) + ' · записей: ' + g.n) + '"';
  }

  function renderChart(cfg) {
    if (!DATASETS[cfg.dataset] || !cfg.groupBy) return '<p class="db-warn">Выберите набор данных и поле группировки (⚙).</p>';
    var gs = groups(cfg);
    if (!gs.length) return '<p class="db-warn">Нет данных по выбранному фильтру.</p>';
    var max = Math.max.apply(null, gs.map(function (g) { return Math.abs(g.value); }).concat([1e-9]));
    var view = cfg.view || 'bars';
    if (view === 'donut') return renderDonut(gs, cfg);
    if (view === 'columns') {
      return '<div class="db-cols">' + gs.map(function (g, i) {
        return '<div class="db-col"' + tipAttr(g, cfg) + '><span class="db-col-val">' + fmtValue(g.value, cfg.dataset, cfg.field, cfg.agg) + '</span>' +
          '<span class="db-col-bar" style="height:' + Math.max(2, g.value / max * 100) + '%;background:' + PALETTE[i % PALETTE.length] + '"></span>' +
          '<span class="db-col-key">' + esc(g.key) + '</span></div>';
      }).join('') + '</div>';
    }
    return '<div class="db-bars">' + gs.map(function (g, i) {
      return '<div class="db-bar-row"' + tipAttr(g, cfg) + '><span class="db-bar-key">' + esc(g.key) + '</span>' +
        '<span class="db-bar-track"><span style="width:' + Math.max(1, g.value / max * 100) + '%;background:' + PALETTE[i % PALETTE.length] + '"></span></span>' +
        '<span class="db-bar-val">' + fmtValue(g.value, cfg.dataset, cfg.field, cfg.agg) + '</span></div>';
    }).join('') + '</div>';
  }

  function renderDonut(gs, cfg) {
    var total = gs.reduce(function (s, g) { return s + Math.max(0, g.value); }, 0) || 1;
    var r = 52, c = 2 * Math.PI * r, off = 0;
    var arcs = gs.map(function (g, i) {
      var len = Math.max(0, g.value) / total * c;
      var a = '<circle r="' + r + '" cx="70" cy="70" fill="none" stroke="' + PALETTE[i % PALETTE.length] + '" stroke-width="22" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '"' + tipAttr(g, cfg) + '></circle>';
      off += len;
      return a;
    }).join('');
    var totalTxt = cfg.agg === 'avg' ? '' : fmtValue(total, cfg.dataset, cfg.field, cfg.agg);
    return '<div class="db-donut"><svg viewBox="0 0 140 140" role="img" aria-label="Кольцевая диаграмма"><g transform="rotate(-90 70 70)">' + arcs + '</g>' +
      '<text x="70" y="75" text-anchor="middle" class="db-donut-total">' + esc(totalTxt) + '</text></svg>' +
      '<ul class="db-legend">' + gs.map(function (g, i) {
        return '<li' + tipAttr(g, cfg) + '><i style="background:' + PALETTE[i % PALETTE.length] + '"></i>' + esc(g.key) +
          ' <b>' + fmtValue(g.value, cfg.dataset, cfg.field, cfg.agg) + '</b> <span>' + Math.round(Math.max(0, g.value) / total * 100) + '%</span></li>';
      }).join('') + '</ul></div>';
  }

  /* --- показатель, цель, таблица, заметка --- */

  function metricValue(cfg) {
    return aggregate(applyFilter(rows(cfg.dataset), cfg), cfg.agg || 'count', cfg.field);
  }

  function renderMetric(cfg) {
    if (!DATASETS[cfg.dataset]) return '<p class="db-warn">Выберите набор данных (⚙).</p>';
    var v = metricValue(cfg);
    return '<div class="db-metric"><div class="db-metric-value">' + esc(fmtValue(v, cfg.dataset, cfg.field, cfg.agg)) + '</div>' +
      '<div class="db-metric-note">' + esc(cfg.note || ((AGGS[cfg.agg] || 'Количество') + (cfg.agg && cfg.agg !== 'count' && cfg.field ? ': ' + fieldTitle(cfg.dataset, cfg.field) : ' записей'))) + '</div></div>';
  }

  function renderGoal(cfg) {
    if (!DATASETS[cfg.dataset]) return '<p class="db-warn">Выберите набор данных (⚙).</p>';
    var v = metricValue(cfg);
    var target = Number(cfg.target) || 0;
    var lower = cfg.direction === 'down';
    var pct = target ? (lower ? (v <= target ? 100 : target / v * 100) : v / target * 100) : 0;
    var cls = pct >= 100 ? 'ok' : pct >= 60 ? 'warn' : 'bad';
    return '<div class="db-goal">' +
      '<div class="db-goal-nums"><b>' + esc(fmtValue(v, cfg.dataset, cfg.field, cfg.agg)) + '</b><span>' + (lower ? 'не больше ' : 'цель ') + esc(fmtValue(target, cfg.dataset, cfg.field, cfg.agg)) + (cfg.deadline ? ' · ' + esc(cfg.deadline) : '') + '</span></div>' +
      '<div class="progress-mini db-goal-bar"><span class="pm-' + (cls === 'ok' ? 'ok' : cls === 'warn' ? 'warn' : 'bad') + '" style="width:' + Math.min(100, Math.max(0, pct)) + '%"></span></div>' +
      '<div class="db-goal-pct pill pill--' + cls + '">' + Math.round(pct) + '% ' + (pct >= 100 ? '— цель достигнута' : 'от цели') + '</div></div>';
  }

  function renderTable(cfg) {
    var ds = cfg.dataset;
    if (!DATASETS[ds]) return '<p class="db-warn">Выберите набор данных (⚙).</p>';
    var cols = (cfg.columns || []).filter(function (c) { return DATASETS[ds].fields[c]; });
    if (!cols.length) cols = Object.keys(DATASETS[ds].fields).slice(0, 3);
    var list = applyFilter(rows(ds), cfg);
    if (cfg.sortBy && DATASETS[ds].fields[cfg.sortBy]) {
      var num = numeric(ds, cfg.sortBy);
      list.sort(function (a, b) {
        var x = a[cfg.sortBy], y = b[cfg.sortBy];
        var r = num ? (Number(x) || 0) - (Number(y) || 0) : String(x || '').localeCompare(String(y || ''), 'ru');
        return cfg.desc ? -r : r;
      });
    }
    var limit = Number(cfg.limit) || 0;
    var shown = limit > 0 ? list.slice(0, limit) : list;
    return '<div class="table-wrap"><table class="dtable"><thead><tr>' + cols.map(function (c) {
      return '<th' + (numeric(ds, c) ? ' class="num"' : '') + '>' + esc(fieldTitle(ds, c)) + '</th>';
    }).join('') + '</tr></thead><tbody>' + shown.map(function (r) {
      return '<tr>' + cols.map(function (c) { return '<td' + (numeric(ds, c) ? ' class="num"' : '') + '>' + cellValue(r, ds, c) + '</td>'; }).join('') + '</tr>';
    }).join('') + (shown.length ? '' : '<tr><td colspan="' + cols.length + '" class="empty">Нет записей</td></tr>') +
      '</tbody></table></div>' + (limit > 0 && list.length > limit ? '<p class="widget-sub">Показаны ' + limit + ' из ' + list.length + '</p>' : '');
  }

  function renderNote(cfg) {
    var lines = String(cfg.text || '').split('\n');
    var html = '', inList = false;
    lines.forEach(function (line) {
      var m = /^\s*[-•*]\s+(.*)$/.exec(line);
      if (m) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + esc(m[1]) + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (line.trim()) html += '<p>' + esc(line) + '</p>';
      }
    });
    if (inList) html += '</ul>';
    return '<div class="db-note">' + (html || '<p class="widget-sub">Пустая заметка — откройте ⚙, чтобы написать текст.</p>') + '</div>';
  }

  function bindTips(root) {
    root.querySelectorAll('[data-db-tip]').forEach(function (n) {
      n.addEventListener('mousemove', function (e) { D.showTip(e, n.getAttribute('data-db-tip')); });
      n.addEventListener('mouseleave', D.hideTip);
    });
  }

  /* ---------- режим настройки: панель инструментов виджета ---------- */

  function tools(wd, art) {
    var old = art.querySelector('.db-tools');
    if (old) old.parentNode.removeChild(old);
    art.draggable = false;
    if (!st.edit) return;
    var bar = document.createElement('div');
    bar.className = 'db-tools';
    var title = wd.type === 'builtin' ? (BUILTIN_BY_ID[wd.id] || {}).title : (CUSTOM_BY_TYPE[wd.type] || {}).title;
    bar.innerHTML =
      '<span class="db-handle" title="Перетащите, чтобы поменять порядок" aria-hidden="true">⠿</span>' +
      '<span class="db-kind">' + esc(title || '') + '</span>' +
      '<span class="db-size" role="group" aria-label="Размер">' + SIZES.map(function (s) {
        return '<button type="button" data-act="size" data-size="' + s[0] + '" class="' + (wd.size === s[0] ? 'is-on' : '') + '" title="' + SIZE_TITLES[s[0]] + '">' + s[1] + '</button>';
      }).join('') + '</span>' +
      '<button type="button" data-act="up" title="Раньше" aria-label="Переместить раньше">◀</button>' +
      '<button type="button" data-act="down" title="Позже" aria-label="Переместить позже">▶</button>' +
      '<button type="button" data-act="cfg" title="Настроить виджет" aria-label="Настроить">⚙</button>' +
      '<button type="button" data-act="del" class="db-del" title="Убрать с дашборда" aria-label="Убрать">✕</button>';
    art.insertBefore(bar, art.firstChild);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'size') { wd.size = b.getAttribute('data-size'); commit(); }
      if (act === 'up') move(wd.id, -1);
      if (act === 'down') move(wd.id, 1);
      if (act === 'cfg') openSettings(wd);
      if (act === 'del') { removeWidget(wd.id); }
    });
    var handle = bar.querySelector('.db-handle');
    handle.addEventListener('mousedown', function () { art.draggable = true; });
    handle.addEventListener('touchstart', function () { art.draggable = true; }, { passive: true });
  }

  function commit() { layout().updated_at = Math.floor(Date.now() / 1000); apply(); save(); }

  function move(id, delta) {
    var list = layout().widgets;
    var i = list.map(function (x) { return x.id; }).indexOf(id);
    var j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    var t = list[i]; list[i] = list[j]; list[j] = t;
    commit();
  }

  function removeWidget(id) {
    var lay = layout();
    lay.widgets = lay.widgets.filter(function (x) { return x.id !== id; });
    commit();
  }

  /* перетаскивание */
  grid.addEventListener('dragstart', function (e) {
    var art = e.target.closest && e.target.closest('[data-db-id]');
    if (!st.edit || !art) return;
    st.dragId = art.getAttribute('data-db-id');
    art.classList.add('db-dragging');
    try { e.dataTransfer.setData('text/plain', st.dragId); e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* старые браузеры */ }
  });
  grid.addEventListener('dragend', function () {
    grid.querySelectorAll('.db-dragging, .db-drop-before, .db-drop-after').forEach(function (n) {
      n.classList.remove('db-dragging', 'db-drop-before', 'db-drop-after');
      n.draggable = false;
    });
    st.dragId = null;
  });
  function dropPos(art, e) {
    var r = art.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width + (e.clientY - r.top) / r.height) < 1 ? 'before' : 'after';
  }
  grid.addEventListener('dragover', function (e) {
    if (!st.dragId) return;
    var art = e.target.closest('[data-db-id]');
    e.preventDefault();
    grid.querySelectorAll('.db-drop-before, .db-drop-after').forEach(function (n) { n.classList.remove('db-drop-before', 'db-drop-after'); });
    if (art && art.getAttribute('data-db-id') !== st.dragId) art.classList.add('db-drop-' + dropPos(art, e));
  });
  grid.addEventListener('drop', function (e) {
    if (!st.dragId) return;
    e.preventDefault();
    var art = e.target.closest('[data-db-id]');
    var list = layout().widgets;
    var from = list.map(function (x) { return x.id; }).indexOf(st.dragId);
    if (from < 0) return;
    var item = list.splice(from, 1)[0];
    if (art && art.getAttribute('data-db-id') !== item.id) {
      var to = list.map(function (x) { return x.id; }).indexOf(art.getAttribute('data-db-id'));
      list.splice(dropPos(art, e) === 'before' ? to : to + 1, 0, item);
    } else {
      list.push(item);
    }
    st.dragId = null;
    commit();
  });

  /* ---------- панель конструктора ---------- */

  function renderBar() {
    var sel = document.getElementById('dbSelect');
    if (!sel) return;
    sel.innerHTML = st.bundle.layouts.map(function (l) {
      return '<option value="' + esc(l.id) + '"' + (l.id === st.bundle.active ? ' selected' : '') + '>' + esc(l.name) + '</option>';
    }).join('');
    var btn = document.getElementById('dbEdit');
    btn.textContent = st.edit ? 'Готово' : 'Настроить дашборд';
    btn.classList.toggle('is-on', st.edit);
    document.getElementById('dbDelete').disabled = st.bundle.layouts.length < 2;
  }

  function renderPanel() {
    var panel = document.getElementById('dbPanel');
    panel.hidden = !st.edit;
    if (!st.edit) return;
    var lay = layout();
    var used = {};
    lay.widgets.forEach(function (x) { used[x.id] = true; });

    document.getElementById('dbName').value = lay.name;

    document.getElementById('dbPresets').innerHTML = PRESETS.map(function (p) {
      return '<button type="button" class="db-card" data-preset="' + p.id + '"><b>' + esc(p.title) + '</b><span>' + esc(p.note) + '</span></button>';
    }).join('');

    var kpis = lay.kpis || [];
    document.getElementById('dbKpis').innerHTML = Object.keys(D.kpiTitles).map(function (k) {
      var pos = kpis.indexOf(k);
      return '<button type="button" class="chip' + (pos >= 0 ? ' is-on' : '') + '" data-kpi="' + k + '">' +
        (pos >= 0 ? '<span class="db-ord">' + (pos + 1) + '</span>' : '') + esc(D.kpiTitles[k]) + '</button>';
    }).join('');

    document.getElementById('dbLibrary').innerHTML =
      '<div class="db-lib-group"><div class="db-lib-title">Свои виджеты — по любым полям данных</div><div class="db-lib-items">' +
      CUSTOM.map(function (c) {
        return '<button type="button" class="db-card db-card--add" data-add="' + c.type + '"><b>+ ' + esc(c.title) + '</b><span>' + esc(c.note) + '</span></button>';
      }).join('') + '</div></div>' +
      '<div class="db-lib-group"><div class="db-lib-title">Готовые виджеты платформы</div><div class="db-lib-items">' +
      BUILTINS.map(function (b) {
        var on = used[b.id];
        return '<button type="button" class="db-card db-card--add' + (on ? ' is-used' : '') + '" data-builtin="' + b.id + '"' + (on ? ' disabled' : '') + '><b>' + (on ? '✓ ' : '+ ') + esc(b.title) + '</b><span>' + (on ? 'уже на дашборде' : esc(b.note)) + '</span></button>';
      }).join('') + '</div></div>';
  }

  function bindPanel() {
    var panel = document.getElementById('dbPanel');
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var lay = layout();
      if (b.hasAttribute('data-preset')) {
        if (!confirm('Заменить виджеты и плитки этого дашборда шаблоном «' + b.querySelector('b').textContent + '»? Название останется прежним.')) return;
        var p = presetLayout(b.getAttribute('data-preset'));
        lay.kpis = p.kpis;
        lay.widgets = p.widgets;
        commit();
      } else if (b.hasAttribute('data-kpi')) {
        var k = b.getAttribute('data-kpi');
        lay.kpis = lay.kpis || [];
        var i = lay.kpis.indexOf(k);
        if (i >= 0) lay.kpis.splice(i, 1); else lay.kpis.push(k);
        commit();
      } else if (b.hasAttribute('data-add')) {
        var type = b.getAttribute('data-add');
        var wd = w(type, CUSTOM_BY_TYPE[type].size, '', defaultCfg(type));
        lay.widgets.unshift(wd);
        commit();
        openSettings(wd, true);
      } else if (b.hasAttribute('data-builtin')) {
        var id = b.getAttribute('data-builtin');
        lay.widgets.unshift(w('builtin', BUILTIN_BY_ID[id].size, '', {}, id));
        commit();
        var art = document.getElementById(id);
        if (art) art.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    document.getElementById('dbName').addEventListener('change', function (e) {
      layout().name = e.target.value.trim().slice(0, 80) || 'Мой дашборд';
      commit();
    });
  }

  function defaultCfg(type) {
    if (type === 'chart') return { dataset: 'projects', groupBy: 'department', agg: 'count', view: 'bars', top: 8 };
    if (type === 'metric') return { dataset: 'projects', agg: 'count' };
    if (type === 'goal') return { dataset: 'venture_tracker', agg: 'count', filterField: '_status', filterValue: 'Выполнено', target: 5, deadline: 'до конца года' };
    if (type === 'table') return { dataset: 'projects', columns: ['title', 'department', 'trl', 'budget'], sortBy: 'trl', desc: true, limit: 8 };
    if (type === 'note') return { text: '' };
    return {};
  }

  /* ---------- настройки виджета (модальное окно) ---------- */

  function distinct(ds, f) {
    var seen = {}, out = [];
    rows(ds).forEach(function (r) {
      var v = r[f];
      if (v == null || v === '') return;
      v = String(v);
      if (!seen[v]) { seen[v] = true; out.push(v); }
    });
    return out.sort(function (a, b) { return a.localeCompare(b, 'ru', { numeric: true }); });
  }

  function opts(list, value) {
    return list.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }

  function fieldOpts(ds, pred) {
    return Object.keys(DATASETS[ds].fields).filter(function (f) { return pred(f); }).map(function (f) { return [f, fieldTitle(ds, f)]; });
  }

  function settingsForm(wd, cfg) {
    var html = '<label class="mdl-field"><span>Заголовок</span><input name="title" maxlength="120" value="' + esc(wd.title) + '" placeholder="' +
      esc(wd.type === 'builtin' ? (BUILTIN_BY_ID[wd.id] || {}).title : CUSTOM_BY_TYPE[wd.type].title) + '"></label>';
    if (wd.type === 'builtin') return html + '<p class="widget-sub">Готовый виджет платформы: можно поменять заголовок, размер и место на дашборде.</p>';
    if (wd.type === 'note') {
      return html + '<label class="mdl-field"><span>Текст (строки с «- » станут списком)</span><textarea name="text" rows="8" maxlength="3000">' + esc(cfg.text || '') + '</textarea></label>';
    }
    var ds = DATASETS[cfg.dataset] ? cfg.dataset : 'projects';
    html += '<label class="mdl-field"><span>Набор данных</span><select name="dataset">' +
      opts(Object.keys(DATASETS).map(function (k) { return [k, DATASETS[k].title]; }), ds) + '</select></label>';
    if (wd.type === 'chart') {
      html += '<div class="db-form-row"><label class="mdl-field"><span>Группировать по</span><select name="groupBy">' +
        opts(fieldOpts(ds, function (f) { return groupable(ds, f); }), cfg.groupBy) + '</select></label>' +
        '<label class="mdl-field"><span>Вид</span><select name="view">' +
        opts([['bars', 'Горизонтальные полосы'], ['columns', 'Столбцы'], ['donut', 'Кольцо (доли)']], cfg.view) + '</select></label></div>';
    }
    if (wd.type === 'chart' || wd.type === 'metric' || wd.type === 'goal') {
      var nums = fieldOpts(ds, function (f) { return numeric(ds, f); });
      html += '<div class="db-form-row"><label class="mdl-field"><span>Что считаем</span><select name="agg">' +
        opts(Object.keys(AGGS).map(function (k) { return [k, AGGS[k]]; }), cfg.agg || 'count') + '</select></label>' +
        '<label class="mdl-field"><span>Поле (для суммы, среднего…)</span><select name="field">' +
        opts([['', '—']].concat(nums), cfg.field) + '</select></label></div>';
    }
    if (wd.type === 'chart') {
      html += '<label class="mdl-field"><span>Показать первых групп (0 — все)</span><input name="top" type="number" min="0" max="50" value="' + esc(cfg.top || 0) + '"></label>';
    }
    if (wd.type === 'metric') {
      html += '<label class="mdl-field"><span>Подпись под числом</span><input name="note" maxlength="120" value="' + esc(cfg.note || '') + '"></label>';
    }
    if (wd.type === 'goal') {
      html += '<div class="db-form-row"><label class="mdl-field"><span>Цель</span><input name="target" type="number" step="any" value="' + esc(cfg.target != null ? cfg.target : '') + '"></label>' +
        '<label class="mdl-field"><span>Направление</span><select name="direction">' + opts([['up', 'Достичь не меньше'], ['down', 'Удержать не больше']], cfg.direction || 'up') + '</select></label></div>' +
        '<label class="mdl-field"><span>Срок (текстом)</span><input name="deadline" maxlength="60" value="' + esc(cfg.deadline || '') + '" placeholder="например: к 2030 году"></label>';
    }
    if (wd.type === 'table') {
      var cols = cfg.columns || [];
      html += '<div class="mdl-field"><span>Столбцы</span><div class="db-checks">' + Object.keys(DATASETS[ds].fields).map(function (f) {
        return '<label><input type="checkbox" name="columns" value="' + f + '"' + (cols.indexOf(f) >= 0 ? ' checked' : '') + '> ' + esc(fieldTitle(ds, f)) + '</label>';
      }).join('') + '</div></div>' +
        '<div class="db-form-row"><label class="mdl-field"><span>Сортировать по</span><select name="sortBy">' +
        opts([['', '— как в данных']].concat(fieldOpts(ds, function () { return true; })), cfg.sortBy) + '</select></label>' +
        '<label class="mdl-field"><span>Порядок</span><select name="desc">' + opts([['1', 'По убыванию'], ['', 'По возрастанию']], cfg.desc ? '1' : '') + '</select></label>' +
        '<label class="mdl-field"><span>Строк (0 — все)</span><input name="limit" type="number" min="0" max="200" value="' + esc(cfg.limit || 0) + '"></label></div>';
    }
    var ff = cfg.filterField && DATASETS[ds].fields[cfg.filterField] ? cfg.filterField : '';
    html += '<div class="db-form-row"><label class="mdl-field"><span>Фильтр: поле</span><select name="filterField">' +
      opts([['', 'без фильтра']].concat(fieldOpts(ds, function (f) { return groupable(ds, f); })), ff) + '</select></label>' +
      '<label class="mdl-field"><span>Значение</span><select name="filterValue"' + (ff ? '' : ' disabled') + '>' +
      opts([['', '—']].concat(ff ? distinct(ds, ff).map(function (v) { return [v, v]; }) : []), cfg.filterValue) + '</select></label></div>';
    return html;
  }

  function readForm(form, wd) {
    var cfg = {};
    var fd = form.elements;
    for (var i = 0; i < fd.length; i++) {
      var n = fd[i];
      if (!n.name || n.name === 'title' || n.disabled) continue;
      if (n.type === 'checkbox') {
        cfg[n.name] = cfg[n.name] || [];
        if (n.checked) cfg[n.name].push(n.value);
      } else if (n.type === 'number') {
        cfg[n.name] = n.value === '' ? null : Number(n.value);
      } else {
        cfg[n.name] = n.value;
      }
    }
    if ('desc' in cfg) cfg.desc = !!cfg.desc;
    return { title: (fd.title ? fd.title.value : '').trim().slice(0, 120), cfg: cfg };
  }

  function openSettings(wd, isNew) {
    var overlay = document.getElementById('dbModal');
    var form = document.getElementById('dbForm');
    var cfg = Object.assign({}, wd.cfg || {});
    document.getElementById('dbModalTitle').textContent = (isNew ? 'Новый виджет: ' : 'Настройка: ') +
      (wd.type === 'builtin' ? (BUILTIN_BY_ID[wd.id] || {}).title : CUSTOM_BY_TYPE[wd.type].title);
    var draw = function () {
      form.querySelector('.db-form-body').innerHTML = settingsForm(wd, cfg);
      preview();
    };
    var preview = function () {
      var box = document.getElementById('dbPreview');
      if (wd.type === 'builtin') { box.innerHTML = ''; return; }
      var tmp = Object.assign({}, wd, readForm(form, wd));
      box.innerHTML = '<div class="db-preview-label">Предпросмотр</div>' +
        (tmp.type === 'chart' ? renderChart(tmp.cfg) : tmp.type === 'metric' ? renderMetric(tmp.cfg) :
          tmp.type === 'goal' ? renderGoal(tmp.cfg) : tmp.type === 'table' ? renderTable(tmp.cfg) : renderNote(tmp.cfg));
    };
    form.onchange = function (e) {
      var name = e.target && e.target.name;
      var cur = readForm(form, wd);
      if (name === 'dataset') {
        cfg = { dataset: cur.cfg.dataset, agg: 'count', view: cfg.view, top: cfg.top, target: cfg.target, deadline: cfg.deadline, note: cfg.note };
        var first = fieldOpts(cfg.dataset, function (f) { return groupable(cfg.dataset, f); })[0];
        if (first) cfg.groupBy = first[0];
        if (wd.type === 'table') cfg.columns = Object.keys(DATASETS[cfg.dataset].fields).slice(0, 4);
        wd.title = cur.title;
        draw();
        return;
      }
      if (name === 'filterField') {
        cfg = cur.cfg;
        cfg.filterValue = '';
        wd.title = cur.title;
        draw();
        return;
      }
      preview();
    };
    form.oninput = function (e) { if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.type === 'number')) preview(); };
    form.onsubmit = function (e) {
      e.preventDefault();
      var res = readForm(form, wd);
      wd.title = res.title;
      if (wd.type !== 'builtin') wd.cfg = res.cfg;
      overlay.hidden = true;
      commit();
    };
    draw();
    overlay.hidden = false;
    var first = form.querySelector('input, select, textarea');
    if (first) first.focus();
  }

  function bindModal() {
    var overlay = document.getElementById('dbModal');
    var close = function () { overlay.hidden = true; };
    document.getElementById('dbModalClose').addEventListener('click', close);
    document.getElementById('dbCancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });
  }

  /* ---------- свои дашборды: выбор, новый, удалить, экспорт, импорт ---------- */

  function bindBar() {
    document.getElementById('dbSelect').addEventListener('change', function (e) {
      st.bundle.active = e.target.value;
      apply();
      save();
    });
    document.getElementById('dbEdit').addEventListener('click', function () {
      st.edit = !st.edit;
      apply();
      if (st.edit) document.getElementById('dbPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('dbNew').addEventListener('click', function () {
      if (st.bundle.layouts.length >= 20) { alert('Не больше 20 дашбордов на участника'); return; }
      var name = prompt('Название нового дашборда', 'Мой дашборд ' + (st.bundle.layouts.length + 1));
      if (name === null) return;
      var lay = presetLayout('empty');
      lay.name = name.trim().slice(0, 80) || 'Мой дашборд';
      st.bundle.layouts.push(lay);
      st.bundle.active = lay.id;
      st.edit = true;
      commit();
    });
    document.getElementById('dbCopy').addEventListener('click', function () {
      if (st.bundle.layouts.length >= 20) { alert('Не больше 20 дашбордов на участника'); return; }
      var copy = JSON.parse(JSON.stringify(layout()));
      copy.id = 'd-' + Math.random().toString(16).slice(2, 10);
      copy.name = (copy.name + ' (копия)').slice(0, 80);
      st.bundle.layouts.push(copy);
      st.bundle.active = copy.id;
      commit();
    });
    document.getElementById('dbDelete').addEventListener('click', function () {
      if (st.bundle.layouts.length < 2) return;
      if (!confirm('Удалить дашборд «' + layout().name + '»? Данные не пострадают — удалится только раскладка.')) return;
      var id = layout().id;
      st.bundle.layouts = st.bundle.layouts.filter(function (l) { return l.id !== id; });
      st.bundle.active = st.bundle.layouts[0].id;
      commit();
    });
    document.getElementById('dbExport').addEventListener('click', function () {
      var lay = layout();
      var blob = new Blob([JSON.stringify({ aios_dashboard_layout: 1, name: lay.name, kpis: lay.kpis, widgets: lay.widgets }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dashboard-layout.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 500);
    });
    var imp = document.getElementById('dbImport');
    imp.addEventListener('change', function () {
      var file = imp.files && imp.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var d = JSON.parse(reader.result);
          if (!d || !Array.isArray(d.widgets)) throw new Error('нет списка widgets');
          var lay = {
            id: 'd-' + Math.random().toString(16).slice(2, 10),
            name: String(d.name || 'Импортированный дашборд').slice(0, 80),
            kpis: Array.isArray(d.kpis) ? d.kpis.filter(function (k) { return D.kpiTitles[k]; }) : [],
            widgets: d.widgets.filter(function (x) {
              return x && (x.type === 'builtin' ? BUILTIN_BY_ID[x.id] : CUSTOM_BY_TYPE[x.type]);
            }).map(function (x) {
              return { id: x.type === 'builtin' ? x.id : uid(), type: x.type, size: SIZE_TITLES[x.size] ? x.size : 'm', title: String(x.title || '').slice(0, 120), cfg: x.cfg && typeof x.cfg === 'object' ? x.cfg : {} };
            })
          };
          if (st.bundle.layouts.length >= 20) throw new Error('уже 20 дашбордов — удалите лишний');
          st.bundle.layouts.push(lay);
          st.bundle.active = lay.id;
          commit();
        } catch (err) {
          alert('Не удалось загрузить раскладку: ' + err.message);
        }
        imp.value = '';
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  bindBar();
  bindPanel();
  bindModal();
  /* данные дашборда перезагрузились (свой файл, демо) — перерисовать свои виджеты */
  D.onRender.push(function () {
    if (!st.bundle) return;
    var lay = layout();
    lay.widgets.forEach(function (wd) {
      if (wd.type === 'builtin') return;
      var art = document.getElementById('dbw-' + wd.id);
      if (art) renderCustom(wd, art);
    });
  });
  load();
})();
