# Simulating-cook 验收报告

验收日期：2026-10-29  
验收结论：**通过**

## 1. 交付范围

标准菜谱实训主入口为 `/cook/`，2D 角色互动入口为 `/cook/story/`。烹语剧场采用
“独立食材图层动态渲染模式”，严格使用固定三区布局：

- 左侧：静态 2D 厨房背景、独立 PNG 食材/厨具对象层和透明点击热区。
- 右侧：夏弥立绘、姓名牌和对话气泡。
- 底部：当前步骤、进度条与“继续”操作。
- 交互只使用单击，不包含 3D 相机、模型实时渲染、自由视角或物理拖拽。

菜谱实训实现位于 `src/components/kitchen/recipe-kitchen.tsx`；烹语剧场实现位于
`src/components/kitchen/story-kitchen.tsx`，步骤和素材由
`assets/story_state_manifest.json` 和其中逐步骤的 `renderObjects` 驱动。两个模式使用独立的本地进度命名空间。

## 2. 分项验收

| 任务 | 结果 | 证据 |
| --- | --- | --- |
| 1.1 厨房背景 | 通过 | `assets/bg/kitchen_bg.png`，1344×768 PNG；包含冰箱、清洗池、砧板区、灶台、调料架；台面无食物、碗盘、烟雾、按钮或角色 |
| 1.2 食材与厨具 | 通过 | 55 个食材、7 个厨具，共 248 张 512×512 RGBA 状态图；四状态齐全，烹语剧场按 `renderObjects` 独立加载 |
| 1.3 角色与龙化 | 通过 | 4 张常态、1 张答对、1 张错误前置、3 张过渡、1 张耶梦加得，共 10 张 768×1152 RGBA；相邻龙化帧差异均超过阈值 |
| 1.4 对象配置 | 通过 | 25 道菜、99 个步骤均含 `renderObjects`；原 396 张整步骤图字段原样保留但运行时不再读取 |
| 2.1 标准菜谱流程 | 通过 | `/cook/` 提供 25 道菜、99 个标准步骤、可控变量、风险判定和结果复盘 |
| 2.2 烹语剧场流程 | 通过 | `/cook/story/` 提供 25 道菜、99 个专属步骤素材和 25 个单点轻提问，无连续提问 |
| 2.3 交互配置 | 通过 | 每步独立配置 `assetId/x/y/scale/visible`，绑定单个食材或厨具的四态动画 |
| 3 集成验收 | 通过 | 主页面、剧情页和经典厨房均通过桌面与移动端浏览器回归 |

## 3. 角色状态机

错误分支固定执行：

```text
pre_error_xiami.png
-> transform_01.png
-> transform_02.png
-> transform_03.png
-> yemengjiade.png
```

时间点为 `0 / 300 / 600 / 1000 / 1100ms`。E2E 验证了动画结束前不会提前显示
耶梦加得纠错内容，且不能从常态夏弥直接硬切到全龙形。正常、答对、答错三种分支均已覆盖。
自动化还逐项走完 25 道菜的全部 99 步，同时验证每张对象图加载成功、
舞台内可见尺寸充足、对象中心位于对应热区，并验证错误分支结束后可正常重试。

### 独立对象渲染与四态

- 层级固定为提示 UI `z=40`、透明点击热区 `z=30`、独立对象 `z=20`、厨房背景 `z=10`。
- 所有对象图片均为 `position: absolute`，使用现有百分比坐标和缩放配置。
- `normal` 原图无描边；`click` 放大 1.08 倍并显示金色光晕，停留 180ms 后进入
  `success` 的弹跳与白色闪光；`error` 执行三次左右抖动和红色闪烁描边。
- 步骤切换时按 `assetId` 对比前后 `renderObjects`，新增对象淡入，移出对象在
  280ms 内淡出销毁，保留对象平滑更新位置。
- 水池、砧板标签位于上方，盘子标签位于下方；独立食材热区互不覆盖。

## 4. 剧情与进度隔离

- 烹语剧场支持 `?recipe=<id>` 直达指定菜谱。
- `simulating-cook:story-session:v1` 与
  `simulating-cook:recipe-session:v1` 分离，剧情进度不会覆盖菜谱实训进度。
- 刷新页面和移动端视口下均能恢复当前步骤。
- `/cook/3d/` 仅作为兼容入口，提示升级并跳转到 `/cook/story/`；不会请求 GLB、GLTF、
  HDR、Three.js 或旧 3D 组件资源。

