import { test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  builtIn,
  candidates,
  sounds,
  sampleText,
} from "../../src/core/materials";
import { defaults } from "../../src/core/types";
import {
  recordedFile,
  sampleSource,
  sampleVoices,
} from "../../src/audio/sampleVoices";
import { validatePreferences } from "../../src/storage/store";

test("全出題の収録音声が存在し、マニフェストと内容が一致する", () => {
  const folders = readdirSync("public/audio/samples", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  expect(folders).toEqual(sampleVoices.map((voice) => voice.id).sort());
  const readings = new Set([
    ...sounds,
    ...candidates({ ...defaults, sounds, kind: "pair" }, []).map(
      (p) => p.reading,
    ),
    ...builtIn.map((w) => w.reading),
    sampleText,
  ]);
  for (const voice of sampleVoices) {
    const folder = `public/audio/samples/${voice.id}`;
    const checksums = JSON.parse(
      readFileSync(`${folder}/checksums.json`, "utf8"),
    );
    expect(readdirSync(folder).filter((f) => f.endsWith(".ogg")).length).toBe(
      readings.size,
    );
    for (const reading of readings) {
      const file = recordedFile(reading, voice.id);
      expect(file).toBeDefined();
      const bytes = readFileSync(`public/${file}`);
      expect(bytes.subarray(0, 4).toString()).toBe("OggS");
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        checksums[file!.split("/").at(-1)!],
      );
    }
  }
}, 30_000);

test("未収録はブラウザ音声へ切り替え、古い声設定・バックアップも保持できる", () => {
  expect(recordedFile("未収録", "nemo-female-1")).toBeUndefined();
  expect(recordedFile("__proto__", "nemo-female-1")).toBeUndefined();
  expect(recordedFile("か", "browser-voice")).toBeUndefined();
  expect(recordedFile("か", "nemo-female-1")).not.toBe(
    recordedFile("か", "voicevox-metan"),
  );
  expect(sampleSource("ぴゃぴゃ", "voicevox-metan")).toContain("未収録");
  for (const voice of ["", "browser-voice", ...sampleVoices.map((v) => v.id)]) {
    const p = {
      version: 1,
      settings: { ...defaults, voice },
      sets: [],
      words: [],
      prepared: false,
    };
    expect(() => validatePreferences(p)).not.toThrow();
    expect(p.settings.voice).toBe(voice);
  }
});
