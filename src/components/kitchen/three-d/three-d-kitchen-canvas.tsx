"use client";
/* eslint-disable react-hooks/immutability */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  RoundedBox,
} from "@react-three/drei";
import {
  CapsuleCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { getIngredient } from "@/lib/ingredients";
import { cutStageFor } from "@/lib/three-d-game";
import type {
  CutStage,
  GuideMotionState,
  HeatBand,
  InteractionTarget,
  ThreeDGuideId,
  ThreeDStation,
  ThreeDTrainingSession,
} from "@/lib/types";
import {
  advanceGuideFollow,
  type GuideMotionSnapshot,
} from "@/lib/three-d-guide-motion";
import { ThreeDGuideModel } from "./three-d-guide-model";
import { KnifeModel, ThreeDIngredientModel } from "./three-d-ingredient-model";
import { useKitchenTextures } from "./three-d-materials";

export interface JoystickInput {
  x: number;
  z: number;
}

export interface TeleportRequest {
  nonce: number;
  stationId: ThreeDStation;
}

export interface SharedPlayerPose {
  position: [number, number, number];
  yaw: number;
}

export interface ThreeDStationDefinition {
  id: ThreeDStation;
  label: string;
  action: string;
  triggerPosition: [number, number, number];
  triggerSize: [number, number, number];
  playerPosition: [number, number, number];
  lookAt: [number, number, number];
}

export const threeDStations: ThreeDStationDefinition[] = [
  {
    id: "fridge",
    label: "冰箱",
    action: "选择食材",
    triggerPosition: [-3.8, 1.15, -3.35],
    triggerSize: [1.2, 2.1, 0.3],
    playerPosition: [-3.8, 1, -1.95],
    lookAt: [-3.8, 1.2, -3.5],
  },
  {
    id: "sink",
    label: "水槽",
    action: "按住清洗",
    triggerPosition: [3.05, 0.95, -0.75],
    triggerSize: [1.6, 0.45, 0.8],
    playerPosition: [3.05, 1, 1],
    lookAt: [3.05, 1.05, -0.9],
  },
  {
    id: "board",
    label: "砧板",
    action: "按住切配",
    triggerPosition: [0, 1.03, 0.35],
    triggerSize: [1.6, 0.4, 0.8],
    playerPosition: [0, 1, 1.8],
    lookAt: [0, 1.05, 0.3],
  },
  {
    id: "stove",
    label: "灶台",
    action: "开始烹饪",
    triggerPosition: [-3.1, 0.98, -0.75],
    triggerSize: [1.6, 0.5, 0.9],
    playerPosition: [-3.1, 1, 1],
    lookAt: [-3.1, 1.03, -0.9],
  },
  {
    id: "seasoning",
    label: "调料架",
    action: "添加调料",
    triggerPosition: [1.35, 1.38, -3.7],
    triggerSize: [1.3, 1.1, 0.3],
    playerPosition: [1.35, 1, -2],
    lookAt: [1.35, 1.35, -3.65],
  },
  {
    id: "plating",
    label: "成品岛台",
    action: "装盘复盘",
    triggerPosition: [0, 1.03, 2.35],
    triggerSize: [1.7, 0.45, 0.85],
    playerPosition: [0, 1, 3.4],
    lookAt: [0, 1.05, 2.3],
  },
];

const stationById = new Map(
  threeDStations.map((station) => [station.id, station]),
);

function Counter({
  position,
  size,
  textures,
}: {
  position: [number, number, number];
  size: [number, number, number];
  textures: ReturnType<typeof useKitchenTextures>;
}) {
  const frontZ = position[2] + size[2] / 2 + 0.012;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[size[0] / 2, (size[1] - 0.08) / 2, size[2] / 2]}
          position={position}
        />
      </RigidBody>
      <RoundedBox
        castShadow
        receiveShadow
        position={[position[0], position[1] + size[1] / 2 - 0.035, position[2]]}
        args={[size[0] + 0.08, 0.075, size[2] + 0.08]}
        radius={0.025}
        smoothness={3}
      >
        <meshPhysicalMaterial
          map={textures.stone}
          color="#fffdf7"
          roughness={0.22}
          clearcoat={0.5}
          clearcoatRoughness={0.2}
        />
      </RoundedBox>
      <RoundedBox
        castShadow
        receiveShadow
        position={[
          position[0],
          position[1] - 0.015,
          position[2],
        ]}
        args={[size[0], size[1] - 0.1, size[2]]}
        radius={0.025}
        smoothness={2}
      >
        <meshPhysicalMaterial
          map={textures.cabinet}
          color="#fffdf7"
          roughness={0.5}
          clearcoat={0.12}
          clearcoatRoughness={0.48}
        />
      </RoundedBox>
      <mesh
        position={[
          position[0],
          position[1] + size[1] / 2 + 0.006,
          position[2],
        ]}
        receiveShadow
      >
        <boxGeometry args={[size[0] + 0.01, 0.01, size[2] + 0.01]} />
        <meshStandardMaterial color="#d9d2c4" roughness={0.35} />
      </mesh>
      {[0, 1].map((index) => {
        const width = size[0] / 2 - 0.08;
        const x =
          position[0] - size[0] / 4 + index * (size[0] / 2);
        const drawerHeights = [0.24, 0.3, 0.24];
        let y = position[1] + 0.34;
        return (
          <group key={index}>
            {drawerHeights.map((height, drawerIndex) => {
              const centerY = y - height / 2;
              y -= height + 0.015;
              return (
                <group key={drawerIndex}>
                  <mesh position={[x, centerY, frontZ]}>
                    <boxGeometry args={[width, height - 0.018, 0.018]} />
                    <meshPhysicalMaterial
                      map={textures.cabinet}
                      color="#fffdf8"
                      roughness={0.4}
                      clearcoat={0.16}
                    />
                  </mesh>
                  <mesh
                    position={[x, centerY + height * 0.24, frontZ + 0.022]}
                    rotation={[0, 0, Math.PI / 2]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.009, 0.009, 0.16, 10]} />
                    <meshStandardMaterial
                      color="#a3a29d"
                      metalness={0.8}
                      roughness={0.2}
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
      <mesh
        position={[
          position[0],
          position[1] - size[1] / 2 + 0.045,
          position[2] + size[2] / 2 - 0.04,
        ]}
      >
        <boxGeometry args={[size[0] - 0.12, 0.07, 0.04]} />
        <meshStandardMaterial color="#c9c0b0" roughness={0.72} />
      </mesh>
    </group>
  );
}

function KitchenRoom({
  session,
  heating,
  holdActive,
  holdProgress,
}: {
  session: ThreeDTrainingSession;
  heating: boolean;
  holdActive: boolean;
  holdProgress: number;
}) {
  const textures = useKitchenTextures();
  const ingredient = session.ingredientId
    ? getIngredient(session.ingredientId)
    : null;
  const cutProgress = session.stationState.chopProgress;
  const cutStage: CutStage = cutStageFor(cutProgress);
  const heatBand: HeatBand = session.stationState.heatBand;
  const stationPosition: Record<string, [number, number, number]> = {
    fridge: [-3.8, 1.2, -2.9],
    sink: [3.05, 1.07, -0.75],
    board: [0, 1.07, 0.35],
    stove: [-3.1, 1.14, -0.75],
    seasoning: [1.35, 1.4, -3.45],
    plating: [0, 1.1, 2.35],
  };
  const visibleStation =
    session.phase === "wash"
      ? "sink"
      : session.phase === "chop"
        ? "board"
        : session.phase === "cook"
          ? "stove"
          : session.phase === "plate" || session.phase === "result"
            ? "plating"
            : "fridge";

  return (
    <>
      <color attach="background" args={["#aeb1a7"]} />
      <fog attach="fog" args={["#aeb1a7", 9, 18]} />
      <ambientLight intensity={0.16} color="#fff1d8" />
      <directionalLight
        castShadow
        position={[3.2, 5.8, 3.8]}
        intensity={1.05}
        color="#fff0cf"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
      />
      <pointLight position={[0, 3.1, 0]} intensity={0.34} color="#ffe1a8" />
      <Environment
        files="/images/hdr/venice-sunset-1k.hdr"
        environmentIntensity={0.42}
        background={false}
      />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[5, 0.08, 4]} position={[0, -0.08, 0]} />
        <CuboidCollider args={[5, 1.4, 0.1]} position={[0, 1.4, -4]} />
        <CuboidCollider args={[5, 1.4, 0.1]} position={[0, 1.4, 4]} />
        <CuboidCollider args={[0.1, 1.4, 4]} position={[-5, 1.4, 0]} />
        <CuboidCollider args={[0.1, 1.4, 4]} position={[5, 1.4, 0]} />
      </RigidBody>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 8]} />
        <meshPhysicalMaterial
          map={textures.floor}
          color="#d8bfa0"
          roughness={0.58}
          clearcoat={0.16}
          clearcoatRoughness={0.52}
        />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9.9, 7.9]} />
        <meshStandardMaterial
          color="#f4e7d2"
          roughness={0.9}
          transparent
          opacity={0.16}
        />
      </mesh>

      <mesh position={[0, 1.4, -3.98]} receiveShadow>
        <boxGeometry args={[10, 2.8, 0.08]} />
        <meshStandardMaterial color="#bdb6a9" roughness={0.92} />
      </mesh>
      <mesh position={[-4.98, 1.4, 0]} receiveShadow>
        <boxGeometry args={[0.08, 2.8, 8]} />
        <meshStandardMaterial color="#c8c1b5" roughness={0.94} />
      </mesh>
      <mesh position={[4.98, 1.4, 0]} receiveShadow>
        <boxGeometry args={[0.08, 2.8, 8]} />
        <meshStandardMaterial color="#c8c1b5" roughness={0.94} />
      </mesh>
      <mesh position={[0, 2.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial color="#d9d2c6" roughness={0.9} />
      </mesh>

      <mesh position={[0, 1.67, -3.925]} receiveShadow>
        <planeGeometry args={[9.85, 1.48]} />
        <meshPhysicalMaterial
          map={textures.tile}
          color="#d7d0c4"
          roughness={0.28}
          clearcoat={0.38}
          clearcoatRoughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.1, -3.915]}>
        <boxGeometry args={[10, 0.15, 0.08]} />
        <meshStandardMaterial color="#d9d2c5" roughness={0.66} />
      </mesh>

      <Counter
        position={[-3.05, 0.45, -0.75]}
        size={[2.3, 0.9, 1.15]}
        textures={textures}
      />
      <Counter
        position={[3.05, 0.45, -0.75]}
        size={[2.15, 0.9, 1.15]}
        textures={textures}
      />
      <Counter
        position={[0, 0.45, 0.35]}
        size={[3.25, 0.9, 1.35]}
        textures={textures}
      />
      <Counter
        position={[0, 0.45, 2.35]}
        size={[2.55, 0.9, 1.05]}
        textures={textures}
      />

      <group>
        {[-1.9, -0.7, 0.6, 1.9].map((x, index) => (
          <group key={x} position={[x, 2.34, -3.81]}>
            <RoundedBox args={[1.08, 0.78, 0.36]} radius={0.025} smoothness={2} castShadow>
              <meshPhysicalMaterial
                map={textures.cabinet}
                color={index % 2 === 0 ? "#fffefa" : "#faf6ed"}
                roughness={0.42}
                clearcoat={0.18}
              />
            </RoundedBox>
            <mesh position={[0, -0.24, 0.2]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.009, 0.009, 0.16, 9]} />
              <meshStandardMaterial color="#999992" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[-3.05, 2.08, -3.67]}>
        <mesh castShadow>
          <boxGeometry args={[1.62, 0.54, 0.38]} />
          <meshPhysicalMaterial
            color="#171b19"
            metalness={0.38}
            roughness={0.22}
            clearcoat={0.5}
            clearcoatRoughness={0.18}
          />
        </mesh>
        <mesh position={[0, 0.08, 0.2]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[1.48, 0.38, 0.06]} />
          <meshPhysicalMaterial
            color="#0f1210"
            metalness={0.5}
            roughness={0.18}
            clearcoat={0.6}
          />
        </mesh>
        <mesh position={[0, 0.58, -0.02]}>
          <boxGeometry args={[0.42, 0.72, 0.3]} />
          <meshStandardMaterial color="#d9d3c7" roughness={0.46} />
        </mesh>
        <spotLight
          position={[0, -0.2, 0.3]}
          intensity={2.2}
          color="#fff0ca"
          angle={0.9}
          penumbra={0.8}
          distance={3.5}
        />
      </group>

      <group position={[-3.8, 1.15, -3.55]}>
        <mesh castShadow>
          <boxGeometry args={[1.12, 2.2, 0.72]} />
          <meshStandardMaterial color="#e6e2d8" roughness={0.42} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.43, 0.37]}>
          <boxGeometry args={[0.95, 0.025, 0.03]} />
          <meshStandardMaterial color="#777b74" metalness={0.65} />
        </mesh>
        <mesh position={[0, -0.43, 0.37]}>
          <boxGeometry args={[0.95, 0.025, 0.03]} />
          <meshStandardMaterial color="#777b74" metalness={0.65} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.56, 1.1, 0.36]} />
        </RigidBody>
      </group>

      <group position={[-3.1, 0.94, -0.75]}>
        <mesh castShadow>
          <boxGeometry args={[1.45, 0.045, 0.82]} />
          <meshStandardMaterial color="#171a18" metalness={0.42} roughness={0.28} />
        </mesh>
        {[-0.4, 0.4].map((x) => (
          <group key={x} position={[x, 0.03, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.17, 0.025, 8, 24]} />
              <meshStandardMaterial color="#3e403c" metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.026, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
              <meshStandardMaterial color="#292a27" metalness={0.45} />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[3.05, 0.94, -0.75]}>
        <mesh>
          <boxGeometry args={[1.25, 0.06, 0.58]} />
          <meshStandardMaterial color="#aeb5b1" metalness={0.62} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[1.02, 0.04, 0.4]} />
          <meshStandardMaterial color="#69746f" metalness={0.34} roughness={0.35} />
        </mesh>
        <group position={[0.36, 0.34, -0.18]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.026, 0.026, 0.46, 14]} />
            <meshStandardMaterial
              color="#c6ccca"
              metalness={0.9}
              roughness={0.12}
            />
          </mesh>
          <mesh position={[0, 0.28, 0.04]} rotation={[0, 0, -0.55]}>
            <torusGeometry args={[0.15, 0.025, 9, 24, Math.PI * 1.1]} />
            <meshStandardMaterial
              color="#c6ccca"
              metalness={0.9}
              roughness={0.12}
            />
          </mesh>
        </group>
      </group>

      <group position={[-3.1, 1.04, -0.75]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.46, 0.41, 0.12, 32]} />
          <meshPhysicalMaterial
            color="#252b28"
            metalness={0.68}
            roughness={0.25}
            clearcoat={0.35}
            clearcoatRoughness={0.2}
          />
        </mesh>
        <mesh position={[0.55, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.09, 0.08, 0.72]} />
          <meshPhysicalMaterial
            color="#343a36"
            metalness={0.5}
            roughness={0.28}
          />
        </mesh>
      </group>

      <mesh position={[0, 1, 0.35]} castShadow>
        <boxGeometry args={[1.35, 0.06, 0.72]} />
        <meshPhysicalMaterial
          map={textures.floor}
          color="#b98049"
          roughness={0.58}
          clearcoat={0.16}
          clearcoatRoughness={0.4}
        />
      </mesh>
      <mesh position={[0, 1.045, 2.35]}>
        <cylinderGeometry args={[0.55, 0.62, 0.045, 32]} />
        <meshStandardMaterial color="#f9f5ea" roughness={0.3} />
      </mesh>

      <group position={[1.35, 1.36, -3.66]}>
        <mesh>
          <boxGeometry args={[1.5, 0.08, 0.34]} />
          <meshStandardMaterial color="#d8c6a9" roughness={0.62} />
        </mesh>
        {[-0.55, -0.28, 0, 0.28, 0.55].map((x, index) => (
          <group key={x} position={[x, 0.18, 0]}>
            <mesh>
              <cylinderGeometry args={[0.065, 0.075, 0.25, 10]} />
              <meshStandardMaterial
                color={["#8f9f7f", "#6f4e2e", "#e6dfce", "#9e3e2e", "#d9a13c"][index]}
                roughness={0.55}
              />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.07, 10]} />
              <meshStandardMaterial color="#494842" roughness={0.46} />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[2.15, 1.45, -3.82]}>
        <mesh>
          <boxGeometry args={[1.2, 0.9, 0.025]} />
          <meshPhysicalMaterial
            color="#e4dfd4"
            roughness={0.55}
            clearcoat={0.12}
          />
        </mesh>
        {[-0.33, -0.05, 0.23].map((x, index) => (
          <group key={x} position={[x, 0, 0.08]}>
            <mesh position={[0, 0.24, 0]}>
              <torusGeometry args={[0.045, 0.009, 6, 16]} />
              <meshStandardMaterial color="#8a8d88" metalness={0.72} />
            </mesh>
            <mesh position={[0, -0.1, 0]} rotation={[0.1, 0, index % 2 ? 0.25 : -0.18]}>
              <cylinderGeometry args={[0.014, 0.011, 0.52, 8]} />
              <meshStandardMaterial
                color={index === 0 ? "#b3915f" : "#8d8e89"}
                metalness={index === 0 ? 0.22 : 0.65}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0, -0.42, 0]} rotation={[0.1, 0, index % 2 ? 0.25 : -0.18]}>
              <boxGeometry args={[0.16, 0.14, 0.025]} />
              <meshStandardMaterial color="#bbb7ad" metalness={0.55} />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[3.85, 1.65, -3.93]}>
        <mesh>
          <boxGeometry args={[2.05, 1.5, 0.045]} />
          <meshPhysicalMaterial
            map={textures.outside}
            color="#f3fbfa"
            emissive="#cfe6e3"
            emissiveIntensity={0.18}
            roughness={0.2}
            transparent
            opacity={0.92}
          />
        </mesh>
        {[-0.7, -0.35, 0, 0.35, 0.7].map((x) => (
          <mesh key={x} position={[x, 0, 0.03]}>
            <boxGeometry args={[0.025, 1.5, 0.02]} />
            <meshStandardMaterial color="#f6f8f4" roughness={0.55} />
          </mesh>
        ))}
      </group>

      <mesh position={[0, 2.5, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.28, 24]} />
        <meshStandardMaterial
          color="#fff4d1"
          emissive="#fff0bd"
          emissiveIntensity={1.6}
        />
      </mesh>
      <pointLight position={[0, 2.35, -0.2]} intensity={1.3} color="#ffe8af" distance={5} />

      {[0, 1, 2].map((index) => (
        <group key={index} position={[-1.85 + index * 1.75, 2.55, -0.2]}>
          <mesh position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.58, 8]} />
            <meshStandardMaterial color="#b99a63" metalness={0.58} roughness={0.28} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.18, 18, 12]} />
            <meshPhysicalMaterial
              color="#fff1cb"
              emissive="#ffe2a4"
              emissiveIntensity={2.2}
              roughness={0.2}
              transparent
              opacity={0.86}
            />
          </mesh>
        </group>
      ))}

      <ContactShadows
        position={[0, 0.012, 0]}
        opacity={0.26}
        scale={10}
        blur={2.3}
        far={4}
        resolution={256}
        frames={1}
      />

      {ingredient && (
        <group position={stationPosition[visibleStation]}>
          <ThreeDIngredientModel
            ingredient={ingredient}
            cutStage={session.phase === "chop" ? cutStage : session.stationState.chopped ? "cut" : "whole"}
            dirty={visibleStation === "sink" && !session.stationState.cleaned}
            heatBand={visibleStation === "stove" ? heatBand : "idle"}
            scale={visibleStation === "stove" ? 0.32 : 0.38}
          />
          {visibleStation === "board" && (
            <KnifeModel active={holdActive} progress={holdProgress} />
          )}
          {(visibleStation === "stove" || visibleStation === "plating") && (
            <HeatEffects active={heating} band={heatBand} />
          )}
          {visibleStation === "sink" && holdActive && (
            <WashEffects progress={holdProgress} />
          )}
        </group>
      )}
    </>
  );
}

