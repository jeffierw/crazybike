<div align="center">

<h1>CRAZYBIKE · 暴走山地速降</h1>

<p><strong>单文件双端渲染（WebGPU + WebGL2）程序化山地速降竞速游戏 —— 820 米无缝延伸全景山脉、四大雕刻级生态地貌、持续 3D 立体车辙轨迹、真实平地兔子跳与大断崖腾空、喷墨彩带特技及实时 3D 机位预览。</strong></p>

<p>
  <a href="https://crazybike.yepw.dev"><strong>在线试玩 (crazybike.yepw.dev)</strong></a>
  &nbsp;·&nbsp;
  <a href="README.md">English</a> | <strong>中文</strong>
</p>

<p>
  <img src="https://img.shields.io/badge/WebGPU%20%2B%20WebGL2-10%20%E6%9D%A1%E7%AE%A1%E7%BA%BF-0ea5e9?style=flat-square" alt="WebGPU + WebGL2">
  <img src="https://img.shields.io/badge/%E5%8D%95%E6%96%87%E4%BB%B6-347.8%20KB%20(~114%20KB%20gz)-10b981?style=flat-square" alt="产物体积">
  <img src="https://img.shields.io/badge/%E9%9B%B6%E4%BE%9D%E8%B5%96-28%20%E4%B8%AA%E6%A8%A1%E5%9D%97-f59e0b?style=flat-square" alt="零外部依赖">
  <img src="https://img.shields.io/badge/%E8%87%AA%E5%8A%A8%E9%AA%8C%E8%AF%81-20%2F20%20%E9%80%9A%E8%BF%87-22c55e?style=flat-square" alt="校验全部通过">
</p>

<img src="docs/media/hero.jpg" alt="CrazyBike V7 红岩大峡谷 3D 车辙与速降" width="100%">

</div>

---

## 核心特性

- **WebGPU + WebGL2 双引擎（10 条着色管线）：** 内置单源强类型着色器语言（SSL），启动时编译为 WGSL 与 GLSL ES 3.00，提供 PCF 定向阴影、物理大气散射、ACES 电影级色调映射、辉光与速度自适应大气雾。
- **820 米无缝延伸全景山脉（彻底告别高空穿模）：** 采用指数延展地形网格（车手身后 `-66.5 m` 至前方 `+820 m`，两侧横向 `±560 m`，远裁剪面 `1800 m`），配合按山脉色调定制的地平线融合雾气，高速飞跃断崖高空俯瞰也完全看不到边界裁剪或露底。
- **四大雕刻级生态地貌与非方块远景：**
  - **红岩大峡谷（Red Rock Canyon）：** 消除体素锯齿的莫阿布平滑峡壁、风蚀砂岩石林（Hoodoos）与碎石基座、自然弯曲肘节仙人掌、沙漠溪流及融化入金色尘雾的纪念碑谷远方平顶山。
  - **苍翠松林道（Pine Forest）：** 7 层重叠垂枝茂密松树、高山花岗岩、白雪峰峦与山谷云海、无边界自由林道速降。
  - **火山黑砂脊（Volcanic Ridge）：** 三柱阶梯六棱柱玄武岩管风琴簇、熔岩流道、发光裂缝，远景火山口烟岚与余烬雾霭自然消隐。
  - **悬崖山城（Hillside Town）：** 坐落于厚重石灰岩护坡台基上的垂直地中海海岸别墅（外挑陶瓦坡顶、细长百叶窗框、木制凉亭与柏树三角梅），配合真透视投影波光海面与盘旋海鸥。
- **真实平地兔子跳 vs. 大断崖飞跃：** 在平地与缓坡轻点或蓄力按 `Space` 仅触发符合山地车物理感的干脆兔子跳（轻点 `~0.48 m`，满蓄 `~0.98 m`）；冲上木制跳台或悬崖边缘起跳点才爆发出 `11 m+` 腾空连招高度。
- **持续 3D 立体车辙与生态碎屑飞溅：** 新增独立 `tracks` 管线，随车手压弯倾角、甩尾与落地在地面压出深色车胎纹沟槽与两侧尘土棱缘（溪流中转为白浪水迹，跃起自动断线不悬空）；后轮实时抛起对应群落的沙砾、腐殖松针、火山火星与白色水花。
- **道具拾取对战与拟真拳脚动作：** 赛道与起跳点随机刷新 **氮气罐** 与 **水壶**（有限追踪 `≤ 26 m`）；无水壶时攻击随机打出 **人形直拳**（侧面推挤不击倒）或 **飞踹**（贴身踢飞击倒），擦碰对手或障碍物永不意外摔车，被击倒起身严格笔直复位。
- **实时 3D 机位预览与 8 大视角：** 点击任意机位按钮即刻刷新背景 3D 预览，并在右下角实时显示当前机位说明；头盔第一视角自动裁剪头部网格实现零穿模。
- **内存感知画质、自适应 AI 与 Lo-Fi 音景：** 自动识别设备内存/核心数分级画质（低/均衡/高），7 名 AI 随车辆改装与玩家表现动态调配强中弱节奏，搭配 Lo-Fi 背景鼓点与柔和风噪。

