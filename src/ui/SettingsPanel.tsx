import { SoundPicker } from "./SoundPicker";
import { supportsRecordedSpeech } from "../models/browserSpeech";
import { RecognitionNotice } from "./RecognitionNotice";
import { VoiceOptions } from "./VoiceOptions";
import { recordedVoice, sampleSource } from "../audio/sampleVoices";
import { useState } from "react";
import type { Preferences, Settings } from "../core/types";
import { defaults } from "../core/types";
import { Modal } from "./Modal";
import {
  sampleText,
  candidates,
  builtIn,
  positionsFor,
  normalize,
} from "../core/materials";
import { models } from "../models/catalog";
interface Props {
  prefs: Preferences;
  voices: SpeechSynthesisVoice[];
  devices: MediaDeviceInfo[];
  onApply: (p: Preferences, options?: { keepOpen?: boolean }) => Promise<void>;
  onClose: () => void;
  onSample: (s: Settings) => void;
  audioNotice: string;
  onClearAudioNotice: () => void;
  samplePlaying: boolean;
  onCalibrate: (s: Settings) => Promise<number | undefined>;
  onLive: (s: Settings) => void;
  level: number;
}
export function SettingsPanel({
  prefs,
  voices,
  devices,
  onApply,
  onClose,
  onSample,
  audioNotice,
  onClearAudioNotice,
  samplePlaying,
  onCalibrate,
  onLive,
  level,
}: Props) {
  const [draft, setDraft] = useState(() => structuredClone(prefs));
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [reading, setReading] = useState("");
  const [editing, setEditing] = useState("");
  const [notice, setNotice] = useState("");
  const [audioStatus, setAudioStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const s = draft.settings;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({
      ...d,
      settings: {
        ...d.settings,
        [key]: value,
        ...(key === "model" && value === "cohere"
          ? { device: "webgpu" as const }
          : {}),
      },
    }));
  const select = <K extends keyof Settings>(
    label: string,
    key: K,
    options: [string, string][],
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={String(s[key])}
        onChange={(e) => set(key, e.target.value as Settings[K])}
      >
        {options.map(([v, l]) => (
          <option
            key={v}
            value={v}
            disabled={key === "device" && v === "wasm" && s.model === "cohere"}
          >
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  const number = (
    label: string,
    key: keyof Settings,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(s[key])}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </label>
  );
  const check = (label: string, key: keyof Settings) => (
    <label className="check">
      <input
        type="checkbox"
        checked={Boolean(s[key])}
        onChange={(e) => set(key, e.target.checked)}
      />
      {label}
    </label>
  );
  const toggle = (key: "sounds" | "vowels" | "positions", value: string) => {
    const arr = s[key] as string[];
    set(
      key,
      (arr.includes(value)
        ? arr.filter((x) => x !== value)
        : [...arr, value]) as never,
    );
  };
  async function apply() {
    setBusy(true);
    try {
      await onApply(draft);
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "設定を保存できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal label="設定・教材" onClose={busy || resetting ? undefined : onClose}>
      <section className="settings-dialog" aria-labelledby="settings-title">
        <div className="section-title">
          <h2 id="settings-title">練習の設定</h2>
          <button disabled={busy || resetting} onClick={onClose}>
            閉じる
          </button>
        </div>
        <p>
          設定を開いている間は練習を一時停止します。変更は「設定を適用」で反映し、閉じた後は「再開」で続けられます。音量・演出はすぐ反映します。
        </p>
        <button
          disabled={busy || resetting}
          onClick={() => setConfirmReset(true)}
        >
          設定を初期値に戻す
        </button>
        {confirmReset && (
          <Modal
            label="設定を初期値に戻しますか"
            alert
            onClose={resetting ? undefined : () => setConfirmReset(false)}
          >
            <h2>設定を初期値に戻しますか？</h2>
            <p className="reset-intro">
              練習・音声・画面の設定を初期化します。
            </p>
            <dl className="reset-summary">
              <div>
                <dt>練習</dt>
                <dd>か行の1音</dd>
              </div>
              <div>
                <dt>見本の声</dt>
                <dd>四国めたん</dd>
              </div>
              <div>
                <dt>録音</dt>
                <dd>自動・待ち時間なし</dd>
              </div>
              <div>
                <dt>音声認識</dt>
                <dd>オフ・方式はブラウザ標準</dd>
              </div>
            </dl>
            <div className="reset-kept">
              <strong>保存したデータは残ります</strong>
              <p>教材・練習セット・履歴・録音・モデルキャッシュ</p>
            </div>
            <p className="reset-note">未適用の変更は破棄されます。</p>
            <div className="row">
              <button
                disabled={resetting}
                onClick={() => setConfirmReset(false)}
              >
                キャンセル
              </button>
              <button
                className="primary"
                disabled={resetting}
                onClick={async () => {
                  setResetting(true);
                  try {
                    const resetPrefs = {
                      ...prefs,
                      settings: structuredClone(defaults),
                    };
                    await onApply(resetPrefs, { keepOpen: true });
                    setDraft(structuredClone(resetPrefs));
                    setName("");
                    setText("");
                    setReading("");
                    setEditing("");
                    setAudioStatus("");
                    onClearAudioNotice();
                    setNotice(
                      "設定を初期値に戻しました。続けて設定を変更できます。",
                    );
                    setConfirmReset(false);
                  } catch {
                    setConfirmReset(false);
                    setNotice(
                      "初期値を保存できませんでした。もう一度お試しください。",
                    );
                  } finally {
                    setResetting(false);
                  }
                }}
              >
                初期値に戻して適用
              </button>
            </div>
          </Modal>
        )}
        <fieldset>
          <legend>練習すること</legend>
          <div className="fields">
            {select("練習の種類", "kind", [
              [
                "single",
                s.evaluation ? "1音（同じ音を3回）" : "1音（1回発声）",
              ],
              ["pair", "2音（選んだ音＋母音）"],
              ["word", "単語"],
            ])}
            {check("ランダムに出題（一巡するまで重複なし）", "random")}
          </div>
          <p>対象音（複数選択）</p>
          <SoundPicker
            selected={s.sounds}
            onToggle={(sound) => toggle("sounds", sound)}
          />
          {s.kind === "pair" && (
            <>
              <p>
                つなげる母音（複数選択）。選んだ音の前・後・両方に置けます。
              </p>
              <div className="row">
                {["あ", "い", "う", "え", "お"].map((v) => (
                  <label className="check" key={v}>
                    <input
                      type="checkbox"
                      checked={s.vowels.includes(v)}
                      onChange={() => toggle("vowels", v)}
                    />
                    {v}
                  </label>
                ))}
              </div>
              {select("母音の位置", "pairOrder", [
                ["before", "母音が先"],
                ["after", "母音が後"],
                ["both", "両方"],
              ])}
            </>
          )}
          {s.kind === "word" && (
            <div className="row">
              {[
                ["start", "語頭"],
                ["middle", "語中"],
                ["end", "語尾"],
              ].map(([v, l]) => (
                <label className="check" key={v}>
                  <input
                    type="checkbox"
                    checked={(s.positions as string[]).includes(v)}
                    onChange={() => toggle("positions", v)}
                  />
                  {l}
                </label>
              ))}
            </div>
          )}
          <p>この条件のお題：{candidates(s, draft.words).length}件</p>
        </fieldset>
        <fieldset>
          <legend>見本と録音</legend>
          <div className="fields">
            {select("見本音声", "sample", [
              ["always", "毎回"],
              ["changed", "お題が変わったときだけ"],
              ["manual", "手動のみ"],
              ["off", "オフ"],
            ])}
            <label>
              日本語の声
              <select
                aria-label="日本語の声"
                value={s.voice}
                onChange={(e) => set("voice", e.target.value)}
              >
                <VoiceOptions voices={voices} />
              </select>
            </label>
            {number("読み上げ速度", "rate", 0.5, 2, 0.05)}
            {number("見本の後の待ち時間（ms）", "delay", 0, 5000, 100)}
            {number("無音で終了するまで（ms）", "silence", 200, 5000, 100)}
            {s.kind === "single" && s.evaluation && (
              <p className="muted">
                1音は3回まとめて録音します。発声の合間に切れないよう、無音で終了するまで最低1.1秒待ちます。
              </p>
            )}
            {number("録音上限（秒）", "maxSeconds", 1, 30)}
            <label>
              録音マイク
              <select
                value={s.microphone}
                onChange={(e) => set("microphone", e.target.value)}
              >
                <option value="">OSの既定</option>
                {devices
                  .filter((d) => d.kind === "audioinput")
                  .map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `マイク ${i + 1}`}
                    </option>
                  ))}
              </select>
            </label>
            {number(
              "発声検知の感度しきい値（低いほど敏感）",
              "threshold",
              0.001,
              0.5,
              0.001,
            )}
            {check("手動で録音開始・終了", "manual")}
            {check("毎回、自分の声を聞き返す", "playback")}
          </div>
          <p>
            VOICEVOX・Nemoは同梱の収録音声を再生します。未収録のお題は、利用可能な最初の日本語ブラウザ音声を使います。
            出力先はOSで選択します。オンライン音声はお題テキストを音声サービスへ送ります。録音の認識先は、下の「音声認識の方式」で選べます。
          </p>
          <div className="row">
            <button
              disabled={busy}
              onClick={() => {
                onClearAudioNotice();
                setAudioStatus("");
                onSample(s);
              }}
            >
              見本を試聴
            </button>
            {samplePlaying && (
              <p
                className="sample-text"
                role="status"
                aria-label="見本の再生状態"
              >
                見本で読むことば：<strong>{sampleText}</strong>
                <span>見本を再生中です</span>
                {recordedVoice(s.voice) && (
                  <span>{sampleSource(sampleText, s.voice)}</span>
                )}
              </p>
            )}
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                onClearAudioNotice();
                setAudioStatus("3秒間、声を出さず周囲の音を測ります。");
                try {
                  const n = await onCalibrate(s);
                  if (n !== undefined) {
                    set("threshold", n);
                    setAudioStatus(
                      "感度を調整しました。設定を適用してください。",
                    );
                  } else setAudioStatus("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              周囲の音で感度を調整
            </button>
            <meter aria-label="マイク入力" min={0} max={0.2} value={level} />
            <span>
              {level >= s.threshold
                ? "声を検知しています"
                : "声は検知していません"}
            </span>
          </div>
          {(audioNotice || audioStatus) && (
            <p role="status">{audioNotice || audioStatus}</p>
          )}
        </fieldset>
        <fieldset>
          <legend>認識と区切り</legend>
          {check("音声認識を使う（発音の採点ではありません）", "evaluation")}
          <p className="muted">
            1音は、音声認識オフなら1回、オンなら同じ音を3回発声します。
          </p>
          <details className="art-references">
            <summary>音声認識を使うとき、3回発声するのはなぜ？</summary>
            <p>
              短い1音では認識結果が返らないことがあるため、同じ音を3回続け、まとめて認識します。見本も3回流れます。2音・単語は1回のままです。
            </p>
          </details>
          <RecognitionNotice browser={s.model === "browser"} />
          {s.model === "browser" ? (
            <p>
              {supportsRecordedSpeech()
                ? "日本語で認識します。録音が終わってから音声を認識サービスへ渡すため、結果が届くまで時間がかかります。"
                : "このブラウザでは利用できません。PC版Chrome／Edge 135以降を使うか、端末内モデルを選んでください。"}
            </p>
          ) : (
            <p>
              モデルの取得は練習開始時に行います。初回は数分かかる場合があります。
            </p>
          )}
          <div className="fields">
            {select("音声認識の方式", "model", [
              ["browser", "ブラウザ標準（Web Speech API）"],
              ...models.map((m): [string, string] => [
                m.id,
                `${m.name}（端末内・概算 ${m.mb}MB）`,
              ]),
            ])}
            {s.model === "browser" ? (
              <label>
                認識の処理方式
                <select aria-label="認識の処理方式" disabled value="browser">
                  <option value="browser">ブラウザに任せる</option>
                </select>
              </label>
            ) : (
              select("認識の処理方式", "device", [
                ["wasm", "CPU / WASM"],
                ["webgpu", "GPU / WebGPU"],
              ])
            )}
            {select("練習の区切り", "limit", [
              ["none", "終了操作まで"],
              ["count", "発声回数"],
              ["minutes", "練習時間（分）"],
            ])}
            {s.limit !== "none" &&
              number(
                s.limit === "count" ? "区切りの回数" : "区切りの分数",
                "limitValue",
                1,
                1000,
              )}
          </div>
        </fieldset>
        <fieldset>
          <legend>見た目と反応</legend>
          <div className="fields">
            {select("テーマ", "theme", [
              ["system", "OSに合わせる"],
              ["light", "ライト"],
              ["dark", "ダーク"],
            ])}
            <label>
              音量
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={s.volume}
                onChange={(e) => {
                  const volume = Number(e.target.value);
                  set("volume", volume);
                  onLive({ ...s, volume });
                }}
              />
            </label>
            <label>
              演出の強さ
              <input
                type="range"
                min="0"
                max="1"
                step=".1"
                value={s.effect}
                onChange={(e) => {
                  const effect = Number(e.target.value);
                  set("effect", effect);
                  onLive({ ...s, effect });
                }}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={s.soundEffect}
                onChange={(e) => {
                  set("soundEffect", e.target.checked);
                  onLive({ ...s, soundEffect: e.target.checked });
                }}
              />
              発声完了の効果音
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>名前付き練習セット</legend>
          <div className="row">
            <input
              aria-label="練習セット名"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：朝のか行"
            />
            <button
              disabled={!name.trim()}
              onClick={() => {
                setDraft((d) => ({
                  ...d,
                  sets: [
                    ...d.sets,
                    {
                      id: crypto.randomUUID(),
                      name: name.trim(),
                      settings: structuredClone(s),
                    },
                  ],
                }));
                setName("");
              }}
            >
              セットを追加
            </button>
          </div>
          {draft.sets.map((p) => (
            <div className="row" key={p.id}>
              <span>{p.name}</span>
              <button
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    settings: structuredClone(p.settings),
                  }))
                }
              >
                設定に読み込む
              </button>
              <button
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    sets: d.sets.filter((x) => x.id !== p.id),
                  }))
                }
              >
                セットを削除
              </button>
            </div>
          ))}
        </fieldset>
        <fieldset>
          <legend>単語教材の追加・編集</legend>
          <div className="fields">
            <label>
              表記
              <input
                maxLength={100}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <label>
              読み（ひらがな）
              <input
                maxLength={100}
                value={reading}
                onChange={(e) => setReading(normalize(e.target.value))}
              />
            </label>
          </div>
          <p>
            {s.sounds
              .map(
                (x) =>
                  `${x}：${
                    positionsFor(reading, x)
                      .map(
                        (p) =>
                          ({ start: "語頭", middle: "語中", end: "語尾" })[p],
                      )
                      .join("・") || "なし"
                  }`,
              )
              .join(" ／ ")}
          </p>
          <button
            disabled={!text.trim() || !reading || !/^[ぁ-ゖー]+$/.test(reading)}
            onClick={() => {
              const id = editing || crypto.randomUUID();
              setDraft((d) => ({
                ...d,
                words: [
                  ...d.words.filter((w) => w.id !== id),
                  { id, text: text.trim(), reading },
                ],
              }));
              setText("");
              setReading("");
              setEditing("");
            }}
          >
            単語を{editing ? "更新" : "追加"}
          </button>
          <details>
            <summary>教材一覧を編集</summary>
            {[
              ...builtIn.filter((w) => !draft.words.some((c) => c.id === w.id)),
              ...draft.words,
            ].map((w) => (
              <div className="row" key={w.id}>
                <span>
                  {w.text}（{w.reading}）
                </span>
                <button
                  onClick={() => {
                    setEditing(w.id);
                    setText(w.text);
                    setReading(w.reading);
                  }}
                >
                  編集
                </button>
                {!w.id.startsWith("builtin-") && (
                  <button
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        words: d.words.filter((x) => x.id !== w.id),
                      }))
                    }
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </details>
        </fieldset>
        {notice && <p role="status">{notice}</p>}
        <div className="sticky-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => void apply()}
          >
            設定を適用
          </button>
          <button disabled={busy || resetting} onClick={onClose}>
            閉じる
          </button>
        </div>
      </section>
    </Modal>
  );
}
