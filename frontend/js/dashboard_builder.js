/* ============================================================
   Конструктор дашборда (dashboard-builder.html).
   Справочники (шаги, элементы, визуализации, шаблоны) —
   js/dashboard_catalog.js.

   Пайплайн сборки — 6 шагов, дашборд начинается с чистого листа:
     1. Цель и аудитория — тип дашборда, вопросы, шаблон роли как подсказка;
     2. Данные — демо-данные, ввод вручную (таблицы MANUAL из каталога:
        заполнить в окне, вставить из Excel, скачать шаблон CSV) или свой
        CSV/JSON; CSV по шаблону распознаётся как таблица ручного ввода;
     3. Показатели — предложения KPI и план-факт по данным и шаблону;
     4. Визуализации — рекомендации графиков по типам полей, галерея
        визуализаций и управленческих элементов;
     5. Компоновка — порядок (перетаскивание), размеры, разделы;
     6. Проверка — чек-лист качества, режим просмотра, печать, экспорт.

   Хранение: вошедший — на платформе (GET/PUT /api/dashboards,
   api/runtime/dashboards.py), гость — в браузере (localStorage).
   ============================================================ */

(function () {
  var C = window.AIOS_DASH_CATALOG;
  var root = document.getElementById('dbb');
  if (!C || !root) return;

  var API = window.AIOS_API;
  var AUTH_KEY = 'aios-auth-v1';
  var LOCAL_KEY = 'aios-dbb-v1';
  var MAX_ROWS = 3000;
  var $ = function (id) { return document.getElementById(id); };

  var KIND_TITLES = { cat: 'Категория', ord: 'Шкала / год', num: 'Число', money: 'Деньги, тыс. ₽', pct: 'Проценты', date: 'Дата', text: 'Название' };
  var SIZE_TITLES = { s: 'треть ширины', m: 'половина ширины', l: 'две трети ширины', xl: 'вся ширина' };
  var PALETTE = ['var(--dbb-c1)', 'var(--dbb-c2)', 'var(--dbb-c3)', 'var(--dbb-c4)', 'var(--dbb-c5)', 'var(--dbb-c6)', 'var(--dbb-c7)', 'var(--dbb-c8)'];

  var st = { bundle: null, remote: false, saveTimer: null, step: 'goal', view: false, demo: null, demoRaw: null, data: null, dataKey: '', dataRev: 0, dragId: null, vizTable: '', manual: null };

  /* ---------- утилиты ---------- */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid(p) { return (p || 'e') + Math.random().toString(36).slice(2, 9); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function money(th) {
    var n = Number(th) || 0;
    if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн ₽';
    return Math.round(n).toLocaleString('ru-RU') + ' тыс. ₽';
  }
  function num(v) { return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 }); }
  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function today() { return new Date(); }
  function session() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; } }
  function token() { var s = session(); return s && s.token; }

  /* ---------- данные: демо, загрузка, профиль полей ---------- */

  /* Вычисляемые поля демо-данных (как на «Примере дашборда») */
  function enrichDemo(raw) {
    var asOf = raw.as_of ? new Date(raw.as_of) : today();
    if (isNaN(asOf)) asOf = today();
    var staleYears = Number(raw.stale_years) > 0 ? Number(raw.stale_years) : 2;
    var stages = {};
    (raw.funding_stages || []).forEach(function (s) { stages[s.key] = s.title; });
    var projById = {};
    (raw.projects || []).forEach(function (p) { projById[p.id] = p; });
    var funding = { grant: 'Грантовые', internal: 'Внутреннее финансирование', state: 'Госзадание' };
    var persp = { high: 'Высокая', low: 'Низкая' };
    var vStatus = { on_track: 'В графике', risk: 'Риск', overdue: 'Просрочено', done: 'Выполнено' };
    var tables = {};
    tables.projects = (raw.projects || []).map(function (p) {
      var y = (asOf - new Date(p.trl_since)) / (365.25 * 864e5);
      y = isNaN(y) ? 0 : y;
      return Object.assign({}, p, { _years: Math.round(y * 10) / 10, _state: y >= staleYears ? 'Кандидат на закрытие' : 'В развитии',
        funding_stage: stages[p.funding_stage] || p.funding_stage || '—' });
    });
    tables.patents = (raw.patents || []).map(function (p) {
      return Object.assign({}, p, { perspective: persp[p.perspective] || p.perspective || '—', _licensed: p.licensee ? 'Есть лицензиат' : 'Без лицензии', licensee: p.licensee || 'нет' });
    });
    tables.teams = (raw.teams || []).map(function (t) {
      return Object.assign({}, t, { funding: funding[t.funding] || t.funding || '—', project: projById[t.project] ? projById[t.project].title : (t.project || '—') });
    });
    tables.venture_tracker = (raw.venture_tracker || []).map(function (r) {
      var s = r.status && vStatus[r.status] ? r.status : (Number(r.progress) >= 100 ? 'done' : (new Date(r.due) < asOf ? 'overdue' : (Number(r.progress) < 30 ? 'risk' : 'on_track')));
      return Object.assign({}, r, { _status: vStatus[s] });
    });
    /* сводные показатели: выполнение плана и статус (≥100% — выполнен, ≥80% — близко, ниже — отставание) */
    tables.indicators = (raw.indicators || []).map(function (r) {
      var plan = Number(r.plan), fact = Number(r.fact);
      var has = r.plan !== '' && r.plan != null && r.fact !== '' && r.fact != null && plan > 0 && !isNaN(fact);
      var pct = has ? Math.round(fact / plan * 1000) / 10 : '';
      return Object.assign({}, r, { _pct: pct, _status: !has ? 'Нет плана или факта' : pct >= 100 ? 'Выполнен' : pct >= 80 ? 'Близко к плану' : 'Отставание' });
    });
    var out = {};
    Object.keys(C.DEMO).forEach(function (k) {
      if (Array.isArray(raw[k])) out[k] = { title: C.DEMO[k].title, rows: tables[k], known: C.DEMO[k].fields };
    });
    return out;
  }

  /* Ручной ввод: таблицы с хотя бы одной строкой → в формат демо-данных */
  function manualRaw(source) {
    var raw = { as_of: null, stale_years: 2, funding_stages: [] };
    var t = (source && source.tables) || {};
    Object.keys(C.MANUAL).forEach(function (k) { if (Array.isArray(t[k]) && t[k].length) raw[k] = t[k]; });
    return raw;
  }

  function isAiosShape(obj) { return obj && Array.isArray(obj.projects) && Array.isArray(obj.funding_stages); }

  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var firstLine = text.split(/\r?\n/)[0] || '';
    var sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : (firstLine.indexOf('\t') >= 0 ? '\t' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
    if (rows.length < 2) throw new Error('нужна строка заголовков и хотя бы одна строка данных');
    var head = rows[0].map(function (h, i) { return h.trim() || ('Поле ' + (i + 1)); });
    return rows.slice(1, MAX_ROWS + 1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = normalizeCell(r[i]); });
      return o;
    });
  }

  function normalizeCell(v) {
    if (v == null) return '';
    var s = String(v).trim();
    var m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    var n = s.replace(/\s/g, '').replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(n)) return Number(n);
    return s;
  }

  /* Тип поля по значениям: число, порядковое, проценты, дата, категория, текст */
  function inferKind(name, values, rowsCount) {
    var vals = values.filter(function (v) { return v !== '' && v != null; });
    if (!vals.length) return 'text';
    var nums = vals.filter(function (v) { return typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)); }).map(Number);
    var distinct = {};
    vals.forEach(function (v) { distinct[v] = true; });
    var dn = Object.keys(distinct).length;
    if (nums.length === vals.length) {
      var ints = nums.every(function (x) { return Math.round(x) === x; });
      var min = Math.min.apply(null, nums), max = Math.max.apply(null, nums);
      if (/(%|процент|выполн|progress|доля)/i.test(name) && min >= 0 && max <= 100) return 'pct';
      /* порядковое: короткая шкала (УГТ 1–9, оценки) или годы */
      if (ints && dn <= 12 && ((min >= 0 && max <= 20) || (min >= 1900 && max <= 2100))) return 'ord';
      return 'num';
    }
    if (vals.every(function (v) { return /^\d{4}-\d{2}-\d{2}/.test(String(v)); })) return 'date';
    if (dn === vals.length && vals.length > 3) return 'text';  // все значения разные — это названия
    if (dn <= Math.max(12, Math.min(30, rowsCount * 0.6))) return 'cat';
    return 'text';
  }

  function buildData(source, kindsOverride) {
    var tables = {};
    if (source && source.kind === 'manual') {
      tables = enrichDemo(manualRaw(source));
    } else if (!source || source.kind !== 'upload') {
      tables = st.demo || {};
    } else if (source.shape === 'aios') {
      tables = enrichDemo(source.raw || {});
    } else {
      Object.keys(source.tables || {}).forEach(function (k) {
        tables[k] = { title: source.tables[k].title || k, rows: source.tables[k].rows || [] };
      });
    }
    var out = {};
    Object.keys(tables).forEach(function (k) {
      var t = tables[k];
      var rows = t.rows || [];
      /* у демо-данных — только описанные поля (служебные коды вроде status скрыты) */
      var names = {};
      if (t.known) Object.keys(t.known).forEach(function (f) { names[f] = true; });
      else rows.slice(0, 200).forEach(function (r) { Object.keys(r).forEach(function (f) { names[f] = true; }); });
      var fields = {};
      Object.keys(names).forEach(function (f) {
        var values = rows.map(function (r) { return r[f]; });
        var kind = t.known && t.known[f] ? t.known[f][1] : inferKind(f, values, rows.length);
        var ov = kindsOverride && kindsOverride[k + '.' + f];
        if (ov && KIND_TITLES[ov]) kind = ov;
        var dist = {};
        values.forEach(function (v) { if (v !== '' && v != null) dist[v] = (dist[v] || 0) + 1; });
        fields[f] = {
          title: t.known && t.known[f] ? t.known[f][0] : f,
          kind: kind,
          distinct: Object.keys(dist).length,
          top: Object.keys(dist).sort(function (a, b) { return dist[b] - dist[a]; }).slice(0, 4)
        };
      });
      out[k] = { title: t.title, rows: rows, fields: fields };
    });
    return out;
  }

  function data() {
    var lay = layout();
    var key = JSON.stringify([lay ? lay.id : '', lay && lay.source && lay.source.kind, lay && lay.source && lay.source.name, lay && lay.meta && lay.meta.kinds, !!st.demo, st.dataRev]);
    if (st.dataKey !== key) { st.data = buildData(lay && lay.source, lay && lay.meta && lay.meta.kinds); st.dataKey = key; }
    return st.data;
  }

  function table(k) { return data()[k]; }
  function field(tk, f) { var t = table(tk); return t && t.fields[f]; }
  function fTitle(tk, f) { var x = field(tk, f); return x ? x.title : f; }
  function fKind(tk, f) { var x = field(tk, f); return x ? x.kind : 'text'; }
  function isGroup(k) { return k === 'cat' || k === 'ord'; }
  function isNum(k) { return k === 'num' || k === 'money' || k === 'pct' || k === 'ord'; }
  function fieldsOf(tk, pred) {
    var t = table(tk);
    return t ? Object.keys(t.fields).filter(function (f) { return pred(t.fields[f], f); }) : [];
  }
  function firstField(tk, pred) { return fieldsOf(tk, pred)[0] || ''; }

  /* ---------- вычисления ---------- */

  function filtered(cfg) {
    var t = table(cfg.table);
    var rows = t ? t.rows : [];
    if (cfg.filterField && cfg.filterValue !== '' && cfg.filterValue != null) {
      rows = rows.filter(function (r) { return String(r[cfg.filterField]) === String(cfg.filterValue); });
    }
    return rows;
  }

  function aggregate(rows, cfg) {
    var agg = cfg.agg || 'count';
    if (agg === 'count') return rows.length;
    if (agg === 'share') {
      if (!rows.length || !cfg.shareField) return 0;
      return rows.filter(function (r) { return String(r[cfg.shareField]) === String(cfg.shareValue); }).length / rows.length * 100;
    }
    if (agg === 'distinct') {
      var d = {};
      rows.forEach(function (r) { d[r[cfg.field]] = true; });
      return Object.keys(d).length;
    }
    var nums = rows.map(function (r) { return Number(r[cfg.field]); }).filter(function (x) { return !isNaN(x); });
    if (!nums.length) return 0;
    var sum = nums.reduce(function (a, b) { return a + b; }, 0);
    if (agg === 'sum') return sum;
    if (agg === 'avg') return sum / nums.length;
    if (agg === 'min') return Math.min.apply(null, nums);
    if (agg === 'max') return Math.max.apply(null, nums);
    return rows.length;
  }

  function fmtVal(v, cfg, f) {
    var agg = cfg.agg || 'count';
    if (agg === 'share') return Math.round(v) + '%';
    var fld = f || cfg.field;
    if ((agg !== 'count' && agg !== 'distinct') || f) {
      var k = fKind(cfg.table, fld);
      if (k === 'money') return money(v);
      if (k === 'pct') return Math.round(v) + '%';
    }
    return num(v) + (cfg.unit && agg !== 'count' ? ' ' + cfg.unit : '');
  }

  function groups(cfg, by) {
    var rows = filtered(cfg);
    var map = {}, order = [];
    rows.forEach(function (r) {
      var k = r[by];
      k = k == null || k === '' ? '—' : String(k);
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(r);
    });
    var out = order.map(function (k) { return { key: k, rows: map[k], value: aggregate(map[k], cfg) }; });
    if (fKind(cfg.table, by) === 'ord') out.sort(function (a, b) { return Number(a.key) - Number(b.key); });
    else if (cfg.view !== 'funnel') out.sort(function (a, b) { return b.value - a.value; });
    return out;
  }

  /* ---------- отрисовка элементов ---------- */

  function warn(text) { return '<p class="dbb-warn">' + esc(text) + '</p>'; }
  function tip(html) { return ' data-tip="' + esc(html) + '"'; }

  function renderBody(w) {
    var cfg = w.cfg || {};
    try {
      if (w.type === 'section') return cfg.subtitle ? '<p class="widget-sub">' + esc(cfg.subtitle) + '</p>' : '';
      if (w.type === 'note') return renderNote(cfg);
      if (w.type === 'actions') return renderActions(w);
      if (!table(cfg.table)) return warn('Выберите таблицу данных (⚙).');
      if (w.type === 'kpi') return renderKpi(cfg);
      if (w.type === 'goal') return renderGoal(cfg);
      if (w.type === 'table') return renderTable(cfg);
      if (w.type === 'chart') return renderChart(cfg);
    } catch (e) {
      return warn('Не удалось построить элемент — проверьте настройки (⚙).');
    }
    return '';
  }

  function kpiStatus(v, cfg) {
    if (cfg.target === '' || cfg.target == null || isNaN(Number(cfg.target))) return '';
    var t = Number(cfg.target);
    var good = cfg.direction === 'down' ? v <= t : v >= t;
    return good ? 'ok' : 'bad';
  }

  function renderKpi(cfg) {
    var v = aggregate(filtered(cfg), cfg);
    var s = kpiStatus(v, cfg);
    var target = s ? '<span class="pill pill--' + s + '">' + (cfg.direction === 'down' ? 'порог ≤ ' : 'цель ≥ ') + esc(fmtVal(Number(cfg.target), cfg)) + '</span>' : '';
    return '<div class="dbb-kpi dbb-kpi--' + (s || 'none') + '"><div class="dbb-kpi-value">' + esc(fmtVal(v, cfg)) + '</div>' +
      '<div class="dbb-kpi-note">' + esc(cfg.note || autoNote(cfg)) + '</div>' + target + '</div>';
  }

  function autoNote(cfg) {
    var a = C.AGGS[cfg.agg || 'count'];
    if (cfg.agg === 'share') return 'доля «' + (cfg.shareValue || '…') + '»';
    if (!cfg.agg || cfg.agg === 'count') return 'строк в таблице «' + (table(cfg.table) || {}).title + '»' + (cfg.filterField && cfg.filterValue ? ': ' + cfg.filterValue : '');
    return a.toLowerCase() + ' «' + fTitle(cfg.table, cfg.field) + '»';
  }

  function renderGoal(cfg) {
    var v = aggregate(filtered(cfg), cfg);
    var t = Number(cfg.target) || 0;
    var down = cfg.direction === 'down';
    var pct = t ? (down ? (v <= t ? 100 : t / v * 100) : v / t * 100) : 0;
    var cls = pct >= 100 ? 'ok' : pct >= 60 ? 'warn' : 'bad';
    return '<div class="dbb-goal"><div class="dbb-goal-nums"><b>' + esc(fmtVal(v, cfg)) + '</b><span>' + (down ? 'не больше ' : 'цель ') + esc(fmtVal(t, cfg)) +
      (cfg.deadline ? ' · ' + esc(cfg.deadline) : '') + '</span></div>' +
      '<div class="dbb-goal-bar"><span class="pm-' + cls + '" style="width:' + Math.min(100, Math.max(0, pct)) + '%"></span></div>' +
      '<span class="pill pill--' + cls + '">' + Math.round(pct) + '% ' + (pct >= 100 ? '— цель достигнута' : 'от цели') + '</span></div>';
  }

  function renderTable(cfg) {
    var tk = cfg.table;
    var cols = (cfg.columns || []).filter(function (c) { return field(tk, c); });
    if (!cols.length) cols = Object.keys(table(tk).fields).slice(0, 4);
    var rows = filtered(cfg).slice();
    if (cfg.sortBy && field(tk, cfg.sortBy)) {
      var n = isNum(fKind(tk, cfg.sortBy));
      rows.sort(function (a, b) {
        var r = n ? (Number(a[cfg.sortBy]) || 0) - (Number(b[cfg.sortBy]) || 0) : String(a[cfg.sortBy] || '').localeCompare(String(b[cfg.sortBy] || ''), 'ru');
        return cfg.desc ? -r : r;
      });
    }
    var limit = Number(cfg.limit) || 0;
    var shown = limit > 0 ? rows.slice(0, limit) : rows;
    var cell = function (r, c) {
      var k = fKind(tk, c);
      if (k === 'money') return money(r[c]);
      if (k === 'date') return fmtDate(r[c]);
      if (k === 'pct') return esc(r[c]) + '%';
      return esc(r[c] == null || r[c] === '' ? '—' : r[c]);
    };
    return '<div class="table-wrap"><table class="dtable"><thead><tr>' + cols.map(function (c) {
      return '<th' + (isNum(fKind(tk, c)) ? ' class="num"' : '') + '>' + esc(fTitle(tk, c)) + '</th>';
    }).join('') + '</tr></thead><tbody>' + shown.map(function (r) {
      return '<tr>' + cols.map(function (c) { return '<td' + (isNum(fKind(tk, c)) ? ' class="num"' : '') + '>' + cell(r, c) + '</td>'; }).join('') + '</tr>';
    }).join('') + (shown.length ? '' : '<tr><td colspan="' + cols.length + '" class="empty">Нет записей</td></tr>') + '</tbody></table></div>' +
      (limit > 0 && rows.length > limit ? '<p class="widget-sub">Показаны ' + limit + ' из ' + rows.length + '</p>' : '');
  }

  function renderNote(cfg) {
    var lines = String(cfg.text || '').split('\n'), html = '', list = false;
    lines.forEach(function (line) {
      var m = /^\s*[-•*]\s+(.*)$/.exec(line);
      if (m) { if (!list) { html += '<ul>'; list = true; } html += '<li>' + esc(m[1]) + '</li>'; }
      else { if (list) { html += '</ul>'; list = false; } if (line.trim()) html += '<p>' + esc(line) + '</p>'; }
    });
    if (list) html += '</ul>';
    return '<div class="dbb-note dbb-note--' + esc(cfg.tone || 'info') + '">' + (html || '<p class="widget-sub">Пустой вывод — откройте ⚙ и напишите текст.</p>') + '</div>';
  }

  function renderActions(w) {
    var items = (w.cfg && w.cfg.items) || [];
    if (!items.length) return '<p class="widget-sub">Список пуст — добавьте решения и поручения в настройках (⚙).</p>';
    var done = items.filter(function (i) { return i.done; }).length;
    return '<div class="dbb-actions-sum">Выполнено ' + done + ' из ' + items.length + '</div><ul class="dbb-actions">' + items.map(function (it, i) {
      return '<li class="' + (it.done ? 'is-done' : '') + '"><label><input type="checkbox" data-act-toggle="' + esc(w.id) + ':' + i + '"' + (it.done ? ' checked' : '') + '>' +
        '<span class="dbb-act-text">' + esc(it.text) + '</span></label>' +
        '<span class="dbb-act-meta">' + esc([it.owner, it.due].filter(Boolean).join(' · ')) + '</span></li>';
    }).join('') + '</ul>';
  }

  function renderChart(cfg) {
    var v = cfg.view || 'bars';
    if (v === 'histogram') return chartHistogram(cfg);
    if (v === 'top') return chartTop(cfg);
    if (v === 'progress') return chartProgress(cfg);
    if (v === 'timeline') return chartTimeline(cfg);
    if (!cfg.groupBy || !field(cfg.table, cfg.groupBy)) return warn('Выберите поле для разреза (⚙).');
    if (v === 'stacked' || v === 'matrix') {
      if (!cfg.groupBy2 || !field(cfg.table, cfg.groupBy2)) return warn('Выберите второй разрез (⚙).');
      return v === 'stacked' ? chartStacked(cfg) : chartMatrix(cfg);
    }
    var gs = groups(cfg, cfg.groupBy);
    if (!gs.length) return warn('Нет данных по выбранному фильтру.');
    var top = Number(cfg.top) || 0;
    if (top > 0 && gs.length > top && v !== 'funnel' && v !== 'columns') {
      var rest = gs.slice(top);
      gs = gs.slice(0, top);
      if (cfg.agg === 'count' || cfg.agg === 'sum' || !cfg.agg) {
        var all = [];
        rest.forEach(function (g) { all = all.concat(g.rows); });
        gs.push({ key: 'Остальные (' + rest.length + ')', rows: all, value: aggregate(all, cfg) });
      }
    }
    if (v === 'donut') return chartDonut(gs, cfg);
    if (v === 'funnel') return chartFunnel(gs, cfg);
    var max = Math.max.apply(null, gs.map(function (g) { return Math.abs(g.value); }).concat([1e-9]));
    var t = function (g) { return tip('<b>' + esc(g.key) + '</b><br>' + esc(fmtVal(g.value, cfg)) + ' · записей: ' + g.rows.length); };
    if (v === 'columns') {
      return '<div class="dbb-cols">' + gs.map(function (g, i) {
        return '<div class="dbb-col"' + t(g) + '><span class="dbb-col-val">' + esc(fmtVal(g.value, cfg)) + '</span>' +
          '<span class="dbb-col-bar" style="height:' + Math.max(2, g.value / max * 100) + '%;background:' + PALETTE[0] + '"></span>' +
          '<span class="dbb-col-key">' + esc((fKind(cfg.table, cfg.groupBy) === 'ord' && /trl|угт/i.test(cfg.groupBy + fTitle(cfg.table, cfg.groupBy)) ? 'УГТ ' : '') + g.key) + '</span></div>';
      }).join('') + '</div>';
    }
    return '<div class="dbb-bars">' + gs.map(function (g, i) {
      return '<div class="dbb-bar-row"' + t(g) + '><span class="dbb-bar-key">' + esc(g.key) + '</span>' +
        '<span class="dbb-bar-track"><span style="width:' + Math.max(1, g.value / max * 100) + '%;background:' + PALETTE[i % PALETTE.length] + '"></span></span>' +
        '<span class="dbb-bar-val">' + esc(fmtVal(g.value, cfg)) + '</span></div>';
    }).join('') + '</div>';
  }

  function chartDonut(gs, cfg) {
    var total = gs.reduce(function (s, g) { return s + Math.max(0, g.value); }, 0) || 1;
    var r = 52, c = 2 * Math.PI * r, off = 0;
    var arcs = gs.map(function (g, i) {
      var len = Math.max(0, g.value) / total * c;
      var a = '<circle r="' + r + '" cx="70" cy="70" fill="none" stroke="' + PALETTE[i % PALETTE.length] + '" stroke-width="22" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '"' +
        tip('<b>' + esc(g.key) + '</b><br>' + esc(fmtVal(g.value, cfg))) + '></circle>';
      off += len;
      return a;
    }).join('');
    return '<div class="dbb-donut"><svg viewBox="0 0 140 140" role="img" aria-label="Кольцевая диаграмма"><g transform="rotate(-90 70 70)">' + arcs + '</g>' +
      '<text x="70" y="75" text-anchor="middle" class="dbb-donut-total">' + esc(cfg.agg === 'avg' ? '' : fmtVal(total, cfg)) + '</text></svg>' +
      '<ul class="dbb-legend">' + gs.map(function (g, i) {
        return '<li><i style="background:' + PALETTE[i % PALETTE.length] + '"></i>' + esc(g.key) + ' <b>' + esc(fmtVal(g.value, cfg)) + '</b><span>' + Math.round(Math.max(0, g.value) / total * 100) + '%</span></li>';
      }).join('') + '</ul></div>';
  }

  function chartFunnel(gs, cfg) {
    /* для порядкового поля «дошло до стадии» = на стадии и дальше */
    var vals = gs.map(function (g, i) {
      if (!cfg.cumulative) return g.value;
      return gs.slice(i).reduce(function (s, x) { return s + x.value; }, 0);
    });
    var max = Math.max.apply(null, vals.concat([1e-9]));
    var ord = fKind(cfg.table, cfg.groupBy) === 'ord' && /trl|угт/i.test(cfg.groupBy + fTitle(cfg.table, cfg.groupBy));
    return '<div class="dbb-funnel">' + gs.map(function (g, i) {
      var conv = i > 0 && vals[i - 1] ? Math.round(vals[i] / vals[i - 1] * 100) : null;
      return '<div class="dbb-fun-row"' + tip('<b>' + esc(g.key) + '</b><br>' + esc(fmtVal(vals[i], cfg)) + (cfg.cumulative ? ' дошло до стадии' : '')) + '>' +
        '<span class="dbb-fun-key">' + esc((ord ? 'УГТ ' : '') + g.key) + '</span>' +
        '<span class="dbb-fun-track"><span style="width:' + Math.max(3, vals[i] / max * 100) + '%"></span></span>' +
        '<span class="dbb-fun-val">' + esc(fmtVal(vals[i], cfg)) + (conv !== null ? '<small>' + conv + '%</small>' : '') + '</span></div>';
    }).join('') + '</div>' + (cfg.cumulative ? '<p class="widget-sub">Накопленно: сколько дошло до стадии и дальше; справа — конверсия из предыдущей стадии.</p>' : '');
  }

  function chartStacked(cfg) {
    var gs = groups(cfg, cfg.groupBy);
    var segKeys = [];
    gs.forEach(function (g) { g.rows.forEach(function (r) { var k = String(r[cfg.groupBy2] == null ? '—' : r[cfg.groupBy2]); if (segKeys.indexOf(k) < 0) segKeys.push(k); }); });
    segKeys.sort();
    return '<div class="dbb-stacked">' + gs.map(function (g) {
      var parts = segKeys.map(function (k) { return aggregate(g.rows.filter(function (r) { return String(r[cfg.groupBy2]) === k; }), cfg); });
      var tot = parts.reduce(function (a, b) { return a + b; }, 0) || 1;
      return '<div class="dbb-bar-row"><span class="dbb-bar-key">' + esc(g.key) + '</span><span class="dbb-stack-track">' + parts.map(function (p, i) {
        return p ? '<span style="width:' + (p / tot * 100) + '%;background:' + PALETTE[i % PALETTE.length] + '"' + tip('<b>' + esc(g.key) + '</b><br>' + esc(segKeys[i]) + ': ' + esc(fmtVal(p, cfg)) + ' (' + Math.round(p / tot * 100) + '%)') + '></span>' : '';
      }).join('') + '</span><span class="dbb-bar-val">' + esc(fmtVal(tot, cfg)) + '</span></div>';
    }).join('') + '</div><ul class="dbb-legend dbb-legend--row">' + segKeys.map(function (k, i) {
      return '<li><i style="background:' + PALETTE[i % PALETTE.length] + '"></i>' + esc(k) + '</li>';
    }).join('') + '</ul>';
  }

  function chartMatrix(cfg) {
    var rowsG = groups(cfg, cfg.groupBy);
    var cols = [];
    filtered(cfg).forEach(function (r) { var k = String(r[cfg.groupBy2] == null ? '—' : r[cfg.groupBy2]); if (cols.indexOf(k) < 0) cols.push(k); });
    if (fKind(cfg.table, cfg.groupBy2) === 'ord') cols.sort(function (a, b) { return Number(a) - Number(b); }); else cols.sort();
    var cells = rowsG.map(function (g) { return cols.map(function (c) { var rs = g.rows.filter(function (r) { return String(r[cfg.groupBy2]) === c; }); return rs.length ? aggregate(rs, cfg) : null; }); });
    var max = Math.max.apply(null, [].concat.apply([], cells).filter(function (x) { return x != null; }).concat([1e-9]));
    return '<div class="table-wrap"><table class="dbb-matrix"><thead><tr><th></th>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rowsG.map(function (g, i) {
        return '<tr><th>' + esc(g.key) + '</th>' + cells[i].map(function (v, j) {
          return v == null ? '<td class="is-empty">·</td>' : '<td style="--a:' + (0.12 + 0.88 * v / max).toFixed(2) + '"' + tip('<b>' + esc(g.key) + ' × ' + esc(cols[j]) + '</b><br>' + esc(fmtVal(v, cfg))) + '>' + esc(fmtVal(v, cfg)) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function chartHistogram(cfg) {
    if (!cfg.field || !field(cfg.table, cfg.field)) return warn('Выберите числовое поле (⚙).');
    var vals = filtered(cfg).map(function (r) { return Number(r[cfg.field]); }).filter(function (x) { return !isNaN(x); });
    if (!vals.length) return warn('Нет числовых значений.');
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var bins = Math.min(8, Math.max(3, Math.round(Math.sqrt(vals.length)) + 1));
    var w = (max - min) / bins || 1;
    var counts = [];
    for (var i = 0; i < bins; i++) counts.push(0);
    vals.forEach(function (v) { counts[Math.min(bins - 1, Math.floor((v - min) / w))]++; });
    var top = Math.max.apply(null, counts);
    var f = function (x) { return fmtVal(x, { table: cfg.table, agg: 'sum' }, cfg.field); };
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var sorted = vals.slice().sort(function (a, b) { return a - b; });
    var med = sorted[Math.floor(sorted.length / 2)];
    return '<div class="dbb-cols dbb-hist">' + counts.map(function (c, i) {
      var lo = min + i * w, hi = lo + w;
      return '<div class="dbb-col"' + tip(esc(f(lo)) + ' – ' + esc(f(hi)) + '<br><b>' + c + '</b> записей') + '><span class="dbb-col-val">' + (c || '') + '</span>' +
        '<span class="dbb-col-bar" style="height:' + Math.max(2, c / top * 100) + '%;background:' + PALETTE[4] + '"></span>' +
        '<span class="dbb-col-key">' + esc(f(lo)) + '</span></div>';
    }).join('') + '</div><p class="widget-sub">Медиана ' + esc(f(med)) + ' · среднее ' + esc(f(mean)) + ' · от ' + esc(f(min)) + ' до ' + esc(f(max)) + '</p>';
  }

  function chartTop(cfg) {
    if (!cfg.labelField || !cfg.valueField) return warn('Выберите поле подписи и числовое поле (⚙).');
    var rows = filtered(cfg).slice().sort(function (a, b) { return (Number(b[cfg.valueField]) || 0) - (Number(a[cfg.valueField]) || 0); });
    var n = Number(cfg.top) || 5;
    if (cfg.ascending) rows.reverse();
    rows = rows.slice(0, n);
    var max = Math.max.apply(null, rows.map(function (r) { return Math.abs(Number(r[cfg.valueField]) || 0); }).concat([1e-9]));
    return '<ol class="dbb-top">' + rows.map(function (r, i) {
      var v = Number(r[cfg.valueField]) || 0;
      return '<li><span class="dbb-top-n">' + (i + 1) + '</span><span class="dbb-top-label">' + esc(r[cfg.labelField]) + '</span>' +
        '<span class="dbb-bar-track"><span style="width:' + Math.max(2, Math.abs(v) / max * 100) + '%;background:' + PALETTE[i === 0 ? 1 : 0] + '"></span></span>' +
        '<span class="dbb-bar-val">' + esc(fmtVal(v, { table: cfg.table, agg: 'sum' }, cfg.valueField)) + '</span></li>';
    }).join('') + '</ol>';
  }

  function chartProgress(cfg) {
    if (!cfg.labelField || !cfg.valueField) return warn('Выберите подпись и поле с процентом выполнения (⚙).');
    var ok = Number(cfg.okFrom) || 70, bad = Number(cfg.badBelow) || 30;
    var rows = filtered(cfg).slice().sort(function (a, b) { return (Number(a[cfg.valueField]) || 0) - (Number(b[cfg.valueField]) || 0); });
    return '<div class="dbb-progress">' + rows.map(function (r) {
      var real = Number(r[cfg.valueField]) || 0;
      var v = Math.max(0, Math.min(100, real));
      var cls = real >= ok ? 'ok' : real < bad ? 'bad' : 'warn';
      return '<div class="dbb-bar-row"><span class="dbb-bar-key" title="' + esc(r[cfg.labelField]) + '">' + esc(r[cfg.labelField]) + '</span>' +
        '<span class="dbb-bar-track"><span class="pm-' + cls + '" style="width:' + v + '%"></span></span><span class="dbb-bar-val">' + Math.round(real) + '%</span></div>';
    }).join('') + '</div><p class="widget-sub">Зелёный — от ' + ok + '%, красный — ниже ' + bad + '%.</p>';
  }

  function chartTimeline(cfg) {
    if (!cfg.labelField || !cfg.dateField) return warn('Выберите подпись и поле даты (⚙).');
    var now = today();
    var rows = filtered(cfg).filter(function (r) { return !isNaN(new Date(r[cfg.dateField])); })
      .sort(function (a, b) { return new Date(a[cfg.dateField]) - new Date(b[cfg.dateField]); });
    if (!rows.length) return warn('Нет дат в выбранном поле.');
    var t0 = Math.min(new Date(rows[0][cfg.dateField]), now), t1 = Math.max(new Date(rows[rows.length - 1][cfg.dateField]), now);
    var span = (t1 - t0) || 1;
    var pos = function (d) { return ((d - t0) / span * 100).toFixed(1); };
    return '<div class="dbb-tl-axis"><span class="dbb-tl-now" style="left:' + pos(now) + '%"><i>сегодня</i></span>' + rows.map(function (r) {
      var d = new Date(r[cfg.dateField]);
      var done = cfg.valueField && Number(r[cfg.valueField]) >= 100;
      var cls = done ? 'done' : d < now ? 'bad' : (d - now) / 864e5 <= 45 ? 'warn' : 'ok';
      return '<span class="dbb-tl-dot dbb-tl-dot--' + cls + '" style="left:' + pos(d) + '%"' + tip('<b>' + esc(r[cfg.labelField]) + '</b><br>' + esc(fmtDate(d))) + '></span>';
    }).join('') + '</div><ul class="dbb-tl-list">' + rows.map(function (r) {
      var d = new Date(r[cfg.dateField]);
      var days = Math.round((d - now) / 864e5);
      var done = cfg.valueField && Number(r[cfg.valueField]) >= 100;
      var pill = done ? '<span class="pill pill--done">выполнено</span>' : days < 0 ? '<span class="pill pill--bad">просрочено ' + (-days) + ' дн.</span>' :
        days <= 45 ? '<span class="pill pill--warn">через ' + days + ' дн.</span>' : '<span class="pill pill--ok">через ' + days + ' дн.</span>';
      return '<li><span class="dbb-tl-date">' + esc(fmtDate(d)) + '</span><span class="dbb-tl-label">' + esc(r[cfg.labelField]) +
        (cfg.valueField && field(cfg.table, cfg.valueField) ? ' <small>' + esc(r[cfg.valueField]) + (fKind(cfg.table, cfg.valueField) === 'pct' ? '%' : '') + '</small>' : '') + '</span>' + pill + '</li>';
    }).join('') + '</ul>';
  }

  /* ---------- хранение ---------- */

  function layout() {
    var b = st.bundle;
    if (!b) return null;
    return b.layouts.filter(function (l) { return l.id === b.active; })[0] || b.layouts[0] || null;
  }

  function blank(name) {
    return { id: 'd-' + Math.random().toString(16).slice(2, 10), name: name || 'Новый дашборд', kpis: [], widgets: [],
      meta: { step: 'goal', kind: '', audience: '', purpose: '', questions: '', period: '', template: '' }, source: { kind: 'demo' } };
  }

  /* раскладки первой версии конструктора: metric → kpi, готовые виджеты не переносятся */
  function migrate(b) {
    (b.layouts || []).forEach(function (l) {
      l.meta = l.meta || { step: 'layout' };
      if (!l.source || ['demo', 'upload', 'manual'].indexOf(l.source.kind) < 0) l.source = { kind: 'demo' };
      l.widgets = (l.widgets || []).filter(function (w) { return w.type !== 'builtin'; }).map(function (w) {
        if (w.type === 'metric') w.type = 'kpi';
        if (w.cfg && w.cfg.dataset && !w.cfg.table) { w.cfg.table = w.cfg.dataset; delete w.cfg.dataset; }
        if (w.size === undefined) w.size = 'm';
        return w;
      });
    });
    return b;
  }

  function localKey() { var s = session(); return LOCAL_KEY + ':' + ((s && s.login) || 'guest'); }
  function readLocal() {
    try { var b = JSON.parse(localStorage.getItem(localKey()) || 'null'); return b && b.layouts && b.layouts.length ? b : null; } catch (e) { return null; }
  }
  function status(text) { $('dbbSaved').textContent = text; }

  function save() {
    try { localStorage.setItem(localKey(), JSON.stringify(st.bundle)); } catch (e) { /* место в браузере закончилось */ }
    clearTimeout(st.saveTimer);
    if (!st.remote) {
      status(token() ? 'Сохранено в этом браузере' : 'Сохранено в этом браузере · войдите, чтобы дашборды были с вами на любом компьютере');
      return;
    }
    status('Сохраняю…');
    st.saveTimer = setTimeout(function () {
      API.request('PUT', '/dashboards', st.bundle, token()).then(function () {
        status('Сохранено на платформе · ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
      }).catch(function (err) {
        status('На платформе не сохранилось: ' + ((err && err.message) || 'ошибка') + ' — копия есть в браузере');
      });
    }, 700);
  }

  function commit() { var l = layout(); if (l) l.updated_at = Math.floor(Date.now() / 1000); render(); save(); }

  /* ---------- общая отрисовка ---------- */

  function render() {
    var lay = layout();
    if (!lay) return;
    st.step = lay.meta.step || 'goal';
    root.classList.toggle('dbb--view', st.view);
    document.body.classList.toggle('dbb-viewing', st.view);
    $('dbbView').textContent = st.view ? '← Вернуться к сборке' : 'Режим просмотра';
    $('dbbSelect').innerHTML = st.bundle.layouts.map(function (l) {
      return '<option value="' + esc(l.id) + '"' + (l.id === lay.id ? ' selected' : '') + '>' + esc(l.name) + '</option>';
    }).join('');
    $('dbbDelete').disabled = st.bundle.layouts.length < 2;
    renderSteps();
    renderPanel();
    renderCanvas();
  }

  function stepDone(id) {
    var l = layout(), m = l.meta || {}, ws = l.widgets;
    if (id === 'goal') return !!(m.purpose || m.audience);
    if (id === 'data') return !!m.dataConfirmed;
    if (id === 'kpi') return ws.some(function (w) { return w.type === 'kpi' || w.type === 'goal'; });
    if (id === 'viz') return ws.some(function (w) { return w.type === 'chart' || w.type === 'table'; });
    if (id === 'layout') return !!m.layoutVisited && ws.length >= 3;
    if (id === 'check') return checks().every(function (c) { return c.level !== 'bad'; }) && !!m.ready;
    return false;
  }

  function renderSteps() {
    $('dbbSteps').innerHTML = C.STEPS.map(function (s) {
      var on = s.id === st.step, done = stepDone(s.id);
      return '<li class="dbb-step' + (on ? ' is-on' : '') + (done ? ' is-done' : '') + '"><button type="button" data-step="' + s.id + '">' +
        '<span class="dbb-step-n">' + (done && !on ? '✓' : s.n) + '</span><span class="dbb-step-t"><b>' + esc(s.title) + '</b><small>' + esc(s.hint) + '</small></span></button></li>';
    }).join('');
  }

  function goStep(id) {
    var l = layout();
    l.meta.step = id;
    if (id === 'layout') l.meta.layoutVisited = true;
    commit();
    var p = $('dbbSteps');
    if (p && p.getBoundingClientRect().top < 0) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function navHtml() {
    var i = C.STEPS.map(function (s) { return s.id; }).indexOf(st.step);
    return '<div class="dbb-nav">' + (i > 0 ? '<button class="btn-register" type="button" data-step="' + C.STEPS[i - 1].id + '">← ' + esc(C.STEPS[i - 1].title) + '</button>' : '<span></span>') +
      (i < C.STEPS.length - 1 ? '<button class="btn-primary" type="button" data-step="' + C.STEPS[i + 1].id + '">' + esc(C.STEPS[i + 1].title) + ' →</button>' : '') + '</div>';
  }

  /* ---------- холст дашборда ---------- */

  function sizeOf(w) { return SIZE_TITLES[w.size] ? w.size : (C.ELEMENTS[w.type] || {}).size || 'm'; }

  function defaultTitle(w) {
    if (w.type === 'chart') {
      var v = C.VIEWS.filter(function (x) { return x.id === (w.cfg || {}).view; })[0];
      return v ? v.title : 'График';
    }
    return (C.ELEMENTS[w.type] || {}).title || 'Элемент';
  }

  function renderCanvas() {
    var lay = layout();
    var m = lay.meta || {};
    var kind = C.KINDS.filter(function (k) { return k.id === m.kind; })[0];
    var sk = lay.source && lay.source.kind;
    var src = sk === 'upload' ? 'данные: ' + (lay.source.name || 'свой файл') : sk === 'manual' ? 'данные: введены вручную' : 'данные: демо-данные (пример)';
    $('dbbCanvasHead').innerHTML = '<div><h2 class="dbb-dash-title">' + esc(lay.name) + '</h2><p class="widget-sub">' +
      esc([kind ? kind.title + ' дашборд' : '', m.audience ? 'для: ' + m.audience : '', m.period ? 'обновление: ' + m.period : '', src].filter(Boolean).join(' · ')) + '</p>' +
      (m.purpose ? '<p class="dbb-purpose">' + esc(m.purpose) + '</p>' : '') + '</div>' +
      (st.view ? '' : '<button class="dash-btn" type="button" data-step="data" title="Перейти к шагу 2: ввести или заменить данные">✎ Данные дашборда</button>');
    var canvas = $('dbbCanvas');
    if (!lay.widgets.length) {
      canvas.innerHTML = '<div class="dbb-empty"><div class="dbb-empty-title">Дашборд пока пуст</div>' +
        '<p>Быстрый путь к готовому дашборду: на шаге 1 выберите шаблон роли, на шаге 2 введите свои данные (или возьмите пример), затем нажмите «Собрать дашборд по шаблону».</p>' +
        '<p>Или собирайте по шагам: конструктор предложит показатели и графики по вашим данным. Всё добавляется по одному нажатию и настраивается кнопкой ⚙.</p>' +
        '<ol class="dbb-pipe">' + C.STEPS.map(function (s) { return '<li><span>' + s.n + '</span>' + esc(s.title) + '</li>'; }).join('') + '</ol></div>';
      return;
    }
    canvas.innerHTML = lay.widgets.map(function (w) {
      var size = w.type === 'section' ? 'xl' : sizeOf(w);
      var head = w.type === 'section'
        ? '<h3 class="dbb-section-title">' + esc(w.title || 'Раздел') + '</h3>'
        : '<header class="widget-head"><div><h2>' + esc(w.title || defaultTitle(w)) + '</h2>' + (w.type === 'chart' || w.type === 'table' ? '<p class="widget-sub">' + esc(describe(w)) + '</p>' : '') + '</div></header>';
      return '<article class="widget dbb-w dbb-w--' + w.type + ' dbb-size-' + size + '" data-id="' + esc(w.id) + '">' + tools(w) + head + '<div class="dbb-body">' + renderBody(w) + '</div></article>';
    }).join('');
    bindTips(canvas);
  }

  function describe(w) {
    var c = w.cfg || {}, t = table(c.table);
    if (!t) return '';
    var parts = [t.title];
    if (c.groupBy && field(c.table, c.groupBy)) parts.push('по полю «' + fTitle(c.table, c.groupBy) + '»' + (c.groupBy2 ? ' и «' + fTitle(c.table, c.groupBy2) + '»' : ''));
    if (c.agg && c.agg !== 'count' && c.field && w.type === 'chart' && c.view !== 'histogram') parts.push(C.AGGS[c.agg].toLowerCase() + ' «' + fTitle(c.table, c.field) + '»');
    if (c.filterField && c.filterValue !== '' && c.filterValue != null) parts.push(fTitle(c.table, c.filterField) + ' = ' + c.filterValue);
    return parts.join(' · ');
  }

  function tools(w) {
    if (st.view) return '';
    return '<div class="dbb-tools"><span class="dbb-handle" draggable="true" title="Перетащите, чтобы поменять порядок">⠿</span>' +
      '<span class="dbb-kind">' + esc(w.type === 'chart' ? defaultTitle(w) : (C.ELEMENTS[w.type] || {}).title) + '</span>' +
      (w.type === 'section' ? '' : '<span class="dbb-size">' + ['s', 'm', 'l', 'xl'].map(function (s) {
        return '<button type="button" data-tool="size" data-size="' + s + '" class="' + (sizeOf(w) === s ? 'is-on' : '') + '" title="' + SIZE_TITLES[s] + '">' + s.toUpperCase() + '</button>';
      }).join('') + '</span>') +
      '<button type="button" data-tool="up" title="Раньше">◀</button><button type="button" data-tool="down" title="Позже">▶</button>' +
      '<button type="button" data-tool="cfg" title="Настроить">⚙</button><button type="button" data-tool="dup" title="Дублировать">⧉</button>' +
      '<button type="button" data-tool="del" class="dbb-del" title="Убрать">✕</button></div>';
  }

  function bindTips(box) {
    var tipEl = $('dbbTip');
    box.querySelectorAll('[data-tip]').forEach(function (n) {
      n.addEventListener('mousemove', function (e) {
        tipEl.innerHTML = n.getAttribute('data-tip');
        tipEl.hidden = false;
        var x = e.clientX + 14, y = e.clientY + 14;
        if (x + tipEl.offsetWidth > window.innerWidth - 8) x = e.clientX - tipEl.offsetWidth - 14;
        if (y + tipEl.offsetHeight > window.innerHeight - 8) y = e.clientY - tipEl.offsetHeight - 14;
        tipEl.style.left = x + 'px';
        tipEl.style.top = y + 'px';
      });
      n.addEventListener('mouseleave', function () { tipEl.hidden = true; });
    });
  }

  function widgetById(id) { return layout().widgets.filter(function (w) { return w.id === id; })[0]; }

  function addWidget(spec, open) {
    var w = { id: uid('w'), type: spec.type, size: spec.size || (C.ELEMENTS[spec.type] || {}).size || 'm', title: spec.title || '', cfg: clone(spec.cfg || {}) };
    layout().widgets.push(w);
    commit();
    if (open) openSettings(w, true);
    else flashAdded(w.id);
    return w;
  }

  function flashAdded(id) {
    var art = document.querySelector('.dbb-w[data-id="' + id + '"]');
    if (!art) return;
    art.classList.add('dbb-w--new');
    setTimeout(function () { art.classList.remove('dbb-w--new'); }, 1400);
  }

  /* ---------- шаг 1: цель и аудитория ---------- */

  function panelGoal(lay) {
    var m = lay.meta;
    var tpl = C.TEMPLATES.filter(function (t) { return t.id === m.template; })[0];
    return '<h3 class="dbb-ph">1. Цель и аудитория</h3>' +
      '<p class="dbb-tip">Хороший дашборд отвечает на 3–5 конкретных вопросов одного адресата. Сначала решите, <b>кто</b> смотрит и <b>какие решения</b> принимает. ' +
      'Быстрее всего начать с шаблона роли внизу.</p>' +
      '<label class="mdl-field"><span>Название дашборда</span><input data-meta="name" maxlength="80" value="' + esc(lay.name) + '"></label>' +
      '<div class="mdl-field"><span>Тип дашборда</span><div class="dbb-kinds">' + C.KINDS.map(function (k) {
        return '<button type="button" class="dbb-kindcard' + (m.kind === k.id ? ' is-on' : '') + '" data-kind="' + k.id + '"><b>' + esc(k.title) + '</b><span>' + esc(k.hint) + '</span></button>';
      }).join('') + '</div></div>' +
      '<label class="mdl-field"><span>Для кого (аудитория)</span><input data-meta="audience" maxlength="160" value="' + esc(m.audience) + '" placeholder="например: проректор, учёный совет"></label>' +
      '<label class="mdl-field"><span>Цель: какие решения поддерживает</span><textarea data-meta="purpose" rows="2" maxlength="400" placeholder="например: решать, какие проекты поддержать, а какие закрыть">' + esc(m.purpose) + '</textarea></label>' +
      '<label class="mdl-field"><span>Ключевые вопросы (по одному в строке)</span><textarea data-meta="questions" rows="3" maxlength="800" placeholder="Сколько проектов застряло?&#10;Где теряются деньги?">' + esc(m.questions) + '</textarea></label>' +
      '<label class="mdl-field"><span>Как часто смотрят</span><select data-meta="period">' + ['', 'ежедневно', 'еженедельно', 'ежемесячно', 'ежеквартально', 'к заседанию / сессии'].map(function (p) {
        return '<option value="' + esc(p) + '"' + (m.period === p ? ' selected' : '') + '>' + esc(p || '—') + '</option>';
      }).join('') + '</select></label>' +
      '<div class="dbb-sub">Шаблоны ролей</div>' +
      '<p class="dbb-hint">Шаблон заполнит пустые поля цели и подскажет элементы на шагах 3–4. На холст ничего не добавляется без вашего нажатия. ' +
      'Цели и пороги в шаблонах — примерные: замените их своими (кнопка ⚙ на элементе).</p>' +
      '<div class="dbb-cards">' + C.TEMPLATES.map(function (t) {
        return '<button type="button" class="dbb-card' + (m.template === t.id ? ' is-on' : '') + '" data-template="' + t.id + '"><b>' + esc(t.title) + '</b><span>' + esc(t.audience) + '</span></button>';
      }).join('') + '</div>' +
      (tpl ? '<div class="dbb-tplbox"><b>Вопросы шаблона «' + esc(tpl.title) + '»</b><ul>' + tpl.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>' +
        (tpl.dataNote ? '<p class="dbb-hint">' + esc(tpl.dataNote) + '</p>' : '') + tplButton(tpl) + '</div>' : '') +
      navHtml();
  }

  /* Кнопка «собрать по шаблону»: сколько элементов шаблона строится по текущим данным */
  function tplButton(tpl) {
    var n = recipes(tpl).length, all = tpl.recipes.length;
    var have = existingKeys();
    var fresh = recipes(tpl).filter(function (r) { return !have[sugKey(r)]; }).length;
    return '<button class="btn-primary pg-btn-small" type="button" data-tpl-all="' + tpl.id + '"' + (fresh ? '' : ' disabled') + '>' +
      (fresh ? 'Собрать дашборд по шаблону: добавить ' + fresh + ' элем.' : 'Все элементы шаблона уже на дашборде') + '</button>' +
      (n < all ? '<p class="dbb-hint">' + (all - n) + ' из ' + all + ' элементов шаблона не строятся по текущим данным — для них нужны другие таблицы (шаг 2).</p>' : '');
  }

  function recipes(tpl) {
    return tpl.recipes.filter(function (r) {
      var c = r.cfg || {};
      if (r.type === 'note' || r.type === 'actions' || r.type === 'section') return true;
      if (!table(c.table)) return false;
      return ['field', 'groupBy', 'groupBy2', 'filterField', 'shareField', 'labelField', 'valueField', 'dateField'].every(function (k) { return !c[k] || field(c.table, c[k]); });
    });
  }

  function applyTemplate(id) {
    var t = C.TEMPLATES.filter(function (x) { return x.id === id; })[0];
    var l = layout();
    l.meta.template = id;
    if (!l.meta.kind) l.meta.kind = t.kind;
    if (!l.meta.audience) l.meta.audience = t.audience;
    if (!l.meta.purpose) l.meta.purpose = t.purpose;
    if (!l.meta.questions) l.meta.questions = t.questions.join('\n');
    if (/^(Новый|Мой) дашборд/.test(l.name)) l.name = t.title;
    commit();
  }

  /* ---------- шаг 2: данные ---------- */

  var MANUAL_ORDER = ['indicators', 'projects', 'patents', 'teams', 'venture_tracker'];

  function panelData(lay) {
    var src = lay.source || { kind: 'demo' };
    var sk = src.kind === 'upload' || src.kind === 'manual' ? src.kind : 'demo';
    var d = data();
    var keys = Object.keys(d);
    var tpl = C.TEMPLATES.filter(function (t) { return t.id === lay.meta.template; })[0];
    var html = '<h3 class="dbb-ph">2. Данные</h3>' +
      '<p class="dbb-tip">Выберите, откуда взять данные. <b>Нет готовых файлов — не страшно:</b> выберите «Ввести свои данные вручную» и заполните ' +
      'готовые таблицы прямо здесь или вставьте строки из Excel.</p>' +
      '<div class="dbb-sources">' +
      '<button type="button" class="dbb-kindcard' + (sk === 'demo' ? ' is-on' : '') + '" data-source="demo"><b>Пример: демо-данные</b>' +
        '<span>Условный вуз: проекты, РИД, стартап-коллективы, обязательства стартапов — как на «Примере дашборда». Чтобы посмотреть, как всё работает.</span></button>' +
      '<button type="button" class="dbb-kindcard' + (sk === 'manual' ? ' is-on' : '') + '" data-source="manual"><b>Ввести свои данные вручную</b>' +
        '<span>Готовые таблицы: сводные показатели, проекты, РИД, команды, обязательства. Заполните то, по чему есть данные.</span></button>' +
      '<label class="dbb-kindcard' + (sk === 'upload' ? ' is-on' : '') + '"><b>Загрузить файл: CSV или JSON</b><span>' +
        (sk === 'upload' ? 'Загружен: ' + esc(src.name || 'файл') + '. Нажмите, чтобы заменить' : 'Таблица из Excel, сохранённая как CSV. До ' + MAX_ROWS + ' строк') + '</span>' +
        '<input type="file" id="dbbUpload" accept=".csv,.json,.txt,text/csv,application/json" hidden></label></div>';

    if (sk === 'manual') {
      var t = src.tables || {};
      html += '<div class="dbb-sub">Таблицы для ввода</div>' +
        '<p class="dbb-hint">Заполните одну-две таблицы, по которым у вас есть данные. Остальные можно не трогать — на дашборде будут только заполненные.</p>' +
        '<div class="dbb-mtables">' + MANUAL_ORDER.map(function (k) {
          var m = C.MANUAL[k], n = (t[k] || []).length;
          return '<div class="dbb-mtable' + (n ? ' is-filled' : '') + '"><div class="dbb-mtable-head"><b>' + esc(m.title) + '</b><span>' + (n ? n + ' строк' : 'не заполнена') + '</span></div>' +
            '<p>' + esc(m.hint) + '</p><div class="dbb-quick"><button type="button" class="' + (n ? 'btn-register' : 'btn-primary') + ' pg-btn-small" data-manual-open="' + k + '">' + (n ? 'Изменить данные' : 'Заполнить') + '</button>' +
            '<button type="button" class="dbb-link" data-manual-csv="' + k + '">Шаблон для Excel</button></div></div>';
        }).join('') + '</div>';
    }

    html += '<details class="dbb-help"' + (sk === 'upload' && !keys.length ? ' open' : '') + '><summary>Как подготовить файл в Excel</summary><ol>' +
      '<li>Первая строка — названия столбцов, дальше — по строке на объект (проект, РИД, показатель).</li>' +
      '<li>Суммы — в <b>тысячах рублей</b>, даты — в виде 31.12.2026, проценты — числом от 0 до 100.</li>' +
      '<li>В Excel: «Файл» → «Сохранить как» → тип «CSV (разделители — запятые)». В русской версии Excel разделителем будет «;» — это нормально.</li>' +
      '<li>Удобнее всего начать с шаблона: ' + MANUAL_ORDER.map(function (k) {
        return '<button type="button" class="dbb-link" data-manual-csv="' + k + '">' + esc(C.MANUAL[k].title) + '</button>';
      }).join(', ') + '. Файл по шаблону конструктор узнает сам, и для него сработают шаблоны ролей.</li></ol></details>';

    if (keys.length) {
      html += '<div class="dbb-sub">Что получилось: таблицы и поля</div>' +
        '<p class="dbb-hint">Конструктор сам определяет тип каждого поля — от него зависит, какие показатели и графики он предложит. Если тип определился неверно, поправьте его в списке.</p>' +
        keys.map(function (k) {
          var tb = d[k];
          return '<details class="dbb-profile"' + (keys.length === 1 ? ' open' : '') + '><summary><b>' + esc(tb.title) + '</b> <span>' + tb.rows.length + ' строк · ' + Object.keys(tb.fields).length + ' полей</span></summary>' +
            '<table class="dbb-ptable"><tbody>' + Object.keys(tb.fields).map(function (f) {
              var x = tb.fields[f];
              return '<tr><td><b>' + esc(x.title) + '</b><div class="cell-sub">' + esc(x.top.slice(0, 3).join(' · ')) + '</div></td>' +
                '<td><select data-kindfield="' + esc(k + '.' + f) + '" aria-label="Тип поля ' + esc(x.title) + '">' + Object.keys(KIND_TITLES).map(function (kk) {
                  return '<option value="' + kk + '"' + (kk === x.kind ? ' selected' : '') + '>' + KIND_TITLES[kk] + '</option>';
                }).join('') + '</select></td><td class="num">' + x.distinct + '<div class="cell-sub">разных</div></td></tr>';
            }).join('') + '</tbody></table></details>';
        }).join('') +
        '<p class="dbb-hint"><b>Категория</b> — повторяющиеся значения (подразделение, статус): для разрезов и долей. <b>Шкала / год</b> — УГТ, годы, этапы: для столбцов и воронок. ' +
        '<b>Число, деньги, проценты</b> — для сумм и средних. <b>Дата</b> — для сроков. <b>Название</b> — подписи строк.</p>';
    } else {
      html += '<p class="dbb-warn">' + (st.demo === null ? 'Загрузка данных…' : sk === 'manual' ? 'Пока нет данных: откройте любую таблицу выше и заполните хотя бы одну строку.' : 'В источнике нет таблиц с данными.') + '</p>';
    }

    if (keys.length) {
      html += tpl
        ? '<div class="dbb-tplbox"><b>Готовый дашборд по шаблону «' + esc(tpl.title) + '»</b>' + (tpl.dataNote ? '<p class="dbb-hint">' + esc(tpl.dataNote) + '</p>' : '') + tplButton(tpl) + '</div>'
        : '<p class="dbb-hint">Хотите готовый дашборд одной кнопкой? Выберите шаблон роли на <button type="button" class="dbb-link" data-step="goal">шаге 1</button>.</p>';
      html += '<label class="imdl-check"><input type="checkbox" data-confirm-data' + (lay.meta.dataConfirmed ? ' checked' : '') + '> Данные проверены: таблицы и типы полей верные</label>';
    }
    return html + navHtml();
  }

  /* ---------- ручной ввод данных ---------- */

  function emptyRow(tk) { var o = {}; C.MANUAL[tk].cols.forEach(function (c) { o[c.key] = ''; }); return o; }

  /* демо-данные в виде строк ручного ввода — «подставить пример» */
  function demoRows(tk) {
    var raw = st.demoRaw;
    if (!raw || !Array.isArray(raw[tk])) return [];
    var stages = {};
    (raw.funding_stages || []).forEach(function (x) { stages[x.key] = x.title; });
    var proj = {};
    (raw.projects || []).forEach(function (x) { proj[x.id] = x.title; });
    var persp = { high: 'Высокая', low: 'Низкая' };
    var fund = { grant: 'Другие гранты', internal: 'Внутреннее финансирование', state: 'Госзадание' };
    return raw[tk].map(function (r) {
      var o = emptyRow(tk);
      C.MANUAL[tk].cols.forEach(function (c) { if (r[c.key] != null) o[c.key] = r[c.key]; });
      if (tk === 'projects') o.funding_stage = stages[r.funding_stage] || r.funding_stage || '';
      if (tk === 'patents') o.perspective = persp[r.perspective] || r.perspective || '';
      if (tk === 'teams') { o.funding = fund[r.funding] || r.funding || ''; o.project = proj[r.project] || r.project || ''; }
      return o;
    });
  }

  function cellValue(col, v) {
    if (v == null) return '';
    var x = String(v).trim();
    if (x === '') return '';
    if (col.type === 'int' || col.type === 'num') {
      var n = Number(x.replace(/\s/g, '').replace(',', '.').replace(/%$/, ''));
      if (isNaN(n)) return x;
      return col.type === 'int' ? Math.round(n) : n;
    }
    if (col.type === 'date') return String(normalizeCell(x));
    return x;
  }

  function convRow(tk, r) {
    var o = {};
    C.MANUAL[tk].cols.forEach(function (c) { o[c.key] = cellValue(c, r[c.key]); });
    return o;
  }

  function rowErrors(tk, r) {
    var errs = [];
    C.MANUAL[tk].cols.forEach(function (c) {
      var v = r[c.key];
      if (v === '' || v == null) return;
      if ((c.type === 'int' || c.type === 'num') && typeof v !== 'number') errs.push('«' + c.title + '»: нужно число');
      else if (typeof v === 'number' && ((c.min != null && v < c.min) || (c.max != null && v > c.max))) errs.push('«' + c.title + '»: от ' + c.min + ' до ' + c.max);
      if (c.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errs.push('«' + c.title + '»: дата в виде 31.12.2026');
    });
    return errs;
  }

  function openManual(tk) {
    var lay = layout();
    var saved = ((lay.source && lay.source.tables) || {})[tk] || [];
    var m = C.MANUAL[tk];
    var rows = saved.length ? clone(saved) : (m.starter ? clone(m.starter) : []);
    while (rows.length < 3) rows.push(emptyRow(tk));
    st.manual = { tk: tk, rows: rows, paste: false };
    drawManual();
    $('dbbDataModal').hidden = false;
    var first = $('dbbDataBody').querySelector('input');
    if (first) first.focus();
  }

  function drawManual() {
    var mm = st.manual, m = C.MANUAL[mm.tk];
    $('dbbDataTitle').textContent = 'Ввод данных: ' + m.title;
    var lists = m.cols.filter(function (c) { return c.options; }).map(function (c) {
      return '<datalist id="dbbList-' + c.key + '">' + c.options.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>';
    }).join('');
    var hasDemo = st.demoRaw && Array.isArray(st.demoRaw[mm.tk]);
    $('dbbDataBody').innerHTML = '<p class="dbb-tip">' + esc(m.hint) + (m.starter ? ' Названия показателей — примеры: замените их показателями вашей программы развития.' : '') + '</p>' +
      '<div class="dbb-quick">' +
        '<button type="button" class="btn-register pg-btn-small" data-m="add">+ Добавить строку</button>' +
        '<button type="button" class="btn-register pg-btn-small" data-m="paste">' + (mm.paste ? 'Скрыть вставку' : 'Вставить из Excel') + '</button>' +
        (hasDemo ? '<button type="button" class="btn-register pg-btn-small" data-m="demo">Подставить пример</button>' : '') +
        '<button type="button" class="btn-register pg-btn-small" data-m="csv">Скачать шаблон для Excel</button>' +
        '<button type="button" class="btn-register pg-btn-small" data-m="clear">Очистить таблицу</button></div>' +
      (mm.paste ? '<div class="dbb-paste"><p class="dbb-hint">Выделите в Excel строки с данными, скопируйте (Ctrl+C) и вставьте сюда (Ctrl+V). Порядок столбцов: <b>' +
        m.cols.map(function (c) { return esc(c.title); }).join(' · ') + '</b>. Строку заголовков можно не убирать.</p>' +
        '<textarea id="dbbPasteText" rows="5" placeholder="Вставьте строки из Excel"></textarea>' +
        '<div class="dbb-quick"><button type="button" class="btn-primary pg-btn-small" data-m="paste-apply">Добавить строки в таблицу</button></div></div>' : '') +
      lists +
      '<div class="dbb-grid-wrap"><table class="dbb-grid"><thead><tr><th class="dbb-grid-n">№</th>' + m.cols.map(function (c) {
        return '<th class="' + (c.width === 'wide' ? 'is-wide' : '') + '">' + esc(c.title) + '</th>';
      }).join('') + '<th></th></tr></thead><tbody>' + mm.rows.map(function (r, i) {
        var errs = rowErrors(mm.tk, convRow(mm.tk, r));
        return '<tr' + (errs.length ? ' class="has-err" title="' + esc(errs.join('; ')) + '"' : '') + '><td class="dbb-grid-n">' + (i + 1) + '</td>' + m.cols.map(function (c) {
          var v = r[c.key] == null ? '' : r[c.key];
          var attrs = ' data-cell="' + i + ':' + c.key + '" aria-label="' + esc(c.title) + ', строка ' + (i + 1) + '"';
          if (c.type === 'date') return '<td><input type="date"' + attrs + ' value="' + esc(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? v : '') + '"></td>';
          if (c.type === 'int' || c.type === 'num') return '<td><input inputmode="decimal" class="num"' + attrs + ' value="' + esc(v) + '"></td>';
          return '<td' + (c.width === 'wide' ? ' class="is-wide"' : '') + '><input' + attrs + (c.options ? ' list="dbbList-' + c.key + '"' : '') + ' value="' + esc(v) + '" title="' + esc(v) + '"></td>';
        }).join('') + '<td><button type="button" class="dbb-grid-del" data-m="del:' + i + '" title="Удалить строку">✕</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="dbb-hint">' + (m.cols.some(function (c) { return /тыс\. ₽/.test(c.title); }) ? 'Суммы — в тысячах рублей. ' : '') +
        'Даты можно вписать как 31.12.2026 или выбрать в календаре. В столбцах со списком можно выбрать готовое значение или вписать своё. ' +
        'Обязательно заполните «' + m.need.map(function (k) { return m.cols.filter(function (c) { return c.key === k; })[0].title; }).join('» или «') + '» — пустые строки не сохраняются.</p>' +
      '<p class="pg-msg" id="dbbDataMsg" role="status"></p>' +
      '<div class="dbb-form-actions"><button type="button" class="btn-primary" data-m="save">Сохранить и показать на дашборде</button>' +
      '<button type="button" class="btn-register" data-m="cancel">Отмена</button></div>';
  }

  function manualMsg(text) { var n = $('dbbDataMsg'); if (n) n.textContent = text; }

  function isEmptyRow(r) { return Object.keys(r).every(function (k) { return r[k] === '' || r[k] == null; }); }

  function pasteRows(tk, text) {
    var m = C.MANUAL[tk];
    var lines = String(text || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim() !== ''; });
    var sep = lines.some(function (l) { return l.indexOf('\t') >= 0; }) ? '\t' : ';';
    var norm = function (x) { return String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(); };
    var out = [];
    lines.forEach(function (l, li) {
      var cells = l.split(sep);
      if (li === 0 && norm(cells[0]) === norm(m.cols[0].title)) return;  // строка заголовков
      var o = emptyRow(tk);
      m.cols.forEach(function (c, i) { o[c.key] = cellValue(c, cells[i]); });
      if (!isEmptyRow(o)) out.push(o);
    });
    return out;
  }

  function saveManual() {
    var mm = st.manual, m = C.MANUAL[mm.tk];
    var rows = mm.rows.map(function (r) { return convRow(mm.tk, r); });
    var kept = rows.filter(function (r) { return m.need.some(function (k) { return r[k] !== '' && r[k] != null; }); });
    var dropped = rows.filter(function (r) { return !isEmptyRow(r); }).length - kept.length;
    var bad = kept.filter(function (r) { return rowErrors(mm.tk, r).length; }).length;
    if (bad && !confirm('В ' + bad + ' строк(ах) есть ошибки (подсвечены красным, подробности — при наведении). Сохранить как есть?')) {
      mm.rows = rows; drawManual(); return;
    }
    if (dropped > 0 && !confirm(dropped + ' строк(и) не будут сохранены: в них не заполнено «' +
        m.need.map(function (k) { return m.cols.filter(function (c) { return c.key === k; })[0].title; }).join('» или «') + '». Продолжить?')) return;
    var l = layout();
    if (!l.source || l.source.kind !== 'manual') l.source = { kind: 'manual', name: 'Данные, введённые вручную', tables: {} };
    l.source.tables = l.source.tables || {};
    l.source.tables[mm.tk] = kept.slice(0, MAX_ROWS);
    l.meta.dataConfirmed = false;
    st.dataRev++;
    st.manual = null;
    $('dbbDataModal').hidden = true;
    commit();
    if (JSON.stringify(l.source).length > 550000) status('Данных много: на платформе они могут не сохраниться (лимит 600 КБ на дашборд), копия останется в браузере');
  }

  function bindManual() {
    var overlay = $('dbbDataModal'), body = $('dbbDataBody');
    var close = function () {
      if (st.manual && st.manual.dirty && !confirm('Закрыть без сохранения? Введённые данные пропадут.')) return;
      st.manual = null; overlay.hidden = true;
    };
    $('dbbDataClose').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });
    body.addEventListener('input', function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-cell');
      if (!c || !st.manual) return;
      var p = c.split(':');
      st.manual.rows[Number(p[0])][p[1]] = e.target.value;
      st.manual.dirty = true;
    });
    /* проверка строки по выходу из ячейки: ошибка подсвечивается сразу */
    body.addEventListener('change', function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-cell');
      if (!c || !st.manual) return;
      var i = Number(c.split(':')[0]);
      var errs = rowErrors(st.manual.tk, convRow(st.manual.tk, st.manual.rows[i]));
      var tr = e.target.closest('tr');
      tr.classList.toggle('has-err', errs.length > 0);
      if (errs.length) tr.setAttribute('title', errs.join('; ')); else tr.removeAttribute('title');
      manualMsg(errs.length ? 'Строка ' + (i + 1) + ': ' + errs.join('; ') : '');
    });
    body.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-m]');
      if (!b || !st.manual) return;
      var act = b.getAttribute('data-m'), mm = st.manual;
      if (act === 'add') { mm.rows.push(emptyRow(mm.tk)); drawManual(); var ins = body.querySelectorAll('tbody tr:last-child input'); if (ins[0]) ins[0].focus(); }
      else if (act === 'paste') { mm.paste = !mm.paste; drawManual(); if (mm.paste) $('dbbPasteText').focus(); }
      else if (act === 'paste-apply') {
        var add = pasteRows(mm.tk, $('dbbPasteText').value);
        if (!add.length) { manualMsg('Не нашлось строк для вставки — скопируйте ячейки из Excel и вставьте в поле.'); return; }
        mm.rows = mm.rows.filter(function (r) { return !isEmptyRow(r) && !(C.MANUAL[mm.tk].starter && r.plan === '' && r.fact === ''); }).concat(add);
        mm.paste = false; mm.dirty = true;
        drawManual();
        manualMsg('Добавлено строк: ' + add.length + '. Проверьте и нажмите «Сохранить».');
      } else if (act === 'demo') {
        if (mm.rows.some(function (r) { return !isEmptyRow(r); }) && !confirm('Заменить содержимое таблицы примером из демо-данных?')) return;
        mm.rows = demoRows(mm.tk); mm.dirty = true; drawManual();
        manualMsg('Подставлен пример. Замените значения своими или сохраните, чтобы посмотреть, как выглядит дашборд.');
      } else if (act === 'csv') downloadTemplate(mm.tk);
      else if (act === 'clear') {
        if (!confirm('Очистить все строки таблицы?')) return;
        mm.rows = [emptyRow(mm.tk), emptyRow(mm.tk), emptyRow(mm.tk)]; mm.dirty = true; drawManual();
      } else if (act.indexOf('del:') === 0) { mm.rows.splice(Number(act.slice(4)), 1); if (!mm.rows.length) mm.rows.push(emptyRow(mm.tk)); mm.dirty = true; drawManual(); }
      else if (act === 'save') saveManual();
      else if (act === 'cancel') close();
    });
  }

  /* Шаблон CSV для Excel: разделитель «;», BOM — чтобы Excel открыл кириллицу */
  function downloadTemplate(tk) {
    var m = C.MANUAL[tk];
    var q = function (v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [m.cols.map(function (c) { return q(c.title); }).join(';')];
    (m.starter || []).forEach(function (r) { lines.push(m.cols.map(function (c) { return q(r[c.key]); }).join(';')); });
    var blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'шаблон — ' + m.title + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 500);
  }

  /* CSV, сохранённый из шаблона: узнаём таблицу ручного ввода по заголовкам */
  function matchManual(rows) {
    if (!rows.length) return null;
    var norm = function (x) { return String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(); };
    var heads = {};
    Object.keys(rows[0]).forEach(function (h) { heads[norm(h)] = h; });
    var best = null;
    Object.keys(C.MANUAL).forEach(function (tk) {
      var cols = C.MANUAL[tk].cols;
      var hit = cols.filter(function (c) { return heads[norm(c.title)]; });
      var needOk = C.MANUAL[tk].need.some(function (k) { return cols.some(function (c) { return c.key === k && heads[norm(c.title)]; }); });
      if (needOk && hit.length >= Math.max(2, Math.ceil(cols.length * 0.6)) && (!best || hit.length > best.hit)) best = { tk: tk, hit: hit.length };
    });
    if (!best) return null;
    var m = C.MANUAL[best.tk];
    return { tk: best.tk, rows: rows.map(function (r) {
      var o = {};
      m.cols.forEach(function (c) { var h = heads[norm(c.title)]; o[c.key] = h ? cellValue(c, r[h]) : ''; });
      return o;
    }).filter(function (r) { return m.need.some(function (k) { return r[k] !== '' && r[k] != null; }); }) };
  }

  function readUpload(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var text = String(reader.result || '');
        var src;
        if (/\.json$/i.test(file.name) || /^\s*[\[{]/.test(text)) {
          var obj = JSON.parse(text);
          if (isAiosShape(obj)) {
            src = { kind: 'upload', name: file.name, shape: 'aios', raw: obj };
          } else {
            var tables = {};
            if (Array.isArray(obj)) tables.data = { title: file.name.replace(/\.[^.]+$/, ''), rows: obj.slice(0, MAX_ROWS) };
            else Object.keys(obj).forEach(function (k) {
              if (Array.isArray(obj[k]) && obj[k].length && typeof obj[k][0] === 'object') tables[k] = { title: k, rows: obj[k].slice(0, MAX_ROWS) };
            });
            if (!Object.keys(tables).length) throw new Error('в JSON не нашлось таблиц — нужен массив объектов');
            Object.keys(tables).forEach(function (k) {
              tables[k].rows = tables[k].rows.map(function (r) { var o = {}; Object.keys(r || {}).forEach(function (f) { o[f] = typeof r[f] === 'object' && r[f] !== null ? JSON.stringify(r[f]) : normalizeCell(r[f]); }); return o; });
            });
            src = { kind: 'upload', name: file.name, shape: 'generic', tables: tables };
          }
        } else {
          var parsed = parseCsv(text);
          var match = matchManual(parsed);
          if (match) {
            /* файл по шаблону — становится таблицей ручного ввода: её можно поправить и к ней подходят шаблоны ролей */
            var cur = layout().source;
            var tables = cur && cur.kind === 'manual' ? clone(cur.tables || {}) : {};
            tables[match.tk] = match.rows.slice(0, MAX_ROWS);
            src = { kind: 'manual', name: 'Данные, введённые вручную', tables: tables };
            setTimeout(function () { status('Файл «' + file.name + '» узнан как таблица «' + C.MANUAL[match.tk].title + '» (' + match.rows.length + ' строк). Поправить данные можно кнопкой «Изменить данные».'); }, 50);
          } else {
            src = { kind: 'upload', name: file.name, shape: 'generic', tables: { data: { title: file.name.replace(/\.[^.]+$/, ''), rows: parsed } } };
          }
        }
        var l = layout();
        if (l.widgets.length && !confirm('Сменить источник данных? Элементы, построенные по старым полям, могут показать предупреждение — их можно перенастроить (⚙).')) return;
        l.source = src;
        l.meta.kinds = {};
        l.meta.dataConfirmed = false;
        st.vizTable = '';
        st.dataRev++;
        commit();
        if (JSON.stringify(src).length > 550000) status('Файл большой: на платформе он может не сохраниться (лимит 600 КБ на дашборд), копия останется в браузере');
      } catch (err) {
        alert('Не удалось прочитать файл: ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ---------- предложения: KPI и визуализации по данным ---------- */

  function sugKey(s) { return JSON.stringify([s.type, s.cfg.table, s.cfg.view, s.cfg.agg, s.cfg.field, s.cfg.groupBy, s.cfg.groupBy2, s.cfg.filterValue, s.cfg.shareValue, s.cfg.labelField, s.cfg.valueField, s.cfg.dateField]); }

  function existingKeys() {
    var m = {};
    layout().widgets.forEach(function (w) { if (w.cfg) m[sugKey(w)] = true; });
    return m;
  }

  var ALERT_WORDS = /(просроч|кандидат|риск|низк|без лиценз|закрыт|отказ)/i;

  function kpiSuggestions() {
    var out = [];
    var tpl = C.TEMPLATES.filter(function (t) { return t.id === layout().meta.template; })[0];
    if (tpl) recipes(tpl).forEach(function (r) { if (r.type === 'kpi' || r.type === 'goal') out.push({ spec: r, why: 'Из шаблона «' + tpl.title + '»' }); });
    var d = data();
    Object.keys(d).forEach(function (tk) {
      var t = d[tk];
      out.push({ spec: { type: 'kpi', title: t.title + ': всего', cfg: { table: tk, agg: 'count' } }, why: 'Сколько всего — первое, что спрашивают о любом портфеле' });
      fieldsOf(tk, function (x) { return x.kind === 'money'; }).forEach(function (f) {
        out.push({ spec: { type: 'kpi', title: fTitle(tk, f) + ': всего', cfg: { table: tk, agg: 'sum', field: f } }, why: 'Деньги в сумме — масштаб ресурсов' });
      });
      fieldsOf(tk, function (x) { return x.kind === 'num' || x.kind === 'pct'; }).forEach(function (f) {
        out.push({ spec: { type: 'kpi', title: fTitle(tk, f) + ': среднее', cfg: { table: tk, agg: 'avg', field: f, unit: fKind(tk, f) === 'pct' ? '%' : '' } }, why: 'Среднее — типичное значение по портфелю' });
      });
      fieldsOf(tk, function (x) { return x.kind === 'cat' && x.distinct >= 2 && x.distinct <= 5; }).forEach(function (f) {
        var vals = t.fields[f].top;
        var v = vals.filter(function (x) { return ALERT_WORDS.test(x); })[0];
        if (v) {
          out.push({ spec: { type: 'kpi', title: v + ': количество', cfg: { table: tk, agg: 'count', filterField: f, filterValue: v, target: 0, direction: 'down' } }, why: 'Сигнал проблемы: красный, если больше нуля' });
          out.push({ spec: { type: 'kpi', title: 'Доля «' + v + '»', cfg: { table: tk, agg: 'share', shareField: f, shareValue: v } }, why: 'Доля нагляднее количества при сравнении периодов' });
        } else {
          out.push({ spec: { type: 'kpi', title: 'Доля «' + vals[0] + '»', cfg: { table: tk, agg: 'share', shareField: f, shareValue: vals[0] } }, why: 'Структура портфеля одной цифрой' });
        }
      });
      var g = firstField(tk, function (x) { return x.kind === 'pct'; });
      if (g) out.push({ spec: { type: 'goal', title: 'План-факт: ' + fTitle(tk, g), cfg: { table: tk, agg: 'avg', field: g, target: 100, unit: '%', deadline: 'к концу периода' } }, why: 'Цель превращает число в управленческий сигнал' });
    });
    return dedupe(out);
  }

  function vizSuggestions(tk) {
    var out = [];
    var tpl = C.TEMPLATES.filter(function (t) { return t.id === layout().meta.template; })[0];
    if (tpl) recipes(tpl).forEach(function (r) { if (r.type !== 'kpi' && r.type !== 'goal' && (!r.cfg.table || r.cfg.table === tk)) out.push({ spec: r, why: 'Из шаблона «' + tpl.title + '»' }); });
    var t = table(tk);
    if (!t) return out;
    var cats = fieldsOf(tk, function (x) { return x.kind === 'cat' && x.distinct >= 2 && x.distinct <= 15; });
    var ords = fieldsOf(tk, function (x) { return x.kind === 'ord' && x.distinct >= 2; });
    var moneyF = firstField(tk, function (x) { return x.kind === 'money'; }) || firstField(tk, function (x) { return x.kind === 'num'; });
    var label = firstField(tk, function (x) { return x.kind === 'text'; }) || firstField(tk, function (x) { return x.kind === 'cat' && x.distinct > 3; });
    var dateF = firstField(tk, function (x) { return x.kind === 'date'; });
    var pctF = firstField(tk, function (x) { return x.kind === 'pct'; });
    ords.forEach(function (f) {
      out.push({ spec: { type: 'chart', title: 'Воронка по полю «' + fTitle(tk, f) + '»', size: 'l', cfg: { table: tk, view: 'funnel', groupBy: f, agg: 'count', cumulative: true } }, why: 'Шкала по порядку — видно, где теряются объекты между стадиями' });
      out.push({ spec: { type: 'chart', title: 'Распределение по «' + fTitle(tk, f) + '»', cfg: { table: tk, view: 'columns', groupBy: f, agg: 'count' } }, why: 'Столбцы идут в порядке шкалы' });
    });
    cats.forEach(function (f) {
      var dn = t.fields[f].distinct;
      out.push({ spec: { type: 'chart', title: fTitle(tk, f) + ': ' + (dn <= 6 ? 'доли' : 'сравнение'), size: dn <= 6 ? 's' : 'm', cfg: { table: tk, view: dn <= 6 ? 'donut' : 'bars', groupBy: f, agg: 'count', top: 8 } },
        why: dn <= 6 ? dn + ' категорий — подходит кольцо' : dn + ' категорий — для кольца много, лучше полосы' });
      if (moneyF) out.push({ spec: { type: 'chart', title: fTitle(tk, moneyF) + ' по «' + fTitle(tk, f) + '»', cfg: { table: tk, view: 'bars', groupBy: f, agg: 'sum', field: moneyF, top: 8 } }, why: 'Куда идут ресурсы в этом разрезе' });
    });
    if (cats.length >= 2) {
      var a = cats.filter(function (f) { return t.fields[f].distinct > 3; })[0] || cats[0];
      var b = cats.filter(function (f) { return f !== a && t.fields[f].distinct <= 5; })[0] || cats.filter(function (f) { return f !== a; })[0];
      out.push({ spec: { type: 'chart', title: fTitle(tk, b) + ' в разрезе «' + fTitle(tk, a) + '»', cfg: { table: tk, view: 'stacked', groupBy: a, groupBy2: b, agg: 'count' } }, why: 'Две категории — структура внутри каждой группы' });
      out.push({ spec: { type: 'chart', title: 'Матрица: ' + fTitle(tk, a) + ' × ' + fTitle(tk, b), size: 'l', cfg: { table: tk, view: 'matrix', groupBy: a, groupBy2: b, agg: moneyF ? 'sum' : 'count', field: moneyF } }, why: 'Концентрация на пересечении двух разрезов' });
    }
    if (moneyF) out.push({ spec: { type: 'chart', title: 'Распределение: ' + fTitle(tk, moneyF), cfg: { table: tk, view: 'histogram', field: moneyF } }, why: 'Какие значения типичны, а какие выбиваются' });
    if (moneyF && label) out.push({ spec: { type: 'chart', title: 'Топ по «' + fTitle(tk, moneyF) + '»', cfg: { table: tk, view: 'top', labelField: label, valueField: moneyF, top: 5 } }, why: 'Лидеры — кому уделить внимание в первую очередь' });
    if (pctF && (label || cats[0])) out.push({ spec: { type: 'chart', title: 'Выполнение: ' + fTitle(tk, pctF), cfg: { table: tk, view: 'progress', labelField: label || cats[0], valueField: pctF } }, why: 'Проценты выполнения — светофор по каждому объекту' });
    if (dateF && (label || cats[0])) out.push({ spec: { type: 'chart', title: 'Сроки: ' + fTitle(tk, dateF), size: 'l', cfg: { table: tk, view: 'timeline', labelField: label || cats[0], dateField: dateF, valueField: pctF } }, why: 'Даты — что просрочено и что наступает' });
    out.push({ spec: { type: 'table', title: 'Детали: ' + t.title, size: 'l', cfg: { table: tk, columns: Object.keys(t.fields).filter(function (f) { return f.charAt(0) !== '_'; }).slice(0, 5), limit: 10 } }, why: 'Таблица — под графиками, для проверки деталей' });
    return dedupe(out);
  }

  function dedupe(list) {
    var seen = {};
    return list.filter(function (s) { var k = sugKey(s.spec); if (seen[k]) return false; seen[k] = true; return true; });
  }

  function sugCards(list, kind) {
    var have = existingKeys();
    return '<div class="dbb-sugs">' + list.map(function (s, i) {
      var added = have[sugKey(s.spec)];
      var w = { id: 'p' + i, type: s.spec.type, cfg: s.spec.cfg };
      return '<div class="dbb-sug' + (added ? ' is-added' : '') + '"><div class="dbb-sug-head"><b>' + esc(s.spec.title || defaultTitle(w)) + '</b>' +
        '<button type="button" class="btn-register pg-btn-small" data-sug="' + kind + ':' + i + '"' + (added ? ' disabled' : '') + '>' + (added ? '✓ на дашборде' : '+ Добавить') + '</button></div>' +
        '<div class="dbb-sug-why">' + esc(s.why) + '</div><div class="dbb-mini">' + renderBody(w) + '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- шаг 3: показатели ---------- */

  function panelKpi() {
    st.kpiSugs = kpiSuggestions();
    return '<h3 class="dbb-ph">3. Ключевые показатели</h3>' +
      '<p class="dbb-tip">Выберите 3–7 KPI, которые отвечают на вопросы шага 1. Задайте цель или порог — карточка станет светофором. Предложения построены по вашим данным.</p>' +
      '<div class="dbb-quick"><button class="btn-primary pg-btn-small" type="button" data-new="kpi">+ Своя карточка KPI</button>' +
      '<button class="btn-register pg-btn-small" type="button" data-new="goal">+ Свой план-факт</button></div>' +
      '<div class="dbb-sub">Предложения конструктора</div>' + sugCards(st.kpiSugs, 'kpi') + navHtml();
  }

  /* ---------- шаг 4: визуализации ---------- */

  function panelViz() {
    var d = data();
    var keys = Object.keys(d);
    if (!st.vizTable || !d[st.vizTable]) st.vizTable = keys[0] || '';
    st.vizSugs = vizSuggestions(st.vizTable);
    var groups = {};
    C.VIEWS.forEach(function (v) { (groups[v.group] = groups[v.group] || []).push(v); });
    return '<h3 class="dbb-ph">4. Визуализации</h3>' +
      '<p class="dbb-tip">Конструктор подбирает графики по типам полей: категории — полосы и кольца, шкалы и годы — столбцы и воронки, даты — сроки, проценты — выполнение. ' +
      'Под каждым предложением — уменьшенный вид графика на ваших данных.</p>' +
      (keys.length > 1 ? '<div class="chips dbb-tables">' + keys.map(function (k) {
        return '<button type="button" class="chip' + (k === st.vizTable ? ' is-on' : '') + '" data-viztable="' + esc(k) + '">' + esc(d[k].title) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="dbb-sub">Рекомендуем для «' + esc((d[st.vizTable] || {}).title || '') + '»</div>' + sugCards(st.vizSugs, 'viz') +
      '<div class="dbb-sub">Галерея визуализаций — когда что использовать</div>' +
      Object.keys(groups).map(function (g) {
        return '<div class="dbb-gal-group"><div class="dbb-gal-title">' + esc(g) + '</div>' + groups[g].map(function (v) {
          return '<button type="button" class="dbb-gal" data-newview="' + v.id + '"><b>+ ' + esc(v.title) + '</b><span>' + esc(v.hint) + '</span></button>';
        }).join('') + '</div>';
      }).join('') +
      '<div class="dbb-sub">Управленческие элементы</div><div class="dbb-cards">' + ['table', 'actions', 'note', 'section'].map(function (t) {
        var e = C.ELEMENTS[t];
        return '<button type="button" class="dbb-card" data-new="' + t + '"><b>+ ' + esc(e.title) + '</b><span>' + esc(e.hint) + '</span></button>';
      }).join('') + '</div>' + navHtml();
  }

  /* Новая визуализация из галереи: поля подбираются по типам */
  function newView(viewId) {
    var tk = st.vizTable || Object.keys(data())[0];
    var cfg = { table: tk, view: viewId, agg: 'count' };
    var cat = firstField(tk, function (x) { return x.kind === 'cat' && x.distinct <= 15; });
    var ord = firstField(tk, function (x) { return x.kind === 'ord'; });
    var numF = firstField(tk, function (x) { return x.kind === 'money' || x.kind === 'num'; });
    var label = firstField(tk, function (x) { return x.kind === 'text'; }) || cat;
    if (viewId === 'columns' || viewId === 'funnel') cfg.groupBy = ord || cat;
    else cfg.groupBy = cat || ord;
    if (viewId === 'funnel') cfg.cumulative = !!ord;
    if (viewId === 'stacked' || viewId === 'matrix') cfg.groupBy2 = fieldsOf(tk, function (x, f) { return isGroup(x.kind) && f !== cfg.groupBy; })[0] || '';
    if (viewId === 'histogram') cfg.field = numF;
    if (viewId === 'top') { cfg.labelField = label; cfg.valueField = numF; cfg.top = 5; }
    if (viewId === 'progress') { cfg.labelField = label; cfg.valueField = firstField(tk, function (x) { return x.kind === 'pct'; }) || numF; }
    if (viewId === 'timeline') { cfg.labelField = label; cfg.dateField = firstField(tk, function (x) { return x.kind === 'date'; }); cfg.valueField = firstField(tk, function (x) { return x.kind === 'pct'; }); }
    var v = C.VIEWS.filter(function (x) { return x.id === viewId; })[0];
    addWidget({ type: 'chart', size: viewId === 'donut' ? 's' : viewId === 'timeline' || viewId === 'matrix' ? 'l' : 'm', title: v.title, cfg: cfg }, true);
  }

  function newElement(type) {
    var d = data(), tk = st.vizTable || Object.keys(d)[0];
    var cfg = {};
    if (type === 'kpi') cfg = { table: tk, agg: 'count' };
    if (type === 'goal') cfg = { table: tk, agg: 'count', target: 10, deadline: 'к концу года' };
    if (type === 'table') cfg = { table: tk, columns: Object.keys((d[tk] || { fields: {} }).fields).slice(0, 4), limit: 10 };
    if (type === 'note') cfg = { tone: 'insight', text: '' };
    if (type === 'actions') cfg = { items: [] };
    if (type === 'section') cfg = { subtitle: '' };
    addWidget({ type: type, title: type === 'section' ? 'Новый раздел' : '', cfg: cfg }, true);
  }

  /* ---------- шаг 5: компоновка ---------- */

  var TYPE_ORDER = { section: 0, kpi: 1, goal: 2, chart: 3, table: 4, note: 5, actions: 6 };

  function panelLayout(lay) {
    return '<h3 class="dbb-ph">5. Компоновка</h3>' +
      '<p class="dbb-tip">Меняйте порядок стрелками ▲▼ в списке ниже или перетаскивайте элементы на холсте за значок <b>⠿</b>. ' +
      'Ширину задают кнопки на элементе: S — треть строки, M — половина, L — две трети, XL — вся строка.</p>' +
      '<div class="dbb-quick"><button class="btn-register pg-btn-small" type="button" data-new="section">+ Заголовок раздела</button>' +
      '<button class="btn-register pg-btn-small" type="button" data-autolayout' + (lay.widgets.some(function (w) { return w.type === 'section'; }) ? ' disabled title="Есть разделы — расставьте вручную"' : '') + '>Упорядочить: KPI → графики → таблицы → решения</button></div>' +
      (lay.widgets.length ? '<ol class="dbb-order">' + lay.widgets.map(function (w, i) {
        return '<li class="' + (w.type === 'section' ? 'is-section' : '') + '"><span class="dbb-order-n">' + (i + 1) + '</span><span class="dbb-order-t">' + esc(w.title || defaultTitle(w)) +
          '<small>' + esc(w.type === 'chart' ? defaultTitle(w) : (C.ELEMENTS[w.type] || {}).title) + (w.type === 'section' ? '' : ' · ' + sizeOf(w).toUpperCase()) + '</small></span>' +
          '<button type="button" data-order="up:' + esc(w.id) + '" title="Выше"' + (i ? '' : ' disabled') + '>▲</button>' +
          '<button type="button" data-order="down:' + esc(w.id) + '" title="Ниже"' + (i < lay.widgets.length - 1 ? '' : ' disabled') + '>▼</button></li>';
      }).join('') + '</ol>' : '<p class="dbb-hint">Пока нет элементов — вернитесь к шагам 3–4.</p>') +
      '<div class="dbb-sub">Принципы хорошего дашборда</div><ul class="dbb-principles">' + C.PRINCIPLES.map(function (p) {
        return '<li><b>' + esc(p[0]) + '.</b> ' + esc(p[1]) + '</li>';
      }).join('') + '</ul>' + navHtml();
  }

  /* ---------- шаг 6: проверка и публикация ---------- */

  function checks() {
    var l = layout(), ws = l.widgets, m = l.meta || {};
    var kpis = ws.filter(function (w) { return w.type === 'kpi' || w.type === 'goal'; });
    var viz = ws.filter(function (w) { return w.type === 'chart' || w.type === 'table'; });
    var firstContent = ws.filter(function (w) { return w.type !== 'section'; })[0];
    var out = [];
    out.push(m.purpose ? { level: 'ok', text: 'Цель дашборда сформулирована' } : { level: 'bad', text: 'Нет цели: опишите на шаге 1, какие решения поддерживает дашборд', step: 'goal' });
    out.push(m.audience ? { level: 'ok', text: 'Аудитория указана' } : { level: 'warn', text: 'Не указано, для кого дашборд', step: 'goal' });
    out.push(!kpis.length ? { level: 'bad', text: 'Нет ни одного KPI', step: 'kpi' } :
      kpis.length > 7 ? { level: 'warn', text: kpis.length + ' показателей — больше 7 рассеивают внимание', step: 'kpi' } : { level: 'ok', text: kpis.length + ' ключевых показателей' });
    out.push(firstContent && (firstContent.type === 'kpi' || firstContent.type === 'goal') ? { level: 'ok', text: 'KPI стоят в начале дашборда' } :
      { level: 'warn', text: 'Поставьте KPI первыми — их смотрят в первую очередь', step: 'layout' });
    out.push(viz.length ? { level: 'ok', text: 'Есть визуализации (' + viz.length + ')' } : { level: 'bad', text: 'Нет графиков и таблиц', step: 'viz' });
    var withTarget = kpis.filter(function (w) { return w.cfg && w.cfg.target !== '' && w.cfg.target != null; });
    out.push(withTarget.length ? { level: 'ok', text: 'У показателей есть цели или пороги (' + withTarget.length + ')' } :
      { level: 'warn', text: 'Ни у одного показателя нет цели или порога — числам не хватает контекста', step: 'kpi' });
    var bigDonut = ws.filter(function (w) { return w.type === 'chart' && w.cfg.view === 'donut' && w.cfg.groupBy && field(w.cfg.table, w.cfg.groupBy) && field(w.cfg.table, w.cfg.groupBy).distinct > 6 && !(Number(w.cfg.top) > 0 && Number(w.cfg.top) <= 6); });
    if (bigDonut.length) out.push({ level: 'warn', text: 'Кольцо с более чем 6 долями плохо читается: «' + (bigDonut[0].title || defaultTitle(bigDonut[0])) + '» — замените на полосы', step: 'viz' });
    var broken = ws.filter(function (w) { return /dbb-warn/.test(renderBody(w)); });
    out.push(broken.length ? { level: 'bad', text: 'Элементы без данных или с незаконченной настройкой: ' + broken.map(function (w) { return '«' + (w.title || defaultTitle(w)) + '»'; }).join(', '), step: 'layout' } :
      { level: 'ok', text: 'Все элементы строятся по данным' });
    out.push(ws.length > 14 ? { level: 'warn', text: ws.length + ' элементов — дашборд перегружен, разделите на два', step: 'layout' } : { level: 'ok', text: 'Объём дашборда разумный (' + ws.length + ' элементов)' });
    out.push(ws.some(function (w) { return w.type === 'actions' || w.type === 'note'; }) ? { level: 'ok', text: 'Есть выводы или решения по итогам' } :
      { level: 'warn', text: 'Добавьте «Вывод» или «Решения и поручения» — дашборд должен вести к действию', step: 'viz' });
    return out;
  }

  function panelCheck(lay) {
    var cs = checks();
    var bad = cs.filter(function (c) { return c.level === 'bad'; }).length, warnN = cs.filter(function (c) { return c.level === 'warn'; }).length;
    var score = Math.round(cs.filter(function (c) { return c.level === 'ok'; }).length / cs.length * 100);
    return '<h3 class="dbb-ph">6. Проверка и публикация</h3>' +
      '<div class="dbb-score dbb-score--' + (bad ? 'bad' : warnN ? 'warn' : 'ok') + '"><b>' + score + '%</b><span>' + (bad ? 'Есть критичные замечания' : warnN ? 'Готово, есть рекомендации' : 'Дашборд готов') + '</span></div>' +
      '<ul class="dbb-checks">' + cs.map(function (c) {
        return '<li class="dbb-check--' + c.level + '"><span>' + (c.level === 'ok' ? '✓' : c.level === 'warn' ? '!' : '✕') + '</span><div>' + esc(c.text) +
          (c.step && c.level !== 'ok' ? ' <button type="button" class="dbb-link" data-step="' + c.step + '">Исправить →</button>' : '') + '</div></li>';
      }).join('') + '</ul>' +
      '<label class="imdl-check"><input type="checkbox" data-ready' + (lay.meta.ready ? ' checked' : '') + (bad ? ' disabled' : '') + '> Дашборд готов к показу</label>' +
      '<div class="dbb-sub">Показ и передача коллегам</div><div class="dbb-quick">' +
      '<button class="btn-primary pg-btn-small" type="button" data-publish="view">Открыть в режиме просмотра</button>' +
      '<button class="btn-register pg-btn-small" type="button" data-publish="print">Печать / PDF</button>' +
      '<button class="btn-register pg-btn-small" type="button" data-publish="export">Экспорт для коллег</button></div>' +
      '<p class="dbb-hint">Дашборд сохраняется автоматически' + (st.remote ? ' на платформе — он доступен вам с любого компьютера после входа.' : ' в этом браузере. Войдите на платформу, чтобы он был доступен с любого компьютера.') +
      ' Ссылки для просмотра пока нет: чтобы поделиться, распечатайте дашборд в PDF или отправьте файл экспорта — коллега загрузит его кнопкой «Импорт» вместе с данными.</p>' + navHtml();
  }

  /* ---------- панель шага ---------- */

  function renderPanel() {
    var lay = layout();
    var p = $('dbbPanel');
    var html = '';
    if (st.step === 'goal') html = panelGoal(lay);
    else if (st.step === 'data') html = panelData(lay);
    else if (st.step === 'kpi') html = panelKpi(lay);
    else if (st.step === 'viz') html = panelViz(lay);
    else if (st.step === 'layout') html = panelLayout(lay);
    else html = panelCheck(lay);
    p.innerHTML = html;
    bindTips(p);
  }

  function bindPanel() {
    var p = $('dbbPanel');
    p.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var l = layout();
      if (b.hasAttribute('data-step')) goStep(b.getAttribute('data-step'));
      else if (b.hasAttribute('data-kind')) { l.meta.kind = b.getAttribute('data-kind'); commit(); }
      else if (b.hasAttribute('data-template')) applyTemplate(b.getAttribute('data-template'));
      else if (b.hasAttribute('data-tpl-all')) {
        var tpl = C.TEMPLATES.filter(function (t) { return t.id === b.getAttribute('data-tpl-all'); })[0];
        var have = existingKeys();
        recipes(tpl).forEach(function (r) {
          if (!have[sugKey(r)]) l.widgets.push({ id: uid('w'), type: r.type, size: r.size, title: r.title, cfg: clone(r.cfg) });
        });
        commit();
      } else if (b.hasAttribute('data-source')) {
        var want = b.getAttribute('data-source'), was = (l.source && l.source.kind) || 'demo';
        if (want === was) return;
        if (was === 'upload' && !confirm('Сменить источник? Загруженный файл будет удалён из этого дашборда.')) return;
        if (was === 'manual' && !confirm('Сменить источник? Данные, введённые вручную, будут удалены из этого дашборда. ' +
            'Чтобы сохранить их, сначала сделайте копию дашборда (кнопка «Копия» вверху).')) return;
        l.source = want === 'manual' ? { kind: 'manual', name: 'Данные, введённые вручную', tables: {} } : { kind: 'demo' };
        l.meta.kinds = {};
        l.meta.dataConfirmed = false;
        st.vizTable = '';
        st.dataRev++;
        commit();
      } else if (b.hasAttribute('data-manual-open')) openManual(b.getAttribute('data-manual-open'));
      else if (b.hasAttribute('data-manual-csv')) downloadTemplate(b.getAttribute('data-manual-csv')); else if (b.hasAttribute('data-sug')) {
        var parts = b.getAttribute('data-sug').split(':');
        var list = parts[0] === 'kpi' ? st.kpiSugs : st.vizSugs;
        var s = list[Number(parts[1])];
        if (s) addWidget(s.spec, false);
      } else if (b.hasAttribute('data-new')) newElement(b.getAttribute('data-new'));
      else if (b.hasAttribute('data-newview')) newView(b.getAttribute('data-newview'));
      else if (b.hasAttribute('data-viztable')) { st.vizTable = b.getAttribute('data-viztable'); renderPanel(); }
      else if (b.hasAttribute('data-order')) {
        var o = b.getAttribute('data-order').split(':');
        move(o[1], o[0] === 'up' ? -1 : 1);
      } else if (b.hasAttribute('data-autolayout')) {
        l.widgets.sort(function (a, c) { return (TYPE_ORDER[a.type] || 9) - (TYPE_ORDER[c.type] || 9); });
        commit();
      } else if (b.hasAttribute('data-publish')) {
        var act = b.getAttribute('data-publish');
        if (act === 'view') toggleView();
        if (act === 'print') printDash();
        if (act === 'export') exportLayout();
      }
    });
    p.addEventListener('change', function (e) {
      var t = e.target, l = layout();
      if (t.hasAttribute('data-meta')) {
        var k = t.getAttribute('data-meta');
        if (k === 'name') l.name = t.value.trim().slice(0, 80) || 'Мой дашборд';
        else l.meta[k] = t.value;
        commit();
      } else if (t.id === 'dbbUpload' && t.files && t.files[0]) readUpload(t.files[0]);
      else if (t.hasAttribute('data-kindfield')) {
        l.meta.kinds = l.meta.kinds || {};
        l.meta.kinds[t.getAttribute('data-kindfield')] = t.value;
        commit();
      } else if (t.hasAttribute('data-confirm-data')) { l.meta.dataConfirmed = t.checked; commit(); }
      else if (t.hasAttribute('data-ready')) { l.meta.ready = t.checked; commit(); }
    });
  }

  /* ---------- инструменты на холсте ---------- */

  function move(id, delta) {
    var list = layout().widgets;
    var i = list.map(function (w) { return w.id; }).indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    var t = list[i]; list[i] = list[j]; list[j] = t;
    commit();
  }

  function bindCanvas() {
    var cv = $('dbbCanvas');
    cv.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tool]');
      if (!b) return;
      var art = b.closest('.dbb-w');
      var w = widgetById(art.getAttribute('data-id'));
      var act = b.getAttribute('data-tool');
      if (act === 'size') { w.size = b.getAttribute('data-size'); commit(); }
      if (act === 'up') move(w.id, -1);
      if (act === 'down') move(w.id, 1);
      if (act === 'cfg') openSettings(w);
      if (act === 'dup') {
        var copy = clone(w); copy.id = uid('w');
        var list = layout().widgets;
        list.splice(list.indexOf(w) + 1, 0, copy);
        commit();
      }
      if (act === 'del') { layout().widgets = layout().widgets.filter(function (x) { return x !== w; }); commit(); }
    });
    cv.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.hasAttribute('data-act-toggle')) return;
      var p = t.getAttribute('data-act-toggle').split(':');
      var w = widgetById(p[0]);
      if (w && w.cfg.items[Number(p[1])]) { w.cfg.items[Number(p[1])].done = t.checked; commit(); }
    });
    cv.addEventListener('dragstart', function (e) {
      var h = e.target.closest && e.target.closest('.dbb-handle');
      if (!h) return;
      var art = h.closest('.dbb-w');
      st.dragId = art.getAttribute('data-id');
      art.classList.add('dbb-dragging');
      try { e.dataTransfer.setData('text/plain', st.dragId); e.dataTransfer.setDragImage(art, 20, 20); } catch (err) { /* старые браузеры */ }
    });
    cv.addEventListener('dragend', function () {
      cv.querySelectorAll('.dbb-dragging, .dbb-drop-before, .dbb-drop-after').forEach(function (n) { n.classList.remove('dbb-dragging', 'dbb-drop-before', 'dbb-drop-after'); });
      st.dragId = null;
    });
    var pos = function (art, e) {
      var r = art.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width + (e.clientY - r.top) / r.height) < 1 ? 'before' : 'after';
    };
    cv.addEventListener('dragover', function (e) {
      if (!st.dragId) return;
      e.preventDefault();
      cv.querySelectorAll('.dbb-drop-before, .dbb-drop-after').forEach(function (n) { n.classList.remove('dbb-drop-before', 'dbb-drop-after'); });
      var art = e.target.closest('.dbb-w');
      if (art && art.getAttribute('data-id') !== st.dragId) art.classList.add('dbb-drop-' + pos(art, e));
    });
    cv.addEventListener('drop', function (e) {
      if (!st.dragId) return;
      e.preventDefault();
      var list = layout().widgets;
      var from = list.map(function (w) { return w.id; }).indexOf(st.dragId);
      var item = list.splice(from, 1)[0];
      var art = e.target.closest('.dbb-w');
      if (art && art.getAttribute('data-id') !== item.id) {
        var to = list.map(function (w) { return w.id; }).indexOf(art.getAttribute('data-id'));
        list.splice(pos(art, e) === 'before' ? to : to + 1, 0, item);
      } else list.push(item);
      st.dragId = null;
      commit();
    });
  }

  /* ---------- окно настройки элемента ---------- */

  function opts(list, value) {
    return list.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }
  function fopts(tk, pred, empty) {
    return (empty ? [['', empty]] : []).concat(fieldsOf(tk, pred).map(function (f) { return [f, fTitle(tk, f) + ' · ' + KIND_TITLES[fKind(tk, f)].toLowerCase()]; }));
  }
  function distinct(tk, f) {
    var seen = {}, out = [];
    ((table(tk) || {}).rows || []).forEach(function (r) { var v = r[f]; if (v !== '' && v != null && !seen[v]) { seen[v] = true; out.push(String(v)); } });
    return out.sort(function (a, b) { return a.localeCompare(b, 'ru', { numeric: true }); });
  }
  function fld(label, html, hint) { return '<label class="mdl-field"><span>' + esc(label) + '</span>' + html + (hint ? '<small class="dbb-fhint">' + esc(hint) + '</small>' : '') + '</label>'; }
  function sel(name, options, value, extra) { return '<select name="' + name + '"' + (extra || '') + '>' + opts(options, value) + '</select>'; }
  function inp(name, value, extra) { return '<input name="' + name + '" value="' + esc(value == null ? '' : value) + '"' + (extra || '') + '>'; }

  function filterHtml(tk, c) {
    var ff = c.filterField && field(tk, c.filterField) ? c.filterField : '';
    return '<div class="dbb-row">' + fld('Фильтр: поле', sel('filterField', fopts(tk, function (x) { return isGroup(x.kind); }, 'без фильтра'), ff)) +
      fld('Значение', sel('filterValue', [['', '—']].concat(ff ? distinct(tk, ff).map(function (v) { return [v, v]; }) : []), c.filterValue, ff ? '' : ' disabled')) + '</div>';
  }

  function settingsHtml(w, c) {
    var html = fld(w.type === 'section' ? 'Название раздела' : 'Заголовок', inp('title', w.title, ' maxlength="120" placeholder="' + esc(defaultTitle(w)) + '"'),
      w.type === 'chart' ? 'Лучше всего — вопрос или вывод: «Где застревают проекты?»' : '');
    if (w.type === 'section') return html + fld('Подзаголовок', inp('subtitle', c.subtitle, ' maxlength="200"'));
    if (w.type === 'note') {
      return html + fld('Тип', sel('tone', [['info', 'Комментарий'], ['insight', 'Вывод / инсайт'], ['warning', 'Внимание / риск']], c.tone)) +
        fld('Текст', '<textarea name="text" rows="7" maxlength="3000">' + esc(c.text || '') + '</textarea>', 'Строки, начинающиеся с «- », станут списком');
    }
    if (w.type === 'actions') {
      var lines = (c.items || []).map(function (i) { return (i.done ? '[x] ' : '') + [i.text, i.owner, i.due].filter(function (x, k) { return k === 0 || x; }).join(' | '); }).join('\n');
      return html + fld('Решения и поручения', '<textarea name="itemsText" rows="8" maxlength="3500">' + esc(lines) + '</textarea>',
        'По одному в строке: задача | ответственный | срок. «[x]» в начале — выполнено. Отмечать выполнение можно и на холсте.');
    }
    var d = data();
    var tk = d[c.table] ? c.table : Object.keys(d)[0];
    html += fld('Таблица данных', sel('table', Object.keys(d).map(function (k) { return [k, d[k].title]; }), tk));
    if (w.type === 'kpi' || w.type === 'goal') {
      html += '<div class="dbb-row">' + fld('Что считаем', sel('agg', Object.keys(C.AGGS).map(function (k) { return [k, C.AGGS[k]]; }), c.agg || 'count'));
      if (c.agg === 'share') {
        var sf = c.shareField && field(tk, c.shareField) ? c.shareField : firstField(tk, function (x) { return isGroup(x.kind); });
        html += fld('Доля какого поля', sel('shareField', fopts(tk, function (x) { return isGroup(x.kind); }), sf)) + '</div>' +
          fld('Доля значения', sel('shareValue', distinct(tk, sf).map(function (v) { return [v, v]; }), c.shareValue));
      } else if (c.agg && c.agg !== 'count') {
        html += fld('Поле', sel('field', fopts(tk, function (x) { return c.agg === 'distinct' ? true : isNum(x.kind); }, '—'), c.field)) + '</div>';
      } else html += '</div>';
      html += filterHtml(tk, c);
      html += '<div class="dbb-row">' + fld(w.type === 'goal' ? 'Цель' : 'Цель или порог (необязательно)', inp('target', c.target, ' type="number" step="any"')) +
        fld('Хорошо, когда', sel('direction', [['up', 'не меньше цели'], ['down', 'не больше порога']], c.direction || 'up')) + '</div>';
      html += '<div class="dbb-row">' + (w.type === 'goal' ? fld('Срок', inp('deadline', c.deadline, ' maxlength="60" placeholder="к 2030 году"')) : fld('Подпись', inp('note', c.note, ' maxlength="120"'))) +
        fld('Единица', inp('unit', c.unit, ' maxlength="12" placeholder="%, чел., шт."')) + '</div>';
      return html;
    }
    if (w.type === 'table') {
      var cols = c.columns || [];
      html += '<div class="mdl-field"><span>Столбцы</span><div class="dbb-checks-grid">' + Object.keys(table(tk).fields).map(function (f) {
        return '<label><input type="checkbox" name="columns" data-multi value="' + esc(f) + '"' + (cols.indexOf(f) >= 0 ? ' checked' : '') + '> ' + esc(fTitle(tk, f)) + '</label>';
      }).join('') + '</div></div>';
      html += '<div class="dbb-row">' + fld('Сортировать по', sel('sortBy', fopts(tk, function () { return true; }, 'как в данных'), c.sortBy)) +
        fld('Порядок', sel('desc', [['1', 'по убыванию'], ['', 'по возрастанию']], c.desc ? '1' : '')) + fld('Строк (0 — все)', inp('limit', c.limit || 0, ' type="number" min="0" max="500"')) + '</div>';
      return html + filterHtml(tk, c);
    }
    /* график */
    var view = c.view || 'bars';
    var vdef = C.VIEWS.filter(function (v) { return v.id === view; })[0] || C.VIEWS[0];
    html += fld('Тип визуализации', sel('view', C.VIEWS.map(function (v) { return [v.id, v.group + ': ' + v.title]; }), view), vdef.hint);
    var grp = function (x) { return isGroup(x.kind); };
    if (['bars', 'columns', 'donut', 'funnel', 'stacked', 'matrix'].indexOf(view) >= 0) {
      html += '<div class="dbb-row">' + fld(view === 'funnel' ? 'Стадии (шкала: УГТ, этапы, годы)' : view === 'matrix' ? 'Строки' : 'Разрез', sel('groupBy', fopts(tk, grp, '—'), c.groupBy));
      if (view === 'stacked' || view === 'matrix') html += fld(view === 'matrix' ? 'Столбцы' : 'Сегменты', sel('groupBy2', fopts(tk, grp, '—'), c.groupBy2));
      html += '</div><div class="dbb-row">' + fld('Что считаем', sel('agg', [['count', 'Количество'], ['sum', 'Сумма'], ['avg', 'Среднее'], ['max', 'Максимум'], ['min', 'Минимум']], c.agg || 'count')) +
        fld('Поле (для суммы, среднего)', sel('field', fopts(tk, function (x) { return isNum(x.kind); }, '—'), c.field)) + '</div>';
      if (view === 'funnel') html += '<label class="imdl-check"><input type="checkbox" name="cumulative"' + (c.cumulative ? ' checked' : '') + '> Накопленно: «дошло до стадии и дальше»</label>';
      if (view === 'bars' || view === 'donut') html += fld('Показать первых (0 — все)', inp('top', c.top || 0, ' type="number" min="0" max="30"'), 'Остальное объединится в «Остальные»');
    }
    if (view === 'histogram') html += fld('Числовое поле', sel('field', fopts(tk, function (x) { return isNum(x.kind); }, '—'), c.field));
    if (view === 'top' || view === 'progress' || view === 'timeline') {
      html += '<div class="dbb-row">' + fld('Подпись', sel('labelField', fopts(tk, function (x) { return x.kind === 'text' || x.kind === 'cat'; }, '—'), c.labelField));
      if (view === 'timeline') html += fld('Дата', sel('dateField', fopts(tk, function (x) { return x.kind === 'date'; }, '—'), c.dateField));
      html += fld(view === 'timeline' ? 'Процент выполнения (необяз.)' : view === 'progress' ? 'Процент выполнения' : 'Значение',
        sel('valueField', fopts(tk, function (x) { return isNum(x.kind); }, '—'), c.valueField)) + '</div>';
      if (view === 'top') html += '<div class="dbb-row">' + fld('Сколько показать', inp('top', c.top || 5, ' type="number" min="1" max="30"')) +
        fld('Порядок', sel('ascending', [['', 'лидеры (по убыванию)'], ['1', 'аутсайдеры (по возрастанию)']], c.ascending ? '1' : '')) + '</div>';
      if (view === 'progress') html += '<div class="dbb-row">' + fld('Зелёный от, %', inp('okFrom', c.okFrom || 70, ' type="number" min="0" max="100"')) +
        fld('Красный ниже, %', inp('badBelow', c.badBelow || 30, ' type="number" min="0" max="100"')) + '</div>';
    }
    return html + filterHtml(tk, c);
  }

  function readForm(form, w) {
    var cfg = {}, title = '';
    Array.prototype.forEach.call(form.elements, function (n) {
      if (!n.name || n.disabled) return;
      if (n.name === 'title') { title = n.value.trim().slice(0, 120); return; }
      if (n.type === 'checkbox') {
        if (n.hasAttribute('data-multi')) { cfg[n.name] = cfg[n.name] || []; if (n.checked) cfg[n.name].push(n.value); }
        else cfg[n.name] = n.checked;
      } else if (n.type === 'number') cfg[n.name] = n.value === '' ? '' : Number(n.value);
      else cfg[n.name] = n.value;
    });
    if ('desc' in cfg) cfg.desc = !!cfg.desc;
    if ('ascending' in cfg) cfg.ascending = !!cfg.ascending;
    if (w.type === 'actions') {
      cfg.items = String(cfg.itemsText || '').split('\n').map(function (line) { return line.trim(); }).filter(Boolean).slice(0, 30).map(function (line) {
        var done = /^\[x\]\s*/i.test(line);
        var parts = line.replace(/^\[x\]\s*/i, '').split('|').map(function (x) { return x.trim(); });
        return { text: parts[0].slice(0, 200), owner: (parts[1] || '').slice(0, 80), due: (parts[2] || '').slice(0, 40), done: done };
      });
      delete cfg.itemsText;
    }
    return { title: title, cfg: cfg };
  }

  function openSettings(w, isNew) {
    var overlay = $('dbbModal'), form = $('dbbForm');
    var cfg = clone(w.cfg || {});
    var tmpTitle = w.title;
    $('dbbModalTitle').textContent = (isNew ? 'Новый элемент: ' : 'Настройка: ') + (w.type === 'chart' ? 'график' : (C.ELEMENTS[w.type] || {}).title.toLowerCase());
    var draw = function () { form.querySelector('.dbb-form-body').innerHTML = settingsHtml({ type: w.type, title: tmpTitle, cfg: cfg }, cfg); preview(); };
    var preview = function () {
      var r = readForm(form, w);
      var box = $('dbbPreview');
      if (w.type === 'section') { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="dbb-preview-label">Предпросмотр</div><h4 class="dbb-preview-title">' + esc(r.title || defaultTitle({ type: w.type, cfg: r.cfg })) + '</h4>' +
        renderBody({ id: w.id, type: w.type, cfg: r.cfg });
    };
    form.onchange = function (e) {
      var name = e.target && e.target.name;
      var r = readForm(form, w);
      tmpTitle = r.title;
      if (['table', 'view', 'agg', 'filterField', 'shareField'].indexOf(name) >= 0) {
        cfg = r.cfg;
        if (name === 'table') {
          ['groupBy', 'groupBy2', 'field', 'filterField', 'filterValue', 'shareField', 'shareValue', 'labelField', 'valueField', 'dateField', 'sortBy'].forEach(function (k) { delete cfg[k]; });
          cfg.columns = Object.keys((table(cfg.table) || { fields: {} }).fields).slice(0, 4);
        }
        if (name === 'filterField') cfg.filterValue = '';
        if (name === 'view') {
          var nv = cfg.view, tk = cfg.table;
          if (!cfg.groupBy) cfg.groupBy = firstField(tk, function (x) { return isGroup(x.kind); });
          if ((nv === 'stacked' || nv === 'matrix') && !cfg.groupBy2) cfg.groupBy2 = fieldsOf(tk, function (x, f) { return isGroup(x.kind) && f !== cfg.groupBy; })[0];
          if ((nv === 'top' || nv === 'progress' || nv === 'timeline') && !cfg.labelField) cfg.labelField = firstField(tk, function (x) { return x.kind === 'text'; }) || firstField(tk, function (x) { return x.kind === 'cat'; });
          if (nv === 'timeline' && !cfg.dateField) cfg.dateField = firstField(tk, function (x) { return x.kind === 'date'; });
          if ((nv === 'top' || nv === 'progress') && !cfg.valueField) cfg.valueField = firstField(tk, function (x) { return x.kind === 'pct'; }) || firstField(tk, function (x) { return isNum(x.kind); });
          if (nv === 'histogram' && !cfg.field) cfg.field = firstField(tk, function (x) { return x.kind === 'money' || x.kind === 'num'; });
        }
        if (name === 'agg' && cfg.agg === 'share' && !cfg.shareField) cfg.shareField = firstField(cfg.table, function (x) { return isGroup(x.kind); });
        if (name === 'shareField') cfg.shareValue = '';
        draw();
        return;
      }
      preview();
    };
    form.oninput = function (e) { if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) preview(); };
    form.onsubmit = function (e) {
      e.preventDefault();
      var r = readForm(form, w);
      w.title = r.title;
      w.cfg = r.cfg;
      overlay.hidden = true;
      commit();
      flashAdded(w.id);
    };
    draw();
    overlay.hidden = false;
    var first = form.querySelector('input, select, textarea');
    if (first) first.focus();
  }

  function bindModal() {
    var overlay = $('dbbModal');
    var close = function () { overlay.hidden = true; };
    $('dbbModalClose').addEventListener('click', close);
    $('dbbCancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });
  }

  /* ---------- дашборды: новый, копия, удаление, экспорт, импорт, просмотр, печать ---------- */

  function toggleView() {
    st.view = !st.view;
    render();
    window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 10, behavior: 'smooth' });
  }

  function printDash() {
    var was = st.view;
    if (!was) { st.view = true; render(); }
    setTimeout(function () {
      window.print();
      if (!was) { st.view = false; render(); }
    }, 100);
  }

  function exportLayout() {
    var l = layout();
    var blob = new Blob([JSON.stringify({ aios_dashboard_layout: 2, name: l.name, meta: l.meta, source: l.source, widgets: l.widgets }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (l.name || 'dashboard').replace(/[^\wа-яё -]+/gi, '').trim().replace(/\s+/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 500);
  }

  function bindBar() {
    $('dbbSelect').addEventListener('change', function (e) { st.bundle.active = e.target.value; st.vizTable = ''; commit(); });
    $('dbbNew').addEventListener('click', function () {
      if (st.bundle.layouts.length >= 20) { alert('Не больше 20 дашбордов на участника'); return; }
      var name = prompt('Название нового дашборда', 'Новый дашборд ' + (st.bundle.layouts.length + 1));
      if (name === null) return;
      var l = blank(name.trim().slice(0, 80) || 'Новый дашборд');
      st.bundle.layouts.push(l);
      st.bundle.active = l.id;
      st.view = false;
      commit();
    });
    $('dbbCopy').addEventListener('click', function () {
      if (st.bundle.layouts.length >= 20) { alert('Не больше 20 дашбордов на участника'); return; }
      var c = clone(layout());
      c.id = 'd-' + Math.random().toString(16).slice(2, 10);
      c.name = (c.name + ' (копия)').slice(0, 80);
      st.bundle.layouts.push(c);
      st.bundle.active = c.id;
      commit();
    });
    $('dbbDelete').addEventListener('click', function () {
      if (st.bundle.layouts.length < 2) return;
      if (!confirm('Удалить дашборд «' + layout().name + '»?')) return;
      var id = layout().id;
      st.bundle.layouts = st.bundle.layouts.filter(function (l) { return l.id !== id; });
      st.bundle.active = st.bundle.layouts[0].id;
      commit();
    });
    $('dbbExport').addEventListener('click', exportLayout);
    $('dbbPrint').addEventListener('click', printDash);
    $('dbbView').addEventListener('click', toggleView);
    var imp = $('dbbImport');
    imp.addEventListener('change', function () {
      var file = imp.files && imp.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var d = JSON.parse(reader.result);
          if (!d || !Array.isArray(d.widgets)) throw new Error('нет списка widgets — это не раскладка дашборда');
          if (st.bundle.layouts.length >= 20) throw new Error('уже 20 дашбордов — удалите лишний');
          var l = blank(String(d.name || 'Импортированный дашборд').slice(0, 80));
          l.meta = Object.assign(l.meta, d.meta || {}, { step: 'check' });
          l.source = d.source && ['demo', 'upload', 'manual'].indexOf(d.source.kind) >= 0 ? d.source : { kind: 'demo' };
          l.widgets = d.widgets.filter(function (w) { return w && (C.ELEMENTS[w.type] || w.type === 'metric'); }).map(function (w) {
            return { id: uid('w'), type: w.type === 'metric' ? 'kpi' : w.type, size: SIZE_TITLES[w.size] ? w.size : 'm', title: String(w.title || '').slice(0, 120), cfg: w.cfg && typeof w.cfg === 'object' ? w.cfg : {} };
          });
          st.bundle.layouts.push(l);
          st.bundle.active = l.id;
          commit();
        } catch (err) { alert('Не удалось загрузить раскладку: ' + err.message); }
        imp.value = '';
      };
      reader.readAsText(file, 'utf-8');
    });
    $('dbbSteps').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-step]');
      if (b) goStep(b.getAttribute('data-step'));
    });
    $('dbbCanvasHead').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-step]');
      if (b) goStep(b.getAttribute('data-step'));
    });
  }

  /* ---------- запуск ---------- */

  function start() {
    var local = readLocal();
    var fresh = function () { var l = blank('Мой дашборд'); return { active: l.id, layouts: [l] }; };
    var done = function () { render(); };
    if (!API || !token()) {
      st.remote = false;
      st.bundle = migrate(local || fresh());
      done();
      status(token() ? 'Дашборды хранятся в этом браузере' : 'Дашборды хранятся в этом браузере · войдите, чтобы сохранить их на платформе');
      return;
    }
    API.request('GET', '/dashboards', undefined, token()).then(function (d) {
      st.remote = true;
      if (d && d.layouts && d.layouts.length) { st.bundle = migrate(d); done(); status('Дашборды сохранены на платформе'); }
      else { st.bundle = migrate(local || fresh()); done(); save(); }
    }).catch(function () {
      st.remote = false;
      st.bundle = migrate(local || fresh());
      done();
      status('Платформа недоступна — дашборды хранятся в этом браузере');
    });
  }

  bindBar();
  bindPanel();
  bindCanvas();
  bindModal();
  bindManual();
  fetch('/data/dashboard.json').then(function (r) { return r.json(); }).then(function (raw) {
    st.demoRaw = raw;
    st.demo = enrichDemo(raw);
  }).catch(function () {
    st.demo = {};
  }).then(function () {
    st.dataKey = '';
    if (st.bundle) render(); else start();
  });
})();
