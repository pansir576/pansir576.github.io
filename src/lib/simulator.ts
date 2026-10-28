import { getIngredient } from "./ingredients";
import { seasoningMap } from "./principles";
import { principleTransfers, treatmentMap } from "./treatments";
import type {
  AmountInput,
  CausalEvent,
  CookingSession,
  FlavorProfile,
  FoodProperties,
  HeatAction,
  IngredientDefinition,
  IngredientState,
  KitchenAction,
  OperationAction,
  PrepAction,
  PrepId,
  PrincipleTag,
  SeasonAction,
  StateDigest,
  ScienceKind,
} from "./types";

export const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number): number => Math.round(value * 10) / 10;

const unique = (items: string[]): string[] => Array.from(new Set(items));

const amountReference: Partial<Record<SeasonAction["seasoningId"], number>> = {
  oil: 10,
  salt: 2,
  "light-soy": 8,
  "dark-soy": 4,
  vinegar: 8,
  sugar: 5,
  wine: 8,
  water: 100,
  starch: 4,
  chili: 1,
};

export function amountMagnitude(
  amount: AmountInput,
  seasoningId: SeasonAction["seasoningId"] = "salt",
): number {
  if (amount.precise && typeof amount.value === "number") {
    const seasoning = seasoningMap.get(seasoningId);
    const reference =
      amountReference[seasoningId] ?? (seasoning?.unit === "ml" ? 8 : 4);
    return clamp(amount.value / reference, 0.1, 2.5);
  }
  return amount.level === "little" ? 0.45 : amount.level === "lot" ? 1.8 : 1;
}

export function amountLabel(amount: AmountInput): string {
  if (amount.precise && typeof amount.value === "number") {
    return `${amount.value}${amount.unit ?? ""}`;
  }
  return amount.level === "little"
    ? "少许"
    : amount.level === "lot"
      ? "较多"
      : "适量";
}

export function describeAction(action: KitchenAction): string {
  if (action.type === "prep") {
    const labels: Record<PrepId, string> = {
      wash: "冲洗",
      soak: "浸泡",
      dry: "擦干",
      "cut-small": "切小块",
      "cut-large": "切大块",
      blanch: "焯水",
      marinate: "腌制",
      "starch-coat": "裹淀粉",
    };
    return labels[action.prepId];
  }

  if (action.type === "heat") {
    const methods = {
      "stir-fry": "翻炒",
      "pan-fry": "煎制",
      "shallow-fry": "浅炸",
      boil: "水煮",
      blanch: "焯水",
      steam: "蒸制",
      braise: "炖煮",
      reduce: "收汁",
      rest: "离火静置",
    };
    const heat = {
      low: "小火",
      medium: "中火",
      high: "大火",
    };
    return `${methods[action.method]} · ${heat[action.heatLevel]} · ${action.targetTemperature}°C · ${action.durationMin}分钟`;
  }

  if (action.type === "season") {
    return `${seasoningMap.get(action.seasoningId)?.name ?? "调料"} · ${amountLabel(action.amount)}`;
  }

  return treatmentMap.get(action.operationId)?.name ?? "处理食材";
}

function flavorAfterTasteChange(
  current: FlavorProfile,
  changes: Partial<FlavorProfile>,
): FlavorProfile {
  const next = { ...current };
  for (const [key, value] of Object.entries(changes) as [
    keyof FlavorProfile,
    number,
  ][]) {
    next[key] = clamp(next[key] + value);
  }
  next.intensity = clamp(
    12 +
      (next.sour + next.sweet + next.salty + next.umami + next.spicy) * 0.72 +
      next.bitter * 0.22,
  );
  return {
    sour: round(next.sour),
    sweet: round(next.sweet),
    salty: round(next.salty),
    umami: round(next.umami),
    spicy: round(next.spicy),
    bitter: round(next.bitter),
    intensity: round(next.intensity),
  };
}

function event(
  state: IngredientState,
  action: string,
  category: ScienceKind,
  title: string,
  description: string,
  effects: string[],
): CausalEvent {
  return {
    id: `${state.actionCount + 1}-${action}-${title}`,
    action,
    category,
    title,
    description,
    effects,
    principleTags: [],
    before: {
      moisture: "",
      surface: "",
      texture: "",
      flavor: "",
      color: "",
    },
    after: {
      moisture: "",
      surface: "",
      texture: "",
      flavor: "",
      color: "",
    },
    transfer: "",
  };
}

