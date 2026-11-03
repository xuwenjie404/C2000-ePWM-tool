import { useEffect, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { isOutOfRange, parseNumericInput } from '../lib/numberInput';
import { Icon, type IconName } from './Icon';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* 容器                                                                */
/* ------------------------------------------------------------------ */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        'bg-[#0d1424] border border-slate-800 rounded-2xl shadow-xl shadow-black/30',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  icon,
  title,
  hint,
  right,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-sky-400">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h2 className="text-[17px] font-bold leading-tight text-white">{title}</h2>
          {hint && <p className="mt-1 text-base leading-snug text-slate-400">{hint}</p>}
        </div>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 按钮                                                                */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'accent' | 'warn' | 'ghost' | 'danger' | 'violet';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-sky-500 text-slate-950 hover:bg-sky-400 border-transparent font-bold',
  accent: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 border-transparent font-bold',
  warn: 'bg-amber-500 text-slate-950 hover:bg-amber-400 border-transparent font-bold',
  violet: 'bg-violet-500 text-white hover:bg-violet-400 border-transparent font-bold',
  ghost: 'bg-slate-900 text-slate-200 hover:bg-slate-800 border-slate-700',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 border-transparent font-bold',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  active?: boolean;
  compact?: boolean;
}

export function Btn({
  variant = 'ghost',
  icon,
  active,
  compact,
  className,
  children,
  ...rest
}: BtnProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl border transition-colors',
        'disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600',
        compact ? 'px-2.5 py-1.5 text-base' : 'px-3.5 py-2 text-base',
        VARIANT_CLASS[variant],
        active && 'ring-2 ring-sky-300/70 ring-offset-1 ring-offset-[#0d1424]',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 徽标                                                                */
/* ------------------------------------------------------------------ */

type Tone = 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

const TONE_CLASS: Record<Tone, string> = {
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  slate: 'bg-slate-800/80 text-slate-300 border-slate-700',
};

export function Badge({
  tone = 'slate',
  mono,
  children,
  title,
}: {
  tone?: Tone;
  mono?: boolean;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-base font-semibold',
        mono && 'font-mono',
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 分段选择                                                            */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'sky',
}: {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  tone?: Tone;
}) {
  const activeClass: Record<Tone, string> = {
    sky: 'bg-sky-500 text-slate-950',
    emerald: 'bg-emerald-500 text-slate-950',
    amber: 'bg-amber-500 text-slate-950',
    rose: 'bg-rose-500 text-white',
    violet: 'bg-violet-500 text-white',
    slate: 'bg-slate-200 text-slate-900',
  };
  return (
    <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-base font-semibold transition-colors',
            value === o.value
              ? activeClass[tone]
              : 'text-slate-300 hover:bg-slate-800 hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 滑块 + 数值输入（统一布局）                                          */
/* ------------------------------------------------------------------ */

const ACCENT: Record<Tone, string> = {
  sky: 'accent-sky-500',
  emerald: 'accent-emerald-500',
  amber: 'accent-amber-500',
  rose: 'accent-rose-500',
  violet: 'accent-violet-500',
  slate: 'accent-slate-400',
};

const FOCUS_RING: Record<Tone, string> = {
  sky: 'focus-within:border-sky-500/80 focus-within:ring-1 focus-within:ring-sky-500/30',
  emerald: 'focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/30',
  amber: 'focus-within:border-amber-500/80 focus-within:ring-1 focus-within:ring-amber-500/30',
  rose: 'focus-within:border-rose-500/80 focus-within:ring-1 focus-within:ring-rose-500/30',
  violet: 'focus-within:border-violet-500/80 focus-within:ring-1 focus-within:ring-violet-500/30',
  slate: 'focus-within:border-slate-500/80 focus-within:ring-1 focus-within:ring-slate-500/30',
};

/** 去掉无意义的尾随零：100 -> "100"，0.05 -> "0.05"，12.30 -> "12.3" */
function fmtNum(v: number, decimals = 3): string {
  if (!Number.isFinite(v)) return '';
  return String(Number(v.toFixed(decimals)));
}

interface NumberDraftOptions {
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

/**
 * 带草稿态的数值输入逻辑（Slider 与 NumberBadge 共用）。
 *
 * 设计取舍：输入过程中**不**即时夹紧，否则用户想输 "300" 时会在敲下 "3" 的瞬间
 * 被弹到最小值。改为失焦 / 回车时按 step 吸附并夹紧，Esc 放弃。
 */
function useNumberDraft(value: number, { min, max, step, onChange }: NumberDraftOptions) {
  const [draft, setDraft] = useState<string | null>(null);

  // 外部（滑块、拖拽手柄、预设）改变数值时丢弃未提交的草稿
  useEffect(() => {
    setDraft(null);
  }, [value]);

  const outOfRange = draft !== null && isOutOfRange(draft, min, max);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseNumericInput(draft, min, max, step);
    setDraft(null);
    if (parsed.ok) onChange(parsed.value);
  };

  return { draft, setDraft, commit, outOfRange };
}

const NUMBER_INPUT_CLASS =
  'bg-transparent text-right font-mono text-base font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/**
 * 统一参数控件：标签 + 可直接输入的数值框 + 滑块 + 范围提示。
 *
 * 三组关键参数（开关频率 / 占空比 / 死区）都用它渲染，
 * 因此标签行、输入框、滑块的基线天然对齐，不需要各自调 padding。
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  decimals = 3,
  onChange,
  tone = 'sky',
  hint,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  decimals?: number;
  onChange: (v: number) => void;
  tone?: Tone;
  hint?: string;
  disabled?: boolean;
}) {
  const { draft, setDraft, commit, outOfRange } = useNumberDraft(value, { min, max, step, onChange });
  const rangeText = `${fmtNum(min)} ~ ${fmtNum(max)}${unit ? ` ${unit}` : ''}`;

  return (
    <div className={cx('min-w-0', disabled && 'opacity-50')}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-base leading-6 text-slate-300" title={label}>
          {label}
        </span>
        <span
          className={cx(
            'flex h-8 shrink-0 items-center gap-1 rounded-lg border bg-slate-950 px-2 transition-colors',
            outOfRange ? 'border-rose-500/80 ring-1 ring-rose-500/30' : 'border-slate-700 ' + FOCUS_RING[tone],
          )}
        >
          <input
            type="number"
            inputMode="decimal"
            value={draft ?? fmtNum(value, decimals)}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={`${label}（数值输入）`}
            aria-invalid={outOfRange}
            onFocus={e => {
              setDraft(String(value));
              e.currentTarget.select();
            }}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
              else if (e.key === 'Escape') {
                setDraft(null);
                e.currentTarget.blur();
              }
            }}
            className={cx(NUMBER_INPUT_CLASS, 'w-[4.25rem]')}
          />
          {unit && <span className="select-none text-base leading-none text-slate-500">{unit}</span>}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.max(min, Math.min(max, value))}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
        className={cx('mt-1.5 w-full cursor-pointer', ACCENT[tone])}
      />

      <p className="mt-0.5 min-h-5 text-base leading-5">
        {outOfRange ? (
          <span className="text-rose-400">超出范围，允许 {rangeText}（回车后自动夹紧）</span>
        ) : (
          <span className="text-slate-500">{hint ?? `范围 ${rangeText}`}</span>
        )}
      </p>
    </div>
  );
}

