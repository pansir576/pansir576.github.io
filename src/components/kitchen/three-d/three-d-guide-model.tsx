"use client";
/* eslint-disable react-hooks/immutability */

import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import type { GuideMotionState, ThreeDGuideId } from "@/lib/types";

interface GuideModelProps {
  guideId: ThreeDGuideId;
  motionRef: MutableRefObject<GuideMotionState>;
  speedRef: MutableRefObject<number>;
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function XiaEye({ x }: { x: number }) {
  const lid = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!lid.current) return;
    lid.current.scale.y =
      Math.sin(clock.elapsedTime * 0.9 + x * 19) > 0.993 ? 0.08 : 1;
  });

  return (
    <group ref={lid} position={[x, -0.005, 0.206]}>
      <mesh scale={[0.046, 0.03, 0.014]}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshPhysicalMaterial
          color="#fffaf0"
          roughness={0.22}
          clearcoat={0.45}
        />
      </mesh>
      <mesh position={[0, -0.002, 0.013]} scale={[0.022, 0.025, 0.009]}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshPhysicalMaterial
          color="#b96f2d"
          roughness={0.2}
          clearcoat={0.55}
        />
      </mesh>
      <mesh position={[0, -0.004, 0.021]} scale={[0.009, 0.017, 0.006]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color="#211812" roughness={0.18} />
      </mesh>
      <mesh position={[-0.007, 0.01, 0.027]}>
        <sphereGeometry args={[0.006, 10, 8]} />
        <meshBasicMaterial color="#fffdf7" />
      </mesh>
      <mesh position={[0, 0.031, 0.004]} rotation={[0, 0, x < 0 ? -0.1 : 0.1]}>
        <capsuleGeometry args={[0.005, 0.052, 4, 8]} />
        <meshStandardMaterial color="#40261b" roughness={0.45} />
      </mesh>
    </group>
  );
}

function LongHairStrand({
  position,
  rotation,
  length,
  radius,
  color = "#c98750",
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  radius: number;
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <capsuleGeometry args={[radius, length, 7, 14]} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.5}
        sheen={0.4}
        sheenColor="#dda46b"
      />
    </mesh>
  );
}

function HairFringe({
  position,
  rotation,
  length,
  width,
  color = "#a65a31",
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  width: number;
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={[width, width * 0.16, length, 9, 2]} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.48}
        sheen={0.34}
        sheenColor="#dfa06a"
      />
    </mesh>
  );
}

