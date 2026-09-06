import { soundGroups } from "../core/materials";
import {
  articulation,
  consonantSource,
  vowelSource,
  type Articulation,
  type Manner,
} from "./articulation";

export function soundFeatures(guide: Articulation) {
  const place =
    guide.place === "open"
      ? guide.manner === "vowel"
        ? "口の形で響きを変える"
        : "のど（声門）"
      : {
          lips: "唇",
          teeth: "歯ぐき付近",
          postalveolar: "歯ぐきの少し奥",
          palate: "上あごの中央",
          back: "上あごの奥",
        }[guide.place];
  return [
    { label: "作り方", value: manners[guide.manner].name },
    { label: "場所", value: place },
    { label: "声帯の振動", value: guide.voiced ? "あり" : "なし" },
    { label: "母音", value: guide.vowel },
  ];
}

export const comparisonExamples = [
  { label: "作り方", sounds: ["た", "さ"] },
  { label: "場所", sounds: ["て", "け"] },
  { label: "声帯の振動", sounds: ["か", "が"] },
  { label: "母音", sounds: ["あ", "い"] },
] as const;

// 独自の短い説明。参照先と模式図の範囲は docs/articulation.md。
export const manners: Record<
  Manner,
  {
    name: string;
    reading: string;
    summary: string;
    initialSound: string;
    steps: string[];
    note: string;
  }
> = {
  stop: {
    name: "破裂音",
    reading: "はれつおん",
    summary: "止めて、離す",
    initialSound: "か",
    steps: ["通り道を閉じる", "離して息を出す", "母音へつなぐ"],
    note: "閉鎖音とも呼びます。「破裂」は強い息という意味ではありません。カ行はすべてこの仲間。タ行では「た・て・と」で、「ち・つ」は破擦音です。ガ行には鼻濁音や摩擦で発音する場合もあり、ここでは閉じて離す形を示します。",
  },
  fricative: {
    name: "摩擦音",
    reading: "まさつおん",
    summary: "すき間に、息を通す",
    initialSound: "さ",
    steps: ["細いすき間を作る", "息を通して音にする", "母音へつなぐ"],
    note: "すき間を通る息が音を作ります。ハ行はすべて摩擦音ですが、「は・へ・ほ」「ひ」「ふ」で場所が違います。ザ行は破擦音で発音する場合もあり、ここでは閉じずに始める形を示します。",
  },
  affricate: {
    name: "破擦音",
    reading: "はさつおん",
    summary: "止めてから、すき間へ",
    initialSound: "つ",
    steps: ["通り道を閉じる", "少し開いて息を通す", "母音へつなぐ"],
    note: "摩擦音との違いは、最初にいったん閉じること。破裂音との違いは、離したあとに摩擦が続くことです。ザ行は「じ」も含め、摩擦音・破擦音の両方の発音があります。ここでは閉じてから始める形を示します。",
  },
  nasal: {
    name: "鼻音",
    reading: "びおん",
    summary: "口の通り道を閉じ、鼻へ",
    initialSound: "ま",
    steps: ["口の通り道を閉じる", "声と息を鼻へ通す", "口を開いて母音へ"],
    note: "マ行・ナ行はすべて鼻音です。マ行は唇、ナ行は舌で口の通り道を閉じます。「に」は「な」より奥寄りです。「ん」も鼻に抜ける音ですが、閉じる場所や閉じ方は前後の音で変わります。ガ行を鼻に抜いて発音する「鼻濁音」も鼻音です。",
  },
  tap: {
    name: "弾き音",
    reading: "はじきおん",
    summary: "舌先で、軽く一度触れる",
    initialSound: "ら",
    steps: ["舌先を近づける", "短く一度触れる", "すぐ離して母音へ"],
    note: "ラ行の代表的な作り方です。舌先を押しつけ続けたり、何度も震わせる巻き舌にしたりする必要はありません。",
  },
  glide: {
    name: "接近音・半母音",
    reading: "せっきんおん・はんぼいん",
    summary: "母音の形へ、なめらかに",
    initialSound: "や",
    steps: ["舌や唇を近づける", "息を止めずに移る", "次の母音の形へ"],
    note: "摩擦音ほど狭くせず、母音へ滑らかにつなぎます。「や」は「い・あ」と二拍に区切らず一拍で。",
  },
  vowel: {
    name: "母音",
    reading: "ぼいん",
    summary: "口の形で、響きを変える",
    initialSound: "あ",
    steps: ["舌の高さ・前後を変える", "唇の開きを変える", "口へ息を流す"],
    note: "日本語の基本の母音は5つ。舌や唇で息をせき止めず、口の空間を変えます。「う」は唇を強く突き出さないのが目安です。",
  },
};