function applyOperation(
  state: IngredientState,
  definition: IngredientDefinition,
  action: OperationAction,
): IngredientState {
  const legacy: Record<string, PrepId> = {
    wash: "wash",
    soak: "soak",
    "surface-dry": "dry",
    "cut-small": "cut-small",
    "cut-large": "cut-large",
  };
  if (legacy[action.operationId]) {
    return applyPrep(state, definition, {
      type: "prep",
      prepId: legacy[action.operationId],
    });
  }

  const treatment = treatmentMap.get(action.operationId);
  if (!treatment) return state;

  const next = structuredClone(state);
  const props = next.properties;
  const sensitivity = definition.sensitivities;
  let category: ScienceKind = "physical";
  let title = treatment.purpose;
  let description = `${treatment.purpose}${treatment.timing}`;
  let effects: string[] = [];

  switch (action.operationId) {
    case "greens-tear":
      props.surfaceArea = clamp(props.surfaceArea + 5);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 4);
      props.surfaceMoisture = clamp(props.surfaceMoisture + 2);
      title = "不规则裂口减少整齐切口，但叶脉仍保留部分连接";
      description =
        "手撕不会像刀切那样制造大量平整切面，但撕裂本身也会破坏部分细胞。它更适合希望减少规则切口出水、同时保留叶片层次的情况。";
      effects = ["形状保持略好", "表面积小幅增加"];
      break;
    case "greens-salt-wilt":
      props.moisture = clamp(props.moisture - 7 * sensitivity.osmosis);
      props.surfaceMoisture = clamp(props.surfaceMoisture + 8);
      props.saltLoad = clamp(props.saltLoad + 17);
      props.crispness = clamp(props.crispness - 12);
      props.tenderness = clamp(props.tenderness + 8);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 4 });
      next.flags.push("salt-before-heat", "salt-wilted");
      title = "盐让叶片内部水分向外移动";
      description =
        "盐先在叶面形成较高浓度，渗透压促使细胞水分向外走。叶片会更快变软、体积缩小，后续受热出水更少，但脆挺感也会下降。";
      effects = ["叶片出水", "质地软化", "表层预入味"];
      break;
    case "greens-ice-shock":
      props.temperature = Math.max(18, props.temperature - 58);
      props.crispness = clamp(props.crispness + 9);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 5);
      props.enzymeActivity = clamp(props.enzymeActivity - 18);
      title = "快速降温停止余热继续软化叶片";
      description =
        "焯水后的叶片仍在继续受热。过凉会迅速带走表面热量，缩小继续变软的时间窗口；它不能让已经过度受热的组织重新变脆。";
      effects = ["停止继续受热", "挺度略有恢复"];
      break;
    case "greens-dry-well":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 30);
      next.flags.push("surface-dry");
      title = "叶面水减少，锅温不再被大量蒸汽拖住";
      description =
        "叶菜表面积大，残留水会迅速汽化并消耗热量。表面越干，入锅后越容易快速升温，而不是先形成一层蒸汽把叶片焖软。";
      effects = ["表面更干", "后续更易快炒断生"];
      break;
    case "potato-cut-shred":
      props.surfaceArea = clamp(props.surfaceArea + 38);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 8);
      title = "细丝增加接触面积，短时受热也能达到中心";
      description =
        "切丝的物理意义远大于外观。相同重量下，细丝与热锅和油的接触面积更大，中心升温更快，也更容易在短时间里变脆或变软。";
      effects = ["受热更快", "更易入味", "形状更脆弱"];
      break;
    case "potato-cut-chunk":
      props.surfaceArea = clamp(props.surfaceArea + 12);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 10);
      title = "块状减少表面积，中心需要更多热量";
      description =
        "切块能保留形状，但外层可能已经焦香时中心还没熟。需要炖煮或先用较低温度让热量逐步进入内部。";
      effects = ["形状更稳定", "内部升温较慢"];
      break;
    case "potato-rinse-starch":
      props.sauceCoating = clamp(props.sauceCoating - 13);
      props.starchHydration = clamp(props.starchHydration - 5);
      props.surfaceMoisture = clamp(props.surfaceMoisture + 5);
      next.flags.push("surface-starch-reduced");
      title = "游离淀粉被冲走，丝片更清爽";
      description =
        "冲洗没有改变土豆内部淀粉，却减少了切口表面的淀粉。少一层糊化黏连，快炒时更容易分散并保持清爽口感。";
      effects = ["表面淀粉减少", "粘连下降"];
      break;
    case "potato-keep-starch":
      props.sauceCoating = clamp(props.sauceCoating + 9);
      props.starchHydration = clamp(props.starchHydration + 4);
      next.flags.push("surface-starch-kept");
      title = "保留表面淀粉，为后续挂汁或酥壳提供材料";
      description =
        "表面淀粉遇水受热会糊化，帮助黏附油和调味。如果目标是煎出酥壳或让汤汁挂在表面，保留它比冲掉更有利。";
      effects = ["潜在挂汁上升", "更易形成表面结构"];
      break;
    case "potato-acid-soak":
      props.ph = clamp(props.ph - 1.2 * sensitivity.acid, 2, 8);
      props.enzymeActivity = clamp(props.enzymeActivity - 22);
      props.oxidation = clamp(props.oxidation - 10);
      props.moisture = clamp(props.moisture + 2);
      next.flags.push("acid-present");
      title = "酸降低切面 pH，减缓酶促褐变";
      description =
        "多酚氧化酶在较低 pH 下活性下降，切面变色速度因此变慢。浸泡只是减慢反应，不能把已经氧化变色的部分还原。";
      effects = ["酶活性下降", "切面褐变减慢", "少量吸水"];
      break;
    case "potato-parboil":
      props.cookedness = clamp(props.cookedness + 13);
      props.temperature = 92;
      props.moisture = clamp(props.moisture + 4);
      props.starchHydration = clamp(props.starchHydration + 28);
      props.starchGelatinization = clamp(props.starchGelatinization + 20);
      props.tenderness = clamp(props.tenderness + 10);
      title = "淀粉先吸水糊化，后续煎炒不必长时间加热";
      description =
        "预煮让中心先达到半熟，后续高温只需处理表面。这样更容易做到外层焦脆、内部粉糯，同时减少长时间煎制造成的水分流失。";
      effects = ["半熟", "淀粉水合", "后续受热时间缩短"];
      break;
    case "egg-beat-light":
      props.shapeIntegrity = clamp(props.shapeIntegrity - 3);
      props.surfaceArea = clamp(props.surfaceArea + 3);
      title = "保留部分蛋白与蛋黄的差异";
      description =
        "轻度搅打让蛋液大致混合，但仍保留不均匀结构。受热后局部含水量和蛋白质浓度不同，会形成更有层次的口感。";
      effects = ["结构不完全均匀", "口感层次增加"];
      break;
    case "egg-beat-thorough":
      props.surfaceArea = clamp(props.surfaceArea + 6);
      props.moisture = clamp(props.moisture + 1);
      title = "蛋液均匀后，热量与调味分布更一致";
      description =
        "充分打散把蛋白和蛋黄混合，也让空气形成小气泡。受热时各处蛋白质浓度更接近，凝固和上色更均匀。";
      effects = ["受热更均匀", "质地更一致"];
      break;
    case "egg-add-water":
      props.moisture = clamp(props.moisture + 7);
      props.tenderness = clamp(props.tenderness + 4);
      title = "自由水增加，短时凝固时更容易保留嫩度";
      description =
        "水不会阻止蛋白质凝固，但会拉开蛋白质网络并增加体系含水量。加热过度时，这些水仍会被收缩的网络挤出。";
      effects = ["含水量上升", "短时受热更嫩"];
      break;
    case "egg-add-slurry":
      props.moisture = clamp(props.moisture + 4);
      props.starchHydration = clamp(props.starchHydration + 15);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 6);
      title = "少量淀粉吸水，帮助蛋液保水并稳定结构";
      description =
        "淀粉受热糊化后会保留水分并增加黏度，使蛋液更不容易在凝固时快速析水；但加多了会盖过蛋香。";
      effects = ["保水能力上升", "凝块更稳定"];
      break;
    case "egg-pre-salt":
      props.saltLoad = clamp(props.saltLoad + 12);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 2);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 4 });
      title = "少量盐先进入蛋液，咸味分布更均匀";
      description =
        "盐会改变蛋白质之间的相互作用。少量、短时预盐主要帮助均匀入味；大量盐长时间作用则可能让蛋液状态改变。";
      effects = ["提前入味", "蛋白质状态轻微变化"];
      break;
    case "egg-low-fold":
      props.shapeIntegrity = clamp(props.shapeIntegrity + 10);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 5);
      props.tenderness = clamp(props.tenderness + 7);
      title = "温和翻动减少凝固网络被反复切断";
      description =
        "持续大火和快速搅碎会让蛋液形成细碎、较硬的凝块。较低温度配合缓慢堆叠，更容易形成湿润的大块凝乳。";
      effects = ["凝块更完整", "质地更嫩"];
      break;
    case "egg-residual-heat":
      props.temperature = Math.max(48, props.temperature - 38);
      props.cookedness = clamp(props.cookedness + 7);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 11);
      props.tenderness = clamp(props.tenderness + 5);
      title = "离火后中心仍靠余温继续凝固";
      description =
        "锅面停止直接供热后，蛋液内部温度仍在平衡。提前一点离火能避免外层已经变干，而中心继续完成凝固。";
      effects = ["表面温度下降", "中心继续凝固"];
      break;
    case "tomato-peel":
      props.shapeIntegrity = clamp(props.shapeIntegrity - 4);
      props.tenderness = clamp(props.tenderness + 3);
      title = "去掉较韧表皮，果肉更容易融合";
      description =
        "番茄皮含有较稳定的纤维结构。去皮不会改变酸甜，却会减少成品中的片状纤维，让果肉更快形成均匀酱感。";
      effects = ["表皮纤维减少", "成品更细腻"];
      break;
    case "tomato-salt-draw":
      props.moisture = clamp(props.moisture - 6 * sensitivity.osmosis);
      props.surfaceMoisture = clamp(props.surfaceMoisture + 9);
      props.saltLoad = clamp(props.saltLoad + 12);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 3 });
      title = "盐通过渗透把番茄汁先拉到表面";
      description =
        "少量盐让细胞内外形成浓度差，汁水更早离开果肉。这样后续更容易缩短炒酱时间，但盐量必须计入最终调味。";
      effects = ["出汁加快", "咸味提前进入"];
      break;
    case "tomato-crush":
      props.surfaceArea = clamp(props.surfaceArea + 14);
      props.sauceCoating = clamp(props.sauceCoating + 9);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 18);
      title = "压碎果肉，让果胶和汁水更快融合";
      description =
        "机械破坏缩短了热量进入内部的距离，也把果肉中的汁水释放出来。受热后更容易形成连续酱汁，而不再是一块块果肉。";
      effects = ["出汁更快", "酱感增强", "果肉形状减弱"];
      break;
    case "tofu-press":
      props.moisture = clamp(props.moisture - 12 * sensitivity.mechanical);
      props.surfaceMoisture = clamp(props.surfaceMoisture - 27);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 12);
      props.tenderness = clamp(props.tenderness - 5);
      next.flags.push("surface-dry", "pressed");
      title = "压出部分内部水，豆腐更紧实、更易上色";
      description =
        "水越少，煎制时用于蒸发的热量越少，表面更容易越过 100°C。同时豆腐网络被压缩，翻动时更不容易碎。";
      effects = ["含水量下降", "结构更紧实", "煎香更容易"];
      break;
    case "tofu-brine":
      props.saltLoad = clamp(props.saltLoad + 14);
      props.moisture = clamp(props.moisture + 2);
      props.tenderness = clamp(props.tenderness - 2);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 4 });
      title = "盐水通过交换让表层先入味";
      description =
        "豆腐内部孔隙多，盐水会与内部水发生交换。短时间能让表层先获得咸味，同时也可能轻微收紧结构。";
      effects = ["表层入味", "少量水分交换"];
      break;
    case "tofu-blanch":
      props.temperature = 98;
      props.cookedness = clamp(props.cookedness + 8);
      props.offAroma = clamp(props.offAroma - 13);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 7);
      title = "短时热水带走部分豆腥气味并紧实表层";
      description =
        "豆腐表层受热后蛋白质网络轻微收紧，部分挥发性气味进入热水。时间过长会让内部水流失，口感反而变粗。";
      effects = ["异味减轻", "表层略紧实"];
      break;
    case "tofu-sear-set":
      props.browning = clamp(props.browning + 12);
      props.crispness = clamp(props.crispness + 10);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 8);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 12);
      title = "表面先形成较稳定外壳，再烧更不易碎";
      description =
        "煎制让表层失水、蛋白质凝固并产生褐变。这个外壳既是风味层，也能在后续加汤时保护内部结构。";
      effects = ["表面定型", "褐变香气增加"];
      break;
    case "tofu-freeze-thaw":
      props.shapeIntegrity = clamp(props.shapeIntegrity - 10);
      props.sauceCoating = clamp(props.sauceCoating + 24);
      props.tenderness = clamp(props.tenderness + 12);
      next.flags.push("porous");
      title = "冰晶改变组织，解冻后留下更多吸汁孔隙";
      description =
        "冷冻时水分形成冰晶，会改变原有蛋白质和水分分布。解冻后豆腐更疏松，因此更容易吸汤，但形状也更容易被破坏。";
      effects = ["孔隙增加", "吸汁能力上升", "形状更脆弱"];
      break;
    case "beef-slice-cross":
      props.tenderness = clamp(props.tenderness + 16 * sensitivity.mechanical);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 4);
      title = "逆纹切缩短长纤维，降低咀嚼阻力";
      description =
        "肌肉纤维像一束长线。逆着纤维切会把它们切短，牙齿需要拉断的长度下降，因此同样火候下也更显嫩。";
      effects = ["纤维变短", "咀嚼阻力下降"];
      break;
    case "beef-slice-along":
      props.tenderness = clamp(props.tenderness - 6);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 4);
      title = "顺纹切保留较长纤维，咀嚼感更强";
      description =
        "顺着肌肉纤维切会留下更完整的纤维长度。它不一定错误，但更适合需要撕咬感或后续长时间软化的做法。";
      effects = ["纤维更长", "嚼劲增加"];
      break;
    case "beef-tenderize":
      props.tenderness = clamp(props.tenderness + 10 * sensitivity.mechanical);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 7);
      title = "拍打和浅划先破坏部分纤维";
      description =
        "机械处理能直接缩短或破坏纤维，但过度拍打也会让肌纤维结构松散、汁水更容易流失。";
      effects = ["纤维受损", "嫩度上升", "保形下降"];
      break;
    case "beef-dry-brine":
      props.saltLoad = clamp(props.saltLoad + 18);
      props.moisture = clamp(props.moisture - 2);
      props.tenderness = clamp(props.tenderness + 4);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 5 });
      title = "干盐先停在表面，再靠时间向内部扩散";
      description =
        "干腌不是瞬间入味。盐会先改变表层水分分布，再逐渐扩散；同时盐也会影响肌肉蛋白质的保水和收缩方式。";
      effects = ["表层先盐化", "后续扩散持续发生"];
      break;
    case "beef-wet-brine":
      props.saltLoad = clamp(props.saltLoad + 14);
      props.moisture = clamp(props.moisture + 3);
      props.ph = clamp(props.ph - 0.25 * sensitivity.acid, 3, 8);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 4 });
      title = "短时湿腌让盐和水溶性调味进入表层";
      description =
        "液体让盐和调味分子更容易接触表面，扩散速度和浓度差、时间有关。薄片更快入味，厚块则需要更长时间。";
      effects = ["表层入味", "含水量轻微上升"];
      break;
    case "beef-velvet":
      props.surfaceMoisture = clamp(props.surfaceMoisture + 9);
      props.starchHydration = clamp(props.starchHydration + 20);
      props.tenderness = clamp(props.tenderness + 10);
      props.sauceCoating = clamp(props.sauceCoating + 12);
      next.flags.push("starch-coated");
      title = "淀粉和水在表面形成保水层";
      description =
        "上浆不是直接让肉变嫩，而是让表面先获得水和淀粉。受热时淀粉糊化，减少水分快速流失，使薄片更滑嫩。";
      effects = ["表面保水", "滑炒更嫩", "挂汁增加"];
      break;
    case "beef-temper":
      props.temperature = Math.max(props.temperature, 14);
      props.heatPenetration = clamp(props.heatPenetration + 7);
      title = "缩小肉块内外温差，后续升温更可预测";
      description =
        "回温不会把肉加热熟，只是减少中心与表面的温差。厚切时更容易让表面上色和中心目标温度更接近。";
      effects = ["内外温差缩小", "后续受热更均匀"];
      break;
    case "beef-rest":
      props.temperature = Math.max(35, props.temperature - 18);
      props.tenderness = clamp(props.tenderness + 5);
      props.heatPenetration = clamp(props.heatPenetration + 8);
      title = "静置让内部水分重新分布";
      description =
        "刚煎好的肉内部仍有水分移动。短暂静置能让温度与水分梯度缓和，切开时流出的汁水通常更少。";
      effects = ["水分重新分布", "切片流失减少"];
      break;
    case "pork-cold-blanch":
      props.cookedness = clamp(props.cookedness + 10);
      props.temperature = 92;
      props.offAroma = clamp(props.offAroma - 17);
      props.moisture = clamp(props.moisture + 4);
      title = "缓慢升温把表层杂质和部分气味带入水中";
      description =
        "冷水下锅时温度逐渐上升，表层可溶物和挥发性气味有更多机会进入水中。焯水后仍需擦干，否则表面水会拖慢煸炒升温。";
      effects = ["异味减轻", "表层熟化", "表面仍湿"];
      break;
    case "pork-dry-render":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 30);
      props.oiliness = clamp(props.oiliness + 14);
      props.browning = clamp(props.browning + 10);
      props.crispness = clamp(props.crispness + 5);
      next.flags.push("surface-dry", "rendered");
      title = "表面先变干，脂肪才开始稳定析出";
      description =
        "有水时热量先用于蒸发，脂肪层很难快速升温。擦干并持续中高温加热后，部分油脂析出，表面才有机会褐变。";
      effects = ["部分油脂析出", "表面开始上色"];
      break;
    case "pork-score":
      props.surfaceArea = clamp(props.surfaceArea + 12);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 5);
      props.sauceCoating = clamp(props.sauceCoating + 7);
      title = "切开筋膜减少卷曲，并缩短调味进入的路径";
      description =
        "机械切口既能让热量和酱汁更快到达内部，也能释放部分组织张力。切口过深则会让肉块在炖煮中更容易散。";
      effects = ["更易入味", "表面卷曲减少", "形状略脆弱"];
      break;
    case "pork-slow-braise":
      props.temperature = 94;
      props.cookedness = clamp(props.cookedness + 12);
      props.moisture = clamp(props.moisture + 4);
      props.tenderness = clamp(props.tenderness + 16);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 9);
      title = "温和湿热让结缔组织逐渐软化";
      description =
        "长时间较低温度的水环境能让胶原逐渐转成更柔软的明胶状结构，同时避免表面水分被大火迅速蒸干。";
      effects = ["组织软化", "水分保持较好"];
      break;
    case "fish-membrane":
      props.offAroma = clamp(props.offAroma - 22);
      title = "直接带来异味的血水和黑膜被移除";
      description =
        "有些腥感不是靠调料遮盖最有效，而是从来源减少。清除残留血水和黑膜，能减少受热后进入蒸汽的异味分子。";
      effects = ["异味来源减少"];
      break;
    case "fish-score":
      props.surfaceArea = clamp(props.surfaceArea + 18);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 4);
      title = "改刀让厚处也能更快达到目标温度";
      description =
        "整鱼厚薄不均，表面熟透时中心可能仍不足。改刀缩短热量进入厚处的距离，也让短时盐渍更均匀。";
      effects = ["大块处受热加快", "更易入味"];
      break;
    case "fish-dry":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 34);
      next.flags.push("surface-dry");
      title = "鱼皮变干后更容易越过粘锅和低温阶段";
      description =
        "鱼皮含水时先形成蒸汽层，既容易粘锅，也拖慢表面上色。彻底擦干能让油膜更稳定、鱼皮更快升温。";
      effects = ["鱼皮更干", "煎制更易定型"];
      break;
    case "fish-quick-cure":
      props.saltLoad = clamp(props.saltLoad + 15);
      props.moisture = clamp(props.moisture - 5 * sensitivity.osmosis);
      props.tenderness = clamp(props.tenderness - 3);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 4 });
      title = "薄盐让表层先入味，也会带走少量水";
      description =
        "盐在鱼肉表面形成浓度差，水分向外移动，鱼肉会稍微收紧。短时间可以改善入味，过久则会让细嫩组织失去水分。";
      effects = ["表层入味", "组织轻微收紧"];
      break;
    case "fish-wine-ginger":
      props.offAroma = clamp(props.offAroma - 17);
      props.aroma = clamp(props.aroma + 9);
      props.ph = clamp(props.ph - 0.15 * sensitivity.acid, 3, 8);
      next.flavor = flavorAfterTasteChange(next.flavor, { umami: 1 });
      title = "酒姜的香气参与挥发，改变腥味感知";
      description =
        "酒中的乙醇和姜的香气物质在受热时进入蒸汽，部分异味也一起挥发。这里主要改变的是气味组合，不是把鱼肉消毒。";
      effects = ["异味感知降低", "香气增加"];
      break;
    case "fish-residual-steam":
      props.temperature = Math.max(46, props.temperature - 34);
      props.cookedness = clamp(props.cookedness + 6);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 10);
      title = "余温继续让细嫩鱼肉完成凝固";
      description =
        "鱼肉蛋白在较低温度就会凝固。接近熟透时离火，可以利用余温完成中心，而避免继续直接加热造成水分迅速流失。";
      effects = ["中心继续升温", "减少过度加热"];
      break;
    case "archetype-leaf-blanch":
      props.temperature = 98;
      props.cookedness = clamp(props.cookedness + 16);
      props.enzymeActivity = clamp(props.enzymeActivity - 55);
      props.crispness = clamp(props.crispness - 9);
      effects = ["快速断生", "酶活性下降", "叶片略软"];
      break;
    case "archetype-leaf-salt-wilt":
      props.moisture = clamp(props.moisture - 8 * sensitivity.osmosis);
      props.crispness = clamp(props.crispness - 11);
      props.saltLoad = clamp(props.saltLoad + 16);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 3 });
      next.flags.push("salt-before-heat");
      effects = ["渗透出水", "组织软化", "表层入味"];
      break;
    case "archetype-leaf-dry":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 30);
      next.flags.push("surface-dry");
      effects = ["表面水减少", "后续更易快炒"];
      break;
    case "archetype-leaf-tear":
      props.surfaceArea = clamp(props.surfaceArea + 6);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 4);
      effects = ["切口减少", "保留部分组织连接"];
      break;
    case "archetype-melon-peel":
      props.shapeIntegrity = clamp(props.shapeIntegrity - 3);
      props.tenderness = clamp(props.tenderness + 4);
      effects = ["硬皮和籽减少", "口感更均匀"];
      break;
    case "archetype-melon-salt":
      props.moisture = clamp(props.moisture - 5 * sensitivity.osmosis);
      props.saltLoad = clamp(props.saltLoad + 12);
      props.surfaceMoisture = clamp(props.surfaceMoisture + 8);
      effects = ["提前出水", "表层入味"];
      break;
    case "archetype-melon-crush":
      props.surfaceArea = clamp(props.surfaceArea + 14);
      props.sauceCoating = clamp(props.sauceCoating + 9);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 16);
      effects = ["汁水释放", "酱感增强"];
      break;
    case "archetype-melon-dry":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 28);
      next.flags.push("surface-dry");
      effects = ["表面更干", "煎炒更易上色"];
      break;
    case "archetype-root-rinse":
      props.sauceCoating = clamp(props.sauceCoating - 10);
      props.starchHydration = clamp(props.starchHydration - 5);
      props.surfaceMoisture = clamp(props.surfaceMoisture + 4);
      next.flags.push("surface-starch-reduced");
      effects = ["表面淀粉减少", "粘连下降"];
      break;
    case "archetype-root-parboil":
      props.cookedness = clamp(props.cookedness + 14);
      props.temperature = 92;
      props.starchHydration = clamp(props.starchHydration + 25);
      props.starchGelatinization = clamp(props.starchGelatinization + 18);
      props.tenderness = clamp(props.tenderness + 12);
      effects = ["内部半熟", "淀粉吸水", "后续加热缩短"];
      break;
    case "archetype-root-blanch":
      props.temperature = 98;
      props.cookedness = clamp(props.cookedness + 10);
      props.offAroma = clamp(props.offAroma - 12);
      props.bitterness = clamp(props.bitterness - 5);
      props.enzymeActivity = clamp(props.enzymeActivity - 40);
      effects = ["涩味降低", "酶活性下降", "表层变软"];
      break;
    case "archetype-root-dry":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 31);
      next.flags.push("surface-dry");
      effects = ["表面更干", "焦香潜力上升"];
      break;
    case "archetype-mushroom-squeeze":
      props.moisture = clamp(props.moisture - 9 * sensitivity.mechanical);
      props.surfaceMoisture = clamp(props.surfaceMoisture - 24);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 5);
      effects = ["自由水减少", "组织略受损"];
      break;
    case "archetype-mushroom-dry-sear":
      props.temperature = 150;
      props.moisture = clamp(props.moisture - 9);
      props.surfaceMoisture = clamp(props.surfaceMoisture - 28);
      props.browning = clamp(props.browning + 8);
      props.aroma = clamp(props.aroma + 7);
      next.flags.push("surface-dry");
      effects = ["表面水蒸发", "香气集中", "开始褐变"];
      break;
    case "archetype-mushroom-blanch":
      props.temperature = 98;
      props.offAroma = clamp(props.offAroma - 12);
      props.cookedness = clamp(props.cookedness + 8);
      effects = ["表面清洁", "部分气味进入水中"];
      break;
    case "archetype-mushroom-soak":
      props.moisture = clamp(props.moisture + 12);
      props.surfaceMoisture = clamp(props.surfaceMoisture + 14);
      props.tenderness = clamp(props.tenderness + 5);
      effects = ["吸水恢复", "后续受热更快"];
      break;
    case "archetype-soy-press":
      props.moisture = clamp(props.moisture - 10 * sensitivity.mechanical);
      props.surfaceMoisture = clamp(props.surfaceMoisture - 26);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 10);
      next.flags.push("surface-dry", "pressed");
      effects = ["内部水减少", "结构更紧实"];
      break;
    case "archetype-soy-brine":
      props.saltLoad = clamp(props.saltLoad + 13);
      props.moisture = clamp(props.moisture + 2);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 3 });
      effects = ["表层入味", "少量水分交换"];
      break;
    case "archetype-soy-blanch":
      props.temperature = 98;
      props.offAroma = clamp(props.offAroma - 12);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 6);
      effects = ["豆腥降低", "表层略紧"];
      break;
    case "archetype-soy-sear":
      props.browning = clamp(props.browning + 10);
      props.crispness = clamp(props.crispness + 8);
      props.shapeIntegrity = clamp(props.shapeIntegrity + 10);
      effects = ["表面定型", "褐变增加"];
      break;
    case "archetype-meat-slice":
      props.surfaceArea = clamp(props.surfaceArea + 22);
      props.tenderness = clamp(props.tenderness + 7 * sensitivity.mechanical);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 4);
      effects = ["表面积增加", "纤维缩短"];
      break;
    case "archetype-meat-brine":
      props.saltLoad = clamp(props.saltLoad + 15);
      props.moisture = clamp(props.moisture + 1);
      props.tenderness = clamp(props.tenderness + 3);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 4 });
      effects = ["表层入味", "盐分开始扩散"];
      break;
    case "archetype-meat-blanch":
      props.temperature = 92;
      props.cookedness = clamp(props.cookedness + 9);
      props.offAroma = clamp(props.offAroma - 15);
      props.moisture = clamp(props.moisture + 3);
      effects = ["血水减少", "气味降低"];
      break;
    case "archetype-meat-slow-cook":
      props.temperature = 94;
      props.tenderness = clamp(props.tenderness + 15);
      props.cookedness = clamp(props.cookedness + 11);
      props.proteinCoagulation = clamp(props.proteinCoagulation + 8);
      effects = ["结缔组织软化", "水分保持较好"];
      break;
    case "archetype-poultry-dry":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 32);
      next.flags.push("surface-dry");
      effects = ["表面更干", "煎制更容易上色"];
      break;
    case "archetype-poultry-score":
      props.surfaceArea = clamp(props.surfaceArea + 13);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 4);
      effects = ["厚处受热加快", "中心温差减小"];
      break;
    case "archetype-seafood-clean":
      props.offAroma = clamp(props.offAroma - 20);
      effects = ["异味来源减少"];
      break;
    case "archetype-seafood-dry":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 34);
      next.flags.push("surface-dry");
      effects = ["表面更干", "煎制更易定型"];
      break;
    case "archetype-seafood-cure":
      props.saltLoad = clamp(props.saltLoad + 12);
      props.moisture = clamp(props.moisture - 4 * sensitivity.osmosis);
      props.tenderness = clamp(props.tenderness - 2);
      effects = ["表层入味", "组织轻微收紧"];
      break;
    case "archetype-seafood-score":
      props.surfaceArea = clamp(props.surfaceArea + 16);
      props.shapeIntegrity = clamp(props.shapeIntegrity - 3);
      effects = ["厚处更快受热", "更易入味"];
      break;
    case "archetype-staple-soak":
      props.moisture = clamp(props.moisture + 15);
      props.starchHydration = clamp(props.starchHydration + 16);
      props.tenderness = clamp(props.tenderness + 6);
      effects = ["吸水恢复", "后续煮制时间缩短"];
      break;
    case "archetype-staple-blanch":
      props.temperature = 98;
      props.cookedness = clamp(props.cookedness + 14);
      props.starchHydration = clamp(props.starchHydration + 22);
      props.starchGelatinization = clamp(props.starchGelatinization + 15);
      effects = ["淀粉吸水", "组织软化"];
      break;
    case "archetype-staple-dry":
      props.surfaceMoisture = clamp(props.surfaceMoisture - 25);
      next.flags.push("surface-dry");
      effects = ["表面水减少", "酱汁不易被稀释"];
      break;
    case "archetype-staple-rinse":
      props.surfaceMoisture = clamp(props.surfaceMoisture + 3);
      props.sauceCoating = clamp(props.sauceCoating - 5);
      effects = ["浮尘减少", "表面略湿"];
      break;
  }

  if (treatment.category === "biological") category = "biological";
  else if (
    ["osmosis", "starch-hydration", "ph", "protein-network"].some((tag) =>
      treatment.principleTags.includes(tag as PrincipleTag),
    )
  ) {
    category = "chemical";
  }

  next.actionCount += 1;
  next.events.push(
    event(
      next,
      treatment.name,
      category,
      title,
      description,
      effects.length ? effects : [treatment.purpose],
    ),
  );
  return refreshDerivedState(next, definition);
}

