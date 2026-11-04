import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChannelConfig, Interval, ProjectState } from '../types';
import type { HardwareModel, ResolvedChannel } from '../lib/hardware';
import { computeModulationInstant, maxLinearModIndex } from '../lib/modulation';
import { Badge, Btn, Card, NumberBadge, PanelHeader, cx } from './ui';
import { Icon } from './Icon';

const COLORS = [
  { main: '#38bdf8', fill: 'rgba(56,189,248,0.20)', label: 'text-sky-300' },
  { main: '#34d399', fill: 'rgba(52,211,153,0.20)', label: 'text-emerald-300' },
  { main: '#c084fc', fill: 'rgba(192,132,252,0.20)', label: 'text-violet-300' },
  { main: '#fb923c', fill: 'rgba(251,146,60,0.20)', label: 'text-orange-300' },
];

const SVG_W = 860;
const PAD_L = 58;
const PAD_R = 14;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PERIODS = 2;

interface Props {
  project: ProjectState;
  hw: HardwareModel;
  activeChannelId: number;
  onActiveChannel: (id: number) => void;
  onChannelChange: (id: number, patch: Partial<ChannelConfig>) => void;
  onPatch: (patch: Partial<ProjectState>) => void;
  onAddChannel: () => void;
  onRemoveChannel: (id: number) => void;
  onPlayToggle: () => void;
  playing: boolean;
}

type DragKind = 'duty' | 'red' | 'fed' | 'phase';

/** 死区上限：与通道卡片保持一致（周期的 45%，至少 100 ns） */
function maxDbOf(ch: ResolvedChannel): number {
  return Math.max(100, Math.round(ch.tb.periodNs * 0.45));
}

interface DragState {
  chId: number;
  kind: DragKind;
  startX: number;
  init: number;
  cyclePx: number;
  periodNs: number;
  stepNs: number;
}

/** 把高电平区间按像素采样成连续的阶梯逻辑段，保证窄脉冲也不丢 */
function scanRuns(
  highs: Interval[],
  periodTicks: number,
  phasePx: number,
  cyclePx: number,
  xs: number,
  xe: number,
): { x0: number; x1: number }[] {
  const runs: { x0: number; x1: number }[] = [];
  const inHigh = (x: number): boolean => {
    const rel = (((x - PAD_L - phasePx) % cyclePx) + cyclePx) % cyclePx;
    const tick = (rel / cyclePx) * periodTicks;
    return highs.some(h => tick >= h.start && tick < h.end);
  };
  let open: number | null = null;
  for (let x = xs; x <= xe; x += 0.5) {
    const high = inHigh(x);
    if (high && open === null) open = x;
    if (!high && open !== null) {
      runs.push({ x0: open, x1: x });
      open = null;
    }
  }
  if (open !== null) runs.push({ x0: open, x1: xe });
  return runs;
}

function stepPathFromRuns(
  runs: { x0: number; x1: number }[],
  yHigh: number,
  yLow: number,
  xs: number,
  xe: number,
): string {
  let d = `M ${xs} ${yLow}`;
  for (const r of runs) {
    d += ` L ${r.x0.toFixed(1)} ${yLow} L ${r.x0.toFixed(1)} ${yHigh} L ${r.x1.toFixed(1)} ${yHigh} L ${r.x1.toFixed(
      1,
    )} ${yLow}`;
  }
  d += ` L ${xe} ${yLow}`;
  return d;
}