// ザ行（拗音を含む）は摩擦音・破擦音の両方に載せる。
export const segmentSource = "https://www2.ninjal.ac.jp/kikuo/segment.pdf";
export function guideForManner(
  sound: string,
  manner: Manner,
): Articulation | null {
  const guide = articulation(sound);
  if (!guide) return null;
  if (
    !"ざじずぜぞ".includes(sound[0]) ||
    !["fricative", "affricate"].includes(manner)
  )
    return guide.manner === manner ? guide : null;
  const place =
    guide.place === "postalveolar" ? "歯ぐきより少し奥" : "上の歯ぐき付近";
  return {
    ...guide,
    manner,
    source: segmentSource,
    position:
      manner === "fricative"
        ? `舌を${place}に近づけ、細いすき間を作ります。`
        : `舌を${place}につけ、いったん通り道を閉じます。`,
    breath:
      manner === "fricative"
        ? "閉じずに、すき間へ声と息を通します。"
        : "閉じたところを少し開き、すき間へ声と息を通します。",
  };
}
export function mannerGroups(manner: Manner) {
  return soundGroups
    .flatMap((group) =>
      group.rows.map((row) => {
        const all = row.split(" ").filter((sound) => sound !== "-");
        const palatal = group.name === "拗音";
        const label = palatal
          ? `${all[0][0]}の拗音`
          : `${String.fromCharCode(all[0].charCodeAt(0) + 96)}行`;
        return {
          label,
          palatal,
          sounds: all.filter((sound) => guideForManner(sound, manner)),
        };
      }),
    )
    .filter((group) => group.sounds.length > 0);
}

export const places = [
  {
    name: "唇",
    term: "両唇（りょうしん）",
    sound: "ぱ",
    description:
      "上唇と下唇を使います。「ぱ・ば・ま」は閉じ、「ふ」はすき間を残します。",
  },
  {
    name: "歯ぐき付近",
    term: "歯茎（しけい）",
    sound: "て",
    description:
      "上の前歯のすぐ後ろに、舌先付近を当てたり近づけたりします。例：た・て・と・な・さ・ら。",
  },
  {
    name: "歯ぐきの少し奥",
    term: "歯茎硬口蓋（しけいこうこうがい）付近",
    sound: "ち",
    description:
      "「し・ち・じ」は舌の前の面を使います。「さ・た」より少し奥寄りです。",
  },
  {
    name: "上あごの中央",
    term: "硬口蓋（こうこうがい）",
    sound: "ひ",
    description:
      "上あごの硬い部分へ舌の面を近づけます。例：ひ・に・や。息の通し方は音ごとに違います。",
  },
  {
    name: "上あごの奥",
    term: "軟口蓋（なんこうがい）",
    sound: "け",
    description:
      "上あごの奥の柔らかい部分へ舌の奥を上げます。カ行・ガ行の代表的な閉鎖の場所です。",
  },
  {
    name: "のど",
    term: "声門（せいもん）",
    sound: "は",
    description:
      "「は・へ・ほ」の出だしは声帯の間を息が通ります。舌や唇で閉じる場所はありません。図ではのどの内部を省略しています。",
  },
] as const;

export const phoneticsSources = [
  {
    label: "国立国語研究所：日本語の子音・母音の分類（表2・付録）",
    url: segmentSource,
  },
  {
    label: "東京外国語大学：ガ行の鼻濁音",
    url: "https://www.coelang.tufs.ac.jp/modules/ja/pmod/practical/02-12-01.php",
  },
  { label: "国際交流基金：破裂・摩擦・破擦、声帯の振動", url: consonantSource },
  {
    label: "東京外国語大学：ラ行の舌の動き",
    url: "https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/01-02-01.php",
  },
  {
    label: "東京外国語大学：日本語にもある子音（鼻音・軟口蓋音など）",
    url: "https://www.coelang.tufs.ac.jp/mt/ar/pmod2/1-2/1.html",
  },
  { label: "東京外国語大学：母音", url: vowelSource },
  {
    label: "東京外国語大学：拍（モーラ）",
    url: "https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/01-10-01.php",
  },
  {
    label: "東京外国語大学：拗音",
    url: "https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/01-11-01.php",
  },
  {
    label: "東京外国語大学：撥音・半母音",
    url: "https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/02-04-01.php",
  },
] as const;
