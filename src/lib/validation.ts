/**
 * 设计校验（对外门面）。
 *
 * 实现已拆成 src/lib/rules/ 下的规则插件，
 * 这里保留原有导出签名，保证既有调用方与测试无需改动。
 */
export { validateProject, countIssues, validationRegistry, NARROW_PULSE_NS } from './rules';
export type { ValidationRule, RuleContext } from './rules';
