import type { FlavorProfile } from "@/lib/types";
import { getTasteLabel } from "@/lib/simulator";

const tasteRows: { key: keyof FlavorProfile; label: string; color: string }[] = [
  { key: "sour", label: "酸", color: "#d49b2f" },
  { key: "sweet", label: "甜", color: "#c36c48" },
  { key: "salty", label: "咸", color: "#5f7773" },
  { key: "umami", label: "鲜", color: "#a75b3d" },
  { key: "spicy", label: "辣", color: "#bd4836" },
  { key: "bitter", label: "苦", color: "#6f664d" },
  { key: "intensity", label: "浓淡", color: "#284c3e" },
];

interface FlavorBarsProps {
  flavor: FlavorProfile;
  compact?: boolean;
}

export function FlavorBars({ flavor, compact = false }: FlavorBarsProps) {
  return (
    <div className={compact ? "flavor-bars is-compact" : "flavor-bars"}>
      {tasteRows.map((row) => {
        const value = Math.round(flavor[row.key]);
        return (
          <div className="flavor-row" key={row.key}>
            <span className="flavor-label">{row.label}</span>
            <div
              className="flavor-track"
              role="meter"
              aria-label={`${row.label} ${getTasteLabel(value)}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <span
                className="flavor-fill"
                style={{
                  width: `${Math.max(value, 2)}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
            <span className="flavor-value">
              {compact ? getTasteLabel(value) : value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
