import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { AudioSpectrum } from "../audio/spectrum";

export function SpectrumView({
  spectrum,
  voiced,
  contextKey,
  reading,
}: {
  spectrum: AudioSpectrum;
  voiced: boolean;
  contextKey: string;
  reading: string;
}) {
  const version = useSyncExternalStore(spectrum.subscribe, spectrum.getVersion);
  const source = spectrum.getSnapshot();
  const peaks = spectrum.getPeaks();
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    spectrum.setContext(contextKey, reading);
  }, [spectrum, contextKey, reading]);
  const labels = {
    idle:
      peaks.reference || peaks.recording
        ? "再生した範囲のピークを表示"
        : "音声待ち",
    sample: "見本音声",
    playback: "録音の再生",
    microphone: voiced ? "声を検知しています" : "声を待っています",
    browser: "ブラウザ読み上げ（解析対象外）",
    unavailable: "スペクトルを取得できません",
  };
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const active = ["sample", "playback", "microphone"].includes(source);
    let request = 0;
    let previous = -Infinity;
    const draw = (time: number) => {
      if (active) request = requestAnimationFrame(draw);
      if (time - previous < (reduced.matches ? 250 : 50)) return;
      previous = time;
      const width = element.clientWidth,
        height = 42;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      if (
        element.width !== Math.round(width * ratio) ||
        element.height !== height * ratio
      ) {
        element.width = Math.round(width * ratio);
        element.height = height * ratio;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const style = getComputedStyle(element);
      ctx.fillStyle = style.getPropertyValue("--line");
      ctx.fillRect(0, height - 1, width, 1);
      const frame = spectrum.read();
      const held = spectrum.getPeaks();
      const strength = (db: number) => Math.max(0, Math.min(1, (db + 90) / 90));
      // 現在の音は薄い棒。見本・録音の観測済みピークを線で残す。
      if (frame) {
        ctx.globalAlpha = held.reference || held.recording ? 0.25 : 1;
        ctx.fillStyle = style.color;
        frame.bands.forEach((db, i) => {
          const barHeight = strength(db) * (height - 2);
          ctx.fillRect(
            (i * width) / frame.bands.length,
            height - 1 - barHeight,
            Math.max(1, width / frame.bands.length - 2),
            barHeight,
          );
        });
        ctx.globalAlpha = 1;
      }
      for (const slot of ["reference", "recording"] as const) {
        const values = held[slot];
        if (!values) continue;
        ctx.beginPath();
        values.forEach((db, i) => {
          const x = ((i + 0.5) * width) / values.length;
          const y = height - 1 - strength(db) * (height - 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = style.getPropertyValue(
          slot === "reference" ? "--sample-ink" : "--playback-ink",
        );
        ctx.lineWidth = 1.8;
        ctx.setLineDash(slot === "recording" ? [4, 3] : []);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    };
    request = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(request);
  }, [spectrum, source, version]);
  return (
    <div
      className="spectrum-mini"
      data-source={source}
      data-reference={!!peaks.reference}
      data-recording={!!peaks.recording}
    >
      <canvas
        ref={canvas}
        role="img"
        title="左から右へ50Hz〜8kHz。見本は青の実線、録音は緑の破線。各帯域で再生中に観測した最大値を残します。録音の線は聞き返すと表示されます。声質・録音条件でも形が変わり、一致が発音の正しさを表すものではありません。"
        aria-label={`音のスペクトル：${labels[source]}。見本${peaks.reference ? "あり" : "なし"}、録音${peaks.recording ? "あり" : "なし"}。左から右へ50Hz〜8kHz、高さは相対レベル。実際の音圧ではありません。`}
      />
      <div className="spectrum-legend" aria-label="スペクトルの凡例">
        <span className="spectrum-reference" data-ready={!!peaks.reference}>
          見本
        </span>
        <span className="spectrum-recording" data-ready={!!peaks.recording}>
          録音
        </span>
        <span>ピーク</span>
      </div>
      <small>{labels[source]}</small>
    </div>
  );
}
