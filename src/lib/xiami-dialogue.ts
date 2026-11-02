import type { XiamiVoiceLineId } from "@/lib/xiami-voice";

/**
 * Xiami's voice is teasing on the surface and precise underneath.
 * Every line should pair character attitude with an actionable cooking cue.
 */
export const XIAMI_TOMATO_EGG_DIALOGUE = {
  "phase-prep":
    "别急着开火。番茄先上砧板，鸡蛋进碗里——动作不用漂亮，顺序别乱。我可不替你把切坏的番茄捡回来。",
  "phase-heat":
    "锅热了再倒油。油面轻轻起纹就够了；真冒青烟，那不是气势，是锅在提醒你收手。",
  "phase-egg":
    "蛋液下去先别乱翻。边缘凝住、中心还亮时盛出来——现在贪那几秒，回头只能吃一盘老鸡蛋。",
  "phase-tomato":
    "番茄要慢慢逼出汁，糖只是把酸味收圆，不是让它变甜品。你总盯着进度条也行，可我更信锅里的声音。",
  "phase-finish":
    "最后才撒盐和葱花。葱是收尾的一口气，不是用来盖住番茄和蛋香的遮羞布。",
  "outcome-burnt-egg":
    "停。已经不是锅气，是鸡蛋真的焦了。颜色一深，苦味会比香味跑得更快——下次早点盛，或者把火收住。",
  "outcome-burnt-tomato":
    "停，番茄已经烧到发黑了。它出沙前会先出汁，汁一收干还不回锅，甜酸马上就会变成苦。",
  "outcome-raw-egg":
    "蛋液还没完全定型。切配没错，可锅里这段不能靠“下一步”跳过去；火候没到的嫩，不叫嫩。",
  "outcome-raw-tomato":
    "番茄还没真正出沙。看着软不等于果胶松开；再多给它一点时间，别把一盘生涩塞我嘴里。",
  "outcome-salty":
    "步骤没乱，盐却抢了戏。番茄的酸、糖的圆和鸡蛋的香都被压下去了。下次最后那一下，手别抖。",
  "outcome-bland":
    "番茄出沙了，蛋也嫩，可味道还站不起来。盐少到连酸甜都托不住，这不是清淡，是散。",
  "outcome-perfect":
    "这次可以。番茄出沙，鸡蛋还嫩，盐刚好把酸甜和蛋香扣在一起。不是运气，是你真的接住了两次火候。",
} satisfies Record<XiamiVoiceLineId, string>;
