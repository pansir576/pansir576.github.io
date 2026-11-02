"use client";
/* eslint-disable @next/next/no-img-element -- the fixed 2D kitchen uses transparent PNG assets */
/* eslint-disable react-hooks/set-state-in-effect -- browser-only voice preference is hydrated after mount */

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Flame,
  RotateCcw,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import iconManifest from "../../../assets/story-kitchen/icon_manifest.json";
import {
  loadRecipeVoiceEnabled,
  saveRecipeVoiceEnabled,
  speakRecipeText,
  stopRecipeSpeech,
} from "@/lib/recipe-speech";
import type { RecipeDefinition } from "@/lib/recipe-types";
import {
  getStoryDishSpec,
} from "@/lib/story-dish-data";
import { StoryDishArtwork } from "./story-dish-artwork";
import shared from "./tomato-egg-prototype.module.css";
import styles from "./generic-recipe-prototype.module.css";

interface StoryRenderObject {
  assetId: string;
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

interface StoryStepData {
  stepId: number;
  hotspot: string;
  description: string;
  knowledge: string;
  correctText: string;
  object: {
    label: string;
    action: string;
    prompt: string;
  };
  renderObjects: StoryRenderObject[];
}

interface StoryRecipeData {
  id: number;
  name: string;
  category: string;
  summary: string;
  steps: StoryStepData[];
}

interface GenericRecipePrototypeProps {
  recipe: RecipeDefinition;
  storyRecipe: StoryRecipeData;
}

const HOTSPOT_LABELS: Record<string, string> = {
  fridge: "冰箱",
  sink: "清洗池",
  cutting_board: "砧板区",
  stove: "灶台",
  seasoning: "调料架",
  plate: "装盘区",
};

const TOOL_LABELS: Record<string, string> = {
  bowl: "备料碗",
  cutting_board: "砧板",
  knife: "菜刀",
  plate: "成品盘",
  spatula: "锅铲",
  whisk: "打蛋器",
  wok: "炒锅",
};

const TOOL_IDS = new Set(iconManifest.tools.map((tool) => tool.id));

function storyObjectAsset(assetId: string) {
  const directory = TOOL_IDS.has(assetId) ? "tools" : "ingredients";
  const prefix = TOOL_IDS.has(assetId) ? "tool" : "ingredient";
  return `/2d/story-kitchen/${directory}/${prefix}_${assetId}_normal.png`;
}

export function GenericRecipePrototype({
  recipe,
  storyRecipe,
}: GenericRecipePrototypeProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [finished, setFinished] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [selectedChoices, setSelectedChoices] = useState<
    Record<string, string>
  >({});
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const step = storyRecipe.steps[stepIndex];
  const recipeStep = recipe.steps[stepIndex];
  const visibleObjects =
    step?.renderObjects.filter((object) => object.visible) ?? [];
  const primaryObject = visibleObjects[0];
  const score = Math.max(55, 100 - attempts * 12);
  const stars = score >= 84 ? 3 : score >= 68 ? 2 : 1;
  const isDejected = finished && score < 70;
  const dishSpec = getStoryDishSpec(recipe.id);
  const ingredientLabels = new Map(
    recipe.ingredients.flatMap((ingredient) =>
      ingredient.ingredientId
        ? [[ingredient.ingredientId, ingredient.name] as const]
        : [],
    ),
  );

  function objectLabel(assetId: string) {
    return ingredientLabels.get(assetId) ?? TOOL_LABELS[assetId] ?? assetId;
  }

  const selectedRiskCount = useMemo(() => {
    let total = 0;
    for (const group of recipeStep?.variableGroups ?? []) {
      const selectedId =
        selectedChoices[`${stepIndex}:${group.id}`] ?? group.defaultOptionId;
      const selected = group.options.find((option) => option.id === selectedId);
      if (selected && selected.risk !== "none") total += 1;
    }
    return total;
  }, [recipeStep, selectedChoices, stepIndex]);

  useEffect(() => {
    setVoiceEnabled(loadRecipeVoiceEnabled());
  }, []);

  useEffect(() => {
    if (!voiceEnabled || finished || !step) return;
    speakRecipeText(`${step.description}。${step.knowledge}`, {
      rate: 1.02,
      pitch: 1.08,
    });
  }, [finished, step, stepIndex, voiceEnabled]);

  useEffect(() => stopRecipeSpeech, []);

  function completeStep() {
    if (stepDone || !step) return;
    setStepDone(true);
    if (selectedRiskCount > 0) {
      setAttempts((value) => value + selectedRiskCount);
    }
    if (voiceEnabled) {
      speakRecipeText(step.correctText || "这一步完成了。", {
        rate: 1.02,
        pitch: 1.09,
      });
    }
  }

  function advance() {
    if (!stepDone) return;
    if (stepIndex >= storyRecipe.steps.length - 1) {
      setFinished(true);
      return;
    }
    setStepIndex((value) => value + 1);
    setStepDone(false);
  }

  function reset() {
    setStepIndex(0);
    setStepDone(false);
    setFinished(false);
    setAttempts(0);
    setSelectedChoices({});
    stopRecipeSpeech();
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    saveRecipeVoiceEnabled(next);
    if (!next) stopRecipeSpeech();
    else if (step) {
      speakRecipeText(`${step.description}。${step.knowledge}`, {
        rate: 1.02,
        pitch: 1.08,
      });
    }
  }

  const promptStyle = primaryObject
    ? ({
        left: `${primaryObject.x * 100}%`,
        top: `${Math.max(9, primaryObject.y * 100 - 11)}%`,
      } as CSSProperties)
    : undefined;
  const haloStyle = primaryObject
    ? ({
        left: `${primaryObject.x * 100}%`,
        top: `${primaryObject.y * 100}%`,
        width: `${Math.max(19, Math.min(34, primaryObject.scale * 145))}%`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={shared.page}
      data-generic-recipe-id={recipe.id}
      data-generic-step={finished ? "finished" : stepIndex + 1}
      data-generic-finished={finished ? "true" : "false"}
    >
      <header className={shared.hero}>
        <div>
          <Link href="/cook/story/" className={shared.backLink}>
            <ArrowLeft size={16} />
            返回菜谱选择
          </Link>
          <span className={shared.eyebrow}>
            XIAMI STORY KITCHEN · {recipe.category}
          </span>
          <h1>
            {recipe.name}：跟夏弥做一遍
          </h1>
          <p>
            {recipe.summary}。点击场景中的食材和锅具完成当前步骤，观察每一步的颜色、质地和受热变化。
          </p>
        </div>
        <div className={shared.prototypeBadge}>
          <Sparkles size={18} />
          <span>
            {storyRecipe.steps.length} 步可玩流程
            <small>{dishSpec.form === "soup" ? "汤碗成品" : "成品装盘"}</small>
          </span>
        </div>
      </header>

      <div className={shared.phaseRail} aria-label="当前烹饪阶段">
        {storyRecipe.steps.map((item, index) => (
          <span
            key={item.stepId}
            className={
              finished || index < stepIndex
                ? shared.phaseDone
                : index === stepIndex
                  ? shared.phaseCurrent
                  : ""
            }
          >
            <i>
              {finished || index < stepIndex ? (
                <Check size={12} />
              ) : (
                index + 1
              )}
            </i>
            {item.object.label}
          </span>
        ))}
      </div>

      <div className={shared.gameLayout}>
        <section className={shared.stageColumn}>
          <div className={shared.stageFrame}>
            <div className={shared.stageTopline}>
              <span className={shared.mission}>
                <Sparkles size={16} />
                {finished
                  ? `${recipe.name}已经完成并装盘`
                  : `${HOTSPOT_LABELS[step.hotspot] ?? step.hotspot} · ${step.object.action}`}
              </span>
              <span className={shared.cookStatus} data-cook-state={stepDone ? "ready" : "raw"}>
                {finished ? "已装盘" : stepDone ? "本步完成" : `步骤 ${stepIndex + 1}`}
              </span>
            </div>

            <div className={shared.kitchenCanvas}>
              <div
                className={shared.kitchenBackground}
                data-kitchen-background
                aria-hidden="true"
              />
              <div className={shared.sceneVignette} aria-hidden="true" />

              {!finished && (
                <>
                  <div
                    className={styles.targetHalo}
                    style={haloStyle}
                    aria-hidden="true"
                  />
                  {visibleObjects.map((object, index) => (
                    <button
                      type="button"
                      key={object.assetId}
                      className={`${styles.sceneObject} ${
                        index === 0 ? styles.primaryObject : ""
                      }`}
                      style={{
                        left: `${object.x * 100}%`,
                        top: `${object.y * 100}%`,
                        width: `${object.scale * 100}%`,
                      }}
                      data-generic-object={object.assetId}
                      aria-label={step.object.prompt}
                      onClick={completeStep}
                    >
                      <img
                        src={storyObjectAsset(object.assetId)}
                        alt=""
                        draggable={false}
                      />
                    </button>
                  ))}
                  <span
                    className={styles.objectPrompt}
                    style={promptStyle}
                    data-generic-object-prompt
                  >
                    <strong>{step.object.label}</strong>
                    <span>{step.object.action}</span>
                  </span>
                  {stepDone && (
                    <span className={styles.stepSuccess} role="status">
                      <Check size={15} />
                      {step.correctText}
                    </span>
                  )}
                </>
              )}

              {finished && (
                <div className={shared.resultScene} data-generic-result>
                  <span className={styles.resultGlow} aria-hidden="true" />
                  <div className={shared.resultPlate}>
                    <span className={styles.resultDish}>
                      <StoryDishArtwork recipeId={recipe.id} name={recipe.name} />
                    </span>
                  </div>
                  <div className={shared.resultCopy}>
                    <span>成品出锅 · {recipe.category}</span>
                    <h2>{recipe.name}完成</h2>
                    <div
                      className={shared.resultStars}
                      aria-label={`${stars} 星评价`}
                    >
                      {[1, 2, 3].map((value) => (
                        <Star
                          key={value}
                          size={26}
                          fill={value <= stars ? "currentColor" : "none"}
                        />
                      ))}
                      <strong>{score}</strong>
                      <small>/ 100</small>
                    </div>
                    <p>
                      按步骤完成了切配、受热和调味。成品盘使用当前菜的主辅料组合呈现，可继续回看每一步的火候与原理。
                    </p>
                  </div>
                </div>
              )}

              {!finished && (
                <div className={shared.stageNotice} aria-live="polite">
                  {stepDone
                    ? "本步已完成，点击右侧进入下一步。"
                    : `点击场景中的${step.object.label}，完成“${step.object.action}”。`}
                </div>
              )}
            </div>

            {!finished && (
              <div className={shared.inventory}>
                <div>
                  <span className={shared.inventoryLabel}>本步材料</span>
                  <p>{step.object.prompt}</p>
                </div>
                <div className={shared.inventoryItems}>
                  {visibleObjects.slice(0, 4).map((object) => (
                    <button
                      type="button"
                      key={object.assetId}
                      className={`${shared.ingredientCard} ${styles.inventoryCard}`}
                      data-generic-object={object.assetId}
                      onClick={completeStep}
                    >
                      <img
                        src={storyObjectAsset(object.assetId)}
                        alt={objectLabel(object.assetId)}
                        draggable={false}
                      />
                      <span>{objectLabel(object.assetId)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className={shared.sideColumn}>
          <section className={shared.characterPanel}>
            <div className={shared.characterBackdrop} aria-hidden="true" />
            <div
              className={shared.characterPortrait}
              data-character-mood={isDejected ? "dejected" : "normal"}
            >
              <img
                className={`${shared.character} ${
                  isDejected ? shared.dejectedCharacter : ""
                }`}
                src="/2d/character/normal_xiami_02.png"
                alt="夏弥"
                draggable={false}
              />
              {isDejected && (
                <div className={shared.dejectedAction}>
                  <img
                    className={shared.dejectedFace}
                    src="/2d/character/normal_xiami_02.png"
                    alt=""
                    draggable={false}
                  />
                  <span className={shared.dejectedDesk} aria-hidden="true" />
                  <span className={shared.dejectedSighPuffs} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className={shared.dejectedSighText}>唉……</span>
                </div>
              )}
            </div>
            <div className={shared.dialogue}>
              <div className={shared.speaker}>
                <strong>夏弥</strong>
                <span>{finished ? "复盘" : `第 ${stepIndex + 1} 步`}</span>
                <div className={shared.voiceControls}>
                  <button
                    type="button"
                    aria-label={voiceEnabled ? "关闭语音讲解" : "开启语音讲解"}
                    aria-pressed={voiceEnabled}
                    onClick={toggleVoice}
                  >
                    {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    {voiceEnabled ? "语音开" : "语音关"}
                  </button>
                </div>
              </div>
              <p aria-live="polite">
                {isDejected
                  ? "赏……个脸呗……把菜做好。"
                  : finished
                    ? "这次流程完成了。成品已经装盘，来看看哪一步最影响味道和口感。"
                    : `${step.description}。${step.knowledge}`}
              </p>
            </div>
          </section>

          <section className={shared.controlPanel}>
            {!finished && (
              <>
                <div className={shared.panelHeading}>
                  <span>
                    步骤 {stepIndex + 1} · {step.object.label}
                  </span>
                  <h2>{recipeStep?.title ?? step.object.action}</h2>
                </div>
                <p className={styles.instruction}>{step.description}</p>
                <div className={styles.knowledge}>
                  <Sparkles size={15} />
                  <span>{step.knowledge}</span>
                </div>
                {recipeStep?.variableGroups.map((group) => {
                  const selected =
                    selectedChoices[`${stepIndex}:${group.id}`] ??
                    group.defaultOptionId;
                  return (
                    <div className={styles.choiceGroup} key={group.id}>
                      <span>{group.label}</span>
                      <div>
                        {group.options.map((option) => (
                          <button
                            type="button"
                            key={option.id}
                            data-generic-choice={option.id}
                            aria-pressed={selected === option.id}
                            className={
                              selected === option.id ? styles.choiceSelected : ""
                            }
                            onClick={() =>
                              setSelectedChoices((current) => ({
                                ...current,
                                [`${stepIndex}:${group.id}`]: option.id,
                              }))
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className={shared.primaryAction}
                  data-generic-complete-step
                  onClick={stepDone ? advance : completeStep}
                >
                  {stepDone ? (
                    <>
                      {stepIndex === storyRecipe.steps.length - 1
                        ? "查看成品"
                        : "下一步"}
                      <Flame size={17} />
                    </>
                  ) : (
                    <>
                      <Check size={17} />
                      确认操作
                    </>
                  )}
                </button>
              </>
            )}

            {finished && (
              <>
                <div className={shared.panelHeading}>
                  <span>本菜复盘</span>
                  <h2>{recipe.name}完成</h2>
                </div>
                <div className={styles.resultPlateBadge}>
                  <StoryDishArtwork
                    recipeId={recipe.id}
                    name={recipe.name}
                    compact
                  />
                  <span>
                    <small>成品盘</small>
                    <strong>{recipe.name}已经装盘</strong>
                  </span>
                </div>
                <div className={styles.metrics}>
                  {[
                    ["完成度", score],
                    ["步骤", 100],
                    ["操作", Math.max(50, 100 - attempts * 10)],
                  ].map(([label, value]) => (
                    <span key={label}>
                      <b>{label}</b>
                      <i>
                        <em style={{ width: `${value}%` }} />
                      </i>
                      <strong>{value}</strong>
                    </span>
                  ))}
                </div>
                <div className={shared.resultActions}>
                  <button type="button" onClick={reset}>
                    <RotateCcw size={16} />
                    再做一次
                  </button>
                  <Link href="/cook/story/">返回剧场</Link>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
