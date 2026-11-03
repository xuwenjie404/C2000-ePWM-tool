import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import schema from '../../schema/project.schema.json';
import legacyV0 from '../../examples/legacy-v0.epwm.json';
import { createDefaultProject, sanitizeProject } from './project';

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

function expectValid(doc: unknown) {
  const ok = validate(doc);
  if (!ok) {
    throw new Error('schema 校验失败: ' + ajv.errorsText(validate.errors, { separator: '\n' }));
  }
  expect(ok).toBe(true);
}

/**
 * 契约测试：ProjectState 的具体实例必须满足 schema/project.schema.json。
 * 它防的是「代码加了字段但忘了更新 schema」以及反过来的漂移。
 */
describe('工程文件 JSON Schema', () => {
  it('默认工程符合 schema', () => {
    expectValid(createDefaultProject());
  });

  it('原始版本导出的 v0 工程迁移后符合 schema', () => {
    expectValid(sanitizeProject(legacyV0));
  });

  it('手工构造的极端合法值符合 schema', () => {
    const project = sanitizeProject({
      ...createDefaultProject(),
      freqKhz: 0.05,
      modIndex: 0,
      elecAngleDeg: 360,
      channels: [
        {
          id: 1,
          duty: 0.5,
          dutyB: 99.5,
          phase: 360,
          redNs: 0,
          fedNs: 50000,
          mode: 'BYPASS',
          inMode: 'DBB_ALL',
          hrpwm: true,
        },
      ],
    });
    expectValid(project);
  });

  it('多出一个未知字段时 schema 会拒绝（防止悄悄漂移）', () => {
    expect(validate({ ...createDefaultProject(), __unexpected: 1 })).toBe(false);
  });

  it('缺少必填字段时 schema 会拒绝', () => {
    const broken: Record<string, unknown> = { ...createDefaultProject() };
    delete broken.channels;
    expect(validate(broken)).toBe(false);
  });
});
