export type DebugTurn = {
  user: string;
  photoCount?: number;
};

export type DebugCase = {
  id: string;
  title: string;
  turns: DebugTurn[];
};

export const DEBUG_CASES: DebugCase[] = [
  {
    id: "ru-durres-base",
    title: "RU Durres listing base",
    turns: [
      {
        user:
          "Продаю квартиру на берегу моря, на 50 метров от моря, в городе Дуррес. Цена 100 000 евро. Меблированная, двухкомнатная, балкон с видом на море, 50 метров от магазина, 100 метров от школы. Есть стиральная машинка, посудомоечная машина. Всё новое, квартира готова к заселению. Хороший вариант для инвестиций. Из удобств есть также паркинг снизу.",
        photoCount: 1,
      },
    ],
  },
  {
    id: "ru-durres-multiturn",
    title: "RU Durres multi-turn clarifications",
    turns: [
      {
        user:
          "Продаю квартиру в городе Дуррес. Цена 100 000 евро, двухкомнатная, 50 метров до моря. Очень хороший вариант для инвестиций.",
        photoCount: 1,
      },
      {
        user: "Площадь 72 м2, это квартира на 3 этаже, есть лифт, есть парковка.",
      },
      {
        user: "Квартира полностью меблирована, один санузел, готова к заселению.",
      },
    ],
  },
];