function applyPrep(
  state: IngredientState,
  definition: IngredientDefinition,
  action: PrepAction,
): IngredientState {
  const next = structuredClone(state);
  const props = next.properties;
  let category: ScienceKind = "physical";
  let title = "";
  let description = "";
  let effects: string[] = [];

  switch (action.prepId) {
    case "wash":
      props.moisture = clamp(props.moisture + 2, 0, 110);
      props.surfaceArea = clamp(props.surfaceArea + 1, 0, 150);
      next.flags.push("washed");
      title = "水和表面作用，洗去泥沙并留下少量水分";
      description =
        "冲洗是物理清洁。食材会短暂接触水，切口多时吸水更明显；洗完不控水会让后续受热先花能量蒸发水分。";
      effects = ["表面更清洁", "含水量轻微上升"];
      break;
    case "soak":
      props.moisture = clamp(props.moisture + 6);
      props.enzymeActivity = clamp(props.enzymeActivity - 4);
      if (definition.starchiness > 0.5) {
        props.sauceCoating = clamp(props.sauceCoating - 10);
        next.flags.push("surface-starch-reduced");
      }
      if (definition.art === "greens") {
        props.crispness = clamp(props.crispness - 4);
      }
      next.flags.push("soaked");
      title =
        definition.starchiness > 0.5
          ? "部分表面淀粉进入水中"
          : "水分进入食材表层";
      description =
        definition.starchiness > 0.5
          ? "浸泡能冲掉土豆切口的部分游离淀粉，让丝片更易分开；但久泡也可能让水溶性风味进入水中。"
          : "水会通过表面进入组织。叶菜久泡会吸水变脆但同时弱化挺度，肉类长时间泡水则可能带走部分可溶物质。";
      effects =
        definition.starchiness > 0.5
          ? ["表面淀粉减少", "含水量上升"]
          : ["表层水合", "含水量上升"];
      break;
    case "dry":
      props.moisture = clamp(props.moisture - 8);
      next.flags.push("surface-dry");
      title = "擦走表面水，给升温和褐变让路";
      description =
        "表面水分蒸发需要吸收大量热量。擦干不会改变食材内部水分，却能让表面更快越过 100°C，接近煎香与褐变的温度区间。";
      effects = ["表面更干", "后续煎炒更容易上色"];
      break;
    case "cut-small":
      props.surfaceArea = clamp(props.surfaceArea + 34, 0, 160);
      props.crispness = clamp(props.crispness - 3);
      next.flags.push("cut-small");
      title = "表面积增大，热和调味会更快到达中心";
      description =
        "切小主要改变物理尺寸。表面积增加后，单位时间内进入的热量更多，也更容易失水和吸附酱汁，但形状保持力会下降。";
      effects = ["受热更快", "更易吸味和出水"];
      break;
    case "cut-large":
      props.surfaceArea = clamp(props.surfaceArea + 17, 0, 160);
      next.flags.push("cut-large");
      title = "体积较大，内部升温相对较慢";
      description =
        "切大块会减少相同重量食材的表面积。外层可能先变软或上色，而中心需要更长时间达到同样的温度。";
      effects = ["更保形", "中心升温较慢"];
      break;
    case "blanch": {
      props.cookedness = clamp(props.cookedness + 22);
      props.temperature = 100;
      props.moisture = clamp(props.moisture + 4);
      props.enzymeActivity = clamp(props.enzymeActivity - 62);
      props.offAroma = clamp(props.offAroma - 10);
      if (definition.art === "greens") {
        props.crispness = clamp(props.crispness - 13);
        if (next.flags.includes("acid-present")) {
          next.appearance = {
            color: "#707b42",
            label: "偏橄榄色，叶片变软",
            gloss: next.appearance.gloss,
          };
        } else {
          next.appearance = {
            color: "#4d9149",
            label: "短暂焯后仍较鲜绿",
            gloss: 30,
          };
        }
      }
      category = "chemical";
      title = "高温水让酶失活，也让组织更快软化";
      description =
        "焯水同时发生物理传热和化学变化：蛋白质受热变性、酶活性迅速下降，表面部分可溶物进入热水。短时焯水可固定颜色和处理表面，久焯则会让水溶性风味流失。";
      effects = ["酶活性下降", "表层熟化", "组织略变软"];
      next.flags.push("blanched");
      break;
    }
    case "marinate":
      next.flags.push("marinated");
      props.moisture = clamp(props.moisture - 2);
      props.saltiness = clamp(props.saltiness + 3);
      props.aroma = clamp(props.aroma + 3);
      next.flavor = flavorAfterTasteChange(next.flavor, { salty: 3 });
      title = "表层先建立味道，时间再让盐分向内部移动";
      description =
        "腌制不是一个瞬时按钮。盐和调味分子先停留在表面，再通过扩散慢慢进入；时间越长，进入越深，同时渗透也可能改变表层水分。";
      effects = ["表层预先入味", "含水量轻微下降"];
      break;
    case "starch-coat":
      props.sauceCoating = clamp(props.sauceCoating + 20);
      next.flags.push("starch-coated");
      category = "chemical";
      title = "淀粉附着在表面，等待水与热触发糊化";
      description =
        "干淀粉本身不会立刻变黏。遇水并加热后，淀粉颗粒吸水膨胀、结构破坏，才会形成保水层或黏稠汤汁。";
      effects = ["表面形成淀粉层", "潜在挂汁能力上升"];
      break;
  }

  next.actionCount += 1;
  next.events.push(
    event(next, describeAction(action), category, title, description, effects),
  );
  return refreshDerivedState(next, definition);
}

