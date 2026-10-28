import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((data) => {
      this.result = data;
      this.onloadend?.();
    });
  }
};

const output = resolve("public/models/xiaomi-rigged.glb");
const scene = new THREE.Scene();
scene.name = "XiaomiRiggedCharacter";

const boneDefinitions = [
  ["Root", null, [0, 0, 0]],
  ["Hips", "Root", [0, 0.8, 0]],
  ["Spine", "Hips", [0, 0.14, 0]],
  ["Chest", "Spine", [0, 0.15, 0]],
  ["Neck", "Chest", [0, 0.12, 0]],
  ["Head", "Neck", [0, 0.12, 0]],
  ["HairL", "Head", [-0.13, 0.1, -0.025]],
  ["HairR", "Head", [0.13, 0.1, -0.025]],
  ["ClavicleL", "Chest", [-0.065, 0.06, 0]],
  ["ClavicleR", "Chest", [0.065, 0.06, 0]],
  ["UpperArmL", "ClavicleL", [-0.125, 0, 0]],
  ["UpperArmR", "ClavicleR", [0.125, 0, 0]],
  ["LowerArmL", "UpperArmL", [-0.025, -0.28, 0.005]],
  ["LowerArmR", "UpperArmR", [0.025, -0.28, 0.005]],
  ["HandL", "LowerArmL", [-0.015, -0.235, 0.01]],
  ["HandR", "LowerArmR", [0.015, -0.235, 0.01]],
  ["ThighL", "Hips", [-0.105, -0.02, 0]],
  ["ThighR", "Hips", [0.105, -0.02, 0]],
  ["ShinL", "ThighL", [0, -0.36, 0.005]],
  ["ShinR", "ThighR", [0, -0.36, 0.005]],
  ["FootL", "ShinL", [0, -0.335, 0.015]],
  ["FootR", "ShinR", [0, -0.335, 0.015]],
  ["CoatTail", "Hips", [0, -0.02, -0.045]],
];

const bones = [];
const boneByName = new Map();
for (const [name, parentName, localPosition] of boneDefinitions) {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.fromArray(localPosition);
  if (parentName) boneByName.get(parentName).add(bone);
  bones.push(bone);
  boneByName.set(name, bone);
}

const boneIndex = new Map(bones.map((bone, index) => [bone.name, index]));
const geometries = [];

function addPart(
  geometry,
  bone,
  color,
  {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
  } = {},
) {
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("uv1");
  geometry.deleteAttribute("tangent");
  if (!geometry.index) {
    throw new Error("Rigged character parts must use indexed geometry");
  }
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  geometry.computeVertexNormals();

  const count = geometry.attributes.position.count;
  const tint = new THREE.Color(color);
  const colors = new Float32Array(count * 3);
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);
  const index = boneIndex.get(bone);
  if (index === undefined) throw new Error(`Unknown bone ${bone}`);
  for (let vertex = 0; vertex < count; vertex += 1) {
    colors[vertex * 3] = tint.r;
    colors[vertex * 3 + 1] = tint.g;
    colors[vertex * 3 + 2] = tint.b;
    skinIndices[vertex * 4] = index;
    skinWeights[vertex * 4] = 1;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(skinIndices, 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(skinWeights, 4),
  );
  geometries.push(geometry);
}

function addSphere(color, bone, position, scale, segments = 36) {
  addPart(
    new THREE.SphereGeometry(1, segments, Math.max(20, segments / 2)),
    bone,
    color,
    { position, scale },
  );
}

function addCapsule(
  color,
  bone,
  position,
  radius,
  length,
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
) {
  addPart(
    new THREE.CapsuleGeometry(radius, length, 12, 28),
    bone,
    color,
    { position, scale, rotation },
  );
}

function addBox(
  color,
  bone,
  position,
  size,
  rotation = [0, 0, 0],
) {
  addPart(
    new THREE.BoxGeometry(...size, 3, 3, 3),
    bone,
    color,
    { position, rotation },
  );
}

function addTube(points, radius, color, bone, segments = 28) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
  );
  addPart(
    new THREE.TubeGeometry(curve, segments, radius, 9, false),
    bone,
    color,
  );
}

