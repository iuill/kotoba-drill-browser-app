// 1音の短すぎる母音だけを延ばす。子音やピッチを一律に引き延ばさない。
export const singleSampleRecipe = {
  version: 2,
  minimumVowelSeconds: 0.4,
  prePhonemeSeconds: 0.2,
  postPhonemeSeconds: 0.2,
};

interface MoraTiming {
  vowel: string;
  vowel_length: number;
}
export function prepareSingleSample(query: {
  accent_phrases: { moras: MoraTiming[] }[];
  prePhonemeLength?: number;
  postPhonemeLength?: number;
}) {
  const moras = query.accent_phrases.flatMap((phrase) => phrase.moras);
  if (
    moras.length !== 1 ||
    !["a", "i", "u", "e", "o"].includes(moras[0].vowel) ||
    !Number.isFinite(moras[0].vowel_length) ||
    moras[0].vowel_length <= 0
  )
    throw new Error("1音の母音の長さを調整できない音声クエリです。");
  query.prePhonemeLength = singleSampleRecipe.prePhonemeSeconds;
  query.postPhonemeLength = singleSampleRecipe.postPhonemeSeconds;
  moras[0].vowel_length = Math.max(
    moras[0].vowel_length,
    singleSampleRecipe.minimumVowelSeconds,
  );
}
