# 烹语剧场 2D 交互配置

## 路由与数据边界

- 菜谱实训：`/cook/`，保持原版 25 道菜、99 个步骤和原有 session。
- 烹语剧场：`/cook/story/`，使用独立 `simulating-cook:story-session:v1`。
- 经典厨房：`/cook/classic/`，本次不修改。
- 旧入口：`/cook/3d/` 仅显示升级提示并跳转 `/cook/story/`，不加载 3D 资源。

## 固定布局

| 区域 | 内容 |
| --- | --- |
| 左侧 62% | `assets/bg/kitchen_bg.png`、六个透明点击热区和当前步骤组合状态图 |
| 右侧 38% | 夏弥立绘、姓名牌、对话、单点轻提问与纠错说明 |
| 底部 | 当前菜名、步骤、百分比进度、语音开关、返回菜谱和继续按钮 |

热区固定为 `fridge`、`sink`、`cutting_board`、`stove`、`seasoning`、`plate`。
舞台始终维持 `1344:768`，背景、组合状态图和透明热区共享同一百分比坐标系。

## 三层渲染

| 层级 | 内容 | z-index |
| --- | --- | --- |
| 底层 | 固定空厨房背景，使用 `100% 100%` 填满同比例舞台 | 0 |
| 中层 | 当前步骤 `normal / click / success / error` 组合状态图 | 20 |
| 顶层 | 六个透明操作热区；装盘步骤包含独立 `plate` 区域 | 10 |

当前组合状态图使用透明像素联合边界定位，金色高亮只包围可见对象，不给空热区绘制边框。
鼠标悬浮和正确点击先显示 `click`，180ms 后切换 `success`；错误态优先显示
`error`。键盘焦点仍保留可见焦点轮廓。

## Manifest

`assets/story_state_manifest.json` 是烹语剧场唯一的步骤配置来源。每个步骤包含：

- `recipeId`、`stepId`、`hotspot`
- `object`：对象名称、动作和“位置 + 对象 + 动作”提示
- `description`、`knowledge`、`correctText`
- `errorOperation`、`errorPrinciple`
- 四个状态素材路径
- 可选的一次轻提问

页面只读取 manifest，不硬编码具体菜品、步骤或错误分支。
`assets/story_object_bounds.json` 保存 99 个步骤四态透明像素的联合边界。

## 素材

- 99 个步骤，每个步骤 `normal / click / success / error` 四状态。
- 共 396 张 `512×512 RGBA` 透明 PNG。
- 命名固定为 `state_food_recipe_{recipeId}_step_{stepId}_{state}.png`。
- 正常态为主体母图，另外三态只增加统一柔光或描边，保证主体一致。
- 角色统一为 `768×1152 RGBA` 透明 PNG。

## 角色状态

正常流程循环：

```text
normal_xiami_01 -> normal_xiami_02 -> normal_xiami_03 -> normal_xiami_04
```

答对时显示 `correct_xiami.png`。答错时严格按以下时间轴播放：

| 时间 | 素材 | 状态 |
| --- | --- | --- |
| 0ms | `pre_error_xiami.png` | 夏弥愣住 |
| 300ms | `transform_01.png` | 黑红气场出现 |
| 600ms | `transform_02.png` | 龙角、尖刺与甲片出现 |
| 1000ms | `transform_03.png` | 人形龙化接近完成，翼状披挂展开 |
| 1100ms | `yemengjiade.png` | 黑发红瞳、黑灰尖刺甲片、龙角与翼状披挂的人形终态 |

相邻帧使用 opacity crossfade，禁止从常态直接硬切到终态。`prefers-reduced-motion` 下只取消缩放和闪烁，不移除时间轴。

## 正确与错误分支

- 点击正确热区或选择正确轻提问后，步骤完成并增加进度。
- 点击错误热区或选择错误答案后，不增加进度，进入龙化序列。
- 龙化结束后只显示正确操作和原理，点击“重新操作”回到当前步骤。
- 每道菜仅有一次轻提问，禁止连续提问。

## 兼容入口

GitHub Pages 无法返回 HTTP 301。`/cook/3d/` 页面先显示“3D模拟厨房已升级为【烹语剧场】2D互动版本”，随后通过客户端跳转 `/cook/story/`。