function HeatEffects({
  active,
  band,
}: {
  active: boolean;
  band: HeatBand;
}) {
  const group = useRef<THREE.Group>(null);
  const danger = band === "danger" || band === "burnt";
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((child, index) => {
      child.position.y =
        0.2 + ((clock.elapsedTime * (danger ? 0.42 : 0.24) + index * 0.15) % 1) * 0.85;
      const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (material) {
        material.opacity = active
          ? 0.22 + Math.max(0, 1 - child.position.y) * 0.25
          : 0;
      }
    });
  });
  return (
    <group ref={group}>
      {[0, 1, 2, 3, 4].map((index) => (
        <mesh key={index} position={[index * 0.08 - 0.16, 0.3, 0.05]}>
          <sphereGeometry args={[0.06 + index * 0.009, 8, 6]} />
          <meshStandardMaterial
            color={danger ? "#514c48" : "#fffdf7"}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      {danger && (
        <pointLight
          position={[0, 0.35, 0]}
          color="#e55136"
          intensity={1.8}
          distance={2.4}
        />
      )}
    </group>
  );
}

function WashEffects({ progress }: { progress: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((child, index) => {
      child.position.y =
        0.38 - ((clock.elapsedTime * 0.55 + index * 0.14) % 1) * 0.32;
    });
  });
  return (
    <group ref={group}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <mesh
          key={index}
          position={[Math.sin(index * 1.7) * 0.24, 0.35, Math.cos(index * 1.3) * 0.16]}
        >
          <sphereGeometry args={[0.018 + progress * 0.00004, 7, 5]} />
          <meshStandardMaterial
            color="#9ed7e7"
            transparent
            opacity={0.65}
          />
        </mesh>
      ))}
    </group>
  );
}