## 5. 自动化验证

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 通过 |
| `npm run lint` | 通过 |
| `npm test` | 11 个测试文件、87 项测试通过 |
| `npm run test:e2e` | 30 项 Playwright 全部通过 |
| `npm run build` | 69 个静态页面构建通过，输出至 `out/` |
| `validate-cell-icons.py` | 55 食材、7 工具、248 文件，0 错误 |
| `validate-character-assets.py` | 10 文件、尺寸与透明底正确，0 错误 |
| `validate-story-assets.py` | 25 道菜、99 步、25 问、历史 396 文件完整保留，0 错误 |

资产测试还会拒绝未登记候选和多余背景文件，防止早期 seed 再次进入生产资源。
独立渲染测试同时校验 99 步不可变字段 hash、222 个当前对象引用、每个 `assetId`
有效、坐标位于对应热区、食材热区互不重叠，以及运行时不存在整步骤图请求。

## 6. 3D 移除检查

- 原 3D 页面、Three.js 组件、模型和运行依赖均已移除。
- `src/app/cook/3d` 只保留静态兼容提示页，并跳转到 `/cook/story/`。
- `public/models` 与 GLB/GLTF/HDR 交付资产不存在。
- `three`、`@react-three/fiber`、`@react-three/drei` 和
  `@react-three/rapier` 依赖不存在。
- 主页面导航与 `/cook/` 页面不包含 3D 入口。

## 7. 背景生成记录

内置 `image_gen` 工具在当前会话不可用，因此最终背景使用本机
FLUX.1-schnell + ComfyUI 生成，无云端 API key。

最终提示词：

```text
Japanese anime cel-shaded interior background for a 2D cooking game, wide
straight-on eye-level view, fixed functional zones from left to right: a tall
cream refrigerator, a stainless sink with faucet, an EMPTY clean wooden cutting
board on the counter, and a gas stove with a wok at far right. A closed
seasoning rack above at far right. Every jar must be sealed and closed.
Completely clear uncluttered counters. Flat color blocks, crisp warm dark
outlines, restrained soft shadows, bright even lighting, cozy cream and warm
wood palette, static game background, generous empty workspace. No people, no
character, no food, no ingredients, no fruit, no vegetables, no bowls, no
plates, no smoke, no steam, no spray bottle, no labels, no text, no buttons,
no UI, no watermark. Not photorealistic, no photographic texture, no depth of
field, no 3D render, no painterly texture, no thick paint.
```

最终采用 seed：`1107`。未采用的背景与图标候选已非破坏性隔离到
`assets/reference/bg-raw/` 和 `assets/reference/icon-raw/`，不会同步到公开资源。

## 8. 缺陷清单

当前开放缺陷：**0**

已关闭问题：

- 多个独立食材热区重叠导致一个对象遮挡另一个对象：缩小并拉开对象专用命中区，
  视觉素材位置保持不变，逐对检测确认食材热区无交叠。
- 背景已有空锅时额外叠加独立锅具造成重复锅影：灶台步骤仅显示独立食材，
  食材坐标贴合背景锅面。
- 组合状态图曾缺少绝对定位并堆叠在厨房左上角：改为固定比例舞台中的
  `z-index: 0 / 20 / 30` 三层结构，并由 99 步的对象边界与热区中心测试覆盖。
- 背景自动加入水果碗、烟雾或涂抹修补痕迹：重新生成并采用 `seed1107`。
- 图标出现洋红抠图残边、额外盘子或食材误识别：重新归一化、去色和重绘。
- 龙化关键帧递进不足或红瞳污染头发：改为独立关键帧并收紧鳞片范围。
- 3D 路由已删但空目录仍存在：清理空目录并通过无 3D 测试。
- 早期候选混入生产素材目录：移入 Git 忽略的 reference 隔离目录，并增加资产集合测试。

## 9. 最终验收产物

- 页面入口：`http://localhost:3000/cook/`
- 烹语剧场：`http://localhost:3000/cook/story/`
- 背景：`assets/bg/kitchen_bg.png`
- 食材：`assets/ingredients/`
- 厨具：`assets/tools/`
- 角色：`assets/character/`
- 菜品状态：`assets/food_state/`
- 流程与配置：`assets/script/`
- 剧情清单：`assets/story_state_manifest.json`
- 静态构建：`out/`
