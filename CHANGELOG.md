# 变更记录

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中

* Digital Compare 子模块配置（DCAEVT / DCBEVT 触发 TZ）
* 死区自动求解：给定期望死区反推 TBPRD 下限
* 二 / 三电平 SVPWM 扇区可视化
* 控制环代码生成（PI + 抗饱和 + 软启动，按拓扑选择结构）

---

## [2.4.0] — 极简界面 + 全站中英双语

### 新增

* **全站中英切换**：顶栏 `EN / 中文` 按钮，选择保存在
  `localStorage`（key `c2000-epwm-ui-lang`），也支持 `?lang=en` 直接进入英文
* i18n 采用 `t('中文', 'English')` 内联写法（`src/i18n/`），
  不做 key 字典 —— 文案与使用处永远在一起，不会出现死 key
* 校验规则的诊断文案也在规则内完成本地化（`RuleContext.t`），
  `validateProject(project, hw, lang)` 三参数版本

### 样式

* 整体改为极简：近单色石墨灰层次 + 1px 细线 + 单一冷灰蓝强调色
* 去掉所有阴影（`* { box-shadow: none }`），结构完全靠边框
* 徽标从「彩色填充」改为「描边 + 语义文字色」，错误/警告不再用色块
* 按钮：主操作用浅色实心，其余全部描边；分段选择器选中态只用明度差
* 圆角统一收小（`rounded-2xl` → `rounded-lg` / `rounded-md`）

---

## [2.3.0] — 频率上限放开、器件扩充、低饱和配色

### 变更

* **开关频率不再写死 500 kHz**：上限由器件 TBCLK 与计数模式推出
  （`120 MHz / 增减计数` 约 3 MHz），下限覆盖 10 Hz；
  `src/lib/limits.ts` 统一计算可行域，导入工程与切换器件时自动夹紧
* 频率滑块改为**对数刻度**：0.01 kHz ~ 3 MHz 跨 5 个数量级，线性滑块拖不到低频段
* 选择器件 / 切换计数模式后，若当前频率落到新可行域外会自动夹紧并提示

### 新增

* 器件：`TMS320F28377D`（200 MHz 双核 / 100 MHz TBCLK / 12 路）与
  `TMS320F280025C`（100 MHz / 8 路）；引脚复用表沿用同族器件，需按封装核对
* 10 个频率可行域单测（含「区间内任意频率都能被时基求解器接受」的交叉验证）

### 样式

* 配色改为低饱和「仪器面板」风格：中性石墨灰底 + 雾蓝主强调 +
  苔绿 / 黄铜 / 陶土红三档语义色；做法是在 `@theme` 重定义色阶，
  组件类名不变，全局饱和度一次性降下来

---

## [2.2.0] — 运行时参数 API

把「频率 / 占空比 / 相位」从寄存器操作升级为可调用的参数接口，
下游控制代码不再需要推导 TBPRD / CMPA / TBPHS 的换算关系。

### 新增

* 生成 `epwm_api.c` / `epwm_api.h`：
  `EPWM_setFrequency` / `EPWM_setDuty` / `EPWM_setPhase` / `EPWM_setParam`，
  以及 `EPWM_actualFswKhz` / `EPWM_lastCmpa` / `EPWM_getParam`
* 改频率时自动按原占空比与相角重算 CMPA / TBPHS，参数语义不变
* CMPA 始终夹在 `[1, TBPRD-1]`，避免出现恒定输出
* `src/lib/runtimeApi.ts`：与 C 端一一对应的换算法，单测交叉验证与设计期求解器一致
* `docs/RUNTIME-API.md`：接口说明、限制（分频固定 / 死区非影子 / 需 FPU）、闭环接入骨架
* 12 个代码生成测试 + 11 个换算测试（共 153 个）

### 变更

* 生成文件从 3 个变为 5 个（新增 `epwm_api.c` / `epwm_api.h`）
* `main.c` 增加 `#include "epwm_api.h"` 并指向运行时接口

