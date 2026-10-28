import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Flame,
  FlaskConical,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { FlavorBars } from "@/components/flavor-bars";
import { IngredientPropertyBars } from "@/components/ingredient-property-bars";
import { getIngredient, ingredients } from "@/lib/ingredients";
import { hasIngredientPhoto, ingredientPhoto } from "@/lib/media";

interface IngredientPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return ingredients.map((ingredient) => ({ slug: ingredient.id }));
}

export async function generateMetadata({
  params,
}: IngredientPageProps): Promise<Metadata> {
  const { slug } = await params;
  const ingredient = getIngredient(slug);
  return {
    title: `${ingredient.name}的性质与处理`,
    description: ingredient.description,
  };
}

export default async function IngredientDetailPage({
  params,
}: IngredientPageProps) {
  const { slug } = await params;
  const ingredient = ingredients.find((item) => item.id === slug);
  if (!ingredient) notFound();

  return (
    <>
      <section
        className="ingredient-detail-hero"
        style={
          {
            "--ingredient-main": ingredient.palette.main,
            "--ingredient-soft": ingredient.palette.soft,
            "--ingredient-accent": ingredient.palette.accent,
          } as React.CSSProperties
        }
      >
        <div className="site-shell">
          <Link className="back-link" href="/ingredients/">
            <ArrowLeft size={16} />
            返回食材图鉴
          </Link>
          <div className="ingredient-detail-grid">
            <div className="ingredient-detail-art-wrap">
              <div className="ingredient-detail-photo">
                {hasIngredientPhoto(ingredient.id) ? (
                  <Image
                    src={ingredientPhoto(ingredient.id)}
                    alt={`${ingredient.name}食材摄影`}
                    fill
                    priority
                    sizes="(max-width: 840px) 78vw, 360px"
                  />
                ) : (
                  <div className="detail-photo-fallback">
                    <span>{ingredient.name.slice(0, 1)}</span>
                    <strong>{ingredient.name}</strong>
                    <small>{ingredient.englishName}</small>
                  </div>
                )}
                <span className="ingredient-detail-photo-label">
                  RAW / {ingredient.englishName.toUpperCase()}
                </span>
              </div>
              <div className="ingredient-stamp">
                <span>{ingredient.category}</span>
                <strong>{ingredient.englishName}</strong>
              </div>
            </div>
            <div className="ingredient-detail-copy">
              <span className="mini-label">INGREDIENT / {ingredient.id.toUpperCase()}</span>
              <h1>{ingredient.name}</h1>
              <p className="ingredient-tagline">{ingredient.tagline}</p>
              <p>{ingredient.description}</p>
              <div className="property-chips">
                {ingredient.keyProperties.map((property) => (
                  <span key={property}>{property}</span>
                ))}
              </div>
              <Link
                className="button button-primary"
                href={`/kitchen/?ingredient=${ingredient.id}`}
              >
                <ChefHat size={19} />
                用{ingredient.name}做实验
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section ingredient-detail-content">
        <div className="site-shell detail-content-grid">
          <div className="detail-main">
            <section className="content-block">
              <div className="block-heading">
                <span className="block-icon">
                  <FlaskConical size={19} />
                </span>
                <div>
                  <span className="mini-label">实验前先看</span>
                  <h2>处理指南</h2>
                </div>
              </div>
              <div className="prep-guide-grid">
                {ingredient.prepGuide.map((item, index) => (
                  <article key={item.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="content-block two-copy-blocks">
              <div>
                <span className="mini-label">
                  <Flame size={14} /> 受热时
                </span>
                <h2>温度和时间怎样改变它</h2>
                <p>{ingredient.heatBehavior}</p>
              </div>
              <div>
                <span className="mini-label">
                  <Sparkles size={14} /> 调味时
                </span>
                <h2>哪些调料和它更合拍</h2>
                <p>{ingredient.seasoningStrategy}</p>
              </div>
            </section>

            <section className="content-block mistakes-block">
              <div className="block-heading">
                <span className="block-icon warning">
                  <AlertTriangle size={19} />
                </span>
                <div>
                  <span className="mini-label">减少无谓踩坑</span>
                  <h2>常见错误</h2>
                </div>
              </div>
              <div className="mistake-list">
                {ingredient.commonMistakes.map((mistake, index) => (
                  <div key={mistake}>
                    <span>{index + 1}</span>
                    <p>{mistake}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="detail-aside">
            <div className="aside-card">
              <span className="mini-label">初始性质</span>
              <h2>它为什么这样表现</h2>
              <IngredientPropertyBars
                properties={ingredient.initialProperties}
                starchiness={ingredient.starchiness}
              />
            </div>
            <div className="aside-card">
              <span className="mini-label">未调味风味</span>
              <h2>它的味觉底子</h2>
              <FlavorBars flavor={ingredient.baseFlavor} compact />
            </div>
            <div className="safety-card">
              <ShieldCheck size={23} />
              <div>
                <strong>安全提示</strong>
                <p>{ingredient.safety}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="section next-ingredient-section">
        <div className="site-shell next-ingredient-inner">
          <div>
            <span className="eyebrow light">把原理带进锅里</span>
            <h2>先处理，再调味，最后比较结果。</h2>
            <p>没有固定答案，也不会给你打分。你可以随时撤销或更换食材。</p>
          </div>
          <Link
            className="button button-light"
            href={`/kitchen/?ingredient=${ingredient.id}`}
          >
            开始自由实验 <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
