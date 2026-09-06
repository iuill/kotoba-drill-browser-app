// エンジンの辞書が別読みを返す語だけ、教材の読みを明示する。
// 表記・教材IDは変えず、通常の単語は辞書の自然なアクセントを使う。
export const sampleReadingOverrides: Record<string, string> = {
  おこめ: "オコメ",
  きいろ: "キイロ",
  なす: "ナス",
  にほん: "ニホン",
  つの: "ツノ",
  ひたい: "ヒタイ",
  なみおと: "ナミオト",
  つめきり: "ツメキリ",
  おもて: "オモテ",
  からい: "カライ",
  めざまし: "メザマシ",
  じょうぶ: "ジョウブ",
  なべしき: "ナベシキ",
  てんぴぼし: "テンピボシ",
};

// 長音の表記ゆれ・じ/ぢ・ず/づを許容する。促音や拗音は区別する。
export function equivalentSampleReading(expected: string, actual: string) {
  const vowels = [
    ["あ", "あかがさざただなはばぱまやらわゃぁ"],
    ["い", "いきぎしじちにひびぴみりぃ"],
    ["う", "うくぐすずつぬふぶぷむゆるゅぅゔ"],
    ["え", "えけげせぜてでねへべぺめれぇ"],
    ["お", "おこごそぞとどのほぼぽもよろょぉ"],
  ];
  const vowel = (unit: string) =>
    vowels.find(([, row]) => row.includes(unit.at(-1) || "_"))?.[0] ?? "";
  const canonical = (reading: string) => {
    const units =
      reading
        .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 96))
        .replaceAll("づ", "ず")
        .replaceAll("ぢ", "じ")
        .match(/[ぁ-ゖー][ゃゅょぁぃぅぇぉ]?/g) ?? [];
    return units
      .map((unit, i) => {
        const previous = vowel(units[i - 1] ?? "");
        if (unit === "ー") return previous || unit;
        if (unit === "う" && previous === "お") return "お";
        if (unit === "い" && previous === "え") return "え";
        return unit;
      })
      .join("");
  };
  return canonical(expected) === canonical(actual);
}
