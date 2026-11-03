# C2000 ePWM Tool

> TI C2000（F28003x / F28004x / F2837x / F2833x）ePWM 图形化配置与代码生成平台。
> **内核可脱离界面运行**：同一个引擎驱动网页、CLI 与 CI。

<sub>CI：类型检查 · 单测 · 构建 · CLI 端到端 ｜ 测试：105 个用例 ｜ 许可：MIT</sub>

---

## 为什么它是「平台」而不是一个网页工具

大多数同类工具把器件表、寄存器计算、波形绘制、代码拼字符串和 React 组件混在一个文件里。
一旦要加一颗新芯片、一条新校验规则、一种新的输出格式，就必须动 UI 代码 —— 这类项目通常在
第二次需求变更时开始腐化。

本项目的边界是**契约**，不是文件：

```
        ┌──────────────────────────── 消费方 ────────────────────────────┐
        │   Web UI (React)     CLI (bin/epwm.mjs)     CI / 第三方脚本     │
        └───────────────┬──────────────┬────────────────────┬───────────┘
                        │              │                    │
        ┌───────────────▼──────────────▼────────────────────▼───────────┐
        │                    src/engine（headless 内核）                  │
        │   resolveHardware → validateProject → generateCode             │
        └───────────────┬──────────────────────────────┬───────────────┘
                        │                              │
        ┌───────────────▼────────────┐   ┌─────────────▼──────────────┐
        │ 平台注册表（扩展点）          │   │ 纯函数计算层                 │
        │ device / topology /        │   │ timebase / waveform /       │
        │ validation-rule / codegen  │   │ modulation / rules          │
        └────────────────────────────┘   └────────────────────────────┘
```

四条硬性约束（由测试守着）：

1. **计算层零 DOM、零 React** —— `src/lib/**` 只依赖 `src/types.ts` 与 `src/data/**`；
2. **扩展点走注册表** —— 器件、拓扑、校验规则、代码生成目标都注册进 Registry，
   新增能力不需要修改已有文件；
3. **工程文件向后兼容** —— `schemaVersion` + `migrateProject()`，任何历史工程都能导入；
4. **同一份配置产出多种工件** —— C 代码（两种风格）、Markdown 设计表，未来可接任意格式。

因此下面这些事都能做，且不需要碰 UI：

| 想做的事 | 需要改的地方 |
| --- | --- |
| 增加一颗新器件 | `src/data/devices.ts` 加一条 |
| 增加一种拓扑（维也纳、T 型三电平…） | `src/data/topologies.ts` 加一条 |
| 增加一条设计校验 | `src/lib/rules/` 加一个规则并注册 |
| 增加一种输出格式（SysConfig 片段、CSV、JSON 汇总） | `src/lib/targets/` 加一个目标并注册 |
| 在 CI 里从工程文件重新生成代码 | `node bin/epwm.mjs build …` |

---

## 快速开始

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 105 个单元测试
npm run build:all      # 网页产物 dist/ + 内核产物 dist-engine/
```

### 就像用网页一样

打开界面 → 选拓扑与器件 → 调死区/移相/调制 → 右侧实时出代码。
工程自动存在浏览器本地；「分享链接」把整套参数压进 URL `#p=…`，贴给同事即可复现；
也可导出 `.epwm.json` 进版本库。

### 也像用库 / CLI 一样

```bash
# 生成一份工程（可选预设：3P_INV_SVPWM / 1P_FB_PS / BUCK_SYNC …）
node bin/epwm.mjs init 3P_INV_SVPWM -o firmware/epwm.json

# 由工程文件生成代码（配置即代码）
node bin/epwm.mjs build firmware/epwm.json -o firmware/generated

# 只做校验，有 error 时退出码 1（可直接卡 CI）
node bin/epwm.mjs check firmware/epwm.json
```

```js
// 作为库使用（dist-engine/engine.js 是纯 ESM，无 React 依赖）
import { sanitizeProject, resolveHardware, validateProject, generateCode } from './dist-engine/engine.js';
```

---

## 文档地图

| 文档 | 内容 |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 分层、数据流、注册表、不变量、为什么不把逻辑写在组件里 |
| [docs/EXTENDING.md](docs/EXTENDING.md) | 五个扩展配方：器件 / 拓扑 / 校验规则 / 代码目标 / 死区模式 |
| [docs/CONFIG-SCHEMA.md](docs/CONFIG-SCHEMA.md) | 工程文件结构、版本迁移策略、JSON Schema |
| [docs/CLI.md](docs/CLI.md) | 命令行用法与 CI 集成（配置即代码） |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 开发环境、提交规范、PR 检查项 |

