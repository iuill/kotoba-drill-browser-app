import manifest from "./sample-voices-manifest.json";

export const sampleVoices = [
  {
    id: "nemo-female-1",
    name: "VOICEVOX Nemo 女声1",
    speaker: 10005,
    engine: "nemo",
  },
  {
    id: "nemo-male-1",
    name: "VOICEVOX Nemo 男声1",
    speaker: 10001,
    engine: "nemo",
  },
  {
    id: "voicevox-metan",
    name: "VOICEVOX 四国めたん",
    speaker: 2,
    engine: "voicevox",
  },
  {
    id: "voicevox-tsumugi",
    name: "VOICEVOX 春日部つむぎ",
    speaker: 8,
    engine: "voicevox",
  },
  {
    id: "voicevox-zunko",
    name: "VOICEVOX 東北ずん子",
    speaker: 107,
    engine: "voicevox",
  },
  {
    id: "voicevox-kiritan",
    name: "VOICEVOX 東北きりたん",
    speaker: 108,
    engine: "voicevox",
  },
  {
    id: "voicevox-ryusei",
    name: "VOICEVOX 青山龍星",
    speaker: 13,
    engine: "voicevox",
  },
  {
    id: "voicevox-mesuo",
    name: "VOICEVOX 剣崎雌雄",
    speaker: 21,
    engine: "voicevox",
  },
] as const;

const files: Readonly<Record<string, string>> = manifest.files;
export function recordedVoice(id: string) {
  return sampleVoices.find((voice) => voice.id === id);
}
export function recordedFile(text: string, voice: string): string | undefined {
  const selected = recordedVoice(voice);
  const file = Object.hasOwn(files, text) ? files[text] : undefined;
  return selected && file ? `audio/samples/${selected.id}/${file}` : undefined;
}
export function sampleSource(text: string, voice: string) {
  const selected = recordedVoice(voice);
  if (!selected) return "ブラウザ音声";
  return recordedFile(text, voice)
    ? `${selected.name}（収録音声）`
    : "未収録のお題のため、ブラウザ音声で再生します";
}
