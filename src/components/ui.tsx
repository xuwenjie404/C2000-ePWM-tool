import type { ButtonHTMLAttributes, ReactNode } from 'react';
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
/* 滑块                                                                */
/* ------------------------------------------------------------------ */

export function Slider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
  tone = 'sky',
  hint,
  disabled,
}: {
  label: string;
  value: number;
  display?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  tone?: Tone;
  hint?: string;
  disabled?: boolean;
}) {
  const accent: Record<Tone, string> = {
    sky: 'accent-sky-500',
    emerald: 'accent-emerald-500',
    amber: 'accent-amber-500',
    rose: 'accent-rose-500',
    violet: 'accent-violet-500',
    slate: 'accent-slate-400',
  };
  return (
    <div className={cx(disabled && 'opacity-50')}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-base text-slate-300">{label}</span>
        <span className="font-mono text-base font-bold text-white">{display ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className={cx('w-full cursor-pointer', accent[tone])}
      />
      {hint && <p className="mt-0.5 text-base text-slate-500">{hint}</p>}
    </div>
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
