import { Modal } from "./Modal";
import { useEffect, useRef, useState } from "react";
import type { History } from "../core/types";
import { promptReading } from "../core/materials";
import type { Store } from "../storage/store";
import { temporary, downloadBackup, validateBackup } from "../storage/store";
import type { Backup } from "../storage/store";
export const evaluationText = (h: History) =>
  h.evaluation === "off"
    ? "評価なし"
    : h.evaluation === "pending"
      ? "認識待ち"
      : h.evaluation === "skipped"
        ? h.skipReason === "backlog"
          ? "認識を省略：処理待ちが増えたため、新しい録音を優先しました"
          : h.skipReason === "interrupted"
            ? "認識を中断：設定変更・練習終了などで処理を停止しました"
            : "認識を省略（理由の記録なし）"
        : h.evaluation === "error"
          ? h.recognitionMessage || "認識できませんでした"
          : `聞き取り：${h.recognized || "（文字なし）"}${h.comparison === "match" ? " ／ 読みが一致" : h.comparison === "unknown" ? " ／ 読みは要確認" : ""}`;
function localDay(iso: string) {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
interface Props {
  store: Store;
  notice: string;
  refreshKey: number;
  onClose: () => void;
  onPlay: (b: Blob) => void;
  onRestore: () => Promise<void>;
  onBeforeRestore: () => void;
  onDeleted: (ids: string[]) => void;
  report: (s: string) => void;
}
export function HistoryPanel({
  store,
  notice,
  refreshKey,
  onClose,
  onPlay,
  onRestore,
  onBeforeRestore,
  onDeleted,
  report,
}: Props) {
  const [rows, setRows] = useState<History[]>([]),
    [saved, setSaved] = useState(new Map<string, number>()),
    [query, setQuery] = useState(""),
    [savedOnly, setSavedOnly] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [withAudio, setWithAudio] = useState(true),
    [pending, setPending] = useState<{
      historyCount: number;
      recordingCount: number;
      includesRecordings: boolean;
    } | null>(null),
    [deleting, setDeleting] = useState<string[] | null>(null),
    [busy, setBusy] = useState(false);
  const pendingBackup = useRef<Backup | null>(null);
  const reload = async () => {
    setRows(await store.history());
    setSaved(
      new Map([...(await store.saved())].map(([id, b]) => [id, b.size])),
    );
  };
  useEffect(() => {
    void reload().catch(() => report("履歴を読み込めませんでした。"));
  }, [store, refreshKey]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      report(e instanceof Error ? e.message : "保存処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  };
  const filtered = rows
    .filter(
      (h) =>
        (!query ||
          h.prompt.reading.includes(query) ||
          h.prompt.text.includes(query)) &&
        (!savedOnly || saved.has(h.id)) &&
        (!from || localDay(h.date) >= from) &&
        (!to || localDay(h.date) <= to),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const sessions = new Map<
    string,
    { date: string; elapsed: number; count: number; sounds: Set<string> }
  >();
  for (const h of filtered) {
    const entry = sessions.get(h.session) ?? {
      date: h.date,
      elapsed: 0,
      count: 0,
      sounds: new Set<string>(),
    };
    entry.count++;
    entry.elapsed = Math.max(entry.elapsed, h.elapsed);
    h.prompt.sounds.forEach((x) => entry.sounds.add(x));
    sessions.set(h.session, entry);
  }
  const savedBytes = [...saved.values()].reduce((n, b) => n + b, 0);
  return (
    <Modal label="履歴" onClose={busy ? undefined : onClose}>
      <section className="history-dialog" aria-labelledby="history-title">
        <div className="section-title">
          <h2 id="history-title">履歴と振り返り</h2>
          <button disabled={busy} onClick={onClose}>
            閉じる
          </button>
        </div>
        {notice && !pending && !deleting && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <p>
          保存録音 {(savedBytes / 1024 / 1024).toFixed(1)} /
          500MB。一時録音は直近20件・50MBまでで、次の練習開始や再読み込みで消えます。
        </p>
        <div className="fields">
          <label>
            お題で絞り込み
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例：かさ"
            />
          </label>
          <label>
            開始日
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            終了日
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={savedOnly}
              onChange={(e) => setSavedOnly(e.target.checked)}
            />
            保存録音のある履歴だけ
          </label>
        </div>
        <p>
          同じお題を絞ると、昔から今の順に聞き比べられます。認識結果は発音の成長率を示すものではありません。
        </p>
        <div className="session-grid">
          {[...sessions].map(([id, s]) => (
            <div key={id} className="session">
              <b>{new Date(s.date).toLocaleDateString("ja-JP")}</b>
              <p>
                {s.count}回・{Math.round(s.elapsed)}秒
              </p>
              <small>対象音：{[...s.sounds].join("・")}</small>
            </div>
          ))}
        </div>
        <div className="history-list">
          {filtered.length === 0 && <p>該当する履歴はありません。</p>}
          {filtered.map((h) => (
            <article className="history-row" key={h.id}>
              <div>
                <time>{new Date(h.date).toLocaleString("ja-JP")}</time>
                <h3>
                  {promptReading(h.prompt, "・")}{" "}
                  <small>
                    {h.prompt.text !== h.prompt.reading && h.prompt.text}
                  </small>
                </h3>
                <p>{evaluationText(h)}</p>
                <small>
                  {h.model === "browser"
                    ? "ブラウザ標準"
                    : (h.model ?? "モデルなし")}
                  ・録音 {h.duration.toFixed(1)}秒
                </small>
              </div>
              <div className="row">
                {(saved.has(h.id) || temporary.get(h.id)) && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const blob =
                            (await store.recording(h.id)) ??
                            temporary.get(h.id);
                          if (blob) onPlay(blob);
                        })
                      }
                    >
                      聞き返す
                    </button>
                    {!saved.has(h.id) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            store.saveRecording(h.id, temporary.get(h.id)!),
                          )
                        }
                      >
                        録音を保存
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() => store.deleteRecording(h.id))
                      }
                    >
                      {saved.has(h.id) ? "保存録音" : "一時録音"}を削除
                    </button>
                  </>
                )}
                {saved.has(h.id) && <span className="badge">保存済み</span>}
              </div>
            </article>
          ))}
        </div>
        <fieldset>
          <legend>バックアップと復元</legend>
          <p>
            設定・練習セット・教材・履歴と、選択した場合は保存録音を書き出します。一時録音は先に保存してください。
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={withAudio}
              onChange={(e) => setWithAudio(e.target.checked)}
            />
            保存録音を含める
          </label>
          <div className="row">
            <button
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  downloadBackup(await store.export(withAudio)),
                )
              }
            >
              バックアップを書き出す
            </button>
            <label>
              バックアップを読み込む
              <input
                disabled={busy}
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file)
                    void run(async () => {
                      if (file.size > 750 * 1024 * 1024)
                        throw new Error("バックアップが大きすぎます。");
                      const b = JSON.parse(await file.text()) as Backup;
                      validateBackup(b);
                      pendingBackup.current = b;
                      setPending({
                        historyCount: b.history.length,
                        recordingCount: b.recordings.length,
                        includesRecordings: b.includesRecordings,
                      });
                    });
                }}
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>履歴の削除</legend>
          <div className="row">
            <button
              disabled={busy || !filtered.length}
              onClick={() => setDeleting(filtered.map((h) => h.id))}
            >
              表示中の履歴を削除（{filtered.length}件）
            </button>
            <button
              disabled={busy || !rows.length}
              onClick={() => setDeleting(rows.map((h) => h.id))}
            >
              全履歴を削除
            </button>
          </div>
        </fieldset>
        {pending && (
          <Modal
            alert
            label="バックアップ置換の確認"
            onClose={
              busy
                ? undefined
                : () => {
                    pendingBackup.current = null;
                    setPending(null);
                  }
            }
          >
            <h3>現在のデータを丸ごと置換します</h3>
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            <p>
              設定・教材・履歴・保存録音・一時録音が置換対象です。履歴
              {pending.historyCount}件、保存録音{pending.recordingCount}
              件を復元します。
            </p>
            <p>
              現在の保存録音{saved.size}件も削除します。
              {!pending.includesRecordings &&
                "このバックアップには録音がないため、現在の保存録音は復元されません。"}
            </p>
            <div className="row">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => downloadBackup(await store.export(true)))
                }
              >
                置換前に録音込みで書き出す
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (!pendingBackup.current) return;
                    onBeforeRestore();
                    await store.restore(pendingBackup.current);
                    pendingBackup.current = null;
                    setPending(null);
                    await onRestore();
                  })
                }
              >
                確認して丸ごと置換
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  pendingBackup.current = null;
                  setPending(null);
                }}
              >
                キャンセル
              </button>
            </div>
          </Modal>
        )}
        {deleting && (
          <Modal
            alert
            label="履歴削除の確認"
            onClose={busy ? undefined : () => setDeleting(null)}
          >
            <h3>履歴{deleting.length}件を削除します</h3>
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            <p>
              紐付く保存録音{deleting.filter((id) => saved.has(id)).length}
              件と一時録音も削除されます。
            </p>
            <div className="row">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => downloadBackup(await store.export(true)))
                }
              >
                先にバックアップを書き出す
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await store.deleteHistory(deleting);
                    onDeleted(deleting);
                    setDeleting(null);
                  })
                }
              >
                確認して削除
              </button>
              <button disabled={busy} onClick={() => setDeleting(null)}>
                キャンセル
              </button>
            </div>
          </Modal>
        )}
      </section>
    </Modal>
  );
}
