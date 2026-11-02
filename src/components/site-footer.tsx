import Link from "next/link";
import { FlaskConical } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-grid">
        <div>
          <div className="footer-brand">
            <FlaskConical size={19} />
            SIMULATING-COOK
          </div>
          <p>
            把烹饪里的“差不多”拆成能看懂的变化。模拟用于理解趋势，不替代实际菜谱、过敏判断和食品安全操作。
          </p>
        </div>
        <div className="footer-links">
          <span>快速入口</span>
          <Link href="/principles/">原理库</Link>
          <Link href="/ingredients/">食材图鉴</Link>
          <Link href="/cook/">菜谱实训</Link>
          <Link href="/cook/story/">烹语剧场</Link>
          <Link href="/cook/story/tomato-egg/">番茄炒蛋</Link>
          <Link href="/kitchen/">自由实验</Link>
        </div>
        <div className="footer-note">
          <span>内容边界</span>
          <p>
            温度、用量和结果均为教学近似；实际烹饪请结合食材厚度、锅具、设备与当地食品安全建议判断。
          </p>
        </div>
      </div>
      <div className="site-shell footer-bottom">
        <span>© {new Date().getFullYear()} SIMULATING-COOK</span>
        <span>短一点 · 直白一点 · 知道为什么</span>
      </div>
    </footer>
  );
}
