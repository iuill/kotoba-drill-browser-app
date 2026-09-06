import {
  sampleReadingOverrides,
  equivalentSampleReading,
} from "./sample-reading-overrides";
// 開発時のみ実行する。利用者の録音・追加教材は入力しない。
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { builtIn, candidates, sounds, sampleText } from "../src/core/materials";
import { defaults } from "../src/core/types";
import { sampleVoices } from "../src/audio/sampleVoices";
import { prepareSingleSample, singleSampleRecipe } from "./sample-timing";

const versions = { nemo: "0.24.0", voicevox: "0.25.2" };
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const output = "public/audio/samples";
const selected = process.env.SAMPLE_VOICES?.split(",");
if (selected?.some((id) => !sampleVoices.some((v) => v.id === id)))
  throw new Error("未知の声が指定されました。");
if (spawnSync(ffmpeg, ["-version"]).status !== 0)
  throw new Error("FFmpegを実行できません。");
const hash = (input: string | Buffer) =>
  createHash("sha256").update(input).digest("hex");
const katakana = (s: string) =>
  s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 96));

type Entry = {
  text: string;
  reading: string;
  kind: "single" | "pair" | "word" | "preview";
};
const entries = new Map<string, Entry>();
for (const kind of ["single", "pair"] as const)
  for (const p of candidates({ ...defaults, kind, sounds }, []))
    entries.set(p.reading, { text: p.reading, reading: p.reading, kind });
for (const word of builtIn)
  entries.set(word.reading, {
    text: sampleReadingOverrides[word.reading] ?? word.text,
    reading: word.reading,
    kind: "word",
  });
entries.set(sampleText, {
  text: sampleText,
  reading: sampleText,
  kind: "preview",
});
const files = Object.fromEntries(
  [...entries.keys()].map((reading) => [
    reading,
    hash(reading).slice(0, 20) + ".ogg",
  ]),
);
// 読みの変更に追従する一覧。並列生成でも同じ内容を原子的に置換する。
const manifest = "src/audio/sample-voices-manifest.json";
const manifestTemp = `${manifest}.${process.pid}.tmp`;
await writeFile(
  manifestTemp,
  JSON.stringify({ engineVersions: versions, files }, null, 2) + "\n",
);
await rename(manifestTemp, manifest);

for (const voice of sampleVoices.filter(
  (v) => !selected || selected.includes(v.id),
)) {
  const engine =
    (voice.engine === "nemo"
      ? process.env.NEMO_URL
      : process.env.VOICEVOX_URL) ??
    `http://127.0.0.1:${voice.engine === "nemo" ? 50121 : 50122}`;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(engine).hostname))
    throw new Error("ローカルの音声合成エンジンを指定してください。");
  async function api(
    path: string,
    params: Record<string, string> = {},
    body?: unknown,
  ) {
    const response = await fetch(
      `${engine}${path}?${new URLSearchParams(params)}`,
      {
        method: path === "/version" ? "GET" : "POST",
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok)
      throw new Error(`${path}: ${response.status} ${await response.text()}`);
    return response;
  }
  const version = await (await api("/version")).json();
  if (version !== versions[voice.engine])
    throw new Error(`エンジンの版が違います: ${version}`);
  const folder = `${output}/${voice.id}`;
  await mkdir(folder, { recursive: true });
  const queryFolder = `.local/sample-voices/${voice.id}`;
  await mkdir(queryFolder, { recursive: true });
  const hashes: Record<string, string> = {};
  let count = 0;
  for (const entry of entries.values()) {
    const file = files[entry.reading];
    const target = `${folder}/${file}`;
    const queryFile = `${queryFolder}/${file}.json`;
    // 「き／木」など、単語とも共有する音源を含めて1音を判定する。
    const isSingle = sounds.includes(entry.reading);
    const signature = hash(
      JSON.stringify({
        recipe: isSingle ? singleSampleRecipe : 1,
        version,
        voice,
        entry,
      }),
    );
    try {
      const previous = JSON.parse(await readFile(queryFile, "utf8"));
      const checksum = hash(await readFile(target));
      if (previous.signature === signature && previous.checksum === checksum) {
        hashes[file] = checksum;
        count++;
        continue;
      }
    } catch {
      /* 未生成・条件変更の場合は生成する。 */
    }
    const query = await (
      await api("/audio_query", {
        text: entry.text,
        speaker: String(voice.speaker),
      })
    ).json();
    // 助詞として「は→わ」等へ読み替えず、単音・無意味2音のモーラを指定する。
    if (entry.kind === "single" || entry.kind === "pair") {
      query.accent_phrases = await (
        await api("/accent_phrases", {
          text: katakana(entry.reading) + "'",
          speaker: String(voice.speaker),
          is_kana: "true",
        })
      ).json();
      const actual = query.accent_phrases
        .flatMap((p: { moras: { text: string }[] }) =>
          p.moras.map((m) => m.text),
        )
        .join("");
      if (actual !== katakana(entry.reading))
        throw new Error(`読みが一致しません: ${entry.reading}: ${actual}`);
    }
    if (entry.kind === "word") {
      const actual = query.accent_phrases
        .flatMap((p: { moras: { text: string }[] }) =>
          p.moras.map((m) => m.text),
        )
        .join("");
      if (!equivalentSampleReading(entry.reading, actual))
        throw new Error(
          `単語の読みが一致しません: ${entry.text} (${entry.reading}): ${actual}`,
        );
    }
    Object.assign(query, {
      speedScale: 1,
      volumeScale: 1,
      prePhonemeLength: 0.06,
      postPhonemeLength: 0.12,
      outputSamplingRate: 24000,
      outputStereo: false,
    });
    if (isSingle) prepareSingleSample(query);
    const wav = Buffer.from(
      await (
        await api(
          "/synthesis",
          {
            speaker: String(voice.speaker),
            enable_interrogative_upspeak: "false",
          },
          query,
        )
      ).arrayBuffer(),
    );
    const temp = `${target}.tmp.ogg`;
    const encoded = spawnSync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        "pipe:0",
        "-map_metadata",
        "-1",
        "-c:a",
        "libopus",
        "-b:a",
        "48k",
        "-vbr",
        "off",
        "-application",
        "voip",
        "-threads",
        "1",
        temp,
      ],
      { input: wav },
    );
    if (encoded.status !== 0) throw new Error(encoded.stderr.toString());
    await rename(temp, target);
    const checksum = hash(await readFile(target));
    hashes[file] = checksum;
    await writeFile(
      queryFile,
      JSON.stringify({ signature, checksum, query }) + "\n",
    );
    if (++count % 100 === 0)
      console.log(`${voice.id}: ${count} / ${entries.size}`);
  }
  await writeFile(
    `${folder}/checksums.json`,
    JSON.stringify(hashes, null, 2) + "\n",
  );
  console.log(`完了: ${voice.id} ${entries.size}件`);
}
