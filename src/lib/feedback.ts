import type {
  FeedbackMessage,
  IngredientState,
  KitchenAction,
} from "./types";

export function buildFeedback(
  state: IngredientState,
  action?: KitchenAction,
): FeedbackMessage {
  const props = state.properties;
  const actionId =
    action?.type === "operation"
      ? action.operationId
      : action?.type === "season"
        ? action.seasoningId
        : action?.type;

  if (props.surfaceMoisture > 65) {
    return {
      id: `wet-${actionId ?? "state"}`,
      tone: "warning",
      text: "表面水还很多，直接煎炒容易先变成水煮。先控水更容易上色。",
    };
  }
  if (props.temperature >= 170 && props.browning < 12) {
    return {
      id: `hot-${actionId ?? "state"}`,
      tone: "good",
      text: "锅温已经足够高，表面干燥时更容易形成焦香。",
    };
  }
  if (props.cookedness > state.properties.moisture * 0.9) {
    return {
      id: `over-${actionId ?? "state"}`,
      tone: "warning",
      text: "受热较多，水分正在下降；继续加热可能让口感变干。",
    };
  }
  if (props.saltLoad > 65) {
    return {
      id: `salty-${actionId ?? "state"}`,
      tone: "warning",
      text: "盐负荷已经较高，酱料和鸡精里的盐也要一起计算。",
    };
  }
  if (actionId === "wash" || actionId === "archetype-staple-rinse") {
    return {
      id: "washed",
      tone: "neutral",
      text: "表面更干净，也带来了更多表面水。下一步要观察是否需要控水。",
    };
  }
  return {
    id: `state-${actionId ?? "ready"}`,
    tone: "neutral",
    text: state.warnings[0] ?? "观察水分、温度和形态，再决定下一步处理。",
  };
}

export function foodFormFromState(
  state: IngredientState,
  actionCount: number,
): "whole" | "washed" | "cut" | "small-pieces" | "cooking" | "done" {
  if (state.properties.cookedness > 85) return "done";
  if (state.properties.cookedness > 15) return "cooking";
  if (state.flags.includes("cut-small") || state.flags.includes("surface-area")) {
    return "small-pieces";
  }
  if (state.flags.some((flag) => flag.includes("cut") || flag.includes("tear"))) {
    return "cut";
  }
  if (state.flags.includes("washed")) return "washed";
  return actionCount > 0 ? "washed" : "whole";
}
