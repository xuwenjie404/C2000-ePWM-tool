# C2000 ePWM Tool

> 在浏览器里完成 TI C2000（F28003x / F28004x / F2837x / F2833x）的 ePWM 子模块配置，
> 实时看到**死区波形**，一键生成可直接编译的 **C 代码**。

一个纯前端的单页应用：不依赖任何服务器，`dist/` 可以放在 GitHub Pages、
内网 Nginx 或者直接双击 `index.html` 打开。

---

## 1. 在线使用 / 本地运行

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # 产物在 dist/，静态托管即可
npm test             # 74 个单元测试
```

工程会自动保存到浏览器 `localStorage`；顶栏「分享链接」会把整套配置压缩进 URL 的
`#p=...`，贴到 issue / 聊天里别人打开就是你看到的同一份参数。也可导出 / 导入 JSON。

---

## 2. 功能一览

| 分区 | 能力 |
| --- | --- |
| 时基 | 自动求解 `CLKDIV / HSPCLKDIV / TBPRD`，给出实际频率误差与占空比 LSB；频率不可达时给出钳位提示 |
| 计数模式 | 增减对称（`UP_DOWN`）与单向递增（`UP`），两种模式的比较值语义与 AQ 配置完全分开处理 |
| 死区 | `AHC / ALC / AH / AL / BYPASS` 五种输出模式，`DBA_ALL / DBB_* / DBB_ALL` 四种输入源，`DBRED`/`DBFED` 独立可调，支持对称锁定 |
| 波形 | 按 TRM 边沿延迟语义**仿真** ePWMxA / ePWMxB，实时显示死区阴影、占空比损失、脉宽被吞告警；可直接拖拽 RED / FED / Duty / 移相手柄 |
| 移相 | 自动选择 `PHSDIR = UP / DOWN` 并换算 `TBPHS`，主模块输出 `SYNCOSEL = CTR_ZERO` 同步脉冲 |
| 调制 | 固定占空比 / SPWM / SVPWM（最大最小值零序注入），可调调制比与基波频率，实时包络图 + 电角度扫描动画 |
| 保护 | Trip-Zone（TZ1~TZ6、OST/CBC、强制低/高/高阻、中断）、事件触发 ADC 采样（ETSEL/ETPS） |
| 引脚 | CubeMX 风格复用图，点击备选引脚即可切换 GPIO 映射并同步到代码；自动检测引脚冲突 |
| 校验 | 时基可达性、死区溢出、死区吞脉冲、窄脉宽、引脚冲突、过调制、采样点数不足等规则 |
| 代码 | `main.c` / `epwm_config.c` / `epwm_config.h` 三文件，Bit-Field 与 DriverLib 双风格，中英双语注释，含 SPWM/SVPWM 实时调制 ISR |
| 预设 | 三相逆变、三相整流、三相交错、全桥移相、图腾柱 PFC、同步 Buck、LLC、四桥臂 |

> 界面所有文字均不小于 16 px（12 pt），方便投屏评审与现场调试。

---

## 3. 关键计算模型

这部分是本工具的「可信度」，也是与随手画波形最大的区别。

### 3.1 时基求解

```
增减计数： f_sw = TBCLK / (2 · TBPRD)      ⇒ TBPRD = TBCLK / (2 f_sw)
单向计数： f_sw = TBCLK / (TBPRD + 1)      ⇒ TBPRD = TBCLK / f_sw − 1
```

在满足 `TBPRD ≤ 65535` 的前提下取**最小**的总分频比（`CLKDIV × HSPCLKDIV`），
从而让 `TBPRD` 尽可能大 —— 即占空比分辨率 `1/TBPRD` 最高。
用 `TBPRD` 反算实际频率并给出误差百分比，避免"以为设了 100 kHz 其实只有 99.8 kHz"。

### 3.2 动作限定子模块（AQ）

| 计数模式 | 配置 | 占空比 |
| --- | --- | --- |
| `UP_DOWN` | `CAU = CLEAR`，`CAD = SET` | `CMPA / TBPRD` |
| `UP` | `ZRO = SET`，`CAU = CLEAR`，`CAD = NO_ACTION` | `CMPA / (TBPRD + 1)` |

单向计数下如果照抄增减计数的 `CAU = CLEAR / CAD = SET`，`CAD` 事件永远不会发生，
输出会停在低电平 —— 这是很多"生成的代码不工作"的根因，本工具已修正。

### 3.3 死区传递函数

`DBRED` 延迟的是**开通沿**，`DBFED` 延迟的是**互补管的开通沿**：

```
互补型（AHC / ALC）：
    ePWMxA 高电平 = 原始高电平 − DBRED
    ePWMxB 高电平 = 原始低电平 − DBFED
    死区窗口 = DBRED（B 关断 → A 开通）+ DBFED（A 关断 → B 开通）
    AHC：死区期间两路皆低；ALC：整体反相，死区期间两路皆高

同相型（AH / AL）：
    两路取自同一条延迟链，高电平 = 原始高电平 − DBRED + DBFED，仅极性不同
```

