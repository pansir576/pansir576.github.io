"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  CookingPot,
  Flame,
  Gauge,
  MessageCircle,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  ThermometerSun,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import recipeData from "@/lib/recipe-data.json";
import {
  applyRecipeChoice,
  clearRecipeSession,
  createRecipeSession,
  currentRecipeStep,
  evaluateRecipeResult,
  evaluateRecipeStep,
  goToRecipeStep,
  isRecipeComplete,
  loadRecipeSession,
  previousRecipeStep,
  returnToRecipeProgress,
  saveRecipeSession,
  selectedOption,
  submitRecipeStep,
} from "@/lib/recipe-engine";
import {
  askRecipeGuide,
  RECIPE_GUIDE_QUESTION_LIMIT,
} from "@/lib/recipe-guide";
import {
  loadRecipeVoiceEnabled,
  saveRecipeVoiceEnabled,
  speakRecipeText,
  stopRecipeSpeech,
} from "@/lib/recipe-speech";
import type {
  RecipeCategory,
  RecipeDefinition,
  RecipeGuideResponse,
  RecipeSession,
  RecipeVariableGroup,
} from "@/lib/recipe-types";
import styles from "./recipe-kitchen.module.css";

const recipes = recipeData as RecipeDefinition[];
const categories: ("全部" | RecipeCategory)[] = [
  "全部",
  "素菜",
  "畜肉",
  "禽肉",
  "水产",
  "豆制品",
  "汤羹",
  "主食",
];

function metricTone(value: number) {
  if (value >= 72) return styles.metricGood;
  if (value >= 48) return styles.metricMedium;
  return styles.metricLow;
}

function ChoiceGroup({
  group,
  selectedId,
  onChange,
  disabled,
}: {
  group: RecipeVariableGroup;
  selectedId: string;
  onChange: (optionId: string) => void;
  disabled?: boolean;
}) {
  return (
    <section className={styles.choiceGroup}>
      <div className={styles.choiceHeading}>
        <span>{group.label}</span>
        <small>可与其他变量组合</small>
      </div>
      <div className={styles.choiceOptions}>
        {group.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={
              selectedId === option.id
                ? `${styles.choiceOption} ${styles.choiceSelected}`
                : styles.choiceOption
            }
            aria-pressed={selectedId === option.id}
            data-risk={option.risk}
            disabled={disabled}
            onClick={() => onChange(option.id)}
          >
            <span>{option.label}</span>
            {option.risk !== "none" && (
              <small>{option.risk === "safety" ? "风险" : "偏差"}</small>
            )}
            {selectedId === option.id && <Check size={14} />}
          </button>
        ))}
      </div>
    </section>
  );
}

