export type StoryDishForm = "pile" | "fish" | "soup" | "rice" | "noodles";

export interface StoryDishSpec {
  form: StoryDishForm;
  assets: string[];
  sauce: string;
  garnish: string;
}

const STORY_DISHES: Record<number, StoryDishSpec> = {
  1: {
    form: "pile",
    assets: ["potato", "green-pepper", "chives"],
    sauce: "#d1a057",
    garnish: "chives",
  },
  2: {
    form: "pile",
    assets: ["tomato", "egg", "chives"],
    sauce: "#cf633f",
    garnish: "chives",
  },
  3: {
    form: "pile",
    assets: ["youmaicai", "youmaicai", "green-pepper"],
    sauce: "#6f9b4d",
    garnish: "chives",
  },
  4: {
    form: "pile",
    assets: ["potato", "carrot", "chives"],
    sauce: "#c98737",
    garnish: "chives",
  },
  5: {
    form: "pile",
    assets: ["eggplant", "tomato", "green-pepper"],
    sauce: "#77412e",
    garnish: "chives",
  },
  6: {
    form: "pile",
    assets: ["cucumber", "cucumber", "carrot"],
    sauce: "#8db270",
    garnish: "chives",
  },
  7: {
    form: "pile",
    assets: ["greens", "carrot", "greens"],
    sauce: "#719e4e",
    garnish: "chives",
  },
  8: {
    form: "pile",
    assets: ["greens", "green-pepper", "chives"],
    sauce: "#52743e",
    garnish: "chives",
  },
  9: {
    form: "pile",
    assets: ["pork-loin", "green-pepper", "chives"],
    sauce: "#9d5739",
    garnish: "chives",
  },
  10: {
    form: "pile",
    assets: ["pork-loin", "wood-ear", "bamboo-shoots"],
    sauce: "#a9522e",
    garnish: "chives",
  },
  11: {
    form: "pile",
    assets: ["beef-brisket", "potato", "carrot"],
    sauce: "#855036",
    garnish: "chives",
  },
  12: {
    form: "pile",
    assets: ["beef-brisket", "tomato", "tomato"],
    sauce: "#a94732",
    garnish: "chives",
  },
  13: {
    form: "pile",
    assets: ["pork", "pork", "carrot"],
    sauce: "#713b28",
    garnish: "chives",
  },
  14: {
    form: "pile",
    assets: ["pork", "napa-cabbage", "green-pepper"],
    sauce: "#9c4d31",
    garnish: "chives",
  },
  15: {
    form: "pile",
    assets: ["chicken-thigh", "cucumber", "carrot"],
    sauce: "#aa5934",
    garnish: "chives",
  },
  16: {
    form: "pile",
    assets: ["chicken-thigh", "shiitake", "shiitake"],
    sauce: "#795038",
    garnish: "chives",
  },
  17: {
    form: "fish",
    assets: ["fish"],
    sauce: "#c99c62",
    garnish: "chives",
  },
  18: {
    form: "pile",
    assets: ["shrimp", "shrimp", "shrimp"],
    sauce: "#d69b68",
    garnish: "chives",
  },
  19: {
    form: "noodles",
    assets: ["vermicelli", "shrimp", "shrimp"],
    sauce: "#c9a361",
    garnish: "chives",
  },
  20: {
    form: "pile",
    assets: ["firm-tofu", "green-pepper", "wood-ear"],
    sauce: "#a96d42",
    garnish: "chives",
  },
  21: {
    form: "pile",
    assets: ["tofu", "beef-brisket", "chives"],
    sauce: "#aa4e2e",
    garnish: "chives",
  },
  22: {
    form: "pile",
    assets: ["egg", "chives", "chives"],
    sauce: "#c4a03d",
    garnish: "chives",
  },
  23: {
    form: "soup",
    assets: ["spinach", "tofu", "spinach"],
    sauce: "#c8b678",
    garnish: "chives",
  },
  24: {
    form: "soup",
    assets: ["pork-ribs", "winter-melon", "pork-ribs"],
    sauce: "#c49b63",
    garnish: "chives",
  },
  25: {
    form: "rice",
    assets: ["egg", "egg", "chives"],
    sauce: "#a77935",
    garnish: "chives",
  },
};

const FALLBACK_DISH: StoryDishSpec = {
  form: "pile",
  assets: ["greens", "carrot", "chives"],
  sauce: "#9c7042",
  garnish: "chives",
};

export function getStoryDishSpec(recipeId: number) {
  return STORY_DISHES[recipeId] ?? FALLBACK_DISH;
}

export function storyIngredientAsset(assetId: string) {
  return `/2d/story-kitchen/ingredients/ingredient_${assetId}_normal.png`;
}
