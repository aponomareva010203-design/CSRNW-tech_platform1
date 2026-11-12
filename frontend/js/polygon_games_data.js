/* ============================================================
   Игровые полигоны: управленческие симуляторы для проректора
   по инновациям (polygons.html). Движок и интерфейс —
   js/polygon_games.js.

   Игры построены по образцу симуляторов и деловых игр, но решения
   в них — инструменты, которые реально есть у вуза: внутренний
   фонд proof-of-concept, лицензия или доля вуза в спин-оффе,
   гранты фондов, акселератор, проектный офис, положение о РИД,
   распределение бюджета программы развития. После каждой игры —
   управленческий разбор: что сработало, что нет, вопросы для
   обсуждения команды и чек-лист «что проверить в своём вузе».

   1. «Спин-офф из лаборатории: решения вуза» (kind: 'turns') —
      12 кварталов сопровождения технологии от УГТ 4 до рынка:
      права на РИД, финансирование, команда, спрос, инвесторы.
      Итог — эффект для вуза (доля, роялти, привлечённые средства
      против вложений вуза).
   2. «Программа развития: инновационный портфель вуза» (kind:
      'turns' + allocations + planFact) — 6 лет распределения бюджета
      между инструментами, ежегодный план-факт по показателям.
   3. «Управленческие ситуации проректора» (kind: 'cases') —
      ветвящиеся кейсы из практики: у каждого выбора — последствие
      и комментарий «что учесть»; в итоге — профиль управленческого
      стиля команды для обсуждения.

   Все суммы — тыс. ₽. Числа и события — учебные, условные: модель
   упрощает реальность, чтобы показать связи между решениями.
   Как добавить игру: объект в массив games по образцу ниже.
   Функции получают s — состояние, r() — случайное число 0..1
   (повторяемое для кода сессии), log(текст) — запись в журнал.
   Движок ведёт s._used (сколько раз выбрано каждое решение) и
   s._choices (выбор по событиям) — их читает debrief().
   ============================================================ */

