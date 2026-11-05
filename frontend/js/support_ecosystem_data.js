/* Справочник мер поддержки университетского техпреда в России (витрина showcase.html).
   Редактируйте здесь: stages — этапы пути, categories — типы мер, measures — меры. */
window.AIOS_SUPPORT_ECOSYSTEM = {
  "version": 2,
  "stages": [
    {
      "id": "idea",
      "name": "Идея и команда",
      "hint": "Вовлечение, обучение, первые команды"
    },
    {
      "id": "rnd",
      "name": "Исследования и РИД",
      "hint": "НИОКР, охрана результатов, технология"
    },
    {
      "id": "project",
      "name": "Стартап-проект",
      "hint": "Проверка гипотез, MVP, первые клиенты"
    },
    {
      "id": "company",
      "name": "Компания",
      "hint": "ООО или хозобщество вуза, первые продажи"
    },
    {
      "id": "mtk",
      "name": "МТК",
      "hint": "Статус малой технологической компании, рост выручки"
    },
    {
      "id": "scale",
      "name": "Масштабирование",
      "hint": "Крупные раунды, экспорт, выход на биржу"
    }
  ],
  "categories": [
    {
      "id": "grant",
      "name": "Гранты",
      "color": "#1F5AA6"
    },
    {
      "id": "accel",
      "name": "Акселерация и обучение",
      "color": "#2E9D5B"
    },
    {
      "id": "create",
      "name": "Создание компаний",
      "color": "#7A3FB0"
    },
    {
      "id": "invest",
      "name": "Инвестиции",
      "color": "#B26A00"
    },
    {
      "id": "status",
      "name": "Статусы, льготы, кредиты",
      "color": "#C0392B"
    },
    {
      "id": "infra",
      "name": "Инфраструктура",
      "color": "#117A8B"
    },
    {
      "id": "ip",
      "name": "Интеллектуальная собственность",
      "color": "#5D6D7E"
    },
    {
      "id": "program",
      "name": "Программы развития вузов",
      "color": "#1B2A41"
    }
  ],
  "levels": [
    {
      "id": "federal",
      "name": "Федеральный"
    },
    {
      "id": "regional",
      "name": "Региональный"
    },
    {
      "id": "corporate",
      "name": "Корпоративный и частный"
    },
    {
      "id": "university",
      "name": "Вузовский"
    }
  ],
  "measures": [
    {
      "id": "rnf",
      "name": "Гранты РНФ",
      "operator": "Российский научный фонд",
      "category": "grant",
      "level": "federal",
      "stage_from": "rnd",
      "stage_to": "rnd",
      "audience": "Исследователи, научные коллективы",
      "amount": "",
      "description": "Фундаментальные и поисковые исследования — источник будущих РИД и технологий вуза.",
      "url": "https://rscf.ru/"
    },
    {
      "id": "umnik",
      "name": "«УМНИК»",
      "operator": "Фонд содействия инновациям",
      "category": "grant",
      "level": "federal",
      "stage_from": "rnd",
      "stage_to": "project",
      "audience": "Молодые исследователи и студенты",
      "amount": "по условиям конкурса",
      "description": "Грант физлицу на НИОКР по собственной научно-технической идее с перспективой коммерциализации.",
      "url": "https://umnik.fasie.ru/"
    },
    {
      "id": "student_startup",
      "name": "«Студенческий стартап»",
      "operator": "Фонд содействия инновациям (Платформа УТП)",
      "category": "grant",
      "level": "federal",
      "stage_from": "idea",
      "stage_to": "project",
      "audience": "Студенты",
      "amount": "1 млн ₽",
      "description": "Грант студенту на создание и развитие стартапа; в 2025 году — около 2 500 грантов.",
      "url": "https://fasie.ru/"
    },
    {
      "id": "start",
      "name": "«Старт»",
      "operator": "Фонд содействия инновациям",
      "category": "grant",
      "level": "federal",
      "stage_from": "project",
      "stage_to": "company",
      "audience": "Малые инновационные компании (ООО)",
      "amount": "ступени до нескольких млн ₽",
      "description": "Поэтапная поддержка молодой компании: НИОКР, прототип, выход на рынок; есть тематические очереди, в т.ч. «Старт-ИИ».",
      "url": "https://fasie.ru/"
    },
    {
      "id": "razvitie",
      "name": "«Развитие»",
      "operator": "Фонд содействия инновациям",
      "category": "grant",
      "level": "federal",
      "stage_from": "company",
      "stage_to": "mtk",
      "audience": "Компании с завершённым прототипом",
      "amount": "до 30 млн ₽",
      "description": "НИОКР для развития продукта действующего малого инновационного предприятия, с софинансированием.",
      "url": "https://fasie.ru/"
    },
    {
      "id": "commercializacia",
      "name": "«Коммерциализация»",
      "operator": "Фонд содействия инновациям",
      "category": "grant",
      "level": "federal",
      "stage_from": "mtk",
      "stage_to": "mtk",
      "audience": "Компании, завершившие НИОКР",
      "amount": "до 30 млн ₽",
      "description": "Расширение производства и выход продукта на рынок, с софинансированием.",
      "url": "https://fasie.ru/"
    },
    {
      "id": "kooperacia",
      "name": "«Кооперация»",
      "operator": "Фонд содействия инновациям",
      "category": "grant",
      "level": "federal",
      "stage_from": "company",
      "stage_to": "mtk",
      "audience": "Малые компании + промышленные предприятия",
      "amount": "по условиям конкурса",
      "description": "НИОКР малой компании по заказу индустриального партнёра.",
      "url": "https://fasie.ru/"
    },
    {
      "id": "international",
      "name": "«Интернационализация»",
      "operator": "Фонд содействия инновациям",
      "category": "grant",
      "level": "federal",
      "stage_from": "mtk",
      "stage_to": "scale",
      "audience": "Компании с экспортным продуктом",
      "amount": "до 30 млн ₽",
      "description": "Совместные НИОКР с зарубежными партнёрами и экспортно ориентированная продукция.",
      "url": "https://fasie.ru/"
    },
    {
      "id": "rfrit",
      "name": "Гранты РФРИТ",
      "operator": "Российский фонд развития информационных технологий (Минцифры)",
      "category": "grant",
      "level": "federal",
      "stage_from": "company",
      "stage_to": "scale",
      "audience": "ИТ-компании",
      "amount": "от десятков млн ₽",
      "description": "Гранты на разработку и внедрение отечественных ИТ-решений.",
      "url": "https://rfrit.ru/"
    },
    {
      "id": "sk_grants",
      "name": "Гранты Фонда «Сколково»",
      "operator": "Фонд «Сколково»",
      "category": "grant",
      "level": "federal",
      "stage_from": "company",
      "stage_to": "mtk",
      "audience": "Участники «Сколково»",
      "amount": "по условиям",
      "description": "Гранты на НИОКР и вывод продукта на рынок для участников проекта.",
      "url": "https://sk.ru/"
    },
    {
      "id": "rosmol",
      "name": "Росмолодёжь.Гранты",
      "operator": "Росмолодёжь",
      "category": "grant",
      "level": "federal",
      "stage_from": "idea",
      "stage_to": "project",
      "audience": "Молодёжь 14–35 лет",
      "amount": "по условиям",
      "description": "Конкурсы молодёжных проектов, включая научно-технические и предпринимательские.",
      "url": "https://grants.myrosmol.ru/"
    },
    {
      "id": "internal_grants",
      "name": "Внутренние гранты вуза",
      "operator": "Вуз (в т.ч. средства «Приоритет-2030»)",
      "category": "grant",
      "level": "university",
      "stage_from": "idea",
      "stage_to": "project",
      "audience": "Студенты, сотрудники, команды",
      "amount": "",
      "description": "Быстрые деньги на доведение технологии, прототип или проверку спроса.",
      "url": ""
    },
    {
      "id": "regional_grants",
      "name": "Региональные гранты и субсидии на инновации",
      "operator": "Органы власти и фонды региона",
      "category": "grant",
      "level": "regional",
      "stage_from": "project",
      "stage_to": "mtk",
      "audience": "Команды и компании региона",
      "amount": "",
      "description": "Региональные конкурсы, субсидии на НИОКР и сертификацию, часто — софинансирование федеральных грантов.",
      "url": ""
    },
    {
      "id": "univ_accel",
      "name": "Университетские акселераторы",
      "operator": "Вузы (Платформа УТП)",
      "category": "accel",
      "level": "federal",
      "stage_from": "idea",
      "stage_to": "project",
      "audience": "Студенты и проектные команды",
      "amount": "",
      "description": "Акселерационные программы вузов — около 150 в год по всей стране; итог — проработанный проект и команда.",
      "url": "https://univertechpred.ru/"
    },
    {
      "id": "startup_diploma",
      "name": "«Стартап как диплом»",
      "operator": "Вуз (Минобрнауки)",
      "category": "accel",
      "level": "university",
      "stage_from": "idea",
      "stage_to": "project",
      "audience": "Студенты выпускных курсов",
      "amount": "",
      "description": "Защита стартапа в качестве выпускной квалификационной работы.",
      "url": "https://univertechpred.ru/"
    },
    {
      "id": "tochki",
      "name": "Предпринимательские «Точки кипения»",
      "operator": "Платформа НТИ / АСИ, вузы",
      "category": "accel",
      "level": "federal",
      "stage_from": "idea",
      "stage_to": "idea",
      "audience": "Студенты, сотрудники, партнёры",
      "amount": "",
      "description": "Площадки для мероприятий, встреч с экспертами и сборки команд.",
      "url": ""
    },
    {
      "id": "trainings",
      "name": "Тренинги для команд и сотрудников вузов",
      "operator": "Платформа УТП",
      "category": "accel",
      "level": "federal",
      "stage_from": "idea",
      "stage_to": "project",
      "audience": "Команды, трекеры, сотрудники вузов",
      "amount": "",
      "description": "Обучение технологическому предпринимательству, подготовка трекеров и наставников.",
      "url": "https://univertechpred.ru/"
    },
    {
      "id": "archipelago",
      "name": "«Архипелаг» и проектные интенсивы",
      "operator": "Платформа НТИ, Университет 20.35",
      "category": "accel",
      "level": "federal",
      "stage_from": "idea",
      "stage_to": "project",
      "audience": "Команды и вузы",
      "amount": "",
      "description": "Интенсивы по сборке команд и проектов под технологические задачи.",
      "url": ""
    },
    {
      "id": "frii",
      "name": "Акселератор и инвестиции ФРИИ",
      "operator": "Фонд развития интернет-инициатив",
      "category": "accel",
      "level": "federal",
      "stage_from": "project",
      "stage_to": "company",
      "audience": "ИТ-стартапы",
      "amount": "до 35 млн ₽",
      "description": "Акселерационная программа с последующими инвестициями для прошедших отбор (по открытым данным — до 35 млн ₽).",
      "url": "https://www.iidf.ru/"
    },
    {
      "id": "corp_accel",
      "name": "Корпоративные акселераторы и программы открытых инноваций",
      "operator": "Крупные компании и госкорпорации",
      "category": "accel",
      "level": "corporate",
      "stage_from": "project",
      "stage_to": "mtk",
      "audience": "Стартапы с B2B-продуктом",
      "amount": "",
      "description": "Пилоты у крупных заказчиков, первые контракты, иногда — корпоративные инвестиции.",
      "url": ""
    },
    {
      "id": "uss",
      "name": "Университетские стартап-студии",
      "operator": "ФП «Технологии» (отбор — ФИОП)",
      "category": "create",
      "level": "federal",
      "stage_from": "project",
      "stage_to": "company",
      "audience": "Технологии и команды вузов",
      "amount": "",
      "description": "Серийное создание стартапов на технологиях вузов с участием профессиональных предпринимателей; 21 студия в 2025 году, цель — 50 к 2030 году.",
      "url": "https://univertechpred.ru/"
    },
    {
      "id": "incubators",
      "name": "Бизнес-инкубаторы",
      "operator": "Вузы, регионы",
      "category": "create",
      "level": "regional",
      "stage_from": "project",
      "stage_to": "company",
      "audience": "Ранние команды",
      "amount": "",
      "description": "Рабочие места, сервисы, консультации и сопровождение регистрации компании.",
      "url": ""
    },
    {
      "id": "spinoff",
      "name": "Хозобщество вуза (ст. 103 273-ФЗ)",
      "operator": "Вуз",
      "category": "create",
      "level": "university",
      "stage_from": "company",
      "stage_to": "company",
      "audience": "Авторы РИД и команды",
      "amount": "",
      "description": "Создание компании с участием вуза: вклад — право использования РИД, доля вуза, корпоративный договор.",
      "url": "https://www.consultant.ru/document/cons_doc_LAW_140174/"
    },
    {
      "id": "uvf",
      "name": "Университетские венчурные фонды",
      "operator": "Платформа УТП, управляющие компании фондов",
      "category": "invest",
      "level": "federal",
      "stage_from": "company",
      "stage_to": "mtk",
      "audience": "Университетские стартапы высокой готовности",
      "amount": "",
      "description": "Займы с конвертацией в долю; совокупный объём фондов — 3,5 млрд ₽ (2024).",
      "url": "https://univertechpred.ru/"
    },
    {
      "id": "ndfl_refund",
      "name": "Возмещение частных инвестиций в университетские стартапы",
      "operator": "Фонд «Сколково» (Платформа УТП)",
      "category": "invest",
      "level": "federal",
      "stage_from": "company",
      "stage_to": "mtk",
      "audience": "Частные инвесторы стартапов",
      "amount": "до 20 млн ₽",
      "description": "Инвестору возмещается часть вложений в университетский стартап в пределах уплаченного НДФЛ (до 50 % инвестиций, до 20 млн ₽ на стартап).",
      "url": "https://sk.ru/"
    },
    {
      "id": "angels",
      "name": "Бизнес-ангелы и клубы инвесторов",
      "operator": "Частные инвесторы, ассоциации бизнес-ангелов",
      "category": "invest",
      "level": "corporate",
      "stage_from": "project",
      "stage_to": "company",
      "audience": "Ранние стартапы",
      "amount": "",
      "description": "Pre-seed и seed инвестиции, наставничество, связи.",
      "url": ""
    },
    {
      "id": "vc",
      "name": "Венчурные фонды",
      "operator": "Частные, корпоративные и региональные фонды",
      "category": "invest",
      "level": "corporate",
      "stage_from": "mtk",
      "stage_to": "scale",
      "audience": "Растущие технологические компании",
      "amount": "",
      "description": "Раунды seed–B для масштабирования.",
      "url": ""
    },
    {
      "id": "mtk_status",
      "name": "Статус малой технологической компании",
      "operator": "Минэкономразвития (478-ФЗ, ПП № 1847)",
      "category": "status",
      "level": "federal",
      "stage_from": "mtk",
      "stage_to": "mtk",
      "audience": "Технологические компании",
      "amount": "",
      "description": "Включение в реестр МТК открывает доступ к льготным кредитам, налоговым и другим мерам.",
      "url": "https://legalacts.ru/doc/federalnyi-zakon-ot-04082023-n-478-fz-o-razvitii-tekhnologicheskikh/"
    },
    {
      "id": "mtk_credit",
      "name": "Льготное кредитование МТК",
      "operator": "МСП Банк, Корпорация МСП",
      "category": "status",
      "level": "federal",
      "stage_from": "mtk",
      "stage_to": "mtk",
      "audience": "Компании из реестра МТК",
      "amount": "",
      "description": "Кредиты на льготных условиях для компаний из реестра МТК.",
      "url": "https://xn--l1agf.xn--p1ai/"
    },
    {
      "id": "vzlet",
      "name": "«От Взлёта до IPO» и кредиты «Взлёт-IPO»",
      "operator": "Минэкономразвития (ФП «Технологии»)",
      "category": "status",
      "level": "federal",
      "stage_from": "mtk",
      "stage_to": "scale",
      "audience": "Растущие технологические компании",
      "amount": "",
      "description": "Льготное финансирование развития, масштабирования и подготовки к выходу на биржу.",
      "url": ""
    },
    {
      "id": "mtk_tax",
      "name": "Пониженная ставка налога на прибыль для МТК",
      "operator": "Субъекты РФ",
      "category": "status",
      "level": "regional",
      "stage_from": "mtk",
      "stage_to": "mtk",
      "audience": "МТК региона",
      "amount": "",
      "description": "С 2025 года регионы вправе снижать ставку налога на прибыль для МТК (по региональным законам).",
      "url": ""
    },
    {
      "id": "listing",
      "name": "Компенсация затрат на выход на биржу",
      "operator": "Минэкономразвития",
      "category": "status",
      "level": "federal",
      "stage_from": "scale",
      "stage_to": "scale",
      "audience": "МТК и технологические компании",
      "amount": "до 50 млн ₽",
      "description": "Возмещение расходов на листинг (по открытым данным — до 50 млн ₽ для МТК).",
      "url": ""
    },
    {
      "id": "sk_status",
      "name": "Статус участника «Сколково»",
      "operator": "Фонд «Сколково»",
      "category": "status",
      "level": "federal",
      "stage_from": "company",
      "stage_to": "scale",
      "audience": "Инновационные компании",
      "amount": "",
      "description": "Налоговые льготы, гранты и сервисы инновационного центра.",
      "url": "https://sk.ru/"
    },
    {
      "id": "it_accr",
      "name": "Аккредитация ИТ-компаний",
      "operator": "Минцифры",
      "category": "status",
      "level": "federal",
      "stage_from": "company",
      "stage_to": "scale",
      "audience": "ИТ-компании",
      "amount": "",
      "description": "Пониженные страховые взносы и налог на прибыль, льготная ипотека сотрудникам.",
      "url": ""
    },
    {
      "id": "frp",
      "name": "Займы Фонда развития промышленности",
      "operator": "ФРП и региональные фонды",
      "category": "status",
      "level": "federal",
      "stage_from": "mtk",
      "stage_to": "scale",
      "audience": "Промышленные технологические компании",
      "amount": "",
      "description": "Льготные займы на запуск производства и импортозамещение.",
      "url": "https://frprf.ru/"
    },
    {
      "id": "my_business",
      "name": "Центры «Мой бизнес» и Корпорация МСП",
      "operator": "Корпорация МСП, регионы",
      "category": "status",
      "level": "regional",
      "stage_from": "company",
      "stage_to": "mtk",
      "audience": "Субъекты МСП",
      "amount": "",
      "description": "Консультации, обучение, поручительства, льготный лизинг и маркетинговая поддержка.",
      "url": "https://xn--l1agf.xn--p1ai/"
    },
    {
      "id": "ckp",
      "name": "ЦКП и уникальные научные установки",
      "operator": "Вузы и научные организации",
      "category": "infra",
      "level": "federal",
      "stage_from": "rnd",
      "stage_to": "project",
      "audience": "Исследователи и стартапы",
      "amount": "",
      "description": "Доступ к оборудованию без его покупки.",
      "url": "https://ckp-rf.ru/"
    },
    {
      "id": "proto",
      "name": "Центры прототипирования и инжиниринга",
      "operator": "Вузы, регионы, технопарки",
      "category": "infra",
      "level": "regional",
      "stage_from": "project",
      "stage_to": "company",
      "audience": "Команды и компании",
      "amount": "",
      "description": "Изготовление прототипов и опытных образцов, инжиниринговые услуги.",
      "url": ""
    },
    {
      "id": "technoparks",
      "name": "Технопарки",
      "operator": "Регионы, вузы, частные управляющие компании",
      "category": "infra",
      "level": "regional",
      "stage_from": "company",
      "stage_to": "mtk",
      "audience": "Технологические компании",
      "amount": "",
      "description": "Площади, оборудование и сервисы для растущих компаний; для резидентов возможны льготы.",
      "url": ""
    },
    {
      "id": "intc",
      "name": "ИНТЦ — «научные долины»",
      "operator": "Фонды ИНТЦ (216-ФЗ)",
      "category": "infra",
      "level": "federal",
      "stage_from": "mtk",
      "stage_to": "scale",
      "audience": "Технологические компании",
      "amount": "",
      "description": "Особый правовой режим и льготы для участников инновационных научно-технологических центров.",
      "url": ""
    },
    {
      "id": "ttc",
      "name": "Центр трансфера технологий вуза",
      "operator": "Вуз",
      "category": "ip",
      "level": "university",
      "stage_from": "rnd",
      "stage_to": "company",
      "audience": "Авторы РИД, команды",
      "amount": "",
      "description": "Выявление и охрана РИД, оценка, лицензирование, передача прав в стартап.",
      "url": ""
    },
    {
      "id": "cpti",
      "name": "ЦПТИ — центры поддержки технологий и инноваций",
      "operator": "Роспатент / ФИПС, вузы",
      "category": "ip",
      "level": "federal",
      "stage_from": "rnd",
      "stage_to": "project",
      "audience": "Исследователи и изобретатели",
      "amount": "",
      "description": "Доступ к патентной информации, консультации, патентный поиск.",
      "url": "https://new.fips.ru/"
    },
    {
      "id": "priority2030",
      "name": "«Приоритет-2030»",
      "operator": "Минобрнауки",
      "category": "program",
      "level": "federal",
      "stage_from": "idea",
      "stage_to": "company",
      "audience": "Вузы-участники",
      "amount": "",
      "description": "Программа развития вузов: финансирует, в частности, техпред, внутренние гранты и инфраструктуру.",
      "url": "https://priority2030.ru/"
    },
    {
      "id": "pish",
      "name": "Передовые инженерные школы (ПИШ)",
      "operator": "Минобрнауки, вузы, индустриальные партнёры",
      "category": "program",
      "level": "federal",
      "stage_from": "rnd",
      "stage_to": "project",
      "audience": "Вузы и индустриальные партнёры",
      "amount": "",
      "description": "Инженерные проекты под задачи индустрии — источник технологических проектов.",
      "url": ""
    },
    {
      "id": "noc",
      "name": "Научно-образовательные центры мирового уровня (НОЦ)",
      "operator": "Минобрнауки, регионы",
      "category": "program",
      "level": "federal",
      "stage_from": "rnd",
      "stage_to": "company",
      "audience": "Вузы, научные организации, компании региона",
      "amount": "",
      "description": "Консорциумы вузов, науки и бизнеса для технологических проектов региона.",
      "url": ""
    },
    {
      "id": "pp218",
      "name": "Комплексные проекты вузов и предприятий (ПП № 218)",
      "operator": "Минобрнауки",
      "category": "program",
      "level": "federal",
      "stage_from": "rnd",
      "stage_to": "mtk",
      "audience": "Вузы и промышленные предприятия",
      "amount": "",
      "description": "Субсидии предприятиям на создание высокотехнологичного производства с выполнением НИОКР вузом.",
      "url": ""
    },
    {
      "id": "nti_centers",
      "name": "Центры компетенций НТИ",
      "operator": "Платформа НТИ, вузы",
      "category": "program",
      "level": "federal",
      "stage_from": "rnd",
      "stage_to": "project",
      "audience": "Вузы и консорциумы",
      "amount": "",
      "description": "Развитие сквозных технологий и передача их в компании-партнёры.",
      "url": ""
    }
  ],
  "sources": [
    {
      "title": "Платформа университетского технологического предпринимательства",
      "url": "https://univertechpred.ru/"
    },
    {
      "title": "Минэкономразвития: интеграция ПУТП в ФП «Технологии»",
      "url": "https://www.economy.gov.ru/material/news/minekonomrazvitiya_zavershilo_integraciyu_meropriyatiy_fedproekta_platforma_universitetskogo_tehnologicheskogo_predprinimatelstva_v_fedproekt_tehnologii.html"
    },
    {
      "title": "Фонд содействия инновациям",
      "url": "https://fasie.ru/"
    }
  ]
};
