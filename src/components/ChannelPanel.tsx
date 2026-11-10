import { DB_IN_MODES, DEADBAND_MODES, DEADBAND_MODE_LIST, DB_IN_MODE_LIST } from '../data/deadband';
import type { ChannelConfig, ProjectState } from '../types';
import type { HardwareModel, ResolvedChannel } from '../lib/hardware';
import { freqRangeKhz } from '../lib/limits';
import { useI18n } from '../i18n';
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
  project,
  hw,
  onChannelChange,
  onRemoveChannel,
}: {
  ch: ResolvedChannel;
  project: ProjectState;
  hw: HardwareModel;
  onChannelChange: (id: number, patch: Partial<ChannelConfig>) => void;
  onRemoveChannel: (id: number) => void;
}) {
  const { t } = useI18n();
  const cfg = ch.cfg;
  const isMaster = cfg.id === 1;
  // 与波形面板共用同一上限，避免两处滑块的可用范围不一致
  const maxDb = Math.max(100, Math.round(ch.tb.periodNs * 0.45));

  return (
    <div
      className={cx(
        'space-y-3 rounded-md border p-3.5',
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
            aria-label={t(`ePWM${cfg.id} 名称`, `ePWM${cfg.id} name`)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Btn compact variant={cfg.enabled ? 'accent' : 'ghost'} onClick={() => onChannelChange(cfg.id, { enabled: !cfg.enabled })}>
            {cfg.enabled ? t('已启用', 'Enabled') : t('已停用', 'Disabled')}
          </Btn>
          {!isMaster && (
            <button
              type="button"
              onClick={() => onRemoveChannel(cfg.id)}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
              title={t('删除该桥臂', 'Delete this leg')}
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
            {cfg.independentFreq
              ? t('独立频率时基', 'Independent frequency time base')
              : t('跟随主频锁相', 'Phase-locked to master')}
          </Btn>
          {!cfg.independentFreq && (
            <Badge tone="emerald" mono>
              {t(
                `移相 ${cfg.phase}° → TBPHS ${ch.phase.tbphs} / ${ch.phase.phsDir}`,
                `Phase shift ${cfg.phase}° → TBPHS ${ch.phase.tbphs} / ${ch.phase.phsDir}`,
              )}
            </Badge>
          )}
        </div>
      )}

      {cfg.independentFreq && !isMaster ? (
        <Slider
          label={t('通道独立开关频率', 'Channel independent switching frequency')}
          tone="amber"
          value={cfg.customFreqKhz}
          unit="kHz"
          decimals={2}
          min={freqRangeKhz(hw.device.tbclkMHz, project.countMode).minKhz}
          max={freqRangeKhz(hw.device.tbclkMHz, project.countMode).maxKhz}
          step={0.01}
          log
          onChange={v => onChannelChange(cfg.id, { customFreqKhz: v })}
          hint={t(`TBPRD ${ch.tb.tbprd} · PHSEN 将被关闭`, `TBPRD ${ch.tb.tbprd} · PHSEN will be disabled`)}
        />
      ) : (
        !isMaster && (
          <Slider
            label={t('相对主通道移相角 Δφ', 'Phase shift vs. master Δφ')}
            tone="emerald"
            value={cfg.phase}
            unit="°"
            decimals={0}
            min={0}
            max={360}
            onChange={v => onChannelChange(cfg.id, { phase: v })}
            hint={t(
              `等效延迟 ${ch.phase.delayNs.toFixed(0)} ns`,
              `Equivalent delay ${ch.phase.delayNs.toFixed(0)} ns`,
            )}
          />
        )
      )}

      <Slider
        label={t(`ePWM${cfg.id}A 占空比`, `ePWM${cfg.id}A duty cycle`)}
        value={cfg.duty}
        unit="%"
        decimals={1}
        min={0.5}
        max={99.5}
        step={0.1}
        onChange={v => onChannelChange(cfg.id, { duty: v })}
        hint={t(
          `CMPA = ${ch.cmpA} · 死区后实际 ${ch.wave.actualDutyAPct.toFixed(2)}%`,
          `CMPA = ${ch.cmpA} · actual after dead-band ${ch.wave.actualDutyAPct.toFixed(2)}%`,
        )}
      />

      {cfg.mode === 'BYPASS' && (
        <Slider
          label={t(`ePWM${cfg.id}B 独立占空比`, `ePWM${cfg.id}B independent duty cycle`)}
          value={cfg.dutyB}
          unit="%"
          decimals={1}
          min={0.5}
          max={99.5}
          step={0.1}
          onChange={v => onChannelChange(cfg.id, { dutyB: v })}
          hint={t(
            `CMPB = ${ch.cmpB} · 死区后实际 ${ch.wave.actualDutyBPct.toFixed(2)}%`,
            `CMPB = ${ch.cmpB} · actual after dead-band ${ch.wave.actualDutyBPct.toFixed(2)}%`,
          )}
        />
      )}

      {/* ---- 死区：放在占空比之后、卡片上部，避免藏在底部 ---- */}
      <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-base font-bold text-amber-300">{t('死区时间 (Dead-Band)', 'Dead-band time')}</span>
          {cfg.mode !== 'BYPASS' && (
            <Btn
              compact
              variant={cfg.lockDb ? 'warn' : 'ghost'}
              onClick={() => onChannelChange(cfg.id, { lockDb: !cfg.lockDb })}
            >
              {cfg.lockDb ? t('RED = FED 锁定', 'RED = FED locked') : t('独立调节', 'Adjust independently')}
            </Btn>
          )}
        </div>

        {cfg.mode !== 'BYPASS' && (
          <>
            <Slider
              label={t('上升沿死区 RED', 'Rising-edge dead-band RED')}
              tone="amber"
              value={cfg.redNs}
              unit="ns"
              decimals={0}
              min={0}
              max={maxDb}
              step={10}
              onChange={v => onChannelChange(cfg.id, { redNs: v })}
              hint={t(
                `DBRED = ${ch.dbRed} · A 管开通前插入 ${(ch.dbRed * ch.tb.stepNs).toFixed(0)} ns`,
                `DBRED = ${ch.dbRed} · inserted ${(ch.dbRed * ch.tb.stepNs).toFixed(0)} ns before A turns on`,
              )}
            />
            <Slider
              label={t('下降沿死区 FED', 'Falling-edge dead-band FED')}
              tone="amber"
              value={cfg.fedNs}
              unit="ns"
              decimals={0}
              min={0}
              max={maxDb}
              step={10}
              onChange={v => onChannelChange(cfg.id, { fedNs: v })}
              hint={t(
                `DBFED = ${ch.dbFed} · B 管开通前插入 ${(ch.dbFed * ch.tb.stepNs).toFixed(0)} ns`,
                `DBFED = ${ch.dbFed} · inserted ${(ch.dbFed * ch.tb.stepNs).toFixed(0)} ns before B turns on`,
              )}
            />
          </>
        )}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-base text-slate-300">{t('输出模式 (DBCTL.POLSEL)', 'Output mode (DBCTL.POLSEL)')}</span>
            <Select value={cfg.mode} onChange={v => onChannelChange(cfg.id, { mode: v as ChannelConfig['mode'] })}>
              {DEADBAND_MODE_LIST.map(m => (
                <option key={m.id} value={m.id}>
                  {t(m.name, m.nameEn)}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-base text-slate-300">{t('输入源 (DBCTL.IN_MODE)', 'Input source (DBCTL.IN_MODE)')}</span>
            <Select value={cfg.inMode} onChange={v => onChannelChange(cfg.id, { inMode: v as ChannelConfig['inMode'] })}>
              {DB_IN_MODE_LIST.map(m => (
                <option key={m.id} value={m.id}>
                  {t(m.name, m.nameEn)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <p className="text-base leading-snug text-slate-400">
          {t(DEADBAND_MODES[cfg.mode].description, DEADBAND_MODES[cfg.mode].descriptionEn)}
          {DB_IN_MODES[cfg.inMode].crossSource && (
            <span className="ml-1 text-amber-400">
              {t('（交叉输入模式的波形为示意）', '(waveform is illustrative in crossed input mode)')}
            </span>
          )}
        </p>
      </div>

      {hw.device.hasHRPWM && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2">
          <div>
            <span className="text-base font-semibold text-white">{t('HRPWM 高分辨率', 'HRPWM high resolution')}</span>
            <p className="text-base text-slate-500">
              {t(
                `MEP 步进 ${hw.device.mepStepPs} ps，CMPAHR = 0x${ch.hrpwm.cmpahr.toString(16).toUpperCase().padStart(4, '0')}`,
                `MEP step ${hw.device.mepStepPs} ps, CMPAHR = 0x${ch.hrpwm.cmpahr.toString(16).toUpperCase().padStart(4, '0')}`,
              )}
            </p>
          </div>
          <Btn
            compact
            variant={cfg.hrpwm ? 'accent' : 'ghost'}
            onClick={() => onChannelChange(cfg.id, { hrpwm: !cfg.hrpwm })}
          >
            {cfg.hrpwm ? t('已开启', 'Enabled') : t('未开启', 'Disabled')}
          </Btn>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-800 p-2.5 font-mono text-base">
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
  const { t } = useI18n();
  return (
    <Card>
      <PanelHeader
        icon="sliders"
        title={t('逐通道精细参数', 'Per-channel parameters')}
        hint={t(
          '死区模式、输入源、独立频率、占空比与 RED/FED 都在这里逐个配置；三相联动锁开启时，死区参数会同步到 U/V/W。',
          'Configure dead-band mode, input source, independent frequency, duty cycle and RED/FED per channel. With the 3-phase sync lock on, dead-band settings are mirrored to U/V/W.',
        )}
        right={
          <Btn variant="primary" icon="plus" onClick={onAddChannel} disabled={project.channels.length >= 4}>
            {t('新增桥臂', 'Add leg')}
          </Btn>
        }
      />
      <div className="grid grid-cols-1 gap-3.5 p-4 lg:grid-cols-2">
        {hw.channels.map(ch => (
          <ChannelCard
            key={ch.cfg.id}
            ch={ch}
            project={project}
            hw={hw}
            onChannelChange={onChannelChange}
            onRemoveChannel={onRemoveChannel}
          />
        ))}
      </div>
    </Card>
  );
}