---

## 四大山脉与界面实拍

<table>
  <tr>
    <td width="50%">
      <img src="docs/media/redrock.jpg" alt="红岩大峡谷高空速降与无缝地平线" width="100%">
      <p align="center"><strong>红岩大峡谷</strong> —— 118 km/h 断崖俯冲、氮气拾取与 820m 无缝远景</p>
    </td>
    <td width="50%">
      <img src="docs/media/forest.jpg" alt="苍翠松林道七层松枝与林地车辙" width="100%">
      <p align="center"><strong>苍翠松林道</strong> —— 七层重叠松林、山谷云海与腐殖林道车辙</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/media/volcano.jpg" alt="火山黑砂脊六棱玄武岩与焦痕轨迹" width="100%">
      <p align="center"><strong>火山黑砂脊</strong> —— 阶梯玄武岩柱簇、火山口烟岚与地面压弯车辙</p>
    </td>
    <td width="50%">
      <img src="docs/media/town.jpg" alt="悬崖山城地中海海滨别墅与透视海浪" width="100%">
      <p align="center"><strong>悬崖山城</strong> —— 台基稳固接地海滨别墅、真透视海浪微光与飞翔海鸥</p>
    </td>
  </tr>
</table>

<p align="center">
  <img src="docs/media/settings.jpg" alt="实时机位预览与头盔第一视角" width="90%">
  <br>
  <em>视角机位实时 3D 预览与右下角状态说明浮标（头盔第一视角自动防穿模）</em>
</p>

---

## 操作指南

| 操作 | 按键 | 说明 |
| --- | --- | --- |
| **转向 / 蹬踏 / 刹车** | `WASD` / 方向键 | 压弯贴地俯冲、冲刺提速或入弯控速 |
| **跳跃起跳** | `Space` | 平地触发真实山地车兔子跳 · 跳台与断崖唇口爆发腾空 |
| **空中连招特技** | `空中 WASD` / `Space` | 高空连续喷墨特技（做完再接下一招 · 零摔车） |
| **水壶 / 拳脚搏击** | `Q` `E` / `J` `K` | 有水壶则有限距离追踪投掷（≤26m），无道具时随机直拳或飞踹 |
| **肾上腺素暴走** | `Shift` | 消耗肾上腺素或氮气道具加速冲刺 |
| **切换视角机位** | `V` / `Shift+V` / `1`–`8` | 切换 8 大机位，或在“视角”菜单点击实时 3D 预览 |
| **360° 环视 / 暂停** | 右键拖拽 / `Esc` | 随时观察环境与机位，或呼出暂停菜单 |
| **中英语言切换** | 顶部 `EN / 中文` | 实时切换界面语言 |

---

## 本地构建与运行

依赖 Node.js（Node 20+，无需安装任何第三方 npm 包）：

```bash
# 开发构建并运行全部 20 项自动化校验
node build.js && npm run verify

# 压缩构建生产单文件 -> dist/index.html (347.8 KB)
MIN=1 node build.js

# 启动本地 8080 端口服务（访问 ?backend=webgl2 可强制测试 WebGL2 回退后端）
npm start
```

---

## 工程结构（`src/` 共 `28` 个源码模块）

| 模块范围 | 核心职责 |
| --- | --- |
| `00a_i18n.js` – `00c_quality.js` | 中英双语词库、Lo-Fi 调式配乐表、内存/硬件自适应画质分级器 |
| `01_gfx.js` – `02_shaderlib.js` | `WebGPU` + `WebGL2` 统一抽象层与 SSL → WGSL / GLSL ES 3.00 转译器 |
| `03_course.js` – `05_sky.js` | 820m 指数无缝延伸地形、2D 雕刻远景山岚、山谷云海与真透视海浪 |
| `06_bikemesh.js` – `06b_rider_anim.js` | 11,181 顶点 SDF 车手模型、三段式直拳/飞踹人体骨骼及七层松枝/六棱玄武岩/坡屋顶网格 |
| `07_physics.js` – `09_combat.js` | 平地兔子跳/跳台分离物理、摔倒笔直复位、8 机位相机、连招系统与水壶/拳脚战斗 |
| `10_particles.js` – `15_wildlife.js` | `tracks` 持久 3D 车辙管线、生态颗粒飞溅、`Props.onHit` 弹簧摇晃、接地别墅植被与动物 |
| `16_career.js` – `99_main.js` | 12 场生涯赛事、车库升级、Web Audio 音频合成、UI 系统及主循环集成 |

`tools/verify-mvp.js` 在无头 Node.js 环境中对全套 **10** 条着色管线、SDF 建模、四大生态完整跑道、820m 地形延展范围、平地兔子跳 vs. 跳台抛高、3D 车辙与空中悬空断线、水壶/拳脚严格击倒规则执行 **20** 项全自动回归验证。