/**
 * 徽标样式的行内数值输入。
 * 外观与 Badge 一致，但可以直接点击改数字 —— 用于波形面板里「拖拽手柄」旁的精确定值。
 */
export function NumberBadge({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  decimals = 3,
  tone = 'amber',
  onChange,
  title,
}: {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  tone?: Tone;
  onChange: (v: number) => void;
  title?: string;
}) {
  const { draft, setDraft, commit, outOfRange } = useNumberDraft(value, { min, max, step, onChange });

  return (
    <span
      title={title}
      className={cx(
        'inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-base font-semibold',
        outOfRange ? 'border-rose-500 bg-rose-500/10 text-rose-300' : TONE_CLASS[tone],
      )}
    >
      <span className="select-none opacity-80">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={draft ?? fmtNum(value, decimals)}
        min={min}
        max={max}
        step={step}
        aria-label={`${label}（数值输入）`}
        aria-invalid={outOfRange}
        onFocus={e => {
          setDraft(String(value));
          e.currentTarget.select();
        }}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className={cx(NUMBER_INPUT_CLASS, 'w-12')}
      />
      {unit && <span className="select-none opacity-70">{unit}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 字段                                                                */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-base text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-base text-slate-500">{hint}</span>}
    </label>
  );
}

export function Select<T extends string | number>({
  value,
  onChange,
  children,
  className,
}: {
  value: T;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cx(
        'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-base font-semibold text-white',
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Stat({
  label,
  value,
  tone = 'slate',
  mono = true,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  mono?: boolean;
}) {
  const text: Record<Tone, string> = {
    sky: 'text-sky-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    violet: 'text-violet-300',
    slate: 'text-slate-200',
  };
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-base text-slate-400">{label}</span>
      <span className={cx('text-base font-bold', mono && 'font-mono', text[tone])}>{value}</span>
    </div>
  );
}