function heatIntensity(action: HeatAction): number {
  const levelFactor =
    action.heatLevel === "low" ? 0.7 : action.heatLevel === "high" ? 1.25 : 1;
  const longBraise =
    action.method === "braise" && action.durationMin >= 20 ? 3 : 2.5;
  return clamp(
    ((action.targetTemperature - 50) / 180) *
      (action.durationMin / 2.5) *
      levelFactor,
    0.05,
    longBraise,
  );
}

function effectiveTemperature(action: HeatAction): number {
  if (action.method === "boil") return Math.min(action.targetTemperature, 100);
  if (action.method === "blanch") return Math.min(action.targetTemperature, 100);
  if (action.method === "steam") return Math.min(action.targetTemperature, 100);
  if (action.method === "braise") return Math.min(action.targetTemperature, 98);
  if (action.method === "reduce") return Math.min(action.targetTemperature, 105);
  return action.targetTemperature;
}

function applyHeat(
  state: IngredientState,
  definition: IngredientDefinition,
  action: HeatAction,
  recordEvent = true,
): IngredientState {
  const next = structuredClone(state);
  const props = next.properties;
  const heat = heatIntensity(action);
  const temp = effectiveTemperature(action);
  const hasWater =
    next.flags.includes("water-added") ||
    action.method === "boil" ||
    action.method === "blanch" ||
    action.method === "steam" ||
    action.method === "braise" ||
    action.method === "reduce";
  const hasOil =
    next.flags.includes("oil-added") || action.method === "shallow-fry";
  const drySurface =
    next.flags.includes("surface-dry") || next.flags.includes("blanched");
  const saltBeforeHeat = next.flags.includes("salt-before-heat");
  const lidCovered = action.lidCovered ?? false;
  const stirIntensity = action.stirIntensity ?? "none";

  if (action.method === "rest") {
    props.temperature = Math.max(24, props.temperature - action.durationMin * 7);
    props.cookedness = clamp(props.cookedness + heat * 4);
    if (recordEvent) {
      next.actionCount += 1;
      next.events.push(
        event(
          next,
          describeAction(action),
          "physical",
          "离火后余温仍在继续作用",
          "热量不会随关火立刻消失。食材内部会继续升温，表面则开始蒸发和冷却；对蛋、鱼等细嫩食材，离火静置常能避免过度加热。",
          ["中心温度继续平衡", "表面缓慢降温"],
        ),
      );
    }
    return refreshDerivedState(next, definition);
  }

  const stirHeatFactor =
    stirIntensity === "frequent" ? 1.12 : stirIntensity === "gentle" ? 1.04 : 1;
  const cookGain = heat * 30 * stirHeatFactor;
  props.cookedness = clamp(props.cookedness + cookGain);
  props.temperature = temp;
  props.heatPenetration = clamp(
    props.heatPenetration + heat * 13 + (lidCovered ? 2 : 0),
  );
  props.proteinCoagulation = clamp(
    props.proteinCoagulation +
      cookGain * (0.22 + definition.sensitivities.protein * 0.55),
  );
  if (stirIntensity === "frequent" && action.method === "stir-fry") {
    props.shapeIntegrity = clamp(props.shapeIntegrity - heat * 4);
  }

  if (temp >= 65) {
    props.enzymeActivity = clamp(props.enzymeActivity - (temp - 50) * 1.25);
  }
  if (temp >= 72) {
    props.offAroma = clamp(props.offAroma - heat * (hasOil ? 8 : 11));
  }

  const moistureLoss =
    (action.method === "stir-fry" ||
      action.method === "pan-fry" ||
      action.method === "shallow-fry") &&
    !hasWater;
  if (moistureLoss) {
    let loss = heat * (2.2 + props.surfaceArea / 30);
    if (saltBeforeHeat) loss += heat * 2.3;
    if (definition.art === "greens") loss += heat * 1.8;
    if (lidCovered) loss *= 0.52;
    if (action.method === "shallow-fry") loss *= 0.8;
    props.moisture = clamp(props.moisture - loss, 0, 110);
    props.surfaceMoisture = clamp(props.surfaceMoisture - loss * 1.2);
  } else if (hasWater) {
    props.moisture = clamp(props.moisture + heat * 0.8, 0, 110);
    props.surfaceMoisture = clamp(
      props.surfaceMoisture + (lidCovered ? heat * 3 : heat * 1.2),
    );
  }
  if (action.method === "reduce") {
    props.moisture = clamp(props.moisture - heat * 3.2);
    props.sauceCoating = clamp(props.sauceCoating + heat * 5);
  }

  const browningPotential =
    temp >= 140 &&
    definition.browningTendency > 0.18 &&
    (drySurface || hasOil) &&
    next.flags.includes("sugar-added");
  const browningGain =
    temp >= 140 && definition.browningTendency > 0.18 && (drySurface || hasOil)
      ? ((temp - 130) / 150) *
        Math.min(action.durationMin, 8) *
        definition.browningTendency *
        8 *
        (browningPotential ? 1.25 : 1) *
        (props.moisture > 75 ? 0.55 : 1) *
        (lidCovered ? 0.55 : 1)
      : 0;
  props.browning = clamp(props.browning + browningGain);

  if (definition.starchiness > 0.45 && hasWater && temp >= 75) {
    props.starchGelatinization = clamp(
      props.starchGelatinization + heat * 28,
    );
    props.starchHydration = clamp(props.starchHydration + heat * 24);
    props.sauceCoating = clamp(props.sauceCoating + heat * 9);
  }

  if (definition.art === "greens") {
    props.crispness = clamp(props.crispness - heat * 28);
    props.tenderness = clamp(props.tenderness + heat * 24);
    if (temp >= 90) {
      next.appearance = {
        color: next.flags.includes("acid-present") ? "#6b7947" : "#597f47",
        label:
          next.flags.includes("acid-present")
            ? props.cookedness > 95
              ? "叶片柔软，绿色偏向橄榄色"
              : "绿色偏橄榄，叶片仍有一些挺度"
            : props.cookedness > 95
              ? "叶片柔软，颜色较深"
              : "叶片刚断生，仍保留一些挺度",
        gloss: hasOil ? clamp(next.appearance.gloss + 12) : next.appearance.gloss,
      };
    }
  } else if (definition.art === "potato") {
    props.tenderness = clamp(
      props.tenderness + (hasWater ? heat * 24 : heat * 10),
    );
    if (hasOil && drySurface && props.cookedness > 35) {
      props.crispness = clamp(props.crispness + heat * 18 + browningGain / 3);
    } else if (hasWater && props.starchGelatinization > 20) {
      props.crispness = clamp(props.crispness - heat * 10);
    }
    if (props.browning > 24) {
      next.appearance = {
        color: "#aa7540",
        label: props.crispness > 62 ? "边缘金黄、表面较脆" : "浅金色、开始软化",
        gloss: hasOil ? clamp(26 + props.browning * 0.4) : 22,
      };
    }
  } else if (definition.art === "egg") {
    const overCooked = props.cookedness > 105 || (temp > 220 && heat > 1.3);
    props.tenderness = clamp(
      overCooked ? props.tenderness - heat * 28 : props.tenderness + heat * 8,
    );
    props.moisture = clamp(props.moisture - (overCooked ? heat * 5 : heat * 1.2));
    next.appearance = {
      color: props.browning > 18 ? "#dcae3e" : "#efc455",
      label: overCooked
        ? "凝块收缩、表面偏干"
        : props.cookedness > 34
          ? "柔软凝固，仍带湿润感"
          : "边缘开始凝固",
      gloss: hasOil ? 48 : 30,
    };
  } else if (definition.art === "tomato") {
    if (props.cookedness > 22) {
      props.tenderness = clamp(props.tenderness + heat * 22);
      props.moisture = clamp(props.moisture + heat * 1.5);
      props.umami = clamp(props.umami + heat * 2.5);
      next.appearance = {
        color: "#b9432d",
        label:
          props.cookedness > 68 ? "果肉软化、汁水融合成酱感" : "果肉变软并开始出汁",
        gloss: hasOil ? 38 : 26,
      };
    }
  } else if (definition.art === "tofu") {
    props.tenderness = clamp(props.tenderness + heat * 8);
    if (hasOil && drySurface && props.browning > 12) {
      props.crispness = clamp(props.crispness + heat * 16);
      next.appearance = {
        color: "#d9b873",
        label: "表面浅金、内部仍柔软",
        gloss: clamp(28 + props.browning * 0.5),
      };
    }
  } else if (definition.art === "beef") {
    if (temp < 110 && action.method === "braise" && action.durationMin >= 12) {
      props.tenderness = clamp(props.tenderness + heat * 12);
    } else if (temp > 180 && next.flags.includes("surface-dry")) {
      props.tenderness = clamp(props.tenderness - heat * 6);
    }
    if (props.browning > 12) {
      next.appearance = {
        color: "#844236",
        label: props.browning > 48 ? "表面深褐、有煎香" : "表面开始褐变",
        gloss: hasOil ? clamp(22 + props.browning * 0.35) : 18,
      };
    }
  } else if (definition.art === "pork") {
    if (temp > 130) {
      props.oiliness = clamp(props.oiliness + heat * 4.5);
      props.browning = clamp(props.browning + heat * 1.4);
    }
    if (action.method === "braise" && action.durationMin >= 8) {
      props.tenderness = clamp(props.tenderness + heat * 14);
    }
    if (props.browning > 18) {
      next.appearance = {
        color: "#985044",
        label: "脂肪透亮、表面开始上色",
        gloss: clamp(34 + props.oiliness * 0.2),
      };
    }
  } else if (definition.art === "fish") {
    props.tenderness = clamp(
      props.cookedness > 92 ? props.tenderness - heat * 16 : props.tenderness + heat * 6,
    );
    if (props.cookedness > 38) {
      next.appearance = {
        color: "#d7d5c4",
        label:
          props.cookedness > 100 ? "鱼肉偏干、易碎" : "鱼肉刚转白、可分层",
        gloss: hasOil ? 36 : 24,
      };
    }
  }

  if (temp >= 180 && hasOil) {
    props.aroma = clamp(props.aroma + (temp - 170) * 0.08);
  }
  props.oxidation = clamp(
    props.oxidation +
      (props.temperature < 70 ? 0.2 : 0) +
      (definition.art === "potato" && props.temperature < 60 ? 0.5 : 0),
  );

  let category: ScienceKind = "physical";
  let title = "热量进入食材，水分、温度与结构一起变化";
  let description =
    "受热后中心温度逐步上升。表面水分先蒸发，内部水分随后迁移；切片越薄、表面积越大，中心与表面越接近。";
  let effects = ["中心温度上升", "组织开始软化"];

  if (props.browning > browningGain && browningGain > 1) {
    category = "chemical";
    title = "表面越过水分屏障，褐变开始形成香气";
    description =
      "表面变干后温度可超过 100°C。糖与氨基酸参与美拉德反应，糖自身也可能焦糖化，带来棕色与烤香；但温度过高或时间过久会转向焦苦。";
    effects = ["表面褐变", "烤香/焦香增加"];
  } else if (
    definition.protein > 0.4 &&
    props.cookedness > definition.safeCookedness * 0.45
  ) {
    category = "chemical";
    title = "蛋白质展开、重新连接，结构由流动变固定";
    description =
      "蛋白质受热后空间结构展开，再通过新的连接形成网络。温度和时间越充足，凝固越明显；继续加热会让网络收缩并挤出水分。";
    effects = ["蛋白质凝固", "质地变紧或更有形"];
  } else if (hasWater && temp >= 75 && definition.starchiness > 0.4) {
    category = "chemical";
    title = "水与热让淀粉吸水膨胀";
    description =
      "淀粉颗粒在热水中逐步不可逆地吸水和膨胀，释放黏性物质。这个过程会改变口感，也可能让汤汁变浓。";
    effects = ["淀粉糊化", "汤汁/表面黏度上升"];
  } else if (definition.art === "greens") {
    title = "叶片快速失水，脆度转向柔软";
    description =
      "青菜组织薄，受热很快。高温短时能减少水溶性风味流失，同时保持部分挺度；盐提前加入会通过渗透进一步加快出水。";
    effects = ["脆度下降", "柔软度上升", "部分水分流失"];
  }

  if (definition.art === "pork" && temp > 130) {
    title = "脂肪受热，部分油脂被释放";
    description =
      "脂肪组织受热软化并释放部分油脂，油脂会帮助传热和承载香气。持续高温则可能让肉表面迅速失水，而内部仍需更温和的湿热来完成软化。";
    category = "physical";
    effects = ["部分油脂析出", "香气载体增加"];
  }

  if (action.method === "reduce") {
    category = "physical";
    title = "水分进入蒸汽，汤汁浓度、盐度和香气一起上升";
    description =
      "收汁不是让水消失得越快越好。蒸发会缩减总体积，因此盐、酸、糖和香气同时被浓缩；盖盖或频繁翻动也会改变蒸发速度和挂汁状态。";
    effects = ["水分减少", "汤汁变浓", "味道更集中"];
  } else if (action.method === "shallow-fry") {
    category = "physical";
    title = "较多热油提高传热速度，也更容易形成酥脆表面";
    description =
      "浅炸依靠油把热量快速传到更多表面。表面水分先蒸发，随后温度升高并发生褐变；油温和时间过高会同时增加吸油和焦苦风险。";
    effects = ["传热加快", "表面更易酥脆", "油脂感增加"];
  } else if (lidCovered && hasWater) {
    category = "physical";
    title = "盖盖减少蒸汽逃逸，锅内更接近湿热环境";
    description =
      "蒸汽被困在锅内，表面水分不容易继续蒸发，热量也更均匀。它适合焖熟和保水，但会减慢褐变和收汁。";
    effects = ["蒸发减慢", "表面更湿润", "褐变速度下降"];
  }

  if (definition.art === "fish" && temp >= 70) {
    title = "鱼肉蛋白快速凝固，也更容易散";
    description =
      "鱼肉的组织细嫩，蛋白质在相对较低的温度就明显凝固。刚转白时通常更柔嫩，继续加热会让网络收紧、水分减少。";
    category = "chemical";
    effects = ["鱼肉由透明转白", "质地由柔软变紧"];
  }

  if (recordEvent) {
    next.actionCount += 1;
    next.events.push(
      event(next, describeAction(action), category, title, description, effects),
    );
  }
  return refreshDerivedState(next, definition);
}

