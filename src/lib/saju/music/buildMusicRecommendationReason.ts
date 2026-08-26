import type { FreeInterpretation } from "@/lib/saju/interpretation/types";
import type {
  MusicRecommendationCandidate,
  MusicRecommendationGate,
  MusicRecommendationReasonView,
} from "@/lib/saju/music/types";
import type { ObservationInterpretation } from "@/lib/saju/observation/interpretation/types";
import type { MusicRecommendationHints } from "@/lib/saju/speakable/types";

const FORBIDDEN_USER_FRAGMENTS = [
  "용신",
  "희신",
  "필요한 오행",
  "필요해서",
  "부족",
  "DIRECT",
  "PROVISIONAL",
  "CONTEXTUAL",
  "HOLD",
  "supported-soft",
  "context-soft",
  "matchedElements",
  "generation-support",
  "pressure-visible-stem",
] as const;

function uniqueBadges(badges: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const badge of badges) {
    if (!badge || seen.has(badge)) continue;
    seen.add(badge);
    out.push(badge);
  }
  return out;
}

function climateTonePhrase(free: FreeInterpretation | undefined): string | null {
  const explanation = free?.explanation?.trim() ?? "";
  if (explanation.includes("따뜻") && explanation.includes("메마")) {
    return "따뜻하고 메마른 성향을 참고해";
  }
  if (explanation.includes("서늘") && explanation.includes("메마")) {
    return "서늘하고 메마른 성향을 참고해";
  }
  if (explanation.includes("따뜻")) return "따뜻한 성향을 참고해";
  if (explanation.includes("서늘") || explanation.includes("차분하고 서늘")) {
    return "서늘한 성향을 참고해";
  }
  if (explanation.includes("메마")) return "메마른 성향을 참고해";

  const climateText = free?.climateNotes.map((item) => item.text).join(" ") ?? "";
  if (climateText.includes("따뜻") && climateText.includes("메마")) {
    return "따뜻하고 메마른 성향을 참고해";
  }
  if (climateText.includes("따뜻")) return "따뜻한 성향을 참고해";
  if (climateText.includes("서늘") || climateText.includes("차가")) {
    return "서늘한 성향을 참고해";
  }
  if (climateText.includes("메마") || climateText.includes("건조")) {
    return "메마른 성향을 참고해";
  }
  return null;
}

function moodAtmospherePhrase(
  candidate: MusicRecommendationCandidate,
  hints: MusicRecommendationHints,
): string {
  const moods =
    candidate.match.matchedMoodTags.length > 0
      ? candidate.match.matchedMoodTags
      : hints.moodTags.slice(0, 2);

  if (moods.includes("감싸는") || moods.includes("촉촉한")) {
    return "차분하고 감싸는 분위기";
  }
  if (moods.includes("잔잔한") || moods.includes("차분한")) {
    return "잔잔하고 편안한 분위기";
  }
  if (moods.includes("따뜻한")) {
    return "따뜻한 분위기";
  }
  if (moods.length >= 2) {
    return `${moods[0]} ${moods[1]} 분위기`;
  }
  if (moods[0]) {
    return `${moods[0]} 분위기`;
  }
  return "편안하게 들을 수 있는 분위기";
}

function observationSoftClause(
  observation: ObservationInterpretation | undefined,
): string | null {
  if (!observation) return null;
  if (observation.coexistence) {
    return "사주 안에서 여러 성질이 함께 보이는 만큼, 한쪽으로 치우치지 않는 분위기의 곡을 골랐어요.";
  }
  if (observation.actingStructures.length > 0 && observation.helpingRelations.length > 0) {
    return "사주 안에서 여러 모습이 함께 보이는 만큼, 한쪽으로 치우치지 않는 분위기의 곡을 골랐어요.";
  }
  return null;
}

function buildContextualReason(input: {
  free: FreeInterpretation | undefined;
  candidate: MusicRecommendationCandidate;
  hints: MusicRecommendationHints;
  observation: ObservationInterpretation | undefined;
}): string {
  const tone = climateTonePhrase(input.free);
  const mood = moodAtmospherePhrase(input.candidate, input.hints);
  const obs = observationSoftClause(input.observation);

  if (tone) {
    return `${tone}, ${mood}의 곡을 골랐어요.`;
  }
  if (obs) return obs;
  return `${mood}의 곡을 골랐어요.`;
}


function buildBadges(
  gate: MusicRecommendationGate,
  observation: ObservationInterpretation | undefined,
): string[] {
  const badges: string[] = [];
  switch (gate.state) {
    case "DIRECT":
      badges.push("분위기 추천");
      break;
    case "PROVISIONAL":
      badges.push("잠정 추천");
      badges.push("분위기 추천");
      break;
    case "CONTEXTUAL":
      badges.push("환경 참고");
      badges.push("분위기 추천");
      break;
    case "HOLD":
      badges.push("편안하게 듣기");
      break;
  }
  if (observation?.coexistence && gate.state !== "HOLD") {
    badges.push("분위기 추천");
  }
  return uniqueBadges(badges);
}

function buildCoreReason(
  gate: MusicRecommendationGate,
  input: {
    free: FreeInterpretation | undefined;
    candidate: MusicRecommendationCandidate;
    hints: MusicRecommendationHints;
    observation: ObservationInterpretation | undefined;
  },
): string {
  switch (gate.state) {
    case "DIRECT":
      return "지금 살펴본 보완 방향과 이 곡의 분위기가 잘 맞아요.";
    case "PROVISIONAL":
      return "잠정적으로 살펴본 방향과 어울리는 분위기의 곡이에요.";
    case "CONTEXTUAL":
      return buildContextualReason(input);
    case "HOLD":
      return "지금은 한쪽 기운을 정하기보다 편안하게 들을 수 있는 분위기를 중심으로 골랐어요.";
  }
}

/** Test helper: user-facing copy must stay plain and non-prescriptive. */
export function assertMusicRecommendationReasonCopySafe(view: MusicRecommendationReasonView): void {
  const text = [view.title, view.message, view.reason, ...view.badges].join("\n");
  for (const fragment of FORBIDDEN_USER_FRAGMENTS) {
    if (text.includes(fragment)) {
      throw new Error(`Forbidden fragment in music recommendation reason: ${fragment}`);
    }
  }
  // Element names as “needed” patterns
  if (/[木火土金水].*(필요|부족|용신)/.test(text) || /(필요|부족).*[木火土金水]/.test(text)) {
    throw new Error("Forbidden element-need phrasing in music recommendation reason");
  }
}

/**
 * Attach a user-facing recommendation reason to an already-selected candidate.
 * Does not re-filter or re-rank catalog rows. Observation is explanation-only.
 */
export function buildMusicRecommendationReason(input: {
  gate: MusicRecommendationGate;
  candidate: MusicRecommendationCandidate;
  hints: MusicRecommendationHints;
  freeInterpretation?: FreeInterpretation;
  observationInterpretation?: ObservationInterpretation;
}): MusicRecommendationReasonView {
  const { gate, candidate, hints } = input;
  const reason = buildCoreReason(gate, {
    free: input.freeInterpretation,
    candidate,
    hints,
    observation: input.observationInterpretation,
  });

  const view: MusicRecommendationReasonView = {
    title: candidate.record.title,
    message: candidate.record.message,
    reason,
    badges: buildBadges(gate, input.observationInterpretation),
  };

  assertMusicRecommendationReasonCopySafe(view);
  return view;
}
