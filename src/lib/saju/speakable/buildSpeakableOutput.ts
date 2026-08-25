import type { Element, NeedCandidate } from "@/lib/saju/types";
import type {
  MusicRecommendationHints,
  SpeakableConfidence,
  SpeakableFallbackCode,
  SpeakableInput,
  SpeakableOutput,
  SpeakableProvenance,
  SpeakableStatus,
  SpeakableTheme,
} from "@/lib/saju/speakable/types";

const MUSIC_FORBIDDEN = [
  "용신 확정",
  "희신 확정",
  "필요한 오행 확정",
  "신강입니다",
  "신약입니다",
  "한습합니다",
  "조열합니다",
  "Climate가 이겼습니다",
  "필요한 오행이 없습니다",
  "용신 확정·두 이론 일치",
  "사주가 나쁨",
  "분석 오류",
  "convergent=정답",
  "대운",
  "세운",
  "월운",
  "일운",
] as const;

function isActive(candidate: NeedCandidate): boolean {
  return candidate.status === "candidate";
}

function uniqueElements(elements: Element[]): Element[] {
  const seen = new Set<Element>();
  const out: Element[] = [];
  for (const element of elements) {
    if (seen.has(element)) continue;
    seen.add(element);
    out.push(element);
  }
  return out;
}

function theme(
  id: string,
  kind: SpeakableTheme["kind"],
  phrase: string,
  provenance: SpeakableProvenance[],
  elements?: Element[],
): SpeakableTheme {
  return elements && elements.length > 0
    ? { id, kind, phrase, elements, provenance }
    : { id, kind, phrase, provenance };
}

function buildStrengthObservation(
  input: SpeakableInput,
  hourUnknownProvisional: boolean,
  fallbacks: SpeakableFallbackCode[],
): SpeakableTheme[] {
  const direction = input.strength.directionCandidate;
  const baseProv: SpeakableProvenance[] = [
    { layer: "strength", evidenceRef: `strength.directionCandidate=${String(direction)}` },
  ];

  if (hourUnknownProvisional) {
    baseProv.push({
      layer: "strength",
      evidenceRef: "strength.directionSensitivity=hour-unknown-provisional",
    });
  }

  if (direction === "leaning-strong") {
    const phrase = hourUnknownProvisional
      ? "시간이 확실해지면 달라질 수 있는 잠정 관찰이에요. 지금은 힘이 실리는 쪽으로 기울어 보일 수 있어요."
      : "지금 흐름은 힘이 실리는 쪽으로 기울어 보일 수 있어요.";
    return [theme("obs-strength-leaning-strong", "strength-observation", phrase, baseProv)];
  }

  if (direction === "leaning-weak") {
    const phrase = hourUnknownProvisional
      ? "시간이 확실해지면 달라질 수 있는 잠정 관찰이에요. 지금은 기대어 쉬어가는 쪽으로 읽힐 수 있어요."
      : "지금은 기대어 쉬어가는 쪽으로 읽힐 수 있어요.";
    return [theme("obs-strength-leaning-weak", "strength-observation", phrase, baseProv)];
  }

  if (direction === "mixed") {
    fallbacks.push("FB-STRENGTH-MIXED");
    return [
      theme(
        "obs-strength-mixed",
        "strength-observation",
        "방향이 한쪽으로 단정되지 않아요.",
        baseProv,
      ),
    ];
  }

  fallbacks.push("FB-STRENGTH-NULL");
  return [
    theme(
      "obs-strength-null",
      "strength-observation",
      "방향이 한쪽으로 단정되지 않아요.",
      baseProv,
    ),
  ];
}

