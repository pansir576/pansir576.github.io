export type PlayWorkstationId =
  | "board"
  | "bowl"
  | "wok"
  | "stock-pot"
  | "steamer"
  | "oven"
  | "plate";

export interface PlayWorkstationDefinition {
  id: PlayWorkstationId;
  label: string;
  family: "prep" | "heat" | "serve";
  maxVisibleItems: number;
  focusScale: number;
}

export const TOMATO_EGG_WORKSTATIONS: Record<
  "board" | "bowl" | "wok" | "plate",
  PlayWorkstationDefinition
> = {
  board: {
    id: "board",
    label: "砧板",
    family: "prep",
    maxVisibleItems: 4,
    focusScale: 1,
  },
  bowl: {
    id: "bowl",
    label: "打蛋碗",
    family: "prep",
    maxVisibleItems: 2,
    focusScale: 0.94,
  },
  wok: {
    id: "wok",
    label: "炒锅",
    family: "heat",
    maxVisibleItems: 4,
    focusScale: 1,
  },
  plate: {
    id: "plate",
    label: "盘子",
    family: "serve",
    maxVisibleItems: 4,
    focusScale: 0.92,
  },
};

export const FUTURE_WORKSTATIONS: PlayWorkstationDefinition[] = [
  {
    id: "stock-pot",
    label: "汤锅",
    family: "heat",
    maxVisibleItems: 5,
    focusScale: 1,
  },
  {
    id: "steamer",
    label: "蒸锅",
    family: "heat",
    maxVisibleItems: 4,
    focusScale: 1,
  },
  {
    id: "oven",
    label: "烤箱",
    family: "heat",
    maxVisibleItems: 4,
    focusScale: 1,
  },
];
