import { useMemo } from "react";
import { candidates, promptReading } from "../core/materials";
import type { Kind, Preferences } from "../core/types";
import { recordedVoice } from "../audio/sampleVoices";

const modes = [
  { kind: "single", label: "1音", description: "ひとつの音を、ていねいに" },
  { kind: "pair", label: "2音", description: "選んだ音＋母音を、つなげて" },
  { kind: "word", label: "単語", description: "身近なことばで練習" },
] as const;

export function PracticeSetup({
  prefs,
  voices,
  busy,
  onMode,
  onVoice,
  onMaterials,
}: {
  prefs: Preferences;
  voices: SpeechSynthesisVoice[];
  busy: boolean;
  onMode: (kind: Kind) => void;
  onVoice: () => void;
  onMaterials: () => void;
}) {
  const examples = useMemo(
    () =>
      Object.fromEntries(
        modes.map(({ kind }) => {
          const prompts = candidates({ ...prefs.settings, kind }, prefs.words);
          return [
            kind,
            kind === "single" && prefs.settings.evaluation && prompts[0]
              ? promptReading(prompts[0], "・")
              : prompts
                  .slice(0, 3)
                  .map((p) => p.reading)
                  .join("・"),
          ];
        }),
      ),
    [prefs.settings, prefs.words],
  );
  const voice =
    recordedVoice(prefs.settings.voice)?.name.replace(/^VOICEVOX /, "") ??
    voices.find((v) => v.voiceURI === prefs.settings.voice)?.name ??
    "ブラウザの日本語音声";
  return (
    <section
      className="practice-setup"
      aria-label="練習の選び方"
      aria-busy={busy}
    >
      <div className="practice-setup-heading">
        <h2>今日はどんな練習にしますか？</h2>
        <span>どれも自由に切り替えられます</span>
      </div>
      <div className="practice-modes" role="group" aria-label="練習モード">
        {modes.map(({ kind, label, description }) => (
          <button
            key={kind}
            className="practice-mode"
            aria-label={`${label}で練習`}
            aria-describedby={`mode-${kind}-description mode-${kind}-example`}
            aria-pressed={prefs.settings.kind === kind}
            aria-haspopup="dialog"
            disabled={busy}
            onClick={() => onMode(kind)}
          >
            <strong>
              {label}
              <span aria-hidden="true">
                {prefs.settings.kind === kind ? "●" : "○"}
              </span>
            </strong>
            <span id={`mode-${kind}-description`}>
              {kind === "single" && prefs.settings.evaluation
                ? "音声認識に合わせて、同じ音を3回"
                : description}
            </span>
            {
              <span className="practice-mode-next">
                次に、あ行・か行などを選ぶ →
              </span>
            }
            <small id={`mode-${kind}-example`}>
              {examples[kind]
                ? `例：${examples[kind]}`
                : "今の対象音に合う教材がありません"}
            </small>
          </button>
        ))}
      </div>
      <div className="practice-options">
        <button className="practice-voice" onClick={onVoice} disabled={busy}>
          <span>
            見本の声・速さ{prefs.settings.sample === "off" && "（見本はオフ）"}
          </span>
          <strong>
            {voice}
            <small>{prefs.settings.rate.toFixed(2)}倍</small>
          </strong>
          <span className="practice-option-action">変更・試聴</span>
        </button>
        <div className="practice-targets">
          <span>
            対象音：{prefs.settings.sounds.slice(0, 8).join("・") || "未選択"}
            {prefs.settings.sounds.length > 8 &&
              ` ほか${prefs.settings.sounds.length - 8}音`}
          </span>
          <button onClick={onMaterials} disabled={busy}>
            対象音・教材を調整
          </button>
        </div>
      </div>
      <p className="practice-setup-hint">
        {!prefs.prepared
          ? "迷ったら「1音」から。見本を聞く → 声に出す → 自分の声を聞き返す、の順で進みます。"
          : "練習中に切り替えると一時停止します。準備ができたら「再開」を押してください。"}
      </p>
      {!examples[prefs.settings.kind] && (
        <p role="status">
          このモードのお題がありません。「対象音・教材を調整」で音や条件を変えられます。
        </p>
      )}
    </section>
  );
}
