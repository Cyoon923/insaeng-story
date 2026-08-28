import { AppHeader } from "@/components/layout/AppHeader";
import { MobileShell } from "@/components/layout/MobileShell";
import { FreeResultScreen } from "@/components/saju/FreeResultScreen";
import {
  buildAdjustedClimateSummary,
  buildFreeInterpretation,
  buildNeedCandidateSet,
  buildNeedResolution,
  buildStrengthSummary,
} from "@/lib/saju";
import { buildSpeakableOutput } from "@/lib/saju/speakable/buildSpeakableOutput";
import type { FourPillars } from "@/lib/saju/types";

/** Temporary fixture for UI verification only — RC-02 confirmed hour leaning-weak. */
const TEST_PILLARS: FourPillars = {
  year: { stem: "丙", branch: "午" },
  month: { stem: "戊", branch: "戌" },
  day: { stem: "甲", branch: "申" },
  hour: { stem: "甲", branch: "子" },
  hourCertainty: "confirmed",
  warnings: [],
};

/**
 * Temporary preview page: engine → Speakable → FreeInterpretation → FreeResultScreen.
 * Not linked from apply/payment/music/member flows.
 */
export default function FreeSajuResultPreviewPage() {
  const strength = buildStrengthSummary(TEST_PILLARS);
  const climate = buildAdjustedClimateSummary(TEST_PILLARS);
  const needCandidates = buildNeedCandidateSet(TEST_PILLARS);
  const needResolution = buildNeedResolution(TEST_PILLARS);

  const speakable = buildSpeakableOutput({
    strength,
    climate,
    needCandidates,
    needResolution,
    hourUnknown: TEST_PILLARS.hour === "unknown",
  });

  const interpretation = buildFreeInterpretation({
    speakable,
    strength,
    climate,
    needCandidates,
    needResolution,
  });

  return (
    <MobileShell hideBottomNav>
      <AppHeader variant="page" title="무료 결과 미리보기" backHref="/" showActions={false} />
      <p className="px-4 pt-3 text-[12px] leading-relaxed text-[#8b6f5c]">
        임시 검증 페이지입니다. 테스트 원국: 丙午 / 戊戌 / 甲申 / 甲子
      </p>
      <FreeResultScreen interpretation={interpretation} />
    </MobileShell>
  );
}
