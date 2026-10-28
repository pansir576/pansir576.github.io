"use client";
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { useTexture } from "@react-three/drei";
import { hasIngredientPhoto } from "@/lib/media";

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

function createTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
  repeatX = 1,
  repeatY = 1,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  draw(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}

function drawStone(context: CanvasRenderingContext2D) {
  const random = seededRandom(71);
  context.fillStyle = "#f3efe6";
  context.fillRect(0, 0, 512, 512);
  for (let index = 0; index < 3000; index += 1) {
    const alpha = 0.015 + random() * 0.035;
    context.fillStyle = `rgba(101, 94, 81, ${alpha})`;
    context.fillRect(random() * 512, random() * 512, 1, 1);
  }
  for (let line = 0; line < 8; line += 1) {
    context.strokeStyle = `rgba(128, 120, 105, ${0.06 + random() * 0.08})`;
    context.lineWidth = 0.8 + random() * 1.1;
    context.beginPath();
    const y = 30 + line * 60;
    context.moveTo(0, y);
    context.bezierCurveTo(
      100,
      y - 24 + random() * 48,
      280,
      y - 36 + random() * 72,
      512,
      y - 10 + random() * 20,
    );
    context.stroke();
  }
}

function drawTile(context: CanvasRenderingContext2D) {
  context.fillStyle = "#eeeae0";
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = "rgba(132, 126, 112, 0.2)";
  context.lineWidth = 2;
  for (let x = 0; x <= 512; x += 128) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 512);
    context.stroke();
  }
  for (let y = 0; y <= 512; y += 85) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(512, y);
    context.stroke();
  }
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "rgba(255,255,255,0.32)");
  gradient.addColorStop(1, "rgba(141,128,105,0.08)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
}

function drawCabinet(context: CanvasRenderingContext2D) {
  const random = seededRandom(44);
  context.fillStyle = "#eee9df";
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 900; index += 1) {
    context.fillStyle = `rgba(102, 96, 84, ${random() * 0.012})`;
    context.fillRect(random() * 256, random() * 256, 1, 1);
  }
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "rgba(255,255,255,0.1)");
  gradient.addColorStop(1, "rgba(108,91,66,0.035)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
}

function drawOutside(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#d8edf1");
  gradient.addColorStop(0.58, "#e8f1df");
  gradient.addColorStop(1, "#b9c9a8");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  const random = seededRandom(94);
  for (let index = 0; index < 46; index += 1) {
    const x = random() * 512;
    const y = 180 + random() * 290;
    const radius = 16 + random() * 45;
    context.fillStyle = `rgba(${48 + random() * 35}, ${91 + random() * 50}, ${48 + random() * 35}, ${0.16 + random() * 0.25})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

export function useKitchenTextures() {
  const floorPhoto = useTexture("/images/scene/textures/floor-oak.webp");
  const textures = useMemo(() => {
    const cabinet = createTexture(256, 256, drawCabinet, 1.5, 1.2);
    const stone = createTexture(512, 512, drawStone, 2.4, 1.8);
    const tile = createTexture(512, 512, drawTile, 5, 2.2);
    const outside = createTexture(512, 512, drawOutside);
    return { cabinet, stone, tile, outside };
  }, []);

  useEffect(() => {
    floorPhoto.colorSpace = SRGBColorSpace;
    floorPhoto.wrapS = RepeatWrapping;
    floorPhoto.wrapT = RepeatWrapping;
    floorPhoto.repeat.set(4.2, 3.5);
    floorPhoto.anisotropy = 8;
    floorPhoto.needsUpdate = true;
  }, [floorPhoto]);

  useEffect(
    () => () => {
      Object.values(textures).forEach((texture) => texture.dispose());
    },
    [textures],
  );

  return {
    ...textures,
    floor: floorPhoto,
  };
}

export function useFoodPhotoTexture(ingredientId: string) {
  const path = hasIngredientPhoto(ingredientId)
    ? `/images/food-textures/${ingredientId}.webp`
    : "/images/food-textures/_fallback.webp";
  const texture = useTexture(path);

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  return texture;
}

export function useIngredientTexture(colors: {
  main: string;
  soft: string;
  accent: string;
}) {
  const texture = useMemo(() => {
    const random = seededRandom(
      colors.main
        .split("")
        .reduce((sum, character) => sum + character.charCodeAt(0), 0),
    );
    return createTexture(
      128,
      128,
      (context) => {
        context.fillStyle = colors.main;
        context.fillRect(0, 0, 128, 128);
        for (let index = 0; index < 280; index += 1) {
          context.fillStyle =
            index % 4 === 0
              ? `${colors.soft}66`
              : `rgba(255,255,255,${random() * 0.08})`;
          const size = 0.6 + random() * 2.3;
          context.beginPath();
          context.arc(
            random() * 128,
            random() * 128,
            size,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        for (let index = 0; index < 7; index += 1) {
          context.strokeStyle = `${colors.accent}33`;
          context.lineWidth = 0.7 + random();
          context.beginPath();
          context.moveTo(random() * 128, 0);
          context.bezierCurveTo(
            random() * 128,
            40,
            random() * 128,
            90,
            random() * 128,
            128,
          );
          context.stroke();
        }
      },
      1.2,
      1.2,
    );
  }, [colors.accent, colors.main, colors.soft]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
