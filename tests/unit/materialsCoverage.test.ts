import { expect, test } from "bun:test";
import { builtIn, candidates, soundGroups } from "../../src/core/materials";
import { defaults } from "../../src/core/types";

test("教材増補後も既存IDを維持し、清音・濁音・半濁音は各音に複数の日常語がある", () => {
  expect(builtIn[0]).toEqual({ id: "builtin-0", text: "傘", reading: "かさ" });
  expect(builtIn[59]).toEqual({
    id: "builtin-59",
    text: "住所",
    reading: "じゅうしょ",
  });
  expect(new Set(builtIn.map((w) => w.reading)).size).toBe(builtIn.length);
  for (const w of builtIn) {
    expect(w.text.length).toBeGreaterThan(0);
    expect(w.reading).toMatch(/^[ぁ-ゖー]+$/);
  }
  for (const sound of soundGroups
    .filter((g) => g.columns === 5)
    .flatMap((g) =>
      g.rows.flatMap((r) => r.split(" ").filter((s) => s !== "-")),
    )) {
    expect(
      candidates(
        {
          ...defaults,
          kind: "word",
          sounds: [sound],
          positions: ["start", "middle", "end"],
        },
        [],
      ).length,
    ).toBeGreaterThanOrEqual(5);
  }
  for (const reading of [
    "かせつ",
    "とうけい",
    "ぶらうざ",
    "にんしょう",
    "みつもり",
    "ぎじろく",
  ]) {
    expect(builtIn.some((w) => w.reading === reading)).toBe(true);
  }
});

test("音声生成の読み照合は長音の表記差だけを許容し、別読み・促音・拗音の違いを見逃さない", async () => {
  const { equivalentSampleReading } = await import(
    "../../scripts/sample-reading-overrides"
  );
  for (const [expected, actual] of [
    ["とうけい", "トーケー"],
    ["そふぁー", "ソファア"],
    ["ちゃづつ", "チャズツ"],
  ])
    expect(equivalentSampleReading(expected, actual)).toBe(true);
  for (const [expected, actual] of [
    ["おこめ", "オベエ"],
    ["にほん", "ニッポン"],
    ["びょう", "ビヨウ"],
    ["かって", "カテ"],
    ["とう", "ト"],
  ])
    expect(equivalentSampleReading(expected, actual)).toBe(false);
});
