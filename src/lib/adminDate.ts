/**
 * 관리자 화면 날짜·시각 표시("YYYY.MM.DD HH:mm", 한국 시각).
 *
 * 저장값은 UTC ISO다. 예전에는 문자열을 그대로 잘라 UTC 시각이 보였다.
 * 시각과 시간대(Z 또는 +hh:mm)가 있는 값만 +9시간 옮겨 보여 주고, 날짜만 있거나
 * 읽을 수 없는 값은 예전처럼 그대로 자른다(없는 시간대를 추측하지 않는다).
 * 한국은 서머타임이 없어 고정 오프셋으로 충분하다. 저장값은 바꾸지 않는다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ZONED_ISO = /T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/;

function display(iso: string): string {
  return iso.slice(0, 16).replace("T", " ").replaceAll("-", ".");
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "-";
  const time = Date.parse(value);
  if (!ZONED_ISO.test(value) || Number.isNaN(time)) return display(value);
  return display(new Date(time + KST_OFFSET_MS).toISOString());
}
