import { DB_IN_MODES, DEADBAND_MODES, DEADBAND_MODE_LIST, DB_IN_MODE_LIST } from '../data/deadband';
import type { ChannelConfig, ProjectState } from '../types';
import type { HardwareModel, ResolvedChannel } from '../lib/hardware';
import { Badge, Btn, Card, PanelHeader, Select, Slider, cx } from './ui';
import { Icon } from './Icon';

interface Props {
  project: ProjectState;
  hw: HardwareModel;
  onChannelChange: (id: number, patch: Partial<ChannelConfig>) => void;
  onRemoveChannel: (id: number) => void;
  onAddChannel: () => void;
}

function ChannelCard({
  ch,
  hw,
  onChannelChange,
  onRemoveChannel,
}: {
  ch: ResolvedChannel;
  hw: HardwareModel;
  onChannelChange: (id: number, patch: Partial<ChannelConfig>) => void;
  onRemoveChannel: (id: number) => void;
}) {
  const cfg = ch.cfg;
  const isMaster = cfg.id === 1;
  const maxDb = Math.max(100, Math.round(ch.tb.periodNs * 0.45));

  return (
    <div
      className={cx(
        'space-y-3 rounded-xl border bg-slate-950/70 p-3.5',
        cfg.enabled ? 'border-slate-800' : 'border-slate-800/60 opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <span
            className={cx(
              'rounded-lg px-2 py-0.5 font-mono text-base font-bold',
              cfg.enabled ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-slate-300',
            )}
          >
            ePWM{cfg.id}
          </span>
          <input
            value={cfg.name}
            onChange={e => onChannelChange(cfg.id, { name: e.target.value })}
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-base font-semibold text-white hover:border-slate-700 focus:border-sky-500 focus:outline-none"
            aria-label={`ePWM${cfg.id} 名称`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Btn compact variant={cfg.enabled ? 'accent' : 'ghost'} onClick={() => onChannelChange(cfg.id, { enabled: !cfg.enabled })}>
            {cfg.enabled ? '已启用' : '已停用'}
          </Btn>
          {!isMaster && (
            <button
              type="button"
              onClick={() => onRemoveChannel(cfg.id)}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
              title="删除该桥臂"
            >
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      </div>

      {!isMaster && (
        <div className="flex flex-wrap items-center gap-2">
          <Btn
            compact
            variant={cfg.independentFreq ? 'warn' : 'ghost'}
            onClick={() => onChannelChange(cfg.id, { independentFreq: !cfg.independentFreq })}
          >
            {cfg.independentFreq ? '独立频率时基' : '跟随主频锁相'}
          </Btn>
          {!cfg.independentFreq && (
            <Badge tone="emerald" mono>
              移相 {cfg.phase}° → TBPHS {ch.phase.tbphs} / {ch.phase.phsDir}
            </Badge>
          )}
        </div>
      )}

      {cfg.independentFreq && !isMaster ? (
        <Slider
          label="通道独立开关频率"
          tone="amber"
          value={cfg.customFreqKhz}
          display={`${cfg.customFreqKhz} kHz`}
          min={0.05}
          max={500}
          step={0.05}
          onChange={v => onChannelChange(cfg.id, { customFreqKhz: v })}
          hint={`TBPRD ${ch.tb.tbprd} · PHSEN 将被关闭`}
        />
      ) : (
        !isMaster && (
          <Slider
            label="相对主通道移相角 Δφ"
            tone="emerald"
            value={cfg.phase}
            display={`${cfg.phase}°`}
            min={0}
            max={360}
            onChange={v => onChannelChange(cfg.id, { phase: v })}
            hint={`等效延迟 ${ch.phase.delayNs.toFixed(0)} ns`}
          />
        )
      )}

      <Slider
        label={`ePWM${cfg.id}A 占空比 (CMPA = ${ch.cmpA})`}
        value={cfg.duty}
        display={`${cfg.duty.toFixed(1)}%`}
        min={0.5}
        max={99.5}
        step={0.1}
        onChange={v => onChannelChange(cfg.id, { duty: v })}
        hint={`死区后实际 ${ch.wave.actualDutyAPct.toFixed(2)}%`}
      />

      {cfg.mode === 'BYPASS' && (
        <Slider
          label={`ePWM${cfg.id}B 独立占空比 (CMPB = ${ch.cmpB})`}
          value={cfg.dutyB}
          display={`${cfg.dutyB.toFixed(1)}%`}
          min={0.5}
          max={99.5}
          step={0.1}
          onChange={v => onChannelChange(cfg.id, { dutyB: v })}
          hint={`死区后实际 ${ch.wave.actualDutyBPct.toFixed(2)}%`}
        />
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-base text-slate-300">死区输出模式 (DBCTL.POLSEL)</span>
          <Select value={cfg.mode} onChange={v => onChannelChange(cfg.id, { mode: v as ChannelConfig['mode'] })}>
            {DEADBAND_MODE_LIST.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-base text-slate-300">死区输入源 (DBCTL.IN_MODE)</span>
          <Select value={cfg.inMode} onChange={v => onChannelChange(cfg.id, { inMode: v as ChannelConfig['inMode'] })}>
            {DB_IN_MODE_LIST.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-base leading-snug text-slate-400">
        {DEADBAND_MODES[cfg.mode].description}
        {DB_IN_MODES[cfg.inMode].crossSource && (
          <span className="ml-1 text-amber-400">（交叉输入模式的波形为示意）</span>
        )}
      </p>

      {cfg.mode !== 'BYPASS' && (
        <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-amber-300">独立上下沿死区</span>
            <Btn
              compact
              variant={cfg.lockDb ? 'warn' : 'ghost'}
              onClick={() => onChannelChange(cfg.id, { lockDb: !cfg.lockDb })}
            >
              {cfg.lockDb ? 'RED = FED 锁定' : '独立调节'}
            </Btn>
          </div>

          <Slider
            label={`上升沿死区 RED (DBRED = ${ch.dbRed})`}
            tone="amber"
            value={cfg.redNs}
            display={`${cfg.redNs} ns`}
            min={0}
            max={maxDb}
            step={10}
            onChange={v => onChannelChange(cfg.id, { redNs: v })}
          />
          <Slider
            label={`下降沿死区 FED (DBFED = ${ch.dbFed})`}
            tone="amber"
            value={cfg.fedNs}
            display={`${cfg.fedNs} ns`}
            min={0}
            max={maxDb}
            step={10}
            onChange={v => onChannelChange(cfg.id, { fedNs: v })}
          />
        </div>
      )}

      {hw.device.hasHRPWM && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
          <div>
            <span className="text-base font-semibold text-white">HRPWM 高分辨率</span>
            <p className="text-base text-slate-500">
              MEP 步进 {hw.device.mepStepPs} ps，CMPAHR = 0x{ch.hrpwm.cmpahr.toString(16).toUpperCase().padStart(4, '0')}
            </p>
          </div>
          <Btn
            compact
            variant={cfg.hrpwm ? 'accent' : 'ghost'}
            onClick={() => onChannelChange(cfg.id, { hrpwm: !cfg.hrpwm })}
          >
            {cfg.hrpwm ? '已开启' : '未开启'}
          </Btn>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5 font-mono text-base">
        <span className="text-slate-400">
          TBPRD <span className="text-sky-300">{ch.tb.tbprd}</span>
        </span>
        <span className="text-slate-400">
          CMPA <span className="text-sky-300">{ch.cmpA}</span>
        </span>
        <span className="text-slate-400">
          TBPHS <span className="text-emerald-300">{ch.syncEnabled ? ch.phase.tbphs : 0}</span>
        </span>
        <span className="text-slate-400">
          CLKDIV <span className="text-slate-200">{ch.tb.clkDiv}×{ch.tb.hspClkDiv}</span>
        </span>
        <span className="text-slate-400">
          MUX A <span className="text-violet-300">{ch.muxA?.gpio ?? '-'}</span>
        </span>
        <span className="text-slate-400">
          MUX B <span className="text-violet-300">{ch.muxB?.gpio ?? '-'}</span>
        </span>
      </div>
    </div>
  );
}

export function ChannelPanel({ project, hw, onChannelChange, onRemoveChannel, onAddChannel }: Props) {
  return (
    <Card>
      <PanelHeader
        icon="sliders"
        title="逐通道精细参数"
        hint="死区模式、输入源、独立频率、占空比与 RED/FED 都在这里逐个配置；三相联动锁开启时，死区参数会同步到 U/V/W。"
        right={
          <Btn variant="primary" icon="plus" onClick={onAddChannel} disabled={project.channels.length >= 4}>
            新增桥臂
          </Btn>
        }
      />
      <div className="grid grid-cols-1 gap-3.5 p-4 lg:grid-cols-2">
        {hw.channels.map(ch => (
          <ChannelCard
            key={ch.cfg.id}
            ch={ch}
            hw={hw}
            onChannelChange={onChannelChange}
            onRemoveChannel={onRemoveChannel}
          />
        ))}
      </div>
    </Card>
  );
}
