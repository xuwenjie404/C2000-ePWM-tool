## 动机

<!-- 为什么需要这个改动？解决什么实际问题？ -->

## 改动

<!-- 逐条列出，涉及寄存器语义的请注明依据（TRM 章节 / 数据手册页码） -->

-
-

## 影响范围

- [ ] 计算内核（`src/lib/**`）
- [ ] 器件 / 拓扑数据（`src/data/**`）
- [ ] 代码生成（`src/lib/codegen.ts` / `src/lib/targets/**`）
- [ ] 校验规则（`src/lib/rules/**`）
- [ ] 工程结构 / 迁移（`src/lib/project.ts`、`schema/**`）
- [ ] CLI / 内核 API（`src/engine/**`、`bin/**`）
- [ ] 界面

## 验证方式

<!-- 你是怎么确认它是对的？单测、示波器、还是对照 TRM？ -->

- [ ] `npm run typecheck` 通过
- [ ] `npm test` 全绿
- [ ] `npm run build:all` 通过
- [ ] 新增/修改的逻辑有对应单测
- [ ] 若改动生成代码，`codegen.test.ts` 的断言已同步

## 破坏性变更

<!-- 是否改变了 ProjectState 结构、注册表 id 或导出 API？如有，说明迁移方式 -->

无 / 有：
