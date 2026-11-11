/* ============================================================
   Конструктор дашборда: справочники (dashboard-builder.html).
   Движок и интерфейс — js/dashboard_builder.js.

   Здесь всё, что конструктор ПРЕДЛАГАЕТ участнику:
     - STEPS      — пайплайн сборки дашборда (6 шагов) и подсказки к ним;
     - ELEMENTS   — типы элементов дашборда (KPI, цель, график, таблица,
                    решения и поручения, вывод, раздел);
     - VIEWS      — типы визуализаций: когда какой использовать и какие
                    поля данных им нужны;
     - TEMPLATES  — шаблоны по ролям: цель, вопросы и рекомендуемые
                    элементы (добавляются только по нажатию);
     - DEMO       — подписи полей демо-данных вуза (data/dashboard.json);
     - PRINCIPLES — правила хорошего дашборда для шагов 5–6.

   Как добавить шаблон роли: объект в TEMPLATES по образцу соседних.
   Поле рекомендованного элемента ссылается на таблицу и поля демо-данных;
   для загруженных данных показываются только те, чьи поля нашлись.
   ============================================================ */

(function () {
  var STEPS = [
    { id: 'goal', n: 1, title: 'Цель и аудитория', hint: 'Для кого дашборд и какие решения он поддерживает' },
    { id: 'data', n: 2, title: 'Данные', hint: 'Источник, таблицы и поля' },
    { id: 'kpi', n: 3, title: 'Показатели', hint: 'Ключевые KPI и цели' },
    { id: 'viz', n: 4, title: 'Визуализации', hint: 'Графики, таблицы, рейтинги' },
    { id: 'layout', n: 5, title: 'Компоновка', hint: 'Порядок, размеры, разделы' },
    { id: 'check', n: 6, title: 'Проверка и публикация', hint: 'Чек-лист качества, просмотр, печать' }
  ];

  /* Тип дашборда задаёт, что предлагать на шагах 3–4 */
  var KINDS = [
    { id: 'strategic', title: 'Стратегический', hint: 'Для руководства: 5–7 KPI, цели, тренды, без деталей. Обновляется раз в месяц-квартал.' },
    { id: 'operational', title: 'Операционный', hint: 'Для ежедневного управления: сроки, статусы, просрочки, поручения.' },
    { id: 'analytical', title: 'Аналитический', hint: 'Для поиска причин: разрезы, распределения, матрицы, детальные таблицы.' },
    { id: 'project', title: 'Проектный', hint: 'Для проектной команды: план-факт, вехи, риски, решения.' }
  ];

  var ELEMENTS = {
    kpi: { title: 'Карточка KPI', group: 'Показатели', size: 's', hint: 'Одно ключевое число: количество, сумма, среднее, доля. Можно задать порог — карточка станет «светофором».' },
    goal: { title: 'План-факт (цель)', group: 'Показатели', size: 's', hint: 'Факт против цели с прогресс-баром и сроком. Главный элемент управленческого дашборда.' },
    chart: { title: 'График', group: 'Визуализации', size: 'm', hint: 'Сравнение, структура, распределение, воронка, сроки — тип выбирается в настройках.' },
    table: { title: 'Таблица', group: 'Детализация', size: 'l', hint: 'Свои столбцы, сортировка, фильтр и лимит строк — детали под графиками.' },
    actions: { title: 'Решения и поручения', group: 'Управление', size: 'm', hint: 'Что делаем по итогам: задача, ответственный, срок, отметка о выполнении.' },
    note: { title: 'Вывод / комментарий', group: 'Управление', size: 'm', hint: 'Интерпретация цифр: что происходит, почему, что предлагаем.' },
    section: { title: 'Заголовок раздела', group: 'Оформление', size: 'xl', hint: 'Делит дашборд на смысловые блоки: «Портфель», «Деньги», «Команды».' }
  };

  /* needs: что нужно из данных. cat — категория, ord — порядковое число
     (УГТ, год), num — число, date — дата, pct — проценты 0–100 */
  var VIEWS = [
    { id: 'bars', title: 'Горизонтальные полосы', group: 'Сравнение', needs: ['cat'], hint: 'Сравнить категории, особенно с длинными названиями (подразделения, команды). Сортируйте по значению.' },
    { id: 'columns', title: 'Столбцы', group: 'Сравнение', needs: ['ord'], hint: 'Порядковые категории: УГТ 1–9, годы, этапы. Порядок оси сохраняется.' },
    { id: 'top', title: 'Рейтинг (топ-N)', group: 'Сравнение', needs: ['label', 'num'], hint: 'Лидеры и аутсайдеры по одному показателю: крупнейшие проекты, самые дорогие РИД.' },
    { id: 'donut', title: 'Кольцо (доли)', group: 'Структура', needs: ['cat'], hint: 'Доли целого, если категорий не больше 5–6. Для большего числа — полосы.' },
    { id: 'stacked', title: 'Составные полосы 100%', group: 'Структура', needs: ['cat', 'cat2'], hint: 'Структура в разрезе: доля перспективных РИД по подразделениям.' },
    { id: 'funnel', title: 'Воронка', group: 'Процесс', needs: ['ord'], hint: 'Последовательные стадии и конверсия между ними: УГТ, стадии финансирования, этапы отбора.' },
    { id: 'histogram', title: 'Гистограмма', group: 'Распределение', needs: ['num'], hint: 'Как распределено числовое поле: бюджеты, затраты, сроки. Видны выбросы и типичные значения.' },
    { id: 'matrix', title: 'Тепловая матрица', group: 'Распределение', needs: ['cat', 'cat2'], hint: 'Пересечение двух разрезов: подразделение × стадия. Цвет показывает концентрацию.' },
    { id: 'progress', title: 'Прогресс по строкам', group: 'Сроки и статусы', needs: ['label', 'pct'], hint: 'Выполнение по каждому объекту: обязательства, этапы, планы. Светофор по порогам.' },
    { id: 'timeline', title: 'Сроки и дедлайны', group: 'Сроки и статусы', needs: ['label', 'date'], hint: 'Что и когда наступает, что просрочено. Для операционного контроля.' }
  ];

  var AGGS = { count: 'Количество', sum: 'Сумма', avg: 'Среднее', min: 'Минимум', max: 'Максимум', share: 'Доля, %', distinct: 'Уникальных значений' };

  /* Подписи полей демо-данных и вычисляемые поля (добавляет движок) */
  var DEMO = {
    projects: { title: 'Проекты портфеля', fields: {
      title: ['Проект', 'text'], id: ['Код', 'text'], department: ['Подразделение', 'cat'], trl: ['УГТ', 'ord'],
      funding_stage: ['Стадия финансирования', 'cat'], budget: ['Бюджет', 'money'], _years: ['Лет на текущем УГТ', 'num'],
      _state: ['Статус', 'cat'], trl_since: ['На уровне с', 'date'] } },
    patents: { title: 'Патенты и РИД', fields: {
      title: ['РИД', 'text'], id: ['Номер', 'text'], type: ['Тип РИД', 'cat'], year: ['Год', 'ord'], department: ['Подразделение', 'cat'],
      perspective: ['Перспективность', 'cat'], support_cost: ['Поддержка в год', 'money'], licensee: ['Лицензиат', 'cat'], _licensed: ['Лицензия', 'cat'] } },
    teams: { title: 'Стартап-коллективы', fields: {
      name: ['Команда', 'text'], funding: ['Финансирование', 'cat'], members: ['Участников', 'num'], project: ['Проект', 'cat'] } },
    venture_tracker: { title: 'Трекер обязательств', fields: {
      startup: ['Стартап', 'cat'], owner: ['Ответственный', 'cat'], commitment: ['Обязательство', 'text'], due: ['Срок', 'date'],
      progress: ['Выполнение, %', 'pct'], _status: ['Статус', 'cat'] } }
  };

  function el(type, title, size, cfg) { return { type: type, title: title, size: size, cfg: cfg }; }

  var TEMPLATES = [
    {
      id: 'rector', title: 'Проректор по инновациям', kind: 'strategic',
      audience: 'Проректор, ректорат, учёный совет',
      purpose: 'Видеть состояние инновационного портфеля и принимать решения о поддержке, закрытии и масштабировании проектов',
      questions: ['Сколько проектов и на каких УГТ?', 'Какие проекты застряли и требуют решения о закрытии?', 'Где теряются проекты в цепочке финансирования?', 'Выполняют ли стартапы обязательства?'],
      recipes: [
        el('kpi', 'Проекты в портфеле', 's', { table: 'projects', agg: 'count' }),
        el('kpi', 'Кандидаты на закрытие', 's', { table: 'projects', agg: 'count', filterField: '_state', filterValue: 'Кандидат на закрытие', target: 0, direction: 'down', note: 'на одном УГТ 2 года и дольше' }),
        el('kpi', 'Бюджет портфеля', 's', { table: 'projects', agg: 'sum', field: 'budget' }),
        el('goal', 'Выполнено обязательств стартапов', 's', { table: 'venture_tracker', agg: 'count', filterField: '_status', filterValue: 'Выполнено', target: 6, deadline: 'к концу года' }),
        el('chart', 'Воронка проектов по УГТ', 'l', { table: 'projects', view: 'funnel', groupBy: 'trl', agg: 'count', cumulative: true }),
        el('chart', 'Бюджет по стадиям финансирования', 'm', { table: 'projects', view: 'bars', groupBy: 'funding_stage', agg: 'sum', field: 'budget' }),
        el('chart', 'Статусы проектов по подразделениям', 'm', { table: 'projects', view: 'stacked', groupBy: 'department', groupBy2: '_state', agg: 'count' }),
        el('actions', 'Решения по портфелю', 'm', { items: [{ text: 'Рассмотреть закрытие проектов-кандидатов', owner: 'Проектный офис', due: 'до конца квартала', done: false }] })
      ]
    },
    {
      id: 'ctt', title: 'Центр трансфера технологий', kind: 'analytical',
      audience: 'Директор ЦТТ, патентный офис',
      purpose: 'Управлять портфелем РИД: поддерживать перспективное, отказываться от балласта, искать лицензиатов',
      questions: ['Сколько стоит поддержка РИД и где она неоправданна?', 'Какие подразделения дают перспективные РИД?', 'Сколько РИД лицензировано?'],
      recipes: [
        el('kpi', 'РИД в портфеле', 's', { table: 'patents', agg: 'count' }),
        el('kpi', 'Доля лицензированных РИД', 's', { table: 'patents', agg: 'share', shareField: '_licensed', shareValue: 'Есть лицензиат', target: 30, direction: 'up' }),
        el('kpi', 'Затраты на поддержку РИД', 's', { table: 'patents', agg: 'sum', field: 'support_cost' }),
        el('chart', 'Перспективность РИД по подразделениям', 'm', { table: 'patents', view: 'stacked', groupBy: 'department', groupBy2: 'perspective', agg: 'count' }),
        el('chart', 'Самые дорогие в поддержке РИД', 'm', { table: 'patents', view: 'top', labelField: 'title', valueField: 'support_cost', top: 6 }),
        el('chart', 'РИД по типам', 's', { table: 'patents', view: 'donut', groupBy: 'type', agg: 'count' }),
        el('note', 'Вывод ЦТТ', 'm', { tone: 'insight', text: 'Опишите, что видно по данным, и что предлагаете: от каких РИД отказаться, кого искать в лицензиаты.' })
      ]
    },
    {
      id: 'accel', title: 'Акселератор и венчурный билдер', kind: 'operational',
      audience: 'Руководитель акселератора, трекеры',
      purpose: 'Контролировать выполнение обязательств стартапов и вовремя помогать отстающим',
      questions: ['Какие обязательства просрочены или под риском?', 'Какие сроки наступают ближе всего?', 'Кто из ответственных отстаёт?'],
      recipes: [
        el('kpi', 'Просроченные обязательства', 's', { table: 'venture_tracker', agg: 'count', filterField: '_status', filterValue: 'Просрочено', target: 0, direction: 'down' }),
        el('kpi', 'Средний прогресс', 's', { table: 'venture_tracker', agg: 'avg', field: 'progress', unit: '%' }),
        el('kpi', 'Людей в стартап-командах', 's', { table: 'teams', agg: 'sum', field: 'members' }),
        el('chart', 'Сроки обязательств', 'l', { table: 'venture_tracker', view: 'timeline', labelField: 'startup', dateField: 'due', valueField: 'progress' }),
        el('chart', 'Выполнение по стартапам', 'm', { table: 'venture_tracker', view: 'progress', labelField: 'startup', valueField: 'progress' }),
        el('chart', 'Обязательства по статусам', 's', { table: 'venture_tracker', view: 'donut', groupBy: '_status', agg: 'count' }),
        el('actions', 'Поручения трекерам', 'm', { items: [{ text: 'Встреча со стартапами в статусе «Риск»', owner: 'Трекер', due: 'на этой неделе', done: false }] })
      ]
    },
    {
      id: 'finance', title: 'Финансы инновационной деятельности', kind: 'analytical',
      audience: 'Финансовый директор, планово-экономический отдел',
      purpose: 'Понимать, куда идут деньги и где их можно перераспределить',
      questions: ['Как бюджет распределён по стадиям и УГТ?', 'Сколько денег у застрявших проектов?', 'Каков типичный размер бюджета проекта?'],
      recipes: [
        el('kpi', 'Бюджет портфеля', 's', { table: 'projects', agg: 'sum', field: 'budget' }),
        el('kpi', 'Средний бюджет проекта', 's', { table: 'projects', agg: 'avg', field: 'budget' }),
        el('kpi', 'Бюджет кандидатов на закрытие', 's', { table: 'projects', agg: 'sum', field: 'budget', filterField: '_state', filterValue: 'Кандидат на закрытие', note: 'можно перераспределить' }),
        el('chart', 'Бюджет по УГТ', 'm', { table: 'projects', view: 'columns', groupBy: 'trl', agg: 'sum', field: 'budget' }),
        el('chart', 'Распределение бюджетов проектов', 'm', { table: 'projects', view: 'histogram', field: 'budget' }),
        el('chart', 'Бюджет: подразделение × стадия', 'l', { table: 'projects', view: 'matrix', groupBy: 'department', groupBy2: 'funding_stage', agg: 'sum', field: 'budget' }),
        el('table', 'Крупнейшие проекты', 'l', { table: 'projects', columns: ['title', 'trl', 'funding_stage', 'budget'], sortBy: 'budget', desc: true, limit: 6 })
      ]
    },
    {
      id: 'project', title: 'Руководитель проекта', kind: 'project',
      audience: 'Команда проекта, куратор',
      purpose: 'Следить за планом-фактом, сроками и рисками своего проекта',
      questions: ['Идём ли по плану?', 'Какие вехи ближайшие?', 'Какие решения нужны от руководства?'],
      recipes: [
        el('goal', 'Цель проекта', 's', { table: 'venture_tracker', agg: 'avg', field: 'progress', target: 100, deadline: 'до конца года', unit: '%' }),
        el('chart', 'Вехи и сроки', 'l', { table: 'venture_tracker', view: 'timeline', labelField: 'commitment', dateField: 'due', valueField: 'progress' }),
        el('actions', 'Риски и решения', 'm', { items: [{ text: 'Риск: срыв сроков поставки оборудования', owner: 'Руководитель проекта', due: '', done: false }] }),
        el('note', 'Статус проекта', 'm', { tone: 'info', text: 'Коротко: что сделано, что мешает, что нужно от руководства.' })
      ]
    }
  ];

  var PRINCIPLES = [
    ['Главное — сверху слева', 'Взгляд идёт слева направо и сверху вниз (Z-паттерн): KPI в первой строке, детали — ниже.'],
    ['5–7 показателей', 'Больше KPI — меньше внимания к каждому. Остальное уберите в аналитический дашборд.'],
    ['Каждому числу — контекст', 'Цель, порог или сравнение превращают число в сигнал: «хорошо» или «пора действовать».'],
    ['Один график — один вопрос', 'Заголовок графика формулирует вопрос или вывод: «Где застревают проекты?».'],
    ['От обзора к деталям', 'Сначала итог, потом разрезы, внизу таблицы с деталями.'],
    ['Дашборд ведёт к решению', 'Блок «Решения и поручения» фиксирует, что делаем по итогам.']
  ];

  window.AIOS_DASH_CATALOG = {
    STEPS: STEPS, KINDS: KINDS, ELEMENTS: ELEMENTS, VIEWS: VIEWS, AGGS: AGGS,
    DEMO: DEMO, TEMPLATES: TEMPLATES, PRINCIPLES: PRINCIPLES
  };
})();
