/* ============================================================
   Игровые полигоны: сценарии симуляторов (polygons.html).
   Движок и интерфейс — js/polygon_games.js.

   Три вида игр (по мотивам симуляторов управления стартапом и
   деловых игр по технологическому предпринимательству):

   1. «Спин-офф из лаборатории» (kind: 'turns') — пошаговый симулятор
      технологического стартапа: 12 кварталов, 3 решения за ход,
      деньги, УГТ, команда, моральный дух, клиенты, патенты, раунды,
      случайные события с выбором. Проигрыш — кассовый разрыв.
   2. «Инновационная экосистема вуза» (kind: 'turns' + allocations) —
      проректор 6 лет распределяет бюджет между направлениями и
      запускает инициативы; цель — показатели программы развития.
   3. «Кейс-тренажёр: управленческий профиль» (kind: 'cases') —
      ветвящиеся управленческие ситуации; выборы складываются в черты
      (риск, опора на данные, личный контроль, открытость) и архетип
      с сильными сторонами и зонами роста.

   Все суммы — тыс. ₽. Все числа и события — учебные, условные.
   Как добавить игру: объект в массив GAMES по образцу ниже.
   Функции получают s — состояние игры, r() — случайное число 0..1
   (повторяемое для кода сессии), log(текст) — запись в журнал.
   ============================================================ */

