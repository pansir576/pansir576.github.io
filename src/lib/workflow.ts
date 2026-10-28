import { getIngredient } from "./ingredients";
import { planKitchenTasks } from "./kitchen-tasks";
import { outcomeGoals } from "./treatments";
import type {
  ContextRecommendation,
  IngredientState,
  KitchenAction,
  KitchenWorkflow,
  KitchenWorkspace,
  OutcomeGoal,
  WorkflowPhaseId,
  WorkflowStep,
} from "./types";

export interface WorkflowAnalysisInput {
  ingredientId: string;
  actions: KitchenAction[];
  workspace: KitchenWorkspace;
  state: IngredientState;
  goal?: OutcomeGoal | null;
  isHeating: boolean;
  hasSavedResult: boolean;
}

function completedTaskCount(tasks: ReturnType<typeof planKitchenTasks>) {
  return tasks.filter((task) => task.completed).length;
}

function statusFor(
  id: WorkflowPhaseId,
  current: WorkflowPhaseId,
  completed: boolean,
): WorkflowStep["status"] {
  if (completed) return "completed";
  return id === current ? "active" : "upcoming";
}

function recommendationCaution(state: IngredientState): string | undefined {
  if (state.properties.surfaceMoisture > 68) {
    return "表面水偏高时先不要急着下油煎，否则容易先变成水煮。";
  }
  if (state.properties.saltLoad > 65) {
    return "盐负荷已较高，继续加酱油、鸡精或鱼露会进一步抬咸。";
  }
  if (state.properties.temperature > 230) {
    return "当前温度偏高，现实中可能冒烟或焦苦，请结合油品耐受温度。";
  }
  if (
    state.warnings.some((warning) => warning.includes("中心"))
  ) {
    return "外观变化不能代替中心温度，肉类和水产仍需确保熟透。";
  }
  return undefined;
}

