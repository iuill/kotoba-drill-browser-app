import { describe, test, expect } from "bun:test";
import {
  builtIn,
  candidates,
  compare,
  Deck,
  positionsFor,
  units,
  promptReading,
} from "../../src/core/materials";
import { defaults } from "../../src/core/types";
import { LatestQueue } from "../../src/models/recognition";
import { TemporaryRecordings, TEMP_BYTES } from "../../src/storage/store";
const tick = () => new Promise((r) => setTimeout(r, 0));
test("1音は拗音も3回まとめて比較し、過去の1回発声や2音と区別する", () => {
  for (const sound of ["か", "しゃ"]) {
    const single = candidates({ ...defaults, sounds: [sound] }, [])[0];
    expect(single.repetitions).toBeUndefined();
    expect(promptReading(single)).toBe(sound);
    expect(compare(sound, single, [])).toBe("match");
    const p = candidates(
      { ...defaults, evaluation: true, sounds: [sound] },
      [],
    )[0];
    expect(p.reading).toBe(sound);
    expect(p.repetitions).toBe(3);
    expect(promptReading(p, "・")).toBe([sound, sound, sound].join("・"));
    expect(compare([sound, sound, sound].join("、"), p, [])).toBe("match");
    expect(compare(sound, p, [])).toBe("different");
    expect(compare(sound.repeat(2), p, [])).toBe("different");
    expect(compare(sound.repeat(4), p, [])).toBe("different");
    expect(compare(sound, { ...p, repetitions: undefined }, [])).toBe("match");
  }
  const pair = candidates(
    { ...defaults, evaluation: true, kind: "pair" },
    [],
  )[0];
  expect(pair.repetitions).toBeUndefined();
  expect(compare(pair.reading, pair, [])).toBe("match");
});
describe("教材と出題", () => {
  test("拗音を分割せず、語中・語尾と区別する", () => {
    expect(units("しゃしん")).toEqual(["しゃ", "し", "ん"]);
    expect(positionsFor("かいしゃ", "しゃ")).toEqual(["end"]);
    expect(positionsFor("きょうしつ", "き")).toEqual([]);
    expect(positionsFor("さかな", "か")).toEqual(["middle"]);
  });
  test("1音・母音の前後・空の教材条件", () => {
    expect(
      candidates({ ...defaults, sounds: ["しゃ"] }, []).map((p) => p.reading),
    ).toEqual(["しゃ"]);
    expect(
      candidates(
        {
          ...defaults,
          kind: "pair",
          sounds: ["しゃ"],
          vowels: ["あ"],
          pairOrder: "both",
        },
        [],
      ).map((p) => p.reading),
    ).toEqual(["あしゃ", "しゃあ"]);
    expect(
      candidates(
        { ...defaults, kind: "word", sounds: ["ぴゃ"], positions: [] },
        [],
      ),
    ).toEqual([]);
  });
  test("ランダム一巡と境界重複を避ける・一候補でも動く", () => {
    const items = candidates({ ...defaults, sounds: ["か", "き", "く"] }, []);
    const deck = new Deck(items, true, () => 0);
    const all = Array.from({ length: 12 }, () => deck.next()!.id);
    for (let i = 0; i < 12; i += 3)
      expect(new Set(all.slice(i, i + 3)).size).toBe(3);
    for (let i = 1; i < 12; i++) expect(all[i]).not.toBe(all[i - 1]);
    const one = new Deck(items.slice(0, 1), true);
    expect(one.next()).toEqual(one.next());
  });
  test("順番と戻る・次へ", () => {
    const items = candidates({ ...defaults, sounds: ["か", "き", "く"] }, []);
    const deck = new Deck(items, false);
    expect(deck.next()?.reading).toBe("か");
    expect(deck.next()?.reading).toBe("き");
    expect(deck.back()?.reading).toBe("か");
    expect(deck.next()?.reading).toBe("き");
  });
  test("表記差を正規化し未知の漢字は不一致と断定しない", () => {
    const p = candidates(
      { ...defaults, kind: "word", sounds: ["か"] },
      [],
    ).find((p) => p.text === "傘")!;
    expect(compare("カサ。", p, [])).toBe("match");
    expect(compare("傘", p, [])).toBe("match");
    expect(compare("未知", p, [])).toBe("unknown");
    expect(
      compare("傘", p, [{ id: "ambiguous", text: "傘", reading: "さん" }]),
    ).toBe("unknown");
    expect(builtIn.length).toBeGreaterThan(40);
  });
});
test("認識中1件・待機最新1件、置換対象のみスキップ", async () => {
  const started: string[] = [],
    skipped: string[] = [];
  const reasons: string[] = [];
  let complete = () => {};
  const queue = new LatestQueue<{ id: string }>(
    async (job) => {
      started.push(job.id);
      await new Promise<void>((r) => (complete = r));
    },
    (id, reason) => {
      skipped.push(id);
      reasons.push(reason);
    },
  );
  queue.push({ id: "a" });
  queue.push({ id: "b" });
  queue.push({ id: "c" });
  expect(started).toEqual(["a"]);
  expect(skipped).toEqual(["b"]);
  complete();
  await tick();
  expect(started).toEqual(["a", "c"]);
  queue.push({ id: "d" });
  queue.clear();
  expect(skipped).toEqual(["b", "d"]);
  expect(reasons).toEqual(["backlog", "interrupted"]);
  complete();
  await tick();
  expect(started).toEqual(["a", "c"]);
});
test("未保存録音は20件かつ50MB、古いものから破棄", () => {
  const tmp = new TemporaryRecordings();
  for (let i = 0; i < 21; i++) tmp.put(String(i), new Blob(["voice"]));
  expect(tmp.get("0")).toBeUndefined();
  expect(tmp.get("1")).toBeDefined();
  tmp.put("large", new Blob([new Uint8Array(TEMP_BYTES)]));
  expect(tmp.bytes).toBe(TEMP_BYTES);
  expect(tmp.get("20")).toBeUndefined();
  tmp.put("new", new Blob(["a"]));
  expect(tmp.get("large")).toBeUndefined();
  tmp.clear();
  expect(tmp.bytes).toBe(0);
});

test("発声待ち30秒・無音終了・録音上限と手動モード", async () => {
  const { VoiceGate } = await import("../../src/audio/voiceGate");
  const gate = new VoiceGate(defaults, 0);
  expect(gate.update(29999, 0)).toBe("wait");
  expect(gate.update(30000, 0)).toBe("no-speech");
  const voiced = new VoiceGate(defaults, 0);
  expect(voiced.update(100, 0.1)).toBe("start");
  voiced.begin(100);
  expect(voiced.update(500, 0.1)).toBe("wait");
  expect(voiced.update(1599, 0)).toBe("wait");
  expect(voiced.update(1600, 0)).toBe("finish");
  expect(voiced.update(10100, 0.1)).toBe("limit");
  const manual = new VoiceGate({ ...defaults, manual: true }, 0);
  expect(manual.update(1, 0.1)).toBe("wait");
  manual.begin(100);
  expect(manual.update(1600, 0)).toBe("wait");
  expect(manual.update(10100, 0)).toBe("limit");
});
