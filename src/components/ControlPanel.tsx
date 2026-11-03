import { DEVICES } from '../data/devices';
import { PRESETS } from '../data/presets';
import { topologiesFor } from '../data/topologies';
import type { ProjectState } from '../types';
import type { HardwareModel } from '../lib/hardware';
import { maxLinearModIndex, modulationSamplingInfo } from '../lib/modulation';
import { Badge, Btn, Card, Field, PanelHeader, Segmented, Select, Slider, Stat } from './ui';

const FUND_FREQS = [
  { v: 50, label: '50 Hz 工频' },
  { v: 60, label: '60 Hz 美标' },
  { v: 400, label: '400 Hz 航空' },
  { v: 1000, label: '1 kHz 高速电机' },
];

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

  return (
    <Card>
      <PanelHeader
        icon="sliders"
        title="拓扑 · 器件 · 调制"
        hint="先选拓扑与器件，再调开关频率与调制参数；下方所有卡片与右侧代码会实时联动。"
        right={
          <Badge tone="sky" mono>
            {hw.device.name}
          </Badge>
        }
      />

      <div className="space-y-4 p-4">
        {/* 拓扑 */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-bold text-white">桥臂拓扑</span>
            <div className="flex items-center gap-2">
              <Segmented
                value={project.phaseSystem}
                onChange={v => onTopology(v, v === '1P' ? '1P_FB' : '3P_3LEG')}
                options={[
                  { value: '1P', label: '单相' },
                  { value: '3P', label: '三相' },
                ]}
              />
              {project.phaseSystem === '3P' && (
                <Btn
                  compact
                  variant={project.threePhaseSyncLock ? 'warn' : 'ghost'}
                  onClick={() => onPatch({ threePhaseSyncLock: !project.threePhaseSyncLock })}
                >
                  三相联动 {project.threePhaseSyncLock ? '开' : '关'}
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
                  'rounded-xl border px-3 py-1.5 text-base font-semibold transition-colors ' +
                  (project.subTopology === sub.id
                    ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800')
                }
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>

        {/* 器件与频率 */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Field label="目标 DSP 器件" hint={DEVICES[project.deviceId]?.desc}>
            <Select value={project.deviceId} onChange={v => onPatch({ deviceId: v })}>
              {Object.values(DEVICES).map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.tbclkMHz} MHz · {d.dbMaxBits}bit 死区
                </option>
              ))}
            </Select>
          </Field>

          <Field label="计数模式 CTRMODE">
            <Segmented
              tone="emerald"
              value={project.countMode}
              onChange={v => onPatch({ countMode: v })}
              options={[
                { value: 'UP_DOWN', label: '增减对称', title: '对称 PWM，三相移相精度最高' },
                { value: 'UP', label: '单向递增', title: '边沿对齐，duty = CMPA/(TBPRD+1)' },
              ]}
            />
          </Field>
        </div>

        <Slider
          label="开关频率 f_sw"
          value={project.freqKhz}
          display={`${project.freqKhz} kHz`}
          min={0.05}
          max={500}
          step={0.05}
          onChange={v => onPatch({ freqKhz: v })}
          hint={`实际 ${tb.actualFswKhz.toFixed(3)} kHz（误差 ${tb.freqErrorPct.toFixed(3)}%）· 周期 ${tb.periodNs.toFixed(0)} ns`}
        />

        {/* 时基解算结果 */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 md:grid-cols-4">
          <Stat label="TBPRD" value={tb.tbprd} tone="sky" />
          <Stat label="TBCLK 分频" value={`${tb.clkDiv}×${tb.hspClkDiv}`} tone="slate" />
          <Stat label="TBCLK 步长" value={`${tb.stepNs.toFixed(3)} ns`} tone="slate" />
          <Stat label="占空比 LSB" value={`${tb.dutyLsbPct.toFixed(3)} %`} tone="slate" />
        </div>

        {/* 调制 */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-base font-bold text-white">调制策略</span>
            <Segmented
              tone="violet"
              value={project.modulationMode}
              onChange={v => onPatch({ modulationMode: v })}
              options={[
                { value: 'FIXED', label: '固定占空比', title: 'DC-DC / 移相控制' },
                { value: 'SPWM', label: 'SPWM', title: '正弦脉宽调制' },
                { value: 'SVPWM', label: 'SVPWM', title: '空间矢量 / 零序注入' },
              ]}
            />
          </div>

          {project.modulationMode === 'FIXED' ? (
            <p className="text-base text-slate-400">
              固定占空比模式：各桥臂的占空比与移相角完全由下方通道卡片决定，适合 Buck / Boost / 全桥移相 / LLC。
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              <Slider
                label="调制比 M"
                tone="violet"
                value={project.modIndex}
                display={project.modIndex.toFixed(3)}
                min={0.05}
                max={1.2}
                step={0.005}
                onChange={v => onPatch({ modIndex: v })}
                hint={`线性上限 ${limit.toFixed(4)}`}
              />
              <Field label="输出基波频率">
                <Select value={project.fundFreqHz} onChange={v => onPatch({ fundFreqHz: Number(v) })}>
                  {FUND_FREQS.map(f => (
                    <option key={f.v} value={f.v}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Slider
                label="观测电角度 θe"
                value={project.elecAngleDeg}
                display={`${project.elecAngleDeg}°`}
                min={0}
                max={360}
                onChange={v => onPatch({ elecAngleDeg: v })}
                hint={`每基波周期 ${sampling.samplesPerCycle} 个采样点`}
              />
            </div>
          )}
        </div>

        {/* 预设 */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-base font-bold text-white">典型拓扑预设</span>
            <span className="text-base text-slate-500">一键装载通道 / 死区 / 调制</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                title={p.description}
                onClick={() => onPreset(p.id)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-base font-semibold text-slate-200 transition-colors hover:border-sky-500/60 hover:bg-sky-500/10 hover:text-sky-200"
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