function StationTriggers({
  onNearbyChange,
}: {
  onNearbyChange: (target: InteractionTarget | null) => void;
}) {
  const refs = useRef(new Map<ThreeDStation, THREE.Mesh>());
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const { camera } = useThree();
  const lastId = useRef<ThreeDStation | null>(null);
  const center = useMemo(() => new THREE.Vector2(0, 0), []);

  useFrame(() => {
    const objects = Array.from(refs.current.values());
    raycaster.setFromCamera(center, camera);
    const hits = raycaster.intersectObjects(objects, false);
    const hit = hits.find((item) => item.distance <= 2.65);
    const station = hit?.object.userData.stationId as ThreeDStation | undefined;
    if ((station ?? null) === lastId.current) return;
    lastId.current = station ?? null;
    if (!station) {
      onNearbyChange(null);
      return;
    }
    const definition = stationById.get(station);
    if (!definition) return;
    onNearbyChange({
      id: definition.id,
      label: definition.label,
      action: definition.action,
      position: definition.triggerPosition,
      distance: hit?.distance ?? 0,
    });
  });

  return (
    <>
      {threeDStations.map((station) => (
        <mesh
          key={station.id}
          ref={(node) => {
            if (node) refs.current.set(station.id, node);
            else refs.current.delete(station.id);
          }}
          position={station.triggerPosition}
          userData={{ stationId: station.id }}
        >
          <boxGeometry args={station.triggerSize} />
          <meshBasicMaterial
            transparent
            opacity={0}
            colorWrite={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

function PlayerController({
  joystick,
  controlsEnabled,
  teleportRequest,
  pose,
  onPoseChange,
}: {
  joystick: React.MutableRefObject<JoystickInput>;
  controlsEnabled: boolean;
  teleportRequest: TeleportRequest | null;
  pose: React.MutableRefObject<SharedPlayerPose>;
  onPoseChange?: (position: [number, number, number]) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const { camera, gl } = useThree();
  const keys = useRef({ forward: false, back: false, left: false, right: false });
  const yaw = useRef(0.15);
  const pitch = useRef(-0.06);
  const touchLast = useRef<{ x: number; y: number } | null>(null);
  const lastPoseUpdate = useRef(0);
  const enabledRef = useRef(controlsEnabled);

  useEffect(() => {
    enabledRef.current = controlsEnabled;
  }, [controlsEnabled]);

  useEffect(() => {
    camera.rotation.order = "YXZ";
    function setKey(event: KeyboardEvent, pressed: boolean) {
      if (!enabledRef.current) return;
      const key = event.key.toLowerCase();
      if (key === "w" || key === "arrowup") keys.current.forward = pressed;
      if (key === "s" || key === "arrowdown") keys.current.back = pressed;
      if (key === "a" || key === "arrowleft") keys.current.left = pressed;
      if (key === "d" || key === "arrowright") keys.current.right = pressed;
    }
    function keyDown(event: KeyboardEvent) {
      setKey(event, true);
    }
    function keyUp(event: KeyboardEvent) {
      setKey(event, false);
    }
    function pointerLockChange() {
      // The parent HUD communicates whether player interaction is paused.
    }
    function mouseMove(event: MouseEvent) {
      if (
        document.pointerLockElement !== gl.domElement ||
        !enabledRef.current
      ) {
        return;
      }
      yaw.current -= event.movementX * 0.0022;
      pitch.current -= event.movementY * 0.0018;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current,
        -Math.PI * 0.42,
        Math.PI * 0.42,
      );
    }
    function requestPointer() {
      if (!enabledRef.current) return;
      if (window.matchMedia("(pointer: fine)").matches) {
        void gl.domElement.requestPointerLock();
      }
    }
    function touchStart(event: TouchEvent) {
      if (!enabledRef.current || event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchLast.current = { x: touch.clientX, y: touch.clientY };
    }
    function touchMove(event: TouchEvent) {
      if (!enabledRef.current || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touchLast.current) {
        touchLast.current = { x: touch.clientX, y: touch.clientY };
        return;
      }
      yaw.current -= (touch.clientX - touchLast.current.x) * 0.004;
      pitch.current -= (touch.clientY - touchLast.current.y) * 0.0035;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current,
        -Math.PI * 0.42,
        Math.PI * 0.42,
      );
      touchLast.current = { x: touch.clientX, y: touch.clientY };
    }
    function touchEnd() {
      touchLast.current = null;
    }

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("mousemove", mouseMove);
    document.addEventListener("pointerlockchange", pointerLockChange);
    gl.domElement.addEventListener("click", requestPointer);
    gl.domElement.addEventListener("touchstart", touchStart, { passive: true });
    gl.domElement.addEventListener("touchmove", touchMove, { passive: true });
    gl.domElement.addEventListener("touchend", touchEnd);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("mousemove", mouseMove);
      document.removeEventListener("pointerlockchange", pointerLockChange);
      gl.domElement.removeEventListener("click", requestPointer);
      gl.domElement.removeEventListener("touchstart", touchStart);
      gl.domElement.removeEventListener("touchmove", touchMove);
      gl.domElement.removeEventListener("touchend", touchEnd);
    };
  }, [camera, gl]);

  useEffect(() => {
    if (!teleportRequest || !body.current) return;
    const station = stationById.get(teleportRequest.stationId);
    if (!station) return;
    const [x, y, z] = station.playerPosition;
    body.current.setTranslation({ x, y, z }, true);
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    const [lookX, lookY, lookZ] = station.lookAt;
    const dx = lookX - x;
    const dz = lookZ - z;
    yaw.current = Math.atan2(-dx, -dz);
    const horizontalDistance = Math.max(0.001, Math.hypot(dx, dz));
    pitch.current = Math.atan2(
      lookY - (y + 0.72),
      horizontalDistance,
    );
    camera.position.set(x, y + 0.72, z);
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
  }, [camera, teleportRequest]);

  useFrame(() => {
    if (!body.current) return;
    const input = joystick.current;
    const horizontal =
      (keys.current.right ? 1 : 0) -
      (keys.current.left ? 1 : 0) +
      input.x;
    const vertical =
      (keys.current.forward ? 1 : 0) -
      (keys.current.back ? 1 : 0) +
      input.z;
    const forward = new THREE.Vector3(
      -Math.sin(yaw.current),
      0,
      -Math.cos(yaw.current),
    );
    const right = new THREE.Vector3(
      Math.cos(yaw.current),
      0,
      -Math.sin(yaw.current),
    );
    const direction = new THREE.Vector3()
      .addScaledVector(forward, vertical)
      .addScaledVector(right, horizontal);
    if (direction.lengthSq() > 1) direction.normalize();
    const speed = 2.45;
    const currentVelocity = body.current.linvel();
    body.current.setLinvel(
      {
        x: enabledRef.current ? direction.x * speed : 0,
        y: currentVelocity.y,
        z: enabledRef.current ? direction.z * speed : 0,
      },
      true,
    );
    const position = body.current.translation();
    camera.position.set(
      position.x,
      position.y + 0.72,
      position.z,
    );
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    pose.current.position = [position.x, position.y, position.z];
    pose.current.yaw = yaw.current;
    const now = performance.now();
    if (onPoseChange && now - lastPoseUpdate.current > 240) {
      lastPoseUpdate.current = now;
      onPoseChange([position.x, position.y, position.z]);
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      type="dynamic"
      position={[1, 1, 3.35]}
      enabledRotations={[false, false, false]}
      linearDamping={8}
    >
      <CapsuleCollider args={[0.45, 0.32]} />
    </RigidBody>
  );
}

function GuideCompanion({
  guideId,
  pose,
  onClick,
  onMotionChange,
  onPositionChange,
}: {
  guideId: ThreeDGuideId;
  pose: React.MutableRefObject<SharedPlayerPose>;
  onClick: () => void;
  onMotionChange?: (motion: GuideMotionState) => void;
  onPositionChange?: (position: [number, number]) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const motion = useRef<GuideMotionState>("idle");
  const speed = useRef(0);
  const visualOpacity = useRef(1);
  const visualWasTransparent = useRef(false);
  const lastPublishedPosition = useRef(0);
  const follow = useRef<GuideMotionSnapshot>({
    position: [1.94, 0.54],
    velocity: [0, 0],
    yaw: -0.32,
    speed: 0,
    motion: "idle",
    target: [1.94, 0.54],
    side: 1,
    distanceToTarget: 0,
    stuckMs: 0,
    shouldReposition: false,
  });

  useFrame((_, delta) => {
    if (!body.current || !visual.current) return;
    const position = body.current.translation();
    const next = advanceGuideFollow(
      {
        ...follow.current,
        position: [position.x, position.z],
      },
      [pose.current.position[0], pose.current.position[2]],
      pose.current.yaw,
      delta,
    );
    follow.current = next;
    if (motion.current !== next.motion) {
      motion.current = next.motion;
      onMotionChange?.(next.motion);
    }
    speed.current = next.speed;

    if (next.shouldReposition) {
      visualOpacity.current = 0;
      body.current.setTranslation(
        { x: next.position[0], y: position.y, z: next.position[1] },
        true,
      );
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    } else {
      visualOpacity.current = Math.min(
        1,
        visualOpacity.current + delta / 0.2,
      );
      body.current.setLinvel(
        {
          x: next.velocity[0],
          y: body.current.linvel().y,
          z: next.velocity[1],
        },
        true,
      );
    }
    if (visualOpacity.current < 0.999) {
      visualWasTransparent.current = true;
      visual.current.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) {
          material.transparent = true;
          material.opacity = visualOpacity.current;
          material.depthWrite = visualOpacity.current > 0.45;
        }
      });
    } else if (visualWasTransparent.current) {
      visualWasTransparent.current = false;
      visual.current.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) {
          material.transparent = false;
          material.opacity = 1;
          material.depthWrite = true;
        }
      });
    }
    visual.current.rotation.y = next.yaw;
    const now = performance.now();
    if (
      onPositionChange &&
      now - lastPublishedPosition.current > 500
    ) {
      lastPublishedPosition.current = now;
      onPositionChange([position.x, position.z]);
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      type="dynamic"
      position={[1.94, 1, 0.54]}
      enabledRotations={[false, false, false]}
      linearDamping={0}
    >
      <CapsuleCollider args={[0.72, 0.24]} />
      <group ref={visual} onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}>
        <ThreeDGuideModel
          guideId={guideId}
          motionRef={motion}
          speedRef={speed}
        />
      </group>
    </RigidBody>
  );
}

export function ThreeDKitchenCanvas({
  session,
  guideId,
  joystick,
  controlsEnabled,
  teleportRequest,
  heating,
  holdActive,
  holdProgress,
  quality,
  onNearbyChange,
  onGuideClick,
  onGuideMotionChange,
  onGuidePositionChange,
  onPoseChange,
}: {
  session: ThreeDTrainingSession;
  guideId: ThreeDGuideId;
  joystick: React.MutableRefObject<JoystickInput>;
  controlsEnabled: boolean;
  teleportRequest: TeleportRequest | null;
  heating: boolean;
  holdActive: boolean;
  holdProgress: number;
  quality: "high" | "low";
  onNearbyChange: (target: InteractionTarget | null) => void;
  onGuideClick: () => void;
  onGuideMotionChange?: (motion: GuideMotionState) => void;
  onGuidePositionChange?: (position: [number, number]) => void;
  onPoseChange?: (position: [number, number, number]) => void;
}) {
  const pose = useRef<SharedPlayerPose>({
    position: [1, 1, 3.35],
    yaw: 0.15,
  });

  return (
    <Canvas
      shadows={quality === "high"}
      dpr={[1, quality === "high" ? 1.5 : 1]}
      camera={{ fov: 58, near: 0.05, far: 24, position: [1, 1.72, 3.35] }}
      gl={{
        antialias: quality === "high",
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.68,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor("#efe9dd");
      }}
    >
      <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
        <PlayerController
          joystick={joystick}
          controlsEnabled={controlsEnabled}
          teleportRequest={teleportRequest}
          pose={pose}
          onPoseChange={onPoseChange}
        />
        <GuideCompanion
          guideId={guideId}
          pose={pose}
          onClick={onGuideClick}
          onMotionChange={onGuideMotionChange}
          onPositionChange={onGuidePositionChange}
        />
        <Suspense fallback={null}>
          <KitchenRoom
            session={session}
            heating={heating}
            holdActive={holdActive}
            holdProgress={holdProgress}
          />
        </Suspense>
        <StationTriggers onNearbyChange={onNearbyChange} />
      </Physics>
    </Canvas>
  );
}
