import { DEVICES } from '../data/devices';
import { PRESETS } from '../data/presets';
import { topologiesFor } from '../data/topologies';
import type { ProjectState } from '../types';
import type { HardwareModel } from '../lib/hardware';
import { maxLinearModIndex, modulationSamplingInfo } from '../lib/modulation';
import { freqRangeKhz } from '../lib/limits';
import { useI18n } from '../i18n';
import { Badge, Btn, Card, Field, PanelHeader, Segmented, Select, Slider, Stat } from './ui';

/** 频率范围文本：小于 1 kHz 用 Hz 显示，避免 "0.02 ~ 3000 kHz" 这种难读的写法 */
function fmtFreq(khz: number): string {
  return khz < 1 ? `${Math.round(khz * 1000)} Hz` : `${Number(khz.toPrecision(4))} kHz`;
}

/** 基波频率候选值；标签在渲染时按当前语言生成 */
const FUND_FREQS = [50, 60, 400, 1000];

interface Props {
  project: ProjectState;
  hw: HardwareModel;
  onPatch: (patch: Partial<ProjectState>) => void;
  onTopology: (sys: '1P' | '3P', sub: string) => void;
  onPreset: (id: string) => void;
}

export function ControlPanel({ project, hw, onPatch, onTopology, onPreset }: Props) {
  const tb = hw.master.tb;
  const limit = maxLinearModIndex(project.modulationMode);
  const sampling = modulationSamplingInfo(project.freqKhz, project.fundFreqHz, project.countMode);
  // 频率上限由器件 TBCLK 与计数模式推出，不再写死 500 kHz
  const freqRange = freqRangeKhz(hw.device.tbclkMHz, project.countMode);
  const { t } = useI18n();

  return (
    <Card>
      <PanelHeader
        icon="sliders"
        title={t('拓扑 · 器件 · 调制', 'Topology · Device · Modulation')}
        hint={t(
          '先选拓扑与器件，再调开关频率与调制参数；下方所有卡片与右侧代码会实时联动。',
          'Pick topology and device first, then tune frequency and modulation. Everything below updates live.',
        )}
        right={
          <Badge tone="sky" mono>
            {hw.device.name}
          </Badge>
        }
      />

      <div className="space-y-4 p-4">
        {/* 拓扑 */}
        <div className="rounded-md border border-slate-800 p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold text-white">{t('桥臂拓扑', 'Leg topology')}</span>
            <div className="flex items-center gap-2">
              <Segmented
                value={project.phaseSystem}
                onChange={v => onTopology(v, v === '1P' ? '1P_FB' : '3P_3LEG')}
                options={[
                  { value: '1P', label: t('单相', 'Single-phase') },
                  { value: '3P', label: t('三相', 'Three-phase') },
                ]}
              />
              {project.phaseSystem === '3P' && (
                <Btn
                  compact
                  variant={project.threePhaseSyncLock ? 'warn' : 'ghost'}
                  onClick={() => onPatch({ threePhaseSyncLock: !project.threePhaseSyncLock })}
                >
                  {t('三相联动', '3-phase link')} {project.threePhaseSyncLock ? t('开', 'on') : t('关', 'off')}
                </Btn>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {topologiesFor(project.phaseSystem).map(sub => (
              <button
                key={sub.id}
                type="button"
                title={sub.hint}
                onClick={() => onTopology(project.phaseSystem, sub.id)}
                className={
                  'rounded-md border px-3 py-1.5 text-base font-medium transition-colors ' +
                  (project.subTopology === sub.id
                    ? 'border-slate-400 text-white'
                    : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white')
                }
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>

        {/* 器件与频率 */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Field label={t('目标 DSP 器件', 'Target device')} hint={DEVICES[project.deviceId]?.desc}>
            <Select value={project.deviceId} onChange={v => onPatch({ deviceId: v })}>
              {Object.values(DEVICES).map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.tbclkMHz} MHz · {d.dbMaxBits}-bit {t('死区', 'dead-band')}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('计数模式 CTRMODE', 'Count mode (CTRMODE)')}>
            <Segmented
              tone="emerald"
              value={project.countMode}
              onChange={v => onPatch({ countMode: v })}
              options={[
                { value: 'UP_DOWN', label: t('增减对称', 'Up-down'), title: t('对称 PWM，三相移相精度最高', 'Symmetric PWM, best phase-shift accuracy') },
                { value: 'UP', label: t('单向递增', 'Up-count'), title: t('边沿对齐，duty = CMPA/(TBPRD+1)', 'Edge-aligned, duty = CMPA/(TBPRD+1)') },
              ]}
            />
          </Field>
        </div>

        <Slider
          label={t('开关频率 f_sw', 'Switching frequency f_sw')}
          value={project.freqKhz}
          unit="kHz"
          decimals={2}
          min={freqRange.minKhz}
          max={freqRange.maxKhz}
          step={0.01}
          log
          onChange={v => onPatch({ freqKhz: v })}
          hint={t(`实际 ${tb.actualFswKhz.toFixed(3)} kHz（误差 ${tb.freqErrorPct.toFixed(3)}%）· 可用 ${fmtFreq(freqRange.minKhz)} ~ ${fmtFreq(freqRange.maxKhz)} kHz`, `Actual ${tb.actualFswKhz.toFixed(3)} kHz (error ${tb.freqErrorPct.toFixed(3)}%) · ${fmtFreq(freqRange.minKhz)} ~ ${fmtFreq(freqRange.maxKhz)} kHz available`)}
        />

        {/* 时基解算结果 */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 rounded-md border border-slate-800 p-3.5 md:grid-cols-4">
          <Stat label="TBPRD" value={tb.tbprd} tone="sky" />
          <Stat label={t('TBCLK 分频', 'TBCLK prescaler')} value={`${tb.clkDiv}×${tb.hspClkDiv}`} tone="slate" />
          <Stat label={t('TBCLK 步长', 'TBCLK step')} value={`${tb.stepNs.toFixed(3)} ns`} tone="slate" />
          <Stat label={t('占空比 LSB', 'Duty LSB')} value={`${tb.dutyLsbPct.toFixed(3)} %`} tone="slate" />
        </div>

        {/* 调制 */}
        <div className="rounded-md border border-slate-800 p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-semibold text-white">{t('调制策略', 'Modulation')}</span>
            <Segmented
              tone="violet"
              value={project.modulationMode}
              onChange={v => onPatch({ modulationMode: v })}
              options={[
                { value: 'FIXED', label: t('固定占空比', 'Fixed duty'), title: t('DC-DC / 移相控制', 'DC-DC / phase-shift control') },
                { value: 'SPWM', label: 'SPWM', title: t('正弦脉宽调制', 'Sinusoidal PWM') },
                { value: 'SVPWM', label: 'SVPWM', title: t('空间矢量 / 零序注入', 'Space vector / zero-sequence injection') },
              ]}
            />
          </div>

          {project.modulationMode === 'FIXED' ? (
            <p className="text-base text-slate-400">
              {t(
                '固定占空比模式：各桥臂的占空比与移相角完全由下方通道卡片决定，适合 Buck / Boost / 全桥移相 / LLC。',
                'Fixed-duty mode: duty and phase of every leg come from the channel cards below. Suits Buck / Boost / phase-shifted full bridge / LLC.',
              )}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              <Slider
                label={t('调制比 M', 'Modulation index M')}
                tone="violet"
                value={project.modIndex}
                decimals={4}
                min={0.05}
                max={1.2}
                step={0.005}
                onChange={v => onPatch({ modIndex: v })}
                hint={t(`线性上限 ${limit.toFixed(4)}`, `Linear limit ${limit.toFixed(4)}`)}
              />
              <Field label={t('输出基波频率', 'Output fundamental')}>
                <Select value={project.fundFreqHz} onChange={v => onPatch({ fundFreqHz: Number(v) })}>
                  {FUND_FREQS.map(f => (
                    <option key={f} value={f}>
                      {t(`${f} Hz`, `${f} Hz`)}
                      {f === 50
                        ? t(' 工频', ' mains')
                        : f === 60
                          ? t(' 美标', ' US')
                          : f === 400
                            ? t(' 航空', ' avionics')
                            : t(' 高速电机', ' high-speed motor')}
                    </option>
                  ))}
                </Select>
              </Field>
              <Slider
                label={t('观测电角度 θe', 'Electrical angle θe')}
                value={project.elecAngleDeg}
                unit="°"
                decimals={0}
                min={0}
                max={360}
                onChange={v => onPatch({ elecAngleDeg: v })}
                hint={t(`每基波周期 ${sampling.samplesPerCycle} 个采样点`, `${sampling.samplesPerCycle} samples per fundamental cycle`)}
              />
            </div>
          )}
        </div>

        {/* 预设 */}
        <div className="rounded-md border border-slate-800 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-base font-semibold text-white">{t('典型拓扑预设', 'Presets')}</span>
            <span className="text-base text-slate-500">{t('一键装载通道 / 死区 / 调制', 'One-click load of channels, dead-band and modulation')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                title={p.description}
                onClick={() => onPreset(p.id)}
                className="rounded-md border border-slate-800 px-3 py-1.5 text-base font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                <span className="mr-1.5 text-base text-slate-500">{p.tag}</span>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
