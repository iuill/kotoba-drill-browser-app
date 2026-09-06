import { expect, test } from "bun:test";
import { prepareSingleSample } from "../../scripts/sample-timing";

test("短い1音の母音と合成前後の余白を確保し、子音・ピッチを保つ", () => {
  const mora = {
    text: "カ",
    consonant: "k",
    consonant_length: 0.075,
    vowel: "a",
    vowel_length: 0.1,
    pitch: 5.1,
  };
  const query = {
    accent_phrases: [{ moras: [mora] }],
    prePhonemeLength: 0.06,
    postPhonemeLength: 0.12,
  };
  prepareSingleSample(query);
  expect(query).toEqual({
    accent_phrases: [
      {
        moras: [
          {
            text: "カ",
            consonant: "k",
            consonant_length: 0.075,
            vowel: "a",
            vowel_length: 0.4,
            pitch: 5.1,
          },
        ],
      },
    ],
    prePhonemeLength: 0.2,
    postPhonemeLength: 0.2,
  });
  mora.vowel_length = 0.5;
  prepareSingleSample(query);
  expect(mora.vowel_length).toBe(0.5);
});

test("複数モーラや想定外の母音は誤って延ばさず生成を止める", () => {
  for (const moras of [
    [],
    [
      { vowel: "a", vowel_length: 0.1 },
      { vowel: "i", vowel_length: 0.1 },
    ],
    [{ vowel: "U", vowel_length: 0.1 }],
    [{ vowel: "a", vowel_length: NaN }],
  ]) {
    expect(() =>
      prepareSingleSample({ accent_phrases: [{ moras }] }),
    ).toThrow();
  }
});
