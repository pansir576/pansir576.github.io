import type { ParticleEffect } from "@/lib/types";

export function ParticleLayer({
  effects,
}: {
  effects: ParticleEffect[];
}) {
  return (
    <div className="particle-layer" aria-hidden="true">
      {effects.map((effect) => (
        <div className={`particle-group particle-${effect.type}`} key={effect.id}>
          {Array.from({ length: effect.type === "steam" ? 7 : 12 }, (_, index) => (
            <i
              key={`${effect.id}-${index}`}
              style={
                {
                  "--particle-index": index,
                  "--particle-angle": `${index * 31}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
