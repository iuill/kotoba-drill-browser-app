import { useId } from "react";
import { vowels, type Articulation, type Vowel } from "../content/articulation";

const vowelTongues: Record<Vowel, string> = {
  あ: "M112 197 Q173 193 232 190 Q276 187 294 231",
  い: "M112 191 Q138 113 199 117 Q261 126 294 231",
  う: "M112 197 Q173 186 220 140 Q272 109 294 231",
  え: "M112 194 Q151 143 207 148 Q266 154 294 231",
  お: "M112 197 Q173 187 225 163 Q277 144 294 231",
};
export function MouthDiagram({
  guide: g,
  release,
  friction = false,
  showLips = true,
}: {
  guide: Articulation;
  release: boolean;
  friction?: boolean;
  showLips?: boolean;
}) {
  const id = useId();
  const vowel = release || g.manner === "vowel";
  const nasal = !vowel && g.manner === "nasal";
  const closed =
    !vowel &&
    !friction &&
    (g.manner === "stop" || g.manner === "affricate" || g.manner === "nasal");
  const contact = !vowel && (closed || g.manner === "tap");
  let tongue = vowelTongues[g.vowel];
  let focus: [number, number] | null = null;
  if (!vowel) {
    if (g.place === "back") {
      tongue =
        g.manner === "glide"
          ? vowelTongues.う
          : "M112 197 Q165 195 218 162 Q246 119 277 123 Q296 150 294 231";
      focus = [277, 123];
    } else if (g.place === "teeth") {
      tongue = contact
        ? "M112 191 Q109 146 130 129 Q155 151 201 169 Q273 159 294 231"
        : "M112 191 Q110 164 130 146 Q170 172 211 173 Q275 167 294 231";
      focus = [130, contact ? 129 : 146];
    } else if (g.place === "postalveolar") {
      tongue = contact
        ? "M112 191 Q128 139 165 110 Q213 114 245 157 Q287 185 294 231"
        : "M112 191 Q127 151 169 130 Q216 129 250 164 Q287 185 294 231";
      focus = [165, contact ? 110 : 130];
    } else if (g.place === "palate") {
      tongue = contact
        ? "M112 191 Q143 151 200 100 Q255 108 294 231"
        : "M112 191 Q142 156 200 122 Q253 128 294 231";
      focus = [200, contact ? 100 : 122];
    } else if (g.place === "lips") {
      tongue =
        g.palatal || "みびぴ".includes(g.sound[0])
          ? vowelTongues.い
          : vowelTongues.あ;
      focus = [78, 163];
    }
  }
  const lipClosed = closed && g.place === "lips";
  const lipNarrow = !vowel && g.place === "lips" && !closed;
  const [rx, ry] = lipClosed
    ? [43, 0]
    : lipNarrow
      ? [28, 5]
      : { あ: [37, 27], い: [47, 9], う: [30, 9], え: [42, 17], お: [24, 24] }[
          g.vowel
        ];
  return (
    <div className={`art-diagrams${showLips ? "" : " art-diagrams-single"}`}>
      <figure>
        <figcaption>
          横から見た口 <span>左が唇・右がのど</span>
        </figcaption>
        <svg
          viewBox="0 0 390 300"
          role="img"
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title id={`${id}-title`}>
            {g.sound}の{vowel ? "母音" : friction ? "摩擦の段階" : "出だし"}
            ：舌と息の模式図
          </title>
          <desc id={`${id}-desc`}>
            {vowel
              ? vowels[g.vowel].position
              : friction
                ? "閉じた場所を少し開き、すき間に息を通します。"
                : g.position}{" "}
            {vowel
              ? "口から息を流します。"
              : friction
                ? "細い通り道から息を出します。"
                : g.breath}{" "}
            実際の大きさや形を再現した解剖図ではありません。
          </desc>
          <defs>
            <marker
              id={`${id}-arrow`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M1 1 L9 5 L1 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </marker>
          </defs>
          <path
            className="art-profile"
            d="M118 36 Q105 47 99 65 L73 89 Q64 98 88 102 L88 119 Q84 135 75 144 M76 182 Q85 189 84 207 Q88 234 126 241 L148 273 M335 70 Q349 147 337 272"
          />
          <path
            className="art-roof"
            d="M88 144 L103 144 L106 127 Q122 136 137 123 Q193 80 249 107 Q276 118 294 143"
          />
          <path
            className="art-floor"
            d="M91 185 Q99 228 158 230 L235 253 Q256 261 258 277"
          />
          <path
            className="art-tooth"
            d="M90 129 L103 129 L103 151 L94 151 Z M94 181 L105 181 L108 201 L96 201 Z"
          />
          <path
            className="art-tongue"
            d={`${tongue} L277 263 Q263 225 213 220 Q146 222 112 207 Z`}
          />
          <path
            className="art-lips"
            d={
              lipClosed
                ? "M77 145 Q65 162 78 163 Q65 174 77 182 M65 163 L84 163"
                : "M87 135 Q72 139 75 150 L86 153 M86 176 L75 180 Q76 185 87 188"
            }
          />
          {focus && (
            <circle
              className="art-contact"
              cx={focus[0]}
              cy={focus[1]}
              r="9"
              fill={contact ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2.5"
            />
          )}
          {(nasal || !closed) && (
            <path
              className="art-air"
              d={
                nasal
                  ? "M318 259 Q329 159 303 95 Q225 54 69 86 L43 86"
                  : "M57 163 L24 163"
              }
              markerEnd={`url(#${id}-arrow)`}
            />
          )}
          <text x="183" y="213" className="art-tongue-label">
            舌
          </text>
          <path className="art-label-line" d="M187 94 L187 57" />
          <text x="164" y="47">
            上あご
          </text>
          <path className="art-label-line" d="M104 134 L132 83" />
          <text x="119" y="72">
            前歯
          </text>
          <text x="307" y="289">
            のど
          </text>
          {closed && !nasal && (
            <text x="18" y="285" className="art-air-label">
              息はいったん止まる
            </text>
          )}
          {nasal && (
            <text x="16" y="59" className="art-air-label">
              鼻へ
            </text>
          )}
          {!closed && (
            <text x="18" y="285" className="art-air-label">
              息は口へ
            </text>
          )}
        </svg>
      </figure>
      {showLips && (
        <figure className="art-front">
          <figcaption>正面の唇</figcaption>
          <svg
            viewBox="0 0 160 140"
            role="img"
            aria-label={
              lipClosed
                ? "上下の唇を閉じる"
                : lipNarrow
                  ? "唇に細いすき間を作る"
                  : vowels[g.vowel].lips
            }
          >
            <path
              className="art-profile"
              d="M69 15 Q62 35 68 38 M91 15 Q98 35 92 38"
            />
            {lipClosed ? (
              <path
                className="art-lips"
                d="M37 78 Q80 70 123 78 M37 78 Q80 100 123 78"
              />
            ) : (
              <ellipse
                className="art-lip-opening"
                cx="80"
                cy="80"
                rx={rx}
                ry={ry}
              />
            )}
          </svg>
          <p>
            {lipClosed
              ? "軽く閉じる"
              : lipNarrow
                ? "すき間を残す"
                : vowels[g.vowel].lips}
          </p>
          <span className="art-voicing">
            {vowel || g.voiced ? "声帯の振動あり" : "出だしは息の音"}
          </span>
        </figure>
      )}
    </div>
  );
}