(function () {
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function sat(x) { return x / (1 + x); }  // насыщение: отдача от денег убывает

  /* ======================================================
     1. Спин-офф из лаборатории
     ====================================================== */

  var SALARY_ENG = 300, SALARY_SALES = 250;

  function startupValuation(s) {
    var asset = s.trl * s.trl * 700 + s.ip * 1500 + s.fit * 50 + s.customers * 600;
    var market = s.revenue * 4 * 6;  // годовая выручка × 6
    return Math.round(Math.max(asset, market));
  }

  function burn(s) { return s.eng * SALARY_ENG + s.sales * SALARY_SALES + s.overhead; }

  var STARTUP = {
    id: 'spinoff',
    kind: 'turns',
    title: 'Спин-офф из лаборатории',
    role: 'Вы — CEO технологического стартапа, созданного на базе лаборатории вуза',
    summary: 'Доведите технологию от УГТ 4 до рынка за 3 года: НИОКР, патенты, пилоты, клиенты, гранты и инвестиции. Не допустите кассового разрыва и сохраните долю основателей.',
    tags: ['12 кварталов', '3 решения за ход', 'события с выбором'],
    turns: 12,
    actionsPerTurn: 3,
    eventChance: 0.6,
    turnLabel: function (t) { return 'Квартал ' + (t % 4 + 1) + ' · ' + (2027 + Math.floor(t / 4)) + ' год'; },
    goals: 'Победа: выручка от 2 млн ₽ за квартал или выгодная продажа технологии. Очки — стоимость доли основателей, млн ₽, плюс бонусы за достижения.',
    init: function () {
      return {
        cash: 3500, trl: 4, trlProg: 0, eng: 2, sales: 0, morale: 70, fit: 10,
        pilots: 0, customers: 0, price: 180, revenue: 0, ip: 0, ipPending: [], rep: 10,
        equity: 100, raised: 0, grants: [], grantCooldown: 0, overhead: 150,
        investCool: 0, ipRisk: false, licensed: false, exited: 0, coldMarket: 0
      };
    },
    metrics: [
      { key: 'cash', title: 'Деньги', fmt: 'money', alert: function (s) { return s.cash < burn(s) * 2; }, note: function (s) { return 'расход ' + fmtMoney(burn(s)) + '/кв.'; } },
      { key: 'trl', title: 'УГТ', fmt: 'int', note: function (s) { return 'до следующего: ' + Math.max(0, 100 - Math.round(s.trlProg)) + '%'; } },
      { key: 'revenue', title: 'Выручка за квартал', fmt: 'money', note: function (s) { return s.customers + ' клиент(ов), ' + s.pilots + ' пилот(ов)'; } },
      { key: 'fit', title: 'Соответствие рынку', fmt: 'pct', note: function () { return 'product-market fit'; } },
      { key: 'morale', title: 'Моральный дух', fmt: 'pct', alert: function (s) { return s.morale < 35; }, note: function (s) { return s.eng + ' инж., ' + s.sales + ' прод.'; } },
      { key: 'equity', title: 'Доля основателей', fmt: 'pct', note: function (s) { return 'оценка ' + fmtMoney(startupValuation(s)); } },
      { key: 'ip', title: 'Патенты', fmt: 'int', note: function (s) { return s.ipPending.length ? s.ipPending.length + ' на экспертизе' : 'репутация ' + Math.round(s.rep); } }
    ],
    charts: [['cash', 'Деньги', 'money'], ['revenue', 'Выручка', 'money'], ['trl', 'УГТ', 'int'], ['morale', 'Дух команды', 'pct']],
    actions: [
      { id: 'rnd', title: 'НИОКР-спринт', note: 'Двигает УГТ; сильнее с большой командой и высоким духом', cost: 400,
        effect: function (s, r, log) {
          var gain = (18 + 9 * s.eng) * (0.5 + s.morale / 200) * (0.85 + r() * 0.3);
          s.trlProg += gain; s.morale -= 3;
          log('НИОКР-спринт: +' + Math.round(gain) + '% к следующему УГТ');
        } },
      { id: 'custdev', title: 'Интервью с клиентами', note: '30 интервью: растёт соответствие рынку', cost: 60,
        effect: function (s, r, log) {
          var g = Math.round(12 * (1 - s.fit / 110) + r() * 3);
          s.fit = clamp(s.fit + g, 0, 100); s.rep += 1;
          log('Интервью с клиентами: соответствие рынку +' + g);
        } },
      { id: 'hire_eng', title: 'Нанять инженера', note: '+1 к скорости НИОКР; зарплата 300 тыс. ₽/кв.', cost: 100,
        available: function (s) { return s.eng >= 8 ? 'команда уже 8 инженеров' : true; },
        effect: function (s, r, log) { s.eng += 1; s.morale += 2; log('В команде новый инженер (' + s.eng + ')'); } },
      { id: 'hire_sales', title: 'Нанять продажника', note: 'Конвертирует пилоты и маркетинг в клиентов; 250 тыс. ₽/кв.', cost: 100,
        available: function (s) { return s.trl < 5 ? 'нужен УГТ 5+' : s.sales >= 5 ? 'уже 5 продажников' : true; },
        effect: function (s, r, log) { s.sales += 1; log('В команде новый менеджер по продажам (' + s.sales + ')'); } },
      { id: 'patent', title: 'Подать заявку на патент', note: 'Через 2 квартала +1 патент: растут оценка и шансы на грант', cost: 250,
        available: function (s) { return s.trl < 3 ? 'нужен УГТ 3+' : true; },
        effect: function (s, r, log) { s.ipPending.push(2); log('Подана заявка на патент'); } },
      { id: 'license', title: 'Лицензия на РИД вуза', note: 'Оформить права на технологию — без этого инвесторы осторожны', cost: 300,
        available: function (s) { return s.licensed ? 'уже оформлена' : true; },
        effect: function (s, r, log) { s.licensed = true; s.ipRisk = false; s.rep += 3; log('Заключён лицензионный договор с вузом'); } },
      { id: 'pilot', title: 'Пилот с индустриальным партнёром', note: 'Пилот может стать клиентом; растёт соответствие рынку', cost: 200,
        available: function (s) { return s.trl < 5 ? 'нужен УГТ 5+' : true; },
        effect: function (s, r, log) { s.pilots += 1; s.fit = clamp(s.fit + 6, 0, 100); s.rep += 3; log('Запущен пилот (' + s.pilots + ' в работе)'); } },
      { id: 'marketing', title: 'Маркетинг и выставки', note: 'Новые клиенты; зависит от продажников и соответствия рынку', cost: 350,
        available: function (s) { return s.trl < 7 ? 'нужен УГТ 7+' : true; },
        effect: function (s, r, log) {
          var n = Math.round((s.sales + 0.5) * s.fit / 45 * (0.6 + r() * 0.8));
          s.customers += n; s.rep += 2;
          log('Маркетинг: +' + n + ' клиент(ов)');
        } },
      { id: 'grant', title: 'Заявка на грант фонда', note: 'Бесплатно; решение через 2 квартала; шанс выше с патентами и УГТ', cost: 0,
        available: function (s) { return s.grantCooldown > 0 ? 'следующая заявка через ' + s.grantCooldown + ' кв.' : true; },
        effect: function (s, r, log) {
          var p = clamp(0.2 + s.trl * 0.04 + s.ip * 0.06 + s.rep / 250, 0.1, 0.85);
          var amount = s.trl < 6 ? 5000 : 15000;
          s.grants.push({ amount: amount, turns: 2, p: p });
          s.grantCooldown = 3;
          log('Подана заявка на грант ' + fmtMoney(amount) + ' (шанс ~' + Math.round(p * 100) + '%)');
        } },
      { id: 'invest', title: 'Раунд инвестиций', note: 'Привлечь деньги за 20% доли; шанс зависит от тракшна', cost: 50,
        available: function (s) { return s.investCool > 0 ? 'инвесторы ждут результатов: ' + s.investCool + ' кв.' : s.trl < 5 && !s.customers ? 'нужен УГТ 5+ или клиенты' : true; },
        effect: function (s, r, log) {
          var p = 0.08 + s.fit / 220 + s.customers * 0.05 + s.trl * 0.035 + s.rep / 300 + s.ip * 0.03;
          if (!s.licensed) p *= 0.6;
          if (s.coldMarket > 0) p *= 0.6;
          p = clamp(p, 0.05, 0.85);
          s.investCool = 2;
          if (r() < p) {
            var amount = Math.round(startupValuation(s) * 0.25);
            s.cash += amount; s.raised += amount; s.equity = Math.round(s.equity * 0.8 * 10) / 10; s.rep += 5; s.morale += 8;
            log('Раунд закрыт: +' + fmtMoney(amount) + ' за 20% доли (шанс был ~' + Math.round(p * 100) + '%)');
          } else {
            s.morale -= 6;
            log('Инвесторы отказали (шанс был ~' + Math.round(p * 100) + '%)' + (!s.licensed ? ': смущают права на РИД' : ''));
          }
        } },
      { id: 'contract', title: 'Заказной НИОКР для индустрии', note: 'Быстрые деньги, но команда отвлекается от продукта', cost: 0,
        effect: function (s, r, log) {
          var cash = 500 + 150 * s.eng;
          s.cash += cash; s.trlProg = Math.max(0, s.trlProg - 12); s.morale -= 4; s.fit = clamp(s.fit + 2, 0, 100);
          log('Заказной НИОКР: +' + fmtMoney(cash) + ', продукт притормозил');
        } },
      { id: 'team', title: 'Командный выезд', note: 'Восстанавливает моральный дух', cost: 80,
        effect: function (s, r, log) { s.morale += 14; log('Командный выезд: дух +14'); } },
      { id: 'cut', title: 'Сократить инженера', note: 'Экономия 300 тыс. ₽/кв., но дух падает', cost: 0,
        available: function (s) { return s.eng <= 1 ? 'останется без инженеров' : true; },
        effect: function (s, r, log) { s.eng -= 1; s.morale -= 15; log('Сокращение: инженеров ' + s.eng); } }
    ],
    tick: function (s, r, log) {
      s.morale = clamp(s.morale, 0, 100);
      while (s.trlProg >= 100 && s.trl < 9) {
        s.trlProg -= 100; s.trl += 1;
        log('🎯 Технология достигла УГТ ' + s.trl);
      }
      if (s.trl >= 9) s.trlProg = 0;
      s.ipPending = s.ipPending.map(function (x) { return x - 1; }).filter(function (x) {
        if (x <= 0) { s.ip += 1; log('Получен патент (всего ' + s.ip + ')'); return false; }
        return true;
      });
      s.grants = s.grants.filter(function (g) {
        g.turns -= 1;
        if (g.turns > 0) return true;
        if (r() < g.p) { s.cash += g.amount; s.rep += 4; log('💰 Грант одобрен: +' + fmtMoney(g.amount)); }
        else log('Грант не одобрен');
        return false;
      });
      var conv = 0;
      for (var i = s.pilots; i > 0; i--) {
        if (r() < s.fit / 220 + 0.06 + s.sales * 0.03) { s.pilots -= 1; s.customers += 1; conv++; }
      }
      if (conv) log('Пилот → клиент: +' + conv);
      if (s.trl >= 8 && s.sales) {
        var org = Math.round(s.sales * s.fit / 110 * r());
        if (org) { s.customers += org; log('Сарафанное радио: +' + org + ' клиент(ов)'); }
      }
      var churn = 0;
      for (var j = s.customers; j > 0; j--) { if (r() < (1 - s.fit / 100) * 0.18) churn++; }
      if (churn) { s.customers -= churn; log('Ушли клиенты: ' + churn); }
      s.revenue = s.customers * s.price;
      s.cash += s.revenue - burn(s);
      var runway = s.cash / Math.max(1, burn(s));
      if (runway < 2) { s.morale -= 8; log('Денег меньше чем на 2 квартала — команда нервничает'); }
      s.morale += s.morale < 60 ? 2 : -2;
      s.morale = clamp(s.morale, 0, 100);
      if (s.morale < 25 && s.eng > 1 && r() < 0.45) { s.eng -= 1; log('Из-за выгорания ушёл инженер'); }
      s.grantCooldown = Math.max(0, s.grantCooldown - 1);
      s.investCool = Math.max(0, s.investCool - 1);
      s.coldMarket = Math.max(0, s.coldMarket - 1);
      s.rep = clamp(s.rep, 0, 100);
    },
    events: [
      { id: 'offer', title: 'Ключевой инженер получил оффер', weight: 3,
        when: function (s) { return s.eng >= 2; },
        text: 'Корпорация зовёт вашего ведущего разработчика на зарплату вдвое выше.',
        choices: [
          { label: 'Поднять зарплату (−400 тыс. ₽)', effect: function (s, r, log) { s.cash -= 400; s.morale += 4; log('Инженер остался за прибавку'); } },
          { label: 'Дать опцион 3% доли', effect: function (s, r, log) { s.equity -= 3; s.morale += 8; log('Инженер стал совладельцем (−3% доли)'); } },
          { label: 'Отпустить', effect: function (s, r, log) { s.eng -= 1; s.morale -= 10; log('Ведущий инженер ушёл'); } }
        ] },
      { id: 'buyout', title: 'Предложение о покупке технологии', weight: 2,
        when: function (s) { return s.trl >= 6 && !s.exited; },
        text: function (s) { return 'Индустриальный холдинг готов купить технологию и команду за ' + fmtMoney(Math.round(startupValuation(s) * 0.9)) + '. Игра закончится.'; },
        choices: [
          { label: 'Продать (выход)', effect: function (s, r, log) { s.exited = Math.round(startupValuation(s) * 0.9); log('Технология продана за ' + fmtMoney(s.exited)); } },
          { label: 'Отказаться и расти дальше', effect: function (s, r, log) { s.rep += 3; s.morale += 4; log('Отказали холдингу'); } }
        ] },
      { id: 'competitor', title: 'На рынок вышел конкурент', weight: 3,
        text: 'Конкурент с похожим продуктом и большим бюджетом на маркетинг.',
        effect: function (s) { s.fit = clamp(s.fit - 10, 0, 100); },
        choices: [
          { label: 'Ускорить разработку', effect: function (s, r, log) { s.trlProg += 15; s.morale -= 6; log('Команда в режиме аврала'); } },
          { label: 'Уйти в нишу', effect: function (s, r, log) { s.fit = clamp(s.fit + 8, 0, 100); s.price = Math.round(s.price * 1.1); log('Фокус на нише: выше цена, точнее продукт'); } }
        ] },
      { id: 'supply', title: 'Подорожали комплектующие', weight: 2,
        text: 'Импортные компоненты подорожали, сроки поставки выросли.',
        choices: [
          { label: 'Искать отечественного поставщика (−300 тыс. ₽)', effect: function (s, r, log) { s.cash -= 300; s.overhead += 10; log('Найден отечественный поставщик'); } },
          { label: 'Принять новые цены', effect: function (s, r, log) { s.overhead += 60; log('Постоянные расходы выросли на 60 тыс. ₽/кв.'); } }
        ] },
      { id: 'accel', title: 'Приглашение в акселератор', weight: 2,
        when: function (s) { return s.rep >= 15; },
        text: 'Отраслевой акселератор предлагает программу: деньги, менторы, выход на заказчиков.',
        choices: [
          { label: 'Участвовать', effect: function (s, r, log) { s.cash += 500; s.rep += 6; s.fit = clamp(s.fit + 5, 0, 100); s.morale -= 3; log('Акселератор: +500 тыс. ₽ и контакты'); } },
          { label: 'Не отвлекаться', effect: function (s, r, log) { s.trlProg += 5; log('Фокус на продукте'); } }
        ] },
      { id: 'uni_ip', title: 'Вуз напоминает о правах на РИД', weight: 3,
        when: function (s) { return !s.licensed && s.trl >= 5; },
        text: 'Технология создана в лаборатории вуза. Без договора инвесторы видят риск.',
        choices: [
          { label: 'Оформить лицензию (−300 тыс. ₽)', effect: function (s, r, log) { s.cash -= 300; s.licensed = true; s.rep += 3; log('Лицензионный договор оформлен'); } },
          { label: 'Отдать вузу 10% доли', effect: function (s, r, log) { s.equity -= 10; s.licensed = true; s.rep += 6; log('Вуз стал совладельцем (−10% доли)'); } },
          { label: 'Отложить', effect: function (s, r, log) { s.ipRisk = true; log('Вопрос прав отложен — риск для инвестиций'); } }
        ] },
      { id: 'press', title: 'Статья в отраслевом СМИ', weight: 2,
        text: 'О вашей технологии написали — пошли входящие запросы.',
        effect: function (s, r, log) { s.rep += 6; if (s.trl >= 6) s.pilots += 1; log('Публикация: репутация +6' + (s.trl >= 6 ? ', +1 пилот' : '')); } },
      { id: 'bigclient', title: 'Крупный заказчик хочет пилот', weight: 2,
        when: function (s) { return s.trl >= 6; },
        text: 'Госкорпорация готова на пилот, но требует доработку под себя.',
        choices: [
          { label: 'Взять (+2 пилота, доработка)', effect: function (s, r, log) { s.pilots += 2; s.trlProg = Math.max(0, s.trlProg - 20); s.cash += 300; log('Пилот с госкорпорацией'); } },
          { label: 'Отказаться', effect: function (s, r, log) { log('Отказ: сохранили фокус'); } }
        ] },
      { id: 'cold', title: 'Венчурный рынок охладился', weight: 1,
        text: 'Инвесторы осторожнее: шанс раунда ниже следующие 2 квартала.',
        effect: function (s, r, log) { s.coldMarket = 2; log('Холодный рынок: инвестиции сложнее'); } },
      { id: 'audit', title: 'Плановая проверка', weight: 1,
        text: 'Налоговая проверка отвлекла бухгалтерию и юристов.',
        effect: function (s, r, log) { s.cash -= 150; log('Проверка: −150 тыс. ₽'); } }
    ],
    over: function (s) {
      if (s.exited) return { outcome: 'win', text: 'Выход: технология продана за ' + fmtMoney(s.exited) + '.' };
      if (s.cash < 0) return { outcome: 'lose', text: 'Кассовый разрыв: компании нечем платить зарплаты.' };
      if (s.revenue >= 2000) return { outcome: 'win', text: 'Выручка ' + fmtMoney(s.revenue) + ' за квартал — стартап вышел на рынок.' };
      return null;
    },
    finish: function (s, endedEarly) {
      var value = s.exited ? s.exited * s.equity / 100 : startupValuation(s) * s.equity / 100;
      if (s.cash < 0) value = 0;
      var badges = [];
      if (s.trl >= 9) badges.push('УГТ 9: технология готова');
      if (s.customers >= 5) badges.push('5+ клиентов');
      if (s.revenue >= 2000) badges.push('Выручка 2+ млн ₽/кв.');
      if (s.equity >= 50 && s.cash >= 0) badges.push('Основатели сохранили контроль');
      if (s.ip >= 3) badges.push('Патентный портфель 3+');
      if (s.raised > 0) badges.push('Привлекли инвестиции');
      var score = Math.round(value / 100) / 10 + badges.length * 5;
      return {
        score: Math.round(score * 10) / 10,
        badges: badges,
        metrics: {
          'Стоимость доли, млн ₽': Math.round(value / 100) / 10,
          'УГТ': s.trl, 'Клиенты': s.customers, 'Выручка/кв., тыс. ₽': s.revenue,
          'Доля основателей, %': s.equity, 'Деньги, тыс. ₽': s.cash
        }
      };
    }
  };

  /* ======================================================
     2. Инновационная экосистема вуза
     ====================================================== */

  var ECO_TARGETS = [
    ['startups', 'Стартапы (накопленно)', 35],
    ['licenses', 'Лицензионные договоры (действующие)', 15],
    ['contracts', 'НИОКР по заказу индустрии, тыс. ₽/год', 300000],
    ['students', 'Студенты в технопредпринимательстве', 2000],
    ['late', 'Проекты УГТ 7–9 в портфеле', 12]
  ];

  function ecoProgress(s) {
    // зачёт нелинейный: 80% цели дают 64% баллов — «почти выполнили» не равно «выполнили»
    return ECO_TARGETS.map(function (t) { return Math.pow(Math.min(1, (s[t[0]] || 0) / t[2]), 2); });
  }

  var ECOSYSTEM = {
    id: 'ecosystem',
    kind: 'turns',
    title: 'Инновационная экосистема вуза',
    role: 'Вы — проректор по инновациям: шесть лет на выполнение программы развития',
    summary: 'Каждый год распределяйте бюджет между грантами, «долиной смерти», ЦТТ, акселератором, индустриальными партнёрствами и образованием. Выбирайте одну инициативу в год и реагируйте на события.',
    tags: ['6 лет', 'бюджет и инициативы', 'целевые показатели'],
    turns: 6,
    actionsPerTurn: 1,
    eventChance: 0.75,
    turnLabel: function (t) { return (2026 + t) + ' год'; },
    goals: 'Цели к концу 2031: ' + ECO_TARGETS.map(function (t) { return t[1].toLowerCase() + ' — ' + fmtNum(t[2]); }).join('; ') + '. Очки — зачёт по целям (до 100; недовыполнение штрафуется сильнее, чем линейно) плюс репутация / 5.',
    allocations: [
      ['research', 'Внутренние гранты на поиск (УГТ 1–3)', 'Новые проекты в воронке'],
      ['poc', 'Proof-of-concept, «долина смерти» (УГТ 4–6)', 'Переход проектов в зрелые'],
      ['ctt', 'ЦТТ и патентование', 'Патенты, лицензии, выходы на рынок'],
      ['accel', 'Акселератор и стартап-студия', 'Доля выходов через стартапы'],
      ['industry', 'Индустриальные партнёрства', 'Заказные НИОКР и новые партнёры'],
      ['edu', 'Технологическое предпринимательство', 'Студенты и студенческие стартапы']
    ],
    defaultAlloc: { research: 30, poc: 20, ctt: 10, accel: 15, industry: 15, edu: 10 },
    init: function () {
      return {
        budget: 200000, early: 40, mid: 12, late: 3, patents: 60, licenses: 2, startups: 3,
        partners: 5, contracts: 80000, students: 150, rep: 30, studio: false, fund: false,
        engcenter: false, diploma: false, cut: 0, exclusive: 0, done: {}
      };
    },
    metrics: [
      { key: 'budget', title: 'Бюджет года', fmt: 'money', note: function (s) { return s.cut ? 'сокращён' : 'программа развития'; } },
      { key: 'startups', title: 'Стартапы', fmt: 'int', note: function () { return 'цель 35'; } },
      { key: 'licenses', title: 'Лицензии', fmt: 'int', note: function (s) { return 'патентов ' + Math.round(s.patents); } },
      { key: 'contracts', title: 'НИОКР по заказу', fmt: 'money', note: function (s) { return s.partners + ' партнёров · цель 300 млн'; } },
      { key: 'students', title: 'Студенты-технопредприниматели', fmt: 'int', note: function () { return 'цель 2000'; } },
      { key: 'late', title: 'Проекты УГТ 7–9', fmt: 'int', note: function (s) { return 'в воронке ' + Math.round(s.early) + ' / ' + Math.round(s.mid) + ' / ' + Math.round(s.late); } },
      { key: 'rep', title: 'Репутация вуза', fmt: 'int', note: function (s) { return 'выполнение целей ' + Math.round(ecoProgress(s).reduce(function (a, b) { return a + b; }, 0) / ECO_TARGETS.length * 100) + '%'; } }
    ],
    charts: [['startups', 'Стартапы', 'int'], ['licenses', 'Лицензии', 'int'], ['contracts', 'НИОКР по заказу', 'money'], ['late', 'УГТ 7–9', 'int']],
    actions: [
      { id: 'studio', title: 'Открыть стартап-студию', note: 'Разово 30 млн ₽: выходов через стартапы больше навсегда', cost: 30000,
        available: function (s) { return s.studio ? 'уже открыта' : true; },
        effect: function (s, r, log) { s.studio = true; s.rep += 4; log('Открыта стартап-студия'); } },
      { id: 'audit', title: 'Аудит портфеля РИД', note: '5 млн ₽: отказ от 30% бесперспективных патентов и застрявших проектов', cost: 5000,
        effect: function (s, r, log) {
          var p = Math.round(s.patents * 0.3), e = Math.round(s.early * 0.2);
          s.patents -= p; s.early -= e; s.auditBoost = 2;
          log('Аудит: снято с поддержки ' + p + ' патентов, закрыто ' + e + ' ранних проектов — ресурсы на сильные');
        } },
      { id: 'diploma', title: '«Стартап как диплом»', note: '3 млн ₽: больше студентов и студенческих стартапов', cost: 3000,
        available: function (s) { return s.diploma ? 'уже запущен' : true; },
        effect: function (s, r, log) { s.diploma = true; s.students = Math.round(s.students * 1.3); log('Запущен «Стартап как диплом»'); } },
      { id: 'fund', title: 'Посевной фонд с партнёром', note: '50 млн ₽: инвестиции стартапам, рост репутации', cost: 50000,
        available: function (s) { return s.fund ? 'уже создан' : true; },
        effect: function (s, r, log) { s.fund = true; s.rep += 6; log('Создан посевной фонд с индустриальным партнёром'); } },
      { id: 'engcenter', title: 'Инжиниринговый центр', note: '40 млн ₽: +3 партнёра и рост заказных НИОКР', cost: 40000,
        available: function (s) { return s.engcenter ? 'уже работает' : true; },
        effect: function (s, r, log) { s.engcenter = true; s.partners += 3; log('Открыт инжиниринговый центр: +3 партнёра'); } },
      { id: 'roadshow', title: 'Технологический роуд-шоу', note: '2 млн ₽: показ технологий индустрии — лицензии и партнёры', cost: 2000,
        effect: function (s, r, log) {
          var l = r() < 0.6 ? 1 : 0, p = r() < 0.5 ? 1 : 0;
          s.licenses += l; s.partners += p; s.rep += 2;
          log('Роуд-шоу: +' + l + ' лицензия, +' + p + ' партнёр');
        } }
    ],
    tick: function (s, r, log) {
      var a = s.alloc || {};
      var spend = Math.max(0, s.budget - (s.spentInitiatives || 0));
      s.spentInitiatives = 0;
      var m = {};
      Object.keys(a).forEach(function (k) { m[k] = spend * (a[k] || 0) / 100; });
      var audit = s.auditBoost > 0 ? 1.15 : 1;
      s.auditBoost = Math.max(0, (s.auditBoost || 0) - 1);
      // воронка проектов
      var newEarly = m.research / 4500 * (0.85 + r() * 0.3);
      var upEarly = s.early * (0.10 + 0.12 * sat(m.poc / 30000) + 0.04 * sat(m.research / 60000)) * audit;
      var dropEarly = s.early * 0.14;
      var upMid = s.mid * (0.08 + 0.25 * sat(m.poc / 40000) + 0.07 * sat(m.industry / 30000)) * audit;
      var dropMid = s.mid * (0.2 - 0.1 * sat(m.poc / 40000));
      var exitP = 0.25 + 0.25 * sat(m.ctt / 15000);
      var exits = s.late * exitP;
      var startupShare = clamp(0.3 + 0.35 * sat(m.accel / 30000) + (s.studio ? 0.15 : 0) + (s.fund ? 0.1 : 0) - (s.exclusive ? 0.2 : 0), 0.05, 0.9);
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
        if (lapse > 0) { s.patents -= lapse; log('Не хватило денег ЦТТ на поддержку: утрачено патентов — ' + lapse); }
      }
      s.licenses = Math.max(0, s.licenses + newLic - (r() < 0.25 ? 1 : 0));
      // индустрия
      s.partners += Math.round(m.industry / 25000 * (0.5 + r()));
      s.contracts = Math.round(s.partners * 11000 * (0.6 + 0.8 * sat(m.industry / 30000)) * (s.engcenter ? 1.35 : 1) + s.exclusive);
      s.rep = clamp(s.rep + newStartups * 0.8 + newLic * 0.6 + studentStartups * 0.3 + (s.contracts > 200000 ? 2 : 0) - 1, 0, 100);
      log('Итог года: +' + (newStartups + studentStartups) + ' стартапов (из них студенческих ' + studentStartups + '), +' + newLic + ' лицензий, НИОКР по заказу ' + fmtMoney(s.contracts));
      // бюджет следующего года
      s.budget = Math.round(200000 * (1 - s.cut) + s.contracts * 0.05 + s.licenses * 300);
      s.cut = 0;
      s.early = Math.round(s.early * 10) / 10; s.mid = Math.round(s.mid * 10) / 10; s.late = Math.round(s.late * 10) / 10;
      s.patents = Math.round(s.patents);
    },
    events: [
      { id: 'cut', title: 'Секвестр бюджета', weight: 2,
        text: 'Учредитель сокращает финансирование программы развития на 15% в следующем году.',
        choices: [
          { label: 'Принять сокращение', effect: function (s, r, log) { s.cut = 0.15; log('Бюджет следующего года −15%'); } },
          { label: 'Компенсировать из внебюджета (−10 репутации)', effect: function (s, r, log) { s.cut = 0.05; s.rep -= 10; log('Частично компенсировали — пришлось урезать другие направления'); } }
        ] },
      { id: 'federal', title: 'Федеральный конкурс', weight: 2,
        text: 'Объявлен конкурс на создание передовой инженерной школы: нужно софинансирование 20 млн ₽.',
        choices: [
          { label: 'Подать с софинансированием', effect: function (s, r, log) {
            s.budget -= 20000;
            if (r() < 0.35 + s.rep / 200) { s.budget += 80000; s.partners += 2; s.rep += 8; log('🏆 Победа в конкурсе: +80 млн ₽, +2 партнёра'); }
            else log('Заявка не прошла — софинансирование потеряно');
          } },
          { label: 'Пропустить', effect: function (s, r, log) { log('Конкурс пропущен'); } }
        ] },
      { id: 'prof', title: 'Ведущий учёный уходит', weight: 2,
        when: function (s) { return s.mid >= 3; },
        text: 'Руководитель сильной лаборатории получил предложение из другого вуза.',
        choices: [
          { label: 'Удержать: своя лаборатория (−8 млн ₽)', effect: function (s, r, log) { s.budget -= 8000; s.rep += 2; log('Учёный остался'); } },
          { label: 'Отпустить', effect: function (s, r, log) { s.mid = Math.max(0, s.mid - 3); s.rep -= 3; log('Учёный ушёл с 3 проектами'); } }
        ] },
      { id: 'corp', title: 'Госкорпорация предлагает эксклюзив', weight: 2,
        text: 'Крупный партнёр готов заказывать НИОКР на 60 млн ₽ в год, но хочет эксклюзивные права на результаты.',
        choices: [
          { label: 'Согласиться', effect: function (s, r, log) { s.exclusive = 60000; s.partners += 1; log('Эксклюзивный контракт: +60 млн ₽/год, меньше стартапов'); } },
          { label: 'Предложить неэксклюзивную лицензию', effect: function (s, r, log) { if (r() < 0.5) { s.licenses += 2; s.partners += 1; log('Партнёр согласился на лицензии: +2'); } else log('Партнёр ушёл к конкурентам'); } }
        ] },
      { id: 'park', title: 'Регион строит технопарк', weight: 1,
        text: 'Регион предлагает разместить стартапы вуза в новом технопарке на льготных условиях.',
        effect: function (s, r, log) { s.rep += 4; s.late += 1; log('Технопарк: +1 зрелый проект от резидентов'); } },
      { id: 'scandal', title: 'Спор о правах на РИД', weight: 1,
        text: 'Выпускники вывели технологию в стартап без лицензии вуза. Пресса задаёт вопросы.',
        choices: [
          { label: 'Договориться: лицензия за долю', effect: function (s, r, log) { s.licenses += 1; s.startups += 1; s.rep += 2; log('Мирное урегулирование: лицензия за долю'); } },
          { label: 'Судиться', effect: function (s, r, log) { s.budget -= 5000; s.rep -= 5; log('Судебный спор: −5 млн ₽ и репутации'); } }
        ] },
      { id: 'hackathon', title: 'Студенты выиграли хакатон', weight: 2,
        text: 'Команда вуза победила во всероссийском хакатоне.',
        effect: function (s, r, log) { s.students += 60; s.rep += 3; log('Хакатон: +60 студентов в технопредпринимательстве'); } }
    ],
    over: function () { return null; },
    finish: function (s) {
      var prog = ecoProgress(s);
      var pct = prog.reduce(function (a, b) { return a + b; }, 0) / ECO_TARGETS.length * 100;
      var badges = [];
      ECO_TARGETS.forEach(function (t, i) { if (prog[i] >= 1) badges.push('Цель: ' + t[1]); });
      if (s.studio) badges.push('Стартап-студия');
      var metrics = { 'Выполнение целей, %': Math.round(pct) };
      ECO_TARGETS.forEach(function (t) { metrics[t[1]] = Math.round(s[t[0]]); });
      metrics['Репутация'] = Math.round(s.rep);
      return { score: Math.round((pct + s.rep / 5) * 10) / 10, badges: badges, metrics: metrics, outcome: pct >= 80 ? 'win' : pct >= 50 ? 'draw' : 'lose',
        text: pct >= 80 ? 'Программа развития выполнена: вуз — заметный игрок технологического рынка.' : pct >= 50 ? 'Программа выполнена частично: есть заделы, но не все цели достигнуты.' : 'Программа провалена: цели далеко не достигнуты.' };
    },
    targets: ECO_TARGETS
  };

  /* ======================================================
     3. Кейс-тренажёр: управленческий профиль
     ====================================================== */

  var TRAITS = [
    ['risk', 'Готовность к риску', 'Осторожность'],
    ['data', 'Опора на данные', 'Опора на интуицию'],
    ['own', 'Личный контроль', 'Делегирование'],
    ['open', 'Открытость и партнёрство', 'Закрытость и фокус']
  ];

  var ARCHETYPES = [
    { id: 'venture', title: 'Венчурный капитан', v: { risk: 1, data: -0.3, own: 0.8, open: 0.2 },
      text: 'Быстро принимаете смелые решения и берёте ответственность на себя. Лучше всего — на старте нового направления, где нужно «пробить стену».',
      strengths: ['Скорость и решительность', 'Умение брать риск на себя', 'Вдохновляет команду в кризис'],
      growth: ['Проверяйте гипотезы данными до крупных ставок', 'Делегируйте, чтобы не стать «бутылочным горлышком»'] },
    { id: 'builder', title: 'Строитель экосистемы', v: { risk: 0.7, data: 0, own: -0.5, open: 1 },
      text: 'Видите возможности в партнёрствах и сетях: индустрия, регион, фонды, выпускники. Растите масштаб через других.',
      strengths: ['Партнёрства и переговоры', 'Масштаб через сеть', 'Готовность пробовать новое'],
      growth: ['Доводите договорённости до измеримого результата', 'Следите за фокусом: не все партнёрства нужны'] },
    { id: 'analyst', title: 'Аналитик-стратег', v: { risk: -0.6, data: 1, own: 0.3, open: 0 },
      text: 'Решаете на основе данных, моделей и пилотов. Хорошо управляете портфелем и вовремя закрываете слабые проекты.',
      strengths: ['Доказательные решения', 'Управление портфелем', 'Низкая доля провалов'],
      growth: ['Не упускайте окно возможностей из-за долгого анализа', 'Чаще объясняйте решения людям, а не только цифрами'] },
    { id: 'diplomat', title: 'Дипломат-фасилитатор', v: { risk: -0.2, data: 0.2, own: -1, open: 0.8 },
      text: 'Собираете людей вокруг общей цели, доверяете командам и создаёте среду, где рождаются инициативы.',
      strengths: ['Доверие и вовлечённость команд', 'Фасилитация и согласование интересов', 'Устойчивость изменений'],
      growth: ['Принимайте жёсткие решения, когда консенсуса нет', 'Ставьте командам измеримые цели и сроки'] },
    { id: 'operator', title: 'Надёжный операционщик', v: { risk: -1, data: 0.4, own: 0.8, open: -0.5 },
      text: 'Держите процессы, сроки и бюджет под контролем. На вас можно положиться, когда важна предсказуемость.',
      strengths: ['Дисциплина исполнения', 'Контроль рисков и бюджета', 'Прозрачная отчётность'],
      growth: ['Оставляйте место экспериментам — инновации требуют права на ошибку', 'Открывайте процессы партнёрам'] }
  ];

  var CASES = {
    id: 'profile',
    kind: 'cases',
    title: 'Кейс-тренажёр: управленческий профиль',
    role: 'Вы проходите серию управленческих ситуаций в своей роли',
    summary: 'Ветвящиеся кейсы без правильных ответов: каждый выбор показывает ваш стиль. В конце — профиль по четырём шкалам и архетип с сильными сторонами и зонами роста. Удобно сравнить профили команды и обсудить распределение ролей.',
    tags: ['2 трека', '7 ситуаций', 'профиль и архетип'],
    traits: TRAITS,
    archetypes: ARCHETYPES,
    tracks: [
      {
        id: 'rector', title: 'Проректор или руководитель ЦТТ', start: 'r1',
        nodes: {
          r1: { title: 'Портфель с балластом', text: 'Аудит показал: 40% патентов вуза не использовались 5 лет, их поддержка стоит 6 млн ₽ в год. Авторы против отказа.',
            choices: [
              { label: 'Отказаться от поддержки сразу, деньги — в proof-of-concept', t: { risk: 1, data: 1, own: 1, open: -1 }, c: 'Экономия есть, но часть учёных обиделась.', next: 'r2' },
              { label: 'Дать авторам полгода найти лицензиата, потом решать', t: { risk: -0.5, data: 0.5, own: -1, open: 1 }, c: 'Двое авторов нашли партнёров — неожиданно.', next: 'r2' },
              { label: 'Оставить как есть: патенты — показатель для отчётов', t: { risk: -1, data: -1, own: 0.5, open: -0.5 }, c: 'Отчёты красивые, бюджет тает.', next: 'r2' }
            ] },
          r2: { title: 'Стартап-студия', text: 'Индустриальный партнёр предлагает вместе запустить стартап-студию: он даёт 50% денег, но хочет приоритет на выкуп стартапов.',
            choices: [
              { label: 'Соглашаться сейчас, детали — по ходу', t: { risk: 1, data: -1, own: 0, open: 1 }, c: 'Студия стартовала быстро, но юристы спорят о приоритете.', next: 'r3' },
              { label: 'Пилот на 3 стартапа с понятными метриками', t: { risk: 0, data: 1, own: 0.5, open: 0.5 }, c: 'Через год есть данные для решения о масштабе.', next: 'r3' },
              { label: 'Строить студию самим, без партнёра', t: { risk: 0.5, data: 0, own: 1, open: -1 }, c: 'Полный контроль, но денег хватает на 2 проекта.', next: 'r3b' }
            ] },
          r3: { title: 'Конфликт интересов', text: 'Профессор-автор технологии хочет быть CEO стартапа, но команда и инвестор видят CEO выпускника-предпринимателя.',
            choices: [
              { label: 'Решаю сам: CEO — выпускник, профессор — CTO', t: { risk: 0.5, data: 0, own: 1, open: -0.5 }, c: 'Быстро, но профессор демотивирован.', next: 'r4' },
              { label: 'Фасилитирую встречу всех сторон', t: { risk: -0.5, data: 0, own: -1, open: 1 }, c: 'Договорились о ролях, ушло 3 недели.', next: 'r4' },
              { label: 'Спрашиваю у инвестора критерии и сравниваю кандидатов', t: { risk: 0, data: 1, own: 0, open: 0.5 }, c: 'Решение обосновано, но формально.', next: 'r4' }
            ] },
          r3b: { title: 'Не хватает денег на студию', text: 'Своих средств хватает только на два стартапа в год. Ректор спрашивает, где масштаб.',
            choices: [
              { label: 'Искать региональные и федеральные гранты', t: { risk: 0, data: 0.5, own: 0, open: 1 }, c: 'Через полгода +1 источник денег.', next: 'r4' },
              { label: 'Сосредоточиться на двух лучших и довести до выручки', t: { risk: -0.5, data: 1, own: 1, open: -0.5 }, c: 'Два сильных кейса вместо десяти слабых.', next: 'r4' }
            ] },
          r4: { title: 'Провал пилота', text: 'Флагманский проект провалил пилот у заказчика. Медиа уже писали об успехе.',
            choices: [
              { label: 'Публично разобрать ошибки и показать план', t: { risk: 0.5, data: 0.5, own: 0, open: 1 }, c: 'Честность оценили, заказчик дал второй шанс.', next: 'r5' },
              { label: 'Тихо исправить и повторить пилот', t: { risk: -0.5, data: 0, own: 1, open: -1 }, c: 'Без огласки, но доверие команды проекта упало.', next: 'r5' },
              { label: 'Закрыть проект и перераспределить ресурсы', t: { risk: 0, data: 1, own: 0.5, open: -0.5 }, c: 'Жёстко, но ресурсы пошли на сильные проекты.', next: 'r5' }
            ] },
          r5: { title: 'KPI от министерства', text: 'Новые требования: за год вдвое больше стартапов. Качество проектов не готово.',
            choices: [
              { label: 'Студенческие стартапы массово — KPI важнее', t: { risk: 0.5, data: -1, own: 1, open: 0 }, c: 'KPI выполнен, половина стартапов — «на бумаге».', next: 'r6' },
              { label: 'Объяснить министерству реальную воронку и предложить свои метрики', t: { risk: 0.5, data: 1, own: 0, open: 1 }, c: 'Рискованно, но вы стали эталоном честной отчётности.', next: 'r6' },
              { label: 'Поручить институтам самим найти стартапы', t: { risk: 0, data: -0.5, own: -1, open: 0.5 }, c: 'Инициатива снизу, но качество разное.', next: 'r6' }
            ] },
          r6: { title: 'Своя команда', text: 'Нужно собрать офис инноваций на 5 человек. Кого берёте первым?',
            choices: [
              { label: 'Аналитика портфеля и данных', t: { risk: -0.5, data: 1, own: 0.5, open: 0 }, c: '' },
              { label: 'Бизнес-девелопера с сетью в индустрии', t: { risk: 0.5, data: 0, own: -0.5, open: 1 }, c: '' },
              { label: 'Предпринимателя-трекера, который сам строил стартап', t: { risk: 1, data: -0.5, own: -0.5, open: 0.5 }, c: '' },
              { label: 'Опытного администратора процессов и отчётности', t: { risk: -1, data: 0.5, own: 1, open: -0.5 }, c: '' }
            ] }
        }
      },
      {
        id: 'founder', title: 'Основатель технологического стартапа', start: 'f1',
        nodes: {
          f1: { title: 'Первый грант', text: 'Вы получили грант 4 млн ₽ на НИОКР. Сооснователь предлагает часть денег потратить на продажи до готовности продукта.',
            choices: [
              { label: 'Да: продаём прототип, деньги — на клиентов', t: { risk: 1, data: -0.5, own: 0, open: 1 }, c: 'Два письма о намерениях, отчёт по гранту под угрозой.', next: 'f2' },
              { label: 'Нет: всё по плану гранта, продажи потом', t: { risk: -1, data: 0, own: 1, open: -0.5 }, c: 'Отчёт идеальный, клиентов пока нет.', next: 'f2' },
              { label: '30 интервью с клиентами за свой счёт параллельно', t: { risk: 0, data: 1, own: 0, open: 0.5 }, c: 'Выяснили, что нужен другой сегмент.', next: 'f2' }
            ] },
          f2: { title: 'Сооснователь выгорел', text: 'CTO работает на износ и хочет уйти в академию. Без него разработка встанет.',
            choices: [
              { label: 'Честный разговор и перераспределение задач', t: { risk: 0, data: 0, own: -1, open: 1 }, c: 'CTO остался на новых условиях.', next: 'f3' },
              { label: 'Срочно нанять второго сильного разработчика', t: { risk: 0.5, data: 0, own: 1, open: 0 }, c: 'Деньги ушли быстрее, но риск снижен.', next: 'f3' },
              { label: 'Предложить CTO больше доли', t: { risk: 0.5, data: -0.5, own: 0, open: 0.5 }, c: 'Помогло на время.', next: 'f3' }
            ] },
          f3: { title: 'Term sheet', text: 'Инвестор даёт 30 млн ₽ за 35% и право вето на ключевые решения.',
            choices: [
              { label: 'Подписать: деньги сейчас важнее', t: { risk: 1, data: -0.5, own: -1, open: 0.5 }, c: 'Деньги есть, но каждое решение теперь согласуется.', next: 'f4' },
              { label: 'Торговаться: 25% и без вето', t: { risk: 0.5, data: 0.5, own: 1, open: 0 }, c: 'Инвестор взял паузу на месяц.', next: 'f4' },
              { label: 'Отказаться, искать гранты и выручку', t: { risk: -1, data: 0, own: 1, open: -1 }, c: 'Контроль сохранён, рост медленнее.', next: 'f4b' }
            ] },
          f4: { title: 'Крупный заказчик', text: 'Госкорпорация хочет продукт, но с доработкой на полгода только под себя.',
            choices: [
              { label: 'Брать — это наш главный кейс', t: { risk: 0.5, data: -0.5, own: 0.5, open: 0.5 }, c: 'Есть большой кейс, но продукт ушёл в «заказуху».', next: 'f5' },
              { label: 'Предложить стандартный продукт + платные доработки', t: { risk: 0, data: 1, own: 0.5, open: 0 }, c: 'Договорились частично, продукт сохранил фокус.', next: 'f5' },
              { label: 'Отказаться, фокус на малом бизнесе', t: { risk: 1, data: 0.5, own: 1, open: -1 }, c: 'Рискованная ставка на масштаб.', next: 'f5' }
            ] },
          f4b: { title: 'Медленный рост', text: 'Без инвестиций вы растёте на 5% в квартал. Конкурент привлёк раунд.',
            choices: [
              { label: 'Искать стратегического партнёра вместо венчура', t: { risk: 0, data: 0, own: -0.5, open: 1 }, c: 'Партнёр дал канал продаж.', next: 'f5' },
              { label: 'Держать курс и считать юнит-экономику', t: { risk: -1, data: 1, own: 1, open: -0.5 }, c: 'Прибыльно, но медленно.', next: 'f5' }
            ] },
          f5: { title: 'Пивот', text: 'Метрики показывают: основной продукт не растёт, а побочная функция востребована.',
            choices: [
              { label: 'Пивот сразу на побочную функцию', t: { risk: 1, data: 1, own: 0.5, open: 0 }, c: 'Выручка выросла за два квартала.', next: 'f6' },
              { label: 'Обсудить с командой и клиентами, потом решать', t: { risk: -0.5, data: 0.5, own: -1, open: 1 }, c: 'Команда поддержала, ушёл месяц.', next: 'f6' },
              { label: 'Не менять стратегию — нужно время', t: { risk: -0.5, data: -1, own: 1, open: -0.5 }, c: 'Время идёт, деньги тоже.', next: 'f6' }
            ] },
          f6: { title: 'Как вы принимаете решения', text: 'Что для вас главное при выборе направления развития компании?',
            choices: [
              { label: 'Цифры: метрики, когорты, юнит-экономика', t: { risk: -0.5, data: 1, own: 0.5, open: 0 }, c: '' },
              { label: 'Видение и интуиция основателя', t: { risk: 1, data: -1, own: 1, open: 0 }, c: '' },
              { label: 'Совет команды, менторов и клиентов', t: { risk: 0, data: 0, own: -1, open: 1 }, c: '' }
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
