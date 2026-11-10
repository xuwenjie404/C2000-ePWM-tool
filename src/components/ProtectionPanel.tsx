import type { ProjectState, TripAction, TripSourceId } from '../types';
import { useI18n } from '../i18n';
import { Btn, Card, PanelHeader, Segmented, Select, Stat, cx } from './ui';

const TZ_SOURCES: TripSourceId[] = ['TZ1', 'TZ2', 'TZ3', 'TZ4', 'TZ5', 'TZ6'];

const TRIP_ACTIONS: { value: TripAction; labelZh: string; labelEn: string; hintZh: string; hintEn: string }[] = [
  {
    value: 'FORCE_LOW',
    labelZh: '强制低',
    labelEn: 'Force low',
    hintZh: 'TZ_FORCE_LO：最常用，关断上下管',
    hintEn: 'TZ_FORCE_LO: most common; turns off both switches',
  },
  { value: 'FORCE_HIGH', labelZh: '强制高', labelEn: 'Force high', hintZh: 'TZ_FORCE_HI', hintEn: 'TZ_FORCE_HI' },
  {
    value: 'HI_Z',
    labelZh: '高阻',
    labelEn: 'High-Z',
    hintZh: 'TZ_HIZ：交由外部驱动处理',
    hintEn: 'TZ_HIZ: left to the external driver',
  },
  {
    value: 'DO_NOTHING',
    labelZh: '不动作',
    labelEn: 'No action',
    hintZh: 'TZ_DO_NOTHING：仅产生中断',
    hintEn: 'TZ_DO_NOTHING: interrupt only',
  },
];

interface Props {
  project: ProjectState;
  onPatch: (patch: Partial<ProjectState>) => void;
}