function OrangeGuide() {
  const root = useRef<Group>(null);
  const upperBody = useRef<Group>(null);
  const head = useRef<Group>(null);
  const raisedArm = useRef<Group>(null);
  const freeArm = useRef<Group>(null);
  const pendant = useRef<Group>(null);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (root.current) {
      root.current.position.y = -0.95 + Math.sin(time * 1.4) * 0.006;
    }
    if (upperBody.current) {
      upperBody.current.rotation.z = Math.sin(time * 0.72) * 0.009;
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(time * 0.48) * 0.09;
      head.current.rotation.z = Math.sin(time * 0.7) * 0.012;
    }
    if (raisedArm.current) {
      raisedArm.current.rotation.z = Math.sin(time * 0.92) * 0.035;
      raisedArm.current.rotation.x = Math.sin(time * 0.64) * 0.018;
    }
    if (freeArm.current) {
      freeArm.current.rotation.z = 0.13 + Math.sin(time * 0.7) * 0.018;
    }
    if (pendant.current) {
      pendant.current.rotation.z = Math.sin(time * 1.15) * 0.08;
    }
  });

  return (
    <group ref={root} position={[0, -0.95, 0]} scale={1.05}>
      <group ref={upperBody}>
        <mesh position={[-0.12, 0.24, 0.005]} castShadow>
          <capsuleGeometry args={[0.063, 0.26, 8, 14]} />
          <meshPhysicalMaterial
            color="#3d332f"
            roughness={0.5}
            clearcoat={0.12}
          />
        </mesh>
        <mesh position={[0.12, 0.24, 0.005]} castShadow>
          <capsuleGeometry args={[0.063, 0.26, 8, 14]} />
          <meshPhysicalMaterial
            color="#3d332f"
            roughness={0.5}
            clearcoat={0.12}
          />
        </mesh>
        <mesh
          position={[-0.12, 0.08, 0.045]}
          scale={[0.085, 0.062, 0.14]}
          castShadow
        >
          <sphereGeometry args={[1, 18, 14]} />
          <meshPhysicalMaterial
            color="#5a3b31"
            roughness={0.48}
            clearcoat={0.22}
          />
        </mesh>
        <mesh
          position={[0.12, 0.08, 0.045]}
          scale={[0.085, 0.062, 0.14]}
          castShadow
        >
          <sphereGeometry args={[1, 18, 14]} />
          <meshPhysicalMaterial
            color="#5a3b31"
            roughness={0.48}
            clearcoat={0.22}
          />
        </mesh>

        <mesh position={[0, 0.65, 0]} castShadow>
          <cylinderGeometry args={[0.205, 0.325, 0.36, 32]} />
          <meshPhysicalMaterial
            color="#8d4d2d"
            roughness={0.58}
            sheen={0.28}
            sheenColor="#d9a074"
          />
        </mesh>
        <mesh position={[0, 0.63, 0.205]}>
          <boxGeometry args={[0.33, 0.27, 0.035]} />
          <meshPhysicalMaterial color="#d497a2" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.555, 0.23]}>
          <boxGeometry args={[0.34, 0.025, 0.022]} />
          <meshStandardMaterial color="#6d3c2e" roughness={0.48} />
        </mesh>

        <RoundedBox
          castShadow
          position={[0, 0.93, 0]}
          args={[0.39, 0.49, 0.245]}
          radius={0.095}
          smoothness={5}
        >
          <meshPhysicalMaterial
            color="#86502f"
            roughness={0.52}
            clearcoat={0.18}
            sheen={0.34}
            sheenColor="#d8a17b"
          />
        </RoundedBox>
        <RoundedBox
          castShadow
          position={[-0.115, 0.91, 0.138]}
          rotation={[0.01, -0.08, -0.035]}
          args={[0.17, 0.47, 0.055]}
          radius={0.035}
          smoothness={4}
        >
          <meshPhysicalMaterial color="#744027" roughness={0.57} />
        </RoundedBox>
        <RoundedBox
          castShadow
          position={[0.115, 0.91, 0.138]}
          rotation={[0.01, 0.08, 0.035]}
          args={[0.17, 0.47, 0.055]}
          radius={0.035}
          smoothness={4}
        >
          <meshPhysicalMaterial color="#744027" roughness={0.57} />
        </RoundedBox>
        <mesh position={[0, 0.94, 0.18]}>
          <boxGeometry args={[0.105, 0.35, 0.028]} />
          <meshPhysicalMaterial
            color="#bf7e8b"
            roughness={0.6}
            sheen={0.2}
          />
        </mesh>
        <mesh position={[-0.085, 1.06, 0.207]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.13, 0.045, 0.03]} />
          <meshPhysicalMaterial color="#8e5838" roughness={0.55} />
        </mesh>
        <mesh position={[0.085, 1.06, 0.207]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.13, 0.045, 0.03]} />
          <meshPhysicalMaterial color="#8e5838" roughness={0.55} />
        </mesh>

        <group position={[-0.235, 1.075, 0]}>
          <group ref={freeArm} rotation={[0.08, 0, 0.13]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.056, 0.34, 8, 14]} />
              <meshPhysicalMaterial color="#744027" roughness={0.58} />
            </mesh>
            <mesh
              position={[0.02, -0.425, 0.025]}
              scale={[0.065, 0.085, 0.055]}
              castShadow
            >
              <sphereGeometry args={[1, 16, 12]} />
              <meshPhysicalMaterial color="#edc39a" roughness={0.48} />
            </mesh>
          </group>
        </group>
        <group ref={raisedArm} position={[0.235, 1.075, 0]}>
          <mesh position={[0.087, 0.09, 0.01]} rotation={[0, 0, -0.94]} castShadow>
            <capsuleGeometry args={[0.058, 0.18, 8, 14]} />
            <meshPhysicalMaterial color="#744027" roughness={0.58} />
          </mesh>
          <mesh position={[0.075, 0.295, 0.018]} rotation={[0, 0, 0.41]} castShadow>
            <capsuleGeometry args={[0.054, 0.31, 8, 14]} />
            <meshPhysicalMaterial color="#7f472b" roughness={0.58} />
          </mesh>
          <group position={[-0.005, 0.515, 0.035]}>
            <mesh scale={[0.065, 0.088, 0.055]} castShadow>
              <sphereGeometry args={[1, 16, 12]} />
              <meshPhysicalMaterial color="#edc39a" roughness={0.48} />
            </mesh>
            {[-0.03, 0, 0.03].map((x) => (
              <mesh
                key={x}
                position={[x, 0.072, 0.02]}
                rotation={[0, 0, x * 2]}
                castShadow
              >
                <capsuleGeometry args={[0.012, 0.065, 4, 8]} />
                <meshPhysicalMaterial color="#e9bd91" roughness={0.48} />
              </mesh>
            ))}
          </group>
        </group>

        <mesh position={[0, 1.13, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.085, 0.12, 18]} />
          <meshPhysicalMaterial color="#edc39a" roughness={0.48} />
        </mesh>
        <mesh
          position={[0, 1.16, 0.055]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <torusGeometry args={[0.165, 0.06, 10, 32]} />
          <meshPhysicalMaterial
            color="#f4eee3"
            roughness={0.96}
            sheen={0.12}
          />
        </mesh>
        {[
          [-0.2, 1.14, 0.07, 0.066, 0.05, 0.073],
          [-0.16, 1.173, 0.12, 0.063, 0.049, 0.068],
          [-0.115, 1.195, 0.153, 0.061, 0.048, 0.064],
          [-0.065, 1.205, 0.17, 0.06, 0.047, 0.062],
          [-0.015, 1.207, 0.176, 0.06, 0.047, 0.061],
          [0.035, 1.206, 0.173, 0.06, 0.047, 0.062],
          [0.085, 1.198, 0.16, 0.061, 0.048, 0.064],
          [0.13, 1.185, 0.135, 0.062, 0.049, 0.067],
          [0.17, 1.162, 0.098, 0.064, 0.05, 0.071],
          [0.2, 1.14, 0.06, 0.066, 0.05, 0.073],
        ].map(([x, y, z, sx, sy, sz]) => (
          <mesh
            key={`${x}-${y}`}
            position={[x, y, z]}
            scale={[sx, sy, sz]}
            castShadow
          >
            <sphereGeometry args={[1, 18, 12]} />
            <meshPhysicalMaterial
              color="#f7f1e5"
              roughness={0.93}
              sheen={0.18}
              sheenColor="#ffffff"
            />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <RoundedBox
            key={side}
            castShadow
            position={[side * 0.145, 1.055, 0.172]}
            rotation={[0.04, 0, side * -0.15]}
            args={[0.075, 0.25, 0.042]}
            radius={0.022}
            smoothness={4}
          >
            <meshPhysicalMaterial
              color="#f2eadb"
              roughness={0.92}
              sheen={0.16}
            />
          </RoundedBox>
        ))}

        <group ref={head} position={[0, 1.42, 0]} scale={0.72}>
          <mesh scale={[0.92, 1.04, 0.93]} castShadow>
            <sphereGeometry args={[0.225, 32, 24]} />
            <meshPhysicalMaterial
              color="#edc49b"
              roughness={0.42}
              clearcoat={0.14}
            />
          </mesh>
          <mesh
            position={[0, 0.025, -0.045]}
            scale={[1.06, 1.02, 1.01]}
            castShadow
          >
            <sphereGeometry
              args={[0.225, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.65]}
            />
            <meshPhysicalMaterial
              color="#ba7944"
              roughness={0.5}
              sheen={0.42}
              sheenColor="#e0a26b"
            />
          </mesh>
          <mesh
            position={[0.01, 0.04, -0.12]}
            scale={[0.255, 0.32, 0.19]}
            castShadow
          >
            <sphereGeometry args={[1, 26, 18]} />
            <meshPhysicalMaterial color="#ad6b38" roughness={0.56} />
          </mesh>

          {[-1, 1].map((side) => (
            <group
              key={`twin-tail-${side}`}
              position={[side * 0.245, 0.12, -0.02]}
              rotation={[0.02, 0, side * -0.25]}
            >
              <mesh
                position={[0, 0.005, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <torusGeometry args={[0.045, 0.012, 8, 22]} />
                <meshStandardMaterial color="#5b3926" roughness={0.62} />
              </mesh>
              <mesh
                position={[side * 0.05, -0.25, 0.015]}
                rotation={[0.03, 0, side * -0.08]}
                scale={[1.12, 1, 0.92]}
                castShadow
              >
                <capsuleGeometry args={[0.084, 0.45, 9, 16]} />
                <meshPhysicalMaterial
                  color="#ca8951"
                  roughness={0.46}
                  sheen={0.45}
                  sheenColor="#efbd7f"
                />
              </mesh>
              <mesh
                position={[side * 0.085, -0.57, 0.025]}
                rotation={[0.02, 0, side * 0.05]}
                castShadow
              >
                <capsuleGeometry args={[0.055, 0.31, 8, 14]} />
                <meshPhysicalMaterial
                  color="#b8733f"
                  roughness={0.5}
                  sheen={0.34}
                  sheenColor="#dda36c"
                />
              </mesh>
            </group>
          ))}

          <LongHairStrand
            position={[-0.18, -0.12, 0.08]}
            rotation={[0.03, -0.12, -0.08]}
            length={0.42}
            radius={0.048}
            color="#c98750"
          />
          <LongHairStrand
            position={[-0.14, -0.18, -0.08]}
            rotation={[0.02, -0.24, -0.03]}
            length={0.52}
            radius={0.045}
            color="#ae6d3a"
          />
          <LongHairStrand
            position={[0.18, -0.1, 0.04]}
            rotation={[0.03, 0.13, 0.08]}
            length={0.46}
            radius={0.05}
            color="#c98750"
          />
          <LongHairStrand
            position={[0.13, -0.2, -0.1]}
            rotation={[0.01, 0.24, 0.03]}
            length={0.55}
            radius={0.043}
            color="#a66335"
          />
          <HairFringe
            position={[-0.09, 0.125, 0.168]}
            rotation={[0.12, -0.04, -0.2]}
            length={0.25}
            width={0.035}
          />
          <HairFringe
            position={[-0.028, 0.14, 0.182]}
            rotation={[0.12, 0, 0.04]}
            length={0.28}
            width={0.033}
          />
          <HairFringe
            position={[0.04, 0.14, 0.182]}
            rotation={[0.12, 0.02, 0.12]}
            length={0.27}
            width={0.034}
          />
          <HairFringe
            position={[0.105, 0.122, 0.158]}
            rotation={[0.12, 0.07, 0.25]}
            length={0.24}
            width={0.031}
          />
          <HairFringe
            position={[-0.15, 0.102, 0.142]}
            rotation={[0.1, -0.12, -0.35]}
            length={0.3}
            width={0.032}
            color="#bd7d48"
          />
          <HairFringe
            position={[0.158, 0.098, 0.13]}
            rotation={[0.1, 0.14, 0.39]}
            length={0.29}
            width={0.031}
            color="#c58952"
          />

          <XiaEye x={-0.083} />
          <XiaEye x={0.083} />
          <mesh
            position={[-0.083, 0.07, 0.21]}
            rotation={[0, 0, -0.12]}
          >
            <capsuleGeometry args={[0.0055, 0.058, 4, 8]} />
            <meshStandardMaterial color="#543326" roughness={0.55} />
          </mesh>
          <mesh
            position={[0.083, 0.07, 0.21]}
            rotation={[0, 0, 0.12]}
          >
            <capsuleGeometry args={[0.0055, 0.058, 4, 8]} />
            <meshStandardMaterial color="#543326" roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.055, 0.218]} scale={[0.018, 0.025, 0.012]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#d8a17a" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.118, 0.214]} rotation={[0.12, 0, 0]}>
            <capsuleGeometry args={[0.005, 0.052, 4, 8]} />
            <meshStandardMaterial color="#8b493d" roughness={0.5} />
          </mesh>

          <group position={[0, 0.18, 0.19]} rotation={[0.08, 0, 0]}>
            <mesh position={[-0.087, 0, 0.07]}>
              <boxGeometry args={[0.128, 0.065, 0.025]} />
              <meshPhysicalMaterial
                color="#171a19"
                metalness={0.3}
                roughness={0.2}
                clearcoat={0.7}
              />
            </mesh>
            <mesh position={[0.087, 0, 0.07]}>
              <boxGeometry args={[0.128, 0.065, 0.025]} />
              <meshPhysicalMaterial
                color="#171a19"
                metalness={0.3}
                roughness={0.2}
                clearcoat={0.7}
              />
            </mesh>
            <mesh position={[0, 0, 0.073]}>
              <boxGeometry args={[0.05, 0.012, 0.012]} />
              <meshStandardMaterial
                color="#2d2621"
                metalness={0.6}
                roughness={0.25}
              />
            </mesh>
            {[-0.155, 0.155].map((x) => (
              <mesh
                key={x}
                position={[x, 0, 0.065]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.005, 0.005, 0.19, 8]} />
                <meshStandardMaterial
                  color="#342a24"
                  metalness={0.5}
                  roughness={0.3}
                />
              </mesh>
            ))}
          </group>
        </group>

        <group ref={pendant} position={[0, 1.03, 0.19]}>
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 0.3, 6]} />
            <meshStandardMaterial
              color="#8d8176"
              metalness={0.62}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, -0.32, 0.008]} scale={[0.035, 0.055, 0.025]}>
            <sphereGeometry args={[1, 16, 14]} />
            <meshPhysicalMaterial
              color="#62c4df"
              roughness={0.1}
              transmission={0.25}
              thickness={0.12}
              clearcoat={0.8}
            />
          </mesh>
          <mesh position={[0, -0.37, 0.008]}>
            <coneGeometry args={[0.03, 0.08, 12]} />
            <meshPhysicalMaterial
              color="#4ba8c8"
              roughness={0.12}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function XiaomiRiggedGuide({ motionRef, speedRef }: Omit<GuideModelProps, "guideId">) {
  const root = useRef<Group>(null);
  const normalizer = useRef<Group>(null);
  const { scene, animations } = useGLTF("/models/xiaomi-rigged.glb");
  const { actions } = useAnimations(animations, scene);
  const activeClip = useRef<GuideMotionState | null>(null);
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    });
  }, [scene]);

  useLayoutEffect(() => {
    const target = normalizer.current;
    if (!target) return;
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 1.58 / Math.max(size.y, 0.001);
    target.scale.setScalar(scale);
    target.position.set(
      -center.x * scale,
      -bounds.min.y * scale,
      -center.z * scale,
    );
  }, [scene]);

  useFrame(() => {
    if (!root.current) return;
    const motion = reducedMotion ? "idle" : motionRef.current;
    if (activeClip.current !== motion) {
      const previous = activeClip.current ? actions[activeClip.current] : null;
      const next = actions[motion];
      if (next) {
        next.reset();
        next.enabled = true;
        next.setLoop(
          motion === "turn" ? THREE.LoopOnce : THREE.LoopRepeat,
          motion === "turn" ? 1 : Number.POSITIVE_INFINITY,
        );
        next.clampWhenFinished = motion === "turn";
        next.setEffectiveTimeScale(1);
        next.setEffectiveWeight(1);
        next.play();
        if (previous && previous !== next) {
          previous.crossFadeTo(next, 0.25, false);
        }
      } else {
        previous?.fadeOut(0.25);
      }
      activeClip.current = motion;
    }

    const action = activeClip.current ? actions[activeClip.current] : null;
    if (action) {
      const baseSpeed =
        motion === "jog" ? 2.1 : motion === "walk" ? 1.15 : 1;
      action.setEffectiveTimeScale(
        reducedMotion
          ? 0
          : motion === "walk" || motion === "jog"
            ? THREE.MathUtils.clamp(speedRef.current / baseSpeed, 0.72, 1.38)
            : 1,
      );
    }
  });

  return (
    <group ref={root} position={[0, -0.97, 0]}>
      <group ref={normalizer}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

class GuideModelBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <OrangeGuide /> : this.props.children;
  }
}

