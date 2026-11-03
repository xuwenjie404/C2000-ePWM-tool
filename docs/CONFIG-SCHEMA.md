# 工程文件与版本迁移

工程文件（`.epwm.json`）是这个平台唯一的持久化格式：
网页的分享链接、本地自动保存、CLI 输入、CI 里的「配置即代码」都用它。

---

## 1. 结构

顶层即 `ProjectState`（定义见 `src/types.ts`）：

```json
{
  "schemaVersion": 3,
  "deviceId": "F280039C",
  "freqKhz": 20,
  "countMode": "UP_DOWN",
  "phaseSystem": "3P",
  "subTopology": "3P_3LEG",
  "threePhaseSyncLock": true,
  "modulationMode": "SVPWM",
  "modIndex": 0.95,
  "fundFreqHz": 50,
  "elecAngleDeg": 35,
  "channels": [
    {
      "id": 1,
      "name": "U 相桥臂 (Phase U)",
      "enabled": true,
      "independentFreq": false,
      "customFreqKhz": 100,
      "duty": 50,
      "dutyB": 50,
      "phase": 0,
      "redNs": 300,
      "fedNs": 300,
      "lockDb": true,
      "mode": "AHC",
      "inMode": "DBA_ALL",
      "muxIdxA": 0,
      "muxIdxB": 0,
      "hrpwm": false
    }
  ],
  "tripZone": {
    "enabled": false,
    "sources": ["TZ1"],
    "action": "OST",
    "outA": "FORCE_LOW",
    "outB": "FORCE_LOW",
    "interrupt": true
  },
  "adcTrigger": { "enabled": true, "source": "CTR_ZERO", "prescale": 1 },
  "hrpwm": false,
  "codeTarget": "BITFIELD",
  "commentLang": "CN"
}
```

完整约束见 [`schema/project.schema.json`](../schema/project.schema.json)（JSON Schema draft-07）。

字段语义速查：

| 字段 | 含义 | 备注 |
| --- | --- | --- |
| `schemaVersion` | 结构版本 | 由 `migrateProject()` 升级 |
| `deviceId` | 器件 id | 对应 `DeviceModel.id` |
| `subTopology` | 拓扑 id | 对应 `Topology.id` |
| `channels[].duty` | ePWMxA 占空比 % | 0.5 ~ 99.5 |
| `channels[].redNs` | 上升沿死区 ns | 换算成 DBRED 计数 |
| `channels[].mode` | DBCTL.POLSEL 组合 | `AH/ALC/AHC/AL/BYPASS` |
| `channels[].inMode` | DBCTL.IN_MODE | 四种输入源 |
| `channels[].muxIdxA/B` | 复用备选索引 | 指向 `muxOptions` 的下标 |
| `codeTarget` | 代码生成目标 | `BITFIELD/DRIVERLIB/MARKDOWN` |
| `commentLang` | 代码注释语言 | `CN/EN`（不影响 UI 文案） |

---

## 2. 版本策略

* `SCHEMA_VERSION` 当前为 **3**；
* **只增不改**：任何历史版本的工程文件都必须能被导入，否则用户存了三年的文件会打不开；
* 迁移函数写在 `src/lib/project.ts` 的 `migrateProject()` 里，按 `switch (version)` 分段：

```ts
export function migrateProject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  let doc = { ...(raw as Record<string, unknown>) };
  const version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;

  switch (version) {
    case 0: {
      // v0 → v3：原始单文件工具的导出（selectedDspId / version）
      doc = { ...doc, deviceId: doc.deviceId ?? doc.selectedDspId };
      delete doc.selectedDspId;
      delete doc.version;
      break;
    }
    default:
      break;
  }
  return { ...doc, schemaVersion: SCHEMA_VERSION };
}
```

新增版本时：

1. `SCHEMA_VERSION` 加一；
2. 在 `switch` 里加一个 `case`（只做**结构搬迁**，不做数值校验）；
3. 更新 `schema/project.schema.json` 与本文；
4. 在 `src/lib/project.test.ts` 补一条「旧版本能升级」的用例；
5. 在 `CHANGELOG.md` 记一笔。

`migrateProject()` 之后统一交给 `sanitizeProject()`：

* 逐字段校验类型与范围（非法值 → 回退默认）；
* 补齐新增字段的默认值；
* 强制不变量（主通道 `phase = 0`、`independentFreq = false`、通道数 ≤ 4）。

因此**手写一份缺少字段的 JSON 也能导入**，不会被拒。

---

## 3. 兼容原始版本的导出

原始 `dsp_epwm.tsx` 导出的 JSON 是 v0 格式（无 `schemaVersion`，器件字段叫 `selectedDspId`）。
直接拖进网页或用 CLI 都能用：

```bash
node bin/epwm.mjs check examples/legacy-v0.epwm.json
```

测试见 `src/lib/project.test.ts` 与 `src/lib/schema.test.ts`。

---

## 4. 编辑器支持

把以下片段加进 VS Code 的 `settings.json`，`.epwm.json` 就会有补全与校验：

```json
{
  "json.schemas": [
    {
      "fileMatch": ["*.epwm.json"],
      "url": "./schema/project.schema.json"
    }
  ]
}
```

---

## 5. 分享链接

```ts
encodeProjectToHash(project)   // 整个工程 JSON → base64url
buildShareUrl(project)         // 生成 https://host/path#p=<payload>
decodeProjectFromHash(payload) // 反向还原，损坏时返回 null
```

注意：

* 链接包含完整工程（通常 1.5 ~ 2.5 KB），**不要把含客户信息的工程名分享出去**；
* 解码会走 `sanitizeProject()`，所以老链接在新版本里仍然能打开。
