import { describe, expect, it } from "vitest";
import {
  advanceGuideFollow,
  defaultGuideFollowConfig,
  planGuideFollowTarget,
  type GuideMotionSnapshot,
} from "@/lib/three-d-guide-motion";

function snapshot(
  overrides: Partial<GuideMotionSnapshot> = {},
): GuideMotionSnapshot {
  return {
    position: [0, 2],
    velocity: [0, 0],
    yaw: 0,
    speed: 0,
    motion: "idle",
    target: [1.1, -0.3],
    side: 1,
    distanceToTarget: 2.5,
    stuckMs: 0,
    shouldReposition: false,
    ...overrides,
  };
}

function advanceFrames(
  initial: GuideMotionSnapshot,
  player: [number, number],
  yaw: number,
  frames: number,
  delta = 1 / 60,
) {
  let current = initial;
  for (let frame = 0; frame < frames; frame += 1) {
    const next = advanceGuideFollow(current, player, yaw, delta);
    current = {
      ...next,
      position: [
        current.position[0] + next.velocity[0] * delta,
        current.position[1] + next.velocity[1] * delta,
      ],
    };
  }
  return current;
}

describe("3D guide follow motion", () => {
  it("ramps velocity instead of starting at full speed", () => {
    const next = advanceGuideFollow(
      snapshot(),
      [0, 2.5],
      0,
      1 / 60,
    );
    expect(next.speed).toBeGreaterThan(0);
    expect(next.speed).toBeLessThanOrEqual(
      defaultGuideFollowConfig.acceleration / 60 + 0.0001,
    );
    expect(["idle", "turn", "walk"]).toContain(next.motion);
  });

  it("decelerates smoothly and settles inside the dead zone", () => {
    let current = advanceFrames(snapshot(), [0, 2.5], 0, 40);
    const beforeStop = current.speed;
    for (let index = 0; index < 180; index += 1) {
      const next = advanceGuideFollow(current, [0, 2.5], 0, 1 / 60);
      current = {
        ...next,
        position: [
          current.position[0] + next.velocity[0] / 60,
          current.position[1] + next.velocity[1] / 60,
        ],
      };
    }
    expect(beforeStop).toBeGreaterThan(0.5);
    expect(current.speed).toBeLessThan(0.08);
    expect(current.distanceToTarget).toBeLessThanOrEqual(
      defaultGuideFollowConfig.deadZone + 0.25,
    );
  });

  it("selects jog while catching up and reaches walk speed near the target", () => {
    const far = advanceFrames(
      snapshot({ position: [-2.5, 3] }),
      [0, 2.5],
      0,
      45,
    );
    expect(far.speed).toBeGreaterThan(0);
    expect(far.motion).toBe("jog");

    const jogging = {
      ...far,
      speed: 2,
      velocity: [1.5, -1.3] as [number, number],
    };
    const near = advanceGuideFollow(
      jogging,
      [0, 2.5],
      0,
      1 / 60,
    );
    expect(["walk", "jog"]).toContain(near.motion);
  });

  it("uses shortest-angle turning without flipping across the wrap point", () => {
    const current = snapshot({
      yaw: 3.08,
      position: [2, 2.5],
      target: [2.1, 3.2],
    });
    const next = advanceGuideFollow(current, [0, 2.5], Math.PI, 1 / 60);
    expect(Math.abs(next.yaw)).toBeLessThan(Math.PI);
    const shortestTurn = Math.abs(
      Math.atan2(
        Math.sin(next.yaw - current.yaw),
        Math.cos(next.yaw - current.yaw),
      ),
    );
    expect(shortestTurn).toBeLessThan(0.25);
  });

  it("moves the anchor away from a nearby wall side", () => {
    const rightWall = planGuideFollowTarget([3.8, 1], 0, 1);
    expect(rightWall.side).toBe(-1);
    expect(rightWall.target[0]).toBeLessThan(3.8);
  });

  it("keeps its previous side when both side-front anchors are clear", () => {
    const plan = planGuideFollowTarget([0, 2.5], 0, 1);
    expect(plan.side).toBe(1);
    expect(plan.target[0]).toBeGreaterThan(0);
  });

  it("repositions only after crossing the emergency distance", () => {
    const next = advanceGuideFollow(
      snapshot({ position: [-4, 3.1] }),
      [4, -3],
      Math.PI,
      1 / 60,
    );
    expect(next.shouldReposition).toBe(true);
    expect(next.speed).toBe(0);
  });
});
