#!/usr/bin/env node
/**
 * C2000 ePWM Tool 命令行（内核 + CLI 的「配置即代码」入口）。
 *
 * 用法：
 *   node bin/epwm.mjs init [presetId] -o project.json      # 生成/导出工程
 *   node bin/epwm.mjs build project.json -o out/           # 生成代码
 *   node bin/epwm.mjs check project.json                   # 只做校验，出错退出码 1
 *
 * 典型 CI 用法：
 *   node bin/epwm.mjs build firmware/epwm.json -o firmware/generated && \
 *   node bin/epwm.mjs check firmware/epwm.json
 *
 * 依赖 dist-engine/engine.js（npm run build:engine 产物）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const enginePath = resolve(here, '..', 'dist-engine', 'engine.js');

if (!existsSync(enginePath)) {
  console.error('找不到内核产物 dist-engine/engine.js');
  console.error('请先执行：npm run build:engine');
  process.exit(2);
}

const engine = await import(new URL(`file://${enginePath}`).href);

const {
  sanitizeProject,
  createDefaultProject,
  applyPreset,
  resolveHardware,
  generateCode,
  validateProject,
  countIssues,
  PRESETS,
} = engine;

function usage(code = 0) {
  console.log(`C2000 ePWM Tool CLI

用法:
  epwm init [presetId] -o <project.json>    生成工程文件（默认使用第一个预设）
  epwm build <project.json> -o <outDir>     生成代码/文档（默认 ./out）
  epwm check <project.json>                 仅校验，存在 error 时退出码为 1
  epwm presets                              列出可用预设

选项:
  -o, --out <path>      输出路径
  -t, --target <id>     覆盖代码目标: BITFIELD | DRIVERLIB | MARKDOWN
  -h, --help            显示帮助

可用预设: ${PRESETS.map(p => p.id).join(', ')}
`);
  process.exit(code);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') flags.out = argv[++i];
    else if (a === '-t' || a === '--target') flags.target = argv[++i];
    else if (a === '-h' || a === '--help') flags.help = true;
    else positional.push(a);
  }
  return { positional, flags };
}

function readProject(path) {
  if (!existsSync(path)) {
    console.error(`工程文件不存在: ${path}`);
    process.exit(2);
  }
  try {
    return sanitizeProject(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    console.error(`无法解析工程文件 ${path}: ${error instanceof Error ? error.message : error}`);
    process.exit(2);
  }
}

function printIssues(project, hw) {
  const issues = validateProject(project, hw);
  const counts = countIssues(issues);
  const label = { error: 'ERROR', warn: 'WARN ', info: 'INFO ' };
  for (const issue of issues) {
    const where = issue.channelId ? ` [ePWM${issue.channelId}]` : '';
    console.log(`  ${label[issue.severity]}${where} ${issue.title}`);
    console.log(`        ${issue.detail}`);
  }
  return counts;
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const command = positional[0];

if (flags.help || !command) usage(command ? 0 : 1);

if (command === 'presets') {
  for (const p of PRESETS) console.log(`${p.id.padEnd(18)} [${p.tag}] ${p.name} — ${p.description}`);
  process.exit(0);
}

if (command === 'init') {
  const presetId = positional[1];
  const project = presetId ? applyPreset(createDefaultProject(), presetId) : createDefaultProject();
  const out = flags.out ?? 'epwm.project.json';
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, JSON.stringify(project, null, 2) + '\n', 'utf8');
  console.log(`已生成工程: ${out}（器件 ${project.deviceId}，${project.channels.length} 个通道）`);
  process.exit(0);
}

if (command === 'build' || command === 'check') {
  const projectPath = positional[1];
  if (!projectPath) usage(1);

  const project = readProject(projectPath);
  if (flags.target) project.codeTarget = flags.target;

  const hw = resolveHardware(project);
  console.log(
    `器件 ${hw.device.name} · ${project.phaseSystem}/${project.subTopology} · ` +
      `${hw.master.tb.actualFswKhz.toFixed(3)} kHz · TBPRD ${hw.master.tb.tbprd}`,
  );

  const counts = printIssues(project, hw);

  if (command === 'check') {
    console.log(`\n校验完成: ${counts.error} error / ${counts.warn} warn / ${counts.info} info`);
    process.exit(counts.error > 0 ? 1 : 0);
  }

  const files = generateCode(project, hw);
  const outDir = flags.out ?? 'out';
  mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    const target = join(outDir, file.name);
    writeFileSync(target, file.content, 'utf8');
    console.log(`  + ${target}`);
  }
  console.log(`\n生成 ${files.length} 个文件 → ${outDir}`);
  process.exit(counts.error > 0 ? 1 : 0);
}

console.error(`未知命令: ${command}`);
usage(1);