function ModulationEnvelope({
  project,
  onAngle,
}: {
  project: ProjectState;
  onAngle: (deg: number) => void;
}) {
  const W = 780;
  const H = 150;
  const padL = 46;
  const plotW = W - padL - 14;
  const midY = H / 2;
  const ampY = H / 2 - 16;

  const series = useMemo(() => {
    const out = { u: '', v: '', w: '', zero: '' };
    const pts = { u: [] as string[], v: [] as string[], w: [] as string[], zero: [] as string[] };
    for (let deg = 0; deg <= 360; deg += 3) {
      const x = padL + (deg / 360) * plotW;
      const inst = computeModulationInstant(
        project.modulationMode,
        project.phaseSystem,
        project.modIndex,
        deg,
      );
      pts.u.push(`${x.toFixed(1)},${(midY - inst.vu * ampY).toFixed(1)}`);
      pts.v.push(`${x.toFixed(1)},${(midY - inst.vv * ampY).toFixed(1)}`);
      pts.w.push(`${x.toFixed(1)},${(midY - inst.vw * ampY).toFixed(1)}`);
      pts.zero.push(`${x.toFixed(1)},${(midY - inst.vOffset * ampY).toFixed(1)}`);
    }
    out.u = pts.u.join(' ');
    out.v = pts.v.join(' ');
    out.w = pts.w.join(' ');
    out.zero = pts.zero.join(' ');
    return out;
  }, [project.modulationMode, project.phaseSystem, project.modIndex, plotW]);

  const cur = computeModulationInstant(
    project.modulationMode,
    project.phaseSystem,
    project.modIndex,
    project.elecAngleDeg,
  );
  const cursorX = padL + (project.elecAngleDeg / 360) * plotW;

  /** 点击 / 拖动定位电角度 */
  const handleSeek = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const x = ratio * W;
    const deg = Math.max(0, Math.min(360, ((x - padL) / plotW) * 360));
    onAngle(Math.round(deg));
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-bold text-white">
            {project.modulationMode === 'SVPWM' ? 'SVPWM 马鞍波包络（零序注入）' : 'SPWM 正弦参考波'}
          </span>
          <Badge tone="sky" mono>
            θ = {project.elecAngleDeg}°
          </Badge>
          <Badge tone="sky" mono>
            U {cur.du.toFixed(1)}%
          </Badge>
          <Badge tone="emerald" mono>
            V {cur.dv.toFixed(1)}%
          </Badge>
          {project.phaseSystem === '3P' && (
            <Badge tone="violet" mono>
              W {cur.dw.toFixed(1)}%
            </Badge>
          )}
        </div>
        <p className="text-base text-slate-500">在包络上点击或拖动可定位电角度</p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair rounded-lg border border-slate-800 bg-[#070b12]"
        onPointerDown={e => {
          handleSeek(e.clientX, e.currentTarget);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (e.buttons === 1) handleSeek(e.clientX, e.currentTarget);
        }}
      >
        <line x1={padL} y1={midY - ampY} x2={W - 14} y2={midY - ampY} stroke="#1e293b" strokeDasharray="3 4" />
        <line x1={padL} y1={midY} x2={W - 14} y2={midY} stroke="#334155" />
        <line x1={padL} y1={midY + ampY} x2={W - 14} y2={midY + ampY} stroke="#1e293b" strokeDasharray="3 4" />
        <text x="4" y={midY - ampY + 5} fill="#64748b" fontSize="15">
          100%
        </text>
        <text x="10" y={midY + 5} fill="#64748b" fontSize="15">
          50%
        </text>
        <text x="16" y={midY + ampY + 5} fill="#64748b" fontSize="15">
          0%
        </text>

        <polyline fill="none" stroke="#38bdf8" strokeWidth="2.4" points={series.u} />
        <polyline fill="none" stroke="#34d399" strokeWidth="2.4" points={series.v} />
        {project.phaseSystem === '3P' && (
          <polyline fill="none" stroke="#c084fc" strokeWidth="2.4" points={series.w} />
        )}
        {project.phaseSystem === '3P' && project.modulationMode === 'SVPWM' && (
          <polyline fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="6 4" points={series.zero} />
        )}

        <line x1={cursorX} y1="6" x2={cursorX} y2={H - 6} stroke="#f8fafc" strokeWidth="1.6" opacity="0.8" />
        <circle cx={cursorX} cy={midY - cur.vu * ampY} r="4.5" fill="#38bdf8" stroke="#fff" strokeWidth="1.4" />
        <circle cx={cursorX} cy={midY - cur.vv * ampY} r="4.5" fill="#34d399" stroke="#fff" strokeWidth="1.4" />
        {project.phaseSystem === '3P' && (
          <circle cx={cursorX} cy={midY - cur.vw * ampY} r="4.5" fill="#c084fc" stroke="#fff" strokeWidth="1.4" />
        )}
      </svg>
    </div>
  );
}

