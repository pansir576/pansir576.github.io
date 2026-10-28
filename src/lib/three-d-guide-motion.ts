import type { GuideMotionState } from "./types";

export interface GuideObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface GuideFollowConfig {
  aheadDistance: number;
  sideDistance: number;
  deadZone: number;
  minimumPlayerDistance: number;
  catchUpDistance: number;
  maximumSpeed: number;
  catchUpSpeed: number;
  acceleration: number;
  deceleration: number;
  turnResponse: number;
  guideRadius: number;
  repositionDistance: number;
  stuckTimeoutMs: number;
}

export interface GuideMotionSnapshot {
  position: [number, number];
  velocity: [number, number];
  yaw: number;
  speed: number;
  motion: GuideMotionState;
  target: [number, number];
  side: 1 | -1;
  distanceToTarget: number;
  stuckMs: number;
  shouldReposition: boolean;
}

export const guideObstacles: GuideObstacle[] = [
  { minX: -4.2, maxX: -1.9, minZ: -1.33, maxZ: -0.18 },
  { minX: 1.98, maxX: 4.13, minZ: -1.33, maxZ: -0.18 },
  { minX: -1.63, maxX: 1.63, minZ: -0.33, maxZ: 1.03 },
  { minX: -1.28, maxX: 1.28, minZ: 1.82, maxZ: 2.88 },
  { minX: -4.36, maxX: -3.24, minZ: -3.91, maxZ: -3.19 },
];

