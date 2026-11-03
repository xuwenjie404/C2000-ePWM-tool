# 扩展指南

五种最常见的扩展方式，每种都给出可直接照抄的代码与测试位置。
所有扩展都**不需要修改 UI 组件**。

---

## 1. 新增器件

位置：`src/data/devices.ts`

```ts
export const DEVICES: Record<string, DeviceModel> = {
  // …
  F2800137: {
    id: 'F2800137',
    name: 'TMS320F2800137',
    package: '64-Pin LQFP (PM)',
    series: 'Gen-3 C28x (Type-4 ePWM)',
    generation: 'TYPE4',
    sysclkMHz: 120,
    tbclkMHz: 120,
    epwmModules: 7,
    hasHRPWM: true,
    mepStepPs: 150,
    dbMaxBits: 14,
    dbMaxCount: 16383,
    desc: '低成本 120 MHz 型号。',
    muxOptions: {
      ePWM1A: [
        { pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' },
        { pin: 49, gpio: 'GPIO30', mux: 5, reg: 'GPAMUX2' },
      ],
      // …
    },
    powerPins: [1, 14, 25, 32, 51, 64],
  },
};
```

要点：

* `tbclkMHz` 是 **EPWMCLK 的频率**（不是 SYSCLK），F2837x 这类器件是 SYSCLK/2；
* `dbMaxBits` 决定 DBRED/DBFED 的溢出提示（F2833x 为 10 bit）；
* `muxOptions` 的 key 必须是 `ePWM<n>A` / `ePWM<n>B` 形式，UI 与代码生成按此拼接；
* 不需要注册：`deviceRegistry` 由 `DEVICES` 自动填充。

验证：`npm test` 中 `engine.test.ts` 的「每个器件都能解析出硬件模型」会自动覆盖新器件。

---

## 2. 新增拓扑

位置：`src/data/topologies.ts`

```ts
topologyRegistry.register({
  id: '3P_VIENNA',
  phaseSystem: '3P',
  label: '维也纳整流',
  hint: '三电平、单向，常见于三相 PFC',
  build: prev =>
    ['U 相', 'V 相', 'W 相'].map((name, i) =>
      makeChannel({
        id: i + 1,
        name,
        // 维也纳整流的上管是工频开关：可以给独立频率
        independentFreq: i === 0 ? false : false,
        redNs: prev.channels[0]?.redNs ?? 200,
        fedNs: prev.channels[0]?.fedNs ?? 200,
      }),
    ),
});
```

要点：

* `id` 会写进工程文件的 `subTopology`，发布后不要改；
* `build(prev)` 接收当前工程，用来继承用户已调好的死区等参数；
* 注册后 `ControlPanel` 会自动出现对应按钮（按 `phaseSystem` 过滤）。

验证：`engine.test.ts` 的「每个拓扑都能构建出合法通道」自动覆盖。

---

## 3. 新增校验规则

位置：`src/lib/rules/` 下新建文件（或在现有 domain 文件里追加），然后在 `rules/index.ts` 注册。

```ts
// src/lib/rules/thermal.ts
import type { DiagnosticIssue } from '../../types';
import type { ValidationRule } from './types';

export const gateDrivePowerCheck: ValidationRule = {
  id: 'thermal.gate-drive',
  scope: 'system',
  run({ hw, project }) {
    // 例：开关频率 × 总栅极电荷估算驱动损耗（示意）
    const totalQg = 60e-9;             // 单管栅极电荷
    const vgs = 15;
    const pGate = totalQg * vgs * hw.master.tb.actualFswKhz * 1e3 * hw.channels.length;
    if (pGate < 0.5) return [];
    const issue: DiagnosticIssue = {
      id: 'gate-drive-power',
      severity: 'warn',
      title: `栅极驱动总损耗约 ${pGate.toFixed(2)} W`,
      detail: `按每管 ${totalQg * 1e9} nC、${vgs} V、${hw.master.tb.actualFswKhz.toFixed(1)} kHz 估算。请确认驱动器功耗与散热余量。`,
    };
    return [issue];
  },
};
```