export function analyzeKitchenWorkflow(
  input: WorkflowAnalysisInput,
): KitchenWorkflow {
  const {
    ingredientId,
    actions,
    workspace,
    state,
    goal,
    isHeating,
    hasSavedResult,
  } = input;
  const ingredient = getIngredient(ingredientId);
  const tasks = planKitchenTasks(ingredientId, actions, workspace);
  const preparationTasks = tasks.slice(0, 3);
  const preparationDone = preparationTasks.every((task) => task.completed);
  const hasHeat = actions.some((action) => action.type === "heat") ||
    state.properties.cookedness > 3 ||
    isHeating;
  const hasSeasoning = actions.some((action) => action.type === "season");
  const goalLabel = goal
    ? outcomeGoals.find((item) => item.id === goal)?.name ?? goal
    : "";

  const phaseStatuses: Record<WorkflowPhaseId, boolean> = {
    select: true,
    prepare: preparationDone,
    pan: workspace.inPan,
    cook: hasHeat,
    review: hasSavedResult,
  };
  const currentPhase =
    (["select", "prepare", "pan", "cook", "review"] as WorkflowPhaseId[]).find(
      (phase) => !phaseStatuses[phase],
    ) ?? "review";

  const steps: WorkflowStep[] = [
    {
      id: "select",
      title: "选择食材与目标",
      summary: goal
        ? `${ingredient.name} · ${goalLabel}`
        : `${ingredient.name} · 目标可稍后选择`,
      status: statusFor("select", currentPhase, true),
      targetTab: "ingredient",
    },
    {
      id: "prepare",
      title: "清洗、切配与控水",
      summary: `${completedTaskCount(preparationTasks)} / ${preparationTasks.length} 项完成`,
      status: statusFor("prepare", currentPhase, preparationDone),
      targetTab: "treat",
      station: "board",
    },
    {
      id: "pan",
      title: "放入炒锅",
      summary: workspace.inPan ? "食材已经在锅内" : "食材尚未入锅",
      status: statusFor("pan", currentPhase, workspace.inPan),
      targetTab: "pan",
      station: "pan",
    },
    {
      id: "cook",
      title: "火候与调味",
      summary: hasHeat
        ? hasSeasoning
          ? "已完成受热并开始调味"
          : "已受热，可继续调味"
        : "选择火力、温度和调料",
      status: statusFor("cook", currentPhase, hasHeat),
      targetTab: "heat",
      station: "pan",
    },
    {
      id: "review",
      title: "观察结果并保存对比",
      summary: hasSavedResult ? "已有保存结果" : "观察状态，保存或建立对照",
      status: statusFor("review", currentPhase, hasSavedResult),
      targetTab: "save",
    },
  ];

  const caution = recommendationCaution(state);
  let recommendation: ContextRecommendation;

  if (isHeating) {
    const nearTarget =
      workspace.session &&
      workspace.session.currentTemperature >=
        workspace.session.targetTemperature - 5;
    const nearDone = state.properties.cookedness >= ingredient.safeCookedness;
    recommendation = {
      id: "recommend-watch-heat",
      title: nearTarget || nearDone ? "观察并准备关火" : "继续观察温度和熟度",
      reason:
        nearTarget || nearDone
          ? "目标温度或安全熟度已经接近，继续加热可能让水分下降、口感变老。"
          : "实时加热会持续累积变化，数值达到目标后再关火，而不是只按固定时间。",
      actionLabel: nearTarget || nearDone ? "暂停或关火" : "查看实时状态",
      targetTab: "heat",
      station: "pan",
      alternatives: nearTarget
        ? ["先暂停再观察余温", "关火并记录结果"]
        : ["调整火力", "暂停检查颜色和气味"],
      caution,
      tone: nearTarget || nearDone ? "good" : "neutral",
    };
  } else if (workspace.inPan && hasHeat && !hasSeasoning) {
    recommendation = {
      id: "recommend-season",
      title: "少量调味并继续尝味",
      reason:
        goal === "more-umami"
          ? "少量生抽或鲜味调料能补足咸鲜，但要把其中的盐一并计算。"
          : goal === "less-fishy"
            ? "酒姜和少量酸更适合帮助调整气味，不宜用大量调料遮盖。"
            : "从少量盐或基础咸味开始，再根据酸甜和鲜味逐次补充。",
      actionLabel: "打开调味面板",
      targetTab: "season",
      station: "pan",
      alternatives: ["先尝味再补盐", "用醋或糖调整平衡"],
      caution,
      tone: caution ? "warning" : "neutral",
    };
  } else if (workspace.inPan && hasHeat && hasSeasoning) {
    recommendation = {
      id: "recommend-review",
      title: hasSavedResult ? "建立另一个试验锅" : "保存当前结果",
      reason: hasSavedResult
        ? "只有保存两个可比较结果，才能确认同一变量的作用。"
        : "保存当前状态和操作历史，刷新后仍可回看。",
      actionLabel: hasSavedResult ? "复制为 2 号试验锅" : "查看保存区域",
      targetTab: "save",
      alternatives: ["继续微调后保存", "打开因果时间线复盘"],
      caution,
      tone: "good",
    };
  } else if (!preparationTasks[0].completed) {
    recommendation = {
      id: "recommend-wash",
      title: "先清洗食材",
      reason: "清洗会带来表面水，但也是观察后续控水和受热变化的第一步。",
      actionLabel: "执行冲洗",
      operationId: tasks[0].operationId,
      station: "sink",
      targetTab: "treat",
      alternatives: ["如果是包装豆腐或蛋类，可以直接进入切配", "先阅读食材处理说明"],
      caution,
      tone: caution ? "warning" : "neutral",
    };
  } else if (!preparationTasks[1].completed) {
    recommendation = {
      id: "recommend-prepare",
      title: preparationTasks[1].title,
      reason: preparationTasks[1].description,
      actionLabel: "查看对应处理",
      operationId: preparationTasks[1].operationId,
      station: "board",
      targetTab: "treat",
      alternatives: ["按目标选择切大或切小", "先观察食材初始状态"],
      caution,
      tone: caution ? "warning" : "neutral",
    };
  } else if (
    !preparationTasks[2].completed &&
    (state.properties.surfaceMoisture > 58 ||
      goal === "crisper" ||
      goal === "less-water" ||
      goal === "more-aromatic")
  ) {
    recommendation = {
      id: "recommend-dry",
      title: "控制表面水分",
      reason: "表面水越多，入锅后越先形成蒸汽，煎香和保持脆度都会变慢。",
      actionLabel: "查看控水操作",
      operationId: preparationTasks[2].operationId,
      station: "board",
      targetTab: "treat",
      alternatives: ["目标需要酱汁时可保留少量表面水", "入锅后用较高温度快速处理"],
      caution,
      tone: "warning",
    };
  } else if (!workspace.inPan) {
    recommendation = {
      id: "recommend-pan",
      title: "把食材放进炒锅",
      reason: "锅为空时不能点火。先把样本移动到炒锅，再选择火力和温度。",
      actionLabel: "移动到炒锅",
      station: "pan",
      targetTab: "pan",
      alternatives: ["点击炒锅区域", "把食材拖到炒锅"],
      caution,
      tone: "neutral",
    };
  } else if (isHeating) {
    const nearTarget =
      workspace.session &&
      workspace.session.currentTemperature >=
        workspace.session.targetTemperature - 5;
    const nearDone = state.properties.cookedness >= ingredient.safeCookedness;
    recommendation = {
      id: "recommend-watch-heat",
      title: nearTarget || nearDone ? "观察并准备关火" : "继续观察温度和熟度",
      reason:
        nearTarget || nearDone
          ? "目标温度或安全熟度已经接近，继续加热可能让水分下降、口感变老。"
          : "实时加热会持续累积变化，数值达到目标后再关火，而不是只按固定时间。",
      actionLabel: nearTarget || nearDone ? "暂停或关火" : "查看实时状态",
      targetTab: "heat",
      station: "pan",
      alternatives: nearTarget ? ["先暂停再观察余温", "关火并记录结果"] : ["调整火力", "暂停检查颜色和气味"],
      caution,
      tone: nearTarget || nearDone ? "good" : "neutral",
    };
  } else if (!hasHeat) {
    recommendation = {
      id: "recommend-heat",
      title: "调整火力并开始烹饪",
      reason:
        goal === "tenderer"
          ? "目标偏嫩时优先中低温、短时间加热，避免蛋白质过度收缩。"
          : goal === "more-aromatic"
            ? "目标偏香时需要表面干燥并达到足够锅温，再形成褐变香气。"
            : "先选择适合食材的加热方式、温度和时长，再点火观察变化。",
      actionLabel: "打开火候控制",
      targetTab: "heat",
      station: "pan",
      alternatives: ["先少量加油", "检查表面是否过湿"],
      caution,
      tone: "neutral",
    };
  } else if (!hasSeasoning) {
    recommendation = {
      id: "recommend-season",
      title: "少量调味并继续尝味",
      reason:
        goal === "more-umami"
          ? "少量生抽或鲜味调料能补足咸鲜，但要把其中的盐一并计算。"
          : goal === "less-fishy"
            ? "酒姜和少量酸更适合帮助调整气味，不宜用大量调料遮盖。"
            : "从少量盐或基础咸味开始，再根据酸甜和鲜味逐次补充。",
      actionLabel: "打开调味面板",
      targetTab: "season",
      station: "pan",
      alternatives: ["先尝味再补盐", "用醋或糖调整平衡"],
      caution,
      tone: caution ? "warning" : "neutral",
    };
  } else {
    recommendation = {
      id: "recommend-review",
      title: hasSavedResult ? "建立另一个试验锅" : "保存当前结果",
      reason: hasSavedResult
        ? "只有保存两个可比较结果，才能确认同一变量的作用。"
        : "保存当前状态和操作历史，刷新后仍可回看。",
      actionLabel: hasSavedResult ? "复制为 2 号试验锅" : "查看保存区域",
      targetTab: "save",
      alternatives: ["继续微调后保存", "打开因果时间线复盘"],
      caution,
      tone: "good",
    };
  }

  return { steps, currentPhase, recommendation };
}
