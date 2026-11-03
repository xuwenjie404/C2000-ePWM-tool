import { useMemo } from 'react';
import type { GeneratedFile } from '../types';
import { Badge, Btn, Card, cx } from './ui';
import { Icon } from './Icon';

/** 轻量 C 语法高亮：先转义再分包，避免注入 */
const TOKEN_RE = new RegExp(
  [
    String.raw`\/\/[^\n]*`, // 行注释
    String.raw`\/\*[\s\S]*?\*\/`, // 块注释
    String.raw`"(?:[^"\\]|\\.)*"`, // 字符串
    String.raw`#[A-Za-z_]+`, // 预处理
    String.raw`\b(?:void|int|float|uint16_t|uint32_t|uint8_t|static|inline|return|if|else|for|while|volatile|const|extern|__interrupt|bool|true|false)\b`,
    String.raw`\b(?:EPwm\d+Regs|CpuSysRegs|GpioCtrlRegs|PieCtrlRegs|PieVectTable|EALLOW|EDIS|DINT|EINT|ERTM|NOP|IER|IFR)\b`,
    String.raw`\b(?:TB_|CC_|AQ_|DB_|DBA_|DBB_|ET_|EPWM_|GPIO_|PIE_|M_INT|TZ_|HR_|INTERRUPT_|EPWM_O_)[A-Z0-9_]*\b`,
    String.raw`\bEPWM\d+_BASE\b`,
    String.raw`\b(?:sinf|HWREGH)\b`,
    String.raw`\b(?:0x[0-9A-Fa-f]+|\d+(?:\.\d+)?[Uf]?)\b`,
  ].join('|'),
  'g',
);

function classFor(token: string): string {
  if (token.startsWith('//') || token.startsWith('/*')) return 'text-emerald-400/90 italic';
  if (token.startsWith('"')) return 'text-amber-200';
  if (token.startsWith('#')) return 'text-fuchsia-300 font-semibold';
  if (/^(void|int|float|uint16_t|uint32_t|uint8_t|static|inline|return|if|else|for|while|volatile|const|extern|__interrupt|bool|true|false)$/.test(token))
    return 'text-violet-300 font-semibold';
  if (/^(EPwm\d+Regs|CpuSysRegs|GpioCtrlRegs|PieCtrlRegs|PieVectTable|EALLOW|EDIS|DINT|EINT|ERTM|NOP|IER|IFR)$/.test(token))
    return 'text-sky-300 font-semibold';
  if (/^(sinf|HWREGH|EPWM\d+_BASE)$/.test(token)) return 'text-cyan-300';
  if (/^(TB_|CC_|AQ_|DB_|DBA_|DBB_|ET_|EPWM_|GPIO_|PIE_|M_INT|TZ_|HR_|INTERRUPT_|EPWM_O_)/.test(token))
    return 'text-amber-300';
  return 'text-orange-300';
}

function HighlightedLine({ line }: { line: string }) {
  const parts = useMemo(() => {
    const out: { text: string; cls?: string }[] = [];
    let last = 0;
    for (const m of line.matchAll(TOKEN_RE)) {
      const idx = m.index ?? 0;
      if (idx > last) out.push({ text: line.slice(last, idx) });
      out.push({ text: m[0], cls: classFor(m[0]) });
      last = idx + m[0].length;
    }
    if (last < line.length) out.push({ text: line.slice(last) });
    return out;
  }, [line]);

  return (
    <>
      {parts.map((p, i) =>
        p.cls ? (
          <span key={i} className={p.cls}>
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

interface Props {
  files: GeneratedFile[];
  activeName: string;
  onActiveName: (name: string) => void;
  style: 'BITFIELD' | 'DRIVERLIB';
  lang: 'CN' | 'EN';
  onStyle: () => void;
  onLang: () => void;
  onCopy: () => void;
  onDownloadFile: (name: string) => void;
  onDownloadAll: () => void;
  copied: boolean;
  lineCount: number;
}

export function CodePanel({
  files,
  activeName,
  onActiveName,
  style,
  lang,
  onStyle,
  onLang,
  onCopy,
  onDownloadFile,
  onDownloadAll,
  copied,
  lineCount,
}: Props) {
  const active = files.find(f => f.name === activeName) ?? files[0];
  const lines = useMemo(() => (active?.content ?? '').split('\n'), [active]);

  return (
    <Card className="flex h-full min-h-[520px] flex-col">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sky-400">
              <Icon name="code" size={20} />
            </span>
            <h2 className="text-[17px] font-bold text-white">C 代码生成</h2>
            <Badge tone="slate" mono>
              {lineCount} 行
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Btn compact variant="ghost" onClick={onLang} icon="link">
              {lang === 'CN' ? '中文注释' : 'English'}
            </Btn>
            <Btn compact variant="violet" onClick={onStyle}>
              {style === 'BITFIELD' ? 'Bit-Field' : 'DriverLib'}
            </Btn>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {files.map(f => (
            <button
              key={f.name}
              type="button"
              onClick={() => onActiveName(f.name)}
              className={cx(
                'rounded-lg px-2.5 py-1 font-mono text-base transition-colors',
                f.name === active?.name
                  ? 'bg-sky-500 font-bold text-slate-950'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800',
              )}
            >
              {f.name}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <Btn compact variant="ghost" icon={copied ? 'check' : 'copy'} onClick={onCopy}>
              {copied ? '已复制' : '复制'}
            </Btn>
            <Btn compact variant="ghost" icon="download" onClick={() => active && onDownloadFile(active.name)}>
              单个
            </Btn>
            <Btn compact variant="accent" icon="download" onClick={onDownloadAll}>
              全部 .c/.h
            </Btn>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#070a10] p-3">
        <pre className="font-mono text-base leading-relaxed">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex rounded px-1 hover:bg-slate-800/40">
                <span className="w-10 shrink-0 select-none pr-3 text-right text-slate-600">{i + 1}</span>
                <span className="flex-1 whitespace-pre text-slate-200">
                  <HighlightedLine line={line} />
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </Card>
  );
}
