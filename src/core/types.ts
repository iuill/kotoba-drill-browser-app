export type Kind = "single" | "pair" | "word";
export type Position = "start" | "middle" | "end";
export interface Word {
  id: string;
  text: string;
  reading: string;
}
export interface Prompt extends Word {
  kind: Kind;
  sounds: string[];
  /** 未指定は1回発声。音声認識を使う1音のお題は3回を1録音にまとめる。 */
  repetitions?: 3;
}
export interface Settings {
  sounds: string[];
  kind: Kind;
  vowels: string[];
  pairOrder: "before" | "after" | "both";
  positions: Position[];
  random: boolean;
  sample: "always" | "changed" | "manual" | "off";
  playback: boolean;
  voice: string;
  rate: number;
  volume: number;
  delay: number;
  silence: number;
  threshold: number;
  maxSeconds: number;
  manual: boolean;
  microphone: string;
  evaluation: boolean;
  model: string;
  device: "wasm" | "webgpu";
  limit: "none" | "count" | "minutes";
  limitValue: number;
  theme: "system" | "light" | "dark";
  effect: number;
  soundEffect: boolean;
}
export const defaults: Settings = {
  sounds: ["か", "き", "く", "け", "こ"],
  kind: "single",
  vowels: ["あ", "い", "う", "え", "お"],
  pairOrder: "both",
  positions: ["start", "middle", "end"],
  random: true,
  sample: "always",
  playback: true,
  voice: "voicevox-metan",
  rate: 0.85,
  volume: 0.8,
  delay: 0,
  silence: 1100,
  threshold: 0.025,
  maxSeconds: 10,
  manual: false,
  microphone: "",
  evaluation: false,
  model: "browser",
  device: "wasm",
  limit: "none",
  limitValue: 20,
  theme: "system",
  effect: 0.6,
  soundEffect: false,
};
export interface PracticeSet {
  id: string;
  name: string;
  settings: Settings;
}
export interface Preferences {
  version: 1;
  settings: Settings;
  sets: PracticeSet[];
  words: Word[];
  prepared: boolean;
}
export type Evaluation = "off" | "pending" | "done" | "skipped" | "error";
export interface History {
  id: string;
  session: string;
  date: string;
  prompt: Prompt;
  duration: number;
  elapsed: number;
  model: string | null;
  evaluation: Evaluation;
  skipReason?: "backlog" | "interrupted";
  recognized?: string;
  recognitionMessage?: string;
  comparison?: "match" | "different" | "unknown";
}
export type Phase =
  | "idle"
  | "preparing"
  | "sample"
  | "delay"
  | "waiting"
  | "recording"
  | "playback"
  | "paused"
  | "boundary"
  | "review";
