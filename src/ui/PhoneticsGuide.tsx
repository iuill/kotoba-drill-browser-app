import { useId, useState } from "react";
import { articulation, vowels, type Manner } from "../content/articulation";
import {
  manners,
  places,
  phoneticsSources,
  soundFeatures,
  comparisonExamples,
  mannerGroups,
  guideForManner,
} from "../content/phonetics";
import { sounds } from "../core/materials";
import { Modal } from "./Modal";
import { MouthDiagram } from "./MouthDiagram";

const chapters = ["音の作り方", "口の場所", "声と拍", "音を比べる"] as const;

function CompareSounds() {
  const id = useId();
  const [pair, setPair] = useState<readonly [string, string]>(["た", "さ"]);
  const [release, setRelease] = useState(false);
  const guides = pair.map((sound) => articulation(sound)!);
  const features = guides.map(soundFeatures);
  return (
    <section aria-label="音の比較">
      <h3>2つの音、どこが違う？</h3>
      <p>
        好きな音を選んで比べられます。色のついた項目は、2つの音で異なるところです。
      </p>
      <div className="phonetics-presets" role="group" aria-label="比較の例">
        {comparisonExamples.map((example) => (
          <button
            key={example.label}
            aria-pressed={
              pair[0] === example.sounds[0] && pair[1] === example.sounds[1]
            }
            onClick={() => {
              setPair(example.sounds);
              setRelease(false);
            }}
          >
            {example.label}：{example.sounds.join("／")}
          </button>
        ))}
      </div>
      <div className="art-steps" role="group" aria-label="比較する段階">
        <button aria-pressed={!release} onClick={() => setRelease(false)}>
          1. 出だしを比べる
        </button>
        <button
          aria-pressed={release}
          onClick={() => setRelease(true)}
          disabled={guides.every((guide) => guide.manner === "vowel")}
        >
          2. 母音へつなぐ
        </button>
      </div>
      <div className="phonetics-compare">
        {guides.map((guide, side) => (
          <article key={side} aria-label={guide.sound + "の作り方"}>
            <label htmlFor={`${id}-${side}`}>比べる音 {side + 1}</label>
            <select
              id={`${id}-${side}`}
              value={guide.sound}
              onChange={(event) => {
                setPair(
                  side === 0
                    ? [event.target.value, pair[1]]
                    : [pair[0], event.target.value],
                );
                setRelease(false);
              }}
            >
              {sounds.map((sound) => (
                <option key={sound} value={sound}>
                  {sound}
                </option>
              ))}
            </select>
            <p className="phonetics-sound-title">
              <strong>{guide.sound}</strong>
              <span>{manners[guide.manner].summary}</span>
            </p>
            <MouthDiagram guide={guide} release={release} showLips={false} />
            <dl className="phonetics-features">
              {features[side].map((feature, i) => {
                const different = feature.value !== features[1 - side][i].value;
                return (
                  <div
                    key={feature.label}
                    className={different ? "is-different" : ""}
                  >
                    <dt>
                      {feature.label}
                      {different && <small>違い</small>}
                    </dt>
                    <dd>{feature.value}</dd>
                  </div>
                );
              })}
            </dl>
            <p>{release ? vowels[guide.vowel].position : guide.position}</p>
          </article>
        ))}
      </div>
      <p className="art-small">
        分類は主に出だしの子音についてです。母音の響きや、拗音での舌の形にも違いがあります。「じ」「ざ行」「が行」などは、前後の音によって作り方が変わることがあります。
      </p>
      <p className="phonetics-takeaway">
        「{pair[0]}、{pair[1]}
        」とゆっくり交互に。舌や唇の動き、息の通り方の違いに注目してみましょう。
      </p>
    </section>
  );
}

