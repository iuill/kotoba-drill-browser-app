import { useId, useState } from "react";
import {
  articulation,
  specialHint,
  vowels,
  vowelSource,
} from "../content/articulation";
import { sounds, units } from "../core/materials";
import { Modal } from "./Modal";
import { MouthDiagram } from "./MouthDiagram";
import { PhoneticsGuide } from "./PhoneticsGuide";

export function ArticulationContent({
  items,
  initialSound,
  targetSounds,
}: {
  items: string[];
  initialSound?: string;
  targetSounds?: string[];
}) {
  const pickerId = useId();
  const [selected, setSelected] = useState(
    Math.max(0, items.indexOf(initialSound ?? "")),
  );
  const [release, setRelease] = useState(false);
  const [otherSound, setOtherSound] = useState<string>();
  const [basicsOpen, setBasicsOpen] = useState(false);
  const sound = otherSound ?? items[selected] ?? "";
  const targets = sounds.filter((s) => targetSounds?.includes(s));
  const guide = articulation(sound);
  const source =
    guide?.source ??
    `https://www.coelang.tufs.ac.jp/ja/en/pmod/practical/${sound === "っ" ? "02-01-01" : sound === "ー" ? "02-02-01" : "02-03-01"}.php`;
  return (
    <div className="art-guide">
      <button
        className="phonetics-entry"
        aria-haspopup="dialog"
        onClick={() => setBasicsOpen(true)}
      >
        <span aria-hidden="true">📖</span>
        <span>
          <strong>発音のしくみガイド</strong>
          <small>舌・息・声の違いを、図で見て比べる</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
      {basicsOpen && <PhoneticsGuide onClose={() => setBasicsOpen(false)} />}

      {targets.length > 0 && (
        <div className="art-target-picker">
          <div className="art-target-field">
            <label htmlFor={pickerId}>練習対象の音</label>
            <select
              id={pickerId}
              value={targets.includes(sound) ? sound : ""}
              onChange={(e) => {
                const next = e.target.value;
                const index = items.indexOf(next);
                setSelected(index);
                setOtherSound(index < 0 ? next : undefined);
                setRelease(false);
              }}
            >
              <option value="" disabled>
                音を選ぶ
              </option>
              {targets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <small>
            他の対象音のコツも見られます。練習のお題は変わりません。
          </small>
        </div>
      )}
      {items.length > 1 && (
        <div className="art-sounds" role="group" aria-label="コツを見る音">
          {targetSounds && <small>このお題の音</small>}
          {items.map((s, i) => (
            <button
              key={i}
              aria-label={`${i + 1}音目：${s}`}
              aria-pressed={otherSound === undefined && selected === i}
              onClick={() => {
                setSelected(i);
                setOtherSound(undefined);
                setRelease(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="art-heading">
        <strong>{sound}</strong>
        <p>
          {guide
            ? release
              ? vowels[guide.vowel].position
              : guide.position
            : specialHint(sound)}
        </p>
      </div>
      {guide && (
        <>
          {guide.manner !== "vowel" && (
            <div className="art-steps" role="group" aria-label="口の動きの段階">
              <button aria-pressed={!release} onClick={() => setRelease(false)}>
                1. 音の出だし
              </button>
              <button aria-pressed={release} onClick={() => setRelease(true)}>
                2. 「{guide.vowel}」へつなぐ
              </button>
            </div>
          )}
          <MouthDiagram guide={guide} release={release} />
          <div className="art-tip">
            <span>息と動き</span>
            <p>
              {release
                ? "出だしから区切らず、母音へつなげます。"
                : guide.breath}
            </p>
          </div>
          <p className="art-small">
            {guide.palatal
              ? `「${sound}」は一拍。舌の前のほうも上げ、途中に「い」を挟まずつなぎます。図は主な閉鎖・狭めの位置の目安です。`
              : guide.tip}
          </p>
        </>
      )}
      <details className="art-references">
        <summary>図の見方・参考資料</summary>
        <p>
          色のついた部分は舌、丸印は触れる・近づける場所、矢印は息の出口です。図は位置関係を簡略化した目安です。個人差があり、認識結果から舌の位置を判定するものではありません。
        </p>
        <p>
          図と説明はこのアプリ用に作成しました。参考資料の画像・音声は転載していません。
        </p>
        <a href={source} target="_blank" rel="noreferrer">
          {source.includes("jpf.go.jp")
            ? "国際交流基金：音声学の解説"
            : "東京外国語大学：日本語発音モジュール（英語）"}
        </a>
        {guide && (
          <p>
            <a href={vowelSource} target="_blank" rel="noreferrer">
              東京外国語大学：母音の解説（英語）
            </a>
          </p>
        )}
      </details>
    </div>
  );
}

export function ArticulationGuide({
  reading,
  initialSound,
  targetSounds,
  onClose,
}: {
  reading: string;
  initialSound?: string;
  targetSounds?: string[];
  onClose: () => void;
}) {
  return (
    <Modal label="発音のコツ" onClose={onClose}>
      <header className="art-header">
        <div>
          <p className="eyebrow">口の動きを見てみよう</p>
          <h2>発音のコツ</h2>
        </div>
        <button onClick={onClose} aria-label="発音のコツを閉じる">
          閉じる
        </button>
      </header>
      <ArticulationContent
        items={units(reading)}
        initialSound={initialSound}
        targetSounds={targetSounds}
      />
      <p className="art-footer">
        閉じたあと、準備ができたら練習を開始・再開してください。
      </p>
    </Modal>
  );
}
