import type { Settings } from "../core/types";
export type GateAction = "wait" | "start" | "finish" | "limit" | "no-speech";
/** 音量の測定と独立した、無音・発声待ち・録音上限の判定。時刻は単調増加するms。 */
export class VoiceGate {
  private started: number | null = null;
  private lastVoice: number;
  constructor(
    private settings: Pick<
      Settings,
      "manual" | "threshold" | "maxSeconds" | "silence"
    >,
    private waiting: number,
  ) {
    this.lastVoice = waiting;
  }
  begin(now: number) {
    this.started = now;
    this.lastVoice = now;
  }
  update(now: number, level: number): GateAction {
    const voiced = level >= this.settings.threshold;
    if (voiced) this.lastVoice = now;
    if (this.started === null) {
      if (voiced && !this.settings.manual) return "start";
      return now - this.waiting >= 30000 ? "no-speech" : "wait";
    }
    if (now - this.started >= this.settings.maxSeconds * 1000) return "limit";
    if (!this.settings.manual && now - this.lastVoice >= this.settings.silence)
      return "finish";
    return "wait";
  }
}
