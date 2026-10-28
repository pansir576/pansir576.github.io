"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import {
  type Group,
  type Mesh,
  type Texture,
} from "three";
import type {
  CutStage,
  HeatBand,
  IngredientDefinition,
} from "@/lib/types";
import { useFoodPhotoTexture } from "./three-d-materials";

const heatColors: Record<HeatBand, string> = {
  idle: "#ffffff",
  green: "#f2eee4",
  yellow: "#e7c46d",
  perfect: "#b4d6a2",
  danger: "#b54c38",
  burnt: "#27221f",
};

function PieceShape({
  ingredient,
  index,
  cutStage,
  color,
  texture,
}: {
  ingredient: IngredientDefinition;
  index: number;
  cutStage: CutStage;
  color: string;
  texture: Texture;
}) {
  const small = cutStage === "cut";
  const strip = cutStage === "strips";
  const scale = small ? 0.23 : strip ? 0.32 : 1;
  const height = small ? 0.12 : strip ? 0.1 : 0.28;
  const overheated =
    color === heatColors.danger || color === heatColors.burnt;
  const potatoColor = overheated ? color : "#d6b06d";
  const eggColor = overheated ? color : "#f2dfbd";
  const tomatoColor = overheated ? color : "#c9412f";
  const tofuColor = overheated ? color : "#f1e9d8";
  const fishColor = overheated ? color : "#9aaeb2";

  if (ingredient.art === "potato") {
    if (cutStage !== "whole") {
      return (
        <RoundedBox
          castShadow
          args={[strip ? 0.48 : 0.25, height, strip ? 0.13 : 0.22]}
          radius={0.045}
          smoothness={2}
        >
          <meshPhysicalMaterial
            color={potatoColor}
            roughness={0.72}
            clearcoat={0.08}
          />
        </RoundedBox>
      );
    }
    return (
      <group>
        {[
          [-0.18, 0, 0.08, 0.36, 0.25, 0.29],
          [0.17, -0.01, -0.07, 0.32, 0.23, 0.26],
          [0.01, 0.03, 0.23, 0.29, 0.2, 0.24],
        ].map(([x, y, z, sx, sy, sz], lobe) => (
          <mesh
            key={lobe}
            castShadow
            position={[x, y, z]}
            scale={[sx, sy, sz]}
            rotation={[0.1, lobe * 0.7, lobe % 2 ? 0.05 : -0.08]}
          >
            <sphereGeometry args={[1, 20, 14]} />
            <meshPhysicalMaterial
              color={potatoColor}
              roughness={0.7}
              clearcoat={0.1}
              clearcoatRoughness={0.68}
            />
          </mesh>
        ))}
        {[-0.2, 0.06, 0.23].map((x) => (
          <mesh key={x} position={[x, 0.21, 0.11]}>
            <sphereGeometry args={[0.014, 7, 5]} />
            <meshStandardMaterial color="#896b43" roughness={0.9} />
          </mesh>
        ))}
      </group>
    );
  }

  if (ingredient.art === "egg") {
    return (
      <mesh
        castShadow
        scale={[0.32 * scale, 0.42 * scale, 0.32 * scale]}
        rotation={[0.04, index * 0.65, 0.03]}
      >
        <sphereGeometry args={[1, 22, 16]} />
        <meshPhysicalMaterial
          color={eggColor}
          roughness={0.32}
          clearcoat={0.44}
          clearcoatRoughness={0.26}
        />
      </mesh>
    );
  }

  if (ingredient.art === "tomato") {
    return (
      <mesh castShadow scale={scale * 0.46}>
        <sphereGeometry args={[1, 22, 16]} />
        <meshPhysicalMaterial
          color={tomatoColor}
          roughness={0.34}
          clearcoat={0.54}
          clearcoatRoughness={0.22}
        />
      </mesh>
    );
  }

  if (ingredient.art === "tofu") {
    return (
      <group>
        <RoundedBox
          castShadow
          args={[strip ? 0.55 : scale * 0.55, height, small ? 0.25 : 0.42]}
          radius={0.025}
          smoothness={2}
        >
          <meshPhysicalMaterial
            map={texture}
            color={tofuColor}
            roughness={0.58}
            clearcoat={0.12}
          />
        </RoundedBox>
        {cutStage === "whole" &&
          [
            [-0.12, 0.16, 0.08],
            [0.11, 0.16, -0.1],
            [0.17, 0.16, 0.13],
          ].map(([x, y, z], pore) => (
            <mesh key={pore} position={[x, y, z]}>
              <sphereGeometry args={[0.018, 7, 5]} />
              <meshStandardMaterial color="#cfc3ab" roughness={0.9} />
            </mesh>
          ))}
      </group>
    );
  }

  if (ingredient.art === "fish") {
    return (
      <group>
        <mesh
          castShadow
          scale={[strip ? 0.43 : scale * 0.65, 0.18, small ? 0.14 : 0.26]}
        >
          <sphereGeometry args={[1, 20, 12]} />
          <meshPhysicalMaterial
            map={texture}
            color={fishColor}
            roughness={0.3}
            clearcoat={0.45}
            clearcoatRoughness={0.24}
          />
        </mesh>
        {cutStage === "whole" && index === 0 && (
          <mesh position={[0, 0.02, -0.42]} rotation={[0.18, 0, 0]}>
            <coneGeometry args={[0.26, 0.42, 3]} />
            <meshPhysicalMaterial
              map={texture}
              color={overheated ? color : "#87979a"}
              roughness={0.38}
            />
          </mesh>
        )}
      </group>
    );
  }

  if (ingredient.art === "beef" || ingredient.art === "pork") {
    const isPork = ingredient.art === "pork";
    const meatColor = overheated
      ? color
      : isPork
        ? "#d78e80"
        : "#a83b37";
    return (
      <RoundedBox
        castShadow
        args={[
          strip ? 0.65 : scale * 0.7,
          small ? 0.14 : 0.28,
          small ? 0.26 : 0.42,
        ]}
        radius={0.045}
        smoothness={2}
      >
        <meshPhysicalMaterial
          map={texture}
          color={meatColor}
          roughness={0.48}
          clearcoat={0.18}
          clearcoatRoughness={0.4}
        />
      </RoundedBox>
    );
  }

  if (ingredient.art === "greens" || ingredient.archetype === "leafy") {
    return (
      <mesh
        castShadow
        scale={[strip ? 0.34 : 0.5, 0.06, small ? 0.14 : 0.24]}
        rotation={[0.08, (index - 1.5) * 0.4, -0.12 + index * 0.05]}
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshPhysicalMaterial
          map={texture}
          color={color}
          roughness={0.5}
          clearcoat={0.24}
          clearcoatRoughness={0.55}
          sheen={0.16}
          sheenColor="#d7e8c1"
        />
      </mesh>
    );
  }

  if (ingredient.art === "egg") {
    return (
      <mesh
        castShadow
        scale={[0.31 * scale, 0.4 * scale, 0.31 * scale]}
      >
        <sphereGeometry args={[1, 18, 12]} />
        <meshPhysicalMaterial
          map={texture}
          color="#f4e4b7"
          roughness={0.32}
          clearcoat={0.36}
          clearcoatRoughness={0.28}
        />
      </mesh>
    );
  }

  if (ingredient.art === "tomato" || ingredient.archetype === "melon") {
    return (
      <mesh castShadow scale={scale * 0.48}>
        <sphereGeometry args={[1, 18, 12]} />
        <meshPhysicalMaterial
          map={texture}
          color={color}
          roughness={0.36}
          clearcoat={0.46}
          clearcoatRoughness={0.25}
        />
      </mesh>
    );
  }

  if (ingredient.art === "fish" || ingredient.archetype === "seafood") {
    return (
      <mesh castShadow scale={[strip ? 0.38 : scale * 0.65, 0.1, small ? 0.13 : 0.22]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshPhysicalMaterial
          map={texture}
          color={color}
          roughness={0.34}
          clearcoat={0.3}
          clearcoatRoughness={0.32}
        />
      </mesh>
    );
  }

  if (
    ingredient.art === "beef" ||
    ingredient.art === "pork" ||
    ingredient.archetype === "red-meat" ||
    ingredient.archetype === "poultry"
  ) {
    return (
      <RoundedBox
        castShadow
        args={[strip ? 0.6 : scale * 0.75, height, small ? 0.24 : 0.45]}
        radius={0.08}
        smoothness={2}
      >
        <meshPhysicalMaterial
          map={texture}
          color={color}
          roughness={0.48}
          clearcoat={0.16}
          clearcoatRoughness={0.54}
        />
      </RoundedBox>
    );
  }

  if (
    ingredient.art === "tofu" ||
    ingredient.archetype === "soy-product" ||
    ingredient.archetype === "mushroom"
  ) {
    return (
      <RoundedBox
        castShadow
        args={[scale * 0.58, small ? 0.18 : 0.3, small ? 0.28 : 0.5]}
        radius={0.04}
        smoothness={2}
      >
        <meshPhysicalMaterial
          map={texture}
          color={color}
          roughness={0.68}
          clearcoat={0.08}
        />
      </RoundedBox>
    );
  }

  return (
    <mesh castShadow scale={[scale * 0.5, height, small ? 0.22 : 0.35]}>
      <sphereGeometry args={[1, 14, 9]} />
      <meshPhysicalMaterial
        map={ingredient.archetype === "root" ? undefined : texture}
        color={color}
        roughness={0.56}
        clearcoat={0.1}
      />
    </mesh>
  );
}

export function ThreeDIngredientModel({
  ingredient,
  cutStage,
  dirty = false,
  heatBand = "idle",
  visible = true,
  scale = 1,
}: {
  ingredient: IngredientDefinition;
  cutStage: CutStage;
  dirty?: boolean;
  heatBand?: HeatBand;
  visible?: boolean;
  scale?: number;
}) {
  const group = useRef<Group>(null);
  const texture = useFoodPhotoTexture(ingredient.id);
  const pieces = cutStage === "cut" ? 7 : cutStage === "strips" ? 4 : 1;
  const color =
    heatBand === "burnt"
      ? heatColors.burnt
      : heatBand === "danger"
        ? heatColors.danger
        : ingredient.palette.main;

  const offsets = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => {
        const angle = index * 2.4;
        const radius = index === 0 ? 0 : 0.33 + (index % 3) * 0.08;
        return [
          Math.cos(angle) * radius,
          0.06 + (index % 3) * 0.025,
          Math.sin(angle) * radius * 0.65,
        ] as [number, number, number];
      }),
    [pieces],
  );

  useFrame(({ clock }) => {
    if (!group.current || !visible) return;
    if (heatBand === "danger") {
      group.current.position.y = Math.sin(clock.elapsedTime * 18) * 0.006;
    } else if (heatBand === "perfect") {
      group.current.position.y = Math.sin(clock.elapsedTime * 2.4) * 0.003;
    } else {
      group.current.position.y = 0;
    }
  });

  return (
    <group ref={group} visible={visible} scale={scale}>
      {offsets.map((offset, index) => (
        <group
          key={index}
          position={offset}
          rotation={[0, index * 0.73, (index % 2 ? 1 : -1) * 0.08]}
        >
          <PieceShape
            ingredient={ingredient}
            index={index}
            cutStage={cutStage}
            color={color}
            texture={texture}
          />
          {dirty && (
            <mesh position={[0.08, 0.08, 0.03]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshStandardMaterial color="#5e4b31" roughness={1} />
            </mesh>
          )}
        </group>
      ))}
      {heatBand === "perfect" && (
        <pointLight
          position={[0, 0.28, 0]}
          color="#cfe9bf"
          intensity={0.28}
          distance={1.2}
        />
      )}
      {cutStage === "whole" && ingredient.art === "tomato" && (
        <group position={[0, 0.2, 0]}>
          {[0, 1, 2, 3, 4].map((index) => (
            <mesh
              key={index}
              rotation={[0.45, index * 1.25, 0.1]}
              position={[
                Math.sin(index * 1.25) * 0.13,
                0.04,
                Math.cos(index * 1.25) * 0.13,
              ]}
            >
              <coneGeometry args={[0.08, 0.24, 5]} />
              <meshStandardMaterial color="#4f7b4c" roughness={0.76} />
            </mesh>
          ))}
        </group>
      )}
      {cutStage === "whole" && ingredient.art === "fish" && (
        <group>
          <mesh position={[0, 0.03, -0.36]} rotation={[0.2, 0, 0]}>
            <coneGeometry args={[0.22, 0.34, 3]} />
            <meshPhysicalMaterial
              map={texture}
              color={color}
              roughness={0.36}
            />
          </mesh>
          <mesh position={[0.23, 0.08, 0.12]}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color="#171817" roughness={0.18} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function KnifeModel({
  active,
  progress,
}: {
  active: boolean;
  progress: number;
}) {
  const knife = useRef<Group>(null);
  const blade = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!knife.current) return;
    const swing = active
      ? Math.sin(clock.elapsedTime * (8 + progress * 0.04)) * 0.32
      : 0.15;
    knife.current.rotation.z = -0.18 + swing;
    knife.current.position.y = 0.42 + Math.max(0, -swing) * 0.18;
    if (blade.current) {
      blade.current.rotation.y = Math.sin(clock.elapsedTime) * 0.02;
    }
  });

  return (
    <group ref={knife} position={[0.2, 0.44, 0.18]} rotation={[0.12, 0, -0.18]}>
      <mesh ref={blade} castShadow>
        <boxGeometry args={[0.05, 0.34, 0.5]} />
        <meshStandardMaterial
          color="#d7d9d8"
          metalness={0.82}
          roughness={0.24}
        />
      </mesh>
      <mesh position={[0, -0.22, -0.16]} castShadow>
        <boxGeometry args={[0.06, 0.11, 0.28]} />
        <meshStandardMaterial color="#55382a" roughness={0.8} />
      </mesh>
    </group>
  );
}
