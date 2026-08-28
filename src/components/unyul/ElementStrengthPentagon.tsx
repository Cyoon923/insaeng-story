import type { ElementStrengthDisplaySet } from "@/lib/saju/elements/toElementStrengthDisplayProfiles";
import type { Element } from "@/lib/saju/types";

/** Clockwise from top — matches 木→火→土→金→水 radar axes. */
const AXIS_ORDER: readonly Element[] = ["木", "火", "土", "金", "水"];

const ELEMENT_READING: Record<Element, string> = {
  木: "목",
  火: "화",
  土: "토",
  金: "금",
  水: "수",
};

const CX = 100;
const CY = 100;
const MAX_R = 62;
const MIN_R = 14;
const GRID_RATIOS = [0.35, 0.55, 0.75, 1] as const;
const LABEL_R = 82;

function polar(angleRad: number, radius: number): { x: number; y: number } {
  return {
    x: CX + radius * Math.sin(angleRad),
    y: CY - radius * Math.cos(angleRad),
  };
}

function axisAngle(index: number): number {
  return (index * 2 * Math.PI) / 5;
}

function scoreToRadius(displayScore: number): number {
  const t = Math.min(100, Math.max(0, displayScore)) / 100;
  return MIN_R + t * (MAX_R - MIN_R);
}

function polygonPoints(radii: number[]): string {
  return radii
    .map((radius, index) => {
      const { x, y } = polar(axisAngle(index), radius);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function gridPoints(ratio: number): string {
  const r = MAX_R * ratio;
  return polygonPoints([r, r, r, r, r]);
}

export type ElementStrengthPentagonProps = {
  displaySet: ElementStrengthDisplaySet;
  className?: string;
};

/**
 * Strength radar for 「나의 오행 균형」.
 * Uses displayScore as SVG coordinates only — never renders numeric scores.
 */
export function ElementStrengthPentagon({
  displaySet,
  className,
}: ElementStrengthPentagonProps) {
  const scoreByElement = new Map(
    displaySet.profiles.map((profile) => [profile.element, profile.displayScore]),
  );

  const valueRadii = AXIS_ORDER.map((element) =>
    scoreToRadius(scoreByElement.get(element) ?? 0),
  );
  const valuePoints = polygonPoints(valueRadii);

  return (
    <div className={className}>
      <svg
        viewBox="0 0 200 200"
        className="mx-auto block h-auto w-full max-w-[260px]"
        role="img"
        aria-label="나의 오행 균형 그래프"
      >
        {GRID_RATIOS.map((ratio) => (
          <polygon
            key={ratio}
            points={gridPoints(ratio)}
            fill="none"
            stroke="#e2d6c8"
            strokeWidth={ratio === 1 ? 1.1 : 0.85}
          />
        ))}

        {AXIS_ORDER.map((element, index) => {
          const tip = polar(axisAngle(index), MAX_R);
          return (
            <line
              key={`axis-${element}`}
              x1={CX}
              y1={CY}
              x2={tip.x}
              y2={tip.y}
              stroke="#ebe3d8"
              strokeWidth={0.9}
            />
          );
        })}

        <polygon
          points={valuePoints}
          fill="rgba(92, 61, 46, 0.12)"
          stroke="#5c3d2e"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {AXIS_ORDER.map((element, index) => {
          const point = polar(axisAngle(index), valueRadii[index]!);
          return (
            <circle
              key={`point-${element}`}
              cx={point.x}
              cy={point.y}
              r={2.4}
              fill="#3d2b1f"
            />
          );
        })}

        {AXIS_ORDER.map((element, index) => {
          const label = polar(axisAngle(index), LABEL_R);
          return (
            <text
              key={`label-${element}`}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#3d2b1f"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              <tspan x={label.x} dy="-0.15em" fontSize="13" fontWeight={700}>
                {element}
              </tspan>
              <tspan
                x={label.x}
                dy="1.25em"
                fontSize="9"
                fill="#8a735a"
                fontWeight={500}
                style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
              >
                {ELEMENT_READING[element]}
              </tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}
