import { createRegistry } from '../../platform/registry';
import type { CodeTarget, GeneratedFile, ProjectState } from '../../types';
import type { HardwareModel } from '../hardware';
import { mergeFiles, produceC, type CCodeTarget } from '../codegen';
import { produceMarkdown } from './markdown';

/**
 * 代码生成目标（插件）。
 *
 * 平台契约：一个目标 = 一个 produce(project, hw) => GeneratedFile[]。
 * 想接 SysConfig 片段、STM32 寄存器、JSON 摘要、引脚表 CSV，
 * 都只需要新增一个文件并 register 一次，UI 与内核无需改动。
 */
export interface CodegenTarget {
  id: CodeTarget;
  label: string;
  /** 英文标签（UI 语言为 en 时使用） */
  labelEn: string;
  /** 用于 UI 提示 */
  description: string;
  /** 英文说明 */
  descriptionEn: string;
  /** 产物默认语言，决定代码面板的高亮方案 */
  language: 'c' | 'markdown';
  produce(project: ProjectState, hw: HardwareModel): GeneratedFile[];
}

export const codegenRegistry = createRegistry<CodegenTarget>('codegen');

function cTarget(
  id: CCodeTarget,
  label: string,
  labelEn: string,
  description: string,
  descriptionEn: string,
): CodegenTarget {
  return {
    id,
    label,
    labelEn,
    description,
    descriptionEn,
    language: 'c',
    produce: (project, hw) => produceC(project, hw, id),
  };
}

codegenRegistry
  .register(
    cTarget(
      'BITFIELD',
      'Bit-Field 寄存器',
      'Bit-Field registers',
      '直接操作 EPwm1Regs.xxx 位域，配合 F28x_Project.h，最贴近寄存器手册。',
      'Touches EPwm1Regs.xxx bit-fields directly with F28x_Project.h — closest to the TRM.',
    ),
  )
  .register(
    cTarget(
      'DRIVERLIB',
      'DriverLib 库函数',
      'DriverLib API',
      '使用 EPWM_setXxx() 系列 API 配合 driverlib.h，可读性更好、跨器件移植性更强。',
      'Uses EPWM_setXxx() APIs with driverlib.h — more readable and portable across devices.',
    ),
  )
  .register({
    id: 'MARKDOWN',
    label: 'Markdown 设计表',
    labelEn: 'Markdown sheet',
    description: '把寄存器值、死区、引脚与校验结果导出成评审文档，适合归档与下厂。',
    descriptionEn:
      'Exports register values, dead-band, pinout and check results as a review document — good for archiving.',
    language: 'markdown',
    produce: produceMarkdown,
  });

/** 当前工程选中的目标 */
export function getTarget(target: CodeTarget): CodegenTarget {
  return codegenRegistry.require(target);
}

/** 按 project.codeTarget 生成文件列表 */
export function generateCode(project: ProjectState, hw: HardwareModel): GeneratedFile[] {
  return getTarget(project.codeTarget).produce(project, hw);
}

/** 合并成单文件文本（C 目标会拼成一份便于粘贴的源码） */
export function generateSingleFile(project: ProjectState, hw: HardwareModel): string {
  return mergeFiles(generateCode(project, hw));
}

export type { CCodeTarget };
