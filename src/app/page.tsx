import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Atom,
  ChefHat,
  Droplets,
  FlaskConical,
  Leaf,
  MoveRight,
  MessagesSquare,
  ThermometerSun,
} from "lucide-react";
import { ingredients } from "@/lib/ingredients";
import {
  featuredIngredientIds,
  ingredientPhoto,
  siteMedia,
} from "@/lib/media";
import { principles } from "@/lib/principles";

const scienceCards = [
  {
    number: "01",
    title: "物理变化",
    body: "切小、擦干、受热、出水。形状和水分怎么移动，决定熟得快不快。",
    icon: Droplets,
    tone: "physical",
  },
  {
    number: "02",
    title: "化学变化",
    body: "蛋白质凝固、淀粉糊化、糖与氨基酸褐变。颜色和香气由此出现。",
    icon: FlaskConical,
    tone: "chemical",
  },
  {
    number: "03",
    title: "生物感受",
    body: "辣椒素激活痛热受体，香气进入鼻腔。味道不只发生在舌头上。",
    icon: Leaf,
    tone: "biological",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero-section">
        <div className="site-shell hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              中式家常菜的烹饪原理实验室
            </div>
            <h1>
              不看十分钟教程，
              <br />
              先懂<span className="marker">这一锅为什么</span>。
            </h1>
            <p className="hero-lead">
              油、盐、酱、醋、糖和火候，不是背下来的配方。把食材放上实验台，看清每一步怎样改变水分、结构与味道。
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/cook/">
                <ChefHat size={19} />
                开始菜谱实训
                <ArrowRight size={18} />
              </Link>
              <Link className="button button-ghost" href="/principles/">
                先看原理
              </Link>
              <Link className="button button-ghost" href="/kitchen/">
                进入自由实验
              </Link>
            </div>
            <div className="hero-proof">
              <span>
                <strong>{ingredients.length}</strong> 种常见食材
              </span>
              <span>
                <strong>32</strong> 种常用调料 + 水
              </span>
              <span>
                <strong>0</strong> 个强行通关的关卡
              </span>
            </div>
          </div>

          <div className="hero-lab" aria-label="番茄实验示例">
            <div className="hero-lab-topbar">
              <span className="window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>LIVE EXPERIMENT / 01</span>
              <span className="live-pill">观察中</span>
            </div>
            <div className="hero-lab-stage">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <div className="hero-photo-frame">
                <Image
                  src={siteMedia.hero}
                  alt="中式烹饪食材与调味料摄影摆盘"
                  fill
                  priority
                  sizes="(max-width: 840px) 86vw, 520px"
                />
                <span className="hero-photo-caption">
                  <i />
                  今日实验样本
                </span>
              </div>
              <div className="lab-note note-one">
                <span>有机酸</span>
                <strong>46</strong>
              </div>
              <div className="lab-note note-two">
                <span>受热后</span>
                <strong>果胶软化</strong>
              </div>
              <div className="lab-note note-three">
                <span>锅温</span>
                <strong>168°C</strong>
              </div>
            </div>
            <div className="hero-lab-footer">
              <div>
                <span className="mini-label">当前样本</span>
                <strong>番茄 · 切大块</strong>
              </div>
              <div className="heat-gauge">
                <span>酸</span>
                <i>
                  <b style={{ width: "62%" }} />
                </i>
                <span>鲜</span>
                <i>
                  <b style={{ width: "48%" }} />
                </i>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-marquee" aria-hidden="true">
          <div>
            <span>盐为什么会出水</span>
            <i>✦</i>
            <span>糖不只负责甜</span>
            <i>✦</i>
            <span>火候是温度 × 时间</span>
            <i>✦</i>
            <span>醋会改变的不仅是酸味</span>
            <i>✦</i>
            <span>淀粉怎样挂住酱汁</span>
            <i>✦</i>
          </div>
        </div>
      </section>

      <section className="section theory-section">
        <div className="site-shell">
          <div className="section-heading split-heading">
            <div>
              <div className="eyebrow">一锅里的三种语言</div>
              <h2>同一口锅，变化不止一种。</h2>
            </div>
            <p>
              不再只记“先放什么、后放什么”。把现象归到物理、化学或生物感受，遇到新食材也能迁移判断。
            </p>
          </div>
          <div className="science-card-grid">
            {scienceCards.map((card) => (
              <article className={`science-card ${card.tone}`} key={card.title}>
                <div className="science-card-top">
                  <span>{card.number}</span>
                  <card.icon size={25} />
                </div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <div className="science-line" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section principle-preview">
        <div className="site-shell">
          <div className="section-heading">
            <div className="eyebrow">调料不是魔法粉</div>
            <h2>先知道它为什么有用。</h2>
            <p>用一句话记住作用，再向下展开原理。没有长篇开场，也没有绕弯子。</p>
          </div>
          <div className="principle-mini-grid">
            {principles.slice(0, 8).map((principle, index) => (
              <Link
                className="principle-mini-card"
                href="/principles/"
                key={principle.id}
              >
                <div
                  className="principle-swatch"
                  style={{ "--principle-color": principle.accent } as React.CSSProperties}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div>
                  <span className="mini-label">{principle.eyebrow}</span>
                  <h3>{principle.name}</h3>
                  <p>{principle.summary}</p>
                </div>
                <MoveRight className="mini-arrow" size={17} />
              </Link>
            ))}
          </div>
          <div className="center-link">
            <Link className="text-link" href="/principles/">
              查看全部烹饪原理 <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section ingredient-preview">
        <div className="site-shell">
          <div className="section-heading split-heading">
            <div>
              <div className="eyebrow">从食材的性格开始</div>
              <h2>先看它是什么，再决定怎么处理。</h2>
            </div>
            <p>
              水分、蛋白质、淀粉、脂肪和酶活性共同决定受热表现。先理解性质，调味才有判断依据。
            </p>
          </div>
          <div className="ingredient-preview-grid">
            {ingredients.filter((ingredient) => featuredIngredientIds.has(ingredient.id)).map((ingredient) => (
              <Link
                className="ingredient-preview-card"
                key={ingredient.id}
                href={`/ingredients/${ingredient.id}/`}
                style={
                  {
                    "--ingredient-main": ingredient.palette.main,
                    "--ingredient-soft": ingredient.palette.soft,
                  } as React.CSSProperties
                }
              >
                <div className="ingredient-preview-photo">
                  <Image
                    src={ingredientPhoto(ingredient.id)}
                    alt={`${ingredient.name}食材摄影`}
                    fill
                    loading="eager"
                    sizes="(max-width: 560px) 100px, (max-width: 1080px) 42vw, 280px"
                  />
                  <span>{ingredient.englishName}</span>
                </div>
                <div>
                  <span className="mini-label">{ingredient.category}</span>
                  <h3>{ingredient.name}</h3>
                  <p>{ingredient.tagline}</p>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section process-section">
        <div className="site-shell">
          <div className="process-panel">
            <Image
              className="process-panel-photo"
              src={siteMedia.process}
              alt=""
              fill
              sizes="(max-width: 840px) 100vw, 1200px"
            />
            <div className="process-copy">
              <div className="eyebrow light">自由实验 · 不评分</div>
              <h2>同一颗土豆，试出两种结果。</h2>
              <p>
                选择处理方式和调料，观察每一步。把两次实验并排比较，变化就不再靠猜。
              </p>
              <Link className="button button-light" href="/kitchen/">
                打开自由实验 <ArrowRight size={18} />
              </Link>
            </div>
            <div className="process-steps">
              {[
                ["01", "选食材", "先读处理提示"],
                ["02", "做操作", "过程可撤销"],
                ["03", "看变化", "味觉与质地"],
                ["04", "做对比", "最多三种结果"],
              ].map(([number, title, text]) => (
                <div className="process-step" key={number}>
                  <span>{number}</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section closing-section">
        <div className="site-shell closing-inner">
          <Atom className="closing-icon" size={35} />
          <div>
            <span className="eyebrow">从“凭感觉”到“有依据”</span>
            <h2>下一次站在灶台前，你会知道该观察什么。</h2>
          </div>
          <div className="closing-actions">
            <Link className="button button-primary" href="/cook/">
              <ThermometerSun size={19} />
              开始菜谱实训
            </Link>
            <Link className="button button-ghost" href="/community/">
              <MessagesSquare size={18} />
              厨友交流
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
