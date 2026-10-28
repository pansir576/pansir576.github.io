import { getIngredient } from "./ingredients";
import { principles } from "./principles";
import type {
  GuideRequest,
  GuideResponse,
  GuidedCookSession,
  OutcomeGoal,
} from "./types";
import { outcomeGoals, treatmentsForIngredient } from "./treatments";
import {
  ensureAnonymousUser,
  getCommunityClient,
} from "./community/supabase";

const foodKeywords: Record<string, string[]> = {
  "盐|咸|生抽|酱油|入味": [
    "盐会建立浓度差，水会从盐少的一侧向盐多的一侧移动；同时咸味会直接改变味觉平衡。",
    "先少量加入，再考虑生抽、蚝油、鱼露和鸡精里已经带有的盐。",
  ],
  "醋|酸|pH|护色": [
    "酸首先改变 pH，可能影响酶促褐变、叶绿素颜色和蛋白质状态；酸味本身也会改变咸甜感知。",
    "少量酸不等于一定保脆或保绿，还要同时看温度、时间和食材结构。",
  ],
  "糖|甜|上色|焦糖": [
    "糖提供甜味；在足够高的温度和足够长的时间里，还可能参与褐变。低温主要影响味觉，高温才更容易出现颜色和香气。",
    "糖也会提高汁液浓度，但不要把“变甜”和“上色”当成同一件事。",
  ],
  "料酒|酒|腥|挥发": [
    "料酒主要提供香气和酒精环境，异味是否能被带走还取决于温度、时间和通风。",
    "酒不能代替清理鱼腹黑膜、血水或确保肉类熟透。",
  ],
  "油|煎|炒|焦香|褐变": [
    "油帮助热量均匀接触食材，但表面水先要被蒸发。表面太湿时，锅里的第一阶段更像蒸煮。",
    "焦香通常来自表面干燥后的高温褐变；继续加热会从香气推向焦苦。",
  ],
  "淀粉|挂汁|糊化|上浆": [
    "淀粉吸水并受热后糊化，可以保水、增加黏度并让酱汁更容易挂在表面。",
    "淀粉量过高会遮住食材本味，也可能让锅底更快糊化。",
  ],
  "水|出水|表面水|蒸发": [
    "水分会先吸收热量再蒸发；表面水越多，煎炒越难快速越过水煮阶段。",
    "渗出的水还来自盐、细胞结构和受热时间，不只看洗后表面湿不湿。",
  ],
};

function topicAnswer(question: string): string[] {
  return (
    Object.entries(foodKeywords).find(([pattern]) =>
      new RegExp(pattern).test(question),
    )?.[1] ?? [
      "先看当前食材的水分、结构、温度和已完成的处理，再判断下一步。",
      "同一动作换到不同食材上，结果可能完全不同；先比较变量，再照搬顺序。",
    ]
  );
}

export function buildGuideRequest(
  session: GuidedCookSession,
  question: string,
): GuideRequest {
  const available = session.ingredientId
    ? treatmentsForIngredient(session.ingredientId)
    : [];
  return {
    partnerId: session.partnerId ?? "xiaoyan",
    question,
    context: {
      ingredientId: session.ingredientId ?? undefined,
      goal: session.goal,
      phase: session.phase,
      temperature: session.state?.properties.temperature,
      cookedness: session.state?.properties.cookedness,
      surfaceMoisture: session.state?.properties.surfaceMoisture,
      saltLoad: session.state?.properties.saltLoad,
      recentEvents:
        session.state?.events
          .slice(-5)
          .map((event) => `${event.action}：${event.title}`) ?? [],
      allowedOperationIds:
        session.phase === "prepare"
          ? available.map((item) => item.id)
          : [],
    },
  };
}

export function answerGuideLocally(
  request: GuideRequest,
  reason = "AI 服务未配置或暂时不可用",
): GuideResponse {
  const ingredient = request.context.ingredientId
    ? getIngredient(request.context.ingredientId)
    : null;
  const goal = request.context.goal
    ? outcomeGoals.find((item) => item.id === request.context.goal)
    : null;
  const relatedPrinciples = principles.filter((principle) => {
    const text = `${principle.name}${principle.summary}${principle.mechanism}`;
    return (
      request.question.includes(principle.name) ||
      request.question.includes("为什么") ||
      request.question.includes("原理")
    ) && text.length > 0;
  });
  const [conclusion, caution] = topicAnswer(request.question);
  const stateLine = ingredient
    ? `当前是${ingredient.name}，阶段为${request.context.phase}；表面水 ${Math.round(request.context.surfaceMoisture ?? 0)}，熟度 ${Math.round(request.context.cookedness ?? 0)}，当前温度 ${Math.round(request.context.temperature ?? 0)}°C。`
    : "当前还没有选择食材，可以先确定要改变的结果。";
  const goalLine = goal ? `这次目标是“${goal.name}”：${goal.description}` : "";
  const sourceLine = relatedPrinciples[0]
    ? `可继续阅读“${relatedPrinciples[0].name}”的机制，它把结论与底层变化连接起来。`
    : "";
  return {
    answer: [
      conclusion,
      stateLine,
      goalLine,
      caution,
      sourceLine,
      `说明：${reason}，本次为本地知识库回答，建议仍以实际食材厚度、锅具和食品安全判断为准。`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    citations: [
      ...(ingredient
        ? [{ id: ingredient.id, title: `${ingredient.name}食材档案` }]
        : []),
      ...relatedPrinciples
        .slice(0, 2)
        .map((principle) => ({ id: principle.id, title: principle.name })),
    ],
    provider: "local",
  };
}

export async function askCookingGuide(
  session: GuidedCookSession,
  question: string,
): Promise<GuideResponse> {
  const request = buildGuideRequest(session, question);
  const supabase = getCommunityClient();
  if (!supabase) {
    return answerGuideLocally(request);
  }
  try {
    const remote = (async () => {
      await ensureAnonymousUser();
      return supabase.functions.invoke("cooking-guide", {
        body: request,
      });
    })();
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("AI_GUIDE_TIMEOUT")),
        10_000,
      );
    });
    const { data, error } = await Promise.race([remote, timeout]);
    if (error) throw error;
    if (
      data &&
      typeof data.answer === "string" &&
      Array.isArray(data.citations)
    ) {
      return {
        answer: data.answer,
        citations: data.citations,
        provider: "llm",
      };
    }
    throw new Error("AI response format is invalid");
  } catch {
    return answerGuideLocally(request, "在线 AI 当前超时或不可用");
  }
}

export function guidedGoalName(goal: OutcomeGoal | null): string {
  return goal
    ? outcomeGoals.find((item) => item.id === goal)?.name ?? goal
    : "未设目标";
}