function NailongEye({ x }: { x: number }) {
  return (
    <group
      position={[x, 1.255, 0.354]}
      rotation={[0, 0, x < 0 ? -0.05 : 0.05]}
    >
      <mesh>
        <torusGeometry args={[0.036, 0.009, 7, 20, Math.PI]} />
        <meshPhysicalMaterial
          color="#2b2119"
          roughness={0.56}
          clearcoat={0.18}
        />
      </mesh>
    </group>
  );
}

function YellowGuide() {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const bodyProfile = useMemo(
    () =>
      [
        [0.025, 0.18],
        [0.22, 0.21],
        [0.34, 0.35],
        [0.46, 0.54],
        [0.505, 0.74],
        [0.48, 0.96],
        [0.405, 1.17],
        [0.31, 1.35],
        [0.18, 1.45],
        [0.025, 1.49],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    [],
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (root.current) {
      root.current.position.y = -0.97 + Math.abs(Math.sin(time * 1.5)) * 0.015;
    }
    if (body.current) {
      body.current.rotation.z = Math.sin(time * 0.78) * 0.022;
      body.current.scale.y = 1 + Math.sin(time * 1.45) * 0.006;
    }
    if (leftArm.current) {
      leftArm.current.rotation.x = -0.35 + Math.sin(time * 1.1) * 0.045;
      leftArm.current.rotation.z = 0.42 + Math.sin(time * 0.9) * 0.025;
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = -0.35 - Math.sin(time * 1.1) * 0.045;
      rightArm.current.rotation.z = -0.42 - Math.sin(time * 0.9) * 0.025;
    }
    if (tail.current) {
      tail.current.rotation.y = Math.sin(time * 1.1) * 0.16;
    }
  });

  return (
    <group ref={root} position={[0, -0.97, 0]} scale={1.03}>
      <group ref={body}>
        {[-0.16, 0.16].map((x) => (
          <group key={`leg-${x}`} position={[x, 0.3, 0]}>
            <mesh position={[0, -0.08, 0]} castShadow>
              <capsuleGeometry args={[0.095, 0.26, 8, 16]} />
              <meshPhysicalMaterial
                color="#efbf24"
                roughness={0.46}
                clearcoat={0.2}
              />
            </mesh>
            <mesh
              position={[0, -0.24, 0.085]}
              rotation={[0.04, 0, 0]}
              scale={[0.15, 0.075, 0.2]}
              castShadow
            >
              <sphereGeometry args={[1, 20, 14]} />
              <meshPhysicalMaterial
                color="#6e4a32"
                roughness={0.58}
                sheen={0.15}
              />
            </mesh>
            {[-0.07, 0, 0.07].map((toe) => (
              <mesh
                key={toe}
                position={[toe, -0.24, 0.26]}
                scale={[0.032, 0.024, 0.053]}
              >
                <sphereGeometry args={[1, 12, 8]} />
                <meshStandardMaterial color="#4e3427" roughness={0.66} />
              </mesh>
            ))}
          </group>
        ))}

        <mesh
          position={[0, 0, -0.005]}
          scale={[1, 1, 0.79]}
          castShadow
          receiveShadow
        >
          <latheGeometry args={[bodyProfile, 46]} />
          <meshPhysicalMaterial
            color="#f4c62d"
            roughness={0.4}
            clearcoat={0.28}
            clearcoatRoughness={0.3}
            sheen={0.18}
            sheenColor="#fff0a0"
          />
        </mesh>

        <mesh
          position={[0, 0.66, 0.322]}
          scale={[0.32, 0.39, 0.09]}
          castShadow
        >
          <sphereGeometry args={[1, 30, 22]} />
          <meshPhysicalMaterial
            color="#f2dfb2"
            roughness={0.58}
            clearcoat={0.08}
          />
        </mesh>

        <mesh position={[0, 1.07, 0.37]} scale={[0.19, 0.205, 0.082]}>
          <sphereGeometry args={[1, 28, 18]} />
          <meshPhysicalMaterial
            color="#241c17"
            roughness={0.72}
            clearcoat={0.04}
          />
        </mesh>
        <mesh position={[0, 1.155, 0.418]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.27, 0.078, 0.035]} />
          <meshPhysicalMaterial color="#fff9e9" roughness={0.38} />
        </mesh>
        {[-0.1, -0.065, -0.03, 0.005, 0.04, 0.075, 0.11].map((x) => (
          <mesh key={x} position={[x, 1.18, 0.438]}>
            <boxGeometry args={[0.022, 0.035, 0.012]} />
            <meshStandardMaterial color="#ffffff" roughness={0.36} />
          </mesh>
        ))}
        <mesh position={[0, 1.025, 0.435]} scale={[0.105, 0.065, 0.025]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshPhysicalMaterial color="#e77f72" roughness={0.52} />
        </mesh>
        <mesh position={[0, 0.955, 0.43]} rotation={[0.15, 0, 0]}>
          <capsuleGeometry args={[0.008, 0.14, 5, 10]} />
          <meshStandardMaterial color="#573a2d" roughness={0.65} />
        </mesh>
        <NailongEye x={-0.1} />
        <NailongEye x={0.1} />

        <group
          ref={leftArm}
          position={[-0.4, 0.99, 0.04]}
          rotation={[-0.35, 0, 0.42]}
        >
          <mesh
            position={[0, -0.15, 0]}
            rotation={[0, 0, -0.04]}
            castShadow
          >
            <capsuleGeometry args={[0.072, 0.3, 8, 16]} />
            <meshPhysicalMaterial
              color="#edbc24"
              roughness={0.46}
              clearcoat={0.2}
            />
          </mesh>
          <group
            position={[0.015, -0.35, 0.055]}
            rotation={[0.18, 0.1, -0.05]}
          >
            <mesh scale={[0.083, 0.075, 0.06]} castShadow>
              <sphereGeometry args={[1, 18, 14]} />
              <meshPhysicalMaterial color="#704b34" roughness={0.58} />
            </mesh>
            {[-0.036, -0.012, 0.012, 0.036].map((x) => (
              <mesh
                key={x}
                position={[x, 0.06, 0.018]}
                rotation={[0.08, 0, x * 2]}
              >
                <capsuleGeometry args={[0.012, 0.062, 4, 8]} />
                <meshPhysicalMaterial color="#6b4732" roughness={0.58} />
              </mesh>
            ))}
          </group>
        </group>
        <group
          ref={rightArm}
          position={[0.4, 0.99, 0.04]}
          rotation={[-0.35, 0, -0.42]}
        >
          <mesh
            position={[0, -0.15, 0]}
            rotation={[0, 0, 0.04]}
            castShadow
          >
            <capsuleGeometry args={[0.072, 0.3, 8, 16]} />
            <meshPhysicalMaterial
              color="#edbc24"
              roughness={0.46}
              clearcoat={0.2}
            />
          </mesh>
          <group
            position={[-0.015, -0.35, 0.055]}
            rotation={[0.18, -0.1, 0.05]}
          >
            <mesh scale={[0.083, 0.075, 0.06]} castShadow>
              <sphereGeometry args={[1, 18, 14]} />
              <meshPhysicalMaterial color="#704b34" roughness={0.58} />
            </mesh>
            {[-0.036, -0.012, 0.012, 0.036].map((x) => (
              <mesh
                key={x}
                position={[x, 0.06, 0.018]}
                rotation={[0.08, 0, x * 2]}
              >
                <capsuleGeometry args={[0.012, 0.062, 4, 8]} />
                <meshPhysicalMaterial color="#6b4732" roughness={0.58} />
              </mesh>
            ))}
          </group>
        </group>

        <group
          ref={tail}
          position={[0.27, 0.52, -0.29]}
          rotation={[0.38, 0, -0.6]}
        >
          <mesh position={[0, 0.12, 0]} castShadow>
            <coneGeometry args={[0.13, 0.38, 16]} />
            <meshPhysicalMaterial
              color="#e5b320"
              roughness={0.5}
              clearcoat={0.16}
            />
          </mesh>
          <mesh position={[0, 0.27, 0]} castShadow>
            <sphereGeometry args={[0.11, 16, 12]} />
            <meshPhysicalMaterial color="#f0c52c" roughness={0.46} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function ThreeDGuideModel({
  guideId,
  motionRef,
  speedRef,
}: GuideModelProps) {
  return guideId === "yellow" ? (
    <YellowGuide />
  ) : (
    <GuideModelBoundary>
      <Suspense fallback={<OrangeGuide />}>
        <XiaomiRiggedGuide motionRef={motionRef} speedRef={speedRef} />
      </Suspense>
    </GuideModelBoundary>
  );
}