const skin = "#e7b98f";
const skinLight = "#f2cda7";
const hair = "#c88b52";
const hairDark = "#a96d3d";
const coat = "#7b4a2f";
const coatDark = "#613a28";
const pink = "#b97884";
const fur = "#f1eadf";
const shoe = "#3f342f";
const black = "#241b18";

// Head and face.
addSphere(skin, "Head", [0, 1.44, 0.015], [0.137, 0.162, 0.128], 64);
addSphere(skinLight, "Head", [0, 1.34, 0.025], [0.095, 0.07, 0.09], 32);
addSphere(hair, "Head", [0, 1.49, -0.015], [0.148, 0.125, 0.135], 44);
addSphere(hairDark, "Head", [0, 1.45, -0.075], [0.124, 0.12, 0.09], 36);

for (const side of [-1, 1]) {
  addSphere(
    skin,
    "Head",
    [side * 0.135, 1.42, 0.012],
    [0.018, 0.035, 0.013],
    24,
  );
  addSphere(
    "#fffaf0",
    "Head",
    [side * 0.051, 1.445, 0.128],
    [0.033, 0.021, 0.007],
    26,
  );
  addSphere(
    "#aa7430",
    "Head",
    [side * 0.051, 1.443, 0.136],
    [0.017, 0.018, 0.005],
    22,
  );
  addSphere(
    "#251b15",
    "Head",
    [side * 0.051, 1.442, 0.141],
    [0.007, 0.012, 0.004],
    18,
  );
  addSphere(
    "#fffdf8",
    "Head",
    [side * 0.046, 1.451, 0.145],
    [0.004, 0.004, 0.002],
    12,
  );
  addTube(
    [
      [side * 0.021, 1.463, 0.137],
      [side * 0.051, 1.472, 0.14],
      [side * 0.081, 1.459, 0.132],
    ],
    0.0028,
    "#39241a",
    "Head",
    14,
  );
  addTube(
    [
      [side * 0.026, 1.493, 0.123],
      [side * 0.052, 1.5, 0.127],
      [side * 0.079, 1.491, 0.119],
    ],
    0.0022,
    "#5b3827",
    "Head",
    12,
  );
  addSphere(
    "#dfa09a",
    "Head",
    [side * 0.085, 1.4, 0.112],
    [0.02, 0.01, 0.004],
    18,
  );
}

addSphere(
  skinLight,
  "Head",
  [0, 1.408, 0.141],
  [0.008, 0.014, 0.008],
  18,
);
addTube(
  [
    [-0.022, 1.37, 0.142],
    [0, 1.363, 0.148],
    [0.022, 1.37, 0.142],
  ],
  0.0024,
  "#8b4b43",
  "Head",
  14,
);
addSphere(
  "#c77e7a",
  "Head",
  [0, 1.356, 0.142],
  [0.015, 0.0045, 0.004],
  16,
);

// Sunglasses perched above the forehead.
addBox(black, "Head", [-0.058, 1.565, 0.11], [0.085, 0.045, 0.022], [0.18, -0.06, -0.08]);
addBox(black, "Head", [0.058, 1.565, 0.11], [0.085, 0.045, 0.022], [0.18, 0.06, 0.08]);
addBox("#554b45", "Head", [0, 1.56, 0.127], [0.035, 0.009, 0.008]);

// Long twin tails.
for (const side of [-1, 1]) {
  const hairBone = side < 0 ? "HairL" : "HairR";
  addSphere("#4d372c", hairBone, [side * 0.13, 1.53, 0], [0.032, 0.025, 0.03], 20);
  addTube(
    [
      [side * 0.13, 1.53, -0.015],
      [side * 0.18, 1.39, -0.03],
      [side * 0.205, 1.18, -0.02],
      [side * 0.17, 1.0, -0.01],
      [side * 0.145, 0.86, 0.01],
    ],
    0.029,
    hair,
    hairBone,
  );
  addTube(
    [
      [side * 0.125, 1.52, -0.03],
      [side * 0.15, 1.34, -0.06],
      [side * 0.16, 1.12, -0.055],
      [side * 0.13, 0.92, -0.03],
    ],
    0.022,
    hairDark,
    hairBone,
  );
  addTube(
    [
      [side * 0.145, 1.52, -0.01],
      [side * 0.205, 1.36, -0.015],
      [side * 0.225, 1.16, 0],
      [side * 0.19, 0.98, 0.02],
    ],
    0.017,
    "#d79a60",
    hairBone,
  );
}