(function () {
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function sat(x) { return x / (1 + x); }  // насыщение: отдача от денег убывает
  function used(s, id) { return (s._used && s._used[id]) || 0; }

  /* ======================================================
     1. Спин-офф из лаборатории: решения вуза
     ====================================================== */

  var SALARY_ENG = 300, SALARY_SALES = 250, ROYALTY = 0.05;

  function valuation(s) {
    var asset = s.trl * s.trl * 700 + s.ip * 1500 + s.fit * 50 + s.customers * 600;
    var market = s.revenue * 4 * 6;  // годовая выручка × 6
    return Math.round(Math.max(asset, market));
  }
  function burn(s) { return s.eng * SALARY_ENG + s.sales * SALARY_SALES + s.overhead; }
  /* новые доли (раунд, опцион) размывают всех держателей пропорционально */
  function dilute(s, pct) {
    var k = (100 - pct) / 100;
    s.founders = Math.round(s.founders * k * 10) / 10;
    s.uni = Math.round(s.uni * k * 10) / 10;
    s.inv = Math.round((s.inv * k) * 10) / 10;
  }
  function uniEffect(s) {
    var value = s.cash < 0 ? 0 : (s.exited || valuation(s));
    return Math.round(value * s.uni / 100 + s.royalties - s.uniInvest);
  }
  function setRights(s, mode, t) {
    s.rights = mode; s.rightsAt = t;
    if (mode === 'equity') { var take = Math.min(20, s.founders); s.founders -= take; s.uni += take; }
  }

  var STARTUP = {
    id: 'spinoff',
    kind: 'turns',
    title: 'Спин-офф из лаборатории: решения вуза',
    role: 'Вы — проректор по инновациям: сопровождаете вывод технологии лаборатории на рынок',
    summary: 'Технология на УГТ 4, команда из двух инженеров и автора-профессора. За 3 года нужно довести её до рынка и решить, как вуз участвует: лицензия с роялти или доля в компании, внутренний грант proof-of-concept, поиск CEO, гранты, инвесторы, пилоты с индустрией. Итог — эффект для вуза и выживание компании.',
    tags: ['12 кварталов', '3 решения за квартал', 'итог: эффект для вуза'],
    turns: 12,
    actionsPerTurn: 3,
    eventChance: 0.6,
    turnLabel: function (t) { return 'Квартал ' + (t % 4 + 1) + ' · ' + (2027 + Math.floor(t / 4)) + ' год'; },
    goals: 'Цель — вывести технологию на рынок: выручка спин-оффа от 2 млн ₽ за квартал или продажа технологии стратегу, без кассового разрыва. ' +
      'Итоговая оценка — эффект для вуза, млн ₽: стоимость доли вуза + лицензионные платежи − вложения вуза в proof-of-concept, плюс 2 балла за каждый достигнутый результат. ' +
      'Деньги проекта тратятся на решения и ежеквартально на зарплаты и аренду. Модель условная: она показывает связи между решениями, а не точные цифры.',
    init: function () {
      return {
        cash: 2500, trl: 4, trlProg: 0, eng: 2, sales: 0, morale: 70, fit: 10,
        pilots: 0, customers: 0, price: 180, revenue: 0, ip: 0, ipPending: [], rep: 10,
        founders: 100, uni: 0, inv: 0, rights: '', rightsAt: null, royalties: 0, uniInvest: 0, external: 0,
        ceo: false, pocCool: 0, grants: [], grantCooldown: 0, overhead: 150,
        investCool: 0, investTried: null, coldMarket: 0, exited: 0, lowCash: 0, coi: false, t: 0, effect: 0
      };
    },
    metrics: [
      { key: 'cash', title: 'Деньги проекта', fmt: 'money', alert: function (s) { return s.cash < burn(s) * 2; }, note: function (s) { return 'расход ' + fmtMoney(burn(s)) + ' в квартал'; } },
      { key: 'trl', title: 'УГТ', fmt: 'int', note: function (s) { return s.trl >= 9 ? 'технология готова' : 'до следующего уровня: ' + Math.max(0, 100 - Math.round(s.trlProg)) + '%'; } },
      { key: 'revenue', title: 'Выручка за квартал', fmt: 'money', note: function (s) { return s.customers + ' клиент(ов), ' + s.pilots + ' пилот(ов)'; } },
      { key: 'fit', title: 'Подтверждённый спрос', fmt: 'pct', note: function () { return 'интервью, письма о намерениях, пилоты'; } },
      { key: 'morale', title: 'Мотивация команды', fmt: 'pct', alert: function (s) { return s.morale < 35; }, note: function (s) { return s.eng + ' инж., ' + s.sales + ' прод.' + (s.ceo ? ', CEO' : ''); } },
      { key: 'uni', title: 'Доля вуза', fmt: 'pct', note: function (s) { return s.rights === 'license' ? 'лицензия: роялти ' + fmtMoney(s.royalties) : s.rights === 'equity' ? 'оценка компании ' + fmtMoney(valuation(s)) : 'права на РИД не оформлены'; } },
      { key: 'effect', title: 'Эффект для вуза', fmt: 'money', alert: function (s) { return uniEffect(s) < 0; }, note: function (s) { return 'вложено вузом ' + fmtMoney(s.uniInvest); } }
    ],
    charts: [['cash', 'Деньги проекта', 'money'], ['revenue', 'Выручка', 'money'], ['trl', 'УГТ', 'int'], ['effect', 'Эффект для вуза', 'money']],
    actions: [
      { id: 'rnd', title: 'Этап НИОКР', note: 'Двигает УГТ; быстрее с большой и мотивированной командой', cost: 400,
        effect: function (s, r, log) {
          var gain = (18 + 9 * s.eng) * (0.5 + s.morale / 200) * (0.85 + r() * 0.3);
          s.trlProg += gain; s.morale -= 3;
          log('Этап НИОКР: +' + Math.round(gain) + '% к следующему УГТ');
        } },
      { id: 'poc', title: 'Грант вуза на proof-of-concept', note: '+1,5 млн ₽ из программы развития; засчитывается как вложение вуза', cost: 0,
        available: function (s) { return s.trl > 6 ? 'программа PoC — для УГТ 4–6' : s.pocCool > 0 ? 'следующий транш через ' + s.pocCool + ' кв.' : true; },
        effect: function (s, r, log) { s.cash += 1500; s.uniInvest += 1500; s.pocCool = 4; log('Вуз выделил грант proof-of-concept: +1,5 млн ₽'); } },
      { id: 'custdev', title: 'Проверка спроса у индустрии', note: '30 интервью с заказчиками, письма о намерениях', cost: 60,
        effect: function (s, r, log) {
          var g = Math.round(12 * (1 - s.fit / 110) + r() * 3);
          s.fit = clamp(s.fit + g, 0, 100); s.rep += 1;
          log('Проверка спроса: подтверждённый спрос +' + g);
        } },
      { id: 'license', title: 'Права на РИД: лицензия', note: 'Лицензионный договор: компании — право использования, вузу — 5% выручки', cost: 300,
        available: function (s) { return s.rights ? 'права уже оформлены' : true; },
        effect: function (s, r, log) { setRights(s, 'license', s.t); s.rep += 3; log('Заключён лицензионный договор: вуз получает 5% выручки'); } },
      { id: 'equity', title: 'Права на РИД: доля вуза', note: 'Право использования РИД — вклад в капитал компании; вуз получает 20% доли', cost: 100,
        available: function (s) { return s.rights ? 'права уже оформлены' : true; },
        effect: function (s, r, log) { setRights(s, 'equity', s.t); s.rep += 3; log('Право использования РИД внесено в капитал: доля вуза ' + s.uni + '%'); } },
      { id: 'ceo', title: 'Найти предпринимателя на роль CEO', note: 'Автор технологии остаётся научным руководителем; растут продажи и шансы на инвестиции', cost: 150,
        available: function (s) { return s.ceo ? 'CEO уже в команде' : true; },
        effect: function (s, r, log) { s.ceo = true; s.morale -= 4; dilute(s, 5); log('В компанию пришёл CEO-предприниматель (опцион 5%)'); } },
      { id: 'hire_eng', title: 'Усилить команду инженером', note: '+1 к скорости НИОКР; зарплата 300 тыс. ₽ в квартал', cost: 100,
        available: function (s) { return s.eng >= 8 ? 'команда уже 8 инженеров' : true; },
        effect: function (s, r, log) { s.eng += 1; s.morale += 2; log('В команде новый инженер (' + s.eng + ')'); } },
      { id: 'hire_sales', title: 'Нанять менеджера по продажам', note: 'Переводит пилоты в контракты; 250 тыс. ₽ в квартал', cost: 100,
        available: function (s) { return s.trl < 5 ? 'нужен УГТ 5+' : s.sales >= 5 ? 'уже 5 продажников' : true; },
        effect: function (s, r, log) { s.sales += 1; log('В команде новый менеджер по продажам (' + s.sales + ')'); } },
      { id: 'patent', title: 'Заявка на патент через ЦТТ', note: 'Через 2 квартала +1 патент: растут оценка и шансы на грант', cost: 250,
        available: function (s) { return s.trl < 3 ? 'нужен УГТ 3+' : true; },
        effect: function (s, r, log) { s.ipPending.push(2); log('ЦТТ подал заявку на патент'); } },
      { id: 'pilot', title: 'Пилот у индустриального партнёра', note: 'Пилот может перейти в контракт; растёт подтверждённый спрос', cost: 200,
        available: function (s) { return s.trl < 5 ? 'нужен УГТ 5+' : true; },
        effect: function (s, r, log) { s.pilots += 1; s.fit = clamp(s.fit + 6, 0, 100); s.rep += 3; log('Запущен пилот (' + s.pilots + ' в работе)'); } },
      { id: 'market', title: 'Продажи: выставки и отраслевые мероприятия', note: 'Новые клиенты; зависит от продажников и спроса', cost: 350,
        available: function (s) { return s.trl < 7 ? 'нужен УГТ 7+' : true; },
        effect: function (s, r, log) {
          var n = Math.round((s.sales + (s.ceo ? 1 : 0.5)) * s.fit / 45 * (0.6 + r() * 0.8));
          s.customers += n; s.rep += 2;
          log('Продажи: +' + n + ' клиент(ов)');
        } },
      { id: 'grant', title: 'Заявка в фонд (ФСИ или отраслевой)', note: 'Решение через 2 квартала; шанс выше с патентами и высоким УГТ', cost: 0,
        available: function (s) { return s.grantCooldown > 0 ? 'следующая заявка через ' + s.grantCooldown + ' кв.' : true; },
        effect: function (s, r, log) {
          var p = clamp(0.2 + s.trl * 0.04 + s.ip * 0.06 + s.rep / 250, 0.1, 0.85);
          var amount = s.trl < 6 ? 5000 : 15000;
          s.grants.push({ amount: amount, turns: 2, p: p });
          s.grantCooldown = 3;
          log('Подана заявка на грант ' + fmtMoney(amount) + ' (шанс около ' + Math.round(p * 100) + '%)');
        } },
      { id: 'invest', title: 'Переговоры с инвестором', note: 'Раунд за 20% доли; шанс зависит от спроса, клиентов, УГТ и прав на РИД', cost: 50,
        available: function (s) { return s.investCool > 0 ? 'инвесторы ждут результатов: ' + s.investCool + ' кв.' : s.trl < 5 && !s.customers ? 'нужен УГТ 5+ или клиенты' : true; },
        effect: function (s, r, log) {
          if (s.investTried === null) s.investTried = s.t;
          var p = 0.08 + s.fit / 220 + s.customers * 0.05 + s.trl * 0.035 + s.rep / 300 + s.ip * 0.03 + (s.ceo ? 0.1 : 0);
          if (!s.rights) p *= 0.5;
          if (s.coldMarket > 0) p *= 0.6;
          p = clamp(p, 0.05, 0.85);
          s.investCool = 2;
          if (r() < p) {
            var amount = Math.round(valuation(s) * 0.25);
            s.cash += amount; s.external += amount; dilute(s, 20); s.inv += 20; s.rep += 5; s.morale += 8;
            log('Раунд закрыт: +' + fmtMoney(amount) + ' за 20% доли (шанс был около ' + Math.round(p * 100) + '%)');
          } else {
            s.morale -= 6;
            log('Инвестор отказал (шанс был около ' + Math.round(p * 100) + '%)' + (!s.rights ? ': права на технологию не оформлены' : !s.ceo ? ': нет предпринимателя во главе компании' : ''));
          }
        } },
      { id: 'contract', title: 'Заказной НИОКР для индустрии', note: 'Быстрые деньги, но команда отвлекается от продукта', cost: 0,
        effect: function (s, r, log) {
          var cash = 500 + 150 * s.eng;
          s.cash += cash; s.external += cash; s.trlProg = Math.max(0, s.trlProg - 12); s.morale -= 4; s.fit = clamp(s.fit + 2, 0, 100);
          log('Заказной НИОКР: +' + fmtMoney(cash) + ', продукт притормозил');
        } },
      { id: 'accel', title: 'Акселератор вуза: трекинг команды', note: 'Трекер и эксперты: растут мотивация и понимание рынка', cost: 80,
        effect: function (s, r, log) { s.morale += 10; s.fit = clamp(s.fit + 4, 0, 100); s.rep += 1; log('Трекинг в акселераторе: мотивация +10, спрос +4'); } },
      { id: 'cut', title: 'Сократить расходы', note: 'Минус инженер: экономия 300 тыс. ₽ в квартал, но мотивация падает', cost: 0,
        available: function (s) { return s.eng <= 1 ? 'останется без инженеров' : true; },
        effect: function (s, r, log) { s.eng -= 1; s.morale -= 15; log('Сокращение: инженеров ' + s.eng); } }
    ],
    tick: function (s, r, log) {
      s.morale = clamp(s.morale, 0, 100);
      while (s.trlProg >= 100 && s.trl < 9) {
        s.trlProg -= 100; s.trl += 1;
        log('Технология достигла УГТ ' + s.trl);
      }
      if (s.trl >= 9) s.trlProg = 0;
      s.ipPending = s.ipPending.map(function (x) { return x - 1; }).filter(function (x) {
        if (x <= 0) { s.ip += 1; log('Получен патент (всего ' + s.ip + ')'); return false; }
        return true;
      });
      s.grants = s.grants.filter(function (g) {
        g.turns -= 1;
        if (g.turns > 0) return true;
        if (r() < g.p) { s.cash += g.amount; s.external += g.amount; s.rep += 4; log('Грант одобрен: +' + fmtMoney(g.amount)); }
        else log('Грант не одобрен');
        return false;
      });
      var conv = 0;
      for (var i = s.pilots; i > 0; i--) {
        if (r() < s.fit / 220 + 0.06 + s.sales * 0.03 + (s.ceo ? 0.05 : 0)) { s.pilots -= 1; s.customers += 1; conv++; }
      }
      if (conv) log('Пилот перешёл в контракт: +' + conv);
      if (s.trl >= 8 && s.sales) {
        var org = Math.round(s.sales * s.fit / 110 * r());
        if (org) { s.customers += org; log('Рекомендации клиентов: +' + org + ' клиент(ов)'); }
      }
      var churn = 0;
      for (var j = s.customers; j > 0; j--) { if (r() < (1 - s.fit / 100) * 0.18) churn++; }
      if (churn) { s.customers -= churn; log('Ушли клиенты: ' + churn); }
      s.revenue = s.customers * s.price;
      if (s.rights === 'license' && s.revenue) {
        var roy = Math.round(s.revenue * ROYALTY);
        s.royalties += roy; s.cash -= roy;
      }
      s.cash += s.revenue - burn(s);
      var runway = s.cash / Math.max(1, burn(s));
      if (runway < 2) { s.morale -= 8; s.lowCash += 1; log('Денег меньше чем на 2 квартала — команда нервничает'); }
      s.morale += s.morale < 60 ? 2 : -2;
      s.morale = clamp(s.morale, 0, 100);
      if (s.morale < 25 && s.eng > 1 && r() < 0.45) { s.eng -= 1; log('Из-за выгорания ушёл инженер'); }
      s.grantCooldown = Math.max(0, s.grantCooldown - 1);
      s.investCool = Math.max(0, s.investCool - 1);
      s.pocCool = Math.max(0, s.pocCool - 1);
      s.coldMarket = Math.max(0, s.coldMarket - 1);
      s.rep = clamp(s.rep, 0, 100);
      s.t += 1;
      s.effect = uniEffect(s);
    },
    events: [
      { id: 'offer', title: 'Ключевой инженер получил предложение', weight: 3,
        when: function (s) { return s.eng >= 2; },
        text: 'Корпорация зовёт ведущего разработчика на зарплату вдвое выше.',
        choices: [
          { label: 'Поднять зарплату (−400 тыс. ₽)', effect: function (s, r, log) { s.cash -= 400; s.morale += 4; log('Инженер остался за прибавку'); } },
          { label: 'Дать опцион 3% доли', effect: function (s, r, log) { dilute(s, 3); s.morale += 8; log('Инженер стал совладельцем (все доли размыты на 3%)'); } },
          { label: 'Отпустить', effect: function (s, r, log) { s.eng -= 1; s.morale -= 10; log('Ведущий инженер ушёл'); } }
        ] },
      { id: 'buyout', title: 'Предложение о покупке технологии', weight: 2,
        when: function (s) { return s.trl >= 6 && !s.exited; },
        text: function (s) { return 'Индустриальный холдинг готов купить компанию с технологией и командой за ' + fmtMoney(Math.round(valuation(s) * 0.9)) + '. ' +
          (s.uni ? 'Вузу достанется ' + s.uni + '% суммы. ' : s.rights === 'license' ? 'Доли у вуза нет: он получит только накопленные роялти. ' : 'Права на РИД не оформлены — вуз не получит ничего. ') + 'Игра на этом закончится.'; },
        choices: [
          { label: 'Поддержать продажу', effect: function (s, r, log) { s.exited = Math.round(valuation(s) * 0.9); s.effect = uniEffect(s); log('Компания продана за ' + fmtMoney(s.exited)); } },
          { label: 'Отказаться и развивать дальше', effect: function (s, r, log) { s.rep += 3; s.morale += 4; log('Предложение холдинга отклонено'); } }
        ] },
      { id: 'competitor', title: 'На рынок вышел конкурент', weight: 3,
        text: 'Конкурент с похожим продуктом и большим бюджетом на продвижение. Подтверждённый спрос снизился.',
        effect: function (s) { s.fit = clamp(s.fit - 10, 0, 100); },
        choices: [
          { label: 'Ускорить разработку', effect: function (s, r, log) { s.trlProg += 15; s.morale -= 6; log('Команда работает в авральном режиме'); } },
          { label: 'Сосредоточиться на нише', effect: function (s, r, log) { s.fit = clamp(s.fit + 8, 0, 100); s.price = Math.round(s.price * 1.1); log('Фокус на нише: выше цена, точнее продукт'); } }
        ] },
      { id: 'supply', title: 'Подорожали комплектующие', weight: 2,
        text: 'Импортные компоненты подорожали, сроки поставки выросли.',
        choices: [
          { label: 'Искать отечественного поставщика (−300 тыс. ₽)', effect: function (s, r, log) { s.cash -= 300; s.overhead += 10; log('Найден отечественный поставщик'); } },
          { label: 'Принять новые цены', effect: function (s, r, log) { s.overhead += 60; log('Постоянные расходы выросли на 60 тыс. ₽ в квартал'); } }
        ] },
      { id: 'rights_q', title: 'Инвестор спрашивает о правах на технологию', weight: 3,
        when: function (s) { return !s.rights && s.trl >= 5; },
        text: 'Технология создана в лаборатории вуза на бюджетные средства. Без оформленных прав инвестор не войдёт в компанию.',
        choices: [
          { label: 'Оформить лицензию (−300 тыс. ₽)', effect: function (s, r, log) { s.cash -= 300; setRights(s, 'license', s.t); s.rep += 3; log('Заключён лицензионный договор'); } },
          { label: 'Внести право использования в капитал (доля вуза)', effect: function (s, r, log) { s.cash -= 100; setRights(s, 'equity', s.t); s.rep += 3; log('Вуз стал участником компании: доля ' + s.uni + '%'); } },
          { label: 'Отложить', effect: function (s, r, log) { s.investCool = Math.max(s.investCool, 2); log('Вопрос прав отложен — инвестор взял паузу'); } }
        ] },
      { id: 'coi', title: 'Конфликт интересов', weight: 2,
        when: function (s) { return !s.coi && s.trl >= 5; },
        text: 'Автор технологии — заведующий лабораторией и одновременно совладелец компании. Сотрудники лаборатории работают на компанию в рабочее время, бухгалтерия вуза задаёт вопросы.',
        choices: [
          { label: 'Оформить договор с компанией на использование оборудования и регламент (−100 тыс. ₽)', effect: function (s, r, log) { s.cash -= 100; s.coi = true; s.rep += 3; log('Отношения вуза и компании оформлены договором'); } },
          { label: 'Не формализовать, «все свои»', effect: function (s, r, log) { s.coi = true; if (r() < 0.5) { s.rep -= 8; s.morale -= 8; log('Проверка выявила нарушения: репутация и мотивация упали'); } else log('Пока обошлось, риск остался'); } }
        ] },
      { id: 'ceo_conflict', title: 'Разногласия автора и CEO', weight: 2,
        when: function (s) { return s.ceo; },
        text: 'CEO хочет упростить продукт под массового заказчика, автор технологии против: «это убьёт научную новизну».',
        choices: [
          { label: 'Провести стратегическую сессию с участием обоих', effect: function (s, r, log) { s.cash -= 50; s.morale += 6; s.fit = clamp(s.fit + 4, 0, 100); log('Договорились о дорожной карте продукта'); } },
          { label: 'Поддержать CEO: рынок важнее', effect: function (s, r, log) { s.fit = clamp(s.fit + 8, 0, 100); s.morale -= 8; log('Продукт упрощён, автор отдалился от проекта'); } },
          { label: 'Поддержать автора', effect: function (s, r, log) { s.trlProg += 10; s.fit = clamp(s.fit - 5, 0, 100); log('Курс на технологическое превосходство'); } }
        ] },
      { id: 'press', title: 'Публикация в отраслевом издании', weight: 2,
        text: 'О технологии написали — пошли входящие запросы.',
        effect: function (s, r, log) { s.rep += 6; if (s.trl >= 6) s.pilots += 1; log('Публикация: репутация +6' + (s.trl >= 6 ? ', +1 пилот' : '')); } },
      { id: 'bigclient', title: 'Крупный заказчик хочет пилот', weight: 2,
        when: function (s) { return s.trl >= 6; },
        text: 'Госкорпорация готова на пилот, но требует доработку под себя.',
        choices: [
          { label: 'Взять (+2 пилота, доработка, +300 тыс. ₽)', effect: function (s, r, log) { s.pilots += 2; s.trlProg = Math.max(0, s.trlProg - 20); s.cash += 300; s.external += 300; log('Пилот с госкорпорацией'); } },
          { label: 'Отказаться', effect: function (s, r, log) { log('Отказ: сохранили фокус на продукте'); } }
        ] },
      { id: 'cold', title: 'Инвесторы стали осторожнее', weight: 1,
        text: 'На рынке венчурных инвестиций спад: шанс закрыть раунд ниже следующие 2 квартала.',
        effect: function (s, r, log) { s.coldMarket = 2; log('Инвестиции привлекать сложнее'); } },
      { id: 'report', title: 'Отчёт по гранту proof-of-concept', weight: 2,
        when: function (s) { return s.uniInvest > 0; },
        text: 'Учёный совет просит отчитаться, на что потрачен внутренний грант и какой результат получен.',
        choices: [
          { label: 'Подготовить подробный отчёт с вехами и планом', effect: function (s, r, log) { s.morale -= 3; s.rep += 3; log('Отчёт принят, программа PoC сохранила доверие'); } },
          { label: 'Отделаться формальной справкой', effect: function (s, r, log) { s.pocCool += 2; log('Совет недоволен: следующий транш PoC отложен на 2 квартала'); } }
        ] }
    ],
    over: function (s) {
      if (s.exited) return { outcome: s.uni || s.royalties ? 'win' : 'draw', text: 'Компания продана за ' + fmtMoney(s.exited) + '. ' + (s.uni ? 'Вуз получил ' + fmtMoney(Math.round(s.exited * s.uni / 100)) + ' за свою долю.' : s.rights === 'license' ? 'У вуза не было доли — только роялти.' : 'Права на РИД не были оформлены — вуз не получил ничего.') };
      if (s.cash < 0) return { outcome: 'lose', text: 'Кассовый разрыв: компании нечем платить зарплаты, проект остановлен. Вложения вуза потеряны.' };
      if (s.revenue >= 2000) return { outcome: 'win', text: 'Выручка ' + fmtMoney(s.revenue) + ' за квартал — спин-офф вышел на рынок.' };
      return null;
    },
    finish: function (s) {
      s.effect = uniEffect(s);
      var value = s.cash < 0 ? 0 : (s.exited || valuation(s));
      var results = [];
      if (s.trl >= 9) results.push('Технология доведена до УГТ 9');
      if (s.revenue >= 2000) results.push('Выручка 2+ млн ₽ за квартал');
      if (s.customers >= 5) results.push('5+ клиентов');
      if (s.rights && (s.investTried === null || s.rightsAt <= s.investTried)) results.push('Права на РИД оформлены до переговоров с инвесторами');
      if (s.external > s.uniInvest && s.cash >= 0) results.push('Внешних средств привлечено больше, чем вложил вуз');
      if (s.coi && s.rep > 20 && s.cash >= 0) results.push('Отношения вуза и компании оформлены');
      var score = Math.round((s.effect / 1000 + results.length * 2) * 10) / 10;
      return {
        score: score,
        badges: results,
        outcome: s.cash < 0 ? 'lose' : s.revenue >= 2000 || s.exited ? 'win' : 'draw',
        text: s.cash < 0 ? 'Проект остановлен из-за кассового разрыва.' : 'Три года прошли: компания работает, но на устойчивую выручку пока не вышла.',
        metrics: {
          'Эффект для вуза, млн ₽': Math.round(s.effect / 100) / 10,
          'Доля вуза, %': s.uni,
          'Лицензионные платежи вузу, тыс. ₽': s.royalties,
          'Вложения вуза (proof-of-concept), тыс. ₽': s.uniInvest,
          'Привлечено внешних средств, тыс. ₽': s.external,
          'Стоимость компании, тыс. ₽': value,
          'УГТ': s.trl, 'Клиенты': s.customers, 'Выручка за квартал, тыс. ₽': s.revenue
        }
      };
    },
    debrief: function (s) {
      var L = [];
      if (!s.rights) L.push({ level: 'bad', title: 'Права на РИД так и не оформлены', text: 'Без договора с вузом инвесторы и крупные заказчики видят юридический риск, а вуз не получает ничего от успеха компании. На практике права оформляют до первых переговоров с инвесторами: лицензионный договор или внесение права использования РИД в капитал хозяйственного общества (такую возможность вузам даёт закон о науке, 127-ФЗ).' });
      else if (s.investTried !== null && s.rightsAt > s.investTried) L.push({ level: 'warn', title: 'Права оформлены после первых переговоров с инвесторами', text: 'Первые переговоры шли с пониженными шансами. Порядок «сначала права, потом инвесторы» стоит закрепить в регламенте вуза.' });
      else L.push({ level: 'ok', title: s.rights === 'license' ? 'Выбрана лицензия: вуз получает роялти' : 'Выбрана доля вуза в компании', text: s.rights === 'license' ? 'Лицензия даёт понятный регулярный доход и не требует от вуза участия в управлении, но вуз не выигрывает от роста стоимости компании и продажи стратегу. Накоплено роялти: ' + fmtMoney(s.royalties) + '.' : 'Доля даёт вузу выигрыш от роста стоимости и продажи компании, но требует корпоративного управления (участие в собраниях, размытие в раундах) и окупается только при успехе. Доля вуза в конце: ' + s.uni + '%.' });
      if (used(s, 'custdev') + used(s, 'pilot') < 3) L.push({ level: 'warn', title: 'Мало проверки спроса', text: 'Спрос подтверждали меньше трёх раз (интервью, пилоты). Технологию легко довести до высокого УГТ и не найти покупателя. Хорошая практика — требовать подтверждение спроса как условие следующего транша proof-of-concept.' });
      else L.push({ level: 'ok', title: 'Спрос проверяли регулярно', text: 'Проверок спроса и пилотов: ' + (used(s, 'custdev') + used(s, 'pilot')) + '. Это повышает шансы на инвестиции и переход пилотов в контракты.' });
      L.push(s.ceo ? { level: 'ok', title: 'Во главе компании — предприниматель', text: 'Разделение ролей «автор — научный руководитель, предприниматель — CEO» повышает продажи и доверие инвесторов. Цена — опцион и возможные разногласия, которые вуз может помогать разрешать.' }
        : { level: 'warn', title: 'Компанией руководит автор технологии', text: 'Учёный в роли CEO — частая причина остановки спин-оффов: продажи и привлечение денег требуют других компетенций. Вуз может помочь найти предпринимателя: выпускники, акселератор, индустриальные партнёры.' });
      if (s.cash < 0) L.push({ level: 'bad', title: 'Кассовый разрыв', text: 'Деньги закончились. Запас денег меньше чем на 2 квартала был ' + s.lowCash + ' раз(а). Следите за ним как за ключевым показателем и подавайте на гранты и раунды заранее: решения фондов и инвесторов приходят через 2 квартала и позже.' });
      else if (s.lowCash >= 2) L.push({ level: 'warn', title: 'Компания часто жила «на грани»', text: 'Запас денег меньше чем на 2 квартала был ' + s.lowCash + ' раз(а). Это бьёт по мотивации и вынуждает брать невыгодные деньги.' });
      if (used(s, 'contract') >= 3) L.push({ level: 'warn', title: 'Заказные НИОКР стали основным источником денег', text: 'Заказы выручают в моменте, но тормозят продукт (' + used(s, 'contract') + ' раз). Для лаборатории это нормально, для стартапа — сигнал, что продукт не продаётся.' });
      if (!used(s, 'grant')) L.push({ level: 'warn', title: 'Не использованы грантовые фонды', text: 'Гранты ФСИ и отраслевых фондов — недорогие деньги без размытия долей. Задача ЦТТ — помогать командам готовить заявки.' });
      L.push(s.uniInvest === 0 ? { level: 'warn', title: 'Вуз не вкладывался в proof-of-concept', text: 'Без внутреннего финансирования этапа «долины смерти» (УГТ 4–6) проект живёт за счёт заказных работ или останавливается.' }
        : s.external >= s.uniInvest ? { level: 'ok', title: 'Вложения вуза сработали как рычаг', text: 'На каждый рубль вуза привлечено ' + (Math.round(s.external / s.uniInvest * 10) / 10) + ' ₽ внешних средств (гранты, инвестиции, заказы).' }
        : { level: 'warn', title: 'Внешних денег привлечено меньше, чем вложил вуз', text: 'Привлечено ' + fmtMoney(s.external) + ' при вложениях вуза ' + fmtMoney(s.uniInvest) + '. Транши PoC стоит связывать с вехами: подтверждённый спрос, заявка в фонд, пилот.' });
      return {
        lessons: L,
        questions: [
          'Кто в вашем вузе принимает решение о создании компании на основе РИД и сколько времени это занимает?',
          'Что выгоднее вашему вузу — роялти или доля? От чего это зависит в вашей ситуации?',
          'Где вы будете искать предпринимателей на роль CEO для спин-оффов?',
          'Какие решения из игры в вашем вузе сегодня невозможны из-за регламентов или процедур?'
        ],
        transfer: [
          'Положение о создании хозяйственных обществ с участием вуза и порядке внесения прав на РИД',
          'Типовой лицензионный договор и понятный порядок расчёта роялти',
          'Внутренний фонд proof-of-concept: критерии отбора, вехи траншей, отчётность',
          'Пул предпринимателей, трекеров и экспертов для команд спин-оффов',
          'Регламент урегулирования конфликта интересов сотрудников — совладельцев компаний'
        ]
      };
    }
  };

  /* ======================================================
     2. Программа развития: инновационный портфель вуза
     ====================================================== */

  /* [ключ, показатель, целевое значение к концу 2031 года] */
  var ECO_TARGETS = [
    ['startups', 'Стартапы, созданные с участием вуза (накопленно)', 35],
    ['licenses', 'Действующие лицензионные договоры', 15],
    ['contracts', 'НИОКР по заказу индустрии за год', 300000],
    ['students', 'Студенты, обученные технологическому предпринимательству', 2000],
    ['late', 'Проекты на УГТ 7–9 в портфеле', 12]
  ];
  var ECO_START = { startups: 3, licenses: 2, contracts: 80000, students: 150, late: 3 };

  function ecoProgress(s) {
    // зачёт нелинейный: 80% цели дают 64% баллов — «почти выполнили» не равно «выполнили»
    return ECO_TARGETS.map(function (t) { return Math.pow(Math.min(1, (s[t[0]] || 0) / t[2]), 2); });
  }
  /* плановая траектория: равномерно от стартового значения к цели */
  function ecoPlan(key, target, year) { return ECO_START[key] + (target - ECO_START[key]) * year / 6; }
  function avgAlloc(s, key) {
    var h = s.allocHist || [];
    return h.length ? Math.round(h.reduce(function (a, x) { return a + (x[key] || 0); }, 0) / h.length) : 0;
  }
  function lagging(s) {
    return ECO_TARGETS.filter(function (t) { return s.year > 0 && s[t[0]] < ecoPlan(t[0], t[2], s.year) * 0.9; });
  }

  var ECOSYSTEM = {
    id: 'ecosystem',
    kind: 'turns',
    title: 'Программа развития: инновационный портфель вуза',
    role: 'Вы — проректор по инновациям: шесть лет на выполнение показателей программы развития',
    summary: 'Ежегодно распределяйте бюджет инновационной деятельности между инструментами — от внутренних грантов и proof-of-concept до ЦТТ, акселератора, партнёрств с индустрией и обучения студентов. Выбирайте одну управленческую инициативу в год, отвечайте на запросы учредителя и партнёров, сверяйтесь с план-фактом.',
    tags: ['6 лет', 'бюджет и инициативы', 'план-факт по показателям'],
    turns: 6,
    actionsPerTurn: 1,
    eventChance: 0.75,
    turnLabel: function (t) { return (2026 + t) + ' год'; },
    goals: 'Показатели к концу 2031 года: ' + ECO_TARGETS.map(function (t) { return '«' + t[1] + '» — ' + (t[0] === 'contracts' ? fmtMoney(t[2]) : fmtNum(t[2])); }).join('; ') + '. ' +
      'План на каждый год — равномерная траектория от текущих значений к цели (таблица «План-факт»). ' +
      'Итоговая оценка — индекс выполнения программы (до 100; недовыполнение снижает его сильнее, чем линейно) плюс репутация вуза / 5. ' +
      'Бюджет следующего года зависит от решений учредителя, доходов от НИОКР и лицензий. Модель условная: она показывает связи между инструментами, а не точные цифры.',
    allocations: [
      ['research', 'Внутренние гранты на поисковые исследования (УГТ 1–3)', 'Новые проекты в воронке'],
      ['poc', 'Proof-of-concept: доведение до прототипа (УГТ 4–6)', 'Переход проектов в зрелые — «долина смерти»'],
      ['ctt', 'ЦТТ: патентование, маркетинг технологий, лицензирование', 'Поддержание патентов, лицензии'],
      ['accel', 'Акселератор и стартап-студия', 'Доля технологий, выходящих через стартапы'],
      ['industry', 'Партнёрства с индустрией и инжиниринг', 'Заказные НИОКР и новые партнёры'],
      ['edu', 'Обучение технологическому предпринимательству', 'Студенты и студенческие стартапы']
    ],
    defaultAlloc: { research: 30, poc: 20, ctt: 10, accel: 15, industry: 15, edu: 10 },
    init: function () {
      return {
        budget: 200000, early: 40, mid: 12, late: 3, patents: 60, licenses: 2, startups: 3,
        partners: 5, contracts: 80000, students: 150, rep: 30, studio: false, fund: false,
        engcenter: false, diploma: false, policy: false, stagegate: false, cut: 0, exclusive: 0,
        lapsed: 0, year: 0, allocHist: []
      };
    },
    metrics: [
      { key: 'budget', title: 'Бюджет года', fmt: 'money', note: function (s) { return s.cut ? 'сокращён учредителем' : 'на инновационную деятельность'; } },
      { key: 'startups', title: 'Стартапы', fmt: 'int', alert: function (s) { return s.startups < ecoPlan('startups', 35, s.year) * 0.9; }, note: function () { return 'цель 35'; } },
      { key: 'licenses', title: 'Лицензии', fmt: 'int', alert: function (s) { return s.licenses < ecoPlan('licenses', 15, s.year) * 0.9; }, note: function (s) { return 'патентов на поддержании ' + Math.round(s.patents); } },
      { key: 'contracts', title: 'НИОКР по заказу индустрии', fmt: 'money', alert: function (s) { return s.contracts < ecoPlan('contracts', 300000, s.year) * 0.9; }, note: function (s) { return s.partners + ' партнёров · цель 300 млн'; } },
      { key: 'students', title: 'Студенты-технопредприниматели', fmt: 'int', alert: function (s) { return s.students < ecoPlan('students', 2000, s.year) * 0.9; }, note: function () { return 'цель 2000'; } },
      { key: 'late', title: 'Проекты УГТ 7–9', fmt: 'int', alert: function (s) { return s.late < ecoPlan('late', 12, s.year) * 0.9; }, note: function (s) { return 'воронка: ' + Math.round(s.early) + ' / ' + Math.round(s.mid) + ' / ' + Math.round(s.late); } },
      { key: 'rep', title: 'Репутация вуза', fmt: 'int', note: function (s) { return 'выполнение программы ' + Math.round(ecoProgress(s).reduce(function (a, b) { return a + b; }, 0) / ECO_TARGETS.length * 100) + '%'; } }
    ],
    charts: [['startups', 'Стартапы', 'int'], ['licenses', 'Лицензии', 'int'], ['contracts', 'НИОКР по заказу', 'money'], ['late', 'УГТ 7–9', 'int']],
    /* план-факт: факт сейчас, план на конец текущего года, цель; статус — к плану прошлого года */
    planFact: function (s) {
      return ECO_TARGETS.map(function (t) {
        var fact = s[t[0]];
        var planNow = ecoPlan(t[0], t[2], s.year);
        var status = s.year === 0 ? 'start' : fact >= planNow ? 'ok' : fact >= planNow * 0.9 ? 'warn' : 'bad';
        return { title: t[1], fact: fact, plan: ecoPlan(t[0], t[2], Math.min(6, s.year + 1)), target: t[2], status: status, money: t[0] === 'contracts' };
      });
    },
    actions: [
      { id: 'policy', title: 'Положение об управлении РИД и долях вуза', note: '1 млн ₽: понятные правила для авторов и стартапов — быстрее лицензии и спин-оффы', cost: 1000,
        available: function (s) { return s.policy ? 'уже принято' : true; },
        effect: function (s, r, log) { s.policy = true; s.rep += 2; log('Учёный совет утвердил положение об управлении РИД и участии вуза в стартапах'); } },
      { id: 'stagegate', title: 'Проектный офис и отбор по этапам (stage-gate)', note: '4 млн ₽: экспертиза на каждом этапе — слабые проекты закрываются раньше, сильные растут быстрее', cost: 4000,
        available: function (s) { return s.stagegate ? 'уже работает' : true; },
        effect: function (s, r, log) { s.stagegate = true; log('Создан проектный офис: решения о финансировании — по итогам экспертизы этапов'); } },
      { id: 'audit', title: 'Инвентаризация портфеля РИД и проектов', note: '5 млн ₽: отказ от поддержки 30% неиспользуемых патентов и слабых проектов', cost: 5000,
        effect: function (s, r, log) {
          var p = Math.round(s.patents * 0.3), e = Math.round(s.early * 0.2);
          s.patents -= p; s.early -= e; s.auditBoost = 2;
          log('Инвентаризация: снято с поддержки ' + p + ' патентов, закрыто ' + e + ' ранних проектов — ресурсы перенаправлены сильным');
        } },
      { id: 'diploma', title: '«Стартап как диплом»', note: '3 млн ₽: защита ВКР в формате стартапа — больше студентов и студенческих стартапов', cost: 3000,
        available: function (s) { return s.diploma ? 'уже внедрён' : true; },
        effect: function (s, r, log) { s.diploma = true; s.students = Math.round(s.students * 1.3); log('Внедрён формат «Стартап как диплом»'); } },
      { id: 'studio', title: 'Стартап-студия', note: '30 млн ₽ разово: больше технологий выходит через стартапы', cost: 30000,
        available: function (s) { return s.studio ? 'уже работает' : true; },
        effect: function (s, r, log) { s.studio = true; s.rep += 4; log('Открыта стартап-студия'); } },
      { id: 'fund', title: 'Посевной фонд с индустриальным партнёром', note: '50 млн ₽: инвестиции в стартапы вуза, рост репутации', cost: 50000,
        available: function (s) { return s.fund ? 'уже создан' : true; },
        effect: function (s, r, log) { s.fund = true; s.rep += 6; log('Создан посевной фонд с индустриальным партнёром'); } },
      { id: 'engcenter', title: 'Инжиниринговый центр', note: '40 млн ₽: +3 партнёра и рост заказных НИОКР', cost: 40000,
        available: function (s) { return s.engcenter ? 'уже работает' : true; },
        effect: function (s, r, log) { s.engcenter = true; s.partners += 3; log('Открыт инжиниринговый центр: +3 партнёра'); } },
      { id: 'roadshow', title: 'Показ технологий индустрии (роуд-шоу)', note: '2 млн ₽: встречи с заказчиками — шанс на лицензии и партнёров', cost: 2000,
        effect: function (s, r, log) {
          var l = r() < 0.6 ? 1 : 0, p = r() < 0.5 ? 1 : 0;
          s.licenses += l; s.partners += p; s.rep += 2;
          log('Роуд-шоу: +' + l + ' лицензия, +' + p + ' партнёр');
        } }
    ],
    tick: function (s, r, log) {
      var a = s.alloc || {};
      s.allocHist.push(Object.assign({}, a));
      var spend = Math.max(0, s.budget - (s.spentInitiatives || 0));
      s.spentInitiatives = 0;
      var m = {};
      Object.keys(a).forEach(function (k) { m[k] = spend * (a[k] || 0) / 100; });
      var boost = (s.auditBoost > 0 ? 1.15 : 1) * (s.stagegate ? 1.1 : 1);
      s.auditBoost = Math.max(0, (s.auditBoost || 0) - 1);
      // воронка проектов
      var newEarly = m.research / 4500 * (0.85 + r() * 0.3);
      var upEarly = s.early * (0.10 + 0.12 * sat(m.poc / 30000) + 0.04 * sat(m.research / 60000)) * boost;
      var dropEarly = s.early * (s.stagegate ? 0.18 : 0.14);
      var upMid = s.mid * (0.08 + 0.25 * sat(m.poc / 40000) + 0.07 * sat(m.industry / 30000)) * boost;
      var dropMid = s.mid * (0.2 - 0.1 * sat(m.poc / 40000));
      var exitP = 0.25 + 0.25 * sat(m.ctt / 15000) + (s.policy ? 0.05 : 0);
      var exits = s.late * exitP;
      var startupShare = clamp(0.3 + 0.35 * sat(m.accel / 30000) + (s.studio ? 0.15 : 0) + (s.fund ? 0.1 : 0) + (s.policy ? 0.07 : 0) - (s.exclusive ? 0.2 : 0), 0.05, 0.9);
      var newStartups = Math.round(exits * startupShare + r() * 0.5);
      var newLic = Math.round(exits * (1 - startupShare) + r() * 0.5);
      s.early = Math.max(0, s.early + newEarly - upEarly - dropEarly);
      s.mid = Math.max(0, s.mid + upEarly - upMid - dropMid);
      s.late = Math.max(0, s.late + upMid - exits);
      // студенческие стартапы
      s.students = Math.round(s.students + m.edu / 90 * (s.diploma ? 1.4 : 1));
      var studentStartups = Math.round(s.students * 0.0015 * (1 + sat(m.accel / 30000)) * (s.diploma ? 2 : 1) + r() * 0.5);
      s.startups += newStartups + studentStartups;
      // патенты и лицензии
      var newPat = (s.early * 0.04 + s.mid * 0.15) * (0.5 + sat(m.ctt / 10000));
      s.patents += newPat;
      var upkeep = s.patents * 30;
      if (upkeep > m.ctt * 0.6) {
        var lapse = Math.round((upkeep - m.ctt * 0.6) / 30 * 0.5);
        if (lapse > 0) { s.patents -= lapse; s.lapsed += lapse; log('ЦТТ не хватило денег на пошлины: утрачено патентов — ' + lapse); }
      }
      s.licenses = Math.max(0, s.licenses + newLic - (r() < 0.25 ? 1 : 0));
      // индустрия
      s.partners += Math.round(m.industry / 25000 * (0.5 + r()));
      s.contracts = Math.round(s.partners * 11000 * (0.6 + 0.8 * sat(m.industry / 30000)) * (s.engcenter ? 1.35 : 1) + s.exclusive);
      s.rep = clamp(s.rep + newStartups * 0.8 + newLic * 0.6 + studentStartups * 0.3 + (s.contracts > 200000 ? 2 : 0) - 1, 0, 100);
      log('Итоги года: +' + (newStartups + studentStartups) + ' стартапов (из них студенческих ' + studentStartups + '), +' + newLic + ' лицензий, НИОКР по заказу ' + fmtMoney(s.contracts));
      // бюджет следующего года
      s.budget = Math.round(200000 * (1 - s.cut) + s.contracts * 0.05 + s.licenses * 300);
      s.cut = 0;
      s.early = Math.round(s.early * 10) / 10; s.mid = Math.round(s.mid * 10) / 10; s.late = Math.round(s.late * 10) / 10;
      s.patents = Math.round(s.patents);
      s.year += 1;
      var lag = lagging(s);
      if (lag.length) log('Отстают от плана: ' + lag.map(function (t) { return '«' + t[1] + '»'; }).join('; '));
    },
    events: [
      { id: 'cut', title: 'Сокращение финансирования', weight: 2,
        text: 'Учредитель сокращает финансирование инновационной деятельности на 15% в следующем году.',
        choices: [
          { label: 'Принять сокращение', effect: function (s, r, log) { s.cut = 0.15; log('Бюджет следующего года −15%'); } },
          { label: 'Частично компенсировать из внебюджета (−10 репутации внутри вуза)', effect: function (s, r, log) { s.cut = 0.05; s.rep -= 10; log('Частично компенсировали — пришлось урезать другие подразделения'); } }
        ] },
      { id: 'monitoring', title: 'Мониторинг программы развития', weight: 3,
        when: function (s) { return s.year >= 2; },
        text: function (s) {
          var lag = lagging(s);
          return lag.length ? 'Учредитель запрашивает отчёт. Отстают от плана: ' + lag.map(function (t) { return '«' + t[1] + '»'; }).join('; ') + '.'
            : 'Учредитель запрашивает отчёт. Все показатели идут по плану или близко к нему.';
        },
        choices: [
          { label: 'Честный отчёт: причины отставания и план действий', effect: function (s, r, log) { var n = lagging(s).length; s.rep += n ? 2 : 4; log(n ? 'Учредитель принял план выхода на показатели' : 'Отчёт принят без замечаний'); } },
          { label: 'Подать отчёт «в лучшем свете»', effect: function (s, r, log) { if (lagging(s).length && r() < 0.5) { s.rep -= 8; s.cut = Math.max(s.cut, 0.1); log('Расхождения обнаружены: репутация −8, бюджет следующего года −10%'); } else log('Отчёт принят'); } }
        ] },
      { id: 'federal', title: 'Федеральный конкурс', weight: 2,
        text: 'Объявлен конкурс на создание передовой инженерной школы с индустриальным партнёром: нужно софинансирование 20 млн ₽.',
        choices: [
          { label: 'Подать заявку с софинансированием', effect: function (s, r, log) {
            s.budget -= 20000;
            if (r() < 0.35 + s.rep / 200) { s.budget += 80000; s.partners += 2; s.rep += 8; log('Победа в конкурсе: +80 млн ₽, +2 индустриальных партнёра'); }
            else log('Заявка не прошла — софинансирование потрачено на подготовку');
          } },
          { label: 'Не участвовать', effect: function (s, r, log) { log('Конкурс пропущен'); } }
        ] },
      { id: 'prof', title: 'Ведущий учёный получил предложение', weight: 2,
        when: function (s) { return s.mid >= 3; },
        text: 'Руководителя сильной лаборатории зовут в другой вуз вместе с командой.',
        choices: [
          { label: 'Удержать: развитие лаборатории (−8 млн ₽)', effect: function (s, r, log) { s.budget -= 8000; s.rep += 2; log('Учёный остался'); } },
          { label: 'Отпустить', effect: function (s, r, log) { s.mid = Math.max(0, s.mid - 3); s.rep -= 3; log('Учёный ушёл с тремя проектами'); } }
        ] },
      { id: 'corp', title: 'Госкорпорация предлагает эксклюзив', weight: 2,
        text: 'Крупный партнёр готов заказывать НИОКР на 60 млн ₽ в год, но хочет исключительные права на все результаты.',
        choices: [
          { label: 'Согласиться', effect: function (s, r, log) { s.exclusive = 60000; s.partners += 1; log('Эксклюзивный контракт: +60 млн ₽ в год, но меньше стартапов'); } },
          { label: 'Предложить неисключительные лицензии', effect: function (s, r, log) { if (r() < 0.5) { s.licenses += 2; s.partners += 1; log('Партнёр согласился на лицензии: +2'); } else log('Партнёр ушёл к другому вузу'); } }
        ] },
      { id: 'nma', title: 'Нематериальные активы без использования', weight: 2,
        when: function (s) { return s.patents > 70; },
        text: function (s) { return 'Бухгалтерия указывает: на поддержание ' + Math.round(s.patents) + ' патентов уходят деньги, а большая часть из них не используется и не лицензирована.'; },
        choices: [
          { label: 'Провести экспертизу и отказаться от части', effect: function (s, r, log) { var p = Math.round(s.patents * 0.15); s.patents -= p; s.rep += 1; log('Снято с поддержания ' + p + ' патентов'); } },
          { label: 'Сохранить всё — это показатель', effect: function (s, r, log) { log('Патенты сохранены, расходы на пошлины остались'); } }
        ] },
      { id: 'park', title: 'Регион строит технопарк', weight: 1,
        text: 'Регион предлагает разместить стартапы вуза в новом технопарке на льготных условиях.',
        effect: function (s, r, log) { s.rep += 4; s.late += 1; log('Технопарк: +1 зрелый проект от резидентов'); } },
      { id: 'dispute', title: 'Спор о правах на РИД', weight: 1,
        when: function (s) { return !s.policy; },
        text: 'Выпускники вывели технологию лаборатории в стартап без договора с вузом. Пресса задаёт вопросы. Положения о правах на РИД и участии вуза в стартапах нет.',
        choices: [
          { label: 'Договориться: лицензия в обмен на долю', effect: function (s, r, log) { s.licenses += 1; s.startups += 1; s.rep += 2; log('Мирное урегулирование: лицензия в обмен на долю'); } },
          { label: 'Судиться', effect: function (s, r, log) { s.budget -= 5000; s.rep -= 5; log('Судебный спор: −5 млн ₽ и репутации'); } }
        ] },
      { id: 'hackathon', title: 'Студенты выиграли хакатон', weight: 2,
        text: 'Команда вуза победила во всероссийском хакатоне.',
        effect: function (s, r, log) { s.students += 60; s.rep += 3; log('Хакатон: +60 студентов в технологическом предпринимательстве'); } }
    ],
    over: function () { return null; },
    finish: function (s) {
      var prog = ecoProgress(s);
      var pct = prog.reduce(function (a, b) { return a + b; }, 0) / ECO_TARGETS.length * 100;
      var results = [];
      ECO_TARGETS.forEach(function (t, i) { if (prog[i] >= 1) results.push('Выполнен показатель «' + t[1] + '»'); });
      var metrics = { 'Индекс выполнения программы, %': Math.round(pct) };
      ECO_TARGETS.forEach(function (t) { metrics[t[1] + (t[0] === 'contracts' ? ', тыс. ₽' : '')] = Math.round(s[t[0]]); });
      metrics['Утрачено патентов из-за нехватки денег'] = s.lapsed;
      metrics['Репутация вуза'] = Math.round(s.rep);
      return { score: Math.round((pct + s.rep / 5) * 10) / 10, badges: results, metrics: metrics, outcome: pct >= 80 ? 'win' : pct >= 50 ? 'draw' : 'lose',
        text: pct >= 80 ? 'Программа развития выполнена: вуз стал заметным игроком технологического рынка.' : pct >= 50 ? 'Программа выполнена частично: есть заделы, но не все показатели достигнуты.' : 'Программа не выполнена: показатели далеки от плана.' };
    },
    debrief: function (s) {
      var L = [];
      var A = {};
      ['research', 'poc', 'ctt', 'accel', 'industry', 'edu'].forEach(function (k) { A[k] = avgAlloc(s, k); });
      L.push({ level: 'info', title: 'Ваше среднее распределение бюджета', text: 'Поисковые гранты ' + A.research + '%, proof-of-concept ' + A.poc + '%, ЦТТ ' + A.ctt + '%, акселератор ' + A.accel + '%, индустрия ' + A.industry + '%, обучение ' + A.edu + '%.' });
      if (A.poc < 15 && s.late < 12) L.push({ level: 'bad', title: '«Долина смерти» недофинансирована', text: 'На proof-of-concept в среднем ' + A.poc + '% бюджета, и зрелых проектов (УГТ 7–9) к концу ' + Math.round(s.late) + ' из 12. Проекты застревают на УГТ 4–6: исследования уже закончены, а для инвесторов и заказчиков ещё рано. Это самый дефицитный этап в большинстве вузов.' });
      if (A.research > 40) L.push({ level: 'warn', title: 'Перекос в поисковые исследования', text: 'Воронка широкая (' + Math.round(s.early) + ' ранних проектов), но до рынка доходят единицы. Без финансирования следующих этапов новые проекты только увеличивают «кладбище» заделов.' });
      if (s.lapsed > 0) L.push({ level: 'warn', title: 'Патенты утрачены из-за нехватки денег у ЦТТ', text: 'Утрачено ' + s.lapsed + ' патентов: пошлины за поддержание растут с каждым годом, а портфель рос без отбора. Решение — регулярная инвентаризация и отказ от неиспользуемых РИД, а не только рост их числа.' });
      if (A.industry < 10 && s.contracts < 300000) L.push({ level: 'warn', title: 'Мало вложений в партнёрства с индустрией', text: 'Заказные НИОКР — ' + fmtMoney(s.contracts) + ' в год при цели 300 млн ₽. Доходы от индустрии растут медленно и требуют постоянной работы с партнёрами.' });
      if (A.edu < 8 && s.students < 2000) L.push({ level: 'warn', title: 'Обучение предпринимательству в тени', text: 'Студентов-технопредпринимателей ' + s.students + ' из 2000. Это самый «дешёвый» источник стартапов и будущих команд для технологий вуза.' });
      if (!s.policy) L.push({ level: 'warn', title: 'Правила игры для авторов и стартапов не приняты', text: 'Без положения об управлении РИД и участии вуза в стартапах каждая сделка согласуется вручную, а авторы выводят технологии «в обход» вуза.' });
      if (!s.stagegate && !used(s, 'audit')) L.push({ level: 'warn', title: 'Портфель не отбирался', text: 'Ни проектного офиса с отбором по этапам, ни инвентаризации: деньги распределялись равномерно, слабые проекты продолжали получать финансирование.' });
      if (s._choices && s._choices.monitoring === 1) L.push({ level: 'warn', title: 'Отчётность «в лучшем свете»', text: 'Приукрашенный отчёт экономит время сейчас, но подрывает доверие учредителя и лишает права на корректировку плана.' });
      var prog = ecoProgress(s);
      var met = ECO_TARGETS.filter(function (t, i) { return prog[i] >= 1; });
      if (met.length) L.push({ level: 'ok', title: 'Выполнены показатели: ' + met.length + ' из ' + ECO_TARGETS.length, text: met.map(function (t) { return t[1]; }).join('; ') + '.' });
      return {
        lessons: L,
        questions: [
          'Как сегодня распределяется бюджет инновационной деятельности вашего вуза между этими шестью инструментами? Совпадает ли это с вашей игрой?',
          'Какой этап воронки в вашем вузе самый узкий — и кто за него отвечает?',
          'Какие показатели программы развития вы рискуете не выполнить и что для этого нужно сделать уже в этом году?',
          'От каких РИД и проектов вуз мог бы отказаться, чтобы высвободить ресурсы для сильных?'
        ],
        transfer: [
          'План-факт по показателям программы развития по годам — с ответственными за каждый показатель',
          'Отдельная строка бюджета на proof-of-concept (УГТ 4–6) с отбором по этапам',
          'Ежегодная инвентаризация РИД: что поддерживать, что лицензировать, от чего отказаться',
          'Положение об управлении РИД и участии вуза в стартапах, утверждённое учёным советом',
          'Регулярная работа с индустриальными партнёрами: план встреч, показ технологий, сопровождение заказов'
        ]
      };
    },
    targets: ECO_TARGETS
  };

  /* ======================================================
     3. Управленческие ситуации проректора
     ====================================================== */

  var TRAITS = [
    ['risk', 'Готовность к риску', 'Осторожность'],
    ['data', 'Опора на данные', 'Опора на опыт и интуицию'],
    ['own', 'Личный контроль', 'Делегирование'],
    ['open', 'Открытость и партнёрство', 'Опора на свои силы']
  ];

  var ARCHETYPES = [
    { id: 'venture', title: 'Лидер изменений', v: { risk: 1, data: -0.3, own: 0.8, open: 0.2 },
      text: 'Быстро принимаете смелые решения и берёте ответственность на себя. Сильнее всего — при запуске нового направления, когда нужно преодолеть сопротивление.',
      strengths: ['Скорость и решительность', 'Готовность брать риск на себя', 'Умение вести команду в кризис'],
      growth: ['Проверяйте крупные ставки данными и пилотами', 'Делегируйте, чтобы решения не ждали только вас'] },
    { id: 'builder', title: 'Строитель партнёрств', v: { risk: 0.7, data: 0, own: -0.5, open: 1 },
      text: 'Видите возможности в партнёрствах: индустрия, регион, фонды, выпускники. Наращиваете масштаб через других.',
      strengths: ['Переговоры и партнёрства', 'Масштаб через внешние ресурсы', 'Готовность пробовать новое'],
      growth: ['Доводите договорённости до измеримых результатов', 'Отбирайте партнёрства: не все нужны вузу'] },
    { id: 'analyst', title: 'Портфельный стратег', v: { risk: -0.6, data: 1, own: 0.3, open: 0 },
      text: 'Решаете на основе данных, экспертизы и пилотов. Хорошо управляете портфелем и вовремя закрываете слабые проекты.',
      strengths: ['Обоснованные решения', 'Управление портфелем', 'Прозрачность для учредителя и совета'],
      growth: ['Не упускайте окно возможностей из-за долгого анализа', 'Объясняйте решения людям, а не только цифрами'] },
    { id: 'diplomat', title: 'Командный лидер', v: { risk: -0.2, data: 0.2, own: -1, open: 0.8 },
      text: 'Собираете людей вокруг общей цели, доверяете командам и создаёте среду, где появляются инициативы снизу.',
      strengths: ['Доверие и вовлечённость', 'Согласование интересов', 'Устойчивость изменений'],
      growth: ['Принимайте жёсткие решения, когда согласия нет', 'Ставьте командам измеримые цели и сроки'] },
    { id: 'operator', title: 'Надёжный администратор', v: { risk: -1, data: 0.4, own: 0.8, open: -0.5 },
      text: 'Держите процессы, сроки и бюджет под контролем. На вас можно положиться, когда важны предсказуемость и отчётность.',
      strengths: ['Дисциплина исполнения', 'Контроль рисков и бюджета', 'Аккуратная отчётность'],
      growth: ['Оставляйте место экспериментам: инновации требуют права на ошибку', 'Открывайте процессы партнёрам'] }
  ];

  var CASES = {
    id: 'profile',
    kind: 'cases',
    title: 'Управленческие ситуации проректора',
    role: 'Вы — проректор по инновациям: шесть ситуаций, типичных для этой должности',
    summary: 'Ветвящиеся кейсы: портфель РИД, стартап-студия, конфликт интересов, требования учредителя, заказчики-корпорации, регион. Правильного ответа нет, но у каждого выбора есть последствие и комментарий «что учесть». В итоге — профиль управленческого стиля по четырём шкалам: удобно сравнить профили членов команды и распределить роли.',
    tags: ['2 набора ситуаций', '6 решений', 'профиль стиля и разбор'],
    traits: TRAITS,
    archetypes: ARCHETYPES,
    discussion: [
      'В какой ситуации вам было труднее всего выбрать и почему?',
      'Какие из этих ситуаций уже случались в вашем вузе? Чем закончились?',
      'Какие решения вы как проректор можете принять сами, а какие требуют ректора, учёного совета или учредителя?',
      'Сравните профили членов команды: кто кого дополняет и каких стилей не хватает?'
    ],
    transfer: [
      'Положение об управлении РИД и участии вуза в стартапах',
      'Регламент урегулирования конфликта интересов',
      'Критерии отбора и закрытия проектов (stage-gate) и кто принимает решения',
      'Собственная система показателей, которую можно предложить учредителю вместе с обязательными',
      'Типовые условия договоров с индустрией: исключительные и неисключительные права'
    ],
    tracks: [
      {
        id: 'portfolio', title: 'Портфель, РИД и стартапы', start: 'r1',
        nodes: {
          r1: { title: 'Портфель с балластом', text: 'Инвентаризация показала: 40% патентов вуза не используются 5 лет, их поддержание стоит 6 млн ₽ в год. Авторы против отказа.',
            insight: 'Число патентов — не цель: пошлины за поддержание растут с каждым годом. Обычная практика — ежегодная экспертиза портфеля по понятным критериям (спрос, лицензиат, связь с проектами) и предложение авторам забрать права, если вуз отказывается от поддержания.',
            choices: [
              { label: 'Отказаться от поддержания сразу, деньги — в proof-of-concept', t: { risk: 1, data: 1, own: 1, open: -1 }, c: 'Экономия есть, но часть учёных обиделась.', next: 'r2' },
              { label: 'Дать авторам полгода найти лицензиата, затем решать по критериям', t: { risk: -0.5, data: 0.5, own: -1, open: 1 }, c: 'Двое авторов нашли партнёров, остальные патенты сняты с поддержания без конфликта.', next: 'r2' },
              { label: 'Оставить как есть: патенты нужны для отчётности', t: { risk: -1, data: -1, own: 0.5, open: -0.5 }, c: 'Отчёты красивые, бюджет ЦТТ тает.', next: 'r2' }
            ] },
          r2: { title: 'Стартап-студия с партнёром', text: 'Индустриальный партнёр предлагает вместе запустить стартап-студию: он даёт 50% денег, но хочет преимущественное право выкупа стартапов.',
            insight: 'Преимущественное право выкупа — нормальное условие, если зафиксированы срок, порядок оценки и что будет при отказе партнёра. Пилот на несколько проектов с заранее согласованными показателями снижает риск для обеих сторон.',
            choices: [
              { label: 'Соглашаться сейчас, детали — по ходу', t: { risk: 1, data: -1, own: 0, open: 1 }, c: 'Студия стартовала быстро, но юристы полгода спорят о порядке выкупа.', next: 'r3' },
              { label: 'Пилот на 3 стартапа с понятными показателями и условиями выкупа', t: { risk: 0, data: 1, own: 0.5, open: 0.5 }, c: 'Через год есть данные для решения о масштабе.', next: 'r3' },
              { label: 'Строить студию самим, без партнёра', t: { risk: 0.5, data: 0, own: 1, open: -1 }, c: 'Полный контроль, но денег хватает на 2 проекта в год.', next: 'r3b' }
            ] },
          r3: { title: 'Кто возглавит компанию', text: 'Профессор — автор технологии хочет быть генеральным директором стартапа. Команда и инвестор видят на этой роли выпускника с опытом продаж.',
            insight: 'Разделение ролей «автор — научный руководитель или технический директор, предприниматель — генеральный директор» часто повышает шансы спин-оффа. Важно, чтобы автор сохранил долю и влияние на технологию, иначе он уйдёт из проекта.',
            choices: [
              { label: 'Решаю сам: директор — выпускник, профессор — технический директор', t: { risk: 0.5, data: 0, own: 1, open: -0.5 }, c: 'Быстро, но профессор демотивирован.', next: 'r4' },
              { label: 'Провожу встречу всех сторон и помогаю договориться', t: { risk: -0.5, data: 0, own: -1, open: 1 }, c: 'Договорились о ролях и долях, ушло 3 недели.', next: 'r4' },
              { label: 'Запрашиваю у инвестора критерии и сравниваю кандидатов', t: { risk: 0, data: 1, own: 0, open: 0.5 }, c: 'Решение обосновано, но профессор считает процедуру формальной.', next: 'r4' }
            ] },
          r3b: { title: 'Не хватает денег на студию', text: 'Своих средств хватает только на два стартапа в год. Ректор спрашивает, где масштаб.',
            insight: 'Своими силами вуз редко масштабирует студию: обычно подключают гранты (в том числе ФСИ), региональные программы, фонды и корпоративных партнёров. Альтернатива — честно сфокусироваться и показать результат на немногих проектах.',
            choices: [
              { label: 'Искать региональные и федеральные гранты', t: { risk: 0, data: 0.5, own: 0, open: 1 }, c: 'Через полгода появился ещё один источник финансирования.', next: 'r4' },
              { label: 'Сосредоточиться на двух лучших и довести их до выручки', t: { risk: -0.5, data: 1, own: 1, open: -0.5 }, c: 'Два сильных кейса вместо десяти слабых.', next: 'r4' }
            ] },
          r4: { title: 'Неудачный пилот', text: 'Флагманский проект провалил пилот у заказчика. Пресс-служба вуза уже писала об успехе.',
            insight: 'Неудачный пилот — нормальная часть работы с технологиями. Важно, что вуз из него извлекает: разбор причин с заказчиком, решение по проекту по заранее известным критериям и честная коммуникация.',
            choices: [
              { label: 'Публично разобрать ошибки и показать план', t: { risk: 0.5, data: 0.5, own: 0, open: 1 }, c: 'Честность оценили, заказчик дал второй шанс.', next: 'r5' },
              { label: 'Тихо исправить и повторить пилот', t: { risk: -0.5, data: 0, own: 1, open: -1 }, c: 'Без огласки, но команда проекта перестала доверять руководству.', next: 'r5' },
              { label: 'Закрыть проект и перераспределить ресурсы', t: { risk: 0, data: 1, own: 0.5, open: -0.5 }, c: 'Жёстко, но ресурсы ушли сильным проектам.', next: 'r5' }
            ] },
          r5: { title: 'Требование учредителя', text: 'Учредитель ставит задачу: за год вдвое увеличить число стартапов. Проектов такого качества в вузе нет.',
            insight: 'Количественный показатель легко выполнить «на бумаге», но это обесценивает его и подрывает доверие. Рабочая стратегия — выполнить обязательное и параллельно предложить учредителю показатели качества: выручка стартапов, привлечённые инвестиции, выживаемость через 2–3 года.',
            choices: [
              { label: 'Массово запустить студенческие стартапы — показатель важнее', t: { risk: 0.5, data: -1, own: 1, open: 0 }, c: 'Показатель выполнен, половина стартапов существует только в отчёте.', next: 'r6' },
              { label: 'Показать учредителю реальную воронку и предложить дополнительные показатели качества', t: { risk: 0.5, data: 1, own: 0, open: 1 }, c: 'Рискованно, но ваш вуз стали приводить в пример честной отчётности.', next: 'r6' },
              { label: 'Поручить институтам самим найти стартапы', t: { risk: 0, data: -0.5, own: -1, open: 0.5 }, c: 'Инициатива снизу появилась, но качество очень разное.', next: 'r6' }
            ] },
          r6: { title: 'Команда офиса инноваций', text: 'Вам выделили ставки на офис инноваций из 5 человек. Кого берёте первым?',
            insight: 'Первый сотрудник определяет, что будет получаться у офиса лучше всего. Частая ошибка — набрать только администраторов отчётности: тогда показатели собираются, но сделок с индустрией и стартапов не прибавляется.',
            choices: [
              { label: 'Аналитика портфеля и данных', t: { risk: -0.5, data: 1, own: 0.5, open: 0 }, c: '' },
              { label: 'Менеджера по работе с индустрией, у которого есть связи', t: { risk: 0.5, data: 0, own: -0.5, open: 1 }, c: '' },
              { label: 'Трекера, который сам создавал стартап', t: { risk: 1, data: -0.5, own: -0.5, open: 0.5 }, c: '' },
              { label: 'Опытного администратора процессов и отчётности', t: { risk: -1, data: 0.5, own: 1, open: -0.5 }, c: '' }
            ] }
        }
      },
      {
        id: 'partners', title: 'Индустрия, регион и отчётность', start: 'p1',
        nodes: {
          p1: { title: 'Крупный заказ с исключительными правами', text: 'Госкорпорация готова заказывать у лаборатории НИОКР на 60 млн ₽ в год, но хочет исключительные права на все результаты на 5 лет.',
            insight: 'Исключительные права на все результаты лишают вуз возможности лицензировать технологию другим и создавать стартапы. Обычно предмет договора сужают: исключительные права — на результаты конкретного заказа, неисключительная лицензия — на фоновые разработки лаборатории.',
            choices: [
              { label: 'Подписать: 60 млн ₽ в год важнее', t: { risk: 0.5, data: -0.5, own: 0.5, open: 0.5 }, c: 'Доходы от НИОКР выросли, но два стартапа лаборатории пришлось закрыть.', next: 'p2' },
              { label: 'Предложить исключительные права только на результаты заказа', t: { risk: 0, data: 1, own: 0.5, open: 0.5 }, c: 'Переговоры заняли два месяца, договор подписан на 45 млн ₽.', next: 'p2' },
              { label: 'Отказаться: свобода лаборатории дороже', t: { risk: -0.5, data: 0, own: 1, open: -1 }, c: 'Партнёр ушёл к другому вузу.', next: 'p2b' }
            ] },
          p2: { title: 'Консорциум с регионом', text: 'Регион предлагает войти в консорциум для заявки на федеральный конкурс (центр компетенций с индустриальными партнёрами). Нужно софинансирование 20 млн ₽ и руководитель проекта от вуза.',
            insight: 'Консорциальные заявки выигрывают за счёт реальных партнёров и понятного вклада каждого. Ключевой риск — руководитель «по совместительству»: выигранный проект без выделенной команды проваливает отчётность.',
            choices: [
              { label: 'Входить и назначить сильного руководителя на полную ставку', t: { risk: 0.5, data: 0, own: -0.5, open: 1 }, c: 'Заявка сильная, но одна из лабораторий осталась без руководителя.', next: 'p3' },
              { label: 'Входить, но координировать лично', t: { risk: 0.5, data: 0, own: 1, open: 0.5 }, c: 'Заявка подана, ваша загрузка выросла вдвое.', next: 'p3' },
              { label: 'Сначала оценить: что вуз получит, сколько это стоит, кто будет делать', t: { risk: -0.5, data: 1, own: 0, open: 0 }, c: 'Решение обосновано, но окно для подачи почти закрылось.', next: 'p3' }
            ] },
          p2b: { title: 'Пустой портфель заказов', text: 'После отказа госкорпорации доходы от НИОКР упали, учредитель спрашивает о причинах.',
            insight: 'Отказ от невыгодной сделки защищает интересы вуза, только если есть альтернатива. Хорошая практика — диверсификация: несколько средних заказчиков вместо одного крупного.',
            choices: [
              { label: 'Запустить системную работу с малыми и средними заказчиками', t: { risk: 0, data: 0.5, own: 0, open: 1 }, c: 'Через год — 8 новых заказчиков, доход восстановлен на 60%.', next: 'p3' },
              { label: 'Вернуться к госкорпорации с компромиссным предложением', t: { risk: 0.5, data: 0, own: 0.5, open: 0.5 }, c: 'Удалось договориться на меньший объём.', next: 'p3' }
            ] },
          p3: { title: 'Отставание по показателю', text: 'Через полгода мониторинг программы развития. Доходы от НИОКР по заказу индустрии — 60% от плана года.',
            insight: 'Отставание лучше показать заранее, с анализом причин и планом. Задача проректора — не только отчитаться, но и найти, где решения в его руках: портфель заказов, сроки подписания договоров, закрытие актов до конца года.',
            choices: [
              { label: 'Собрать руководителей лабораторий и разобрать воронку договоров', t: { risk: 0, data: 1, own: 0.5, open: 0.5 }, c: 'Нашли 4 договора, застрявших в согласованиях; к концу года — 92% плана.', next: 'p4' },
              { label: 'Ввести персональные планы по доходам для лабораторий', t: { risk: 0.5, data: 0.5, own: 1, open: -0.5 }, c: 'Доход вырос, но часть учёных переключилась на мелкие заказы в ущерб науке.', next: 'p4' },
              { label: 'Заранее сообщить учредителю о риске и предложить корректировку', t: { risk: -0.5, data: 0.5, own: 0, open: 1 }, c: 'Учредитель согласился перенести часть плана на следующий год.', next: 'p4' }
            ] },
          p4: { title: 'Корпорация зовёт лабораторию', text: 'Сильная лаборатория получила предложение перейти в корпоративный исследовательский центр в полном составе.',
            insight: 'Удержать сильную команду помогают не только деньги: совместная лаборатория или базовая кафедра с партнёром, понятная доля в доходах от РИД и свобода в выборе проектов.',
            choices: [
              { label: 'Предложить корпорации совместную лабораторию на базе вуза', t: { risk: 0.5, data: 0, own: -0.5, open: 1 }, c: 'Корпорация согласилась: лаборатория осталась, появился новый заказчик.', next: 'p5' },
              { label: 'Удержать за счёт надбавок из внебюджета', t: { risk: 0, data: -0.5, own: 1, open: -0.5 }, c: 'Лаборатория осталась, другие подразделения недовольны.', next: 'p5' },
              { label: 'Отпустить и выстроить с корпорацией партнёрство', t: { risk: 0.5, data: 0.5, own: -1, open: 0.5 }, c: 'Вуз потерял лабораторию, но получил партнёра для практик студентов.', next: 'p5' }
            ] },
          p5: { title: '«Стартап как диплом»', text: 'Вы хотите разрешить студентам защищать выпускную работу в формате стартапа. Часть заведующих кафедрами против: «это не наука».',
            insight: 'Формат «Стартап как диплом» уже используется во многих вузах: требования к работе, оценке и экспертам закрепляются в локальном положении о ВКР. Сопротивление обычно снижается, когда первыми его пробуют заинтересованные кафедры и есть понятные критерии оценки.',
            choices: [
              { label: 'Принять положение для всего вуза сразу', t: { risk: 1, data: -0.5, own: 1, open: 0 }, c: 'Формат появился везде, но на половине кафедр — формально.', next: 'p6' },
              { label: 'Пилот на трёх кафедрах-добровольцах, потом расширение', t: { risk: -0.5, data: 1, own: 0, open: 0.5 }, c: 'Через год 12 защит, кафедры-скептики сами попросились в программу.', next: 'p6' },
              { label: 'Поручить проработку рабочей группе из заведующих кафедрами', t: { risk: -0.5, data: 0, own: -1, open: 1 }, c: 'Положение получилось согласованным, но вышло через полтора года.', next: 'p6' }
            ] },
          p6: { title: 'Как вы принимаете решения', text: 'Что для вас главное, когда нужно выбрать направление развития инновационной деятельности вуза?',
            insight: 'Сильные команды сочетают разные опоры: данные, опыт и мнение партнёров. Полезно знать свою — и намеренно привлекать в команду тех, у кого она другая.',
            choices: [
              { label: 'Данные: показатели, воронка, сравнение с другими вузами', t: { risk: -0.5, data: 1, own: 0.5, open: 0 }, c: '' },
              { label: 'Собственный опыт и понимание ситуации', t: { risk: 1, data: -1, own: 1, open: 0 }, c: '' },
              { label: 'Мнение команды, партнёров и экспертов', t: { risk: 0, data: 0, own: -1, open: 1 }, c: '' }
            ] }
        }
      }
    ]
  };

  /* ---------- форматирование (общие для движка) ---------- */

  function fmtNum(v) {
    return Number(v || 0).toLocaleString('ru-RU', { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 });
  }
  function fmtMoney(v) {
    var n = Number(v) || 0;
    if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн ₽';
    return Math.round(n).toLocaleString('ru-RU') + ' тыс. ₽';
  }

  window.AIOS_POLYGON_GAMES = {
    games: [STARTUP, ECOSYSTEM, CASES],
    fmtNum: fmtNum,
    fmtMoney: fmtMoney
  };
})();
