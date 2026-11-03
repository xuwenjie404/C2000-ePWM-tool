import { useMemo } from 'react';
import type { ChannelConfig, ProjectState } from '../types';
import type { HardwareModel } from '../lib/hardware';
import { Badge, Card, PanelHeader, Stat } from './ui';
import { Icon } from './Icon';

interface Props {
  project: ProjectState;
  hw: HardwareModel;
  onChannelChange: (id: number, patch: Partial<ChannelConfig>) => void;
}

interface PinInfo {
  pin: number;
  state: 'active' | 'alternate' | 'power' | 'free';
  gpio?: string;
  signal?: string;
  channelId?: number;
  sub?: 'A' | 'B';
  optionIndex?: number;
}

export function PinoutPanel({ hw, onChannelChange }: Props) {
  const pins = useMemo(() => {
    const map = new Map<number, PinInfo>();

    for (const ch of hw.channels) {
      if (!ch.cfg.enabled) continue;
      (['A', 'B'] as const).forEach(sub => {
        const signal = `ePWM${ch.cfg.id}${sub}`;
        const opts = hw.device.muxOptions[signal] ?? [];
        const selIdx = sub === 'A' ? ch.cfg.muxIdxA : ch.cfg.muxIdxB;
        opts.forEach((opt, idx) => {
          const isSel = idx === selIdx;
          const existing = map.get(opt.pin);
          if (existing?.state === 'active' && !isSel) return;
          map.set(opt.pin, {
            pin: opt.pin,
            state: isSel ? 'active' : existing?.state === 'active' ? 'active' : 'alternate',
            gpio: opt.gpio,
            signal,
            channelId: ch.cfg.id,
            sub,
            optionIndex: idx,
          });
        });
      });
    }

    for (const p of hw.device.powerPins) {
      if (!map.has(p)) map.set(p, { pin: p, state: 'power' });
    }

    const list = [...map.values()].sort((a, b) => a.pin - b.pin);
    // 芯片两侧对称排布
    const half = Math.ceil(list.length / 2);
    return { left: list.slice(0, half), right: list.slice(half) };
  }, [hw]);

  const usedChannels = hw.channels.filter(c => c.cfg.enabled).length;

  const badgeClass = (p: PinInfo): string => {
    if (p.state === 'active') return 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200 font-bold';
    if (p.state === 'alternate') return 'border-sky-500/50 bg-sky-950/60 text-sky-300 border-dashed';
    if (p.state === 'power') return 'border-amber-600/60 bg-amber-950/50 text-amber-300';
    return 'border-slate-800 bg-slate-900 text-slate-400';
  };

  const label = (p: PinInfo): string => {
    if (p.state === 'active') return `#${p.pin} ${p.gpio} · ${p.signal}`;
    if (p.state === 'alternate') return `#${p.pin} ${p.gpio} · 可切至 ${p.signal}`;
    if (p.state === 'power') return `#${p.pin} VDD/VSS`;
    return `#${p.pin} GPIO`;
  };

  const handleClick = (p: PinInfo) => {
    if (p.state !== 'alternate' || !p.channelId || !p.sub || p.optionIndex === undefined) return;
    const patch: Partial<ChannelConfig> =
      p.sub === 'A' ? { muxIdxA: p.optionIndex } : { muxIdxB: p.optionIndex };
    onChannelChange(p.channelId, patch);
  };

  const renderColumn = (list: PinInfo[], side: 'left' | 'right') => (
    <div className={side === 'left' ? 'space-y-1.5' : 'space-y-1.5'}>
      {list.map(p => (
        <button
          key={p.pin}
          type="button"
          disabled={p.state !== 'alternate'}
          onClick={() => handleClick(p)}
          className={
            'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-base transition-colors ' +
            badgeClass(p) +
            (p.state === 'alternate' ? ' cursor-pointer hover:border-sky-400 hover:bg-sky-500/15' : '')
          }
          title={p.state === 'alternate' ? '点击切换到该复用引脚' : undefined}
        >
          <span className="truncate font-mono text-base">{label(p)}</span>
          {p.state === 'alternate' && <span className="shrink-0 text-base underline">切换</span>}
          {p.state === 'active' && <Icon name="check" size={14} className="shrink-0" />}
        </button>
      ))}
    </div>
  );

  return (
    <Card>
      <PanelHeader
        icon="chip"
        title="引脚复用分配"
        hint="蓝色虚线为备选复用口，点击即可切换 GPIO 映射，C 代码与引脚占用会同步更新。"
        right={
          <div className="flex flex-wrap items-center gap-2 text-base">
            <Badge tone="emerald">已激活</Badge>
            <Badge tone="sky">备选可切</Badge>
            <Badge tone="amber">电源</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 items-stretch gap-3.5 p-4 lg:grid-cols-[1fr_auto_1fr]">
        {renderColumn(pins.left, 'left')}

        <div className="flex min-w-[260px] flex-col items-center justify-center gap-2 rounded-2xl border-4 border-slate-700 bg-slate-950 px-5 py-6 shadow-2xl">
          <div className="flex items-center gap-2 text-base tracking-[0.2em] text-slate-500">
            <Icon name="chip" size={16} />
            TEXAS INSTRUMENTS
          </div>
          <div className="text-center text-lg font-extrabold text-white">{hw.device.name}</div>
          <div className="text-base text-emerald-400">{hw.device.package}</div>
          <div className="mt-2 w-full space-y-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            <Stat label="ePWM 模块" value={`${usedChannels} / ${hw.device.epwmModules}`} tone="sky" />
            <Stat label="TBCLK" value={`${hw.device.tbclkMHz} MHz`} tone="slate" />
            <Stat label="死区位宽" value={`${hw.device.dbMaxBits} bit`} tone="amber" />
            <Stat
              label="HRPWM MEP"
              value={hw.device.hasHRPWM ? `${hw.device.mepStepPs} ps` : '不支持'}
              tone={hw.device.hasHRPWM ? 'emerald' : 'rose'}
            />
          </div>
          <p className="mt-1 text-center text-base leading-snug text-slate-500">{hw.device.series}</p>
        </div>

        {renderColumn(pins.right, 'right')}
      </div>
    </Card>
  );
}
