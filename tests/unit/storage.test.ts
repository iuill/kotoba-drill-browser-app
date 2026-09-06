import { beforeEach, test, expect } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import {
  Store,
  initialPreferences,
  temporary,
  validateBackup,
  SAVED_BYTES,
} from "../../src/storage/store";
import type { Backup } from "../../src/storage/store";
import type { History } from "../../src/core/types";
import { candidates } from "../../src/core/materials";
const prefs = initialPreferences();
const h: History = {
  id: "h1",
  session: "s",
  date: "2026-09-05T01:00:00Z",
  prompt: candidates(prefs.settings, [])[0],
  duration: 1,
  elapsed: 2,
  model: null,
  evaluation: "off",
};
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  temporary.clear();
});
test("廃止した見本音声を起動時とバックアップ復元時に移行し、他の設定・録音を保持する", async () => {
  const s = await Store.open();
  const legacy = {
    ...initialPreferences(),
    settings: { ...prefs.settings, voice: "voicevox-ryusei", rate: 0.7 },
    sets: [
      {
        id: "old",
        name: "旧設定",
        settings: { ...prefs.settings, voice: "voicevox-ryusei" },
      },
      {
        id: "browser",
        name: "ブラウザ音声",
        settings: { ...prefs.settings, voice: "browser-voice" },
      },
    ],
    words: [{ id: "custom", text: "鞄", reading: "かばん" }],
  };
  // 旧版が保存した状態を、新しい保存処理を通さずに作る。
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("kotoba-drill", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("preferences", "readwrite");
    tx.objectStore("preferences").put(legacy, "current");
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  db.close();
  await s.putHistory(h);
  await s.saveRecording(h.id, new Blob(["recording"], { type: "audio/webm" }));
  const expected = {
    ...legacy,
    settings: { ...legacy.settings, voice: prefs.settings.voice },
    sets: [
      {
        ...legacy.sets[0],
        settings: { ...legacy.sets[0].settings, voice: prefs.settings.voice },
      },
      legacy.sets[1],
    ],
  };
  expect(await s.preferences()).toEqual(expected);
  const backup = await s.export(false);
  expect(backup.preferences).toEqual(expected);
  expect(backup.history).toEqual([h]);
  expect(await (await s.recording(h.id))?.text()).toBe("recording");
  await s.restore({
    ...backup,
    preferences: legacy,
    includesRecordings: true,
    recordings: [{ id: h.id, type: "audio/webm", data: btoa("recording") }],
  });
  expect((await s.export(false)).preferences).toEqual(expected);
  expect(await s.preferences()).toEqual(expected);
  expect(await s.history()).toEqual([h]);
  expect(await (await s.recording(h.id))?.text()).toBe("recording");
  expect(legacy.settings.voice).toBe("voicevox-ryusei");
  s.close();
});
test("保存・録音削除で履歴は残る・履歴削除は録音も削除", async () => {
  const s = await Store.open();
  await s.setPreferences(prefs);
  await s.putHistory(h);
  temporary.put(h.id, new Blob(["hello"], { type: "audio/webm" }));
  await s.saveRecording(h.id, temporary.get(h.id)!);
  expect(temporary.get(h.id)).toBeUndefined();
  await s.deleteRecording(h.id);
  expect((await s.history()).length).toBe(1);
  await s.saveRecording(h.id, new Blob(["hello"], { type: "audio/webm" }));
  temporary.put(h.id, new Blob(["temp"]));
  await s.deleteHistory([h.id]);
  expect(await s.history()).toEqual([]);
  expect((await s.saved()).size).toBe(0);
  expect(temporary.get(h.id)).toBeUndefined();
  s.close();
});
test("容量上限の新規保存を拒否し履歴を保全", async () => {
  const s = await Store.open();
  await s.putHistory(h);
  await expect(
    s.saveRecording(h.id, new Blob([new Uint8Array(SAVED_BYTES + 1)])),
  ).rejects.toThrow("500MB");
  expect((await s.history()).length).toBe(1);
  expect((await s.saved()).size).toBe(0);
  s.close();
});
test("音声なしバックアップ復元は全置換、設定・教材・履歴復元", async () => {
  const s = await Store.open();
  await s.putHistory(h);
  await s.saveRecording(h.id, new Blob(["old"], { type: "audio/webm" }));
  temporary.put(h.id, new Blob(["temp"]));
  const b: Backup = {
    format: "kotoba-drill",
    version: 1,
    preferences: {
      ...prefs,
      words: [{ id: "custom", text: "鞄", reading: "かばん" }],
    },
    history: [{ ...h, id: "new" }],
    includesRecordings: false,
    recordings: [],
  };
  await s.restore(b);
  expect((await s.saved()).size).toBe(0);
  expect(temporary.bytes).toBe(0);
  expect((await s.history())[0].id).toBe("new");
  expect((await s.preferences()).words[0].reading).toBe("かばん");
  s.close();
});
test("不正な復元や重複参照・未来バージョンは既存データを変更しない", async () => {
  const s = await Store.open();
  await s.putHistory(h);
  const valid: Backup = {
    format: "kotoba-drill",
    version: 1,
    preferences: prefs,
    history: [h],
    includesRecordings: true,
    recordings: [{ id: h.id, type: "audio/webm", data: btoa("voice") }],
  };
  expect(validateBackup(valid).get(h.id)?.size).toBe(5);
  await s.restore(valid);
  for (const bad of [
    { ...valid, version: 2 },
    { ...valid, history: [h, h] },
    { ...valid, recordings: [{ id: "orphan", type: "audio/webm", data: "?" }] },
    {
      ...valid,
      preferences: {
        ...prefs,
        settings: { ...prefs.settings, maxSeconds: Infinity },
      },
    },
  ]) {
    await expect(s.restore(bad as Backup)).rejects.toThrow();
    expect((await s.history())[0].id).toBe(h.id);
    expect((await s.saved()).size).toBe(1);
  }
  s.close();
});
test("削除後に遅延した認識結果が来ても履歴を再作成しない", async () => {
  const s = await Store.open();
  await s.putHistory(h);
  await s.deleteHistory([h.id]);
  await s.result(h.id, { recognized: "late", evaluation: "done" });
  expect(await s.history()).toEqual([]);
  s.close();
});

test("復元トランザクションが中断されても現在の設定・履歴・録音を保全", async () => {
  const { IDBDatabase } = await import("fake-indexeddb");
  const original = IDBDatabase.prototype.transaction;
  const s = await Store.open();
  await s.setPreferences(prefs);
  await s.putHistory(h);
  await s.saveRecording(h.id, new Blob(["keep"], { type: "audio/webm" }));
  IDBDatabase.prototype.transaction = function (
    ...args: Parameters<typeof original>
  ) {
    const tx = original.apply(this, args);
    if (args[1] === "readwrite") queueMicrotask(() => tx.abort());
    return tx;
  };
  try {
    await expect(
      s.restore({
        format: "kotoba-drill",
        version: 1,
        preferences: prefs,
        history: [],
        includesRecordings: false,
        recordings: [],
      }),
    ).rejects.toThrow();
  } finally {
    IDBDatabase.prototype.transaction = original;
  }
  expect((await s.history())[0].id).toBe(h.id);
  expect((await s.recording(h.id))?.size).toBe(4);
  expect(await s.preferences()).toEqual(prefs);
  s.close();
});

test("起動・復元後に再実行できない認識待ちは中断にする", async () => {
  const s = await Store.open();
  await s.putHistory({ ...h, evaluation: "pending" });
  const backup = await s.export(false);
  await s.interruptPending();
  expect((await s.history())[0]).toMatchObject({
    evaluation: "skipped",
    skipReason: "interrupted",
  });
  await s.restore(backup);
  expect((await s.history())[0]).toMatchObject({
    evaluation: "skipped",
    skipReason: "interrupted",
  });
  expect(backup.history[0].evaluation).toBe("pending");
  s.close();
});

test("ブラウザ認識の設定・エラー理由を復元し、不正な理由では既存データを保全", async () => {
  const s = await Store.open();
  await s.setPreferences({
    ...prefs,
    settings: { ...prefs.settings, model: "browser", evaluation: true },
  });
  await s.putHistory({
    ...h,
    model: "browser",
    evaluation: "error",
    recognitionMessage: "音声認識サービスへ接続できませんでした。",
  });
  const backup = await s.export(false);
  await s.restore(backup);
  expect((await s.preferences()).settings.model).toBe("browser");
  expect((await s.history())[0].recognitionMessage).toBe(
    "音声認識サービスへ接続できませんでした。",
  );
  for (const reason of [false, "あ".repeat(301)]) {
    const bad = structuredClone(backup);
    Object.assign(bad.history[0], { recognitionMessage: reason });
    await expect(s.restore(bad)).rejects.toThrow();
    expect((await s.history())[0].recognitionMessage).toBe(
      "音声認識サービスへ接続できませんでした。",
    );
  }
  s.close();
});

test("3回発声の履歴と旧1回発声を復元し、不正な繰り返し指定を拒否する", async () => {
  const store = await Store.open();
  await store.putHistory({ ...h, prompt: { ...h.prompt, repetitions: 3 } });
  await store.putHistory({
    ...h,
    id: "old",
    prompt: { ...h.prompt, repetitions: undefined },
  });
  const backup = await store.export(false);
  await store.restore(backup);
  const restored = await store.history();
  expect(restored.find((item) => item.id === h.id)?.prompt.repetitions).toBe(3);
  expect(
    restored.find((item) => item.id === "old")?.prompt.repetitions,
  ).toBeUndefined();
  for (const patch of [
    { repetitions: 2 },
    { repetitions: 1000 },
    { repetitions: "3" },
    { kind: "pair", repetitions: 3 },
  ]) {
    const bad = structuredClone(backup);
    Object.assign(bad.history[0].prompt, patch);
    expect(() => validateBackup(bad)).toThrow();
  }
  store.close();
});
