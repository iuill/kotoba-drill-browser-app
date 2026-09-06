import type { ProgressInfo } from "@huggingface/transformers";

export class DownloadProgress {
  private aggregate = false;
  private baseline?: {
    loaded: number;
    total: number;
    time: number;
    key: string;
  };

  update(p: ProgressInfo, now = performance.now()): string | undefined {
    if (p.status === "ready") return "モデルを準備中";
    if (p.status !== "progress_total" && p.status !== "progress") return;
    if (p.status === "progress_total") this.aggregate = true;
    else if (this.aggregate) return;
    const { loaded, total } = p;
    if (!Number.isFinite(loaded) || !Number.isFinite(total) || total <= 0)
      return;
    const key = p.status === "progress_total" ? "total" : p.file;
    const percent = Math.max(
      0,
      Math.min(100, Math.floor((loaded / total) * 100)),
    );
    if (loaded >= total) return "モデルを準備中（取得済み）";
    const b = this.baseline;
    if (!b || b.key !== key || b.total !== total || loaded < b.loaded) {
      this.baseline = { loaded, total, time: now, key };
    }
    let estimate = "残り時間を計算中";
    if (
      p.status === "progress_total" &&
      b &&
      this.baseline === b &&
      now - b.time >= 3000 &&
      loaded > b.loaded
    ) {
      const seconds = Math.ceil(
        (total - loaded) / ((loaded - b.loaded) / ((now - b.time) / 1000)),
      );
      estimate =
        seconds < 60
          ? `残り約${Math.max(5, Math.ceil(seconds / 5) * 5)}秒`
          : `残り約${Math.ceil(seconds / 60)}分`;
    }
    return `モデル取得中 ${percent}%｜${estimate}`;
  }
}
