import { ArticulationContent } from "./ArticulationGuide";
import { useRef, useState } from "react";
import { soundGroups, sounds, candidates } from "../core/materials";
import type { Kind, Settings, Word } from "../core/types";
import { Modal } from "./Modal";
import { SoundPicker } from "./SoundPicker";

export function SoundWizard({
  initialSettings,
  words,
  kind,
  onApply,
  onClose,
}: {
  initialSettings: Settings;
  words: Word[];
  kind: Kind;
  onApply: (
    selection: Pick<
      Settings,
      "kind" | "sounds" | "vowels" | "pairOrder" | "positions"
    >,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const initialSounds = initialSettings.sounds;
  const [vowels, setVowels] = useState(initialSettings.vowels);
  const [pairOrder, setPairOrder] = useState(initialSettings.pairOrder);
  const [positions, setPositions] = useState(initialSettings.positions);
  const [selected, setSelected] = useState(() => [...initialSounds]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      soundGroups.map((group) => [
        group.name,
        group.rows.some((row) =>
          row.split(" ").some((s) => initialSounds.includes(s)),
        ),
      ]),
    ),
  );
  const [step, setStep] = useState<"sounds" | "pair" | "word" | "tips">(
    "sounds",
  );
  const tips = step === "tips";
  const label = { single: "1音", pair: "2音", word: "単語" }[kind];
  const wordExamples =
    kind === "word"
      ? candidates(
          { ...initialSettings, kind, sounds: selected, positions },
          words,
        )
      : [];
  const pairExamples =
    kind === "pair"
      ? candidates(
          { ...initialSettings, kind, sounds: selected, vowels, pairOrder },
          [],
        )
      : [];
  const [custom, setCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const changeView = (next: boolean) => {
    setCustom(next);
    heading.current?.focus();
  };
  const toggle = (items: string[]) => {
    setError("");
    setSelected((current) =>
      items.every((s) => current.includes(s))
        ? current.filter((s) => !items.includes(s))
        : [...new Set([...current, ...items])],
    );
  };
  const canApply =
    selected.length > 0 &&
    (kind !== "pair" || vowels.length > 0) &&
    (kind !== "word" || wordExamples.length > 0);
  const canSkipTips = !tips && (kind === "single" || step !== "sounds");
  const applySelection = async () => {
    if (savingRef.current || !canApply) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await onApply({
        kind,
        sounds: sounds.filter((s) => selected.includes(s)),
        vowels:
          kind !== "pair"
            ? initialSettings.vowels
            : ["あ", "い", "う", "え", "お"].filter((v) => vowels.includes(v)),
        pairOrder,
        positions,
      });
    } catch {
      setError(
        "設定を保存できませんでした。選択を残しているので、もう一度お試しください。",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const rowButtons = (group: (typeof soundGroups)[number]) => (
    <div
      className="sound-row-options"
      role="group"
      aria-label={`${group.name}の行`}
    >
      {group.rows.map((row) => {
        const items = row.split(" ").filter((s) => s !== "-");
        const wordCount =
          kind === "word"
            ? candidates(
                { ...initialSettings, kind, sounds: items, positions },
                words,
              ).length
            : 0;
        const count = items.filter((s) => selected.includes(s)).length;
        const label = group.columns === 3 ? items.join("・") : `${items[0]}行`;
        return (
          <button
            key={row}
            disabled={saving}
            aria-label={label}
            aria-pressed={
              count === items.length ? true : count > 0 ? "mixed" : false
            }
            onClick={() => toggle(items)}
          >
            <span>
              <strong>{label}</strong>
              <small>
                {count === items.length
                  ? "選択中"
                  : count
                    ? `${count}/${items.length}音`
                    : ""}
              </small>
            </span>
            {kind === "word" && (
              <span className="sound-row-word-count">単語 {wordCount}件</span>
            )}
            {group.columns !== 3 && (
              <span className="sound-row-example">{items.join("・")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
  return (
    <Modal
      label={`${label}の練習を選ぶ`}
      onClose={saving ? undefined : onClose}
    >
      <div className="sound-wizard">
        {kind === "single" && (
          <p className="muted">
            {initialSettings.evaluation
              ? "音声認識がオンのため、同じ音を続けて3回発声します。短い1音だけでは認識結果が返りにくいためです。見本も3回流れます。"
              : "選んだ音を1つずつ、1回発声します。見本も1回流れます。"}
          </p>
        )}
        <header className="sound-wizard-header">
          <div>
            <p className="eyebrow">
              {label}の練習 /{" "}
              {tips
                ? `${kind === "single" ? 2 : 3}. 発音のコツ`
                : step === "pair"
                  ? "2. 母音と順序"
                  : step === "word"
                    ? "2. 単語を確認"
                    : "1. 音を選ぶ"}
            </p>
            <h2 ref={heading} tabIndex={-1}>
              {tips
                ? "発音のコツ"
                : step === "pair"
                  ? "どの母音をつなげますか？"
                  : step === "word"
                    ? "練習する単語を確認"
                    : custom
                      ? "音を個別に選びましょう"
                      : "どの行を練習しますか？"}
            </h2>
          </div>
          <button
            disabled={saving}
            onClick={onClose}
            aria-label="音選びをキャンセル"
          >
            キャンセル
          </button>
        </header>
        <p className="sound-wizard-intro">
          {tips
            ? "選んだ音の図を切り替えて、舌や唇の動きを確認できます。"
            : step === "pair"
              ? "つなげる母音と順序を選び、出題の例を見てみましょう。"
              : step === "word"
                ? "選んだ音が入る位置を選ぶと、練習する単語が変わります。"
                : custom
                  ? "必要な音だけ残せます。複数の行にまたがっても大丈夫です。"
                  : "行を選ぶと、その行の音をまとめて練習できます。複数選べます。"}
        </p>
        {tips ? (
          <ArticulationContent
            items={sounds.filter(
              (s) =>
                selected.includes(s) || (kind === "pair" && vowels.includes(s)),
            )}
          />
        ) : step === "pair" ? (
          <div className="pair-setup">
            <div className="pair-vowels" role="group" aria-label="つなげる母音">
              {["あ", "い", "う", "え", "お"].map((v) => (
                <button
                  key={v}
                  aria-pressed={vowels.includes(v)}
                  onClick={() =>
                    setVowels((current) =>
                      current.includes(v)
                        ? current.filter((x) => x !== v)
                        : [...current, v],
                    )
                  }
                >
                  {v}
                </button>
              ))}
            </div>
            <fieldset className="pair-order">
              <legend>母音を置く位置</legend>
              {(
                [
                  ["before", "母音が先"],
                  ["after", "母音が後"],
                  ["both", "両方"],
                ] as const
              ).map(([value, text]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="wizard-pair-order"
                    checked={pairOrder === value}
                    onChange={() => setPairOrder(value)}
                  />
                  {text}
                </label>
              ))}
            </fieldset>
            <div className="pair-examples" role="status" aria-label="出題の例">
              <strong>
                {pairExamples.length
                  ? `出題の例（全${pairExamples.length}通り）`
                  : "つなげる母音を選んでください"}
              </strong>
              <p>
                {pairExamples.slice(0, 6).map((p, i) => (
                  <span className="pair-example" key={p.id}>
                    {i > 0 && "・"}
                    {p.reading}
                  </span>
                ))}
              </p>
            </div>
          </div>
        ) : step === "word" ? (
          <div className="word-setup">
            <fieldset className="pair-order">
              <legend>音の位置（複数選択）</legend>
              {(
                [
                  ["start", "語頭（はじめ）"],
                  ["middle", "語中（なか）"],
                  ["end", "語尾（おわり）"],
                ] as const
              ).map(([value, text]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={positions.includes(value)}
                    onChange={() =>
                      setPositions((current) =>
                        current.includes(value)
                          ? current.filter((p) => p !== value)
                          : [...current, value],
                      )
                    }
                  />
                  {text}
                </label>
              ))}
            </fieldset>
            <div className="pair-examples" role="status" aria-label="単語の例">
              <strong>
                {wordExamples.length
                  ? `練習する単語（全${wordExamples.length}件）`
                  : "この条件の単語がありません。音や位置を変えてください。"}
              </strong>
              <ul className="word-examples">
                {wordExamples.slice(0, 8).map((word) => (
                  <li key={word.id}>
                    <strong>{word.text}</strong>
                    <span>{word.reading}</span>
                  </li>
                ))}
              </ul>
              {wordExamples.length > 8 && (
                <small>ほか{wordExamples.length - 8}件</small>
              )}
            </div>
          </div>
        ) : custom ? (
          <>
            <button
              className="sound-customize"
              disabled={saving}
              onClick={() => changeView(false)}
            >
              ← 行ごとの選択に戻る
            </button>
            <SoundPicker
              selected={selected}
              disabled={saving}
              onToggle={(s) => toggle([s])}
            />
          </>
        ) : (
          <>
            {rowButtons(soundGroups[0])}
            {soundGroups.slice(1).map((group) => (
              <details
                key={group.name}
                open={expanded[group.name]}
                onToggle={(e) => {
                  const open = e.currentTarget.open;
                  setExpanded((current) =>
                    current[group.name] === open
                      ? current
                      : { ...current, [group.name]: open },
                  );
                }}
                className="sound-row-more"
              >
                <summary>{group.name}</summary>
                {rowButtons(group)}
              </details>
            ))}
            <button
              className="sound-customize"
              disabled={saving}
              onClick={() => changeView(true)}
            >
              カスタマイズ：音を個別に選ぶ
            </button>
          </>
        )}
        <footer className="sound-wizard-footer">
          <div className="sound-selection" role="status">
            <strong>
              {selected.length
                ? `${selected.length}音を選択中`
                : "練習する音を選んでください"}
            </strong>
            <span>{sounds.filter((s) => selected.includes(s)).join("・")}</span>
          </div>
          {error && <p role="alert">{error}</p>}
          {tips && kind === "pair" && (
            <p className="pair-summary">
              {pairOrder === "before"
                ? "母音が先"
                : pairOrder === "after"
                  ? "母音が後"
                  : "母音は前後両方"}
              ：
              {pairExamples
                .slice(0, 6)
                .map((p) => p.reading)
                .join("・")}
            </p>
          )}
          {tips && kind === "word" && (
            <p className="pair-summary">
              {wordExamples.length}件の単語：
              {wordExamples
                .slice(0, 5)
                .map((p) => p.text)
                .join("・")}
            </p>
          )}
          {step !== "sounds" && (
            <button
              disabled={saving}
              onClick={() => {
                setStep(tips && kind !== "single" ? kind : "sounds");
                heading.current?.focus();
              }}
            >
              {tips && kind === "pair"
                ? "← 母音の選択に戻る"
                : tips && kind === "word"
                  ? "← 単語の確認に戻る"
                  : "← 音選びに戻る"}
            </button>
          )}
          <button
            className="primary"
            disabled={
              saving ||
              !selected.length ||
              (step !== "sounds" && kind === "pair" && !vowels.length) ||
              (step !== "sounds" && kind === "word" && !wordExamples.length)
            }
            onClick={async () => {
              if (!tips) {
                setStep(step === "sounds" && kind !== "single" ? kind : "tips");
                heading.current?.focus();
                return;
              }
              await applySelection();
            }}
          >
            {saving
              ? "保存しています…"
              : tips
                ? "この音で練習する"
                : step === "sounds" && kind === "pair"
                  ? "次へ：母音と順序を選ぶ"
                  : step === "sounds" && kind === "word"
                    ? "次へ：単語を確認する"
                    : "次へ：発音のコツを見る"}
          </button>
          {canSkipTips && (
            <button
              disabled={saving || !canApply}
              onClick={() => void applySelection()}
            >
              {saving ? "保存しています…" : "この音で練習する"}
            </button>
          )}
          {(tips || canSkipTips) && (
            <small>
              設定を保存して練習画面へ。開始・再開は自分のタイミングで。
            </small>
          )}
        </footer>
      </div>
    </Modal>
  );
}