function applySeasoning(
  state: IngredientState,
  definition: IngredientDefinition,
  action: SeasonAction,
): IngredientState {
  const next = structuredClone(state);
  const props = next.properties;
  const magnitude = amountMagnitude(action.amount, action.seasoningId);
  const seasoning = seasoningMap.get(action.seasoningId);
  const label = `${seasoning?.name ?? "调料"} · ${amountLabel(action.amount)}`;
  let category: ScienceKind = "chemical";
  let title = "";
  let description = "";
  let effects: string[] = [];

  const effectType = seasoning?.effectType ?? "salt";
  const behavior =
    effectType === "soy"
      ? action.seasoningId === "dark-soy"
        ? "dark-soy"
        : "light-soy"
      : effectType;

  switch (behavior) {
    case "oil":
      props.oiliness = clamp(props.oiliness + 8 * magnitude);
      props.sauceCoating = clamp(props.sauceCoating + 3 * magnitude);
      next.appearance.gloss = clamp(next.appearance.gloss + 9 * magnitude);
      next.flags.push("oil-added");
      category = "physical";
      title = hasTemperature(next, 150)
        ? "油接触热锅后快速铺展，成为传热层"
        : "油先形成隔离层，等待达到合适温度";
      description =
        "油把热量从锅面传向食材，也让脂溶性香气更容易迁移。油温越高，水分蒸发和褐变越快；超过油品耐受温度后，则可能出现冒烟和刺激气味。";
      effects = ["表面形成油膜", "光泽和顺滑感上升"];
      break;
    case "salt": {
      const early = props.cookedness < 8 && !next.flags.includes("heat-started");
      props.saltiness = clamp(props.saltiness + 25 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        salty: 14 * magnitude,
      });
      if (early) next.flags.push("salt-before-heat");
      if (definition.art === "greens" && early) {
        props.moisture = clamp(props.moisture - 10 * magnitude);
        props.crispness = clamp(props.crispness - 9 * magnitude);
      }
      category = "physical";
      title = early
        ? "盐已停留在表面，渗透会先作用于表层水分"
        : "盐溶解后迅速分布，并强化整体味道";
      description =
        "盐先溶入表面水分，形成浓度差。提前撒在叶菜或细嫩食材上，会让水分向外移动、质地变软；接近出锅时加，则更偏向立即调味和增强其他风味。";
      effects =
        definition.art === "greens" && early
          ? ["咸味上升", "叶面开始出水", "脆度下降"]
          : ["咸味上升", "甜味和鲜味感知更清晰"];
      break;
    }
    case "light-soy":
      props.saltiness = clamp(props.saltiness + 13 * magnitude);
      props.umami = clamp(props.umami + 16 * magnitude);
      props.aroma = clamp(props.aroma + 5 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        salty: 7 * magnitude,
        umami: 10 * magnitude,
      });
      next.flags.push("soy-added");
      title = "氨基酸、肽和盐一起加入，形成复合咸鲜";
      description =
        "生抽的鲜味来自发酵过程中形成的氨基酸和短肽，同时它本身含盐。它会让风味更有层次，但不能忽略其对总咸度的贡献。";
      effects = ["咸鲜上升", "酱香增加", "表面颜色略深"];
      next.appearance.color = shadeColor(next.appearance.color, 1.5 * magnitude);
      break;
    case "dark-soy":
      props.saltiness = clamp(props.saltiness + 11 * magnitude);
      props.umami = clamp(props.umami + 9 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        salty: 6 * magnitude,
        umami: 5 * magnitude,
      });
      next.flags.push("soy-added", "dark-color");
      title = "深色发酵物质附着在表面，颜色和咸味同时增加";
      description =
        "老抽的颜色来自发酵有色物质和部分焦糖色。它帮助形成深色外观，但含盐且用量很集中，少量就可能改变整体咸度和酱香。";
      effects = ["颜色明显加深", "咸味与酱香增加"];
      next.appearance.color = shadeColor(next.appearance.color, 4 * magnitude);
      next.appearance.label = `${next.appearance.label}，带酱色`;
      break;
    case "acid": {
      const hot = props.temperature > 100;
      const volatileFactor = hot ? 0.78 : 1;
      props.acidity = clamp(props.acidity + 20 * magnitude);
      props.enzymeActivity = clamp(props.enzymeActivity - 14 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        sour: 14 * magnitude * volatileFactor,
      });
      next.flags.push("acid-present");
      if (definition.art === "potato" && props.cookedness < 20) {
        props.browning = clamp(props.browning - 8 * magnitude);
        title = "较低 pH 让切面变褐的酶反应慢下来";
        description =
          "土豆切面中的多酚氧化酶需要适宜条件才能促成褐变。酸降低局部 pH 后可减缓酶活性，但并不能让已经被氧化变色的地方重新变白。";
      } else if (
        definition.art === "greens" &&
        (hot || props.cookedness > 15)
      ) {
        next.appearance = {
          color: "#6e7947",
          label: "绿色偏橄榄，叶片略收紧",
          gloss: next.appearance.gloss,
        };
        title = "酸与热共同改变叶绿素的绿色观感";
        description =
          "叶绿素在酸性条件和热作用下更容易失去中心镁离子，颜色向橄榄色转变。酸还会让部分表面蛋白收紧，因此叶菜的口感可能更硬而不是更嫩。";
      } else {
        title = "pH 下降，酸香和味觉平衡同时改变";
        description =
          "醋带来的是酸味和挥发性香气。热锅会让一部分酸香迅速进入蒸汽，所以同样用量在高温下不一定留下同样强的酸味。";
      }
      effects = ["酸度上升", "pH 下降", "可能影响酶与颜色"];
      break;
    }
    case "sugar": {
      const hotAndDry =
        props.temperature > 150 &&
        (next.flags.includes("surface-dry") || props.moisture < 70);
      props.sweetness = clamp(props.sweetness + 24 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        sweet: 16 * magnitude,
        sour: -3 * magnitude,
        spicy: -2 * magnitude,
      });
      next.flags.push("sugar-added");
      if (hotAndDry) {
        props.browning = clamp(props.browning + 9 * magnitude);
        category = "chemical";
        title = "糖进入高温表面，甜味之外还可能出现褐变";
        description =
          "糖在高温下会焦糖化；与氨基酸或蛋白质共同受热时还可发生美拉德反应，生成棕色和烤香。低温水中主要感受到的是甜味，这两条路线不要混为一谈。";
        effects = ["甜味上升", "褐变潜力增加"];
      } else {
        title = "甜味让酸、咸和辣显得更圆润";
        description =
          "糖不仅能增加甜味，还会改变其他味觉的相对感受。少量糖常用来柔化过强的酸或咸，但过量会遮盖食材本味。";
        effects = ["甜味上升", "酸味与辣感显得更柔和"];
      }
      break;
    }
    case "wine": {
      const hot = props.temperature >= 74;
      const reduction = (hot ? 16 : 7) * magnitude;
      props.offAroma = clamp(props.offAroma - reduction);
      props.aroma = clamp(props.aroma + 5 * magnitude);
      props.umami = clamp(props.umami + 2 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        umami: 2 * magnitude,
      });
      next.flags.push("wine-added");
      category = "chemical";
      title = hot
        ? "酒精与挥发性气味进入蒸汽，香气被重新组合"
        : "酒先作为香气溶液附着在表面";
      description =
        "料酒不等于消毒剂。它的乙醇能帮助一些香气化合物分散，受热时酒精和部分挥发性异味随蒸汽离开；姜葱与香辛料又带来新的气味。安全杀菌仍取决于温度和时间。";
      effects = hot
        ? ["酒味逐步挥发", "部分异味减弱", "香气增加"]
        : ["酒香附着", "异味感知可能降低"];
      break;
    }
    case "water":
      props.moisture = clamp(props.moisture + 3 * magnitude);
      props.temperature = Math.max(25, props.temperature - 12 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        sour: -2 * magnitude,
        sweet: -2 * magnitude,
        salty: -3 * magnitude,
        umami: -2 * magnitude,
      });
      next.flags.push("water-added");
      category = "physical";
      title =
        props.temperature > 90
          ? "水接触热锅后迅速汽化，带走热量"
          : "水增加汤汁并稀释现有味道";
      description =
        "水需要吸收大量热量才能变成蒸汽，所以少量加水会迅速降低锅面温度。它也会稀释盐、酸、甜和香气；需要更浓的味道时，后续要重新调味。";
      effects = ["锅温下降", "汤汁增加", "风味浓度下降"];
      break;
    case "starch": {
      const gelatinizes =
        props.temperature >= 60 &&
        (next.flags.includes("water-added") || props.moisture > 65);
      props.sauceCoating = clamp(props.sauceCoating + 12 * magnitude);
      if (gelatinizes) {
        props.starchGelatinization = clamp(
          props.starchGelatinization + 28 * magnitude,
        );
        props.sauceCoating = clamp(props.sauceCoating + 15 * magnitude);
      }
      next.flags.push("starch-added");
      category = "chemical";
      title = gelatinizes
        ? "淀粉遇水受热，开始吸水糊化"
        : "淀粉暂时附着在表面，等待水和热";
      description =
        "淀粉颗粒遇水并达到糊化温度后，会不可逆地吸水膨胀、破坏原有结构并释放黏性物质。直接倒入热液体前先用水调匀，可减少结块。";
      effects = gelatinizes
        ? ["挂汁能力上升", "汤汁可能变稠"]
        : ["表面覆着淀粉", "后续遇热可能糊化"];
      break;
    }
    case "heat":
      props.spiciness = clamp(props.spiciness + 26 * magnitude);
      props.bitterness = clamp(
        props.bitterness +
          (props.temperature > 180 ? 3 * magnitude : 0),
      );
      props.aroma = clamp(props.aroma + 8 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        spicy: 16 * magnitude,
        bitter: props.temperature > 180 ? 2 * magnitude : 0,
      });
      next.flags.push("chili-added");
      category = "biological";
      title = "辣椒素激活痛热感受器，香辛料同时进入嗅觉";
      description =
        "辣并不属于传统五种基本味觉。辣椒素会激活参与热和痛觉的感受器，香辛料中的挥发性物质则通过嗅觉提供香气。它们会重新分配注意力，但并不会真正“分解”所有异味。";
      effects = ["辣感上升", "香气增强", "其他味道可能被遮盖"];
      break;
    case "aroma":
      props.aroma = clamp(props.aroma + 9 * magnitude);
      props.offAroma = clamp(props.offAroma - 4 * magnitude);
      title =
        props.temperature > 150
          ? "香辛料在热油和热锅中迅速释放香气"
          : "香气分子先附着在表面，等待受热扩散";
      description =
        "八角、桂皮、花椒、胡椒和孜然等提供多种挥发性香气。温度会让释放加快，但过高温度和过长时间也可能带来焦苦。";
      effects = ["香气增强", "部分异味被重新组合"];
      break;
    case "paste":
      props.saltLoad = clamp(props.saltLoad + 18 * magnitude);
      props.umami = clamp(props.umami + 16 * magnitude);
      props.aroma = clamp(props.aroma + 7 * magnitude);
      props.sauceCoating = clamp(props.sauceCoating + 8 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        salty: 8 * magnitude,
        umami: 9 * magnitude,
        sweet: action.seasoningId === "sweet-bean-sauce" ? 5 * magnitude : 0,
        spicy: action.seasoningId === "doubanjiang" ? 5 * magnitude : 0,
      });
      next.flags.push("paste-added");
      title = "发酵酱料同时带来盐、鲜味、颜色和复杂香气";
      description =
        "豆瓣酱、甜面酱、蚝油和豆豉都不是单一味道。它们含盐并带有发酵产生的鲜味与香气，少量就可能明显改变整锅风味。";
      effects = ["咸鲜上升", "酱香增加", "颜色加深"];
      break;
    case "umami":
      props.umami = clamp(props.umami + 18 * magnitude);
      props.saltLoad = clamp(props.saltLoad + 7 * magnitude);
      next.flavor = flavorAfterTasteChange(next.flavor, {
        umami: 12 * magnitude,
        salty: 3 * magnitude,
      });
      title = "鲜味物质增强整体味觉清晰度";
      description =
        "鱼露、鸡精和味精主要提供鲜味，其中鱼露和鸡精通常还带来盐。鲜味会增强整体风味感，但不能修复过度受热造成的水分流失。";
      effects = ["鲜味增强", "咸味可能同时上升"];
      break;
  }

  if (
    behavior === "salt" ||
    behavior === "light-soy" ||
    behavior === "dark-soy"
  ) {
    props.saltLoad = clamp(props.saltLoad + 16 * magnitude);
  }
  if (behavior === "acid") {
    props.ph = clamp(props.ph - 1.15 * magnitude, 2, 8);
  }
  if (behavior === "water") {
    props.surfaceMoisture = clamp(props.surfaceMoisture + 18 * magnitude);
  }
  if (behavior === "starch") {
    props.starchHydration = clamp(props.starchHydration + 9 * magnitude);
  }
  if (behavior === "wine") {
    props.oxidation = clamp(props.oxidation - 2 * magnitude);
  }

  next.actionCount += 1;
  next.events.push(
    event(next, label, category, title, description, effects),
  );
  return refreshDerivedState(next, definition);
}

