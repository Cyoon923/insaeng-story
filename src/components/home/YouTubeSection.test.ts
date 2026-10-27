/**
 * 홈 유튜브 영상 카드: 한 번 섞기와 다음 자동 이동 위치 계산.
 *
 * 실행: npx tsx --test src/components/home/YouTubeSection.test.ts
 *
 * 화면 렌더러가 없어 순수 함수만 확인한다. 타이머·정지 조건·스크롤 동작은 브라우저에서 확인한다.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { __youTubeSectionInternals } from "@/components/home/YouTubeSection";

const { shuffled, nextScrollLeft } = __youTubeSectionInternals;

test("shuffled: 같은 원소의 순열을 새 배열로 돌려주고 입력은 바꾸지 않는다", () => {
  const input = ["a", "b", "c", "d", "e"];
  const before = [...input];
  let seed = 0.37;
  const random = () => {
    seed = (seed * 9301 + 0.49297) % 1;
    return seed;
  };
  const result = shuffled(input, random);
  assert.notEqual(result, input);
  assert.deepEqual(input, before);
  assert.deepEqual([...result].sort(), before);
  // random이 늘 0에 가까우면 Fisher–Yates는 첫 원소를 끝으로 밀어낸 결정적 순서가 된다.
  assert.deepEqual(shuffled(input, () => 0), ["b", "c", "d", "e", "a"]);
  assert.deepEqual(shuffled([], () => 0.5), []);
});

// 카드 138px + 간격 10px, 컨테이너 기준 왼쪽 위치. 화면 폭 343px이면 최대 스크롤 = 148*6-10-343 = 535.
const POSITIONS = [0, 148, 296, 444, 592, 740];
const MAX = 535;

test("nextScrollLeft: 현재보다 오른쪽 첫 카드로 한 칸", () => {
  assert.equal(nextScrollLeft(POSITIONS, 0, MAX), 148);
  assert.equal(nextScrollLeft(POSITIONS, 148, MAX), 296);
  // 수동 스크롤로 카드 사이에 멈춰 있으면 다음 카드 시작으로 맞춘다.
  assert.equal(nextScrollLeft(POSITIONS, 200, MAX), 296);
  // 1px 이내 오차는 같은 카드로 본다.
  assert.equal(nextScrollLeft(POSITIONS, 147.5, MAX), 296);
});

test("nextScrollLeft: 마지막 카드 근처는 최대 스크롤로 자르고, 끝이면 0으로 되감는다", () => {
  assert.equal(nextScrollLeft(POSITIONS, 444, MAX), MAX);
  assert.equal(nextScrollLeft(POSITIONS, MAX, MAX), 0);
  assert.equal(nextScrollLeft(POSITIONS, MAX - 0.5, MAX), 0);
});

test("nextScrollLeft: 넘칠 카드가 없으면 이동하지 않는다(null)", () => {
  assert.equal(nextScrollLeft(POSITIONS, 0, 0), null);
  assert.equal(nextScrollLeft(POSITIONS, 0, -20), null);
  assert.equal(nextScrollLeft([0], 0, 100), null);
});