// Neck, coat, sweater and skirt.
addCapsule(skin, "Neck", [0, 1.29, 0], 0.055, 0.08);
addPart(
  new THREE.CylinderGeometry(0.19, 0.29, 0.42, 36, 8),
  "Spine",
  coat,
  { position: [0, 0.98, 0], scale: [1, 1, 0.7] },
);
addPart(
  new THREE.CylinderGeometry(0.29, 0.33, 0.32, 36, 8),
  "CoatTail",
  coatDark,
  { position: [0, 0.67, -0.01], scale: [1, 1, 0.7] },
);
addBox(pink, "Spine", [0, 1.01, 0.145], [0.13, 0.31, 0.04]);
addBox(pink, "Hips", [0, 0.79, 0.13], [0.24, 0.24, 0.055]);
addBox(coat, "Spine", [-0.105, 0.99, 0.17], [0.08, 0.43, 0.04], [0, 0.07, -0.11]);
addBox(coat, "Spine", [0.105, 0.99, 0.17], [0.08, 0.43, 0.04], [0, -0.07, 0.11]);
addBox(coatDark, "Hips", [-0.085, 0.69, 0.19], [0.06, 0.2, 0.02], [0, 0, -0.12]);
addBox(coatDark, "Hips", [0.085, 0.69, 0.19], [0.06, 0.2, 0.02], [0, 0, 0.12]);

for (let index = 0; index < 15; index += 1) {
  const angle = THREE.MathUtils.lerp(-1.15, 1.15, index / 14);
  addSphere(
    fur,
    "Chest",
    [
      Math.sin(angle) * 0.172,
      1.205 + Math.cos(angle) * 0.03,
      Math.cos(angle) * 0.122,
    ],
    [0.052, 0.036, 0.046],
    26,
  );
}
for (const side of [-1, 1]) {
  addBox(
    fur,
    "Chest",
    [side * 0.125, 1.065, 0.176],
    [0.026, 0.15, 0.026],
    [0, 0, side * -0.12],
  );
  addSphere("#c99d45", "Spine", [side * 0.11, 0.86, 0.215], [0.017, 0.017, 0.01], 14);
}

// Pendant.
addCapsule("#7d6f63", "Chest", [0, 1.08, 0.22], 0.003, 0.24, [1, 1, 0.8]);
addSphere("#5ac4d8", "Chest", [0, 0.93, 0.225], [0.024, 0.043, 0.017], 20);
addCapsule("#5ac4d8", "Chest", [0, 0.885, 0.225], 0.011, 0.05, [1, 1, 0.7]);

// Arms.
for (const side of [-1, 1]) {
  const upper = side < 0 ? "UpperArmL" : "UpperArmR";
  const lower = side < 0 ? "LowerArmL" : "LowerArmR";
  const hand = side < 0 ? "HandL" : "HandR";
  addCapsule(coat, upper, [side * 0.255, 1.05, 0.005], 0.052, 0.24, [1, 1, 0.9]);
  addCapsule(coat, lower, [side * 0.285, 0.86, 0.015], 0.045, 0.19, [1, 1, 0.9]);
  addCapsule(pink, lower, [side * 0.285, 0.75, 0.02], 0.045, 0.06, [1, 1, 0.9]);
  addSphere(skin, hand, [side * 0.292, 0.675, 0.04], [0.043, 0.065, 0.034], 24);
}

// Legs and sneakers.
for (const side of [-1, 1]) {
  const thigh = side < 0 ? "ThighL" : "ThighR";
  const shin = side < 0 ? "ShinL" : "ShinR";
  const foot = side < 0 ? "FootL" : "FootR";
  addCapsule(skin, thigh, [side * 0.105, 0.59, 0.005], 0.063, 0.27);
  addSphere(skin, thigh, [side * 0.105, 0.4, 0.005], [0.068, 0.07, 0.064], 20);
  addCapsule(skin, shin, [side * 0.115, 0.23, 0.01], 0.052, 0.23);
  addSphere(shoe, foot, [side * 0.115, 0.065, 0.075], [0.078, 0.045, 0.13], 22);
  addBox("#f2ede1", foot, [side * 0.115, 0.035, 0.085], [0.14, 0.022, 0.22]);
  addBox("#c8c4bc", foot, [side * 0.115, 0.055, 0.06], [0.135, 0.014, 0.17]);
}

