import type { PrepId } from "./types";

export const prepOptions: {
  id: PrepId;
  name: string;
  hint: string;
}[] = [
  { id: "wash", name: "冲洗", hint: "清去表面泥沙" },
  { id: "soak", name: "浸泡", hint: "让表面水合" },
  { id: "dry", name: "擦干", hint: "更容易煎香" },
  { id: "cut-small", name: "切小块", hint: "受热更快" },
  { id: "cut-large", name: "切大块", hint: "更保形" },
  { id: "blanch", name: "焯水", hint: "短时高温水" },
  { id: "marinate", name: "腌制", hint: "表层先入味" },
  { id: "starch-coat", name: "裹淀粉", hint: "增加保水与挂汁" },
];

export const heatMethods = [
  { id: "stir-fry", name: "翻炒", description: "快速翻动，表面受热" },
  { id: "pan-fry", name: "煎香", description: "接触锅面，形成焦香" },
  { id: "shallow-fry", name: "浅炸", description: "较多热油快速传热" },
  { id: "boil", name: "水煮", description: "以水或汤传热" },
  { id: "blanch", name: "焯水", description: "沸水短时处理" },
  { id: "steam", name: "蒸制", description: "用蒸汽温和传热" },
  { id: "braise", name: "炖煮", description: "温和湿热，长时间软化" },
  { id: "reduce", name: "收汁", description: "蒸发水分，提高浓度" },
  { id: "rest", name: "离火静置", description: "用余温继续作用" },
] as const;

export const categoryMeta = {
  physical: {
    label: "物理变化",
    short: "物理",
    className: "science-physical",
  },
  chemical: {
    label: "化学变化",
    short: "化学",
    className: "science-chemical",
  },
  biological: {
    label: "生物感受",
    short: "生物",
    className: "science-biological",
  },
} as const;
