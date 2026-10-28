import type { FoodProperties } from "@/lib/types";

const rows: {
  key: keyof FoodProperties;
  label: string;
  note: string;
  color: string;
  max?: number;
}[] = [
  { key: "moisture", label: "含水量", note: "影响嫩度与出水", color: "#408a9b", max: 100 },
  { key: "tenderness", label: "柔嫩度", note: "初始组织柔软程度", color: "#c77452" },
  { key: "crispness", label: "脆度", note: "初始形状与断裂感", color: "#6b914c" },
  { key: "starchGelatinization", label: "淀粉潜力", note: "受热后可糊化程度", color: "#b18b4b" },
  { key: "umami", label: "天然鲜味", note: "食材自带的鲜味基础", color: "#a66543" },
  { key: "enzymeActivity", label: "酶活性", note: "切面褐变等反应潜力", color: "#7a6f52" },
];

export function IngredientPropertyBars({
  properties,
  starchiness,
}: {
  properties: FoodProperties;
  starchiness: number;
}) {
  return (
    <div className="property-bars">
      {rows.map((row) => {
        const raw =
          row.key === "starchGelatinization"
            ? starchiness * 100
            : properties[row.key];
        const value = Math.round(Math.min(100, raw));
        return (
          <div className="property-bar-row" key={row.key}>
            <div>
              <strong>{row.label}</strong>
              <small>{row.note}</small>
            </div>
            <div className="property-bar-track">
              <span
                style={{ width: `${Math.max(value, 3)}%`, backgroundColor: row.color }}
              />
            </div>
            <b>{value}</b>
          </div>
        );
      })}
    </div>
  );
}
