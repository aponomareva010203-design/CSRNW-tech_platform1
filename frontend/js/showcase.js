/* ============================================================
   Витрина механизмов поддержки (страница showcase.html).

   Карта экосистемы: столбцы — этапы пути «идея → РИД → стартап-проект
   → компания → МТК → масштабирование», полосы — типы мер (гранты,
   акселерация, инвестиции…). Каждая мера — плашка, растянутая на те
   этапы, где она работает. Щелчок — карточка меры.

   Справочник — js/support_ecosystem_data.js (window.AIOS_SUPPORT_ECOSYSTEM).
   Настройки пользователя (свои меры, правки, скрытые меры, свои типы,
   названия этапов) хранятся в localStorage и накладываются поверх
   справочника; «Вернуть исходную экосистему» их сбрасывает.
   ============================================================ */

(function () {
  var mapEl = document.getElementById('scMap');
  if (!mapEl) return;

  var BASE = window.AIOS_SUPPORT_ECOSYSTEM;
  var STORE_KEY = 'aios.ecosystem.custom.v1';
  var PALETTE = ['#0E7C66', '#8E44AD', '#D35400', '#2C3E50', '#A93226', '#1A5276'];

  var el = function (id) { return document.getElementById(id); };
  var dialog = el('scDialog');
  var dialogBody = el('scDialogBody');

  if (!BASE || !BASE.measures) {
    mapEl.innerHTML = '<p class="sc-empty">Справочник мер не найден: проверьте, что рядом со страницей есть файл js/support_ecosystem_data.js.</p>';
    return;
  }

  var view = { editing: false, query: '', levels: {}, catsOff: {} };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- настройки пользователя ---------- */

  function emptyCustom() {
    return { overrides: {}, added: [], hidden: [], categories: [], categoryNames: {}, stageNames: {} };
  }

  var custom = (function () {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        var c = emptyCustom();
        Object.keys(c).forEach(function (k) { if (raw[k]) c[k] = raw[k]; });
        return c;
      }
    } catch (e) { /* хранилище недоступно */ }
    return emptyCustom();
  })();

  function saveCustom() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(custom)); } catch (e) { /* без сохранения */ }
  }

  /* ---------- итоговая экосистема = справочник + настройки ---------- */

  function stages() {
    return BASE.stages.map(function (s) {
      return { id: s.id, hint: s.hint, name: custom.stageNames[s.id] || s.name };
    });
  }

  function categories() {
    return BASE.categories.concat(custom.categories).map(function (c) {
      return { id: c.id, color: c.color, own: custom.categories.indexOf(c) !== -1, name: custom.categoryNames[c.id] || c.name };
    });
  }

  function allMeasures() {
    var list = BASE.measures.map(function (m) {
      var o = custom.overrides[m.id];
      var merged = {};
      Object.keys(m).forEach(function (k) { merged[k] = m[k]; });
      if (o) Object.keys(o).forEach(function (k) { merged[k] = o[k]; });
      merged.own = false;
      merged.edited = !!o;
      return merged;
    });
    custom.added.forEach(function (m) {
      var copy = {};
      Object.keys(m).forEach(function (k) { copy[k] = m[k]; });
      copy.own = true;
      list.push(copy);
    });
    return list;
  }

  function visibleMeasures() {
    var hidden = {};
    custom.hidden.forEach(function (id) { hidden[id] = true; });
    var cats = {};
    categories().forEach(function (c) { cats[c.id] = true; });
    return allMeasures().filter(function (m) { return !hidden[m.id] && cats[m.category]; });
  }

  function stageIndex(id) {
    var ids = BASE.stages.map(function (s) { return s.id; });
    var i = ids.indexOf(id);
    return i < 0 ? 0 : i;
  }

  function levelName(id) {
    for (var i = 0; i < BASE.levels.length; i++) if (BASE.levels[i].id === id) return BASE.levels[i].name;
    return '';
  }

  function categoryOf(id) {
    var list = categories();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return { id: id, name: id, color: '#5A6B82' };
  }

  function matches(m) {
    var anyLevel = Object.keys(view.levels).some(function (k) { return view.levels[k]; });
    if (anyLevel && !view.levels[m.level]) return false;
    if (view.catsOff[m.category]) return false;
    if (!view.query) return true;
    var hay = [m.name, m.operator, m.audience, m.description, m.amount].join(' ').toLowerCase();
    return view.query.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  /* ---------- отрисовка ---------- */

  function renderLevels() {
    var box = el('scLevels');
    box.innerHTML = '';
    BASE.levels.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sc-chip' + (view.levels[l.id] ? ' is-on' : '');
      b.setAttribute('aria-pressed', view.levels[l.id] ? 'true' : 'false');
      b.textContent = l.name;
      b.addEventListener('click', function () { view.levels[l.id] = !view.levels[l.id]; render(); });
      box.appendChild(b);
    });
  }

  function renderLegend() {
    var box = el('scLegend');
    box.innerHTML = '';
    categories().forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sc-legend-item' + (view.catsOff[c.id] ? ' is-off' : '');
      b.setAttribute('aria-pressed', view.catsOff[c.id] ? 'false' : 'true');
      b.title = view.catsOff[c.id] ? 'Показать на карте' : 'Скрыть с карты';
      b.innerHTML = '<i style="background:' + esc(c.color) + '"></i>' + esc(c.name);
      b.addEventListener('click', function () { view.catsOff[c.id] = !view.catsOff[c.id]; render(); });
      box.appendChild(b);
    });
  }

  function renderMap() {
    var st = stages();
    var cols = st.length;
    var html = '<div class="sc-row sc-row--head" style="--cols:' + cols + '"><div class="sc-corner">Этап пути →<br><span>Тип меры ↓</span></div>';
    st.forEach(function (s, i) {
      html += '<div class="sc-stage' + (view.editing ? ' is-editable' : '') + '" data-stage="' + esc(s.id) + '" title="' + esc(s.hint) + '">' +
        '<b>' + (i + 1) + '</b><span>' + esc(s.name) + '</span><small>' + esc(s.hint) + '</small></div>';
    });
    html += '</div>';

    var measures = visibleMeasures();
    var shown = 0;
    categories().forEach(function (c) {
      if (view.catsOff[c.id]) return;
      var items = measures.filter(function (m) { return m.category === c.id && matches(m); });
      items.sort(function (a, b) {
        return stageIndex(a.stage_from) - stageIndex(b.stage_from) || stageIndex(a.stage_to) - stageIndex(b.stage_to);
      });
      shown += items.length;
      html += '<div class="sc-row" style="--cols:' + cols + ';--cat:' + esc(c.color) + '">' +
        '<div class="sc-cat' + (view.editing ? ' is-editable' : '') + '" data-cat="' + esc(c.id) + '"><span>' + esc(c.name) + '</span><small>' + items.length + '</small></div>' +
        '<div class="sc-lane">';
      for (var i = 0; i < cols; i++) html += '<div class="sc-cell" style="grid-column:' + (i + 1) + ';grid-row:1 / -1"></div>';
      items.forEach(function (m) {
        var from = stageIndex(m.stage_from), to = Math.max(from, stageIndex(m.stage_to));
        html += '<button type="button" class="sc-node' + (m.own ? ' is-own' : '') + '" data-id="' + esc(m.id) + '" ' +
          'style="grid-column:' + (from + 1) + ' / ' + (to + 2) + '" title="' + esc(m.operator) + '">' +
          '<span class="sc-node-name">' + esc(m.name) + '</span>' +
          '<span class="sc-node-meta">' + esc(levelName(m.level)) + (m.amount ? ' · ' + esc(m.amount) : '') + '</span>' +
          (view.editing ? '<span class="sc-node-x" data-hide="' + esc(m.id) + '" role="button" aria-label="Скрыть меру" title="Скрыть меру">×</span>' : '') +
          '</button>';
      });
      if (!items.length) html += '<div class="sc-lane-empty" style="grid-column:1 / -1">Нет мер по выбранным фильтрам</div>';
      html += '</div></div>';
    });
    mapEl.innerHTML = html;

    var total = measures.length;
    var foot = 'На карте мер: ' + shown + ' из ' + total + '. ';
    var refs = (BASE.sources || []).map(function (s) {
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '</a>';
    }).join(' · ');
    el('scFoot').innerHTML = esc(foot) + 'Условия мер меняются — перед подачей заявки сверяйтесь с сайтом оператора. Источники: ' + refs;
    el('scHiddenCount').textContent = custom.hidden.length;
  }

  function render() {
    renderLevels();
    renderLegend();
    renderMap();
  }

  /* ---------- карточка меры ---------- */

  function findMeasure(id) {
    var list = allMeasures();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function openDialog(html) {
    dialogBody.innerHTML = html;
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }

  function closeDialog() {
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
  }

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog();  // щелчок по фону
  });

  function stageRange(m) {
    var st = stages();
    var a = st[stageIndex(m.stage_from)], b = st[stageIndex(m.stage_to)];
    return a.id === b.id ? a.name : a.name + ' → ' + b.name;
  }

  function showMeasure(m) {
    var c = categoryOf(m.category);
    var rows = [
      ['Оператор', m.operator], ['Для кого', m.audience], ['Этапы', stageRange(m)],
      ['Размер', m.amount], ['Уровень', levelName(m.level)]
    ].filter(function (r) { return r[1]; });
    openDialog(
      '<button class="sc-dialog-close" value="close" aria-label="Закрыть">×</button>' +
      '<span class="sc-dialog-tag" style="background:' + esc(c.color) + '">' + esc(c.name) + '</span>' +
      '<h2>' + esc(m.name) + '</h2>' +
      (m.description ? '<p>' + esc(m.description) + '</p>' : '') +
      '<dl class="sc-dl">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="sc-dialog-actions">' +
      (m.url ? '<a class="btn-primary" href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">Сайт оператора</a>' : '') +
      '<button class="btn-register" type="button" data-act="edit" data-id="' + esc(m.id) + '">Изменить</button>' +
      '</div>'
    );
  }

  /* ---------- форма меры (добавить / изменить) ---------- */

  function options(list, current) {
    return list.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === current ? ' selected' : '') + '>' + esc(x.name) + '</option>';
    }).join('');
  }

  function editMeasure(m) {
    var isNew = !m;
    m = m || { id: '', name: '', operator: '', category: categories()[0].id, level: 'university',
      stage_from: 'idea', stage_to: 'project', audience: '', amount: '', description: '', url: '', own: true };
    var st = stages();
    openDialog(
      '<button class="sc-dialog-close" value="close" aria-label="Закрыть">×</button>' +
      '<h2>' + (isNew ? 'Новая мера поддержки' : 'Изменить меру') + '</h2>' +
      '<div class="sc-form">' +
      '<label class="sc-span2">Название<input name="name" required maxlength="120" value="' + esc(m.name) + '"></label>' +
      '<label class="sc-span2">Оператор<input name="operator" maxlength="160" value="' + esc(m.operator) + '"></label>' +
      '<label>Тип меры<select name="category">' + options(categories(), m.category) + '</select></label>' +
      '<label>Уровень<select name="level">' + options(BASE.levels, m.level) + '</select></label>' +
      '<label>С этапа<select name="stage_from">' + options(st, m.stage_from) + '</select></label>' +
      '<label>По этап<select name="stage_to">' + options(st, m.stage_to) + '</select></label>' +
      '<label>Для кого<input name="audience" maxlength="160" value="' + esc(m.audience) + '"></label>' +
      '<label>Размер<input name="amount" maxlength="60" value="' + esc(m.amount) + '" placeholder="напр. до 5 млн ₽"></label>' +
      '<label class="sc-span2">Описание<textarea name="description" rows="3" maxlength="600">' + esc(m.description) + '</textarea></label>' +
      '<label class="sc-span2">Ссылка<input name="url" type="url" maxlength="300" value="' + esc(m.url) + '" placeholder="https://"></label>' +
      '</div>' +
      '<p class="sc-form-msg" id="scFormMsg"></p>' +
      '<div class="sc-dialog-actions">' +
      '<button class="btn-primary" type="button" data-act="save" data-id="' + esc(m.id) + '">Сохранить</button>' +
      (isNew ? '' : (m.own
        ? '<button class="btn-register" type="button" data-act="delete" data-id="' + esc(m.id) + '">Удалить меру</button>'
        : '<button class="btn-register" type="button" data-act="hide" data-id="' + esc(m.id) + '">Скрыть из экосистемы</button>' +
          (m.edited ? '<button class="btn-register" type="button" data-act="restore" data-id="' + esc(m.id) + '">Вернуть исходное описание</button>' : ''))) +
      '</div>'
    );
  }

  var FIELDS = ['name', 'operator', 'category', 'level', 'stage_from', 'stage_to', 'audience', 'amount', 'description', 'url'];

  function saveForm(id) {
    var values = {};
    FIELDS.forEach(function (f) {
      var input = dialogBody.querySelector('[name="' + f + '"]');
      values[f] = input ? input.value.trim() : '';
    });
    if (!values.name) { el('scFormMsg').textContent = 'Укажите название меры.'; return; }
    if (values.url && !/^https?:\/\//i.test(values.url)) { el('scFormMsg').textContent = 'Ссылка должна начинаться с http:// или https://'; return; }
    if (stageIndex(values.stage_to) < stageIndex(values.stage_from)) {
      var t = values.stage_to; values.stage_to = values.stage_from; values.stage_from = t;
    }
    if (!id) {
      values.id = 'own-' + Date.now().toString(36);
      custom.added.push(values);
    } else {
      var own = custom.added.filter(function (x) { return x.id === id; })[0];
      if (own) FIELDS.forEach(function (f) { own[f] = values[f]; });
      else custom.overrides[id] = values;
    }
    saveCustom();
    closeDialog();
    render();
  }

  function hideMeasure(id) {
    if (custom.hidden.indexOf(id) === -1) custom.hidden.push(id);
    saveCustom();
    render();
  }

  dialogBody.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    if (act === 'edit') editMeasure(findMeasure(id));
    else if (act === 'save') saveForm(id);
    else if (act === 'hide') { closeDialog(); hideMeasure(id); }
    else if (act === 'delete') {
      if (!confirm('Удалить эту меру?')) return;
      custom.added = custom.added.filter(function (x) { return x.id !== id; });
      saveCustom(); closeDialog(); render();
    } else if (act === 'restore') {
      delete custom.overrides[id];
      saveCustom(); closeDialog(); render();
    } else if (act === 'unhide') {
      custom.hidden = custom.hidden.filter(function (x) { return x !== id; });
      saveCustom(); render(); showHidden();
    }
  });

  function showHidden() {
    var list = allMeasures().filter(function (m) { return custom.hidden.indexOf(m.id) !== -1; });
    openDialog(
      '<button class="sc-dialog-close" value="close" aria-label="Закрыть">×</button>' +
      '<h2>Скрытые меры</h2>' +
      (list.length ? '<ul class="sc-hidden-list">' + list.map(function (m) {
        return '<li><span>' + esc(m.name) + '</span><button class="btn-register" type="button" data-act="unhide" data-id="' + esc(m.id) + '">Вернуть</button></li>';
      }).join('') + '</ul>' : '<p>Скрытых мер нет.</p>')
    );
  }

  /* ---------- события карты и панели настройки ---------- */

  mapEl.addEventListener('click', function (e) {
    var x = e.target.closest('[data-hide]');
    if (x) { e.stopPropagation(); hideMeasure(x.getAttribute('data-hide')); return; }
    var node = e.target.closest('.sc-node');
    if (node) {
      var m = findMeasure(node.getAttribute('data-id'));
      if (m) { if (view.editing) editMeasure(m); else showMeasure(m); }
      return;
    }
    if (!view.editing) return;
    var stage = e.target.closest('[data-stage]');
    if (stage) {
      var sid = stage.getAttribute('data-stage');
      var current = stages()[stageIndex(sid)].name;
      var name = (prompt('Название этапа:', current) || '').trim();
      if (name) { custom.stageNames[sid] = name.slice(0, 40); saveCustom(); render(); }
      return;
    }
    var cat = e.target.closest('[data-cat]');
    if (cat) {
      var cid = cat.getAttribute('data-cat');
      var c = categoryOf(cid);
      var cname = (prompt('Название типа мер (пусто — удалить свой тип):', c.name) || '').trim();
      if (cname) custom.categoryNames[cid] = cname.slice(0, 50);
      else if (c.own && confirm('Удалить тип «' + c.name + '»? Его меры перестанут показываться.')) {
        custom.categories = custom.categories.filter(function (x) { return x.id !== cid; });
      }
      saveCustom(); render();
    }
  });

  el('scSearch').addEventListener('input', function (e) {
    view.query = e.target.value.trim().toLowerCase();
    renderMap();
  });

  el('scEditToggle').addEventListener('click', function () {
    view.editing = !view.editing;
    el('scEditBar').hidden = !view.editing;
    this.setAttribute('aria-pressed', view.editing ? 'true' : 'false');
    this.textContent = view.editing ? 'Готово' : 'Настроить экосистему';
    mapEl.classList.toggle('is-editing', view.editing);
    renderMap();
  });

  el('scAddMeasure').addEventListener('click', function () { editMeasure(null); });
  el('scShowHidden').addEventListener('click', showHidden);

  el('scAddCategory').addEventListener('click', function () {
    var name = (prompt('Название нового типа мер (например, «Региональные программы»):', '') || '').trim();
    if (!name) return;
    custom.categories.push({ id: 'cat-' + Date.now().toString(36), name: name.slice(0, 50), color: PALETTE[custom.categories.length % PALETTE.length] });
    saveCustom();
    render();
  });

  el('scReset').addEventListener('click', function () {
    if (!confirm('Вернуть исходную экосистему? Ваши меры, правки и скрытые меры будут удалены.')) return;
    custom = emptyCustom();
    saveCustom();
    render();
  });

  render();
})();