function hasTemperature(state: IngredientState, threshold: number): boolean {
  return state.properties.temperature >= threshold;
}

function shadeColor(hex: string, strength: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const factor = clamp(1 - strength * 0.05, 0.55, 1);
  const channels = [0, 2, 4].map((start) =>
    Math.round(parseInt(clean.slice(start, start + 2), 16) * factor),
  );
  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function buildWarnings(
  state: IngredientState,
  definition: IngredientDefinition,
): string[] {
  const props = state.properties;
  const warnings: string[] = [];

  if (
    props.temperature > 235 &&
    (state.flags.includes("oil-added") || props.oiliness > 10)
  ) {
    warnings.push("油温偏高，可能在现实中冒烟并产生刺激气味；请按实际油品调整。");
  }
  if (props.saltiness > 72) {
    warnings.push("咸度已经很高。现实中继续加水会同时稀释鲜味和酸味。");
  }
  if (props.acidity > 74) {
    warnings.push("酸度较高，可能压住甜味、鲜味和食材本味。");
  }
  if (props.browning > 76) {
    warnings.push("表面褐变较深，继续高温可能从焦香转向焦苦。");
  }
  if (
    ["beef", "pork", "fish"].includes(definition.id) &&
    props.cookedness < definition.safeCookedness
  ) {
    warnings.push("教学提醒：肉和水产需按实际种类、厚度与中心温度确保熟透。");
  }
  if (definition.id === "egg" && props.cookedness < 65) {
    warnings.push("蛋液尚未充分凝固；现实中请彻底加热后再食用。");
  }
  if (
    definition.art === "greens" &&
    props.cookedness > 100 &&
    props.tenderness > 88
  ) {
    warnings.push("受热与出水较多，青菜已明显失去挺度。");
  }
  return unique(warnings);
}

function refreshDerivedState(
  state: IngredientState,
  definition: IngredientDefinition,
): IngredientState {
  state.properties = Object.fromEntries(
    Object.entries(state.properties).map(([key, value]) => [
      key,
      round(clamp(value, key === "temperature" ? 0 : 0, key === "temperature" ? 300 : 150)),
    ]),
  ) as unknown as FoodProperties;
  state.properties.ph = round(clamp(state.properties.ph, 2, 9));
  state.properties.surfaceMoisture = round(
    clamp(state.properties.surfaceMoisture),
  );
  state.properties.saltLoad = round(clamp(state.properties.saltLoad));
  state.properties.proteinCoagulation = round(
    clamp(state.properties.proteinCoagulation),
  );
  state.properties.starchHydration = round(clamp(state.properties.starchHydration));
  state.properties.oxidation = round(clamp(state.properties.oxidation));
  state.properties.shapeIntegrity = round(clamp(state.properties.shapeIntegrity));
  state.properties.heatPenetration = round(clamp(state.properties.heatPenetration));
  state.flavor.intensity = round(
    clamp(
      12 +
        (state.flavor.sour +
          state.flavor.sweet +
          state.flavor.salty +
          state.flavor.umami +
          state.flavor.spicy) *
          0.72 +
        state.flavor.bitter * 0.22,
    ),
  );
  state.warnings = buildWarnings(state, definition);
  return state;
}

export function createInitialState(ingredientId: string): IngredientState {
  const definition = getIngredient(ingredientId);
  const initialProperties = structuredClone(definition.initialProperties);
  const initialDigest: StateDigest = {
    moisture: `水分 ${Math.round(initialProperties.moisture)}%`,
    surface: `表面水 ${Math.round(initialProperties.surfaceMoisture)}%`,
    texture: `嫩度 ${Math.round(initialProperties.tenderness)}`,
    flavor: `浓淡 ${Math.round(definition.baseFlavor.intensity)}`,
    color: definition.appearance.label,
  };
  return {
    ingredientId: definition.id,
    properties: initialProperties,
    flavor: structuredClone(definition.baseFlavor),
    appearance: structuredClone(definition.appearance),
    flags: [],
    events: [
      {
        id: "initial-state",
        action: "开始观察",
        category: "physical",
        title: "先看食材的初始状态",
        description: `${definition.description} 实验中的数值用于比较趋势，不代表真实实验室测量值。`,
        effects: definition.keyProperties.slice(0, 3),
        principleTags: [],
        before: initialDigest,
        after: initialDigest,
        transfer: "先观察状态，再决定要改变哪一项。",
      },
    ],
    warnings: [],
    actionCount: 0,
  };
}

function digestState(state: IngredientState): StateDigest {
  const props = state.properties;
  return {
    moisture: `水分 ${Math.round(props.moisture)}%，表面 ${Math.round(props.surfaceMoisture)}%`,
    surface: `温度 ${Math.round(props.temperature)}°C，pH ${props.ph.toFixed(1)}`,
    texture: `嫩 ${Math.round(props.tenderness)} / 脆 ${Math.round(props.crispness)} / 保形 ${Math.round(props.shapeIntegrity)}`,
    flavor: `咸 ${Math.round(state.flavor.salty)} / 鲜 ${Math.round(state.flavor.umami)} / 浓淡 ${Math.round(state.flavor.intensity)}`,
    color: state.appearance.label,
  };
}

function inferPrincipleTags(action: KitchenAction): PrincipleTag[] {
  if (action.type === "operation") {
    return treatmentMap.get(action.operationId)?.principleTags ?? [];
  }
  if (action.type === "heat") {
    const tags: PrincipleTag[] = ["temperature", "time", "heat-transfer"];
    if (action.targetTemperature >= 140) tags.push("browning", "surface-moisture");
    if (
      action.method === "boil" ||
      action.method === "blanch" ||
      action.method === "steam" ||
      action.method === "braise"
    ) {
      tags.push("surface-moisture");
    }
    if (action.lidCovered) tags.push("surface-moisture");
    return tags;
  }
  if (action.type === "season") {
    const effect = seasoningMap.get(action.seasoningId)?.effectType ?? "salt";
    const tags: Record<string, PrincipleTag[]> = {
      salt: ["osmosis", "salt-load"],
      soy: ["salt-load", "browning"],
      acid: ["ph", "oxidation"],
      sugar: ["browning"],
      wine: ["aroma-volatility"],
      aroma: ["aroma-volatility"],
      heat: ["aroma-volatility"],
      water: ["surface-moisture", "heat-transfer"],
      starch: ["starch-hydration"],
      oil: ["heat-transfer", "surface-moisture"],
      paste: ["salt-load", "browning", "aroma-volatility"],
      umami: ["salt-load", "aroma-volatility"],
    };
    return tags[effect] ?? [];
  }
  const prepTags: Record<PrepId, PrincipleTag[]> = {
    wash: ["surface-moisture"],
    soak: ["surface-moisture", "osmosis"],
    dry: ["surface-moisture"],
    "cut-small": ["surface-area", "heat-transfer"],
    "cut-large": ["surface-area", "heat-transfer"],
    blanch: ["temperature", "enzyme-activity"],
    marinate: ["osmosis", "salt-load", "time"],
    "starch-coat": ["starch-hydration"],
  };
  return prepTags[action.prepId];
}

function transferForTags(tags: PrincipleTag[]): string {
  return tags
    .slice(0, 3)
    .map((tag) => principleTransfers[tag]?.summary)
    .filter(Boolean)
    .join(" ");
}

export function applyAction(
  state: IngredientState,
  action: KitchenAction,
): IngredientState {
  const definition = getIngredient(state.ingredientId);
  const before = structuredClone(state);
  let result: IngredientState;
  if (action.type === "operation") {
    result = applyOperation(state, definition, action);
  } else if (action.type === "prep") {
    result = applyPrep(state, definition, action);
  } else if (action.type === "heat") {
    result = applyHeat(state, definition, action);
  } else {
    result = applySeasoning(state, definition, action);
  }

  const latest = result.events.at(-1);
  if (latest && result.actionCount > before.actionCount) {
    latest.principleTags = inferPrincipleTags(action);
    latest.before = digestState(before);
    latest.after = digestState(result);
    latest.transfer = transferForTags(latest.principleTags);
  }
  return result;
}

export function advanceCookingSession(
  state: IngredientState,
  session: CookingSession,
  realDeltaSeconds: number,
): { state: IngredientState; session: CookingSession } {
  if (!session.isHeating || realDeltaSeconds <= 0) {
    return { state, session };
  }
  const simulatedDelta = Math.min(60, realDeltaSeconds * 10);
  const approach = Math.min(1, realDeltaSeconds * 0.55);
  const currentTemperature =
    session.currentTemperature +
    (session.targetTemperature - session.currentTemperature) * approach;
  const nextSession: CookingSession = {
    ...session,
    currentTemperature,
    elapsedSimSeconds: session.elapsedSimSeconds + simulatedDelta,
  };
  const action: HeatAction = {
    type: "heat",
    method: session.method,
    heatLevel: session.heatLevel,
    targetTemperature: currentTemperature,
    durationMin: simulatedDelta / 60,
    lidCovered: session.lidCovered,
    stirIntensity: session.stirIntensity,
  };
  const nextState = applyHeat(
    state,
    getIngredient(state.ingredientId),
    action,
    false,
  );
  nextState.properties.temperature = currentTemperature;
  return {
    state: refreshDerivedState(nextState, getIngredient(state.ingredientId)),
    session: nextSession,
  };
}

export function finishCookingSession(
  startState: IngredientState,
  state: IngredientState,
  session: CookingSession,
): IngredientState {
  const next = structuredClone(state);
  const minutes = Math.max(0.1, session.elapsedSimSeconds / 60);
  const summaryTitle =
    next.properties.browning > startState.properties.browning + 3
      ? "持续受热让表面水分下降并开始形成焦香"
      : "持续受热改变了温度、熟度和含水量";
  const summary = event(
    next,
    `${{
      "stir-fry": "快炒",
      "pan-fry": "煎香",
      "shallow-fry": "浅炸",
      boil: "水煮",
      blanch: "焯水",
      steam: "蒸制",
      braise: "炖煮",
      reduce: "收汁",
      rest: "离火静置",
    }[session.method]} · ${minutes.toFixed(1)} 分钟`,
    "physical",
    summaryTitle,
    "这一条记录合并了整段实时加热。温度先上升，随后熟度、水分、颜色和香气持续累积；关火后余温仍可能继续作用。",
    [
      `最高目标 ${Math.round(session.targetTemperature)}°C`,
      `模拟受热 ${minutes.toFixed(1)} 分钟`,
      `当前上色 ${Math.round(next.properties.browning)}`,
    ],
  );
  next.actionCount += 1;
  next.events.push(summary);
  const tags: PrincipleTag[] = [
    "temperature",
    "time",
    "heat-transfer",
  ];
  if (next.properties.browning > startState.properties.browning + 3) {
    tags.push("browning", "surface-moisture");
  }
  summary.principleTags = tags;
  summary.before = digestState(startState);
  summary.after = digestState(next);
  summary.transfer = transferForTags(tags);
  return refreshDerivedState(next, getIngredient(next.ingredientId));
}

export function replayActions(
  ingredientId: string,
  actions: KitchenAction[],
): IngredientState {
  return actions.reduce(
    (state, action) => applyAction(state, action),
    createInitialState(ingredientId),
  );
}

export function getTasteLabel(value: number): string {
  if (value < 8) return "很轻";
  if (value < 24) return "轻";
  if (value < 48) return "适中";
  if (value < 70) return "明显";
  return "强烈";
}
