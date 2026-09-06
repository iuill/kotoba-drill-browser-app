export function RecognitionNotice({ browser = false }: { browser?: boolean }) {
  return (
    <div
      className="recognition-notice"
      role="note"
      aria-label="音声認識について"
    >
      <svg
        className="recognition-notice-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6" />
        <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
      </svg>
      <div className="recognition-notice-content">
        <div className="recognition-notice-title">
          音声認識は実験的な機能です
        </div>
        <p>
          <strong>認識精度はまだ十分ではありません</strong>
          特に1音・意味のない2音は誤認識しやすく、結果は参考程度にしてください。認識が違っても、発音が間違っているとは限りません。
        </p>
        {browser ? (
          <p>
            <strong>ブラウザの音声認識サービスを利用します</strong>
            録音音声が外部へ送信される場合があります。APIキー・アプリ側のモデル取得は不要です。
          </p>
        ) : (
          <p>
            <strong>端末内認識の推奨環境：GPU搭載のゲーミングPC</strong>
            音声認識の処理負荷を考慮した推奨です。高性能なPCでも、認識精度が向上するとは限りません。
          </p>
        )}
      </div>
    </div>
  );
}
