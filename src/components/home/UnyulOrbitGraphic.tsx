type UnyulOrbitGraphicProps = {
  className?: string;
  title?: string;
};

/** viewBox center */
const CX = 100;
const CY = 100;
/** Dashed orbit radius (icons sit on this ring) */
const ORBIT_R = 62;
/** Element badge radius */
const BADGE_R = 16;

/**
 * Angles measured from reference mockup (0° = top, clockwise).
 * 火 top · 土 ~2:30 · 水 ~5 · 金 ~7:30 · 木 ~9:30–10
 */
const ELEMENTS = [
  { id: "fire", angle: 0, fill: "#FF8B7A", glow: "unyul-glow-fire" },
  { id: "earth", angle: 77, fill: "#F2C266", glow: "unyul-glow-earth" },
  { id: "water", angle: 148, fill: "#8EA7FF", glow: "unyul-glow-water" },
  { id: "metal", angle: 218, fill: "#D9D9E3", glow: "unyul-glow-metal" },
  { id: "wood", angle: 291, fill: "#9AC4BA", glow: "unyul-glow-wood" },
] as const;

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + radius * Math.sin(rad),
    y: CY - radius * Math.cos(rad),
  };
}

function ElementIcon({ id }: { id: (typeof ELEMENTS)[number]["id"] }) {
  const s = BADGE_R;
  switch (id) {
    case "fire":
      /* Outer 3-peak flame + small inner flame */
      return (
        <>
          <path
            d={`M${s} ${s - 9}
              C${s - 0.8} ${s - 6.4} ${s - 2.6} ${s - 4.8} ${s - 4.2} ${s - 3.2}
              C${s - 6.2} ${s - 1.2} ${s - 6.4} ${s + 2} ${s - 5.2} ${s + 4.2}
              C${s - 3.8} ${s + 7} ${s - 1.6} ${s + 8} ${s} ${s + 8}
              C${s + 1.6} ${s + 8} ${s + 3.8} ${s + 7} ${s + 5.2} ${s + 4.2}
              C${s + 6.4} ${s + 2} ${s + 6.2} ${s - 1.2} ${s + 4.2} ${s - 3.2}
              C${s + 2.6} ${s - 4.8} ${s + 0.8} ${s - 6.4} ${s} ${s - 9}Z`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d={`M${s} ${s - 1}
              C${s - 1.1} ${s + 0.8} ${s - 2.1} ${s + 2.4} ${s - 1.7} ${s + 3.8}
              C${s - 1.3} ${s + 5} ${s - 0.55} ${s + 5.6} ${s} ${s + 5.6}
              C${s + 0.55} ${s + 5.6} ${s + 1.3} ${s + 5} ${s + 1.7} ${s + 3.8}
              C${s + 2.1} ${s + 2.4} ${s + 1.1} ${s + 0.8} ${s} ${s - 1}Z`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
        </>
      );
    case "earth":
      /* Two-peak mountain — left peak taller, flat base */
      return (
        <path
          d={`M${s - 8.5} ${s + 5.5}
            L${s - 2.6} ${s - 6.4}
            L${s + 0.6} ${s - 0.4}
            L${s + 5} ${s - 4.6}
            L${s + 9} ${s + 5.5}
            Z`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case "water":
      /* Three horizontal waves with ~3 crests each */
      return (
        <>
          {[ -4.2, 0, 4.2 ].map((dy) => (
            <path
              key={dy}
              d={`M${s - 7.2} ${s + dy}
                C${s - 4.8} ${s + dy - 2.4} ${s - 2.4} ${s + dy - 2.4} ${s} ${s + dy}
                C${s + 2.4} ${s + dy + 2.4} ${s + 4.8} ${s + dy + 2.4} ${s + 7.2} ${s + dy}`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.65"
              strokeLinecap="round"
            />
          ))}
        </>
      );
    case "metal":
      /* Four-point sparkle with concave sides */
      return (
        <path
          d={`M${s} ${s - 8}
            C${s} ${s - 3.2} ${s - 3.2} ${s} ${s - 8} ${s}
            C${s - 3.2} ${s} ${s} ${s + 3.2} ${s} ${s + 8}
            C${s} ${s + 3.2} ${s + 3.2} ${s} ${s + 8} ${s}
            C${s + 3.2} ${s} ${s} ${s - 3.2} ${s} ${s - 8}Z`}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
      );
    case "wood":
      /* Leaf tilted top-right: outline + midrib + light veins */
      return (
        <g transform={`translate(${s} ${s}) rotate(-28)`}>
          <path
            d="M0 -8.4
              C-4.2 -4.2 -5.6 -0.6 -5.6 3.2
              C-5.6 6.6 -3.2 9.2 0 9.2
              C3.2 9.2 5.6 6.6 5.6 3.2
              C5.6 -0.6 4.2 -4.2 0 -8.4Z"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M0 -6.4V7.6"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M0 -1.2C-2 0.2 -3.2 1.6 -3.8 3.4
              M0 1.2C2 2.6 3.2 4 3.8 5.8
              M0 2.4C-1.8 3.6 -2.8 4.8 -3.2 6.2"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </g>
      );
  }
}

/**
 * Responsive SVG: beamed notes center + five-element orbit.
 * Positions/icons traced from Unyul home-card reference mockup.
 */
export function UnyulOrbitGraphic({
  className = "h-full w-full",
  title = "운율 오행과 음악",
}: UnyulOrbitGraphicProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <filter id="unyul-glow-wood" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.6" floodColor="#9AC4BA" floodOpacity="0.6" />
        </filter>
        <filter id="unyul-glow-fire" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.6" floodColor="#FF8B7A" floodOpacity="0.6" />
        </filter>
        <filter id="unyul-glow-earth" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.6" floodColor="#F2C266" floodOpacity="0.6" />
        </filter>
        <filter id="unyul-glow-metal" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.6" floodColor="#B8B8C8" floodOpacity="0.55" />
        </filter>
        <filter id="unyul-glow-water" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.6" floodColor="#8EA7FF" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* Soft lavender sound waves through mid */}
      <path
        d="M6 88C34 72 62 108 100 90C138 72 166 104 194 86"
        fill="none"
        stroke="#C9C0E8"
        strokeWidth="1.55"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M4 100C36 84 66 118 100 102C134 86 164 116 196 100"
        fill="none"
        stroke="#D5CEED"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.42"
      />
      <path
        d="M8 112C38 98 68 128 100 114C132 100 162 126 192 112"
        fill="none"
        stroke="#E0DAF2"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.38"
      />
      <path
        d="M10 122C40 110 70 136 100 124C130 112 160 134 190 122"
        fill="none"
        stroke="#E8E3F5"
        strokeWidth="1.05"
        strokeLinecap="round"
        opacity="0.32"
      />

      {/* Thin dashed purple orbit */}
      <circle
        cx={CX}
        cy={CY}
        r={ORBIT_R}
        fill="none"
        stroke="#B8AED4"
        strokeWidth="1.35"
        strokeDasharray="2.8 3.8"
        opacity="0.85"
      />

      {/* Five element badges on measured orbit angles */}
      {ELEMENTS.map(({ id, angle, fill, glow }) => {
        const { x, y } = polar(angle, ORBIT_R);
        return (
          <g
            key={id}
            transform={`translate(${x - BADGE_R} ${y - BADGE_R})`}
            filter={`url(#${glow})`}
          >
            <circle
              cx={BADGE_R}
              cy={BADGE_R}
              r={BADGE_R}
              fill={fill}
              stroke="#FFFFFF"
              strokeWidth="1.4"
            />
            <ElementIcon id={id} />
          </g>
        );
      })}

      {/* Center: beamed double eighth notes — traced from mockup silhouette */}
      <g transform="translate(100 100) rotate(8)">
        <ellipse
          cx="-7.4"
          cy="9.1"
          rx="5.5"
          ry="4.2"
          fill="#8A71B7"
          transform="rotate(-20 -7.4 9.1)"
        />
        <ellipse
          cx="5.2"
          cy="7.4"
          rx="5.5"
          ry="4.2"
          fill="#8A71B7"
          transform="rotate(-20 5.2 7.4)"
        />
        <rect x="-3.55" y="-12.2" width="2.5" height="21.6" rx="0.4" fill="#8A71B7" />
        <rect x="9.9" y="-14.5" width="2.5" height="22.2" rx="0.4" fill="#8A71B7" />
        <path d="M-3.55 -12.2L12.4 -14.55L12.4 -11.15L-3.55 -8.85Z" fill="#8A71B7" />
        <circle cx="17.5" cy="0.5" r="1.05" fill="#B8AED4" opacity="0.7" />
        <circle cx="21" cy="-3" r="0.8" fill="#C9C0E8" opacity="0.65" />
        <circle cx="19.5" cy="5" r="0.65" fill="#C9C0E8" opacity="0.55" />
        <circle cx="23.5" cy="2" r="0.55" fill="#D5CEED" opacity="0.5" />
      </g>
    </svg>
  );
}