export const defaultGuideFollowConfig: GuideFollowConfig = {
  aheadDistance: 2.65,
  sideDistance: 1.35,
  deadZone: 0.3,
  minimumPlayerDistance: 1.8,
  catchUpDistance: 3.2,
  maximumSpeed: 2.1,
  catchUpSpeed: 3.2,
  acceleration: 5.8,
  deceleration: 8.5,
  turnResponse: 8,
  guideRadius: 0.24,
  repositionDistance: 8,
  stuckTimeoutMs: 1500,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shortestAngleDifference(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function dampAngle(current: number, target: number, response: number, dt: number) {
  const difference = shortestAngleDifference(current, target);
  return current + difference * (1 - Math.exp(-response * dt));
}

function pointClearance(
  x: number,
  z: number,
  obstacles: GuideObstacle[],
  radius: number,
) {
  let clearance = Number.POSITIVE_INFINITY;
  for (const obstacle of obstacles) {
    const dx = Math.max(obstacle.minX - x, 0, x - obstacle.maxX);
    const dz = Math.max(obstacle.minZ - z, 0, z - obstacle.maxZ);
    clearance = Math.min(clearance, Math.hypot(dx, dz) - radius);
  }
  return clearance;
}

function candidateTarget(
  player: [number, number],
  forward: [number, number],
  right: [number, number],
  ahead: number,
  side: number,
): [number, number] {
  return [
    clamp(player[0] + forward[0] * ahead + right[0] * side, -4.2, 4.2),
    clamp(player[1] + forward[1] * ahead + right[1] * side, -3.25, 3.55),
  ];
}

export function planGuideFollowTarget(
  player: [number, number],
  playerYaw: number,
  previousSide: 1 | -1,
  config = defaultGuideFollowConfig,
  obstacles = guideObstacles,
): { target: [number, number]; side: 1 | -1 } {
  const forward: [number, number] = [
    -Math.sin(playerYaw),
    -Math.cos(playerYaw),
  ];
  const right: [number, number] = [
    Math.cos(playerYaw),
    -Math.sin(playerYaw),
  ];
  const safeRearDistance = -config.minimumPlayerDistance * 0.92;
  const candidates: { side: 1 | -1; ahead: number }[] = [
    { side: previousSide, ahead: config.aheadDistance },
    { side: previousSide === 1 ? -1 : 1, ahead: config.aheadDistance },
    { side: previousSide, ahead: 0.9 },
    { side: previousSide === 1 ? -1 : 1, ahead: 0.9 },
    { side: previousSide, ahead: safeRearDistance },
    { side: previousSide === 1 ? -1 : 1, ahead: safeRearDistance },
  ];

  let fallbackTarget = candidateTarget(
    player,
    forward,
    right,
    candidates[0].ahead,
    candidates[0].side * config.sideDistance,
  );
  let fallbackSide = candidates[0].side;
  let bestClearance = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const point = candidateTarget(
      player,
      forward,
      right,
      candidate.ahead,
      candidate.side * config.sideDistance,
    );
    const clearance = pointClearance(
      point[0],
      point[1],
      obstacles,
      config.guideRadius,
    );
    const boundaryClearance =
      Math.min(4.2 - point[0], point[0] + 4.2, 3.55 - point[1], point[1] + 3.25) -
      config.guideRadius;
    const usableClearance = Math.min(clearance, boundaryClearance);
    if (usableClearance >= 0) {
      return { target: point, side: candidate.side };
    }
    if (usableClearance > bestClearance) {
      fallbackTarget = point;
      fallbackSide = candidate.side;
      bestClearance = usableClearance;
    }
  }

  return {
    target: fallbackTarget,
    side: fallbackSide,
  };
}

export function advanceGuideFollow(
  current: GuideMotionSnapshot,
  player: [number, number],
  playerYaw: number,
  dt: number,
  config = defaultGuideFollowConfig,
  obstacles = guideObstacles,
): GuideMotionSnapshot {
  const safeDelta = clamp(dt, 0, 0.1);
  const plan = planGuideFollowTarget(
    player,
    playerYaw,
    current.side,
    config,
    obstacles,
  );
  const dx = plan.target[0] - current.position[0];
  const dz = plan.target[1] - current.position[1];
  const distanceToTarget = Math.hypot(dx, dz);

  if (distanceToTarget > config.repositionDistance) {
    return {
      ...current,
      position: plan.target,
      velocity: [0, 0],
      yaw: Math.atan2(
        player[0] - plan.target[0],
        player[1] - plan.target[1],
      ),
      speed: 0,
      motion: "idle",
      target: plan.target,
      side: plan.side,
      distanceToTarget: 0,
      stuckMs: 0,
      shouldReposition: true,
    };
  }

  const speed = Math.hypot(current.velocity[0], current.velocity[1]);
  const stuckMs =
    distanceToTarget > config.deadZone + 0.35 && speed < 0.08
      ? current.stuckMs + safeDelta * 1000
      : 0;
  if (stuckMs >= config.stuckTimeoutMs) {
    return {
      ...current,
      position: plan.target,
      velocity: [0, 0],
      yaw: Math.atan2(
        player[0] - plan.target[0],
        player[1] - plan.target[1],
      ),
      speed: 0,
      motion: "idle",
      target: plan.target,
      side: plan.side,
      distanceToTarget: 0,
      stuckMs: 0,
      shouldReposition: true,
    };
  }

  const desiredDirection: [number, number] =
    distanceToTarget <= config.deadZone
      ? [0, 0]
      : [dx / distanceToTarget, dz / distanceToTarget];

  const probeDistance = 0.65;
  const probe = (direction: [number, number]) =>
    pointClearance(
      current.position[0] + direction[0] * probeDistance,
      current.position[1] + direction[1] * probeDistance,
      obstacles,
      config.guideRadius,
    ) < 0;
  const blockedAhead = probe(desiredDirection);
  const leftDirection: [number, number] = [
    -desiredDirection[1],
    desiredDirection[0],
  ];
  const rightDirection: [number, number] = [
    desiredDirection[1],
    -desiredDirection[0],
  ];
  const blockedLeft = probe(leftDirection);
  const blockedRight = probe(rightDirection);

  let steerX = desiredDirection[0];
  let steerZ = desiredDirection[1];
  if (blockedAhead) {
    if (blockedLeft !== blockedRight) {
      const detour = blockedLeft ? rightDirection : leftDirection;
      steerX = steerX * 0.45 + detour[0];
      steerZ = steerZ * 0.45 + detour[1];
    } else {
      const preferred =
        pointClearance(
          current.position[0] + rightDirection[0] * probeDistance,
          current.position[1] + rightDirection[1] * probeDistance,
          obstacles,
          config.guideRadius,
        ) >=
        pointClearance(
          current.position[0] + leftDirection[0] * probeDistance,
          current.position[1] + leftDirection[1] * probeDistance,
          obstacles,
          config.guideRadius,
        )
          ? rightDirection
          : leftDirection;
      steerX = steerX * 0.35 + preferred[0];
      steerZ = steerZ * 0.35 + preferred[1];
    }
  }
  const steerLength = Math.hypot(steerX, steerZ);
  if (steerLength > 0.001) {
    steerX /= steerLength;
    steerZ /= steerLength;
  }

  const distanceBeyondDeadZone = Math.max(
    0,
    distanceToTarget - config.deadZone,
  );
  const targetSpeed =
    distanceBeyondDeadZone <= 0
      ? 0
      : distanceToTarget > config.catchUpDistance
        ? config.catchUpSpeed
        : clamp(
            config.maximumSpeed * (distanceBeyondDeadZone / 1.15),
            0,
            config.maximumSpeed,
          );
  const desiredVelocity: [number, number] = [
    steerX * targetSpeed,
    steerZ * targetSpeed,
  ];
  const velocityDeltaX = desiredVelocity[0] - current.velocity[0];
  const velocityDeltaZ = desiredVelocity[1] - current.velocity[1];
  const velocityDeltaLength = Math.hypot(velocityDeltaX, velocityDeltaZ);
  const changingSpeed = targetSpeed > speed;
  const maxVelocityChange =
    (changingSpeed ? config.acceleration : config.deceleration) * safeDelta;
  const velocityScale =
    velocityDeltaLength > maxVelocityChange && velocityDeltaLength > 0
      ? maxVelocityChange / velocityDeltaLength
      : 1;
  let nextVelocity: [number, number] = [
    current.velocity[0] + velocityDeltaX * velocityScale,
    current.velocity[1] + velocityDeltaZ * velocityScale,
  ];
  const nextSpeed = Math.hypot(nextVelocity[0], nextVelocity[1]);
  if (nextSpeed > config.catchUpSpeed) {
    nextVelocity = [
      (nextVelocity[0] / nextSpeed) * config.catchUpSpeed,
      (nextVelocity[1] / nextSpeed) * config.catchUpSpeed,
    ];
  }

  const facingTarget =
    nextSpeed > 0.14
      ? Math.atan2(nextVelocity[0], nextVelocity[1])
      : Math.atan2(player[0] - current.position[0], player[1] - current.position[1]);
  const yaw = dampAngle(
    current.yaw,
    facingTarget,
    config.turnResponse,
    safeDelta,
  );
  const turnAmount = Math.abs(shortestAngleDifference(current.yaw, facingTarget));
  const motion: GuideMotionState =
    nextSpeed < 0.12
      ? turnAmount > 0.2
        ? "turn"
        : "idle"
      : nextSpeed > 1.55
        ? "jog"
        : "walk";
  const normalizedYaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));

  return {
    position: current.position,
    velocity: nextVelocity,
    yaw: normalizedYaw,
    speed: nextSpeed,
    motion,
    target: plan.target,
    side: plan.side,
    distanceToTarget,
    stuckMs,
    shouldReposition: false,
  };
}
