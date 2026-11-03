# 架构

本文说明「为什么这样分层」，以及改动时必须守住的不变量。
如果只想加功能，直接看 [EXTENDING.md](EXTENDING.md)。

---

## 1. 分层

```
src/
├── types.ts                 全局类型契约（不 import 任何模块，避免循环依赖）
├── platform/
│   └── registry.ts          通用注册表（器件/拓扑/规则/代码目标共用）
├── data/                    数据层：只声明「有什么」，不含算法
│   ├── devices.ts           器件 + GPIO 复用表 + deviceRegistry
│   ├── deadband.ts          DBCTL 输出/输入模式 + 极性语义
│   ├── clock.ts             CLKDIV / HSPCLKDIV 档位
│   ├── presets.ts           典型参数预设
│   └── topologies.ts        桥臂拓扑 + topologyRegistry
├── lib/                     计算层：纯函数，无 DOM / 无 React / 无副作用
│   ├── timebase.ts          时基求解、占空比换算、移相
│   ├── modulation.ts        SPWM / SVPWM 瞬时参考
│   ├── waveform.ts          死区波形仿真（边沿延迟模型）
│   ├── hardware.ts          ProjectState → HardwareModel（寄存器值）
│   ├── rules/               校验规则插件 + validationRegistry
│   ├── targets/             代码生成目标 + codegenRegistry
│   ├── codegen.ts           C 代码 emitter（Bit-Field / DriverLib）
│   ├── project.ts           规范化 / 迁移 / URL 分享 / 本地存储
│   └── io.ts                浏览器下载与剪贴板
├── engine/
│   └── index.ts             对外唯一入口（headless，dist-engine 的源点）
├── components/              UI：只做展示与交互，不含业务算法
└── App.tsx                  状态编排（脏活都在这里，但只调 lib）
```

依赖方向是单向的：

```
components → App → engine → lib → data → types
                              ↘ platform
```

`lib` 不允许 import `components`；`data` 不允许 import `lib`。
这条规则由 `src/engine/index.ts` 的导出面（不导出任何组件）与 code review 共同保证。

---

## 2. 数据流

```
        ProjectState（用户意图，可序列化）
              │
      resolveHardware()
              ↓
        HardwareModel（每个通道的 TBPRD / CMPA / TBPHS / DBRED / DBFED + 波形）
              │
    ┌─────────┼──────────────────┬────────────────────┐
    ↓         ↓                  ↓                    ↓
波形渲染   校验规则          代码目标             设计表
(UI)   validateProject    generateCode         (Markdown)
              ↓                  ↓
      DiagnosticIssue[]     GeneratedFile[]
```

关键点：

* **`ProjectState` 是唯一真相**。UI 的所有编辑都只是把它换成新对象；
  分享链接、localStorage、`.epwm.json` 全是它的序列化形式。
* **`HardwareModel` 是派生值**，不存储。它把「用户想设 300 ns 死区」翻译成
  「DBRED = 36，因为 TBCLK 是 120 MHz、8.333 ns 一拍」。
* 下游（波形 / 校验 / 代码 / 文档）都**只读** `HardwareModel`，互相不依赖。
  所以加一个输出格式不会影响校验，反之亦然。

---

## 3. 注册表（扩展点）

`src/platform/registry.ts` 提供最小可用的 `Registry<T>`：

```ts
register(item, { override })  // 重复 id 默认抛错，避免扩展静默互相覆盖
get / require / has / list / ids / unregister
```

四张表：

| 注册表 | 类型 | 扩展影响面 |
| --- | --- | --- |
| `deviceRegistry` | `DeviceModel` | 器件下拉、引脚图、时基求解、代码生成 |
| `topologyRegistry` | `Topology` | 拓扑按钮、换拓扑时的通道重建 |
| `validationRegistry` | `ValidationRule` | 设计校验面板 |
| `codegenRegistry` | `CodegenTarget` | 代码面板的目标切换与产物 |

设计取舍：

* **不用字符串分支**。`if (target === 'BITFIELD') …` 这种写法每加一种格式就要改三处；
  注册表让新增等于「注册一次」。
* **默认禁止覆盖**。多人扩展时，同 id 覆盖通常意味着冲突，而不是需求；
  需要覆盖必须显式 `{ override: true }`。
