import { defaults } from "../core/types";
import type { History, Preferences, Settings, Word } from "../core/types";
import { sounds } from "../core/materials";
import { models } from "../models/catalog";
export const TEMP_BYTES = 50 * 1024 * 1024,
  SAVED_BYTES = 500 * 1024 * 1024;
export class TemporaryRecordings {
  private blobs = new Map<string, Blob>();
  put(id: string, blob: Blob) {
    this.blobs.delete(id);
    this.blobs.set(id, blob);
    while (this.blobs.size > 20 || this.bytes > TEMP_BYTES)
      this.blobs.delete(this.blobs.keys().next().value!);
  }
  get bytes() {
    return [...this.blobs.values()].reduce((n, b) => n + b.size, 0);
  }
  get(id: string) {
    return this.blobs.get(id);
  }
  delete(id: string) {
    this.blobs.delete(id);
  }
  clear() {
    this.blobs.clear();
  }
}
export const temporary = new TemporaryRecordings();
export const initialPreferences = (): Preferences => ({
  version: 1,
  settings: structuredClone(defaults),
  sets: [],
  words: [],
  prepared: false,
});
function migrateRemovedVoice(p: Preferences): Preferences {
  const migrate = (s: Settings): Settings =>
    s.voice === "voicevox-ryusei" ? { ...s, voice: defaults.voice } : s;
  const settings = migrate(p.settings);
  const sets = p.sets.map((set) => {
    const settings = migrate(set.settings);
    return settings === set.settings ? set : { ...set, settings };
  });
  return settings === p.settings && sets.every((set, i) => set === p.sets[i])
    ? p
    : { ...p, settings, sets };
}
function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(tx.error ?? new Error("保存を完了できませんでした。"));
  });
}
export class Store {
  constructor(private db: IDBDatabase) {}
  static async open() {
    const r = indexedDB.open("kotoba-drill", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("preferences");
      r.result.createObjectStore("history", { keyPath: "id" });
      r.result.createObjectStore("recordings");
    };
    const db = await req(r);
    db.onversionchange = () => db.close();
    return new Store(db);
  }
  async preferences() {
    const p = await req(
      this.db
        .transaction("preferences")
        .objectStore("preferences")
        .get("current"),
    );
    if (!p) return initialPreferences();
    validatePreferences(p);
    const migrated = migrateRemovedVoice(p);
    if (migrated !== p) await this.setPreferences(migrated);
    return migrated;
  }
  async setPreferences(p: Preferences) {
    validatePreferences(p);
    const tx = this.db.transaction("preferences", "readwrite");
    const completion = done(tx);
    tx.objectStore("preferences").put(migrateRemovedVoice(p), "current");
    await completion;
  }
  async history() {
    return (
      (await req(
        this.db.transaction("history").objectStore("history").getAll(),
      )) as History[]
    ).sort((a, b) => b.date.localeCompare(a.date));
  }
  async interruptPending() {
    const tx = this.db.transaction("history", "readwrite");
    const completion = done(tx);
    const store = tx.objectStore("history");
    const entries = (await req(store.getAll())) as History[];
    for (const h of entries) {
      if (h.evaluation === "pending")
        store.put({ ...h, evaluation: "skipped", skipReason: "interrupted" });
    }
    await completion;
  }
  async putHistory(h: History) {
    const tx = this.db.transaction("history", "readwrite");
    const completion = done(tx);
    tx.objectStore("history").put(h);
    await completion;
  }
  async result(id: string, update: Partial<History>) {
    const tx = this.db.transaction("history", "readwrite");
    const completion = done(tx);
    const s = tx.objectStore("history");
    const h = await req(s.get(id));
    if (h) s.put({ ...h, ...update });
    await completion;
  }
  async recording(id: string) {
    return (await req(
      this.db.transaction("recordings").objectStore("recordings").get(id),
    )) as Blob | undefined;
  }
  async saved() {
    const tx = this.db.transaction("recordings");
    const keys = await req(tx.objectStore("recordings").getAllKeys());
    const blobs = await req(tx.objectStore("recordings").getAll());
    return new Map(keys.map((k, i) => [String(k), blobs[i] as Blob]));
  }
  async saveRecording(id: string, blob: Blob) {
    const tx = this.db.transaction(["recordings", "history"], "readwrite");
    const completion = done(tx);
    const s = tx.objectStore("recordings");
    const [all, old, h] = await Promise.all([
      req(s.getAll()),
      req(s.get(id)),
      req(tx.objectStore("history").get(id)),
    ]);
    if (!h) {
      await completion;
      throw new Error("履歴が見つかりません。");
    }
    if (
      all.reduce((n, b) => n + (b as Blob).size, 0) -
        (old?.size ?? 0) +
        blob.size >
      SAVED_BYTES
    ) {
      await completion;
      throw new Error(
        "保存上限500MBです。バックアップを書き出すか録音を削除してください。",
      );
    }
    s.put(blob, id);
    await completion;
    temporary.delete(id);
  }
  async deleteRecording(id: string) {
    const tx = this.db.transaction("recordings", "readwrite");
    const completion = done(tx);
    tx.objectStore("recordings").delete(id);
    await completion;
    temporary.delete(id);
  }
  async deleteHistory(ids: string[]) {
    const tx = this.db.transaction(["history", "recordings"], "readwrite");
    const completion = done(tx);
    for (const id of ids) {
      tx.objectStore("history").delete(id);
      tx.objectStore("recordings").delete(id);
    }
    await completion;
    ids.forEach((id) => temporary.delete(id));
  }
  async export(includeRecordings: boolean) {
    const tx = this.db.transaction(["preferences", "history", "recordings"]);
    const [p, h, keys, blobs] = await Promise.all([
      req(tx.objectStore("preferences").get("current")),
      req(tx.objectStore("history").getAll()),
      req(tx.objectStore("recordings").getAllKeys()),
      req(tx.objectStore("recordings").getAll()),
    ]);
    const recordings: Backup["recordings"] = [];
    if (includeRecordings)
      for (let i = 0; i < keys.length; i++)
        recordings.push({
          id: String(keys[i]),
          type: blobs[i].type,
          data: await blobBase64(blobs[i]),
        });
    return {
      format: "kotoba-drill",
      version: 1,
      preferences: p ?? initialPreferences(),
      history: h,
      includesRecordings: includeRecordings,
      recordings,
    } as Backup;
  }
  async restore(b: Backup) {
    const parsed = validateBackup(b);
    const tx = this.db.transaction(
      ["preferences", "history", "recordings"],
      "readwrite",
    );
    const completion = done(tx);
    for (const name of ["preferences", "history", "recordings"])
      tx.objectStore(name).clear();
    tx.objectStore("preferences").put(
      migrateRemovedVoice(b.preferences),
      "current",
    );
    b.history.forEach((h) =>
      tx
        .objectStore("history")
        .put(
          h.evaluation === "pending"
            ? { ...h, evaluation: "skipped", skipReason: "interrupted" }
            : h,
        ),
    );
    parsed.forEach((blob, id) => tx.objectStore("recordings").put(blob, id));
    await completion;
    temporary.clear();
  }
  close() {
    this.db.close();
  }
}
export interface Backup {
  format: "kotoba-drill";
  version: 1;
  preferences: Preferences;
  history: History[];
  includesRecordings: boolean;
  recordings: { id: string; type: string; data: string }[];
}
function fail(): never {
  throw new Error(
    "データ形式が不正、または未対応のバージョンです。現在のデータは置換していません。",
  );
}
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function str(v: unknown, max = 1000): v is string {
  return typeof v === "string" && v.length <= max;
}
function choices(v: unknown, list: string[]) {
  return typeof v === "string" && list.includes(v);
}
export function validateSettings(v: unknown): asserts v is Settings {
  if (!object(v)) fail();
  for (const [k, allowed] of Object.entries({
    kind: ["single", "pair", "word"],
    pairOrder: ["before", "after", "both"],
    sample: ["always", "changed", "manual", "off"],
    device: ["wasm", "webgpu"],
    limit: ["none", "count", "minutes"],
    theme: ["system", "light", "dark"],
    model: ["browser", ...models.map((model) => model.id)],
  }))
    if (!choices(v[k], allowed)) fail();
  for (const k of ["random", "playback", "manual", "evaluation", "soundEffect"])
    if (typeof v[k] !== "boolean") fail();
  for (const k of ["voice", "microphone"]) if (!str(v[k])) fail();
  for (const [k, min, max] of [
    ["rate", 0.5, 2],
    ["volume", 0, 1],
    ["delay", 0, 5000],
    ["silence", 200, 5000],
    ["threshold", 0.001, 0.5],
    ["maxSeconds", 1, 30],
    ["limitValue", 1, 1000],
    ["effect", 0, 1],
  ] as const)
    if (
      typeof v[k] !== "number" ||
      !Number.isFinite(v[k]) ||
      v[k] < min ||
      v[k] > max
    )
      fail();
  for (const [k, allowed] of [
    ["sounds", sounds],
    ["vowels", ["あ", "い", "う", "え", "お"]],
    ["positions", ["start", "middle", "end"]],
  ] as const)
    if (
      !Array.isArray(v[k]) ||
      !v[k].length ||
      v[k].length > 100 ||
      !v[k].every(
        (x) =>
          typeof x === "string" && (allowed as readonly string[]).includes(x),
      )
    )
      fail();
}
function validateWord(w: unknown): asserts w is Word {
  if (
    !object(w) ||
    !str(w.id, 100) ||
    !w.id ||
    !str(w.text, 100) ||
    !w.text ||
    !str(w.reading, 100) ||
    !w.reading ||
    !/^[ぁ-ゖー]+$/.test(w.reading)
  )
    fail();
}
export function validatePreferences(p: unknown): asserts p is Preferences {
  if (
    !object(p) ||
    p.version !== 1 ||
    typeof p.prepared !== "boolean" ||
    !Array.isArray(p.words) ||
    !Array.isArray(p.sets)
  )
    fail();
  validateSettings(p.settings);
  p.words.forEach(validateWord);
  if (new Set(p.words.map((w) => w.id)).size !== p.words.length) fail();
  for (const s of p.sets) {
    if (!object(s) || !str(s.id, 100) || !str(s.name, 100)) fail();
    validateSettings(s.settings);
  }
}
export function validateBackup(input: unknown): Map<string, Blob> {
  if (
    !object(input) ||
    input.format !== "kotoba-drill" ||
    input.version !== 1 ||
    !Array.isArray(input.history) ||
    !Array.isArray(input.recordings) ||
    typeof input.includesRecordings !== "boolean"
  )
    fail();
  validatePreferences(input.preferences);
  const ids = new Set<string>();
  for (const h of input.history) {
    if (
      !object(h) ||
      !str(h.id, 100) ||
      ids.has(h.id) ||
      !str(h.session, 100) ||
      !str(h.date) ||
      !Number.isFinite(Date.parse(h.date)) ||
      !object(h.prompt) ||
      !choices(h.prompt.kind, ["single", "pair", "word"]) ||
      !Array.isArray(h.prompt.sounds) ||
      !h.prompt.sounds.every((x) => sounds.includes(x)) ||
      (h.prompt.repetitions !== undefined &&
        !(h.prompt.kind === "single" && h.prompt.repetitions === 3)) ||
      !choices(h.evaluation, ["off", "pending", "done", "skipped", "error"]) ||
      !(h.model === null || str(h.model, 100)) ||
      typeof h.duration !== "number" ||
      !Number.isFinite(h.duration) ||
      h.duration < 0 ||
      typeof h.elapsed !== "number" ||
      !Number.isFinite(h.elapsed) ||
      h.elapsed < 0
    )
      fail();
    validateWord(h.prompt);
    if (h.recognitionMessage !== undefined && !str(h.recognitionMessage, 300))
      fail();
    if (h.recognized !== undefined && !str(h.recognized, 10000)) fail();
    if (
      h.skipReason !== undefined &&
      !choices(h.skipReason, ["backlog", "interrupted"])
    )
      fail();
    if (
      h.comparison !== undefined &&
      !choices(h.comparison, ["match", "different", "unknown"])
    )
      fail();
    ids.add(h.id);
  }
  const blobs = new Map<string, Blob>();
  let total = 0;
  for (const r of input.recordings) {
    if (
      !object(r) ||
      !str(r.id, 100) ||
      !ids.has(r.id) ||
      blobs.has(r.id) ||
      !str(r.type, 100) ||
      !/^audio\/(webm|ogg|wav|mp4)(;.*)?$/.test(r.type) ||
      typeof r.data !== "string" ||
      !input.includesRecordings
    )
      fail();
    let raw: string;
    try {
      raw = atob(r.data);
    } catch {
      fail();
    }
    total += raw.length;
    if (total > SAVED_BYTES) fail();
    blobs.set(
      r.id,
      new Blob([Uint8Array.from(raw, (c) => c.charCodeAt(0))], {
        type: r.type,
      }),
    );
  }
  return blobs;
}
function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
export function downloadBackup(b: Backup) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(b)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `kotoba-drill-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
