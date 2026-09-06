import { expect, test } from "bun:test";
import {
  articulation,
  specialHint,
  vowels,
} from "../../src/content/articulation";
import { sounds, units } from "../../src/core/materials";
import {
  guideForManner,
  mannerGroups,
  manners,
} from "../../src/content/phonetics";
import type { Manner } from "../../src/content/articulation";

test("分類一覧は教材の全音を含み、行の全体・一部と拗音を区別する", () => {
  const expected: Record<Manner, string> = {
    stop: "か き く け こ た て と が ぎ ぐ げ ご だ で ど ば び ぶ べ ぼ ぱ ぴ ぷ ぺ ぽ きゃ きゅ きょ ぎゃ ぎゅ ぎょ びゃ びゅ びょ ぴゃ ぴゅ ぴょ",
    fricative:
      "さ し す せ そ は ひ ふ へ ほ ざ じ ず ぜ ぞ しゃ しゅ しょ ひゃ ひゅ ひょ じゃ じゅ じょ",
    affricate: "ち つ ざ じ ず ぜ ぞ ちゃ ちゅ ちょ じゃ じゅ じょ",
    nasal: "な に ぬ ね の ま み む め も にゃ にゅ にょ みゃ みゅ みょ",
    tap: "ら り る れ ろ りゃ りゅ りょ",
    glide: "や ゆ よ わ",
    vowel: "あ い う え お",
  };
  const covered = new Set<string>();
  for (const kind of Object.keys(expected) as Manner[]) {
    const listed = mannerGroups(kind).flatMap((group) => group.sounds);
    expect(listed.toSorted()).toEqual(expected[kind].split(" ").toSorted());
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed).toContain(manners[kind].initialSound);
    for (const sound of listed) {
      covered.add(sound);
      expect(guideForManner(sound, kind)?.manner).toBe(kind);
    }
  }
  expect([...covered].toSorted()).toEqual(sounds.toSorted());
  expect(
    mannerGroups("stop").find((group) => group.label === "カ行")?.sounds,
  ).toEqual(["か", "き", "く", "け", "こ"]);
  expect(
    mannerGroups("nasal").find((group) => group.label === "マ行")?.sounds,
  ).toEqual(["ま", "み", "む", "め", "も"]);
});
test("ザ行の別の作り方は分類に合う閉鎖・摩擦の説明を使い、未知の分類は捏造しない", () => {
  for (const sound of ["ざ", "じ", "ず", "ぜ", "ぞ", "じゃ", "じゅ", "じょ"]) {
    expect(guideForManner(sound, "fricative")).toMatchObject({
      manner: "fricative",
      voiced: true,
    });
    expect(guideForManner(sound, "affricate")).toMatchObject({
      manner: "affricate",
      voiced: true,
    });
  }
  expect(guideForManner("じ", "fricative")?.position).toContain("すき間");
  expect(guideForManner("ざ", "affricate")?.position).toContain("閉じ");
  expect(guideForManner("か", "nasal")).toBeNull();
  expect(guideForManner("ん", "nasal")).toBeNull();
});

test("選択可能な各音に母音と図の情報があり、拗音を一拍で扱う", () => {
  for (const sound of sounds) {
    const hint = articulation(sound);
    expect(hint, sound).not.toBeNull();
    expect(vowels[hint!.vowel], sound).toBeDefined();
  }
  expect(units("きゃく")).toEqual(["きゃ", "く"]);
  expect(articulation("きゃ")).toMatchObject({
    vowel: "あ",
    palatal: true,
    place: "back",
  });
  expect(articulation("びょ")).toMatchObject({
    vowel: "お",
    palatal: true,
    place: "lips",
  });
});
test("同じ行の例外と清濁を区別し、未知・文脈依存の音に固定図を割り当てない", () => {
  expect(articulation("た")).toMatchObject({ place: "teeth", manner: "stop" });
  expect(articulation("ち")).toMatchObject({
    place: "postalveolar",
    manner: "affricate",
  });
  expect(articulation("つ")).toMatchObject({
    place: "teeth",
    manner: "affricate",
  });
  expect(articulation("は")?.place).toBe("open");
  expect(articulation("ひ")?.place).toBe("palate");
  expect(articulation("ふ")?.place).toBe("lips");
  expect(articulation("に")?.place).toBe("palate");
  expect(articulation("な")?.place).toBe("teeth");
  expect(articulation("が")?.voiced).toBe(true);
  expect(articulation("か")?.voiced).toBe(false);
  for (const sound of ["ん", "っ", "ー", "ふぁ", "", "xyz"])
    expect(articulation(sound)).toBeNull();
  expect(specialHint("ん")).toContain("次の音");
});
