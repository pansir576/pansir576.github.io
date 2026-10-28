"use client";

import Image from "next/image";
import { CookingPot, Droplets, Flame, Move, Scissors } from "lucide-react";
import { hasIngredientPhoto, ingredientPhoto } from "@/lib/media";
import type {
  FoodForm,
  IngredientDefinition,
  IngredientState,
  KitchenStation,
  KitchenWorkspace,
  ParticleEffect,
} from "@/lib/types";
import { ParticleLayer } from "./particle-layer";

const stations: {
  id: KitchenStation;
  label: string;
  hint: string;
  icon: typeof Droplets;
}[] = [
  { id: "sink", label: "水槽", hint: "清洗与浸泡", icon: Droplets },
  { id: "board", label: "砧板", hint: "切配与控制水分", icon: Scissors },
  { id: "pan", label: "炒锅", hint: "入锅与实时烹饪", icon: CookingPot },
];

function Sample({
  ingredient,
  state,
  form,
  draggable,
  onDragStart,
}: {
  ingredient: IngredientDefinition;
  state: IngredientState;
  form: FoodForm;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      className={`kitchen-sample form-${form}`}
      draggable={draggable}
      onDragStart={onDragStart}
      style={
        {
          "--sample-color": state.appearance.color,
          "--sample-main": ingredient.palette.main,
          "--sample-soft": ingredient.palette.soft,
        } as React.CSSProperties
      }
      title={draggable ? "拖到水槽、砧板或炒锅" : ingredient.name}
    >
      {hasIngredientPhoto(ingredient.id) ? (
        <Image
          src={ingredientPhoto(ingredient.id)}
          alt={`${ingredient.name}当前样本`}
          fill
          sizes="190px"
        />
      ) : (
        <span className="kitchen-sample-fallback">{ingredient.name.slice(0, 1)}</span>
      )}
      <div className="food-form-pieces" aria-hidden="true">
        {Array.from({ length: form === "small-pieces" ? 12 : form === "cut" ? 6 : 1 }, (_, index) => (
          <i key={index} style={{ "--piece-index": index } as React.CSSProperties} />
        ))}
      </div>
      <span className="sample-form-label">
        {form === "whole"
          ? "完整食材"
          : form === "washed"
            ? "清洗完成"
            : form === "cut"
              ? "已切配"
              : form === "small-pieces"
                ? "小块/细丝"
                : form === "cooking"
                  ? "受热中"
                  : "接近完成"}
      </span>
    </div>
  );
}

export function KitchenScene({
  ingredient,
  state,
  workspace,
  form,
  activeStation,
  effects,
  isHeating,
  onMoveSample,
  onDragSample,
}: {
  ingredient: IngredientDefinition;
  state: IngredientState;
  workspace: KitchenWorkspace;
  form: FoodForm;
  activeStation?: KitchenStation;
  effects: ParticleEffect[];
  isHeating: boolean;
  onMoveSample: (station: KitchenStation) => void;
  onDragSample: () => void;
}) {
  function handleDrop(
    event: React.DragEvent<HTMLDivElement>,
    station: KitchenStation,
  ) {
    event.preventDefault();
    onMoveSample(station);
  }

  return (
    <div className="three-station-kitchen">
      <ParticleLayer effects={effects} />
      <div className="kitchen-station-grid">
        {stations.map((station) => {
          const Icon = station.icon;
          const hasSample = workspace.sampleStation === station.id;
          const active = activeStation === station.id;
          return (
            <div
              role="button"
              tabIndex={0}
              key={station.id}
              className={[
                "kitchen-station",
                `station-${station.id}`,
                active ? "is-active-task" : "",
                workspace.station === station.id ? "is-focused" : "",
                hasSample ? "has-sample" : "",
                station.id === "pan" && isHeating ? "is-heating" : "",
              ].join(" ")}
              onClick={() => onMoveSample(station.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onMoveSample(station.id);
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, station.id)}
              aria-label={`${station.label}：${station.hint}`}
            >
              <div className="station-sign">
                <Icon size={18} />
                <span>
                  <strong>{station.label}</strong>
                  <small>{station.hint}</small>
                </span>
              </div>
              <div className="station-scene">
                {station.id === "sink" && (
                  <div className="sink-scene" aria-hidden="true">
                    <span className="faucet" />
                    <span className="sink-basin" />
                    <span className="sink-wave wave-one" />
                    <span className="sink-wave wave-two" />
                  </div>
                )}
                {station.id === "board" && (
                  <div className="board-scene" aria-hidden="true">
                    <span className="board-surface" />
                    <span className="board-handle" />
                  </div>
                )}
                {station.id === "pan" && (
                  <div className="pan-scene" aria-hidden="true">
                    <span className="pan-ring" />
                    <span className="pan-body" />
                    <span className="pan-handle" />
                    {isHeating && <span className="pan-flame"><Flame size={30} /></span>}
                  </div>
                )}
                {hasSample && (
                  <Sample
                    ingredient={ingredient}
                    state={state}
                    form={form}
                    draggable={station.id !== "pan"}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      onDragSample();
                    }}
                  />
                )}
              </div>
              <span className="station-drop-hint">
                <Move size={12} />
                {hasSample ? "可拖到其他区域" : workspace.station === station.id ? "点击移动到这里" : "点击或拖入"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="station-location-status">
        当前区域：<strong>{workspace.station === "sink" ? "水槽" : workspace.station === "board" ? "砧板" : "炒锅"}</strong>
        <span className="scene-temperature">{Math.round(state.properties.temperature)}°C</span>
        {!workspace.inPan && <span>食材尚未入锅，点火会被阻止</span>}
      </div>
    </div>
  );
}
