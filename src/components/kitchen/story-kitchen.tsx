"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flame,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import characterManifest from "../../../assets/character_manifest.json";
import hotspotData from "../../../assets/bg/kitchen_hotspots.json";
import iconManifest from "../../../assets/story-kitchen/icon_manifest.json";
import storyManifestData from "../../../assets/story_state_manifest.json";
import recipeData from "@/lib/recipe-data.json";
import {
  createRecipeSession,
  evaluateRecipeResult,
  submitRecipeStep,
} from "@/lib/recipe-engine";
import {
  loadRecipeVoiceEnabled,
  saveRecipeVoiceEnabled,
  speakRecipeText,
  stopRecipeSpeech,
} from "@/lib/recipe-speech";
import type {
  RecipeDefinition,
  RecipeSession,
} from "@/lib/recipe-types";
import { StoryDishArtwork } from "./story-dish-artwork";
import styles from "./story-kitchen.module.css";

type CharacterPhase =
  | "normal"
  | "correct"
  | "pre-error"
  | "transform-01"
  | "transform-02"
  | "transform-03"
  | "dragon";

interface QuestionOption {
  id: string;
  label: string;
}

interface StoryQuestion {
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
}

interface StoryObject {
  label: string;
  action: string;
  prompt: string;
}

interface StoryRenderObject {
  assetId: string;
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

interface RenderedStoryObject extends StoryRenderObject {
  transition: "entering" | "stable" | "leaving";
}

type StoryObjectState = "normal" | "click" | "success" | "error";

interface StoryStep {
  recipeId: number;
  stepId: number;
  hotspot: string;
  title: string;
  description: string;
  knowledge: string;
  actionLabel: string;
  correctText: string;
  errorOperation: string;
  errorPrinciple: string;
  object: StoryObject;
  renderObjects: StoryRenderObject[];
  question: StoryQuestion | null;
}

interface StoryRecipe {
  id: number;
  name: string;
  category: string;
  summary: string;
  steps: StoryStep[];
}

interface StoryManifest {
  recipes: StoryRecipe[];
}

interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  objectWidth: number;
  labelPlacement: "above" | "below" | "below-end";
}

interface StoryError {
  branchId: string;
  correctOperation: string;
  principle: string;
  characterText: string;
}

const STORY_SESSION_KEY = "simulating-cook:story-session:v1";
const recipes = recipeData as RecipeDefinition[];
const storyManifest = storyManifestData as StoryManifest;
const storyRecipes = new Map(storyManifest.recipes.map((item) => [item.id, item]));
const hotspots = hotspotData.hotspots as Hotspot[];
const independentAssets = new Map(
  [...iconManifest.ingredients, ...iconManifest.tools].map((item) => [
    item.id,
    item.states,
  ]),
);
const normalPortraits = [
  "normal_xiami_01.png",
  "normal_xiami_02.png",
  "normal_xiami_03.png",
  "normal_xiami_04.png",
];

function storyAssetPath(path: string) {
  return `/${path.replace(/^assets\//, "2d/")}`;
}

function recipePrototypePath(recipeId: number) {
  if (recipeId === 2) return "/cook/story/tomato-egg/";
  if (recipeId === 3) return "/cook/story/garlic-lettuce/";
  return `/cook/story/recipe/${recipeId}/`;
}

function independentAssetPath(
  assetId: string,
  state: StoryObjectState,
) {
  const states = independentAssets.get(assetId);
  const path = states?.[state];
  return path ? storyAssetPath(path) : "";
}

function characterPath(phase: CharacterPhase, normalIndex: number) {
  const transition = characterManifest.transition.find(
    (item) =>
      (phase === "pre-error" && item.file === "pre_error_xiami.png") ||
      (phase === "transform-01" && item.file === "transform_01.png") ||
      (phase === "transform-02" && item.file === "transform_02.png") ||
      (phase === "transform-03" && item.file === "transform_03.png"),
  );
  if (transition) return `/2d/character/${transition.file}`;
  if (phase === "correct") return "/2d/character/correct_xiami.png";
  if (phase === "dragon") return "/2d/character/yemengjiade.png";
  return `/2d/character/${normalPortraits[normalIndex % normalPortraits.length]}`;
}