当 `DBRED` 大于原始高电平宽度（或 `DBFED` 大于原始低电平宽度）时，脉冲会被硬件
**吞掉**，输出恒定 —— 工具会直接报错并指出需要减小哪一项。

`POLSEL` 的四种编码按 `AH = 0 / ALC = 1 / AHC = 2 / AL = 3` 输出，与
`EPwm_defines.h` 中的 `DB_ACTV_HI / DB_ACTV_LOC / DB_ACTV_HIC / DB_ACTV_LO` 对应。

> **注意**：不同代际的 TRM 对 `POLSEL` 的图形化解释略有差异。若你的板级驱动极性相反，
> 请改用 `ALC`（低有效互补）或在栅极驱动器侧调整，并以实测波形为准。

### 3.4 移相

同步脉冲来自主模块的 `CTR_ZERO`，从模块把 `TBCTR` 装载为 `TBPHS`：

```
PHSDIR = DOWN：延时 = TBPHS
PHSDIR = UP  ：延时 = 2·TBPRD − TBPHS
```

因此 `φ ∈ [0°, 180°]` 用 `PHSDIR = DOWN`，`φ ∈ (180°, 360°]` 自动换到 `PHSDIR = UP`，
保证 `TBPHS` 始终落在 `[0, TBPRD]` 内。单向计数模式下 `PHSDIR` 无效，工具会提示
"只能实现延时意义上的移相"。

### 3.5 HRPWM

按器件给出的 MEP 步进（150 ps）折算 `CMPAHR` 的 Q8 补偿量，并提示 Type-0 器件
需要周期调用 `SFO()` 完成校准。

---

## 4. 设计校验规则

| 规则 | 级别 | 说明 |
| --- | --- | --- |
| 目标频率不可达 | 错误 | TBPRD 超范围被钳位 |
| 死区吞掉脉宽 | 错误 | 输出恒定，桥臂失去驱动 |
| 引脚复用冲突 | 错误 | 两个信号抢同一物理引脚 |
| DBRED/DBFED 溢出 | 警告 | 超出位宽（F28335 为 10 bit） |
| 剩余脉宽 < 100 ns | 警告 | 驱动器 / 采样可能识别不了 |
| 过调制 | 警告 | SPWM > 1.0、SVPWM > 1.1547 |
| 每基波周期采样点 < 24 | 警告 | THD 会明显恶化 |
| Trip-Zone 未启用 | 提示 | 量产固件建议至少一个 OST 源 |
| 单向计数用于三相 | 警告 | 120° 移相精度受限 |

---

## 5. 生成的代码

```
main.c            初始化序列、TBCLKSYNC 时序、中断注册、主循环
epwm_config.c     GPIO 复用 + 每个通道一个 EPWM_initChN() + 调制 ISR + Trip-Zone
epwm_config.h     函数原型与全局符号
```

* **Bit-Field 风格**：`EPwm1Regs.TBPRD = 3000U;`，配 `F28x_Project.h`
* **DriverLib 风格**：`EPWM_setTimeBasePeriod(EPWM1_BASE, 3000U);`，配 `driverlib.h`

DriverLib 版本只使用 C2000Ware 里稳定的 API；对没有官方封装的字段（例如 `DBCTL` 的
`POLSEL` / `IN_MODE` / `OUT_MODE` 组合、`HRCNFG`）改用 `HWREGH(... + EPWM_O_xxx)`
精确写入，并在注释里标出位域构成，避免"猜一个不存在的函数名"。

生成物视为**可读的起点**，不是可以直接上生产固件：位域名在不同器件 / C2000Ware 版本间
可能略有差异，请以手头头文件为准。

---

## 6. 相对最初单文件版本的修正

原始版本（`dsp_epwm.tsx`，约 2280 行，全部逻辑塞在一个组件里）能跑，
但有几处会直接导致生成代码行为错误，重构时逐条修掉了：

| # | 问题 | 影响 | 处理 |
| --- | --- | --- | --- |
| 1 | 单向计数仍用 `CAU=CLEAR / CAD=SET` | `UP` 模式输出恒定低电平 | 按计数模式分别生成 AQ 配置 |
| 2 | `BYPASS` 只写了 `CMPB`，没有 `AQCTLB` | B 通道不动作 | 补齐 `AQCTLB` 与 `CMPCTL.SHDWB/LOADBMODE` |
| 3 | 死区模型把 `FED` 当成"下降沿提前" | 半桥只有单边死区，图上缺一半 | 改为 `RED` 延迟 A 开通、`FED` 延迟 B 开通的互补模型 |
| 4 | 波形是几何拼贴，脉宽被吞看不出来 | 隐藏了真实的炸管风险 | 改为按边沿延迟仿真并报错 |
| 5 | `F28335` 标记为不支持 HRPWM | 数据错误（该器件有 150 ps MEP） | 修正数据并区分 Type-0 写法 |
| 6 | `CMPA` 上限统一钳到 `TBPRD` | `UP` 模式 100% 占空比不可达 | 按 `TBPRD + 1` 计算 |
| 7 | DriverLib 风格只有 6 行，缺死区/AQ/TZ | 无法使用 | 补齐到与 Bit-Field 等价 |
| 8 | 无工程持久化，刷新即丢失 | 无法迭代 | localStorage + URL 分享 + JSON 导入导出 |