* **规则独立失败**。`validateProject()` 对每条规则 try/catch，
  一条规则抛异常只产生一条 `rule-crash-*` 诊断，不影响其它规则与 UI。

---

## 4. 计算模型

### 4.1 时基

```
增减计数：f_sw = TBCLK / (2·TBPRD)      ⇒ TBPRD = TBCLK / (2·f_sw)
单向计数：f_sw = TBCLK / (TBPRD + 1)    ⇒ TBPRD = TBCLK / f_sw − 1
TBCLK = EPWMCLK / (CLKDIV × HSPCLKDIV)
```

求解策略：在 `TBPRD ≤ 65535` 的前提下取**最小**总分频比，
使 `TBPRD` 尽量大 ⇒ 占空比分辨率 `1/TBPRD` 最高。
求解后反算实际频率并给出误差，避免「以为 100 kHz、其实 99.8 kHz」。

### 4.2 动作限定（AQ）

| 计数模式 | 配置 | 占空比 |
| --- | --- | --- |
| `UP_DOWN` | `CAU=CLEAR`、`CAD=SET` | `CMPA / TBPRD` |
| `UP` | `ZRO=SET`、`CAU=CLEAR`、`CAD=NO_ACTION` | `CMPA / (TBPRD+1)` |

单向计数若沿用 `CAD=SET`，该事件永不发生，输出会停在低电平。
这是原实现最隐蔽的缺陷，现在由 `codegen.test.ts` 的两个用例锁死。

### 4.3 死区

`DBRED` 延迟的是**开通沿**，`DBFED` 延迟的是**互补管的开通沿**：

```
互补型（AHC/ALC）：
    A 高电平 = 原始高电平 − DBRED
    B 高电平 = 原始低电平 − DBFED
    死区窗口 = DBRED（B 关断→A 开通） + DBFED（A 关断→B 开通）
    AHC：死区期间两路皆低；ALC：整体反相，死区期间两路皆高

同相型（AH/AL）：
    两路共用一条延迟链，高电平 = 原始高电平 − DBRED + DBFED，仅极性不同
```

`POLSEL` 编码：`AH=0 / ALC=1 / AHC=2 / AL=3`，对应
`DB_ACTV_HI / DB_ACTV_LOC / DB_ACTV_HIC / DB_ACTV_LO`。

> 不同代际 TRM 的图示解释略有差异。若板级驱动极性相反，改用 `ALC` 并以实测波形为准。

### 4.4 移相

```
PHSDIR = DOWN：延时 = TBPHS
PHSDIR = UP  ：延时 = 2·TBPRD − TBPHS
```

`φ ∈ [0°,180°]` 用 DOWN，`(180°,360°]` 自动换 UP，保证 `TBPHS ∈ [0, TBPRD]`。

### 4.5 HRPWM

按器件 MEP 步进折算 `CMPAHR` 的 Q8 补偿量。Type-0 器件另需周期调用 `SFO()` 校准，
生成代码里会带注释提示。

---

## 5. 不变量（改动时请守住）

1. `src/lib/**` 不得 import `react` / `../components/**`；
2. `ProjectState` 的任何字段变化，必须同时更新 `schema/project.schema.json`、
   `sanitizeProject()` 与 `SCHEMA_VERSION`；
3. 注册项 `id` 一旦发布不得更改（会出现在 URL、文件名与分享链接里）；
4. 新增校验规则必须给出可操作的 `detail`（告诉用户改哪个参数），
   只写「配置有误」不算完成；
5. 生成代码的改动必须同时更新 `codegen.test.ts` 的断言 —— 代码是本项目的最终交付物。

---

## 6. 为什么把逻辑从组件里搬出来

原始版本约 2280 行，全部在一个 `App` 组件里。它带来三个具体后果：

* **无法测试**：想知道「死区 300 ns 时波形对不对」，只能开浏览器肉眼看；
* **无法复用**：想在 CI 里校验一份旧工程，只能人肉点一遍界面；
* **无法演进**：加一颗芯片要改 5 个地方（数据、计算、下拉框、引脚图、代码生成），
  每次都要重新确认有没有漏。

现在的结构把这三件事分别交给：`lib`（纯函数单测）、`engine`（headless + CLI）、
注册表（扩展不侵入）。代价是文件数量变多，收益是可以长期维护。