---

## 功能一览

| 分区 | 能力 |
| --- | --- |
| 时基 | 自动求解 `CLKDIV / HSPCLKDIV / TBPRD`，给出实际频率误差与占空比 LSB；不可达时提示钳位 |
| 计数模式 | 增减对称与单向递增，两种模式的比较值语义与 AQ 配置完全分开处理 |
| 死区 | `AHC / ALC / AH / AL / BYPASS` × `DBA_ALL / DBB_* / DBB_ALL`，`DBRED`/`DBFED` 独立可调、可对称锁定 |
| 波形 | 按 TRM 边沿延迟语义**仿真** ePWMxA/B，显示死区阴影、占空比损失、脉宽被吞；拖拽 RED / FED / Duty / 移相手柄 |
| 移相 | 自动选择 `PHSDIR` 并换算 `TBPHS`，主模块输出 `SYNCOSEL = CTR_ZERO` |
| 调制 | 固定占空比 / SPWM / SVPWM（零序注入），实时包络图 + 电角度扫描 |
| 保护 | Trip-Zone（TZ1~TZ6、OST/CBC、强制低/高/高阻、中断）、事件触发 ADC 采样 |
| 引脚 | CubeMX 风格复用图，点击备选引脚切换映射，自动检测冲突 |
| 校验 | 19 条规则：时基可达性、死区溢出、脉宽被吞、窄脉冲、引脚冲突、过调制… |
| 输出 | C 代码三文件（Bit-Field / DriverLib）、Markdown 设计表，中英双语注释 |
| 预设 | 8 套典型拓扑 |

> 界面所有文字不小于 16 px（12 pt），便于投屏评审与现场调试。

---

## 关键计算模型（摘要）

完整的推导与寄存器映射见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#计算模型)。

```
增减计数：TBPRD = TBCLK / (2·f_sw)       占空比 = CMPA / TBPRD      （CAU=CLEAR, CAD=SET）
单向计数：TBPRD = TBCLK / f_sw − 1       占空比 = CMPA / (TBPRD+1)   （ZRO=SET, CAU=CLEAR）

互补死区：A 高电平 = 原始高电平 − DBRED
          B 高电平 = 原始低电平 − DBFED
          死区窗口 = DBRED（B→A）+ DBFED（A→B）

移相：    φ ≤ 180° → PHSDIR=DOWN,  TBPHS = φ/180° · TBPRD
          φ > 180° → PHSDIR=UP,    TBPHS = (360°−φ)/180° · TBPRD
```

`DBRED` 大于原始高电平（或 `DBFED` 大于原始低电平）时脉冲会被硬件**吞掉**，
输出恒定 —— 工具会直接报 error，这是最容易在调试台上浪费一整天的坑。

---

## 质量与工程化

* **105 个单元测试**：计算内核、死区波形、校验规则、代码生成、版本迁移、JSON Schema、注册表、SSR 冒烟；
* **契约测试**：`schema/project.schema.json` + ajv，防止代码与数据契约漂移；
* **CI**：类型检查 → 测试 → 构建 → 内核构建 → CLI 端到端；
* **部署**：push 到 `main` 自动发布 GitHub Pages（`base: './'`，任意子路径可用）；
* **错误边界**：单个坏配置不会白屏，保留「清空本地工程并重载」的逃生通道。

---

## 部署到 GitHub Pages

首次：

```bash
git remote add origin https://github.com/<用户名>/C2000-ePWM-tool.git
git push -u origin main
```

仓库 **Settings → Pages → Source** 选择 **GitHub Actions**，等待
`Deploy to GitHub Pages` 变绿后访问 `https://<用户名>.github.io/C2000-ePWM-tool/`。

---

## 已知限制

* GPIO 复用表覆盖 `ePWM1~ePWM4`（UI 最多 4 个桥臂），引脚号对应特定封装；
* 交叉 `IN_MODE` 的**波形显示**按 `DBA_ALL` 等效绘制（界面标注「示意」），寄存器配置仍严格按所选模式；
* 未包含 Digital Compare 完整配置、eCAP / eQEP；
* 只做稳态波形，不做时序仿真，也不替代 TI SysConfig；
* UI 文案目前中文为主（内核注释支持中英），多语言在路线图中。

路线图见 [CHANGELOG.md](CHANGELOG.md#roadmap)。

---

## 许可与免责

MIT，见 [LICENSE](LICENSE)。

生成代码仅为设计参考，**上电前必须自行复核并用示波器确认死区与最小脉宽**。