---

## 7. 工程结构

```
src/
  types.ts                 全局类型契约（不含任何 import，避免循环依赖）
  data/
    devices.ts             器件：主频、TBCLK、死区位宽、GPIO 复用表
    deadband.ts            DBCTL 输出/输入模式定义
    clock.ts               CLKDIV / HSPCLKDIV 档位常量
    presets.ts             典型拓扑预设
  lib/
    timebase.ts            时基求解 / 占空比换算 / 移相计算
    modulation.ts          SPWM / SVPWM 瞬时参考与占空比
    waveform.ts            死区波形仿真（纯函数，可单测）
    hardware.ts            工程 → 寄存器模型（每通道 CMPA/TBPHS/DBRED…）
    validation.ts          设计校验规则
    codegen.ts             C 代码生成（Bit-Field / DriverLib）
    project.ts             规范化 / URL 分享 / localStorage
    io.ts                  文件下载与剪贴板
  components/              UI 面板（Icon / ui / 8 个业务面板）
  App.tsx                  状态编排
```

计算层与 UI 层完全解耦：所有 `lib/*` 都是纯函数，测试里不需要 DOM。

---

## 8. 开发与测试

```bash
npm run typecheck        # tsc --noEmit
npm test                 # 74 个用例：时基 / 死区 / 调制 / 校验 / 代码生成 / SSR 冒烟
npm run build            # 类型检查 + 生产构建
```

> **受限环境提示**：如果在禁止子进程或原生模块的沙箱里运行，Vite 加载配置可能失败
> （`spawn EPERM`）。此时用 `npm run test:restricted` / `npm run build:restricted`，
> 它们会加上 `--configLoader native` 绕过配置打包。

CI（`.github/workflows/ci.yml`）在每次 push / PR 上跑类型检查、单测与构建。

---

## 9. 部署到 GitHub Pages

仓库已内置 `.github/workflows/deploy.yml`，构建时 `base: './'`，
所以**无论仓库叫什么名字、部署在哪个子路径都能直接跑**。

首次部署：

1. 在 GitHub 新建仓库 `C2000-ePWM-tool`（不要勾选初始化 README）；
2. 本地推上去：

   ```bash
   git remote add origin https://github.com/<你的用户名>/C2000-ePWM-tool.git
   git push -u origin main
   ```

3. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；
4. 等 Actions 里的 `Deploy to GitHub Pages` 变绿，访问：

   ```
   https://<你的用户名>.github.io/C2000-ePWM-tool/
   ```

之后每次 push 到 `main` 都会自动重新发布。

---

## 10. 如何扩充

* **加器件**：在 `src/data/devices.ts` 增加一条 `DeviceModel`（时基时钟、死区位宽、
  GPIO 复用表、电源引脚）。UI、计算与代码生成会自动适配，不需要改组件。
* **加拓扑预设**：在 `src/data/presets.ts` 追加一条 `Preset`。
* **加死区模式**：在 `src/data/deadband.ts` 补齐 `polsel / kind / invert` 三个字段即可，
  波形仿真与代码生成共用同一份定义。
* **加校验规则**：在 `src/lib/validation.ts` 里 push 一条 `DiagnosticIssue`。

改动后记得补一条对应的单元测试。

---

## 11. 已知限制

* GPIO 复用表只覆盖 `ePWM1~ePWM4`（UI 最多 4 个桥臂），且引脚号对应特定封装，
  换封装需要按数据手册核对；
* 交叉输入模式（`DBB_RED_DBA_FED` / `DBA_RED_DBB_FED`）的**波形显示**按 `DBA_ALL`
  等效绘制（界面会标注「示意」），寄存器配置与生成代码仍严格按所选模式输出；
* 未包含 Digital Compare（DC）子模块的完整配置、eCAP / eQEP；
* 没有做时序仿真（只做稳态波形），也不替代 TI SysConfig。

## 12. Roadmap

- [ ] Digital Compare + X-BAR 配置（DCAEVT/D CBEVT 触发 TZ）
- [ ] 死区与最小脉宽的自动求解（给定期望死区反推 TBPRD 下限）
- [ ] 导出 `.syscfg` 片段
- [ ] 二/三电平 SVPWM 扇区可视化
- [ ] 多套配置 A/B 对比

---

## 许可

MIT，见 [LICENSE](./LICENSE)。

生成代码仅作设计参考，**上电前必须自行复核并用示波器确认死区与最小脉宽**。
