import { extraWordEntries } from "../content/words";
import type { Prompt, Settings, Word, Position } from "./types";
export const sampleText = "あ、か、あか、かさ";
export const promptReading = (prompt: Prompt, separator = "") =>
  Array.from({ length: prompt.repetitions ?? 1 }, () => prompt.reading).join(
    separator,
  );
export const soundGroups = [
  {
    name: "清音",
    columns: 5,
    rows: [
      "あ い う え お",
      "か き く け こ",
      "さ し す せ そ",
      "た ち つ て と",
      "な に ぬ ね の",
      "は ひ ふ へ ほ",
      "ま み む め も",
      "や - ゆ - よ",
      "ら り る れ ろ",
      "わ - - - -",
    ],
  },
  {
    name: "濁音",
    columns: 5,
    rows: [
      "が ぎ ぐ げ ご",
      "ざ じ ず ぜ ぞ",
      "だ - - で ど",
      "ば び ぶ べ ぼ",
    ],
  },
  { name: "半濁音", columns: 5, rows: ["ぱ ぴ ぷ ぺ ぽ"] },
  {
    name: "拗音",
    columns: 3,
    rows: [
      "きゃ きゅ きょ",
      "しゃ しゅ しょ",
      "ちゃ ちゅ ちょ",
      "にゃ にゅ にょ",
      "ひゃ ひゅ ひょ",
      "みゃ みゅ みょ",
      "りゃ りゅ りょ",
      "ぎゃ ぎゅ ぎょ",
      "じゃ じゅ じょ",
      "びゃ びゅ びょ",
      "ぴゃ ぴゅ ぴょ",
    ],
  },
];
export const sounds = soundGroups.flatMap((group) =>
  group.rows.flatMap((row) => row.split(" ").filter((sound) => sound !== "-")),
);
// 独自作成の日常語。音・位置は読みのモーラ列から導出する。
export const builtIn: Word[] = (
  "傘:かさ 鍵:かぎ 机:つくえ 時計:とけい 靴:くつ 景色:けしき 心:こころ 魚:さかな 桜:さくら 塩:しお 写真:しゃしん 新聞:しんぶん 寿司:すし 背中:せなか 空:そら 畳:たたみ 地図:ちず 月:つき 手紙:てがみ 扉:とびら 名前:なまえ 荷物:にもつ 布:ぬの 猫:ねこ 野原:のはら 花:はな 光:ひかり 船:ふね 部屋:へや 星:ほし 窓:まど 道:みち 麦:むぎ 眼鏡:めがね 森:もり 山:やま 雪:ゆき 夜:よる ラジオ:らじお 林檎:りんご 留守:るす レモン:れもん 廊下:ろうか 川:かわ 牛乳:ぎゅうにゅう 旅行:りょこう お茶:おちゃ 電車:でんしゃ 辞書:じしょ 病院:びょういん 切手:きって 切符:きっぷ 会社:かいしゃ 教室:きょうしつ 客:きゃく 去年:きょねん 茶碗:ちゃわん 注文:ちゅうもん 貯金:ちょきん 住所:じゅうしょ" +
  " " +
  extraWordEntries
)
  .split(/\s+/)
  .map((v, i) => {
    const [text, reading] = v.split(":");
    return { id: `builtin-${i}`, text, reading };
  });
export function normalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 96))
    .replace(/[\s\p{P}\p{S}]/gu, "");
}
export function units(reading: string): string[] {
  return normalize(reading).match(/[ぁ-ゖー][ゃゅょぁぃぅぇぉ]?/g) ?? [];
}
export function positionsFor(reading: string, sound: string): Position[] {
  const u = units(reading);
  return [
    ...new Set(
      u.flatMap((v, i): Position[] =>
        v === sound
          ? [i === 0 ? "start" : i === u.length - 1 ? "end" : "middle"]
          : [],
      ),
    ),
  ];
}
export function candidates(s: Settings, custom: Word[]): Prompt[] {
  const make = (reading: string): Prompt => ({
    id: `${s.kind}-${reading}`,
    text: reading,
    reading,
    kind: s.kind,
    sounds: s.sounds,
  });
  if (s.kind === "single")
    return s.sounds.map((reading) =>
      s.evaluation ? { ...make(reading), repetitions: 3 } : make(reading),
    );
  if (s.kind === "pair")
    return [
      ...new Set(
        s.sounds.flatMap((x) =>
          s.vowels.flatMap((v) =>
            s.pairOrder === "before"
              ? [v + x]
              : s.pairOrder === "after"
                ? [x + v]
                : [v + x, x + v],
          ),
        ),
      ),
    ].map(make);
  return [
    ...builtIn.filter((w) => !custom.some((c) => c.id === w.id)),
    ...custom,
  ]
    .filter((w) =>
      s.sounds.some((x) =>
        positionsFor(w.reading, x).some((p) => s.positions.includes(p)),
      ),
    )
    .map((w) => ({ ...w, kind: "word", sounds: s.sounds }));
}
export class Deck {
  private remaining: Prompt[] = [];
  private last = "";
  private past: Prompt[] = [];
  constructor(
    private items: Prompt[],
    private random: boolean,
    private rng = Math.random,
  ) {}
  next() {
    if (!this.remaining.length) {
      this.remaining = [...this.items];
      if (this.random) {
        for (let i = this.remaining.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [this.remaining[i], this.remaining[j]] = [
            this.remaining[j],
            this.remaining[i],
          ];
        }
        if (this.remaining.length > 1 && this.remaining[0].id === this.last)
          [this.remaining[0], this.remaining[1]] = [
            this.remaining[1],
            this.remaining[0],
          ];
      }
    }
    const p = this.remaining.shift();
    if (p) {
      this.last = p.id;
      this.past.push(p);
    }
    return p;
  }
  back() {
    if (this.past.length > 1) {
      const current = this.past.pop()!;
      this.remaining.unshift(current);
      this.last = this.past.at(-1)!.id;
    }
    return this.past.at(-1);
  }
  private indexOf(prompt: Prompt) {
    return this.past.findLastIndex(
      (p) =>
        p.id === prompt.id &&
        p.reading === prompt.reading &&
        p.repetitions === prompt.repetitions,
    );
  }
  canReturnTo(prompt: Prompt) {
    return this.indexOf(prompt) >= 0;
  }
  returnTo(prompt: Prompt) {
    const index = this.indexOf(prompt);
    if (index < 0) return;
    this.remaining.unshift(...this.past.splice(index + 1));
    this.last = this.past[index].id;
    return this.past[index];
  }
}
export function compare(
  recognized: string,
  prompt: Prompt,
  words: Word[],
): "match" | "different" | "unknown" {
  const n = normalize(recognized);
  const readings = [
    ...new Set(
      [...builtIn, ...words]
        .filter((w) => normalize(w.text) === n)
        .map((w) => normalize(w.reading)),
    ),
  ];
  if (readings.length > 1) return "unknown";
  const r = readings[0] ?? n;
  if (/[一-龯々]/.test(r)) return "unknown";
  return r === normalize(promptReading(prompt)) ? "match" : "different";
}
