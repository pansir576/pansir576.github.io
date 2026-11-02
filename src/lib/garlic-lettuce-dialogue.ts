export type GarlicLettuceVoiceLineId =
  | "garlic-phase-prep"
  | "garlic-phase-heat"
  | "garlic-phase-garlic"
  | "garlic-phase-greens"
  | "garlic-phase-serve"
  | "garlic-outcome-burnt-garlic"
  | "garlic-outcome-weak-garlic"
  | "garlic-outcome-raw-greens"
  | "garlic-outcome-over-greens"
  | "garlic-outcome-salty"
  | "garlic-outcome-bland"
  | "garlic-outcome-perfect";

/**
 * The same Xiami voice as the tomato-egg prototype: teasing, observant,
 * precise under pressure, never cute for its own sake.
 */
export const XIAMI_GARLIC_LETTUCE_DIALOGUE = {
  "garlic-phase-prep":
    "油麦菜别泡在水里发呆。快洗、抖干、切段；蒜拍碎再切末，大小别像两块石头。",
  "garlic-phase-heat":
    "锅和油先热起来再下蒜。蒜末一香就往前走，等它变深，你再心疼也来不及。",
  "garlic-phase-garlic":
    "蒜香刚起来的时候下菜，动作要快。别让蒜末在锅里独自想人生。",
  "garlic-phase-greens":
    "油麦菜下锅就别磨蹭。大火、翻匀、看叶子刚塌下去——它断生就够，软塌塌不是温柔。",
  "garlic-phase-serve":
    "盐现在放，翻两下就出锅。余温还会继续做事，别把菜等成一片黄叶。",
  "garlic-outcome-burnt-garlic":
    "停，蒜已经炸成苦味炸弹了。蒜末变深褐就是报警线，整锅重新来，别拿菜叶子给它陪葬。",
  "garlic-outcome-weak-garlic":
    "菜熟了，蒜还没醒。油温不够或下锅太快，香气根本没出来；下次听到轻轻滋啦，再放菜。",
  "garlic-outcome-raw-greens":
    "叶子还硬着。大火快炒是让你快，不是让你逃课；叶片刚软、梗还脆，才是断生。",
  "garlic-outcome-over-greens":
    "这盘绿得太委屈了。炒到全软才出锅，叶绿素和脆感都先走了；下次看叶子刚塌就收手。",
  "garlic-outcome-salty":
    "盐把油麦菜的清甜盖住了。绿叶菜吸盐快，先少放、尝一口，比事后加菜可靠。",
  "garlic-outcome-bland":
    "菜是嫩的，香气也到了，可味道没落地。盐少到托不住蒜香，这不是清爽，是寡。",
  "garlic-outcome-perfect":
    "这次像样。蒜香起来了，叶子刚断生，盐没多一步也没少一步。快、准，这才是叶菜该有的命。",
} satisfies Record<GarlicLettuceVoiceLineId, string>;