function buildStrengthNeedThemes(
  input: SpeakableInput,
  allowStrengthNeed: boolean,
  fallbacks: SpeakableFallbackCode[],
): { support: SpeakableTheme[]; caution: SpeakableTheme[] } {
  if (!allowStrengthNeed) {
    if (
      input.needCandidates.strengthNeedStatus === "unresolved" ||
      input.strength.directionSensitivity === "hour-unknown-provisional"
    ) {
      if (!fallbacks.includes("FB-STRENGTH-NEED-GATED")) {
        fallbacks.push("FB-STRENGTH-NEED-GATED");
      }
    }
    return { support: [], caution: [] };
  }

  const active = input.needCandidates.strengthNeedCandidates.filter(isActive);
  const support: SpeakableTheme[] = [];
  const caution: SpeakableTheme[] = [];

  for (const candidate of active) {
    const provenance: SpeakableProvenance[] = [
      {
        layer: "need-strength",
        evidenceRef: `need.strength.element=${candidate.element}`,
      },
      {
        layer: "need-strength",
        evidenceRef: `need.strength.reason=${candidate.reasons[0] ?? candidate.direction}`,
      },
    ];

    if (candidate.direction === "peer" || candidate.direction === "resource") {
      const phrase =
        candidate.direction === "peer"
          ? "이야기·가사에서는 서로 기대는 이미지가 후보예요."
          : "이야기·가사에서는 채워주는 이미지가 후보예요.";
      support.push(
        theme(
          `need-strength-${candidate.direction}-${candidate.element}`,
          "need-strength-candidate",
          phrase,
          provenance,
          [candidate.element],
        ),
      );
    } else if (
      candidate.direction === "output" ||
      candidate.direction === "wealth" ||
      candidate.direction === "official"
    ) {
      caution.push(
        theme(
          `need-strength-${candidate.direction}-${candidate.element}`,
          "need-strength-candidate",
          "내보내기·쓰임·다스림 쪽 이미지가 후보로 열려 있어요.",
          provenance,
          [candidate.element],
        ),
      );
    }
  }

  return { support, caution };
}

function buildClimateThemes(
  input: SpeakableInput,
  fallbacks: SpeakableFallbackCode[],
): SpeakableTheme[] {
  const themes: SpeakableTheme[] = [];
  const { temperature, moisture } = input.climate;
  let axisUnresolved = false;

  if (temperature.status === "unresolved") {
    axisUnresolved = true;
  } else if (temperature.status === "resolved" && temperature.value === "cold") {
    themes.push(
      theme(
        "climate-obs-cold",
        "climate-observation",
        "기운이 다소 서늘한 쪽으로 보여요.",
        [
          { layer: "climate", evidenceRef: "climate.temperature=cold" },
          { layer: "climate", evidenceRef: "climate.temperature.status=resolved" },
        ],
      ),
    );
  } else if (temperature.status === "resolved" && temperature.value === "warm") {
    themes.push(
      theme(
        "climate-obs-warm",
        "climate-observation",
        "기운이 다소 따뜻한 쪽으로 보여요.",
        [
          { layer: "climate", evidenceRef: "climate.temperature=warm" },
          { layer: "climate", evidenceRef: "climate.temperature.status=resolved" },
        ],
      ),
    );
  }

  if (moisture.status === "unresolved") {
    axisUnresolved = true;
  } else if (moisture.status === "resolved" && moisture.value === "dry") {
    // NEED-022 / CLI-043 contested inheritance: observation stays provisional wording only
    themes.push(
      theme(
        "climate-obs-dry",
        "climate-observation",
        "조금 건조한 결이 보일 수 있어요(잠정).",
        [
          { layer: "climate", evidenceRef: "climate.moisture=dry" },
          { layer: "climate", evidenceRef: "climate.moisture.status=resolved" },
          { layer: "climate", evidenceRef: "climate.boundary=contested-inherited" },
        ],
      ),
    );
  }

  if (axisUnresolved && !fallbacks.includes("FB-CLIMATE-AXIS-UNRESOLVED")) {
    fallbacks.push("FB-CLIMATE-AXIS-UNRESOLVED");
  }

  for (const candidate of input.needCandidates.climateNeedCandidates.filter(isActive)) {
    const reason = candidate.reasons[0] ?? "climate";
    const contestedDry = reason === "climate-moisture-dry";
    const phrase = contestedDry
      ? "촉촉하게 감싸는 이미지가 후보일 수 있어요(잠정)."
      : reason === "climate-temperature-cold"
        ? "따뜻함을 더하는 불 이미지가 후보일 수 있어요."
        : reason === "climate-temperature-warm"
          ? "식혀 주는 물 이미지가 후보일 수 있어요."
          : "기후 결의 이미지가 후보일 수 있어요.";

    const provenance: SpeakableProvenance[] = [
      { layer: "need-climate", evidenceRef: `need.climate.element=${candidate.element}` },
      { layer: "need-climate", evidenceRef: `need.climate.reason=${reason}` },
    ];
    if (contestedDry) {
      provenance.push({
        layer: "need-climate",
        evidenceRef: "need.climate.boundary=contested-inherited",
      });
    }

    themes.push(
      theme(
        `need-climate-${reason}-${candidate.element}`,
        "need-climate-candidate",
        phrase,
        provenance,
        [candidate.element],
      ),
    );
  }

  return themes;
}