export function WaveformPanel({
  project,
  hw,
  activeChannelId,
  onActiveChannel,
  onChannelChange,
  onPatch,
  onAddChannel,
  onRemoveChannel,
  onPlayToggle,
  playing,
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const svgRefs = useRef<Record<number, SVGSVGElement | null>>({});

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const el = svgRefs.current[drag.chId];
      const rect = el?.getBoundingClientRect();
      const scale = rect && rect.width > 0 ? SVG_W / rect.width : 1;
      const deltaPx = (e.clientX - drag.startX) * scale;
      const deltaTicks = (deltaPx / drag.cyclePx) * (drag.periodNs / drag.stepNs);
      const deltaNs = deltaTicks * drag.stepNs;
      const deltaPct = (deltaPx / drag.cyclePx) * 100;

      if (drag.kind === 'duty') {
        const next = Math.max(0.5, Math.min(99.5, drag.init + deltaPct));
        onChannelChange(drag.chId, { duty: Math.round(next * 10) / 10 });
      } else if (drag.kind === 'phase') {
        const next = ((drag.init + (deltaPx / drag.cyclePx) * 360) % 360 + 360) % 360;
        onChannelChange(drag.chId, { phase: Math.round(next) });
      } else if (drag.kind === 'red') {
        onChannelChange(drag.chId, { redNs: Math.max(0, Math.round(drag.init + deltaNs)) });
      } else {
        onChannelChange(drag.chId, { fedNs: Math.max(0, Math.round(drag.init + deltaNs)) });
      }
    };
    const onUp = () => setDrag(null);
    document.body.classList.add('dragging');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      document.body.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, onChannelChange]);

  const beginDrag = useCallback(
    (e: React.PointerEvent, chId: number, kind: DragKind, init: number, cyclePx: number, periodNs: number, stepNs: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (project.modulationMode !== 'FIXED') onPatch({ modulationMode: 'FIXED' });
      setDrag({ chId, kind, startX: e.clientX, init, cyclePx, periodNs, stepNs });
    },
    [onPatch, project.modulationMode],
  );

  return (
    <Card>
      <PanelHeader
        icon="wave"
        title="波形示波器 · 死区与移相交互调节"
        hint="拖动琥珀色手柄改 RED、橙色手柄改 FED、白色手柄改占空比、绿色圆点改移相角；波形由死区传递函数实时仿真，脉宽不足时会直接显示为被吞掉。"
        right={
          <>
            {project.modulationMode !== 'FIXED' && (
              <Btn variant={playing ? 'warn' : 'accent'} icon={playing ? 'pause' : 'play'} onClick={onPlayToggle}>
                {playing ? '暂停扫描' : '扫描动画'}
              </Btn>
            )}
            <Btn variant="primary" icon="plus" onClick={onAddChannel} disabled={project.channels.length >= 4}>
              新增桥臂
            </Btn>
          </>
        }
      />

      <div className="space-y-3.5 p-4">
        {project.modulationMode !== 'FIXED' && (
          <ModulationEnvelope project={project} onAngle={deg => onPatch({ elecAngleDeg: deg })} />
        )}

        {hw.channels.map((ch, idx) => {
          const color = COLORS[idx % COLORS.length] ?? COLORS[0];
          const cyclePx = PLOT_W / PERIODS;
          const periodTicks = ch.wave.periodTicks;
          const phasePx = (ch.syncEnabled ? (((ch.cfg.phase % 360) + 360) % 360) / 360 : 0) * cyclePx;
          const xs = PAD_L;
          const xe = SVG_W - PAD_R;

          const runsA = scanRuns(ch.wave.highA, periodTicks, phasePx, cyclePx, xs, xe);
          const runsB = scanRuns(ch.wave.highB, periodTicks, phasePx, cyclePx, xs, xe);
          const pathA = stepPathFromRuns(runsA, 26, 66, xs, xe);
          const pathB = stepPathFromRuns(runsB, 96, 136, xs, xe);

          // 抓手位置：都贴在信号的真实跳变沿上（沿用原 dsp_epwm.tsx 的交互设计）
          const lastCycleStart = phasePx + cyclePx * (PERIODS - 1);
          const aRise = ch.wave.highA.find(h => h.end - h.start > 0);
          const redX = lastCycleStart + ((aRise ? aRise.start : 0) / periodTicks) * cyclePx;
          const aFallTick = aRise ? aRise.end : periodTicks * 0.5;
          const dutyX = lastCycleStart + (aFallTick / periodTicks) * cyclePx;
          const bRise = ch.wave.highB.find(h => h.end - h.start > 0);
          const fedX = lastCycleStart + ((bRise ? bRise.start : periodTicks * 0.75) / periodTicks) * cyclePx;
          const phaseX = PAD_L + lastCycleStart;

          // 标签默认放在抓手右侧；靠近右边界时翻到左侧，避免被裁掉
          const labelAt = (x: number, width: number) =>
            x + 9 + width > SVG_W - 8
              ? { x: x - 9, anchor: 'end' as const }
              : { x: x + 9, anchor: 'start' as const };
          const redLabel = labelAt(redX, 92);
          const dutyLabel = labelAt(dutyX, 108);
          const fedLabel = labelAt(fedX, 92);

          const isActive = activeChannelId === ch.cfg.id;

          return (
            <div
              key={ch.cfg.id}
              onClick={() => onActiveChannel(ch.cfg.id)}
              className={cx(
                'rounded-xl border bg-slate-950/80 p-3.5 transition-colors',
                isActive ? 'border-sky-500/70' : 'border-slate-800 hover:border-slate-700',
              )}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-lg px-2.5 py-0.5 text-base font-bold text-slate-950"
                    style={{ backgroundColor: color.main }}
                  >
                    ePWM{ch.cfg.id}
                  </span>
                  <span className="text-base font-semibold text-white">{ch.cfg.name}</span>
                  <Badge tone="slate" mono>
                    {ch.tb.actualFswKhz.toFixed(3)} kHz
                  </Badge>
                  <Badge tone="slate" mono title="周期寄存器值">
                    TBPRD {ch.tb.tbprd}
                  </Badge>
                  <Badge tone={ch.wave.swallowedA || ch.wave.swallowedB ? 'rose' : 'slate'} mono>
                    A {ch.wave.actualDutyAPct.toFixed(1)}% / B {ch.wave.actualDutyBPct.toFixed(1)}%
                  </Badge>
                  {ch.syncEnabled && (
                    <Badge tone="emerald" mono>
                      Δφ {ch.cfg.phase}° · TBPHS {ch.phase.tbphs} · {ch.phase.phsDir}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NumberBadge
                    label="Duty"
                    unit="%"
                    tone="sky"
                    value={ch.cfg.duty}
                    min={0.5}
                    max={99.5}
                    step={0.1}
                    decimals={1}
                    title="ePWMxA 占空比，可直接输入或用下方白色手柄拖动"
                    onChange={v => onChannelChange(ch.cfg.id, { duty: v })}
                  />
                  <NumberBadge
                    label="RED"
                    unit="ns"
                    tone="amber"
                    value={ch.cfg.redNs}
                    min={0}
                    max={maxDbOf(ch)}
                    step={10}
                    decimals={0}
                    title="上升沿死区，可直接输入或用波形上的琥珀色手柄拖动"
                    onChange={v => onChannelChange(ch.cfg.id, { redNs: v })}
                  />
                  <NumberBadge
                    label="FED"
                    unit="ns"
                    tone="amber"
                    value={ch.cfg.fedNs}
                    min={0}
                    max={maxDbOf(ch)}
                    step={10}
                    decimals={0}
                    title="下降沿死区，可直接输入或用波形上的橙色手柄拖动"
                    onChange={v => onChannelChange(ch.cfg.id, { fedNs: v })}
                  />
                  {project.channels.length > 1 && ch.cfg.id !== 1 && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onRemoveChannel(ch.cfg.id);
                      }}
                      className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                      title="删除该桥臂"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
              </div>

              <svg
                ref={el => {
                  svgRefs.current[ch.cfg.id] = el;
                }}
                viewBox={`0 0 ${SVG_W} 156`}
                className="w-full select-none rounded-lg border border-slate-800 bg-[#070b12]"
              >
                {/* 时间刻度 */}
                {Array.from({ length: PERIODS * 4 + 1 }).map((_, i) => {
                  const x = PAD_L + (i / 4) * cyclePx + phasePx;
                  if (x < PAD_L || x > xe) return null;
                  return (
                    <line key={i} x1={x} y1="12" x2={x} y2="146" stroke="#16233a" strokeDasharray="3 5" />
                  );
                })}
                <line x1={PAD_L} y1="66" x2={xe} y2="66" stroke="#233046" />
                {/* A/B 之间的分隔虚线（原设计里的中线） */}
                <line x1={PAD_L} y1="81" x2={xe} y2="81" stroke="#1e293b" strokeDasharray="2 3" />
                <line x1={PAD_L} y1="136" x2={xe} y2="136" stroke="#233046" />

                {/* 死区阴影 */}
                {ch.cfg.mode !== 'BYPASS' &&
                  Array.from({ length: PERIODS + 1 }).map((_, k) => {
                    const base = PAD_L + phasePx + k * cyclePx;
                    const redW = (ch.dbRed / periodTicks) * cyclePx;
                    const fedW = (ch.dbFed / periodTicks) * cyclePx;
                    const fallX = base + (aFallTick / periodTicks) * cyclePx;
                    return (
                      <g key={k}>
                        {redW > 0.5 && (
                          <rect x={base} y="26" width={redW} height="40" fill="rgba(245,158,11,0.28)" stroke="#f59e0b" strokeDasharray="2 2" />
                        )}
                        {fedW > 0.5 && (
                          <rect x={fallX} y="96" width={fedW} height="40" fill="rgba(249,115,22,0.28)" stroke="#fb923c" strokeDasharray="2 2" />
                        )}
                      </g>
                    );
                  })}

                {/* B 相（下）与 A 相（上） */}
                {runsB.map((r, i) => (
                  <rect
                    key={`fb${i}`}
                    x={r.x0}
                    y={96}
                    width={Math.max(0.4, r.x1 - r.x0)}
                    height={40}
                    fill="rgba(148,163,184,0.18)"
                  />
                ))}
                <path d={pathB} fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinejoin="round" />

                {runsA.map((r, i) => (
                  <rect
                    key={`fa${i}`}
                    x={r.x0}
                    y={26}
                    width={Math.max(0.4, r.x1 - r.x0)}
                    height={40}
                    fill={color.fill}
                  />
                ))}
                <path d={pathA} fill="none" stroke={color.main} strokeWidth="2.6" strokeLinejoin="round" />

                {/*
                  抓手贴在信号跳变沿上（沿用原 dsp_epwm.tsx 的交互）：
                  竖条正好压住沿的位置，标签紧随其右，靠近右边界时自动翻到左侧。
                  每个抓手额外叠一块透明矩形，把可拖拽区域加宽到 18px。
                */}
                {ch.syncEnabled && (
                  <g
                    className="cursor-ew-resize"
                    onPointerDown={e =>
                      beginDrag(e, ch.cfg.id, 'phase', ch.cfg.phase, cyclePx, ch.tb.periodNs, ch.tb.stepNs)
                    }
                  >
                    <title>{`拖动设置移相角（当前 TBPHS = ${ch.phase.tbphs}）`}</title>
                    <line x1={phaseX} y1={26} x2={phaseX} y2={136} stroke="#34d399" strokeDasharray="3 5" strokeWidth="1.2" opacity="0.4" />
                    <rect x={phaseX - 9} y={26} width="18" height="42" fill="transparent" />
                    <circle cx={phaseX} cy={40} r="7" fill="#34d399" stroke="#0b1220" strokeWidth="2" />
                  </g>
                )}

                {ch.cfg.mode !== 'BYPASS' && !ch.wave.swallowedA && (
                  <g
                    className="cursor-ew-resize"
                    onPointerDown={e =>
                      beginDrag(e, ch.cfg.id, 'red', ch.cfg.redNs, cyclePx, ch.tb.periodNs, ch.tb.stepNs)
                    }
                  >
                    <title>拖动设置上升沿死区 RED</title>
                    <rect x={redX - 9} y={26} width="18" height="40" fill="transparent" />
                    <rect x={redX - 5} y={26} width="10" height="22" rx="2" fill="#f59e0b" stroke="#0b1220" strokeWidth="1.5" />
                    <text x={redLabel.x} y={42} textAnchor={redLabel.anchor} fill="#fcd34d" fontSize="15" fontWeight="700">
                      RED {ch.cfg.redNs}ns
                    </text>
                  </g>
                )}

                <g
                  className="cursor-ew-resize"
                  onPointerDown={e =>
                    beginDrag(e, ch.cfg.id, 'duty', ch.cfg.duty, cyclePx, ch.tb.periodNs, ch.tb.stepNs)
                  }
                >
                  <title>拖动设置占空比</title>
                  <rect x={dutyX - 9} y={26} width="18" height="40" fill="transparent" />
                  <rect x={dutyX - 5} y={34} width="10" height="26" rx="2" fill="#f8fafc" stroke="#0284c7" strokeWidth="2" />
                  <text x={dutyLabel.x} y={56} textAnchor={dutyLabel.anchor} fill="#e2e8f0" fontSize="15" fontWeight="700">
                    Duty {ch.cfg.duty.toFixed(1)}%
                  </text>
                </g>

                {ch.cfg.mode !== 'BYPASS' && !ch.wave.swallowedB && (
                  <g
                    className="cursor-ew-resize"
                    onPointerDown={e =>
                      beginDrag(e, ch.cfg.id, 'fed', ch.cfg.fedNs, cyclePx, ch.tb.periodNs, ch.tb.stepNs)
                    }
                  >
                    <title>拖动设置下降沿死区 FED</title>
                    <rect x={fedX - 9} y={96} width="18" height="40" fill="transparent" />
                    <rect x={fedX - 5} y={96} width="10" height="22" rx="2" fill="#fb923c" stroke="#0b1220" strokeWidth="1.5" />
                    <text x={fedLabel.x} y={112} textAnchor={fedLabel.anchor} fill="#fdba74" fontSize="15" fontWeight="700">
                      FED {ch.cfg.fedNs}ns
                    </text>
                  </g>
                )}

                <text x="6" y="50" fill={color.main} fontSize="15" fontWeight="700">
                  ePWM{ch.cfg.id}A
                </text>
                <text x="6" y="120" fill="#94a3b8" fontSize="15" fontWeight="700">
                  ePWM{ch.cfg.id}B
                </text>

                {ch.wave.approximate && (
                  <text x={PAD_L + 8} y={80} fill="#f59e0b" fontSize="14">
                    交叉 IN_MODE：波形为示意，寄存器配置见生成代码
                  </text>
                )}
              </svg>

              {ch.wave.swallowedA || ch.wave.swallowedB ? (
                <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-base text-rose-300">
                  <Icon name="alert" size={15} className="mr-1 inline align-[-2px]" />
                  死区过大：{ch.wave.swallowedA ? 'A 相高电平' : ''}
                  {ch.wave.swallowedA && ch.wave.swallowedB ? ' 与 ' : ''}
                  {ch.wave.swallowedB ? 'B 相高电平' : ''} 已被完全吞掉，桥臂将失去驱动。
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-slate-400">
                  <span>
                    死区时间：A 开通前 <strong className="font-mono text-amber-300">{ch.wave.deadTimeRiseNs.toFixed(0)} ns</strong>
                    ，B 开通前 <strong className="font-mono text-orange-300">{ch.wave.deadTimeFallNs.toFixed(0)} ns</strong>
                  </span>
                  <span className="font-mono">
                    占空比损失 ≈ {Math.max(0, ch.cfg.duty - ch.wave.actualDutyAPct).toFixed(2)}%
                  </span>
                  <span className="font-mono">T = {ch.tb.periodNs.toFixed(0)} ns</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function modulationHint(project: ProjectState): string {
  if (project.modulationMode === 'FIXED') return '固定占空比：适合 DC-DC / 移相控制';
  const limit = maxLinearModIndex(project.modulationMode);
  return `线性调制上限 M = ${limit.toFixed(4)}${project.modIndex > limit ? '（当前已过调制）' : ''}`;
}

export { ModulationEnvelope };
