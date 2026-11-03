import type { ProjectState, TripAction, TripSourceId } from '../types';
import { Btn, Card, PanelHeader, Segmented, Select, Stat, cx } from './ui';

const TZ_SOURCES: TripSourceId[] = ['TZ1', 'TZ2', 'TZ3', 'TZ4', 'TZ5', 'TZ6'];

const TRIP_ACTIONS: { value: TripAction; label: string; hint: string }[] = [
  { value: 'FORCE_LOW', label: '强制低', hint: 'TZ_FORCE_LO：最常用，关断上下管' },
  { value: 'FORCE_HIGH', label: '强制高', hint: 'TZ_FORCE_HI' },
  { value: 'HI_Z', label: '高阻', hint: 'TZ_HIZ：交由外部驱动处理' },
  { value: 'DO_NOTHING', label: '不动作', hint: 'TZ_DO_NOTHING：仅产生中断' },
];

interface Props {
  project: ProjectState;
  onPatch: (patch: Partial<ProjectState>) => void;
}

export function ProtectionPanel({ project, onPatch }: Props) {
  const tz = project.tripZone;
  const adc = project.adcTrigger;

  const patchTz = (p: Partial<ProjectState['tripZone']>) => onPatch({ tripZone: { ...tz, ...p } });
  const patchAdc = (p: Partial<ProjectState['adcTrigger']>) => onPatch({ adcTrigger: { ...adc, ...p } });

  const toggleSource = (src: TripSourceId) => {
    const has = tz.sources.includes(src);
    patchTz({ sources: has ? tz.sources.filter(s => s !== src) : [...tz.sources, src] });
  };

  return (
    <Card>
      <PanelHeader
        icon="shield"
        title="保护与采样触发"
        hint="Trip-Zone 是硬件级断路保护，绕过 CPU 直接关断 PWM 输出；事件触发用于在固定时刻启动 ADC 采样。"
        right={
          <Btn compact variant={tz.enabled ? 'accent' : 'ghost'} onClick={() => patchTz({ enabled: !tz.enabled })}>
            {tz.enabled ? 'Trip-Zone 已启用' : 'Trip-Zone 已关闭'}
          </Btn>
        }
      />

      <div className={cx('grid grid-cols-1 gap-3.5 p-4 lg:grid-cols-2', !tz.enabled && 'opacity-70')}>
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-white">触发源 TZSEL</span>
            <Segmented
              tone="rose"
              value={tz.action}
              onChange={v => patchTz({ action: v })}
              options={[
                { value: 'OST', label: 'OST 单次跳闸', title: '锁存关断，需软件清除 TZFLG 才能恢复' },
                { value: 'CBC', label: 'CBC 逐周期', title: '每个周期自动复位，适合峰值限流' },
              ]}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TZ_SOURCES.map(src => {
              const active = tz.sources.includes(src);
              return (
                <button
                  key={src}
                  type="button"
                  disabled={!tz.enabled}
                  onClick={() => toggleSource(src)}
                  className={cx(
                    'rounded-lg border px-2.5 py-1 font-mono text-base font-bold transition-colors',
                    active && tz.enabled
                      ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600',
                    !tz.enabled && 'cursor-not-allowed',
                  )}
                >
                  {src}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-base text-slate-300">OUTA 动作</span>
              <Select value={tz.outA} onChange={v => patchTz({ outA: v as TripAction })}>
                {TRIP_ACTIONS.map(a => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-base text-slate-300">OUTB 动作</span>
              <Select value={tz.outB} onChange={v => patchTz({ outB: v as TripAction })}>
                {TRIP_ACTIONS.map(a => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <Btn compact variant={tz.interrupt ? 'warn' : 'ghost'} onClick={() => patchTz({ interrupt: !tz.interrupt })}>
            {tz.interrupt ? '已使能 TZ 中断上报' : '未使能 TZ 中断'}
          </Btn>

          <p className="text-base leading-snug text-slate-500">
            提示：TZ 输入引脚的具体 GPIO 复用随器件与封装不同，需在 SysConfig / 数据手册中确认后再接比较器或驱动故障信号。
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-white">ADC 采样触发 ETSEL</span>
            <Btn compact variant={adc.enabled ? 'accent' : 'ghost'} onClick={() => patchAdc({ enabled: !adc.enabled })}>
              {adc.enabled ? '已启用' : '已关闭'}
            </Btn>
          </div>

          <label className="block">
            <span className="mb-1 block text-base text-slate-300">触发时刻</span>
            <Select value={adc.source} onChange={v => patchAdc({ source: v as ProjectState['adcTrigger']['source'] })}>
              <option value="CTR_ZERO">CTR = 0（周期起点）</option>
              <option value="CTR_PRD">CTR = PRD（周期顶点）</option>
              <option value="CTR_ZERO_OR_PRD">CTR = 0 或 PRD（每周期两次）</option>
            </Select>
          </label>

          <label className="block">
            <span className="mb-1 block text-base text-slate-300">事件分频 ETPS</span>
            <Select value={adc.prescale} onChange={v => patchAdc({ prescale: Number(v) })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>
                  每 {n} 个事件触发一次
                </option>
              ))}
            </Select>
          </label>

          <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
            <Stat label="采样时刻" value={
              adc.source === 'CTR_ZERO' ? '0 ns（周期起点）' : adc.source === 'CTR_PRD' ? 'T/2 附近（顶点）' : '0 与 T/2'
            } tone="sky" />
            <Stat
              label="有效采样率"
              value={`${(project.freqKhz / adc.prescale).toFixed(2)} kHz`}
              tone="emerald"
            />
          </div>

          <p className="text-base leading-snug text-slate-500">
            增减计数下电流纹波在 CTR = PRD 处最小，因此电流环通常采样在顶点；CMPA 的影子寄存器在 CTR = 0 装载，二者配合可避免采样与更新冲突。
          </p>
        </div>
      </div>
    </Card>
  );
}

export function protectionSummary(project: ProjectState): string {
  if (!project.tripZone.enabled) return '未启用';
  return `${project.tripZone.action} · ${project.tripZone.sources.join('/') || '无源'}`;
}
