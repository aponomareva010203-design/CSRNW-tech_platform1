/* ============================================================
   Витрина механизмов поддержки техпреда (страница showcase.html).

   Справочник механизмов — data/support_showcase.json:
     contours   — контуры экосистемы;
     mechanisms — механизмы: контур, оператор, что даёт, метрика,
                  weights.reach / weights.mtk (1–3) — важность для
                  прежней цели (охват) и новой (актив → МТК),
                  action — что сделать, если механизма нет;
     demo_profile — пример заполнения.

   Отметки вуза (статус 0–3, объём за год, комментарий) хранятся в
   браузере (localStorage) по профилям — можно вести несколько вузов.
   Индекс готовности = Σ вес × статус / Σ вес × 3 × 100.
   ============================================================ */

(function () {
  var root = document.getElementById('scMechs');
  if (!root) return;

  var STORE_KEY = 'aios.showcase.v1';
  var data = null;
  var state = { current: '', lens: 'mtk', filter: 'all', profiles: {} };

  var el = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStatus(text) {
    el('scStatus').textContent = text || '';
    if (text) setTimeout(function () { if (el('scStatus').textContent === text) el('scStatus').textContent = ''; }, 4000);
  }

  /* ---------- хранение ---------- */

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && raw.profiles && typeof raw.profiles === 'object') {
        state.profiles = raw.profiles;
        state.current = raw.current || '';
        state.lens = raw.lens === 'reach' ? 'reach' : 'mtk';
      }
    } catch (e) { /* хранилище недоступно — работаем в памяти */ }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        profiles: state.profiles, current: state.current, lens: state.lens
      }));
    } catch (e) { /* без сохранения */ }
  }

  function emptyProfile(name) {
    return { name: name, statuses: {}, volumes: {}, notes: {} };
  }

  function profile() {
    return state.profiles[state.current];
  }

  function ensureProfile() {
    var names = Object.keys(state.profiles);
    if (!names.length) {
      var demo = JSON.parse(JSON.stringify(data.demo_profile));
      state.profiles[demo.name] = demo;
      names = [demo.name];
    }
    if (!state.profiles[state.current]) state.current = names[0];
  }

  /* ---------- расчёты ---------- */

  function statusOf(m) {
    var v = Number((profile().statuses || {})[m.id]);
    return isNaN(v) ? 0 : Math.max(0, Math.min(3, v));
  }

  function index(list, lens) {
    var num = 0, den = 0;
    list.forEach(function (m) {
      var w = m.weights[lens] || 1;
      num += w * statusOf(m);
      den += w * 3;
    });
    return den ? Math.round(num / den * 100) : 0;
  }

  function byContour(cid) {
    return data.mechanisms.filter(function (m) { return m.contour === cid; });
  }

  function gaps() {
    return data.mechanisms
      .map(function (m) { return { m: m, s: statusOf(m), w: m.weights.mtk }; })
      .filter(function (x) { return (x.w >= 3 && x.s <= 1) || (x.w === 2 && x.s === 0); })
      .sort(function (a, b) { return (b.w * (3 - b.s)) - (a.w * (3 - a.s)); });
  }

  function freeable() {
    return data.mechanisms
      .map(function (m) { return { m: m, s: statusOf(m) }; })
      .filter(function (x) { return x.m.weights.reach >= 3 && x.m.weights.mtk <= 1 && x.s >= 2; });
  }

  function contourName(cid) {
    for (var i = 0; i < data.contours.length; i++) {
      if (data.contours[i].id === cid) return data.contours[i].name;
    }
    return cid;
  }

  function statusLabel(v) {
    return data.statuses[v] ? data.statuses[v].label : '';
  }

  /* ---------- отрисовка ---------- */

  function renderProfiles() {
    var sel = el('scProfile');
    sel.innerHTML = '';
    Object.keys(state.profiles).forEach(function (name) {
      var o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      if (name === state.current) o.selected = true;
      sel.appendChild(o);
    });
  }

  function renderLens() {
    var box = el('scLens');
    box.innerHTML = '';
    data.lenses.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sc-lens-btn' + (state.lens === l.id ? ' is-on' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', state.lens === l.id ? 'true' : 'false');
      b.title = l.hint;
      b.textContent = l.label;
      b.addEventListener('click', function () { state.lens = l.id; save(); renderAll(); });
      box.appendChild(b);
    });
  }

  function renderKpi() {
    var all = data.mechanisms;
    var present = all.filter(function (m) { return statusOf(m) >= 1; }).length;
    var effective = all.filter(function (m) { return statusOf(m) === 3; }).length;
    var mtkIdx = index(all, 'mtk');
    var reachIdx = index(all, 'reach');
    var g = gaps();
    var critical = g.filter(function (x) { return x.w >= 3; }).length;
    var tiles = [
      { label: 'Механизмов есть', value: present + ' из ' + all.length, note: 'хотя бы формально' },
      { label: 'Работают эффективно', value: effective, note: 'статус «работает эффективно»' },
      { label: 'Готовность под новую цель', value: mtkIdx + ' / 100', note: 'актив → МТК', main: state.lens === 'mtk' },
      { label: 'Готовность под прежнюю цель', value: reachIdx + ' / 100', note: 'охват и вовлечение', main: state.lens === 'reach' },
      { label: 'Критичные разрывы', value: critical, note: 'ключевые для МТК, нет или формально', alert: critical > 0 },
      { label: 'Можно перенастроить', value: freeable().length, note: 'сильные механизмы охвата' }
    ];
    el('scKpi').innerHTML = tiles.map(function (t) {
      return '<div class="kpi' + (t.alert ? ' kpi--alert' : '') + (t.main ? ' sc-kpi--main' : '') + '">' +
        '<div class="kpi-label">' + esc(t.label) + '</div>' +
        '<div class="kpi-value">' + esc(t.value) + '</div>' +
        '<div class="kpi-note">' + esc(t.note) + '</div></div>';
    }).join('');

    var gap = reachIdx - mtkIdx;
    var text;
    if (gap >= 15) {
      text = 'Экосистема вуза настроена на охват: под прежнюю цель готовность ' + reachIdx +
        ', под новую — ' + mtkIdx + '. Чтобы выйти в МТК, нужно достроить механизмы работы со сформированным активом (см. разрывы) и перенастроить массовые программы на технологические пакеты вуза.';
    } else if (mtkIdx >= 70) {
      text = 'Экосистема готова к выходу в МТК (индекс ' + mtkIdx + '). Фокус — масштабирование: больше технологических пакетов в студию и контроль конверсии на каждом шаге.';
    } else {
      text = 'Готовность под новую цель — ' + mtkIdx + ' из 100. Главные шаги — закрыть разрывы с наибольшим вкладом в МТК, начиная с верхних в списке.';
    }
    el('scVerdict').textContent = text;
  }

  function renderContours() {
    el('scContours').innerHTML = data.contours.map(function (c) {
      var list = byContour(c.id);
      var mtk = index(list, 'mtk');
      var reach = index(list, 'reach');
      return '<div class="sc-bar" title="' + esc(c.description) + '">' +
        '<div class="sc-bar-name"><span>' + esc(c.name) + '</span><b>' + mtk + '</b></div>' +
        '<div class="sc-bar-track"><div class="sc-bar-fill sc-bar-fill--reach" style="width:' + reach + '%"></div></div>' +
        '<div class="sc-bar-track"><div class="sc-bar-fill" style="width:' + mtk + '%"></div></div>' +
        '</div>';
    }).join('');
  }

  function renderGaps() {
    var g = gaps();
    el('scGaps').innerHTML = g.length ? g.slice(0, 8).map(function (x) {
      return '<li><div class="sc-gap-head"><b>' + esc(x.m.name) + '</b>' +
        '<span class="sc-badge sc-badge--s' + x.s + '">' + esc(statusLabel(x.s)) + '</span></div>' +
        '<div class="sc-gap-sub">' + esc(contourName(x.m.contour)) + ' · вклад в МТК: ' + (x.w >= 3 ? 'высокий' : 'средний') + '</div>' +
        '<div class="sc-gap-act">Что сделать: ' + esc(x.m.action) + '</div></li>';
    }).join('') : '<li class="sc-empty">Критичных разрывов нет — все ключевые для МТК механизмы работают.</li>';
  }

  function renderFree() {
    var f = freeable();
    el('scFree').innerHTML = f.length ? f.map(function (x) {
      return '<li><b>' + esc(x.m.name) + '</b> — ' + esc(statusLabel(x.s).toLowerCase()) +
        '. <span class="sc-gap-act">' + esc(x.m.action) + '</span></li>';
    }).join('') : '<li class="sc-empty">Нет сильных механизмов охвата, которые стоило бы перенастроить.</li>';
  }

  function renderFilter() {
    var box = el('scFilter');
    var items = [{ id: 'all', name: 'Все контуры' }].concat(data.contours);
    box.innerHTML = '';
    items.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tag-chip' + (state.filter === c.id ? ' tag-chip--on' : '');
      b.textContent = c.name;
      b.addEventListener('click', function () { state.filter = c.id; renderFilter(); renderMechs(); });
      box.appendChild(b);
    });
  }

  function weightDots(w) {
    var out = '';
    for (var i = 1; i <= 3; i++) out += '<i class="' + (i <= w ? 'on' : '') + '"></i>';
    return '<span class="sc-dots" aria-hidden="true">' + out + '</span>';
  }

  function renderMechs() {
    var p = profile();
    var contours = state.filter === 'all' ? data.contours : data.contours.filter(function (c) { return c.id === state.filter; });
    root.innerHTML = contours.map(function (c) {
      var cards = byContour(c.id).map(function (m) {
        var s = statusOf(m);
        var options = data.statuses.map(function (st) {
          return '<option value="' + st.value + '"' + (st.value === s ? ' selected' : '') + '>' + esc(st.label) + '</option>';
        }).join('');
        return '<article class="mdl-card sc-card sc-card--s' + s + '" data-id="' + esc(m.id) + '">' +
          '<div class="sc-card-top"><h4 class="mdl-card-name">' + esc(m.name) + '</h4>' +
          '<span class="sc-kind">' + (m.kind === 'external' ? 'внешняя мера' : 'механизм вуза') + '</span></div>' +
          '<p class="mdl-card-out">' + esc(m.gives) + '</p>' +
          '<dl class="sc-meta">' +
          '<dt>Оператор</dt><dd>' + esc(m.operator) + '</dd>' +
          (m.conditions ? '<dt>Условия</dt><dd>' + esc(m.conditions) + '</dd>' : '') +
          '<dt>Метрика</dt><dd>' + esc(m.metric) + '</dd>' +
          '<dt>Вклад в МТК</dt><dd>' + weightDots(m.weights.mtk) + '</dd>' +
          '<dt>Вклад в охват</dt><dd>' + weightDots(m.weights.reach) + '</dd>' +
          '</dl>' +
          '<div class="sc-inputs">' +
          '<label>Статус в вузе<select data-field="statuses">' + options + '</select></label>' +
          '<label>Объём за год<input type="text" maxlength="40" data-field="volumes" placeholder="напр. 12 проектов" value="' + esc((p.volumes || {})[m.id] || '') + '"></label>' +
          '</div>' +
          '<label class="sc-note">Комментарий: как работает, кто отвечает<textarea rows="2" maxlength="400" data-field="notes">' + esc((p.notes || {})[m.id] || '') + '</textarea></label>' +
          '</article>';
      }).join('');
      return '<section class="sc-group"><h3>' + esc(c.name) + ' <span>· готовность ' + index(byContour(c.id), state.lens) + ' / 100</span></h3>' +
        '<p class="sc-group-desc">' + esc(c.description) + '</p><div class="mdl-grid sc-grid">' + cards + '</div></section>';
    }).join('');
  }

  function renderSummary() {
    renderKpi();
    renderContours();
    renderGaps();
    renderFree();
  }

  function renderAll() {
    renderProfiles();
    renderLens();
    renderSummary();
    renderFilter();
    renderMechs();
  }

  /* ---------- ввод ---------- */

  root.addEventListener('change', function (e) { onField(e, true); });
  root.addEventListener('input', function (e) { if (e.target.tagName !== 'SELECT') onField(e, false); });

  function onField(e, rerenderCard) {
    var t = e.target;
    var field = t.getAttribute('data-field');
    var card = t.closest('.sc-card');
    if (!field || !card) return;
    var id = card.getAttribute('data-id');
    var p = profile();
    p[field] = p[field] || {};
    if (field === 'statuses') {
      p.statuses[id] = Number(t.value);
      card.className = card.className.replace(/sc-card--s\d/, 'sc-card--s' + t.value);
    } else {
      p[field][id] = t.value;
    }
    save();
    if (field === 'statuses' && rerenderCard) {
      renderSummary();
      var head = card.closest('.sc-group').querySelector('h3 span');
      var cid = null;
      data.mechanisms.forEach(function (m) { if (m.id === id) cid = m.contour; });
      if (head && cid) head.textContent = '· готовность ' + index(byContour(cid), state.lens) + ' / 100';
    }
  }

  el('scProfile').addEventListener('change', function (e) {
    state.current = e.target.value; save(); renderAll();
  });

  el('scAdd').addEventListener('click', function () {
    var name = (prompt('Название вуза (профиля):', '') || '').trim();
    if (!name) return;
    if (state.profiles[name]) { setStatus('Профиль «' + name + '» уже есть.'); return; }
    state.profiles[name] = emptyProfile(name);
    state.current = name; save(); renderAll();
    setStatus('Создан профиль «' + name + '». Отметьте статусы механизмов.');
  });

  el('scRename').addEventListener('click', function () {
    var old = state.current;
    var name = (prompt('Новое название профиля:', old) || '').trim();
    if (!name || name === old) return;
    if (state.profiles[name]) { setStatus('Профиль «' + name + '» уже есть.'); return; }
    state.profiles[name] = state.profiles[old];
    state.profiles[name].name = name;
    delete state.profiles[old];
    state.current = name; save(); renderAll();
  });

  el('scDelete').addEventListener('click', function () {
    if (!confirm('Удалить профиль «' + state.current + '» со всеми отметками?')) return;
    delete state.profiles[state.current];
    state.current = '';
    ensureProfile(); save(); renderAll();
  });

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function fileSafe(s) { return s.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60); }

  el('scCsv').addEventListener('click', function () {
    var p = profile();
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var rows = [['Контур', 'Механизм', 'Оператор', 'Статус', 'Объём за год', 'Вклад в МТК (1-3)', 'Вклад в охват (1-3)', 'Метрика', 'Комментарий', 'Что сделать'].map(q).join(';')];
    data.mechanisms.forEach(function (m) {
      rows.push([contourName(m.contour), m.name, m.operator, statusLabel(statusOf(m)), (p.volumes || {})[m.id] || '',
        m.weights.mtk, m.weights.reach, m.metric, (p.notes || {})[m.id] || '', m.action].map(q).join(';'));
    });
    download('vitrina_' + fileSafe(state.current) + '.csv', '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  });

  el('scExport').addEventListener('click', function () {
    download('vitrina_' + fileSafe(state.current) + '.json',
      JSON.stringify({ format: 'aios-showcase', version: 1, profile: profile() }, null, 2), 'application/json');
  });

  el('scImport').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        var p = obj.profile || obj;
        if (!p || typeof p.statuses !== 'object') throw new Error('format');
        var name = String(p.name || file.name.replace(/\.json$/i, '')).slice(0, 80);
        state.profiles[name] = { name: name, statuses: p.statuses || {}, volumes: p.volumes || {}, notes: p.notes || {} };
        state.current = name; save(); renderAll();
        setStatus('Загружен профиль «' + name + '».');
      } catch (err) {
        setStatus('Не удалось прочитать файл: нужен JSON, сохранённый витриной.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  function summaryText() {
    var all = data.mechanisms;
    var lines = [];
    lines.push('Витрина механизмов поддержки техпреда — ' + state.current);
    lines.push('Цель поддержки: фокусировка на сформированном активе вуза, достройка экосистемы и выход в МТК.');
    lines.push('Готовность под новую цель (актив → МТК): ' + index(all, 'mtk') + '/100; под прежнюю (охват): ' + index(all, 'reach') + '/100.');
    lines.push('');
    lines.push('Контуры (готовность под новую цель):');
    data.contours.forEach(function (c) { lines.push('- ' + c.name + ': ' + index(byContour(c.id), 'mtk') + '/100'); });
    lines.push('');
    lines.push('Статусы механизмов:');
    all.forEach(function (m) {
      var p = profile();
      var extra = [(p.volumes || {})[m.id], (p.notes || {})[m.id]].filter(Boolean).join('; ');
      lines.push('- ' + m.name + ' — ' + statusLabel(statusOf(m)) + (extra ? ' (' + extra + ')' : ''));
    });
    lines.push('');
    lines.push('Разрывы на пути к МТК: ' + (gaps().map(function (x) { return x.m.name; }).join('; ') || 'нет'));
    lines.push('');
    lines.push('Задача: оцени, какие механизмы хорошо работают для этого вуза, какие нужно достроить или перенастроить, и предложи дорожную карту на 12–24 месяца с метриками конверсии «технологический пакет → компания → МТК».');
    return lines.join('\n');
  }

  el('scCopy').addEventListener('click', function () {
    var text = summaryText();
    var done = function () { setStatus('Сводка скопирована. Откройте «Новый чат», выберите агента «Аналитик экосистемы» и вставьте её (Ctrl+V).'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { download('vitrina_svodka.txt', text, 'text/plain;charset=utf-8'); });
    } else {
      download('vitrina_svodka.txt', text, 'text/plain;charset=utf-8');
    }
  });

  /* ---------- старт ---------- */

  fetch('/data/support_showcase.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (json) {
      data = json;
      load();
      ensureProfile();
      save();
      renderAll();
    })
    .catch(function () {
      root.innerHTML = '<p class="sc-empty">Не удалось загрузить справочник механизмов (data/support_showcase.json). Обновите страницу.</p>';
    });
})();
