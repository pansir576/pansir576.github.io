import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CircleGauge, Leaf, MoveUpRight } from "lucide-react";
import { ingredients } from "@/lib/ingredients";
import { hasIngredientPhoto, ingredientPhoto } from "@/lib/media";

const categoryOrder = [
  "畜肉",
  "禽肉",
  "水产",
  "叶菜",
  "瓜茄",
  "根茎",
  "菌菇豆制品",
  "主食辅料",
];

export const metadata: Metadata = {
  title: "食材图鉴",
  description:
    "查看青菜、土豆、鸡蛋、番茄、豆腐、牛肉、五花肉和鱼的性质、处理方式与调味策略。",
};

export default function IngredientsPage() {
  return (
    <>
      <section className="page-hero ingredient-page-hero">
        <div className="site-shell page-hero-grid ingredient-hero-grid">
          <div>
            <div className="eyebrow">
              <Leaf size={15} />
              食材图鉴 / INGREDIENT NOTES
            </div>
            <h1>
              不一样的口感，
              <br />
              来自不一样的<span className="marker">材质</span>。
            </h1>
            <p className="wide-lead">
              先判断水分、蛋白质、淀粉和脂肪的比例，再选切法、火候和调味。每一种处理都改变下一步会发生什么。
            </p>
            <div className="ingredient-hero-notes">
              <span>{ingredients.length} 种常见食材</span>
              <span>处理 · 受热 · 调味</span>
              <span>摄影与分类视觉索引</span>
            </div>
          </div>
          <div className="ingredient-hero-collage" aria-label="食材摄影精选">
            {["tomato", "greens", "beef"].map((id, index) => (
              <div className={`collage-photo collage-photo-${index + 1}`} key={id}>
                <Image
                  src={ingredientPhoto(id)}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="(max-width: 840px) 45vw, 240px"
                />
              </div>
            ))}
            <span className="collage-caption">RAW MATERIAL / 01—08</span>
          </div>
        </div>
      </section>

      <section className="section ingredient-page-section">
        <div className="site-shell">
          <div className="catalog-category-strip">
            {categoryOrder.map((category) => (
              <span key={category}>
                {category}
                <b>{ingredients.filter((item) => item.category === category).length}</b>
              </span>
            ))}
          </div>
          <div className="ingredient-grid">
            {[...ingredients]
              .sort(
                (a, b) =>
                  categoryOrder.indexOf(a.category) -
                    categoryOrder.indexOf(b.category) ||
                  a.name.localeCompare(b.name, "zh-CN"),
              )
              .map((ingredient, index) => (
              <Link
                className="ingredient-card"
                href={`/ingredients/${ingredient.id}/`}
                key={ingredient.id}
                style={
                  {
                    "--ingredient-main": ingredient.palette.main,
                    "--ingredient-soft": ingredient.palette.soft,
                  } as React.CSSProperties
                }
              >
                <div className="ingredient-card-photo">
                  {hasIngredientPhoto(ingredient.id) ? (
                    <Image
                      src={ingredientPhoto(ingredient.id)}
                      alt={`${ingredient.name}食材摄影`}
                      fill
                      priority={index < 2}
                      loading="eager"
                      sizes="(max-width: 840px) 92vw, 190px"
                    />
                  ) : (
                    <div className="catalog-photo-fallback">
                      <span>{ingredient.name.slice(0, 1)}</span>
                      <small>{ingredient.englishName}</small>
                    </div>
                  )}
                  <span className="photo-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="ingredient-card-copy">
                  <span className="mini-label">
                    {ingredient.category} · {ingredient.englishName}
                  </span>
                  <h2>{ingredient.name}</h2>
                  <p>{ingredient.tagline}</p>
                  <div className="property-chips">
                    {ingredient.keyProperties.slice(0, 3).map((property) => (
                      <span key={property}>{property}</span>
                    ))}
                  </div>
                </div>
                <div className="ingredient-card-link">
                  看性质与处理 <MoveUpRight size={17} />
                </div>
              </Link>
            ))}
          </div>

          <div className="ingredient-explainer">
            <CircleGauge size={29} />
            <div>
              <span className="mini-label">怎样使用图鉴</span>
              <h2>先读处理指南，再进入厨房。</h2>
              <p>
                图鉴描述的是典型趋势，不等于固定公式。切得厚、锅更薄、食材更冷都会改变时间与结果。
              </p>
            </div>
            <Link className="text-link" href="/kitchen/">
              跳过阅读，直接实验 <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