const rootBone = boneByName.get("Root");
const merged = mergeGeometries(geometries, false);
merged.computeBoundingSphere();
merged.computeBoundingBox();
const material = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.58,
  metalness: 0.02,
  side: THREE.DoubleSide,
});
const character = new THREE.SkinnedMesh(merged, material);
character.name = "XiaomiRiggedMesh";
character.frustumCulled = false;
scene.add(character);
character.add(rootBone);
scene.updateMatrixWorld(true);
const skeleton = new THREE.Skeleton(bones);
character.bind(skeleton, character.matrixWorld);

function quaternionTrack(boneName, times, rotations) {
  const values = [];
  for (const [x, y, z] of rotations) {
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(x, y, z),
    );
    values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  return new THREE.QuaternionKeyframeTrack(
    `${boneName}.quaternion`,
    times,
    values,
  );
}

function positionTrack(boneName, times, positions) {
  return new THREE.VectorKeyframeTrack(
    `${boneName}.position`,
    times,
    positions.flat(),
  );
}

const idleTimes = [0, 1.2, 2.4, 3.6, 4.8];
const walkTimes = [0, 0.25, 0.5, 0.75, 1];
const jogTimes = [0, 0.18, 0.36, 0.54, 0.72];
const turnTimes = [0, 0.3, 0.65, 1];