```ts
// src/lib/rules/index.ts
import { gateDrivePowerCheck } from './thermal';

validationRegistry
  // … 已有规则
  .register(gateDrivePowerCheck);
```

约定：

* 一条规则只回答一个问题，`id` 用 `domain.name` 命名；
* 返回空数组表示通过；
* `detail` 必须告诉用户**改哪个参数**；
* 规则抛异常不会拖垮整体（runner 会转成 `rule-crash-*` error），但请自己保证纯函数。

测试：参考 `src/lib/rules/rules.test.ts`，用 `validationRegistry.register()` +
`afterEach(unregister)` 注册测试规则，断言它出现/消失。

---

## 4. 新增代码生成目标

位置：`src/lib/targets/` 下新建文件，然后在 `targets/index.ts` 注册。

```ts
// src/lib/targets/csv.ts
import type { GeneratedFile, ProjectState } from '../../types';
import type { HardwareModel } from '../hardware';

export function produceCsv(project: ProjectState, hw: HardwareModel): GeneratedFile[] {
  const header = 'channel,tbprd,cmpa,tbphs,dbred,dbfed,mode';
  const rows = hw.channels
    .filter(c => c.cfg.enabled)
    .map(c =>
      [c.cfg.id, c.tb.tbprd, c.cmpa, c.syncEnabled ? c.phase.tbphs : 0, c.dbRed, c.dbFed, c.mode.short].join(','),
    );
  return [{ name: 'epwm_config.csv', language: 'md', content: [header, ...rows].join('\n') }];
}
```

```ts
// src/lib/targets/index.ts
codegenRegistry.register({
  id: 'CSV',                    // 需要同步扩展 types.ts 的 CodeTarget 联合类型
  label: 'CSV 参数表',
  description: '给 PLM / 测试台使用的扁平参数表。',
  language: 'markdown',         // 决定代码面板是否走高亮
  produce: produceCsv,
});
```

```ts
// src/types.ts
export type CodeTarget = 'BITFIELD' | 'DRIVERLIB' | 'MARKDOWN' | 'CSV';
```

同时更新：

* `src/lib/project.ts` 的 `CODE_TARGETS` 数组（决定合法值）；
* `schema/project.schema.json` 里 `codeTarget` 的 `enum`；
* 测试：`engine.test.ts` 的「切换代码目标」，补一条断言。

注册后代码面板会自动出现新目标按钮，`bin/epwm.mjs build -t CSV` 也能直接用。

---

## 5. 新增死区输出模式

位置：`src/data/deadband.ts`

```ts
export const DEADBAND_MODES = {
  // …
  // 例：仅 A 有效、关掉 B 的调试模式（假设 POLSEL 组合）
  A_ONLY: {
    id: 'A_ONLY',
    name: 'A_ONLY 仅 A 输出',
    short: 'A-ONLY',
    polsel: 0x0,
    polselBitfield: 'DB_ACTV_HI',
    kind: 'COMPLEMENTARY',
    invert: false,
    bypass: false,
    description: '调试用：只观察 A 通道。',
  },
} as const;
```

`kind` 决定波形仿真走哪条路径：

* `COMPLEMENTARY`：两路互补，死区期间同电平（AHC/ALC）；
* `DUAL_SAME`：两路同波形，仅极性不同（AH/AL）。

`polsel` 会直接写进生成的 `DBCTL.POLSEL`，务必对照 TRM 核对编码。

---

## 6. 想做但当前没有的

以下方向欢迎贡献，接口已预留：

| 方向 | 落点 |
| --- | --- |
| Digital Compare（DCAEVT/DCBEVT 触发 TZ） | `src/lib/rules/` 加规则 + `codegen.ts` 加配置块 |
| 多语言 UI | 目前 UI 文案为中文常量，需要引入 `t()` 字典层 |
| SysConfig `.syscfg` 片段导出 | 新增 `src/lib/targets/syscfg.ts` |
| 二/三电平 SVPWM 扇区可视化 | `src/components/WaveformPanel.tsx` + `lib/modulation.ts` |
| 死区自动求解（给定期望死区反推 TBPRD 下限） | `src/lib/rules/` 或新的 `lib/solver.ts` |