function buildMusicHints(input: {
  observationThemes: SpeakableTheme[];
  supportThemes: SpeakableTheme[];
  cautionThemes: SpeakableTheme[];
  climateThemes: SpeakableTheme[];
  allowStrengthNeedElements: boolean;
  hourUnknownProvisional: boolean;
  strengthDirection: SpeakableInput["strength"]["directionCandidate"];
  needCandidates: SpeakableInput["needCandidates"];
}): MusicRecommendationHints {
  const moodTags: string[] = [];
  const provenance: SpeakableProvenance[] = [];

  if (input.hourUnknownProvisional) {
    // story-first: at most one soft tag
    moodTags.push("잔잔한");
    provenance.push({
      layer: "strength",
      evidenceRef: "music.mood=story-first-hour-unknown",
    });
  } else if (input.strengthDirection === "leaning-strong") {
    moodTags.push("힘있는", "펼치는");
    provenance.push({
      layer: "strength",
      evidenceRef: "music.mood=leaning-strong",
    });
  } else if (input.strengthDirection === "leaning-weak") {
    moodTags.push("기대는", "채워지는");
    provenance.push({
      layer: "strength",
      evidenceRef: "music.mood=leaning-weak",
    });
  }

  for (const climateTheme of input.climateThemes) {
    if (climateTheme.id.includes("cold") || climateTheme.phrase.includes("불")) {
      if (!moodTags.includes("따뜻한")) moodTags.push("따뜻한", "녹이는");
    }
    if (climateTheme.id.includes("dry") || climateTheme.phrase.includes("감싸")) {
      if (!moodTags.includes("촉촉한")) moodTags.push("촉촉한", "감싸는");
    }
    provenance.push(...climateTheme.provenance);
  }

  const lyricHints = [
    ...input.observationThemes,
    ...input.supportThemes,
    ...input.cautionThemes,
    ...input.climateThemes,
  ].map((item) => item.phrase);

  const bagElements: Element[] = [];
  if (input.allowStrengthNeedElements) {
    for (const candidate of input.needCandidates.strengthNeedCandidates.filter(isActive)) {
      bagElements.push(candidate.element);
      provenance.push({
        layer: "need-strength",
        evidenceRef: `music.bag.strength=${candidate.element}`,
      });
    }
  }
  for (const candidate of input.needCandidates.climateNeedCandidates.filter(isActive)) {
    bagElements.push(candidate.element);
    provenance.push({
      layer: "need-climate",
      evidenceRef: `music.bag.climate=${candidate.element}`,
    });
  }

  return {
    moodTags: [...new Set(moodTags)],
    lyricHints,
    elementThemeBag: uniqueElements(bagElements),
    forbidden: [...MUSIC_FORBIDDEN],
    provenance,
  };
}

