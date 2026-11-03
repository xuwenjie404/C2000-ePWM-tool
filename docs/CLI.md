# 命令行（配置即代码）

CLI 让 ePWM 配置回到版本控制里：**参数是 JSON，代码是生成物，CI 负责一致性。**

```
bin/epwm.mjs  →  dist-engine/engine.js  →  src/lib/**
```

CLI 只是内核的一个消费者，不含任何业务逻辑 —— 它和网页用的是同一份计算与代码生成实现。

---

## 1. 准备

```bash
npm install
npm run build:engine      # 产出 dist-engine/engine.js（CLI 依赖它）
```

> 也可以 `npm run build:all`，同时产出网页与内核。

---

## 2. 命令

### `init` —— 从预设生成工程

```bash
node bin/epwm.mjs init 3P_INV_SVPWM -o firmware/epwm.json
node bin/epwm.mjs presets            # 查看全部预设 id
```

### `build` —— 由工程生成代码/文档

```bash
node bin/epwm.mjs build firmware/epwm.json -o firmware/generated
node bin/epwm.mjs build firmware/epwm.json -o out -t MARKDOWN    # 只出设计表
node bin/epwm.mjs build firmware/epwm.json -o out -t DRIVERLIB   # 覆盖工程的 codeTarget
```

输出示例：

```
器件 TMS320F280039C · 3P/3P_3LEG · 20.000 kHz · TBPRD 3000
  INFO Trip-Zone 保护未启用
       量产固件建议至少配置一个 OST 单次跳闸源…
  + firmware/generated/main.c
  + firmware/generated/epwm_config.c
  + firmware/generated/epwm_config.h

生成 3 个文件 → firmware/generated
```

### `check` —— 只校验

```bash
node bin/epwm.mjs check firmware/epwm.json
```

输出 `0 error / 0 warn / 1 info` 之类的汇总。

---

## 3. 退出码

| 码 | 含义 |
| --- | --- |
| `0` | 成功（可能存在 warn / info，但没有 error） |
| `1` | 工程存在 **error** 级问题（如脉宽被死区吞掉、引脚冲突），或命令用法错误 |
| `2` | 环境问题：找不到 `dist-engine/engine.js`、工程文件不存在、JSON 解析失败 |

`build` 同样遵守退出码约定：**即使生成了文件，只要存在 error 也返回 1**，
方便在 CI 里两者同时使用。

---

## 4. 在 CI 里用

```yaml
# .github/workflows/firmware.yml（示例）
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build:engine

      # 1. 校验：参数不安全就直接失败
      - run: node bin/epwm.mjs check firmware/epwm.json

      # 2. 生成：产物进制品，或与仓库里的副本对比防止漂移
      - run: node bin/epwm.mjs build firmware/epwm.json -o firmware/generated
      - run: git diff --exit-code firmware/generated
```

最后一行 `git diff --exit-code` 是「配置即代码」的关键：
**生成物必须与工程文件同步提交**，否则 CI 失败，避免有人手改生成代码后与配置失联。

---

## 5. 作为库使用

```js
import {
  sanitizeProject,
  resolveHardware,
  validateProject,
  generateCode,
} from './dist-engine/engine.js';

const project = sanitizeProject(JSON.parse(await readFile('epwm.json', 'utf8')));
const hw = resolveHardware(project);
const issues = validateProject(project, hw);   // DiagnosticIssue[]
const files = generateCode(project, hw);       // { name, language, content }[]
```

内核是纯 ESM、无副作用、不依赖 React / DOM，可以直接在 Node 脚本、
VSCode 扩展、文档站构建里使用。

---

## 6. 常见问题

**Q：`dist-engine` 需要提交进仓库吗？**
不需要。它在 `.gitignore` 里，由 `npm run build:engine` 生成。
CI 里记得先构建再调用 CLI。

**Q：能否不装 Node 直接用？**
网页版不需要 Node。CLI 需要 Node ≥ 22（使用了顶层 `await` 与 ESM）。

**Q：为什么 CLI 不直接用 `src/` 的 TS？**
为了让 CLI 消费「和网页完全相同的构建产物」，避免两套加载路径产生行为差异。
