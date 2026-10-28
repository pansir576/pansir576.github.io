import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleDot,
  FlaskConical,
  Sparkles,
} from "lucide-react";
import { categoryMeta } from "@/lib/constants";
import { getIngredient } from "@/lib/ingredients";
import { siteMedia } from "@/lib/media";
import { principles } from "@/lib/principles";
import {
  principleIdTags,
  principleTagLabels,
  principleTransfers,
} from "@/lib/treatments";

export const metadata: Metadata = {
  title: "烹饪原理库",
  description:
    "用短篇方式理解中式家常菜中的油、盐、酱、醋、糖、酒、水、淀粉、香辛料与火候。",
};

export default function PrinciplesPage() {
  return (
    <>
      <section className="page-hero principle-page-hero">
        <div className="site-shell page-hero-grid">
          <div>
            <div className="eyebrow">
              <FlaskConical size={15} />
              原理库 / FOOD SCIENCE
            </div>
            <h1>
              调料没有“神秘配方”，
              <br />
              只有<span className="marker">能解释的变化</span>。
            </h1>
            <p>
              先看实用结论：什么时候用、为什么、过量会怎样。需要深入时，再展开物理、化学或生物机制。
            </p>
          </div>
          <div className="principle-hero-media">
            <Image
              src={siteMedia.hero}
              alt="中式烹饪食材与调味料摄影"
              fill
              priority
              sizes="(max-width: 840px) 92vw, 420px"
            />
            <div className="principle-index-card">
              <span className="mini-label">本页索引</span>
              <div>
                {principles.map((item) => (
                  <a key={item.id} href={`#${item.id}`}>
                    <CircleDot size={12} />
                    {item.name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section principles-section">
        <div className="site-shell">
          <div className="principles-list">
            {principles.map((principle, index) => {
              const meta = categoryMeta[principle.mechanismKind];
              const transferTags = (principleIdTags[principle.id] ?? []).slice(0, 2);
              return (
                <article
                  className="principle-card"
                  id={principle.id}
                  key={principle.id}
                  style={
                    {
                      "--principle-accent": principle.accent,
                    } as React.CSSProperties
                  }
                >
                  <div className="principle-card-index">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div />
                  </div>
                  <div className="principle-card-main">
                    <div className="principle-card-heading">
                      <div>
                        <span className="mini-label">{principle.eyebrow}</span>
                        <h2>{principle.name}</h2>
                      </div>
                      <span className={`science-pill ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="principle-summary">{principle.summary}</p>

                    <div className="practical-grid">
                      <div>
                        <span>什么时候用</span>
                        <p>{principle.useWhen}</p>
                      </div>
                      <div>
                        <span>时机与用法</span>
                        <p>{principle.timing}</p>
                      </div>
                      <div>
                        <span>过量会怎样</span>
                        <p>{principle.excess}</p>
                      </div>
                    </div>

                    <div className="myth-row">
                      <Sparkles size={17} />
                      <div>
                        <strong>常见误区</strong>
                        <p>{principle.myth}</p>
                      </div>
                    </div>

                    {transferTags.length > 0 && (
                      <div className="principle-transfer-block">
                        <div className="principle-transfer-heading">
                          <Sparkles size={15} />
                          <span>一因多用：同一条规律还出现在哪里</span>
                        </div>
                        <div className="principle-transfer-grid">
                          {transferTags.map((tag) => (
                            <div key={tag}>
                              <strong>{principleTagLabels[tag]}</strong>
                              <p>{principleTransfers[tag].summary}</p>
                              <div>
                                {principleTransfers[tag].ingredients.map((ingredientId) => (
                                  <Link
                                    key={ingredientId}
                                    href={`/ingredients/${ingredientId}/`}
                                  >
                                    {getIngredient(ingredientId).name}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <details className="mechanism-details">
                      <summary>
                        <span>
                          <BookOpen size={17} />
                          展开科学层
                        </span>
                        <ChevronDown size={18} />
                      </summary>
                      <div className="mechanism-body">
                        <span className={`science-pill ${meta.className}`}>
                          {meta.label}
                        </span>
                        <h3>{principle.mechanismTitle.replace("小标题：", "")}</h3>
                        <p>{principle.mechanism}</p>
                        <small>{principle.source}</small>
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section cta-band">
        <div className="site-shell cta-band-inner">
          <div>
            <span className="eyebrow light">看懂之后，亲手试一次</span>
            <h2>同一个土豆，醋加早一点和晚一点，结果会不同。</h2>
          </div>
          <Link className="button button-light" href="/kitchen/?ingredient=potato">
            带土豆去实验 <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