function resolveStatus(input: {
  hourUnknownProvisional: boolean;
  strengthNullOrMixed: boolean;
  climateUnresolved: boolean;
  blocked: boolean;
  themeCount: number;
}): { speakableStatus: SpeakableStatus; confidence: SpeakableConfidence } {
  if (input.hourUnknownProvisional) {
    return { speakableStatus: "partial-hold", confidence: "partial" };
  }
  if (input.strengthNullOrMixed && input.climateUnresolved) {
    return { speakableStatus: "diagnostic-only", confidence: "hold" };
  }
  if (input.themeCount === 0) {
    return { speakableStatus: "diagnostic-only", confidence: "hold" };
  }
  if (input.blocked) {
    return { speakableStatus: "partial-hold", confidence: "partial" };
  }
  if (input.strengthNullOrMixed) {
    return { speakableStatus: "partial-hold", confidence: "partial" };
  }
  return { speakableStatus: "ready-provisional", confidence: "provisional" };
}

export function buildSpeakableOutput(input: SpeakableInput): SpeakableOutput {
  const fallbacks: SpeakableFallbackCode[] = [];
  const hourUnknownProvisional =
    input.strength.directionSensitivity === "hour-unknown-provisional";

  if (hourUnknownProvisional) {
    fallbacks.push("FB-HOUR-UNKNOWN-PROVISIONAL");
  }

  const allowStrengthNeed =
    !hourUnknownProvisional &&
    input.needCandidates.strengthNeedStatus === "ready" &&
    input.needCandidates.strengthNeedCandidates.some(isActive);

  if (
    input.needCandidates.strengthNeedCandidates.some((item) => item.status === "suppressed")
  ) {
    fallbacks.push("FB-NEED-015-NO-CLAIM");
  }

  if (input.needResolution.decisionBlockedBy.length > 0) {
    fallbacks.push("FB-RESOLUTION-BLOCKED");
  }

  const observationThemes = buildStrengthObservation(input, hourUnknownProvisional, fallbacks);
  const { support: supportThemes, caution: cautionThemes } = buildStrengthNeedThemes(
    input,
    allowStrengthNeed,
    fallbacks,
  );
  const climateThemes = buildClimateThemes(input, fallbacks);

  const themeCount =
    observationThemes.length +
    supportThemes.length +
    cautionThemes.length +
    climateThemes.length;

  if (themeCount === 0 || (themeCount <= 1 && input.strength.directionCandidate === null)) {
    if (!fallbacks.includes("FB-STORY-FIRST")) fallbacks.push("FB-STORY-FIRST");
  }

  const strengthNullOrMixed =
    input.strength.directionCandidate === null || input.strength.directionCandidate === "mixed";
  const climateUnresolved =
    input.climate.temperature.status === "unresolved" ||
    input.climate.moisture.status === "unresolved";

  const { speakableStatus, confidence } = resolveStatus({
    hourUnknownProvisional,
    strengthNullOrMixed,
    climateUnresolved,
    blocked: input.needResolution.decisionBlockedBy.length > 0,
    themeCount,
  });

  const musicRecommendationHints = buildMusicHints({
    observationThemes,
    supportThemes,
    cautionThemes,
    climateThemes,
    allowStrengthNeedElements: allowStrengthNeed,
    hourUnknownProvisional,
    strengthDirection: input.strength.directionCandidate,
    needCandidates: input.needCandidates,
  });

  return {
    speakableStatus,
    confidence,
    provisional: true,
    hourUnknown: input.hourUnknown,
    hourUnknownProvisional,
    observationThemes,
    supportThemes,
    cautionThemes,
    climateThemes,
    musicRecommendationHints,
    internal: {
      strengthDirection: input.strength.directionCandidate,
      strengthNeedStatus: input.needCandidates.strengthNeedStatus,
      climateNeedStatus: input.needCandidates.climateNeedStatus,
      relationPattern: input.needResolution.relationPattern,
      resolutionStatus: input.needResolution.status,
      decisionBlockedBy: [...input.needResolution.decisionBlockedBy],
    },
    fallbackApplied: [...new Set(fallbacks)],
  };
}
