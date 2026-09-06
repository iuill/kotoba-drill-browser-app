import { SoundWizard } from "./ui/SoundWizard";
import { RecognitionNotice } from "./ui/RecognitionNotice";
import { ArticulationGuide } from "./ui/ArticulationGuide";
import { PhoneticsGuide } from "./ui/PhoneticsGuide";
import { PracticeSetup } from "./ui/PracticeSetup";
import { PracticeRecognition } from "./ui/PracticeRecognition";
import { SpectrumView } from "./ui/SpectrumView";
import { VoiceOptions } from "./ui/VoiceOptions";
import { recordedVoice, sampleSource } from "./audio/sampleVoices";
import { Modal } from "./ui/Modal";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { BrowserAudio, japaneseVoices } from "./audio/browserAudio";
import { Engine } from "./core/engine";
import { units, sampleText, promptReading } from "./core/materials";
import type { Kind, Preferences, Settings } from "./core/types";
import { SelectableRecognizer } from "./models/selectableRecognizer";
import { cacheSizes, deleteModel, models } from "./models/catalog";
import { Store, temporary, validatePreferences } from "./storage/store";
import { SettingsPanel } from "./ui/SettingsPanel";
import { HistoryPanel, evaluationText } from "./ui/HistoryPanel";
interface Runtime {
  store: Store;
  engine: Engine;
  audio: BrowserAudio;
  prefs: Preferences;
}
export function App() {
  const [runtime, setRuntime] = useState<Runtime | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let current: Runtime | undefined;
    void (async () => {
      const store = await Store.open();
      try {
        const prefs = await store.preferences();
        await store.interruptPending();
        const audio = new BrowserAudio();
        const engine = new Engine(
          audio,
          new SelectableRecognizer(),
          store,
          prefs,
        );
        current = { store, engine, audio, prefs };
        if (alive) setRuntime(current);
        else {
          engine.dispose();
          store.close();
        }
      } catch (e) {
        store.close();
        throw e;
      }
    })().catch(() => {
      if (alive)
        setError(
          "ブラウザの保存領域を開けませんでした。既存データは変更していません。サイトデータを消さずに、空き容量やブラウザ設定を確認してください。",
        );
    });
    return () => {
      alive = false;
      current?.engine.dispose();
      current?.store.close();
    };
  }, []);
  if (error)
    return (
      <main>
        <h1>ことばドリル</h1>
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>再試行</button>
      </main>
    );
  if (!runtime)
    return (
      <main>
        <h1>ことばドリル</h1>
        <p role="status">保存データを読み込んでいます…</p>
      </main>
    );
  return <Drill runtime={runtime} />;
}
function Drill({
  runtime: { store, engine, audio, prefs: initial },
}: {
  runtime: Runtime;
}) {
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const modelProgress =
    state.phase === "preparing"
      ? (/^モデル取得中 (\d+)%(?:｜(.*))?$/.exec(state.message) ?? undefined)
      : undefined;
  const phaseLabel = {
    idle: ["○", "準備"],
    preparing: ["◷", "準備中"],
    sample: ["▶", "見本を聞く"],
    delay: ["◷", "待機中"],
    waiting: ["◎", "録音受付中"],
    recording: ["◎", "録音受付中"],
    playback: ["↻", "自分の声を聞く"],
    paused: ["Ⅱ", "一時停止"],
    boundary: ["✓", "ひと区切り"],
    review: ["✓", "練習終了"],
  }[state.phase];
  const [prefs, setPrefs] = useState(initial),
    [panel, setPanel] = useState<"settings" | "history" | "models" | null>(
      null,
    ),
    [notice, setNotice] = useState(""),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [level, setLevel] = useState(0),
    [cache, setCache] = useState(new Map<string, number>()),
    [refresh, setRefresh] = useState(0),
    [checking, setChecking] = useState(false),
    [calibrationRemaining, setCalibrationRemaining] = useState<number | null>(
      null,
    ),
    [checkDialog, setCheckDialog] = useState(false),
    [samplePlaying, setSamplePlaying] = useState(false),
    [samplePreparing, setSamplePreparing] = useState(false),
    [sampleWithMicrophone, setSampleWithMicrophone] = useState(true),
    [sampleSettings, setSampleSettings] = useState<Pick<
      Settings,
      "voice" | "rate"
    > | null>(null),
    [savingSample, setSavingSample] = useState(false),
    [showPreparation, setShowPreparation] = useState(false),
    [checkPhase, setCheckPhase] = useState<
      "idle" | "calibrating" | "waiting" | "recording" | "playing"
    >("idle"),
    [checkReady, setCheckReady] = useState(false);
  const [guideReading, setGuideReading] = useState<{
    reading: string;
    initialSound?: string;
  } | null>(null);
  const [phoneticsOpen, setPhoneticsOpen] = useState(false);
  const [soundWizard, setSoundWizard] = useState<Kind | null>(null);
  const [savingQuick, setSavingQuick] = useState(false);
  const quickSaving = useRef(false);
  const preview = useRef(new AbortController()),
    testBlob = useRef<Blob | null>(null),
    diagnostic = useRef("none");
  const previewAudio = useRef(new BrowserAudio(audio.spectrum, false));
  const checkStage =
    checkPhase === "calibrating"
      ? 1
      : checkPhase === "waiting" || checkPhase === "recording"
        ? 2
        : checkReady
          ? 3
          : 0;
  const checkTitle =
    checkPhase === "calibrating"
      ? "静かにお待ちください"
      : checkPhase === "waiting"
        ? "声を出してください"
        : checkPhase === "recording"
          ? "録音中です"
          : checkReady
            ? "録音が終わりました"
            : "まずは手順を確認";
  const report = (text: string) => {
    diagnostic.current = "operation_failed";
    setNotice(text);
  };
  const cancelPreview = () => {
    preview.current.abort();
    preview.current = new AbortController();
    previewAudio.current.stop();
    setChecking(false);
    setCalibrationRemaining(null);
    setSamplePlaying(false);
    setSamplePreparing(false);
    setCheckPhase("idle");
    setLevel(0);
  };
  const closeSampleDialog = () => {
    cancelPreview();
    setNotice("");
    setSampleSettings(null);
  };
  const closeCheckDialog = () => {
    cancelPreview();
    setNotice("");
    setCheckDialog(false);
  };
  const finishPractice = () => {
    engine.end();
    setPanel("history");
    setRefresh((n) => n + 1);
  };
  const control = (action: "primary" | "back" | "next" | "repeat") => {
    if (quickSaving.current) return;
    cancelPreview();
    if (action === "primary") {
      if (["idle", "review"].includes(engine.getSnapshot().phase)) {
        setPanel(null);
        setNotice("");
        void engine.start(prefs);
      } else engine.togglePause();
    } else if (action === "back") engine.back();
    else if (action === "next") engine.next();
    else engine.toggleRepeat();
  };
  useEffect(() => {
    const update = () => setVoices(japaneseVoices());
    update();
    globalThis.speechSynthesis?.addEventListener("voiceschanged", update);
    void navigator.mediaDevices
      ?.enumerateDevices()
      .then(setDevices)
      .catch(() => {});
    return () =>
      globalThis.speechSynthesis?.removeEventListener("voiceschanged", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.settings.theme;
  }, [prefs.settings.theme]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        cancelPreview();
        if (
          !["idle", "review", "boundary"].includes(engine.getSnapshot().phase)
        )
          engine.pause("別のタブへ移動したため一時停止しました。");
      }
    };
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        el.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"],[role="alertdialog"]',
        ) ||
        panel ||
        guideReading ||
        phoneticsOpen ||
        soundWizard ||
        !prefs.prepared ||
        showPreparation
      )
        return;
      const button = el.closest("button");
      // キーボードで選んだボタンのSpaceは、そのボタンの標準操作を保つ。
      if (button && (e.code === "Space" || !button.closest(".practice-card")))
        return;
      if (e.code === "Space") {
        e.preventDefault();
        control("primary");
      } else if (e.code === "KeyR") {
        e.preventDefault();
        control("repeat");
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        control("back");
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        control("next");
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("keydown", key);
    };
  }, [
    engine,
    panel,
    prefs,
    showPreparation,
    guideReading,
    phoneticsOpen,
    soundWizard,
  ]);
  useEffect(
    () => () => {
      preview.current.abort();
      previewAudio.current.stop();
      testBlob.current = null;
    },
    [],
  );
  const handle = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        report(e instanceof Error ? e.message : "操作を完了できませんでした。");
    }
  };
  const apply = async (p: Preferences, options?: { keepOpen?: boolean }) => {
    validatePreferences(p);
    await store.setPreferences(p);
    cancelPreview();
    await engine.apply(p);
    setPrefs(p);
    if (!options?.keepOpen) setPanel(null);
    setNotice("設定を適用しました。再開ボタンで始められます。");
  };
  const changeMode = (kind: Kind) => {
    if (quickSaving.current) return;
    cancelPreview();
    engine.pause("練習する音を選ぶため一時停止しました。");
    setSoundWizard(kind);
  };
  const sample = (s: Settings, withMicrophone = true) => {
    engine.pause();
    cancelPreview();
    const signal = preview.current.signal;
    setSamplePreparing(withMicrophone);
    void handle(async () => {
      try {
        if (withMicrophone)
          await previewAudio.current.prepareCapture(s, signal);
        signal.throwIfAborted();
        setSamplePreparing(false);
        setSamplePlaying(true);
        await previewAudio.current.speak(sampleText, s, signal);
      } finally {
        if (preview.current.signal === signal) {
          previewAudio.current.stop();
          setSamplePlaying(false);
          setSamplePreparing(false);
        }
      }
    });
  };
  const play = (blob: Blob) => {
    engine.pause();
    cancelPreview();
    void handle(() =>
      previewAudio.current.play(blob, prefs.settings, preview.current.signal),
    );
  };
  const calibrate = async (s: Settings) => {
    engine.pause();
    cancelPreview();
    try {
      const threshold = await previewAudio.current.calibrate(
        s.microphone,
        preview.current.signal,
        setLevel,
      );
      setDevices(await navigator.mediaDevices.enumerateDevices());
      return threshold;
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        report(
          "マイクを測定できませんでした。マイクの許可と接続を確認してください。",
        );
      return undefined;
    }
  };
  const openPanel = (next: typeof panel) => {
    cancelPreview();
    if (next) engine.pause();
    setPanel(next);
    setRefresh((n) => n + 1);
    if (next) setNotice("");
    if (next === "models") {
      void handle(async () => setCache(await cacheSizes()));
    }
  };
  const start = () => {
    control("primary");
  };
  const markPrepared = () =>
    void handle(async () => {
      cancelPreview();
      const p = { ...prefs, prepared: true };
      await store.setPreferences(p);
      engine.updateThreshold(p.settings.threshold);
      setPrefs(p);
      setShowPreparation(false);
    });
  const phaseActive = ![
    "idle",
    "paused",
    "review",
    "boundary",
    "preparing",
  ].includes(state.phase);
  return (
    <>
      <header className="app-header">
        <a href="#practice" className="brand">
          <span aria-hidden="true">こ</span>
          <div>
            ことばドリル<small>日本語の発音練習</small>
          </div>
        </a>
        <nav aria-label="メニュー">
          <button
            aria-expanded={!prefs.prepared || showPreparation}
            onClick={() => {
              cancelPreview();
              engine.pause("スピーカー・マイク確認のため一時停止しました。");
              setPanel(null);
              setShowPreparation(true);
              window.scrollTo({ top: 0 });
            }}
          >
            <span className="menu-icon" aria-hidden="true">
              🔊
            </span>
            スピーカー・マイク確認
          </button>
          <button
            aria-haspopup="dialog"
            aria-expanded={panel === "settings"}
            onClick={() => openPanel(panel === "settings" ? null : "settings")}
          >
            <span className="menu-icon" aria-hidden="true">
              ⚙️
            </span>
            設定・教材
          </button>
          <button
            aria-haspopup="dialog"
            aria-expanded={panel === "history"}
            onClick={() => openPanel(panel === "history" ? null : "history")}
          >
            <span className="menu-icon" aria-hidden="true">
              🕘
            </span>
            履歴
          </button>
          <button
            aria-haspopup="dialog"
            aria-expanded={panel === "models"}
            onClick={() => openPanel(panel === "models" ? null : "models")}
          >
            <span className="menu-icon" aria-hidden="true">
              📦
            </span>
            モデル管理
          </button>
        </nav>
      </header>
      <main
        id="practice"
        data-effects={prefs.settings.effect === 0 ? "off" : "on"}
        style={{ "--effect": prefs.settings.effect } as CSSProperties}
      >
        {sampleSettings && (
          <Modal
            label="見本の声と速さ"
            onClose={savingSample ? undefined : closeSampleDialog}
          >
            <h2>見本の声と速さ</h2>
            <p>声と速さを変えて、聞き取りやすい設定を選んでください。</p>
            {notice && <p role="status">{notice}</p>}
            <div className="fields">
              <label>
                日本語の声
                <select
                  aria-label="日本語の声"
                  value={sampleSettings.voice}
                  disabled={savingSample}
                  onChange={(e) => {
                    cancelPreview();
                    setSampleSettings({
                      ...sampleSettings,
                      voice: e.target.value,
                    });
                  }}
                >
                  <VoiceOptions voices={voices} />
                </select>
              </label>
              <label>
                読み上げ速度：{sampleSettings.rate.toFixed(2)}倍
                <input
                  aria-label="読み上げ速度"
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={sampleSettings.rate}
                  disabled={savingSample}
                  onChange={(e) => {
                    cancelPreview();
                    setSampleSettings({
                      ...sampleSettings,
                      rate: Number(e.target.value),
                    });
                  }}
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={sampleWithMicrophone}
                disabled={savingSample}
                onChange={(e) => {
                  cancelPreview();
                  setSampleWithMicrophone(e.target.checked);
                }}
              />
              練習と同じ条件で試聴（マイクを使用）
            </label>
            <p>
              Bluetooth機器では、マイク使用中に聞こえ方が変わることがあります。オフにするとマイクを使わず比較できます。
            </p>
            <p>
              試聴では録音ファイルを作りません。オンラインの声では、見本のことばが音声サービスへ送られます。
            </p>
            {recordedVoice(sampleSettings.voice) && (
              <p className="sample-source">
                {sampleSource(sampleText, sampleSettings.voice)}
                。未収録のお題はブラウザ音声を使います。
              </p>
            )}
            <p className="sample-text">
              見本で読むことば：<strong>{sampleText}</strong>
              <span role="status">
                {samplePreparing
                  ? "マイクを準備しています…"
                  : samplePlaying
                    ? "見本を再生中です"
                    : "停止中です。「この声と速さで試聴」で再生できます。"}
              </span>
            </p>
            {notice && <p role="status">{notice}</p>}
            <div className="row">
              <button
                disabled={savingSample}
                onClick={() => {
                  setNotice("");
                  sample(
                    { ...prefs.settings, ...sampleSettings },
                    sampleWithMicrophone,
                  );
                }}
              >
                この声と速さで試聴
              </button>
              <button
                disabled={!samplePlaying && !samplePreparing}
                onClick={cancelPreview}
              >
                試聴を停止
              </button>
              <button
                className="primary"
                disabled={savingSample}
                onClick={() =>
                  void handle(async () => {
                    setSavingSample(true);
                    try {
                      await apply({
                        ...prefs,
                        settings: { ...prefs.settings, ...sampleSettings },
                      });
                      setSampleSettings(null);
                    } finally {
                      setSavingSample(false);
                    }
                  })
                }
              >
                この設定で使う
              </button>
              <button disabled={savingSample} onClick={closeSampleDialog}>
                閉じる
              </button>
            </div>
          </Modal>
        )}
        {(!prefs.prepared || showPreparation) && (
          <section className="panel onboarding">
            <p className="eyebrow">
              {prefs.prepared ? "スピーカー・マイクの確認" : "はじめの準備"}
            </p>
            <h1>聞いて、声に出して、聞き返す。</h1>
            <p>
              出力先はOSで、録音マイクは設定で選べます。まず音の聞こえ方を確かめましょう。練習は下の「1音・2音・単語」から選べます。モデル取得は後回しにできます。
            </p>
            <div className="row">
              <button
                onClick={() => {
                  setSampleSettings({
                    voice: prefs.settings.voice,
                    rate: prefs.settings.rate,
                  });
                  setNotice("");
                  sample(prefs.settings, sampleWithMicrophone);
                }}
              >
                1. 見本を試聴
              </button>
              <button
                onClick={() => {
                  cancelPreview();
                  setNotice("");
                  setCheckDialog(true);
                }}
              >
                2. マイクを調整して録音・再生
              </button>
            </div>
            {samplePlaying && !sampleSettings && (
              <p
                className="sample-text"
                role="status"
                aria-label="見本の再生状態"
              >
                見本で読むことば：<strong>{sampleText}</strong>
                <span>見本を再生中です</span>
              </p>
            )}
            {notice && !checkDialog && <p role="status">{notice}</p>}
            {checkDialog && (
              <Modal label="マイクの調整と録音確認" onClose={closeCheckDialog}>
                <h2>マイクの調整と録音確認</h2>
                <ol className="check-steps" aria-label="音声確認の手順">
                  {["説明", "3秒待機", "録音", "録音終了"].map(
                    (label, index) => (
                      <li
                        key={label}
                        aria-current={checkStage === index ? "step" : undefined}
                      >
                        <span>{index + 1}</span>
                        {label}
                      </li>
                    ),
                  )}
                </ol>
                <div className="check-stage" data-stage={checkStage}>
                  <h3 className="check-stage-title">
                    <span aria-hidden="true" className="check-stage-icon">
                      {["i", "◷", "●", "✓"][checkStage]}
                    </span>
                    {checkTitle}
                  </h3>
                  {checkStage === 0 && (
                    <>
                      <p>
                        「調整を始める」を押したら、最初の3秒は声を出さず静かにしてください。
                      </p>
                      <p>
                        その後、「発声待ち」と表示されたら話してください。録音が終わると、自分の声を再生します。
                      </p>
                    </>
                  )}
                  <p role="status" aria-label="音声確認の状態">
                    {notice ||
                      "準備ができたら「調整を始める」を押してください。"}
                  </p>
                  {checkPhase === "calibrating" && (
                    <div className="calibration-progress">
                      <p
                        className="calibration-count"
                        role="status"
                        aria-label="マイク調整の進捗"
                      >
                        {calibrationRemaining === null
                          ? "マイクを準備しています…"
                          : calibrationRemaining > 0
                            ? `静かにしてください：あと${Math.ceil(calibrationRemaining / 1000)}秒`
                            : "測定完了。録音を準備しています…"}
                      </p>
                      <progress
                        max={3000}
                        value={
                          calibrationRemaining === null
                            ? undefined
                            : 3000 - calibrationRemaining
                        }
                        aria-label="周囲音の測定"
                      />
                    </div>
                  )}
                  {checkPhase === "waiting" && (
                    <p className="calibration-count" role="status">
                      測定が終わりました。声を出してください。
                    </p>
                  )}
                  {checking && checkPhase !== "playing" && (
                    <meter
                      min={0}
                      max={0.2}
                      value={level}
                      aria-label="準備中のマイク入力"
                    />
                  )}
                </div>
                <div className="row">
                  {!checking && (
                    <button
                      className={checkReady ? undefined : "primary"}
                      onClick={() =>
                        void handle(async () => {
                          cancelPreview();
                          const signal = preview.current.signal;
                          setChecking(true);
                          setCheckPhase("calibrating");
                          setCheckReady(false);
                          testBlob.current = null;
                          setNotice(
                            "3秒間、周囲の音を測ります。静かにしてください。",
                          );
                          try {
                            const threshold =
                              await previewAudio.current.calibrate(
                                prefs.settings.microphone,
                                signal,
                                setLevel,
                                setCalibrationRemaining,
                              );
                            const p = {
                              ...prefs,
                              settings: { ...prefs.settings, threshold },
                            };
                            await store.setPreferences(p);
                            signal.throwIfAborted();
                            setPrefs(p);
                            engine.updateThreshold(threshold);
                            setDevices(
                              await navigator.mediaDevices.enumerateDevices(),
                            );
                            signal.throwIfAborted();
                            setCheckPhase("waiting");
                            setNotice(
                              "発声待ちです。声を出してください。反応しない場合は「手動で録音開始」を押せます（待機は最大30秒）。",
                            );
                            const result = await previewAudio.current.capture(
                              { ...p.settings, manual: false, maxSeconds: 10 },
                              signal,
                              (n) => setLevel(n),
                              () => {
                                setCheckPhase("recording");
                                setNotice(
                                  "録音中です。無音で自動終了します（最大10秒）。「録音を終了して聞く」でも終了できます。",
                                );
                              },
                            );
                            testBlob.current = result.blob;
                            setCheckReady(true);
                            setCheckPhase("playing");
                            setNotice(
                              "録音した自分の声を再生中です。マイクの録音は終了しています。",
                            );
                            await previewAudio.current.play(
                              result.blob,
                              p.settings,
                              signal,
                            );
                            setNotice(
                              "録音を再生しました。聞こえ方を確認してください。",
                            );
                          } finally {
                            if (preview.current.signal === signal) {
                              setChecking(false);
                              setCheckPhase("idle");
                              setLevel(0);
                            }
                          }
                        })
                      }
                    >
                      調整を始める
                    </button>
                  )}
                  {checkReady && !checking && (
                    <button
                      className="primary"
                      onClick={() => {
                        if (testBlob.current) play(testBlob.current);
                      }}
                    >
                      録音した自分の声をもう一度聞く
                    </button>
                  )}
                  {(checkPhase === "waiting" || checkPhase === "recording") && (
                    <button onClick={() => previewAudio.current.finish()}>
                      {checkPhase === "waiting"
                        ? "手動で録音開始"
                        : "録音を終了して聞く"}
                    </button>
                  )}
                  {checking && (
                    <button
                      onClick={() => {
                        cancelPreview();
                        setNotice(
                          "音声確認を中止しました。「調整を始める」でやり直せます。",
                        );
                      }}
                    >
                      音声確認を中止
                    </button>
                  )}

                  <button onClick={closeCheckDialog}>閉じる</button>
                </div>
              </Modal>
            )}
            <div className="row">
              <button
                className="primary"
                disabled={savingQuick}
                onClick={markPrepared}
              >
                {prefs.prepared ? "確認を終えて練習に戻る" : "練習へ進む"}
              </button>
              <span>
                上部の「スピーカー・マイク確認」から、聞こえ方と録音をいつでも確かめられます。
              </span>
            </div>
          </section>
        )}
        <PracticeSetup
          prefs={prefs}
          voices={voices}
          busy={savingQuick || savingSample}
          onMode={changeMode}
          onVoice={() => {
            cancelPreview();
            engine.pause("声と速さを選ぶため一時停止しました。");
            setNotice("");
            setSampleSettings({
              voice: prefs.settings.voice,
              rate: prefs.settings.rate,
            });
          }}
          onMaterials={() => openPanel("settings")}
        />
        {notice && !panel && prefs.prepared && !showPreparation && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button aria-label="お知らせを閉じる" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {soundWizard && (
          <SoundWizard
            initialSettings={prefs.settings}
            words={prefs.words}
            kind={soundWizard}
            onClose={() => setSoundWizard(null)}
            onApply={async (selection) => {
              quickSaving.current = true;
              setSavingQuick(true);
              try {
                await apply({
                  ...prefs,
                  settings: { ...prefs.settings, ...selection },
                });
                setSoundWizard(null);
                setNotice(
                  "練習する音を設定しました。準備ができたら始めましょう。",
                );
              } finally {
                quickSaving.current = false;
                setSavingQuick(false);
              }
            }}
          />
        )}
        {guideReading && (
          <ArticulationGuide
            {...guideReading}
            targetSounds={prefs.settings.sounds}
            onClose={() => setGuideReading(null)}
          />
        )}
        {phoneticsOpen && (
          <PhoneticsGuide onClose={() => setPhoneticsOpen(false)} />
        )}
        <section
          className="practice-card"
          tabIndex={-1}
          onClick={(e) => {
            if (
              e.detail > 0 &&
              (e.target as HTMLElement).closest("button") &&
              !(e.target as HTMLElement).closest(
                '[role="dialog"],[role="alertdialog"]',
              )
            ) {
              e.currentTarget.focus({ preventScroll: true });
            }
          }}
          data-phase={state.phase}
          aria-label="発音練習"
          style={{ "--effect": prefs.settings.effect } as CSSProperties}
        >
          <div className="practice-top">
            <span className="eyebrow">
              {
                { single: "1音", pair: "2音（選んだ音＋母音）", word: "単語" }[
                  prefs.settings.kind
                ]
              }
            </span>
            <span>
              {state.count}回{" "}
              <span className="muted">
                ／ {Math.floor(state.elapsed / 60)}分
                {Math.floor(state.elapsed % 60)}秒
              </span>
            </span>
            <div
              className="practice-guides"
              role="group"
              aria-label="発音のガイド"
            >
              <button
                className="practice-help"
                aria-haspopup="dialog"
                disabled={savingQuick || state.phase === "boundary"}
                onClick={(e) => {
                  e.stopPropagation();
                  const prompt = engine.getSnapshot().prompt;
                  cancelPreview();
                  engine.pause(
                    "発音のコツを確認中です。同じお題から再開できます。",
                  );
                  setGuideReading({
                    reading:
                      prompt?.reading ?? prefs.settings.sounds[0] ?? "あ",
                    initialSound:
                      prompt &&
                      units(prompt.reading).find((sound) =>
                        prompt.sounds.includes(sound),
                      ),
                  });
                }}
              >
                <span aria-hidden="true">💡</span> 発音のコツ
              </button>
              <button
                className="practice-help"
                aria-haspopup="dialog"
                disabled={savingQuick || state.phase === "boundary"}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelPreview();
                  engine.pause(
                    "発音のしくみガイドを確認中です。同じお題から再開できます。",
                  );
                  setPhoneticsOpen(true);
                }}
              >
                <span aria-hidden="true">📖</span> 発音のしくみガイド
              </button>
            </div>
          </div>
          <div className="practice-scene">
            <div className="phase" role="status" aria-live="polite">
              <div className="phase-badge">
                <span aria-hidden="true" />
                {(state.phase === "waiting" || state.phase === "recording") && (
                  <b className="phase-rec" aria-hidden="true">
                    REC
                  </b>
                )}
                <span className="phase-name">{phaseLabel[1]}</span>
              </div>
            </div>
            <div className="prompt-stage">
              {prefs.settings.effect > 0 &&
                state.prompt &&
                ["sample", "playback", "waiting", "recording"].includes(
                  state.phase,
                ) && (
                  <div
                    className="direction-waves"
                    data-direction={
                      state.phase === "sample" || state.phase === "playback"
                        ? "out"
                        : "in"
                    }
                    aria-hidden="true"
                  >
                    <span className="direction-particle" />
                    <span className="direction-particle" />
                  </div>
                )}
              <h1
                className={
                  state.prompt
                    ? `prompt${state.prompt.repetitions === 3 ? " prompt-repeated" : ""}`
                    : "practice-welcome"
                }
                style={
                  {
                    "--reading-length": state.prompt
                      ? promptReading(state.prompt).length
                      : 1,
                  } as CSSProperties
                }
              >
                {state.prompt
                  ? units(promptReading(state.prompt)).map((u, i) => (
                      <span
                        key={i}
                        className={
                          state.prompt?.sounds.includes(u) ? "target" : ""
                        }
                      >
                        {u}
                      </span>
                    ))
                  : "練習をはじめましょう"}
              </h1>
              <p className="orthography">
                {state.prompt?.repetitions === 3
                  ? "同じ音を続けて3回"
                  : state.prompt && state.prompt.text !== state.prompt.reading
                    ? state.prompt.text
                    : ""}
              </p>
            </div>
            <p className="practice-instruction" role="status">
              {state.phase === "recording" ? (
                prefs.settings.manual ? (
                  state.prompt?.repetitions === 3 ? (
                    "3回話したら「録音終了」を押してください"
                  ) : (
                    "声を出してください。終わったら「録音終了」を押してください"
                  )
                ) : state.prompt?.repetitions === 3 ? (
                  "短く間をあけて、同じ音を3回"
                ) : (
                  "あなたの番。声を出してください"
                )
              ) : modelProgress !== undefined ? (
                <span className="model-progress">
                  <span>モデル取得中</span>{" "}
                  <span className="model-progress-value">
                    {modelProgress[1]}%
                  </span>
                  {modelProgress[2] && (
                    <span className="model-progress-estimate">
                      {modelProgress[2]}（目安）
                    </span>
                  )}
                </span>
              ) : (
                state.message
              )}
            </p>
            <p className="sample-source" aria-label="見本の音声">
              {state.prompt &&
              recordedVoice(prefs.settings.voice) &&
              prefs.settings.sample !== "off"
                ? sampleSource(state.prompt.reading, prefs.settings.voice)
                : ""}
            </p>
            <div className="meter-line">
              <SpectrumView
                spectrum={audio.spectrum}
                voiced={state.voiced}
                reading={state.prompt?.reading ?? ""}
                contextKey={JSON.stringify([
                  state.session,
                  state.prompt?.id,
                  state.prompt?.reading,
                  state.prompt?.repetitions,
                  prefs.settings.voice,
                  prefs.settings.rate,
                  prefs.settings.volume,
                  prefs.settings.sample,
                  prefs.settings.microphone,
                ])}
              />
              <meter
                className="accessible-meter"
                aria-label="声の大きさ"
                min={0}
                max={0.2}
                value={state.level}
              />
            </div>
          </div>
          {prefs.settings.evaluation && (
            <PracticeRecognition
              recent={state.recent}
              canRetry={(id) => !savingQuick && engine.canRetry(id)}
              onRetry={(id) => {
                cancelPreview();
                engine.retry(id);
              }}
            />
          )}
          <div className="controls">
            {["idle", "review"].includes(state.phase) ? (
              <button
                className="primary"
                disabled={!prefs.prepared || savingQuick}
                onClick={start}
              >
                {state.phase === "review"
                  ? "新しい練習を始める"
                  : "練習を始める"}
              </button>
            ) : (
              <button
                className="primary"
                disabled={state.phase === "boundary" || savingQuick}
                onClick={() => {
                  control("primary");
                }}
              >
                {phaseActive || state.phase === "preparing"
                  ? "一時停止"
                  : "再開"}
              </button>
            )}
            <button
              disabled={
                !state.session ||
                state.phase === "idle" ||
                !state.prompt ||
                state.phase === "boundary" ||
                state.phase === "review"
              }
              onClick={() => {
                control("back");
              }}
            >
              ← ひとつ戻る
            </button>
            <button
              aria-pressed={state.repeat}
              disabled={
                !state.session ||
                !state.prompt ||
                state.phase === "idle" ||
                state.phase === "review"
              }
              onClick={() => control("repeat")}
            >
              繰り返し {state.repeat ? "オン" : "オフ"}
            </button>
            <button
              disabled={
                !state.session ||
                state.phase === "idle" ||
                !state.prompt ||
                state.phase === "boundary" ||
                state.phase === "review"
              }
              onClick={() => {
                control("next");
              }}
            >
              次へ →
            </button>
          </div>
          <div className="row secondary-controls">
            <button
              disabled={
                !state.prompt ||
                prefs.settings.sample === "off" ||
                state.phase === "boundary" ||
                state.phase === "review"
              }
              onClick={() => {
                cancelPreview();
                void engine.sample();
              }}
            >
              見本を聞く
            </button>
            {prefs.settings.manual &&
              ["waiting", "recording"].includes(state.phase) && (
                <button
                  className="primary"
                  onClick={() => engine.finishRecording()}
                >
                  {state.phase === "waiting" ? "録音開始" : "録音終了"}
                </button>
              )}
            <button
              disabled={!state.prompt || state.phase === "review"}
              onClick={() => {
                cancelPreview();
                engine.end();
                setPanel("history");
                setRefresh((n) => n + 1);
              }}
            >
              終了して振り返る
            </button>
          </div>
          {state.phase === "paused" && prefs.settings.evaluation && (
            <div className="row">
              <button onClick={() => void engine.resume()}>再試行</button>
              <button
                onClick={() =>
                  void handle(async () => {
                    const p = {
                      ...prefs,
                      settings: { ...prefs.settings, evaluation: false },
                    };
                    await store.setPreferences(p);
                    setPrefs(p);
                    await engine.withoutEvaluation();
                  })
                }
              >
                評価なしで練習
              </button>
            </div>
          )}
          <p className="keyboard">
            Space 一時停止・再開　 R 繰り返し　 ← 戻る　 → 次へ
          </p>
          {state.phase === "boundary" && (
            <Modal label="練習の区切り" onClose={finishPractice}>
              <h2>ひと区切り、おつかれさまでした。</h2>
              <p>{state.count}回、声に出して練習しました。</p>
              <div className="row">
                <button className="primary" onClick={() => engine.continue()}>
                  あと{prefs.settings.limitValue}
                  {prefs.settings.limit === "minutes" ? "分" : "回"}続ける
                </button>
                <button onClick={finishPractice}>終了する</button>
              </div>
            </Modal>
          )}
        </section>
        <section className="recent" aria-label="直近の発声">
          <div className="section-title">
            <h2>声に出した記録</h2>
            <small>一致は発音の正確さを保証しません。</small>
          </div>
          {!state.recent.length && (
            <p className="muted">
              発声すると、ここにお題と聞き取り結果が並びます。
            </p>
          )}
          <div className="recent-grid">
            {state.recent.slice(0, 4).map((h) => (
              <article
                key={h.id}
                className={`result ${h.comparison === "match" ? "matched" : ""}`}
              >
                <strong>{promptReading(h.prompt, "・")}</strong>
                <p>{evaluationText(h)}</p>
                <small>
                  {new Date(h.date).toLocaleTimeString("ja-JP")}
                  ・取り組みを記録しました
                </small>
                {temporary.get(h.id) && (
                  <div className="row">
                    <button onClick={() => play(temporary.get(h.id)!)}>
                      聞き返す
                    </button>
                    <button
                      onClick={() =>
                        void handle(async () => {
                          await store.saveRecording(h.id, temporary.get(h.id)!);
                          setRefresh((n) => n + 1);
                          setNotice(
                            "録音を保存しました。履歴から聞き比べられます。",
                          );
                        })
                      }
                    >
                      保存
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
        {panel === "settings" && (
          <SettingsPanel
            prefs={prefs}
            voices={voices}
            devices={devices}
            onApply={apply}
            onClose={() => {
              cancelPreview();
              setPanel(null);
            }}
            onSample={sample}
            audioNotice={notice}
            onClearAudioNotice={() => setNotice("")}
            samplePlaying={samplePlaying}
            onCalibrate={calibrate}
            level={level}
            onLive={(s) => {
              engine.live(s.volume, s.effect, s.soundEffect);
              const p = {
                ...prefs,
                settings: {
                  ...prefs.settings,
                  volume: s.volume,
                  effect: s.effect,
                  soundEffect: s.soundEffect,
                },
              };
              setPrefs(p);
              void handle(() => store.setPreferences(p));
            }}
          />
        )}
        {panel === "history" && (
          <HistoryPanel
            store={store}
            notice={notice}
            refreshKey={
              refresh +
              state.recent.filter((h) => h.evaluation !== "pending").length
            }
            onClose={() => {
              cancelPreview();
              setPanel(null);
            }}
            onPlay={play}
            report={report}
            onRestore={async () => {
              const p = await store.preferences();
              setPrefs(p);
              await engine.apply(p);
              setNotice("バックアップを復元しました。");
            }}
            onBeforeRestore={() => {
              cancelPreview();
              engine.reset();
            }}
            onDeleted={(ids) => engine.forget(ids)}
          />
        )}
        {panel === "models" && (
          <Modal label="モデル管理" onClose={() => setPanel(null)}>
            <section className="models-dialog" aria-labelledby="models-title">
              <div className="section-title">
                <h2 id="models-title">モデル管理</h2>
                <button onClick={() => setPanel(null)}>閉じる</button>
              </div>
              <p>
                Whisperなどのモデルは、録音した声を端末内で認識します。取得した音声認識モデルはブラウザに保存（キャッシュ）し、再取得を減らします。ブラウザによって削除される場合があります。
              </p>
              <article className="history-row">
                <div>
                  <h3>ブラウザ標準（Web Speech API）</h3>
                  <p>
                    「設定・教材」で選べます。APIキー・アプリ側のモデル取得は不要です。録音音声がブラウザの認識サービスへ送信される場合があります。録音音声の入力に対応するPC版Chrome／Edge
                    135以降が対象です。
                  </p>
                </div>
              </article>
              <RecognitionNotice />
              {notice && (
                <p className="notice" role="status">
                  {notice}
                </p>
              )}
              {models.map((m) => (
                <article key={m.id} className="history-row">
                  <div>
                    <h3>{m.name}</h3>
                    <p>{m.description}</p>
                    <small>
                      初回取得目安 {m.mb}MB・保存済み{" "}
                      {((cache.get(m.id) ?? 0) / 1024 / 1024).toFixed(1)}MB
                    </small>
                    <p>
                      <a
                        href={`https://huggingface.co/${m.repo}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        配布元・モデル情報
                      </a>
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      void handle(async () => {
                        engine.end();
                        await deleteModel(m.id);
                        setCache(await cacheSizes());
                        setNotice(`${m.name}のキャッシュを削除しました。`);
                      })
                    }
                  >
                    キャッシュを削除
                  </button>
                </article>
              ))}
              <p>
                WebGPU：
                {"gpu" in navigator
                  ? "ブラウザAPIあり"
                  : "このブラウザでは利用できません"}
              </p>
            </section>
          </Modal>
        )}
        <footer>
          <p>
            録音はこのブラウザに保存されます。大切な録音はバックアップしてください。
          </p>
          <div className="row">
            <button
              onClick={() =>
                void handle(async () => {
                  await navigator.clipboard.writeText(
                    JSON.stringify(
                      {
                        app: "kotoba-drill",
                        version: 1,
                        browser: navigator.userAgent,
                        secureContext: isSecureContext,
                        webgpu: "gpu" in navigator,
                        model: prefs.settings.evaluation
                          ? prefs.settings.model
                          : "off",
                        device:
                          prefs.settings.model === "browser"
                            ? "browser"
                            : prefs.settings.device,
                        error: state.error ?? diagnostic.current,
                      },
                      null,
                      2,
                    ),
                  );
                  setNotice(
                    "診断情報をコピーしました。録音や練習内容は含みません。",
                  );
                })
              }
            >
              診断情報をコピー
            </button>
            <button
              onClick={() => {
                engine.pause();
                setPrefs((p) => ({ ...p, prepared: false }));
              }}
            >
              音声の準備をやり直す
            </button>
            <a
              href={`${import.meta.env.BASE_URL}licenses.html`}
              target="_blank"
              rel="noreferrer"
            >
              ライセンス・出典
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