const animations = [
  new THREE.AnimationClip("Idle", 4.8, [
    quaternionTrack("Chest", idleTimes, [
      [0, 0, 0],
      [0, 0.018, -0.006],
      [0, 0, 0],
      [0, -0.018, 0.006],
      [0, 0, 0],
    ]),
    quaternionTrack("Head", idleTimes, [
      [0, 0, 0],
      [0.01, 0.06, 0.006],
      [0, 0.02, 0],
      [0.008, -0.05, -0.005],
      [0, 0, 0],
    ]),
    quaternionTrack("HairL", idleTimes, [
      [0, 0, 0],
      [0.018, -0.025, -0.02],
      [0, 0, 0],
      [0.014, 0.018, 0.015],
      [0, 0, 0],
    ]),
    quaternionTrack("HairR", idleTimes, [
      [0, 0, 0],
      [0.014, 0.018, 0.015],
      [0, 0, 0],
      [0.018, -0.025, -0.02],
      [0, 0, 0],
    ]),
    positionTrack("Hips", idleTimes, [
      [0, 0.8, 0],
      [0, 0.806, 0],
      [0, 0.8, 0],
      [0, 0.803, 0],
      [0, 0.8, 0],
    ]),
  ]),
  new THREE.AnimationClip("Walk", 1, [
    quaternionTrack("ThighL", walkTimes, [
      [-0.5, 0, 0],
      [0, 0, 0],
      [0.5, 0, 0],
      [0, 0, 0],
      [-0.5, 0, 0],
    ]),
    quaternionTrack("ThighR", walkTimes, [
      [0.5, 0, 0],
      [0, 0, 0],
      [-0.5, 0, 0],
      [0, 0, 0],
      [0.5, 0, 0],
    ]),
    quaternionTrack("ShinL", walkTimes, [
      [0.05, 0, 0],
      [0.06, 0, 0],
      [0.45, 0, 0],
      [0.18, 0, 0],
      [0.05, 0, 0],
    ]),
    quaternionTrack("ShinR", walkTimes, [
      [0.45, 0, 0],
      [0.18, 0, 0],
      [0.05, 0, 0],
      [0.06, 0, 0],
      [0.45, 0, 0],
    ]),
    quaternionTrack("UpperArmL", walkTimes, [
      [0.32, 0, 0.03],
      [0, 0, 0.03],
      [-0.32, 0, 0.03],
      [0, 0, 0.03],
      [0.32, 0, 0.03],
    ]),
    quaternionTrack("UpperArmR", walkTimes, [
      [-0.32, 0, -0.03],
      [0, 0, -0.03],
      [0.32, 0, -0.03],
      [0, 0, -0.03],
      [-0.32, 0, -0.03],
    ]),
    quaternionTrack("CoatTail", walkTimes, [
      [0.035, 0, 0],
      [0, 0, 0.015],
      [-0.035, 0, 0],
      [0, 0, -0.015],
      [0.035, 0, 0],
    ]),
    positionTrack("Hips", walkTimes, [
      [0, 0.8, 0],
      [0, 0.82, 0],
      [0, 0.8, 0],
      [0, 0.82, 0],
      [0, 0.8, 0],
    ]),
  ]),
  new THREE.AnimationClip("Jog", 0.72, [
    quaternionTrack("ThighL", jogTimes, [
      [-0.78, 0, 0],
      [0, 0, 0],
      [0.78, 0, 0],
      [0, 0, 0],
      [-0.78, 0, 0],
    ]),
    quaternionTrack("ThighR", jogTimes, [
      [0.78, 0, 0],
      [0, 0, 0],
      [-0.78, 0, 0],
      [0, 0, 0],
      [0.78, 0, 0],
    ]),
    quaternionTrack("ShinL", jogTimes, [
      [0.18, 0, 0],
      [0.1, 0, 0],
      [0.85, 0, 0],
      [0.3, 0, 0],
      [0.18, 0, 0],
    ]),
    quaternionTrack("ShinR", jogTimes, [
      [0.85, 0, 0],
      [0.3, 0, 0],
      [0.18, 0, 0],
      [0.1, 0, 0],
      [0.85, 0, 0],
    ]),
    quaternionTrack("UpperArmL", jogTimes, [
      [0.6, 0, 0.06],
      [0, 0, 0.06],
      [-0.6, 0, 0.06],
      [0, 0, 0.06],
      [0.6, 0, 0.06],
    ]),
    quaternionTrack("UpperArmR", jogTimes, [
      [-0.6, 0, -0.06],
      [0, 0, -0.06],
      [0.6, 0, -0.06],
      [0, 0, -0.06],
      [-0.6, 0, -0.06],
    ]),
    quaternionTrack("Chest", jogTimes, [
      [0.085, 0, 0],
      [0.1, 0, 0.016],
      [0.085, 0, 0],
      [0.1, 0, -0.016],
      [0.085, 0, 0],
    ]),
    quaternionTrack("HairL", jogTimes, [
      [0.04, 0, -0.08],
      [0.02, 0, 0],
      [-0.03, 0, 0.08],
      [0.02, 0, 0],
      [0.04, 0, -0.08],
    ]),
    quaternionTrack("HairR", jogTimes, [
      [0.04, 0, 0.08],
      [0.02, 0, 0],
      [-0.03, 0, -0.08],
      [0.02, 0, 0],
      [0.04, 0, 0.08],
    ]),
  ]),
  new THREE.AnimationClip("Turn", 1, [
    quaternionTrack("Head", turnTimes, [
      [0, 0, 0],
      [0, 0.28, 0],
      [0.02, 0.38, 0],
      [0, 0.2, 0],
    ]),
    quaternionTrack("Chest", turnTimes, [
      [0, 0, 0],
      [0, 0.1, 0],
      [0, 0.2, 0],
      [0, 0.1, 0],
    ]),
    quaternionTrack("HairL", turnTimes, [
      [0, 0, 0],
      [0.02, -0.12, 0.04],
      [0, -0.18, 0.06],
      [0, -0.06, 0.015],
    ]),
    quaternionTrack("HairR", turnTimes, [
      [0, 0, 0],
      [0.02, -0.06, -0.02],
      [0, -0.12, -0.04],
      [0, -0.03, -0.01],
    ]),
  ]),
];

const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (result) => {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, Buffer.from(result));
    console.log(
      `Wrote ${output}: ${merged.attributes.position.count} vertices, ${animations.length} clips, ${bones.length} bones`,
    );
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
  {
    binary: true,
    animations,
    onlyVisible: true,
  },
);
