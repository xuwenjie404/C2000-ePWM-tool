# 贡献指南

感谢你愿意改进这个工具。它服务的是**会真的把电送进功率管**的场景，
所以本项目的门槛不是「代码能跑」，而是「生成的代码是对的」。

---

## 1. 环境

```bash
node -v            # >= 22.12
npm install
npm run dev        # http://localhost:5173
```

> **受限环境**：如果所在沙箱禁止子进程或原生模块，Vite 加载配置可能报 `spawn EPERM`。
> 此时用 `npm run test:restricted` / `npm run build:restricted`（加 `--configLoader native`）。

---

## 2. 开发前请先读

* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) —— 分层与不变量；
* [docs/EXTENDING.md](docs/EXTENDING.md) —— 五类扩展的做法与位置。

关键约定（会直接影响 review 结论）：

1. `src/lib/**` 不得 import React 或组件；
2. 新增/修改 `ProjectState` 字段，必须同步 `schema/project.schema.json`、
   `sanitizeProject()` 与 `SCHEMA_VERSION`；
3. 注册项 `id` 发布后不可更改（会进 URL 与文件名）；
4. 校验规则的 `detail` 必须说明**改哪个参数**；
5. 改动代码生成，必须同时改动 `src/lib/codegen.test.ts` 的断言。

---

## 3. 测试要求

```bash
npm run typecheck     # 必须 0 error
npm test              # 必须全绿
npm run build:all     # 网页 + 内核都要能构建
```

提交 PR 前请确认：

- [ ] 新增计算逻辑有对应的纯函数单测（不要只靠手点界面验证）
- [ ] 新增校验规则有「命中」与「不命中」两个用例
- [ ] 新增代码生成目标有产物断言
- [ ] 若改了工程结构，`schema.test.ts` 仍通过
- [ ] 若改了 CLI，手动跑过 `init / build / check` 三条命令

---

## 4. 提交信息

采用 Conventional Commits 的简化版：

```
<type>: <简述>

<可选正文：为什么改、影响面、验证方式>
```

`type` 取 `feat` / `fix` / `refactor` / `docs` / `test` / `chore`。
涉及生成代码行为的 `fix`，请在正文里写清「原来错在哪、现在对在哪、如何验证」。

---

## 5. 分支与 PR

* 从 `main` 切分支：`feat/<主题>`、`fix/<主题>`；
* PR 描述里请附：**动机 / 改动 / 验证方式**；
* 涉及寄存器语义的改动，请注明依据（TRM 章节号或数据手册页码）；
* 涉及 UI 的改动，请附截图（无截图能力的可以描述改动前后的差异）。

---

## 6. 数据准确性

器件参数（主频、TBCLK、死区位宽、GPIO 复用）必须能追溯到数据手册。
提交这类改动时，请在 PR 里给出器件型号、封装与手册页码。

如果发现现有数据有误，**直接开 issue 说明依据**比默默修改更有价值 ——
错误的器件数据会让生成代码在别人板子上烧管子。

---

## 7. 不接受的改动

* 把业务逻辑塞回 React 组件（例如在 `WaveformPanel` 里算 TBPRD）；
* 引入第二个真相源（例如在 UI 里另存一份器件表）；
* 「顺手」重构无关模块（请拆成独立 PR）；
* 在没有测试的情况下修改 `src/lib/**` 的计算逻辑。