export function ProtectionPanel({ project, onPatch }: Props) {
  const { t } = useI18n();
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
        title={t('保护与采样触发', 'Protection & sampling trigger')}
        hint={t(
          'Trip-Zone 是硬件级断路保护，绕过 CPU 直接关断 PWM 输出；事件触发用于在固定时刻启动 ADC 采样。',
          'Trip-Zone is hardware-level shutdown protection: it cuts PWM outputs without the CPU. Event triggers start ADC sampling at a fixed instant.',
        )}
        right={
          <Btn compact variant={tz.enabled ? 'accent' : 'ghost'} onClick={() => patchTz({ enabled: !tz.enabled })}>
            {tz.enabled ? t('Trip-Zone 已启用', 'Trip-Zone enabled') : t('Trip-Zone 已关闭', 'Trip-Zone off')}
          </Btn>
        }
      />

      <div className={cx('grid grid-cols-1 gap-3.5 p-4 lg:grid-cols-2', !tz.enabled && 'opacity-70')}>
        <div className="space-y-3 rounded-md border border-slate-800 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-white">{t('触发源 TZSEL', 'Trigger sources TZSEL')}</span>
            <Segmented
              tone="rose"
              value={tz.action}
              onChange={v => patchTz({ action: v })}
              options={[
                {
                  value: 'OST',
                  label: t('OST 单次跳闸', 'OST one-shot trip'),
                  title: t('锁存关断，需软件清除 TZFLG 才能恢复', 'Latched shutdown; clear TZFLG in software to recover'),
                },
                {
                  value: 'CBC',
                  label: t('CBC 逐周期', 'CBC cycle-by-cycle'),
                  title: t('每个周期自动复位，适合峰值限流', 'Auto-resets every period; suited to peak current limiting'),
                },
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
              <span className="mb-1 block text-base text-slate-300">{t('OUTA 动作', 'OUTA action')}</span>
              <Select value={tz.outA} onChange={v => patchTz({ outA: v as TripAction })}>
                {TRIP_ACTIONS.map(a => (
                  <option key={a.value} value={a.value}>
                    {t(a.labelZh, a.labelEn)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-base text-slate-300">{t('OUTB 动作', 'OUTB action')}</span>
              <Select value={tz.outB} onChange={v => patchTz({ outB: v as TripAction })}>
                {TRIP_ACTIONS.map(a => (
                  <option key={a.value} value={a.value}>
                    {t(a.labelZh, a.labelEn)}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <Btn compact variant={tz.interrupt ? 'warn' : 'ghost'} onClick={() => patchTz({ interrupt: !tz.interrupt })}>
            {tz.interrupt ? t('已使能 TZ 中断上报', 'TZ interrupt reporting enabled') : t('未使能 TZ 中断', 'TZ interrupt disabled')}
          </Btn>

          <p className="text-base leading-snug text-slate-500">
            {t(
              '提示：TZ 输入引脚的具体 GPIO 复用随器件与封装不同，需在 SysConfig / 数据手册中确认后再接比较器或驱动故障信号。',
              'Info: the GPIO mux for TZ input pins varies by device and package. Confirm it in SysConfig or the datasheet before wiring comparator or gate-driver fault signals.',
            )}
          </p>
        </div>

        <div className="space-y-3 rounded-md border border-slate-800 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-white">{t('ADC 采样触发 ETSEL', 'ADC sampling trigger ETSEL')}</span>
            <Btn compact variant={adc.enabled ? 'accent' : 'ghost'} onClick={() => patchAdc({ enabled: !adc.enabled })}>
              {adc.enabled ? t('已启用', 'Enabled') : t('已关闭', 'Off')}
            </Btn>
          </div>

          <label className="block">
            <span className="mb-1 block text-base text-slate-300">{t('触发时刻', 'Trigger timing')}</span>
            <Select value={adc.source} onChange={v => patchAdc({ source: v as ProjectState['adcTrigger']['source'] })}>
              <option value="CTR_ZERO">{t('CTR = 0（周期起点）', 'CTR = 0 (period start)')}</option>
              <option value="CTR_PRD">{t('CTR = PRD（周期顶点）', 'CTR = PRD (period peak)')}</option>
              <option value="CTR_ZERO_OR_PRD">
                {t('CTR = 0 或 PRD（每周期两次）', 'CTR = 0 or PRD (twice per period)')}
              </option>
            </Select>
          </label>

          <label className="block">
            <span className="mb-1 block text-base text-slate-300">{t('事件分频 ETPS', 'Event prescaler ETPS')}</span>
            <Select value={adc.prescale} onChange={v => patchAdc({ prescale: Number(v) })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>
                  {t(`每 ${n} 个事件触发一次`, `Once every ${n} events`)}
                </option>
              ))}
            </Select>
          </label>

          <div className="space-y-1 rounded-lg border border-slate-800 p-2.5">
            <Stat label={t('采样时刻', 'Sampling instant')} value={
              adc.source === 'CTR_ZERO'
                ? t('0 ns（周期起点）', '0 ns (period start)')
                : adc.source === 'CTR_PRD'
                  ? t('T/2 附近（顶点）', 'Near T/2 (peak)')
                  : t('0 与 T/2', '0 and T/2')
            } tone="sky" />
            <Stat
              label={t('有效采样率', 'Effective sampling rate')}
              value={`${(project.freqKhz / adc.prescale).toFixed(2)} kHz`}
              tone="emerald"
            />
          </div>

          <p className="text-base leading-snug text-slate-500">
            {t(
              '增减计数下电流纹波在 CTR = PRD 处最小，因此电流环通常采样在顶点；CMPA 的影子寄存器在 CTR = 0 装载，二者配合可避免采样与更新冲突。',
              'In up-down count mode the current ripple is smallest at CTR = PRD, so current loops usually sample at the peak; the CMPA shadow register loads at CTR = 0, and together they avoid sampling/update conflicts.',
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}

// TODO(i18n): 该摘要由 App.tsx 以普通函数调用（非组件），此处拿不到 useI18n()，暂保留中文。
// 接入英文需要在 App 侧补一个语言参数。
/**
 * 顶部状态条用的保护摘要。
 * 不是组件，拿不到 hook，所以语言由调用方传入。
 */
export function protectionSummary(project: ProjectState, lang: 'zh' | 'en' = 'zh'): string {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);
  if (!project.tripZone.enabled) return t('未启用', 'disabled');
  return `${project.tripZone.action} · ${project.tripZone.sources.join('/') || t('无源', 'no source')}`;
}
