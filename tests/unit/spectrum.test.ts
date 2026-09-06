import { expect, test } from "bun:test";
import { AudioSpectrum } from "../../src/audio/spectrum";

function tone() {
  const context = { sampleRate: 48000, state: "running" };
  let bin = 40,
    db = -10;
  const analyser = {
    context,
    fftSize: 4096,
    frequencyBinCount: 2048,
    getFloatFrequencyData(data: Float32Array) {
      data.fill(-Infinity);
      data[bin] = db;
    },
  } as unknown as AnalyserNode;
  return {
    analyser,
    context,
    change: (b: number, d: number) => {
      bin = b;
      db = d;
    },
  };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 65));

test("前の音声の遅れた終了は次の音声のスペクトルを消さない", async () => {
  const spectrum = new AudioSpectrum(),
    source = tone();
  const previous = spectrum.attach("sample", source.analyser);
  const current = spectrum.attach("microphone", source.analyser);
  try {
    previous();
    await tick();
    expect(spectrum.getSnapshot()).toBe("microphone");
    expect(spectrum.read()?.values[40]).toBe(-10);
    source.context.state = "closed";
    expect(spectrum.read()).toBeNull();
  } finally {
    current();
  }
  expect(spectrum.getSnapshot()).toBe("idle");
  spectrum.attach("browser");
  expect(spectrum.read()).toBeNull();
});

test("見本の各帯域のピークを保ち、別のインスタンスから聞き返す録音も重ねる", async () => {
  const spectrum = new AudioSpectrum(),
    source = tone();
  spectrum.setContext("prompt-1", "か");
  const scope = spectrum.beginReference("か");
  const stop = spectrum.attach("sample", source.analyser, scope);
  try {
    await tick();
    source.change(170, -20);
    await tick();
  } finally {
    stop();
  }
  const reference = spectrum.getPeaks().reference!;
  expect(Math.max(...reference)).toBe(-10);
  expect([...reference]).toContain(-20);
  const recordScope = spectrum.beginRecording();
  const blob = new Blob();
  spectrum.tagRecording(blob, recordScope);
  const replay = spectrum.attach(
    "playback",
    source.analyser,
    spectrum.playbackScope(blob),
  );
  try {
    await tick();
  } finally {
    replay();
  }
  expect(spectrum.getPeaks().reference).toBe(reference);
  expect(Math.max(...spectrum.getPeaks().recording!)).toBe(-20);
});

test("お題変更・無関係な試聴・次の録音へ前の比較を混ぜない", async () => {
  const spectrum = new AudioSpectrum(),
    source = tone();
  spectrum.setContext("first", "か");
  const reference = spectrum.attach(
    "sample",
    source.analyser,
    spectrum.beginReference("か"),
  );
  try {
    await tick();
  } finally {
    reference();
  }
  const oldBlob = new Blob();
  spectrum.tagRecording(oldBlob, spectrum.beginRecording());
  const live = spectrum.attach("microphone", source.analyser);
  try {
    await tick();
    expect(spectrum.getPeaks().reference).toBeNull();
  } finally {
    live();
  }
  expect(spectrum.getPeaks().reference).not.toBeNull();
  const replay = spectrum.attach(
    "playback",
    source.analyser,
    spectrum.playbackScope(oldBlob),
  );
  try {
    await tick();
    expect(spectrum.getPeaks().recording).not.toBeNull();
    spectrum.beginRecording();
    expect(spectrum.getPeaks().recording).toBeNull();
    spectrum.setContext("next", "き");
    await tick();
    expect(spectrum.getPeaks()).toEqual({ reference: null, recording: null });
  } finally {
    replay();
  }
  expect(spectrum.playbackScope(oldBlob)).toBeUndefined();
  expect(spectrum.beginReference("か")).toBeUndefined();
});
