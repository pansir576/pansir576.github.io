# 烹语剧场独立食材素材验收记录

日期：2026-10-29

## 范围

- 仅升级 `/cook/story/` 使用的食材与厨具显示素材。
- 厨房背景、1344×768 舞台、热区坐标、步骤文案、四态时序和业务逻辑保持不变。
- `/cook/`、首页和其他页面继续使用原公共素材。

## 交付

- 专用命名空间：`assets/story-kitchen/`
- 专用 manifest：`assets/story-kitchen/icon_manifest.json`
- 公开同步目录：`public/2d/story-kitchen/`
- 55 个食材 + 7 个厨具，共 62 个对象。
- 每个对象包含 `normal`、`click`、`success`、`error` 四态。
- 共 248 张 `512×512 RGBA` 透明 PNG。
- 原 `assets/ingredients/`、`assets/tools/` 和 `assets/icon_manifest.json` 保持原样。

## 本轮修正

- 修复白色豆腐内部被透明处理掏空的问题。
- 重绘 `knife`、`cutting_board`、`bowl`、`whisk`、`wok`、`plate`。
- 清除误入的食材、汤汁、文字、水印和不完整工具轮廓。
- 人工复核 62 项 normal 总览图。
- 人工复核焯水、切配、翻炒、调味、盘中与 390px 移动端生产截图。

## 验证

- 专用素材校验：55 食材、7 厨具、248 文件、0 错误。
- 原公共素材校验：55 食材、7 厨具、248 文件、0 错误。
- 旧素材源目录与 public 镜像逐文件内容一致。
- 25 道菜、99 个步骤、25 个问题保持完整。
- 固化文案与数据 hash：`a297324430216a981ddffb39e0db95c2f8acfee6dc072453bf5214ad9e4220e5`。
- TypeScript：通过。
- ESLint：通过。
- Vitest：11 个测试文件、88 项测试通过。
- Playwright：30 项测试通过。
- `/cook/story/`：8 项专项测试通过，全部 99 步使用 `/2d/story-kitchen/`。
- 生产构建：通过，共 69 个静态页面。
- 生产输出：`out/cook/story/index.html` 与 `out/2d/story-kitchen/`。

## 当前缺陷

开放缺陷：0。