function MannerExplorer() {
  const [kind, setKind] = useState<Manner>("stop");
  const [sound, setSound] = useState("か");
  const [stage, setStage] = useState<"onset" | "friction" | "vowel">("onset");
  const info = manners[kind];
  const guide = guideForManner(sound, kind)!;
  const groups = mannerGroups(kind);
  const soundRows = (palatal: boolean) =>
    groups
      .filter((group) => group.palatal === palatal)
      .map((group) => (
        <div className="phonetics-sound-row" key={group.label}>
          <span>{group.label}</span>
          <div className="art-sounds" role="group" aria-label={group.label}>
            {group.sounds.map((s) => (
              <button
                key={s}
                aria-pressed={sound === s}
                onClick={() => {
                  setSound(s);
                  setStage("onset");
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ));
  return (
    <section aria-label="音の作り方を調べる">
      <h3>息の通し方で、音の仲間が変わる</h3>
      <p>
        教材で選べる音を、子音の6つの作り方と母音に分けています。「か」などの文字は、出だしの子音の分類です。続く母音まで破裂音という意味ではありません。
      </p>
      <div className="phonetics-explorer">
        <div className="phonetics-kinds" role="group" aria-label="音の種類">
          {(Object.keys(manners) as Manner[]).map((key) => (
            <button
              key={key}
              aria-pressed={kind === key}
              onClick={() => {
                setKind(key);
                setSound(manners[key].initialSound);
                setStage("onset");
              }}
            >
              <strong>{manners[key].name}</strong>
              <small>{manners[key].summary}</small>
            </button>
          ))}
        </div>
        <div className="phonetics-detail">
          <h4>
            {info.name}
            <small>（{info.reading}）</small>
          </h4>
          <ol className="phonetics-flow" aria-label={`${info.name}の流れ`}>
            {info.steps.map((step, i) => (
              <li key={step}>
                <span>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="art-small">{info.note}</p>
          <div
            className="phonetics-members"
            role="group"
            aria-label="この仲間の音"
          >
            <strong>基本の音 — 選ぶと図が変わります</strong>
            {soundRows(false)}
            {groups.some((group) => group.palatal) && (
              <details key={kind} className="phonetics-palatal">
                <summary>拗音も見る（小さい「ゃ・ゅ・ょ」の音）</summary>
                {soundRows(true)}
              </details>
            )}
          </div>
          <p className="phonetics-current">
            <strong>{sound}</strong>{" "}
            {stage === "vowel"
              ? `続く「${guide.vowel}」の形へ`
              : stage === "friction"
                ? "閉じた場所を少し開き、すき間に息を通します。"
                : guide.position}
          </p>
          {kind !== "vowel" && (
            <div className="art-steps" role="group" aria-label="図の段階">
              <button
                aria-pressed={stage === "onset"}
                onClick={() => setStage("onset")}
              >
                1. 出だし
              </button>
              {kind === "affricate" && (
                <button
                  aria-pressed={stage === "friction"}
                  onClick={() => setStage("friction")}
                >
                  2. すき間に息を通す
                </button>
              )}
              <button
                aria-pressed={stage === "vowel"}
                onClick={() => setStage("vowel")}
              >
                {kind === "affricate" ? "3" : "2"}. 「{guide.vowel}」へ
              </button>
            </div>
          )}
          <MouthDiagram
            guide={guide}
            release={stage === "vowel"}
            friction={stage === "friction"}
          />
          <p className="art-small">
            {stage === "vowel"
              ? "出だしから区切らず、母音へつなぎます。"
              : stage === "friction"
                ? "少し開いたすき間に息を通します。"
                : kind === "vowel"
                  ? guide.tip
                  : guide.breath}
          </p>
        </div>
      </div>
    </section>
  );
}

function PlaceExplorer() {
  const [selected, setSelected] = useState(1);
  const place = places[selected];
  return (
    <section aria-label="口の場所を調べる">
      <h3>唇から、口の奥へ</h3>
      <p>
        音を作る場所を「調音点」といいます。同じ場所でも、息の通し方で別の音になります。
      </p>
      <div
        className="phonetics-places"
        role="group"
        aria-label="口の場所を選ぶ"
      >
        {places.map((item, i) => (
          <button
            key={item.name}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <small>{i + 1}</small>
            {item.name}
          </button>
        ))}
      </div>
      <div className="phonetics-detail">
        <h4>
          {place.name}
          <small>{place.term}</small>
        </h4>
        <p>{place.description}</p>
        <p className="phonetics-current">
          図の例 <strong>{place.sound}</strong>
        </p>
        <MouthDiagram guide={articulation(place.sound)!} release={false} />
      </div>
      <p className="art-small">
        位置は目安です。同じ行でも「し・ち・に」「は・ひ・ふ」などは、舌や唇の使い方が変わります。
      </p>
    </section>
  );
}

function VoiceAndRhythm() {
  return (
    <section aria-label="声帯の振動と拍">
      <h3>「声の振動」と「音の長さ」も手がかりに</h3>
      <div className="phonetics-detail">
        <h4>無声音・有声音</h4>
        <p>
          子音を作るときに声帯が振動するかどうかです。大きい声・小さい声の違いではありません。
        </p>
        <div className="phonetics-voice-pair">
          <div>
            <strong>か・た・ぱ</strong>
            <span>出だしの子音は、振動なし</span>
          </div>
          <div>
            <strong>が・だ・ば</strong>
            <span>出だしの子音は、振動あり</span>
          </div>
        </div>
        <p className="art-small">
          続く母音では通常どちらも声帯が振動します。「か」全体が無声音、という意味ではありません。
        </p>
      </div>
      <div className="phonetics-detail">
        <h4>一拍ずつ数える「モーラ」</h4>
        <p>
          このアプリの「1音」は「か」「きゃ」など、一拍分のまとまりです。「て」の子音と母音を、二拍に分けるわけではありません。
        </p>
        <div className="phonetics-beats">
          {[
            {
              label: "拗音：きゃ",
              beats: ["きゃ"],
              note: "小さい「ゃ・ゅ・ょ」は前の字と一拍に。",
            },
            {
              label: "促音：きって",
              beats: ["き", "っ", "て"],
              note: "小さい「っ」も一拍。次の子音の構えを保ちます。",
            },
            {
              label: "撥音：ほん",
              beats: ["ほ", "ん"],
              note: "「ん」も一拍。口の形は前後の音に合わせて変わります。",
            },
            {
              label: "長音：こーひー",
              beats: ["こ", "ー", "ひ", "ー"],
              note: "伸ばす分も一拍ずつ。前の母音の形を保ちます。",
            },
          ].map(({ label, beats, note }) => (
            <figure key={label}>
              <figcaption>{label}</figcaption>
              <div
                className="phonetics-beat-row"
                aria-label={`${beats.join("・")}、${beats.length}拍`}
              >
                {beats.map((beat, i) => (
                  <span key={i} aria-hidden="true">
                    {beat}
                    <small>{i + 1}拍目</small>
                  </span>
                ))}
              </div>
              <p>{note}</p>
            </figure>
          ))}
        </div>
      </div>
      <p className="art-small">
        ここでは標準的な日本語の基本を扱います。アクセント・イントネーションや、前後の音による細かな変化は別の要素です。
      </p>
    </section>
  );
}

export function PhoneticsGuide({ onClose }: { onClose: () => void }) {
  const [chapter, setChapter] =
    useState<(typeof chapters)[number]>("音の作り方");
  return (
    <Modal label="発音のしくみガイド" onClose={onClose}>
      <div className="phonetics-guide art-guide">
        <header className="art-header">
          <div>
            <p className="eyebrow">舌・唇・息を、図で知る</p>
            <h2>発音のしくみガイド</h2>
          </div>
          <button onClick={onClose} aria-label="発音のしくみガイドを閉じる">
            閉じる
          </button>
        </header>
        <div
          className="phonetics-chapters"
          role="group"
          aria-label="ガイドの項目"
        >
          {chapters.map((item) => (
            <button
              key={item}
              aria-pressed={chapter === item}
              onClick={() => setChapter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {chapter === "音を比べる" && <CompareSounds />}
        {chapter === "音の作り方" && <MannerExplorer />}
        {chapter === "口の場所" && <PlaceExplorer />}
        {chapter === "声と拍" && <VoiceAndRhythm />}
        <details className="art-references">
          <summary>図の見方・参考資料</summary>
          <p>
            色のついた部分は舌、丸印は触れる・近づける場所、矢印は息の出口です。段階を切り替える模式図で、実際の速さ・形を再現するものではありません。
          </p>
          <p>
            標準的な日本語の代表例です。個人差や音の前後による変化があり、発音を判定・採点する図ではありません。図と説明は独自に作成し、専門家の監修は受けていません。
          </p>
          <ul>
            {phoneticsSources.map(({ label, url }) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </Modal>
  );
}