export function RecipeKitchen() {
  const [category, setCategory] = useState<"全部" | RecipeCategory>("全部");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [session, setSession] = useState<RecipeSession | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [blockedStep, setBlockedStep] = useState<number | null>(null);
  const [coachQuestion, setCoachQuestion] = useState("");
  const [coachResponse, setCoachResponse] = useState<RecipeGuideResponse | null>(
    null,
  );
  const [coachLoading, setCoachLoading] = useState(false);

  const filteredRecipes = useMemo(
    () =>
      category === "全部"
        ? recipes
        : recipes.filter((recipe) => recipe.category === category),
    [category],
  );
  const recipe = recipes.find((item) => item.id === selectedId) ?? null;
  const step = recipe && session ? currentRecipeStep(session, recipe) : null;
  const complete = recipe && session
    ? isRecipeComplete(session, recipe)
    : false;
  const result = recipe && session && complete
    ? evaluateRecipeResult(recipe, session)
    : null;
  const progress = recipe && session
    ? Math.round((session.completedSteps.length / recipe.steps.length) * 100)
    : 0;
  const mainIngredient = recipe?.ingredients.find(
    (ingredient) => ingredient.role === "main",
  );
  const stepEvaluation =
    recipe && session && step
      ? evaluateRecipeStep(session, recipe)
      : null;
  const isReviewing =
    recipe && session ? session.completedSteps.includes(session.stepIndex) : false;
  const stepWarningText = stepEvaluation?.warnings.join("；") ?? "";
  const isBlocked = Boolean(
    stepEvaluation?.status === "safety" && blockedStep === session?.stepIndex,
  );

  useEffect(() => {
    setVoiceEnabled(loadRecipeVoiceEnabled());
    const saved = loadRecipeSession();
    if (!saved) return;
    const savedRecipe = recipes.find((item) => item.id === saved.recipeId);
    if (!savedRecipe) return;
    const safeStepIndex = Math.min(saved.stepIndex, savedRecipe.steps.length);
    setSession({ ...saved, stepIndex: safeStepIndex });
    setSelectedId(saved.recipeId);
    setLibraryOpen(false);
  }, []);

  useEffect(() => {
    if (session) saveRecipeSession(session);
  }, [session]);

  useEffect(() => {
    if (!voiceEnabled || !step || complete) {
      stopRecipeSpeech();
      return;
    }
    speakRecipeText(
      [
        `当前步骤，${step.title}。${step.description}`,
        stepWarningText ? `注意：${stepWarningText}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    return stopRecipeSpeech;
  }, [
    complete,
    recipe?.id,
    session?.stepIndex,
    step,
    stepWarningText,
    voiceEnabled,
  ]);

  function startRecipe(nextRecipe: RecipeDefinition) {
    setSelectedId(nextRecipe.id);
    setSession(createRecipeSession(nextRecipe));
    setLibraryOpen(false);
    setBlockedStep(null);
    setCoachQuestion("");
    setCoachResponse(null);
  }

  function resetRecipe() {
    clearRecipeSession();
    setBlockedStep(null);
    setCoachQuestion("");
    setCoachResponse(null);
    if (recipe) {
      setSession(createRecipeSession(recipe));
      return;
    }
    setSession(null);
    setSelectedId(null);
  }

  function updateChoice(
    group: RecipeVariableGroup,
    optionId: string,
  ) {
    setSession((currentSession) =>
      currentSession
        ? applyRecipeChoice(currentSession, group, optionId)
        : currentSession,
    );
    setBlockedStep(null);
    setCoachResponse(null);
  }

  function submitCurrentStep() {
    if (!recipe || !session) return;
    const submission = submitRecipeStep(session, recipe);
    setSession(submission.session);
    if (!submission.advanced && !submission.evaluation.canAdvance) {
      setBlockedStep(session.stepIndex);
    } else if (submission.advanced) {
      setBlockedStep(null);
      setCoachQuestion("");
      setCoachResponse(null);
    }
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    saveRecipeVoiceEnabled(next);
    if (!next) stopRecipeSpeech();
  }

  async function askCoach(question = coachQuestion) {
    if (!recipe || !session || coachLoading) return;
    const trimmed = question.trim();
    if (!trimmed) return;
    setCoachLoading(true);
    try {
      const response = await askRecipeGuide(recipe, session, trimmed);
      setCoachResponse(response);
      if (voiceEnabled) speakRecipeText(response.answer);
    } finally {
      setCoachLoading(false);
    }
  }

  function viewStep(stepIndex: number) {
    if (!recipe || !session) return;
    setSession(goToRecipeStep(session, stepIndex, recipe));
    setBlockedStep(null);
    setCoachResponse(null);
  }

  function returnToProgress() {
    if (!recipe || !session) return;
    setSession(returnToRecipeProgress(session, recipe));
    setBlockedStep(null);
    setCoachResponse(null);
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div>
            <span className={styles.eyebrow}>
              <Sparkles size={14} />
              标准化菜谱 · 可控变量 · AI 纠错
            </span>
            <h1>不背整段教程，按步骤学会一道菜。</h1>
            <p>
              25 道家常菜固定操作主线；在盐量、酸味、糖、火候和下料时机中自由组合，观察每一步怎样改变结果。
            </p>
          </div>
          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.voiceLink}
              aria-pressed={voiceEnabled}
              data-recipe-voice
              onClick={toggleVoice}
            >
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {voiceEnabled ? "语音讲解已开启" : "开启语音讲解"}
            </button>
            <Link
              href={`/cook/story/?recipe=${recipe?.id ?? 1}`}
              className={styles.demoLink}
            >
              <CookingPot size={16} />
              进入烹语剧场
            </Link>
            <Link href="/cook/classic/" className={styles.classicLink}>
              2.5D 经典厨房
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className={styles.heroStats}>
          <span><strong>{recipes.length || 25}</strong> 道标准菜谱</span>
          <span><strong>55</strong> 种食材库</span>
          <span><strong>7</strong> 类可控变量</span>
          <span><strong>0</strong> 个强制闯关</span>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside
          className={
            libraryOpen
              ? `${styles.library} ${styles.libraryOpen}`
              : styles.library
          }
        >
          <div className={styles.libraryHeader}>
            <div>
              <span>RECIPE LIBRARY</span>
              <h2>选择菜谱</h2>
            </div>
            <button
              type="button"
              className={styles.libraryToggle}
              onClick={() => setLibraryOpen((value) => !value)}
              aria-expanded={libraryOpen}
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <div className={styles.categories}>
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? styles.categoryActive : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className={styles.recipeList}>
            {filteredRecipes.map((item) => (
              <button
                type="button"
                key={item.id}
                className={
                  selectedId === item.id
                    ? `${styles.recipeCard} ${styles.recipeCardActive}`
                    : styles.recipeCard
                }
                data-recipe-id={item.id}
                onClick={() => startRecipe(item)}
              >
                <span className={styles.recipeNumber}>
                  {String(item.id).padStart(2, "0")}
                </span>
                <div>
                  <span>{item.category}</span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.ingredients
                      .filter((ingredient) => ingredient.role !== "seasoning")
                      .map((ingredient) => ingredient.name)
                      .slice(0, 4)
                      .join(" · ")}
                  </small>
                </div>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </aside>

        <section
          className={styles.training}
          data-recipe-id={recipe?.id ?? ""}
          data-recipe-step={session?.stepIndex ?? ""}
          data-recipe-complete={complete ? "true" : "false"}
        >
          {!recipe || !session ? (
            <div className={styles.emptyState}>
              <UtensilsCrossed size={38} />
              <span>从左侧选择一道菜</span>
              <h2>每一步只展示现在该做的事。</h2>
              <p>
                菜谱会先给出标准操作，再让你决定盐量、醋的时机、糖量和火候。完成所有步骤后查看结果与原理复盘。
              </p>
            </div>
          ) : (
            <>
              <header className={styles.recipeHeader}>
                <div>
                  <span>{recipe.category} · 菜谱 {String(recipe.id).padStart(2, "0")}</span>
                  <h2>{recipe.name}</h2>
                  <p>{recipe.summary}</p>
                </div>
                <div className={styles.recipeHeaderActions}>
                  <span className={styles.progressBadge}>{progress}%</span>
                  <button type="button" onClick={resetRecipe}>
                    <RotateCcw size={15} />
                    重新开始
                  </button>
                </div>
              </header>

              <div className={styles.stepRail}>
                {recipe.steps.map((item, index) => {
                  const completed = session.completedSteps.includes(index);
                  const active = !complete && session.stepIndex === index;
                  return (
                    <button
                      type="button"
                      key={item.stepId}
                      className={`${styles.stepPill} ${
                        completed
                          ? styles.stepCompleted
                          : active
                            ? styles.stepActive
                            : ""
                      }`}
                      data-step-index={index}
                      disabled={!completed && !active}
                      onClick={() => viewStep(index)}
                    >
                      <span>{completed ? <Check size={12} /> : index + 1}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.actionLabel}</small>
                      </div>
                    </button>
                  );
                })}
              </div>

              {complete && result ? (
                <div className={styles.resultLayout}>
                  <article className={styles.resultCard}>
                    <span className={styles.eyebrow}>
                      <Flame size={14} />
                      TRAINING RECAP
                    </span>
                    <h2>{result.verdict}</h2>
                    <p>{result.summary}</p>
                    <section
                      className={styles.resultHistory}
                      data-recipe-history
                    >
                      <div>
                        <strong>操作路径</strong>
                        <span>
                          {session.completedSteps.length} 步完成 ·{" "}
                          {result.corrections} 次安全纠错
                        </span>
                      </div>
                      <div className={styles.historyPills}>
                        {recipe.steps.map((item, index) => {
                          const record = session.stepRecords.find(
                            (entry) => entry.stepId === item.stepId,
                          );
                          return (
                            <span
                              key={item.stepId}
                              data-status={record?.status ?? "pending"}
                            >
                              {index + 1}. {item.title}
                              {record?.status === "adjusted" ? " · 偏差" : ""}
                            </span>
                          );
                        })}
                      </div>
                    </section>
                    <div className={styles.metricGrid}>
                      {[
                        ["味觉平衡", result.metrics.flavor],
                        ["口感", result.metrics.texture],
                        ["颜色", result.metrics.color],
                        ["香气", result.metrics.aroma],
                        ["水分", result.metrics.water],
                        ["安全", result.metrics.safety],
                      ].map(([label, value]) => (
                        <div key={String(label)} className={metricTone(Number(value))}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                          <i><b style={{ width: `${value}%` }} /></i>
                        </div>
                      ))}
                    </div>
                    <section className={styles.resultNotes}>
                      <h3>这次做对了什么</h3>
                      <ul>
                        {result.highlights.length ? (
                          result.highlights.map((item) => <li key={item}>{item}</li>)
                        ) : (
                          <li>按顺序完成了菜谱要求的加热与处理步骤。</li>
                        )}
                      </ul>
                    </section>
                    {result.warnings.length > 0 && (
                      <section className={styles.resultWarnings}>
                        <h3>还可以调整</h3>
                        <ul>
                          {result.warnings.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </section>
                    )}
                    <aside className={styles.safetyCard}>
                      <CircleAlert size={16} />
                      <span>{result.safety}</span>
                    </aside>
                    <section className={styles.resultAi}>
                      <div>
                        <Bot size={17} />
                        <span>
                          <strong>AI 复盘点评（可选）</strong>
                          <small>本地评分已经完成，不等待 AI。</small>
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={coachLoading}
                        onClick={() =>
                          askCoach(
                            `请总结${recipe.name}本次实训最值得保留的操作、最需要调整的变量，以及一条可迁移到其他菜品的判断。`,
                          )
                        }
                      >
                        {coachLoading ? "分析中…" : "生成复盘建议"}
                      </button>
                      {coachResponse && (
                        <div className={styles.coachAnswer}>
                          <span>
                            {coachResponse.provider === "llm"
                              ? "DeepSeek"
                              : "本地知识库"}
                          </span>
                          <p>{coachResponse.answer}</p>
                          <button
                            type="button"
                            onClick={() => speakRecipeText(coachResponse.answer)}
                          >
                            <Volume2 size={14} />
                            朗读点评
                          </button>
                        </div>
                      )}
                    </section>
                  </article>
                  <div className={styles.finishedPlate}>
                    <div className={styles.plateRing} />
                    <span>{mainIngredient?.name ?? recipe.name}</span>
                    <strong>{recipe.name}</strong>
                    <small>模拟成品 · 教学近似</small>
                  </div>
                </div>
              ) : (
                <div className={styles.trainingGrid} data-step-id={step?.stepId}>
                  <section className={styles.scene}>
                    <div className={styles.sceneGlow} />
                    <div className={styles.sceneHeader}>
                      <span>2D 实训台</span>
                      <small>步骤 {session.stepIndex + 1} / {recipe.steps.length}</small>
                    </div>
                    <div className={styles.ingredientStrip}>
                      {recipe.ingredients.map((ingredient) => (
                        <span
                          key={`${ingredient.role}-${ingredient.name}`}
                          data-role={ingredient.role}
                        >
                          {ingredient.name}
                        </span>
                      ))}
                    </div>
                    <div className={styles.counter}>
                      <div className={styles.board}>
                        <CookingPot size={42} />
                        <strong>{step?.title}</strong>
                        <small>{step?.actionLabel}</small>
                      </div>
                      <div className={styles.pan}>
                        <i />
                        <b />
                        <span>{mainIngredient?.name ?? "食材"}</span>
                      </div>
                    </div>
                    <div className={styles.sceneCaption}>
                      <ThermometerSun size={16} />
                      <span>火候、时间和调味会实时改变右侧结果预估。</span>
                    </div>
                  </section>

                  <section className={styles.controlPanel}>
                    <div className={styles.stepCounter}>
                      <span>STEP {String(step?.stepId).padStart(2, "0")}</span>
                      <strong>{step?.title}</strong>
                    </div>
                    <p className={styles.stepDescription}>{step?.description}</p>
                    <div className={styles.knowledgeCard}>
                      <Sparkles size={16} />
                      <div>
                        <strong>这里发生了什么</strong>
                        <p>{step?.knowledge}</p>
                      </div>
                    </div>
                    <div className={styles.warningCard}>
                      <CircleAlert size={16} />
                      <div>
                        <strong>常见错误</strong>
                        <p>{step?.aiWarning}</p>
                      </div>
                    </div>

                    <div className={styles.variables}>
                      {step?.variableGroups.map((group) => {
                        const current = selectedOption(session, group);
                        return (
                          <ChoiceGroup
                            key={group.id}
                            group={group}
                            selectedId={current.id}
                            disabled={isReviewing}
                            onChange={(optionId) =>
                              updateChoice(group, optionId)
                            }
                          />
                        );
                      })}
                    </div>

                    <section
                      className={`${styles.stepFeedback} ${
                        stepEvaluation?.status === "safety"
                          ? styles.feedbackSafety
                          : stepEvaluation?.status === "quality"
                            ? styles.feedbackQuality
                            : styles.feedbackStandard
                      }`}
                      data-recipe-step-status={stepEvaluation?.status}
                      data-recipe-blocked={isBlocked ? "true" : "false"}
                      role={isBlocked ? "alert" : "status"}
                    >
                      {stepEvaluation?.status === "safety" ? (
                        <ShieldAlert size={17} />
                      ) : stepEvaluation?.status === "quality" ? (
                        <CircleAlert size={17} />
                      ) : (
                        <Check size={17} />
                      )}
                      <div>
                        <strong>
                          {isBlocked
                            ? "已阻止进入下一步"
                            : stepEvaluation?.status === "safety"
                              ? "当前选择有食品安全风险"
                              : stepEvaluation?.status === "quality"
                                ? "可接受偏差，允许试做"
                                : "当前为标准操作"}
                        </strong>
                        <p>
                          {stepEvaluation?.warnings[0] ??
                            "默认变量符合这道菜的标准流程。"}
                        </p>
                        {stepEvaluation?.suggestions.length ? (
                          <small>
                            {stepEvaluation.suggestions.join("；")}
                          </small>
                        ) : null}
                      </div>
                    </section>

                    <div className={styles.liveMetrics}>
                      <div className={styles.liveMetricsTitle}>
                        <span><Gauge size={15} /> 当前结果预估</span>
                        <small>随变量即时更新</small>
                      </div>
                      <div className={styles.metricGrid}>
                        {[
                          ["味觉", evaluateRecipeResult(recipe, session).metrics.flavor],
                          ["口感", evaluateRecipeResult(recipe, session).metrics.texture],
                          ["香气", evaluateRecipeResult(recipe, session).metrics.aroma],
                          ["安全", evaluateRecipeResult(recipe, session).metrics.safety],
                        ].map(([label, value]) => (
                          <div key={String(label)} className={metricTone(Number(value))}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                            <i><b style={{ width: `${value}%` }} /></i>
                          </div>
                        ))}
                      </div>
                    </div>

                    <section className={styles.coachPanel} data-recipe-coach>
                      <div className={styles.coachHeading}>
                        <span>
                          <Bot size={16} />
                          问菜谱教练
                        </span>
                        <button
                          type="button"
                          aria-pressed={voiceEnabled}
                          onClick={toggleVoice}
                        >
                          {voiceEnabled ? (
                            <Volume2 size={14} />
                          ) : (
                            <VolumeX size={14} />
                          )}
                          {voiceEnabled ? "语音开" : "语音关"}
                        </button>
                      </div>
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void askCoach();
                        }}
                      >
                        <input
                          type="text"
                          value={coachQuestion}
                          maxLength={RECIPE_GUIDE_QUESTION_LIMIT}
                          placeholder="例如：为什么这里要及时下醋？"
                          aria-label="向菜谱教练提问"
                          onChange={(event) =>
                            setCoachQuestion(event.target.value)
                          }
                        />
                        <button
                          type="submit"
                          aria-label="发送问题"
                          disabled={
                            coachLoading || !coachQuestion.trim()
                          }
                        >
                          <Send size={15} />
                        </button>
                      </form>
                      {coachLoading && (
                        <p className={styles.coachLoading}>
                          <MessageCircle size={14} />
                          正在结合当前步骤分析…
                        </p>
                      )}
                      {coachResponse && (
                        <div className={styles.coachAnswer}>
                          <span>
                            {coachResponse.provider === "llm"
                              ? "DeepSeek"
                              : "本地知识库"}
                          </span>
                          <p>{coachResponse.answer}</p>
                          <button
                            type="button"
                            onClick={() => speakRecipeText(coachResponse.answer)}
                          >
                            <Volume2 size={14} />
                            朗读回答
                          </button>
                        </div>
                      )}
                    </section>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.backButton}
                        disabled={
                          !isReviewing &&
                          (session.stepIndex === 0 || coachLoading)
                        }
                        onClick={
                          isReviewing
                            ? returnToProgress
                            : () => {
                                setSession(previousRecipeStep(session));
                                setBlockedStep(null);
                                setCoachResponse(null);
                              }
                        }
                      >
                        {isReviewing ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                        {isReviewing ? "返回当前进度" : "上一步"}
                      </button>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        data-recipe-next
                        disabled={isReviewing || coachLoading}
                        onClick={submitCurrentStep}
                      >
                        {isReviewing
                          ? "已完成，仅供查看"
                          : stepEvaluation?.status === "safety"
                            ? "检查风险并提交"
                            : session.stepIndex === recipe.steps.length - 1
                              ? "完成并查看复盘"
                              : "提交本步"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
