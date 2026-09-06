import { expect, test } from "bun:test";
import { DownloadProgress } from "../../src/models/downloadProgress";
const progress = (loaded: number, total = 1000) => ({
  status: "progress_total" as const,
  name: "model",
  progress: (loaded / total) * 100,
  loaded,
  total,
  files: {},
});
test("全体の速度から概算し、個別進捗を混ぜず、取得後は準備中にする", () => {
  const p = new DownloadProgress();
  expect(p.update(progress(0), 0)).toContain("計算中");
  expect(p.update(progress(100), 1000)).toContain("計算中");
  expect(p.update(progress(300), 3000)).toBe("モデル取得中 30%｜残り約10秒");
  expect(
    p.update({ ...progress(90, 100), status: "progress", file: "a" }, 3100),
  ).toBeUndefined();
  expect(p.update(progress(1000), 10000)).toBe("モデルを準備中（取得済み）");
});
test("容量の変更・再取得では速度を再計測し、長い待ち時間は分単位にする", () => {
  const p = new DownloadProgress();
  p.update(progress(0), 0);
  expect(p.update(progress(10), 3000)).toContain("残り約5分");
  expect(p.update(progress(20, 2000), 4000)).toContain("計算中");
  expect(p.update(progress(0, 2000), 5000)).toContain("計算中");
  expect(p.update(progress(0, 2000), 9000)).toContain("計算中");
});