---

## [2.1.0] — 平台化

把「能跑的网页」升级为「可持续维护的平台」：内核与界面解耦，扩展点走注册表。

### 新增

* **headless 内核入口** `src/engine/index.ts`，构建产物 `dist-engine/engine.js`（纯 ESM，无 React 依赖）
* **CLI** `bin/epwm.mjs`：`init` / `build` / `check` / `presets`，支持「配置即代码」的 CI 流水线
* **注册表** `src/platform/registry.ts`，四个扩展点全部改为注册制：
  `deviceRegistry` / `topologyRegistry` / `validationRegistry` / `codegenRegistry`
* **校验规则插件化**：`src/lib/rules/` 按 domain 拆分，新增规则无需改动 `validateProject()`
* **代码生成目标插件化**：新增 **Markdown 设计表**目标，用于评审与归档
* **工程版本迁移** `migrateProject()`：可直接导入原始单文件工具导出的 v0 工程
* **JSON Schema** `schema/project.schema.json` + ajv 契约测试
* **错误边界**：单个坏配置不再白屏，提供「清空本地工程并重载」逃生通道
* **拓扑注册表**：拓扑定义从 `App.tsx` 搬到 `src/data/topologies.ts`
* 文档体系：`docs/ARCHITECTURE.md`、`docs/EXTENDING.md`、`docs/CONFIG-SCHEMA.md`、`docs/CLI.md`
* 示例工程 `examples/three-phase-inverter.epwm.json` 与 `examples/legacy-v0.epwm.json`

### 变更

* `ProjectState.codeStyle` → `codeTarget`（旧字段仍可识别）
* `generateCode()` 的导出位置迁移到 `src/lib/targets`，按 `codeTarget` 从注册表分发
* 校验规则从 11 条扩展到 19 条（新增死区不对称、独立时基、TZ 无动作等）
* 测试从 74 个增加到 105 个

### 修复

* 规则执行抛异常会中断整张校验列表的问题（现在隔离为单条 error）

---

## [2.0.0] — 工程化重构

把 2280 行单文件组件重构为可维护、可测试、可自动部署的 TypeScript 工程。

### 修复（原实现会生成错误代码）

* **单向计数 AQ 配置错误**：`UP` 模式沿用 `CAU=CLEAR / CAD=SET`，`CAD` 永不触发，输出恒定低电平
* **BYPASS 模式 B 通道不动**：只写 `CMPB` 未配 `AQCTLB`
* **死区模型错误**：把 `FED` 当作下降沿提前，导致半桥只有单边死区
* **`UP` 模式占空比上限**：`CMPA` 被错钳到 `TBPRD`（应为 `TBPRD+1`）
* **`F28335` 的 HRPWM 数据错误**：该器件确有 150 ps MEP
* **DriverLib 输出残缺**：补齐死区 / AQ / TZ / HRPWM / ADC 触发
* **DBCTL 位序**：按 `IN_MODE[1:0] / POLSEL[3:2] / OUT_MODE[5:4]` 精确写入

### 新增

* 设计校验：时基可达性、死区溢出、**脉宽被吞**、窄脉宽、引脚冲突、过调制
* Trip-Zone 保护与 ADC 采样触发（配置 + 代码）
* 三文件代码生成（`main.c` / `epwm_config.c` / `epwm_config.h`），中英双语注释
* 8 套拓扑预设；localStorage 自动保存、URL 分享、JSON 导入导出
* GitHub Actions：CI 与 GitHub Pages 自动部署
* 74 个单元测试（时基 / 死区 / 调制 / 校验 / 代码生成 / SSR 冒烟）

---

## [1.0.0] — 原始版本

单文件 React 组件 `dsp_epwm.tsx`（约 2280 行），支持时基计算、死区、SPWM/SVPWM、
CubeMX 风格引脚图与 C 代码生成。存档于 [`legacy/`](../legacy/)。