function isRecipeSession(value: unknown): value is RecipeSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecipeSession>;
  return (
    candidate.version === 2 &&
    typeof candidate.recipeId === "number" &&
    typeof candidate.stepIndex === "number" &&
    Array.isArray(candidate.completedSteps) &&
    typeof candidate.selectedChoices === "object"
  );
}

function loadStorySession() {
  try {
    const raw = window.localStorage.getItem(STORY_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecipeSession(parsed)) return null;
    if (!recipes.some((recipe) => recipe.id === parsed.recipeId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStorySession(session: RecipeSession | null) {
  try {
    if (!session) {
      window.localStorage.removeItem(STORY_SESSION_KEY);
      return;
    }
    window.localStorage.setItem(STORY_SESSION_KEY, JSON.stringify(session));
  } catch {
    // The active story session still works when storage is unavailable.
  }
}

export function StoryKitchen() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [session, setSession] = useState<RecipeSession | null>(null);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [stepReady, setStepReady] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [characterPhase, setCharacterPhase] =
    useState<CharacterPhase>("normal");
  const [storyError, setStoryError] = useState<StoryError | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [renderedObjects, setRenderedObjects] = useState<RenderedStoryObject[]>(
    [],
  );
  const [interactionPending, setInteractionPending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const timers = useRef<number[]>([]);
  const interactionPendingRef = useRef(false);
  const renderedObjectsRef = useRef<StoryRenderObject[]>([]);
  const renderTransitionTimer = useRef<number | null>(null);
  const renderTransitionFrame = useRef<number | null>(null);

  const recipe = recipes.find((item) => item.id === selectedId) ?? null;
  const storyRecipe = selectedId ? storyRecipes.get(selectedId) ?? null : null;
  const storyStep = storyRecipe?.steps[displayIndex] ?? null;
  const result = recipe && session && finished
    ? evaluateRecipeResult(recipe, session)
    : null;
  const completedCount = session?.completedSteps.length ?? 0;
  const progress = recipe
    ? Math.round((completedCount / recipe.steps.length) * 100)
    : 0;
  const normalPoseIndex = displayIndex % normalPortraits.length;

  const dialogueText = useMemo(() => {
    if (!storyStep || !recipe) return "";
    if (finished && result) return result.summary;
    if (storyError && characterPhase === "dragon") {
      return storyError.characterText;
    }
    if (characterPhase === "pre-error" || characterPhase.startsWith("transform")) {
      return "停一下，这一步需要重新判断。";
    }
    if (stepReady) return storyStep.correctText;
    return `${storyStep.description} ${storyStep.knowledge}`;
  }, [characterPhase, finished, recipe, result, stepReady, storyError, storyStep]);

  useEffect(() => {
    setVoiceEnabled(loadRecipeVoiceEnabled());
    const saved = loadStorySession();
    const query = new URLSearchParams(window.location.search);
    const legacy = query.get("legacy") === "1";
    const queryId = Number(query.get("recipe"));
    const candidateId =
      Number.isInteger(queryId) &&
      recipes.some((item) => item.id === queryId)
        ? queryId
        : saved?.recipeId ?? null;
    if (candidateId && !legacy) {
      saveStorySession(null);
      router.replace(recipePrototypePath(candidateId));
      return;
    }
    if (candidateId) {
      const nextRecipe = recipes.find((item) => item.id === candidateId);
      const nextSession =
        saved?.recipeId === candidateId && nextRecipe
          ? saved
          : nextRecipe
            ? createRecipeSession(nextRecipe)
            : null;
      setSelectedId(candidateId);
      setSession(nextSession);
      setDisplayIndex(
        nextSession
          ? Math.min(
              nextSession.stepIndex,
              (nextRecipe?.steps.length ?? 1) - 1,
            )
          : 0,
      );
      const complete =
        nextSession && nextRecipe
          ? nextSession.completedSteps.length >= nextRecipe.steps.length
          : false;
      setFinished(Boolean(complete));
    }
    setHydrated(true);
  }, [router]);

  useEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      stopRecipeSpeech();
    };
  }, []);

  useEffect(() => {
    if (!voiceEnabled || !storyStep || finished) {
      stopRecipeSpeech();
      return;
    }
    speakRecipeText(dialogueText);
    return stopRecipeSpeech;
  }, [dialogueText, finished, storyStep, voiceEnabled]);

  useEffect(() => {
    const current = storyStep?.renderObjects.filter((item) => item.visible) ?? [];
    const previous = renderedObjectsRef.current;
    const currentIds = new Set(current.map((item) => item.assetId));
    const previousIds = new Set(previous.map((item) => item.assetId));
    const next: RenderedStoryObject[] = [
      ...current.map((item) => ({
        ...item,
        transition: previousIds.has(item.assetId)
          ? ("stable" as const)
          : ("entering" as const),
      })),
      ...previous
        .filter((item) => !currentIds.has(item.assetId))
        .map((item) => ({
          ...item,
          transition: "leaving" as const,
        })),
    ];

    renderedObjectsRef.current = current;
    setRenderedObjects(next);
    setHoveredObjectId(null);
    setActiveObjectId(null);

    if (renderTransitionFrame.current !== null) {
      window.cancelAnimationFrame(renderTransitionFrame.current);
    }
    renderTransitionFrame.current = window.requestAnimationFrame(() => {
      setRenderedObjects((objects) =>
        objects.map((item) =>
          currentIds.has(item.assetId)
            ? { ...item, transition: "stable" }
            : item,
        ),
      );
    });

    if (renderTransitionTimer.current !== null) {
      window.clearTimeout(renderTransitionTimer.current);
    }
    renderTransitionTimer.current = window.setTimeout(() => {
      setRenderedObjects(
        current.map((item) => ({ ...item, transition: "stable" })),
      );
    }, 280);

    return () => {
      if (renderTransitionFrame.current !== null) {
        window.cancelAnimationFrame(renderTransitionFrame.current);
      }
      if (renderTransitionTimer.current !== null) {
        window.clearTimeout(renderTransitionTimer.current);
      }
    };
  }, [storyStep?.recipeId, storyStep?.renderObjects, storyStep?.stepId]);

  useEffect(() => {
    if (!storyStep) return;
    for (const object of storyStep.renderObjects) {
      if (!object.visible) continue;
      for (const state of ["normal", "click", "success", "error"] as const) {
        const image = new window.Image();
        image.src = independentAssetPath(object.assetId, state);
      }
    }
  }, [storyStep]);

  function clearTimers() {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    interactionPendingRef.current = false;
    setInteractionPending(false);
  }

  function startRecipe(nextRecipe: RecipeDefinition) {
    clearTimers();
    const nextSession = createRecipeSession(nextRecipe);
    setSelectedId(nextRecipe.id);
    setSession(nextSession);
    setDisplayIndex(0);
    setFinished(false);
    setStepReady(false);
    setSelectedOptionId(null);
    setCharacterPhase("normal");
    setStoryError(null);
    setHoveredObjectId(null);
    setActiveObjectId(null);
    saveStorySession(nextSession);
    window.history.replaceState(
      null,
      "",
      `/cook/story/?recipe=${nextRecipe.id}`,
    );
  }

  function openRecipePrototype(recipeId: number) {
    router.push(recipePrototypePath(recipeId));
  }

  function showRecipePicker() {
    clearTimers();
    setSelectedId(null);
    setSession(null);
    setDisplayIndex(0);
    setFinished(false);
    setStepReady(false);
    setCharacterPhase("normal");
    setStoryError(null);
    setHoveredObjectId(null);
    setActiveObjectId(null);
    window.history.replaceState(null, "", "/cook/story/");
  }

  function completeStep() {
    if (!recipe || !session || stepReady || storyError) return;
    const submission = submitRecipeStep(session, recipe);
    if (!submission.advanced) return;
    setSession(submission.session);
    saveStorySession(submission.session);
    setStepReady(true);
    setSelectedOptionId(null);
    setCharacterPhase("correct");
  }

  function triggerError(branchId: string) {
    if (!storyStep || finished) return;
    clearTimers();
    setStoryError({
      branchId,
      correctOperation: storyStep.errorOperation,
      principle: storyStep.errorPrinciple,
      characterText: `正确操作：${storyStep.errorOperation} 为什么：${storyStep.errorPrinciple}`,
    });
    setStepReady(false);
    setSelectedOptionId(null);
    setHoveredObjectId(null);
    setActiveObjectId(null);
    setCharacterPhase("pre-error");

    const frames: CharacterPhase[] = [
      "transform-01",
      "transform-02",
      "transform-03",
      "dragon",
    ];
    const times = [300, 600, 1000, 1100];
    frames.forEach((frame, index) => {
      timers.current.push(
        window.setTimeout(() => setCharacterPhase(frame), times[index]),
      );
    });
  }

  function completeAfterClickFeedback() {
    if (interactionPendingRef.current) return;
    interactionPendingRef.current = true;
    setInteractionPending(true);
    timers.current.push(
      window.setTimeout(() => {
        interactionPendingRef.current = false;
        setInteractionPending(false);
        completeStep();
      }, 180),
    );
  }

  function handleHotspot(target: string, assetId?: string) {
    if (
      !storyStep ||
      finished ||
      stepReady ||
      storyError ||
      interactionPendingRef.current
    ) {
      return;
    }
    if (target === storyStep.hotspot) {
      setActiveObjectId(
        assetId ??
          storyStep.renderObjects.find((object) => object.visible)?.assetId ??
          null,
      );
      completeAfterClickFeedback();
      return;
    }
    setActiveObjectId(null);
    triggerError(`wrong-target-${storyStep.recipeId}-${storyStep.stepId}`);
  }

  function answerQuestion(option: QuestionOption) {
    if (
      !storyStep?.question ||
      finished ||
      stepReady ||
      storyError ||
      interactionPendingRef.current
    ) {
      return;
    }
    setSelectedOptionId(option.id);
    if (option.id === storyStep.question.correctOptionId) {
      setActiveObjectId(
        storyStep.renderObjects.find((object) => object.visible)?.assetId ??
          null,
      );
      completeAfterClickFeedback();
      return;
    }
    setActiveObjectId(null);
    triggerError(`wrong-answer-${storyStep.recipeId}-${storyStep.stepId}`);
  }

  function retryStep() {
    clearTimers();
    setStoryError(null);
    setStepReady(false);
    setSelectedOptionId(null);
    setHoveredObjectId(null);
    setActiveObjectId(null);
    setCharacterPhase("normal");
  }

  function continueStory() {
    if (!stepReady || !recipe || !session || !storyRecipe) return;
    if (displayIndex >= storyRecipe.steps.length - 1) {
      setFinished(true);
      setCharacterPhase("normal");
      return;
    }
    setDisplayIndex(session.stepIndex);
    setStepReady(false);
    setSelectedOptionId(null);
    setStoryError(null);
    setHoveredObjectId(null);
    setActiveObjectId(null);
    interactionPendingRef.current = false;
    setInteractionPending(false);
    setCharacterPhase("normal");
  }

  function restartStory() {
    if (!recipe) return;
    startRecipe(recipe);
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    saveRecipeVoiceEnabled(next);
    if (!next) stopRecipeSpeech();
  }

  function objectVisualState(
    assetId: string,
    transition: RenderedStoryObject["transition"],
  ): StoryObjectState {
    if (transition === "leaving") return "normal";
    if (storyError) return "error";
    if (activeObjectId === assetId) {
      if (stepReady) return "success";
      if (interactionPending) return "click";
    }
    if (
      hoveredObjectId === assetId &&
      !stepReady &&
      !interactionPending
    ) {
      return "click";
    }
    return "normal";
  }

  function enterObject(assetId: string) {
    if (stepReady || storyError || interactionPendingRef.current) return;
    setHoveredObjectId(assetId);
  }

  function leaveObject(assetId: string) {
    if (interactionPendingRef.current) return;
    setHoveredObjectId((current) => (current === assetId ? null : current));
  }

  if (!hydrated) {
    return (
      <main className={styles.loadingPage}>
        <span>正在加载烹语剧场…</span>
      </main>
    );
  }

  if (!recipe || !storyRecipe || !session) {
    return (
      <main className={styles.page}>
        <section className={styles.recipePicker}>
          <div className={styles.pickerHeading}>
            <span>STORY KITCHEN · 25 RECIPES</span>
            <h1>夏弥的烹语剧场</h1>
            <p>
              选择一道菜，在固定 2D 厨房中跟随夏弥完成全部步骤。这里使用独立进度，不会覆盖菜谱实训记录。
            </p>
          </div>
          <div className={styles.recipeGrid}>
            {recipes.map((item) => (
              <button
                type="button"
                key={item.id}
                data-story-recipe-id={item.id}
                onClick={() => openRecipePrototype(item.id)}
              >
                <StoryDishArtwork
                  recipeId={item.id}
                  name={item.name}
                  compact
                />
                <span>{item.category}</span>
                <strong>{item.name}</strong>
                <small>{item.steps.length} 步 · {item.summary}</small>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  const activeTarget = storyStep?.hotspot;
  const currentHotspot = hotspots.find((item) => item.id === activeTarget);
  const currentRenderObjects =
    storyStep?.renderObjects.filter((item) => item.visible) ?? [];
  const promptStyle = currentHotspot
    ? ({
        left: `${
          (currentRenderObjects.length > 0
            ? currentRenderObjects.reduce(
                (sum, object) => sum + object.x,
                0,
              ) / currentRenderObjects.length
            : currentHotspot.x + currentHotspot.width / 2) * 100
        }%`,
        top: `${
          (currentHotspot.labelPlacement === "above"
            ? currentHotspot.y
            : currentHotspot.y + currentHotspot.height) * 100
        }%`,
      } as CSSProperties)
    : undefined;

  return (
    <main className={`${styles.page} ${styles.storyPage}`}>
      <section
        className={styles.tutorial}
        data-story-stage
        data-story-step={finished ? "finished" : displayIndex + 1}
        data-story-character-phase={characterPhase}
        data-story-target={activeTarget ?? ""}
        data-story-finished={finished ? "true" : "false"}
      >
        <section
          className={styles.kitchen}
          data-2d-kitchen
          aria-label="烹语剧场 2D 厨房操作区"
        >
          <div
            className={styles.kitchenBackground}
            role="img"
            data-story-background
            aria-label="奶油风厨房，包含冰箱、清洗池、砧板区、灶台、调料架和装盘位置"
          />
          {finished && result && (
            <div className={styles.finishedDishScene} data-story-finished-dish>
              <div className={styles.finishedDishPlate}>
                <StoryDishArtwork recipeId={recipe.id} name={recipe.name} />
              </div>
              <div className={styles.finishedDishCaption}>
                <span>成品已装盘</span>
                <strong>{recipe.name}</strong>
              </div>
            </div>
          )}
          {hotspots.map((hotspot) => (
            <button
              type="button"
              key={hotspot.id}
              className={styles.hotspot}
              style={{
                left: `${hotspot.x * 100}%`,
                top: `${hotspot.y * 100}%`,
                width: `${hotspot.width * 100}%`,
                height: `${hotspot.height * 100}%`,
              }}
              data-story-hotspot={hotspot.id}
              aria-label={
                activeTarget === hotspot.id && storyStep
                  ? storyStep.object.prompt
                  : `点击${hotspot.label}`
              }
              disabled={finished || characterPhase === "dragon"}
              onClick={() => handleHotspot(hotspot.id)}
            />
          ))}

          <div className={styles.renderObjectLayer} data-story-object-layer>
            {renderedObjects.map((object) => {
              const objectState = objectVisualState(
                object.assetId,
                object.transition,
              );
              return (
                <span
                  className={styles.renderObjectFrame}
                  style={{
                    left: `${object.x * 100}%`,
                    top: `${object.y * 100}%`,
                    width: `${object.scale * 100}%`,
                  }}
                  data-story-render-id={object.assetId}
                  data-story-render-transition={object.transition}
                  key={object.assetId}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- independent transparent state PNG requires direct positioning */}
                  <img
                    className={styles.renderObjectImage}
                    data-story-object-image
                    data-story-object-state={objectState}
                    src={independentAssetPath(object.assetId, objectState)}
                    alt=""
                    draggable={false}
                  />
                </span>
              );
            })}
          </div>

          {storyStep &&
            currentRenderObjects.map((object) => {
              const objectState = objectVisualState(
                object.assetId,
                "stable",
              );
              return (
                <button
                  type="button"
                  className={styles.renderObjectHitArea}
                  style={{
                    left: `${object.x * 100}%`,
                    top: `${object.y * 100}%`,
                    width: `${object.scale * 100}%`,
                  }}
                  data-story-object
                  data-story-render-id={object.assetId}
                  data-story-object-region={storyStep.hotspot}
                  data-story-object-state={objectState}
                  aria-label={storyStep.object.prompt}
                  title={storyStep.object.prompt}
                  disabled={finished || characterPhase === "dragon"}
                  onPointerEnter={() => enterObject(object.assetId)}
                  onPointerLeave={() => leaveObject(object.assetId)}
                  onClick={() =>
                    handleHotspot(storyStep.hotspot, object.assetId)
                  }
                  key={object.assetId}
                />
              );
            })}

          {!finished && storyStep && currentHotspot && (
            <span
              className={styles.objectPrompt}
              style={promptStyle}
              data-placement={currentHotspot.labelPlacement}
              data-story-object-prompt
            >
              <strong>{currentHotspot.label} · {storyStep.object.label}</strong>
              <span>{storyStep.object.action}</span>
            </span>
          )}

          {storyError && characterPhase === "dragon" && (
            <div className={styles.kitchenError} role="alert">
              <strong>需要修正</strong>
              <span>{storyError.correctOperation}</span>
            </div>
          )}
        </section>

        <aside
          className={styles.dialoguePanel}
          data-story-dialogue
          aria-label="夏弥指导区"
        >
          <div className={styles.characterScene}>
            <div
              className={`${styles.characterAura} ${
                characterPhase === "dragon"
                  ? styles.characterAuraDragon
                  : characterPhase.startsWith("transform")
                    ? styles.characterAuraTransform
                    : ""
              }`}
            />
            <div
              key={`${characterPhase}-${normalPoseIndex}`}
              className={`${styles.character} ${
                characterPhase === "dragon" ? styles.characterDragon : ""
              }`}
              role="img"
              aria-label={
                characterPhase === "dragon"
                  ? "完全龙化的耶梦加得"
                  : characterPhase === "correct"
                    ? "答对的夏弥"
                    : "夏弥"
              }
              style={{
                backgroundImage: `url("${characterPath(
                  characterPhase,
                  normalPoseIndex,
                )}")`,
              }}
            />
          </div>

          <div
            className={`${styles.dialogueBubble} ${
              characterPhase === "dragon"
                ? styles.dialogueDragon
                : stepReady
                  ? styles.dialogueCorrect
                  : ""
            }`}
          >
            <div className={styles.namePlate}>
              <strong>
                {characterPhase === "dragon" ? "耶梦加得" : "夏弥"}
              </strong>
              <span>
                {characterPhase === "dragon"
                  ? "纠错模式"
                  : finished
                    ? "剧场完成"
                    : `${recipe.name} · 第 ${displayIndex + 1} 步`}
              </span>
            </div>

            {finished && result ? (
              <div className={styles.result}>
                <span>STORY COMPLETE</span>
                <h2>{recipe.name}完成</h2>
                <p>{result.summary}</p>
                <div className={styles.resultMetrics}>
                  <span>味觉 {result.metrics.flavor}</span>
                  <span>口感 {result.metrics.texture}</span>
                  <span>香气 {result.metrics.aroma}</span>
                  <span>安全 {result.metrics.safety}</span>
                </div>
                <button type="button" onClick={restartStory}>
                  <RotateCcw size={16} />
                  再演一次
                </button>
              </div>
            ) : (
              <>
                <p className={styles.dialogueText}>{dialogueText}</p>

                {storyError && characterPhase === "dragon" && (
                  <div className={styles.errorExplanation}>
                    <span>
                      <strong>正确操作</strong>
                      {storyError.correctOperation}
                    </span>
                    <span>
                      <strong>为什么</strong>
                      {storyError.principle}
                    </span>
                    <button type="button" data-story-retry onClick={retryStep}>
                      重新操作
                    </button>
                  </div>
                )}

                {storyStep?.question &&
                  !stepReady &&
                  !storyError &&
                  characterPhase === "normal" && (
                    <div className={styles.question}>
                      <p>{storyStep.question.text}</p>
                      <div className={styles.questionOptions}>
                        {storyStep.question.options.map((option, index) => (
                          <button
                            type="button"
                            key={option.id}
                            data-story-question-option={option.id}
                            aria-pressed={selectedOptionId === option.id}
                            onClick={() => answerQuestion(option)}
                          >
                            <span>{String.fromCharCode(65 + index)}</span>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </aside>

        <footer className={styles.progressBar} data-story-progress-bar>
          <div className={styles.progressCopy}>
            <span>
              {finished
                ? `${recipe.name} · 已完成`
                : `${recipe.name} · 第 ${displayIndex + 1} / ${recipe.steps.length} 步`}
            </span>
            <strong>
              {finished ? recipe.summary : storyStep?.title}
            </strong>
            <small>
              {finished
                ? "本次剧场进度已保存"
                : storyError
                  ? "先按正确方法重新操作"
                  : stepReady
                    ? "本步已完成"
                    : storyStep?.question
                      ? `${storyStep.object.prompt}；也可回答夏弥的轻提问`
                      : storyStep?.object.prompt}
            </small>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <i style={{ width: `${progress}%` }} />
            <span>{progress}%</span>
          </div>
          <div className={styles.progressActions}>
            <button
              type="button"
              className={styles.iconButton}
              data-story-voice
              aria-pressed={voiceEnabled}
              aria-label={voiceEnabled ? "关闭语音讲解" : "开启语音讲解"}
              onClick={toggleVoice}
            >
              {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="返回菜谱选择"
              onClick={showRecipePicker}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              className={styles.continueButton}
              data-story-continue
              disabled={!stepReady || Boolean(storyError)}
              onClick={continueStory}
            >
              {finished ? (
                <>
                  <Check size={17} />
                  完成
                </>
              ) : displayIndex === recipe.steps.length - 1 ? (
                <>
                  查看结果
                  <Flame size={17} />
                </>
              ) : (
                <>
                  继续
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
