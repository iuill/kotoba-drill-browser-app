import { useEffect, useRef, useState } from "react";
import type { History } from "../core/types";
import { promptReading } from "../core/materials";
import { evaluationText } from "./HistoryPanel";

export function PracticeRecognition({
  recent,
  canRetry,
  onRetry,
}: {
  recent: History[];
  canRetry: (id: string) => boolean;
  onRetry: (id: string) => void;
}) {
  // 新しい録音が処理待ちでも、直近の結果は残す。完了順で古い結果へ逆戻りしない。
  const result = recent.find(
    (h) => h.evaluation !== "off" && h.evaluation !== "pending",
  );
  const pending = recent.find((h) => h.evaluation === "pending");
  const shown = result ?? pending;
  const reading = useRef<HTMLDivElement>(null);
  const [freshId, setFreshId] = useState<string>();
  const resultId = result?.id;
  useEffect(() => {
    if (!resultId) {
      setFreshId(undefined);
      return;
    }
    setFreshId(resultId);
    if (reading.current) reading.current.scrollTop = 0;
    const timer = setTimeout(() => setFreshId(undefined), 2400);
    return () => clearTimeout(timer);
  }, [resultId]);
  const fresh = !!resultId && freshId === resultId;
  return (
    <section className="practice-recognition" aria-label="直近の聞き取り">
      {fresh && (
        <span
          key={resultId}
          className="recognition-update-wipe"
          aria-hidden="true"
        />
      )}
      <div className="recognition-heading">
        <strong>直近の聞き取り</strong>
        <small className="recognition-update-label" data-fresh={fresh}>
          {fresh
            ? "✓ 新しい結果"
            : pending
              ? "次の結果を認識中…"
              : "音声認識の結果"}
        </small>
      </div>
      <div className="recognition-content">
        <div
          className="recognition-reading"
          ref={reading}
          role="status"
          aria-atomic="true"
          tabIndex={0}
        >
          {shown && (
            <small className="recognition-target">
              <time dateTime={shown.date}>
                {new Date(shown.date).toLocaleTimeString("ja-JP", {
                  hour12: false,
                })}
                の録音
              </time>
              {" ／ "}
              お題：{promptReading(shown.prompt, "・")}
            </small>
          )}
          {result?.evaluation === "done" ? (
            <p className="recognized-text">
              {result.recognized || "文字が返りませんでした"}
            </p>
          ) : (
            <p className="recognition-message">
              {result
                ? evaluationText(result)
                : pending
                  ? "聞き取り結果を待っています…"
                  : "発声すると、ここに結果が表示されます"}
            </p>
          )}
        </div>
        <button
          disabled={!shown || !canRetry(shown.id)}
          onClick={() => shown && onRetry(shown.id)}
        >
          このお題に戻る
        </button>
      </div>
      <small className="recognition-note">
        結果は参考です。発音の正誤を示すものではありません。
      </small>
    </section>
  );
}
