// 音声学の参考資料と作図方針は docs/articulation.md。図・説明は独自作成。
import { sounds } from "../core/materials";
export type Vowel = "あ" | "い" | "う" | "え" | "お";
export type Place =
  | "open"
  | "lips"
  | "teeth"
  | "postalveolar"
  | "palate"
  | "back";
export type Manner =
  | "vowel"
  | "stop"
  | "fricative"
  | "affricate"
  | "nasal"
  | "tap"
  | "glide";
export interface Articulation {
  sound: string;
  vowel: Vowel;
  place: Place;
  manner: Manner;
  voiced: boolean;
  position: string;
  breath: string;
  tip: string;
  palatal: boolean;
  source: string;
}
const tufs = "https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/";
export const vowelSource = `${tufs}01-07-01.php`;
export const consonantSource =
  "https://www.jpf.go.jp/j/project/japanese/teach/tsushin/research/202302.html";
export const vowels: Record<Vowel, { position: string; lips: string }> = {
  あ: { position: "舌を低くして、口の中を広く。", lips: "口を縦に開く" },
  い: {
    position: "舌の前のほうを高く。上あごとの間は開けます。",
    lips: "口の開きは小さく、やや横に",
  },
  う: {
    position: "舌の奥のほうを高く。唇は強く突き出しません。",
    lips: "小さく開き、唇の力を抜く",
  },
  え: {
    position: "舌の前のほうを少し上げます。「い」より口を開きます。",
    lips: "「い」より少し広く",
  },
  お: {
    position: "舌の奥のほうを少し上げます。「う」より口を開きます。",
    lips: "軽く丸めて開く",
  },
};
// 例外のある行を一括で同じ調音にしない。未知の読みを既知の音に推測変換しない。
export function articulation(sound: string): Articulation | null {
  if (!sounds.includes(sound)) return null;
  const first = sound[0];
  const palatal = sound.length === 2;
  let vowel: Vowel = "あ";
  if (palatal)
    vowel = ({ ゃ: "あ", ゅ: "う", ょ: "お" } as const)[
      sound[1] as "ゃ" | "ゅ" | "ょ"
    ];
  else {
    const rows = [
      "あかさたなはまやらわがざだばぱ",
      "いきしちにひみりぎじびぴ",
      "うくすつぬふむゆるぐずぶぷ",
      "えけせてねへめれげぜでべぺ",
      "おこそとのほもよろごぞどぼぽ",
    ];
    vowel = (["あ", "い", "う", "え", "お"] as const)[
      rows.findIndex((row) => row.includes(first))
    ];
  }
  const base = { sound, vowel, palatal, source: consonantSource };
  const make = (
    place: Place,
    manner: Manner,
    voiced: boolean,
    position: string,
    breath: string,
    tip: string,
    source = consonantSource,
  ): Articulation => ({
    ...base,
    place,
    manner,
    voiced,
    position,
    breath,
    tip,
    source,
  });
  if ("あいうえお".includes(first))
    return make(
      "open",
      "vowel",
      true,
      vowels[vowel].position,
      "口から、声と一緒に息を流します。",
      "無理に大きく動かさず、楽な声で。",
      vowelSource,
    );
  if ("かきくけこがぎぐげご".includes(first))
    return make(
      "back",
      "stop",
      "がぎぐげご".includes(first),
      "舌の奥を上あごの奥につけ、いったん通り道を閉じます。",
      "舌を離した瞬間に、息を口へ出します。",
      "舌先ではなく、舌の奥で作る音です。",
      `${tufs}01-06-01.php`,
    );
  if ("ぱぴぷぺぽばびぶべぼ".includes(first))
    return make(
      "lips",
      "stop",
      "ばびぶべぼ".includes(first),
      "上唇と下唇を合わせて閉じます。",
      "唇を離して、口から息を出します。",
      "唇を強く押しつけず、軽く合わせます。",
      `${tufs}01-04-01.php`,
    );
  if ("まみむめも".includes(first))
    return make(
      "lips",
      "nasal",
      true,
      "唇を閉じたまま、声を響かせます。",
      "出だしの息は鼻へ。唇を開いて母音につなぎます。",
      "唇を閉じるのは出だしだけです。",
    );
  if ("たてとだでど".includes(first))
    return make(
      "teeth",
      "stop",
      "だでど".includes(first),
      "舌の先を上の前歯のすぐ後ろにつけます。",
      "いったん止めた息を、舌を離して出します。",
      "舌を歯の間から突き出す必要はありません。",
    );
  if ("なにぬねの".includes(first))
    return make(
      first === "に" ? "palate" : "teeth",
      "nasal",
      true,
      first === "に"
        ? "舌の前の面を上あごにつけます。「な」より奥寄りです。"
        : "舌先付近を上の前歯の後ろにつけます。",
      "出だしの息は鼻へ。舌を離して母音につなぎます。",
      "口を閉じる場所と、息の出口は別です。",
      `${tufs}03-05-01.php`,
    );
  if ("らりるれろ".includes(first))
    return make(
      "teeth",
      "tap",
      true,
      "舌先で上の前歯の後ろを、一度だけ軽く触れます。",
      "触れたらすぐ離し、母音へつなぎます。",
      "舌先を押しつけ続けず、短く触れるのが目安です。",
      `${tufs}01-02-01.php`,
    );
  if (first === "ふ")
    return make(
      "lips",
      "fricative",
      false,
      "上下の唇を近づけ、細いすき間を作ります。",
      "唇のすき間から息を通します。",
      "上の歯を下唇に当てず、両方の唇で作ります。",
      `${tufs}03-06-01.php`,
    );
  if (first === "ひ")
    return make(
      "palate",
      "fricative",
      false,
      "舌の中ほどを上あごに近づけます。触れずにすき間を残します。",
      "上あごと舌のすき間に息を通します。",
      "「し」より奥で息の通り道を狭くします。",
      `${tufs}03-06-01.php`,
    );
  if ("はへほ".includes(first))
    return make(
      "open",
      "fricative",
      false,
      "口や舌は、続く母音の形を準備します。",
      "窓を曇らせる「はー」のように息を出します。",
      "舌や唇で通り道をふさぎません。",
      `${tufs}03-06-01.php`,
    );
  if ("しじち".includes(first))
    return make(
      "postalveolar",
      first === "し" ? "fricative" : "affricate",
      first === "じ",
      "舌の前の面を、歯ぐきより少し奥の上あごへ。",
      first === "し"
        ? "すき間を残して、細く息を通します。"
        : "いったん閉じてから、すき間に息を通します。",
      first === "じ"
        ? "「じ」は、閉じずに摩擦で始める発音もあります。"
        : "唇を強く丸めず、舌の前の面を使います。",
      first === "し" ? `${tufs}03-04-01.php` : consonantSource,
    );
  if (first === "つ")
    return make(
      "teeth",
      "affricate",
      false,
      "舌先付近を上の前歯の後ろにつけます。",
      "閉じたところを少し開き、細く息を通します。",
      "離したあとにも息のこすれる音が続きます。",
    );
  if ("さすせそざずぜぞ".includes(first))
    return make(
      "teeth",
      "fricative",
      "ざずぜぞ".includes(first),
      "舌先付近と上の歯ぐきの間に、細い通り道を作ります。",
      "通り道を閉じきらず、息を細く通します。",
      "ざずぜぞ".includes(first)
        ? "「ざ・ず・ぜ・ぞ」は、いったん閉じて始める発音もあります。"
        : "「し」より前のほうで、すき間を作ります。",
      `${tufs}01-03-01.php`,
    );
  if ("やゆよ".includes(first))
    return make(
      "palate",
      "glide",
      true,
      "舌の前のほうを上あごに近づけ、すぐ母音の形へ。",
      "息を止めず、声を滑らかにつなぎます。",
      "「い・あ」のように二つに区切らず、ひと息で。",
      `${tufs}01-11-01.php`,
    );
  if (first === "わ")
    return make(
      "back",
      "glide",
      true,
      "舌の奥を上げ、唇を軽くすぼめてから「あ」へ。",
      "息を止めず、声をつなぎます。",
      "唇は強く突き出さなくて大丈夫です。",
      `${tufs}03-07-01.php`,
    );
  return null;
}
export function specialHint(sound: string): string {
  if (sound === "ん")
    return "「ん」の舌や唇の位置は、次の音に合わせて変わります。いつも同じ形には固定しません。";
  if (sound === "っ")
    return "小さい「っ」は一拍分の間。次の子音に合わせて、息を止めたり、摩擦を保ったりします。";
  if (sound === "ー") return "前の母音の形を保ち、声を一拍分長く伸ばします。";
  return "この音の図はまだありません。見本を聞きながら、前後の音とつなげて練習できます。";
}
