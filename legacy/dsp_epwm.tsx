import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Activity,
  Code2,
  Sliders,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Upload,
  Layers,
  Settings2,
  RefreshCw,
  Globe,
  Grid,
  Play,
  Pause
} from 'lucide-react';

// ==========================================
// 1. DSP 芯片硬件规格与 CubeMX 引脚复用数据库
// ==========================================
const DSP_MODELS = {
  F280039C: {
    id: 'F280039C',
    name: 'TMS320F280039C',
    package: '64-Pin LQFP (PM)',
    series: 'Gen-3 C28x + CLB (Type-4 ePWM)',
    sysclkMHz: 120,
    tbclkMHz: 120,
    maxChannels: 8,
    hasHRPWM: true,
    mepStepPs: 150,
    dbMaxBits: 14,
    dbMaxCount: 16383,
    desc: '120MHz 主频，Type-4 ePWM 模块，14-bit 独立死区计数器 (DBRED/DBFED) 与 150ps HRPWM。',
    muxOptions: {
      ePWM1A: [{ pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' }, { pin: 49, gpio: 'GPIO30', mux: 5, reg: 'GPAMUX2' }],
      ePWM1B: [{ pin: 17, gpio: 'GPIO1', mux: 1, reg: 'GPAMUX1' }, { pin: 50, gpio: 'GPIO31', mux: 5, reg: 'GPAMUX2' }],
      ePWM2A: [{ pin: 18, gpio: 'GPIO2', mux: 1, reg: 'GPAMUX1' }, { pin: 53, gpio: 'GPIO14', mux: 1, reg: 'GPAMUX1' }],
      ePWM2B: [{ pin: 19, gpio: 'GPIO3', mux: 1, reg: 'GPAMUX1' }, { pin: 54, gpio: 'GPIO15', mux: 1, reg: 'GPAMUX1' }],
      ePWM3A: [{ pin: 20, gpio: 'GPIO4', mux: 1, reg: 'GPAMUX1' }, { pin: 57, gpio: 'GPIO16', mux: 5, reg: 'GPBMUX1' }],
      ePWM3B: [{ pin: 21, gpio: 'GPIO5', mux: 1, reg: 'GPAMUX1' }, { pin: 58, gpio: 'GPIO17', mux: 5, reg: 'GPBMUX1' }],
      ePWM4A: [{ pin: 22, gpio: 'GPIO6', mux: 1, reg: 'GPAMUX1' }, { pin: 61, gpio: 'GPIO22', mux: 6, reg: 'GPAMUX2' }],
      ePWM4B: [{ pin: 23, gpio: 'GPIO7', mux: 1, reg: 'GPAMUX1' }, { pin: 62, gpio: 'GPIO23', mux: 6, reg: 'GPAMUX2' }]
    }
  },
  F280049C: {
    id: 'F280049C',
    name: 'TMS320F280049C',
    package: '64-Pin LQFP (PM)',
    series: 'Gen-3 C28x + CLA (Type-4 ePWM)',
    sysclkMHz: 100,
    tbclkMHz: 100,
    maxChannels: 8,
    hasHRPWM: true,
    mepStepPs: 150,
    dbMaxBits: 14,
    dbMaxCount: 16383,
    desc: '100MHz 数字电源控制芯片，Type-4 ePWM，支持独立变频分频与 14-bit 独立死区。',
    muxOptions: {
      ePWM1A: [{ pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' }, { pin: 49, gpio: 'GPIO30', mux: 5, reg: 'GPAMUX2' }],
      ePWM1B: [{ pin: 17, gpio: 'GPIO1', mux: 1, reg: 'GPAMUX1' }, { pin: 50, gpio: 'GPIO31', mux: 5, reg: 'GPAMUX2' }],
      ePWM2A: [{ pin: 18, gpio: 'GPIO2', mux: 1, reg: 'GPAMUX1' }, { pin: 53, gpio: 'GPIO14', mux: 1, reg: 'GPAMUX1' }],
      ePWM2B: [{ pin: 19, gpio: 'GPIO3', mux: 1, reg: 'GPAMUX1' }, { pin: 54, gpio: 'GPIO15', mux: 1, reg: 'GPAMUX1' }],
      ePWM3A: [{ pin: 20, gpio: 'GPIO4', mux: 1, reg: 'GPAMUX1' }, { pin: 57, gpio: 'GPIO16', mux: 5, reg: 'GPBMUX1' }],
      ePWM3B: [{ pin: 21, gpio: 'GPIO5', mux: 1, reg: 'GPAMUX1' }, { pin: 58, gpio: 'GPIO17', mux: 5, reg: 'GPBMUX1' }],
      ePWM4A: [{ pin: 22, gpio: 'GPIO6', mux: 1, reg: 'GPAMUX1' }],
      ePWM4B: [{ pin: 23, gpio: 'GPIO7', mux: 1, reg: 'GPAMUX1' }]
    }
  },
  F28379D: {
    id: 'F28379D',
    name: 'TMS320F28379D',
    package: '100-Pin QFP (PZ)',
    series: 'Dual-Core C28x (Type-4 ePWM)',
    sysclkMHz: 200,
    tbclkMHz: 100,
    maxChannels: 12,
    hasHRPWM: true,
    mepStepPs: 150,
    dbMaxBits: 14,
    dbMaxCount: 16383,
    desc: '双核浮点 DSP，12 路独立 ePWM（24路输出），适合多级/多相复杂变流器。',
    muxOptions: {
      ePWM1A: [{ pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' }, { pin: 49, gpio: 'GPIO145', mux: 1, reg: 'GPEMUX2' }],
      ePWM1B: [{ pin: 17, gpio: 'GPIO1', mux: 1, reg: 'GPAMUX1' }, { pin: 50, gpio: 'GPIO146', mux: 1, reg: 'GPEMUX2' }],
      ePWM2A: [{ pin: 18, gpio: 'GPIO2', mux: 1, reg: 'GPAMUX1' }, { pin: 53, gpio: 'GPIO147', mux: 1, reg: 'GPEMUX2' }],
      ePWM2B: [{ pin: 19, gpio: 'GPIO3', mux: 1, reg: 'GPAMUX1' }, { pin: 54, gpio: 'GPIO148', mux: 1, reg: 'GPEMUX2' }],
      ePWM3A: [{ pin: 20, gpio: 'GPIO4', mux: 1, reg: 'GPAMUX1' }],
      ePWM3B: [{ pin: 21, gpio: 'GPIO5', mux: 1, reg: 'GPAMUX1' }],
      ePWM4A: [{ pin: 22, gpio: 'GPIO6', mux: 1, reg: 'GPAMUX1' }],
      ePWM4B: [{ pin: 23, gpio: 'GPIO7', mux: 1, reg: 'GPAMUX1' }]
    }
  },
  F28335: {
    id: 'F28335',
    name: 'TMS320F28335',
    package: '80-Pin LQFP (PGF)',
    series: 'Classic Delfino (Type-0 ePWM)',
    sysclkMHz: 150,
    tbclkMHz: 150,
    maxChannels: 6,
    hasHRPWM: false,
    mepStepPs: 0,
    dbMaxBits: 10,
    dbMaxCount: 1023,
    desc: '经典工业控制 DSP，Type-0 ePWM 模块，10-bit 独立死区寄存器 (最大 1023)。',
    muxOptions: {
      ePWM1A: [{ pin: 16, gpio: 'GPIO0', mux: 1, reg: 'GPAMUX1' }],
      ePWM1B: [{ pin: 17, gpio: 'GPIO1', mux: 1, reg: 'GPAMUX1' }],
      ePWM2A: [{ pin: 18, gpio: 'GPIO2', mux: 1, reg: 'GPAMUX1' }],
      ePWM2B: [{ pin: 19, gpio: 'GPIO3', mux: 1, reg: 'GPAMUX1' }],
      ePWM3A: [{ pin: 20, gpio: 'GPIO4', mux: 1, reg: 'GPAMUX1' }],
      ePWM3B: [{ pin: 21, gpio: 'GPIO5', mux: 1, reg: 'GPAMUX1' }],
      ePWM4A: [{ pin: 22, gpio: 'GPIO6', mux: 1, reg: 'GPAMUX1' }],
      ePWM4B: [{ pin: 23, gpio: 'GPIO7', mux: 1, reg: 'GPAMUX1' }]
    }
  }
};

const DEADBAND_MODES = {
  AHC: {
    id: 'AHC',
    name: 'AHC 高有效互补 (Active High Complementary)',
    polselBitfield: 'DB_ACTV_HIC',
    outModeBitfield: 'DB_FULL_ENABLE',
    driverLibPolA: 'EPWM_DB_POLARITY_ACTIVE_HIGH',
    driverLibPolB: 'EPWM_DB_POLARITY_ACTIVE_LOW'
  },
  ALC: {
    id: 'ALC',
    name: 'ALC 低有效互补 (Active Low Complementary)',
    polselBitfield: 'DB_ACTV_LOC',
    outModeBitfield: 'DB_FULL_ENABLE',
    driverLibPolA: 'EPWM_DB_POLARITY_ACTIVE_LOW',
    driverLibPolB: 'EPWM_DB_POLARITY_ACTIVE_HIGH'
  },
  AH: {
    id: 'AH',
    name: 'AH 独立双高有效 (Active High)',
    polselBitfield: 'DB_ACTV_HI',
    outModeBitfield: 'DB_FULL_ENABLE',
    driverLibPolA: 'EPWM_DB_POLARITY_ACTIVE_HIGH',
    driverLibPolB: 'EPWM_DB_POLARITY_ACTIVE_HIGH'
  },
  AL: {
    id: 'AL',
    name: 'AL 独立双低有效 (Active Low)',
    polselBitfield: 'DB_ACTV_LO',
    outModeBitfield: 'DB_FULL_ENABLE',
    driverLibPolA: 'EPWM_DB_POLARITY_ACTIVE_LOW',
    driverLibPolB: 'EPWM_DB_POLARITY_ACTIVE_LOW'
  },
  BYPASS: {
    id: 'BYPASS',
    name: 'BYPASS 死区旁路 (独立双输出 CMPA / CMPB)',
    polselBitfield: 'DB_ACTV_HI',
    outModeBitfield: 'DB_DISABLE',
    driverLibPolA: 'EPWM_DB_POLARITY_ACTIVE_HIGH',
    driverLibPolB: 'EPWM_DB_POLARITY_ACTIVE_HIGH'
  }
};

const DB_IN_MODES = {
  DBA_ALL: {
    id: 'DBA_ALL',
    name: 'DBA_ALL (0x0): RED与FED均以 ePWMxA 为输入源',
    usesB: false
  },
  DBB_RED_DBA_FED: {
    id: 'DBB_RED_DBA_FED',
    name: 'DBB_RED_DBA_FED (0x1): RED源为ePWMxB, FED源为ePWMxA',
    usesB: true
  },
  DBA_RED_DBB_FED: {
    id: 'DBA_RED_DBB_FED',
    name: 'DBA_RED_DBB_FED (0x2): RED源为ePWMxA, FED源为ePWMxB',
    usesB: true
  },
  DBB_ALL: {
    id: 'DBB_ALL',
    name: 'DBB_ALL (0x3): RED与FED均以 ePWMxB 为输入源',
    usesB: true
  }
};

const CHANNEL_COLORS = [
  { main: '#38bdf8', fill: 'rgba(56, 189, 248, 0.20)', bMain: '#a855f7' },
  { main: '#34d399', fill: 'rgba(52, 211, 153, 0.20)', bMain: '#f472b6' },
  { main: '#c084fc', fill: 'rgba(192, 132, 252, 0.20)', bMain: '#38bdf8' },
  { main: '#fb923c', fill: 'rgba(251, 146, 60, 0.20)', bMain: '#2dd4bf' }
];

const CLKDIV_OPTIONS = [
  { val: 1, bitEnum: 'TB_DIV1', driverEnum: 'EPWM_CLOCK_DIVIDER_1' },
  { val: 2, bitEnum: 'TB_DIV2', driverEnum: 'EPWM_CLOCK_DIVIDER_2' },
  { val: 4, bitEnum: 'TB_DIV4', driverEnum: 'EPWM_CLOCK_DIVIDER_4' },
  { val: 8, bitEnum: 'TB_DIV8', driverEnum: 'EPWM_CLOCK_DIVIDER_8' },
  { val: 16, bitEnum: 'TB_DIV16', driverEnum: 'EPWM_CLOCK_DIVIDER_16' },
  { val: 32, bitEnum: 'TB_DIV32', driverEnum: 'EPWM_CLOCK_DIVIDER_32' },
  { val: 64, bitEnum: 'TB_DIV64', driverEnum: 'EPWM_CLOCK_DIVIDER_64' },
  { val: 128, bitEnum: 'TB_DIV128', driverEnum: 'EPWM_CLOCK_DIVIDER_128' }
];

const HSPCLKDIV_OPTIONS = [
  { val: 1, bitEnum: 'TB_DIV1', driverEnum: 'EPWM_HSCLOCK_DIVIDER_1' },
  { val: 2, bitEnum: 'TB_DIV2', driverEnum: 'EPWM_HSCLOCK_DIVIDER_2' },
  { val: 4, bitEnum: 'TB_DIV4', driverEnum: 'EPWM_HSCLOCK_DIVIDER_4' },
  { val: 6, bitEnum: 'TB_DIV6', driverEnum: 'EPWM_HSCLOCK_DIVIDER_6' },
  { val: 8, bitEnum: 'TB_DIV8', driverEnum: 'EPWM_HSCLOCK_DIVIDER_8' },
  { val: 10, bitEnum: 'TB_DIV10', driverEnum: 'EPWM_HSCLOCK_DIVIDER_10' },
  { val: 12, bitEnum: 'TB_DIV12', driverEnum: 'EPWM_HSCLOCK_DIVIDER_12' },
  { val: 14, bitEnum: 'TB_DIV14', driverEnum: 'EPWM_HSCLOCK_DIVIDER_14' }
];

function computeOptimalTimeBase(sysTbclkMHz, targetFreqKhz, countMode) {
  const sysTbclkHz = sysTbclkMHz * 1e6;
  const fswHz = Math.max(10, targetFreqKhz * 1e3);

  const combinations = [];
  for (const c of CLKDIV_OPTIONS) {
    for (const h of HSPCLKDIV_OPTIONS) {
      combinations.push({ clkDiv: c, hspClkDiv: h, totalDiv: c.val * h.val });
    }
  }
  combinations.sort((a, b) => a.totalDiv - b.totalDiv);

  let chosen = combinations[combinations.length - 1];
  for (const combo of combinations) {
    const effTbclkHz = sysTbclkHz / combo.totalDiv;
    const rawTbprd = countMode === 'UP_DOWN' ? effTbclkHz / (2 * fswHz) : effTbclkHz / fswHz - 1;
    if (rawTbprd <= 65535) {
      chosen = combo;
      break;
    }
  }

  const effTbclkMHz = sysTbclkMHz / chosen.totalDiv;
  const effTbclkHz = effTbclkMHz * 1e6;
  const effStepNs = 1000 / effTbclkMHz;
  const rawTbprd = countMode === 'UP_DOWN' ? effTbclkHz / (2 * fswHz) : effTbclkHz / fswHz - 1;
  const tbprdInt = Math.max(1, Math.min(65535, Math.round(rawTbprd)));
  const actualFswHz = countMode === 'UP_DOWN' ? effTbclkHz / (2 * tbprdInt) : effTbclkHz / (tbprdInt + 1);

  return {
    clkDiv: chosen.clkDiv,
    hspClkDiv: chosen.hspClkDiv,
    totalDiv: chosen.totalDiv,
    effTbclkMHz,
    effStepNs,
    tbprdInt,
    actualFswKhz: actualFswHz / 1e3,
    periodNs: 1e9 / actualFswHz,
    periodUs: 1e6 / actualFswHz
  };
}

// 计算 SPWM 或 SVPWM 在指定电角度 thetaDeg 下的瞬时占空比与零序分量
function computeModulationInstant(modMode, phaseSystem, modIndex, thetaDeg) {
  const rad = (thetaDeg * Math.PI) / 180;
  if (phaseSystem === '1P') {
    const vu = modIndex * Math.sin(rad);
    const vv = -vu; // 单相全桥双极性/单极性倍频反相桥臂
    return {
      vu,
      vv,
      vw: 0,
      vOffset: 0,
      du: Math.max(2, Math.min(98, Number((50 + 50 * vu).toFixed(1)))),
      dv: Math.max(2, Math.min(98, Number((50 + 50 * vv).toFixed(1)))),
      dw: 50
    };
  }

  const vuRaw = modIndex * Math.sin(rad);
  const vvRaw = modIndex * Math.sin(rad - (2 * Math.PI) / 3);
  const vwRaw = modIndex * Math.sin(rad + (2 * Math.PI) / 3);

  let vOffset = 0;
  if (modMode === 'SVPWM') {
    const vMax = Math.max(vuRaw, vvRaw, vwRaw);
    const vMin = Math.min(vuRaw, vvRaw, vwRaw);
    vOffset = -0.5 * (vMax + vMin);
  }

  const vu = Math.max(-1, Math.min(1, vuRaw + vOffset));
  const vv = Math.max(-1, Math.min(1, vvRaw + vOffset));
  const vw = Math.max(-1, Math.min(1, vwRaw + vOffset));

  return {
    vu,
    vv,
    vw,
    vOffset,
    du: Math.max(2, Math.min(98, Number((50 + 50 * vu).toFixed(1)))),
    dv: Math.max(2, Math.min(98, Number((50 + 50 * vv).toFixed(1)))),
    dw: Math.max(2, Math.min(98, Number((50 + 50 * vw).toFixed(1))))
  };
}

// 生成连续高低电平阶梯方波 SVG Path (M ... H ... V ... H ... V ...)
function buildContinuousSquareWavePath({
  totalWidth,
  cycleW,
  shiftOffset,
  pulses,
  yHigh,
  yLow,
  invertBaseline = false
}) {
  const segments = [];
  for (let c = -1; c <= 3; c++) {
    const base = 70 + c * cycleW + shiftOffset;
    for (const p of pulses) {
      const s = base + p.start;
      const e = base + p.end;
      if (e > s + 0.5 && e > 70 && s < totalWidth) {
        segments.push([Math.max(70, s), Math.min(totalWidth, e)]);
      }
    }
  }
  segments.sort((a, b) => a[0] - b[0]);

  const baseLevel = invertBaseline ? yHigh : yLow;
  const activeLevel = invertBaseline ? yLow : yHigh;

  let d = `M 70 ${baseLevel}`;
  let fillD = '';
  let curX = 70;

  for (const [s, e] of segments) {
    if (s > curX) {
      d += ` H ${s.toFixed(1)}`;
    }
    d += ` V ${activeLevel} H ${e.toFixed(1)} V ${baseLevel}`;
    fillD += `M ${s.toFixed(1)} ${ yLow } L ${s.toFixed(1)} ${yHigh} L ${e.toFixed(1)} ${yHigh} L ${e.toFixed(1)} ${yLow} Z `;
    curX = e;
  }
  if (curX < totalWidth) {
    d += ` H ${totalWidth}`;
  }
  return { linePath: d, fillPath: fillD };
}

// C 语言语法高亮渲染组件 (字号严格 >= 16px / 12pt)
function SyntaxHighlightedCode({ code }) {
  const lines = useMemo(() => code.split('\n'), [code]);

  return (
    <div className="font-mono text-base leading-relaxed select-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        let rendered;
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          rendered = <span className="text-emerald-400 italic">{line}</span>;
        } else if (trimmed.startsWith('#include') || trimmed.startsWith('#define')) {
          rendered = <span className="text-fuchsia-400 font-semibold">{line}</span>;
        } else {
          const commentIdx = line.indexOf('//');
          const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
          const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';
          const htmlCode = codePart
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\b(void|int|uint16_t|uint32_t|float|for|if|else|return|while|__interrupt)\b/g, '<span class="text-purple-400 font-semibold">$1</span>')
            .replace(/\b(EPwm\d+Regs|CpuSysRegs|GpioCtrlRegs|PieCtrlRegs|PieVectTable|EALLOW|EDIS|DINT|EINT|ERTM|IER|IFR|NOP)\b/g, '<span class="text-sky-300 font-semibold">$1</span>')
            .replace(/\b(TB_[A-Z0-9_]+|CC_[A-Z0-9_]+|AQ_[A-Z0-9_]+|DB_[A-Z0-9_]+|DBA_[A-Z0-9_]+|DBB_[A-Z0-9_]+|ET_[A-Z0-9_]+|EPWM_[A-Z0-9_]+|GPIO_[A-Z0-9_]+|PIE_[A-Z0-9_]+|M_INT3)\b/g, '<span class="text-amber-300">$1</span>')
            .replace(/\b(0x[0-9A-Fa-f]+|\d+(?:\.\d+)?f?U?)\b/g, '<span class="text-orange-400">$1</span>');

          rendered = (
            <>
              <span dangerouslySetInnerHTML={{ __html: htmlCode }} />
              {commentPart && <span className="text-emerald-400 italic">{commentPart}</span>}
            </>
          );
        }

        return (
          <div key={idx} className="flex hover:bg-slate-800/60 px-2 py-0.5 rounded">
            <span className="w-12 select-none text-slate-500 text-right pr-4 shrink-0">{idx + 1}</span>
            <span className="flex-1 whitespace-pre">{rendered}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  // ---- 全局硬件与主时基状态 ----
  const [selectedDspId, setSelectedDspId] = useState('F280039C');
  const [freqKhz, setFreqKhz] = useState(100);
  const [countMode, setCountMode] = useState('UP_DOWN');
  const [viewMode, setViewMode] = useState('SPLIT'); // 'SPLIT' | 'WAVE' | 'PINOUT'

  // ---- 单相 / 三相系统切换与子拓扑状态 ----
  const [phaseSystem, setPhaseSystem] = useState('3P'); // '1P' | '3P'
  const [subTopology, setSubTopology] = useState('3P_3LEG');
  const [threePhaseSyncLock, setThreePhaseSyncLock] = useState(true);

  // ---- 调制方式状态: FIXED (固定占空比/移相) | SPWM | SVPWM ----
  const [modulationMode, setModulationMode] = useState('SVPWM');
  const [modIndex, setModIndex] = useState(0.95);
  const [fundFreqHz, setFundFreqHz] = useState(50);
  const [elecAngleDeg, setElecAngleDeg] = useState(35);
  const [isPlayingMod, setIsPlayingMod] = useState(false);

  // ---- 代码生成控制状态 (默认手动使能更新 + 支持中英双语注释) ----
  const [codeStyle, setCodeStyle] = useState('BITFIELD'); // 'BITFIELD' | 'DRIVERLIB'
  const [commentLang, setCommentLang] = useState('CN'); // 'CN' | 'EN'
  const [autoSyncCode, setAutoSyncCode] = useState(false);
  const [isCodeDirty, setIsCodeDirty] = useState(false);
  const [displayedCode, setDisplayedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState(1);
  const fileInputRef = useRef(null);

  // ---- ePWM 通道列表状态 (RED 与 FED 完全独立设置，附带可选对称锁 lockDb) ----
  const [channels, setChannels] = useState([
    {
      id: 1,
      name: '三相 U 相桥臂 (Phase U)',
      independentFreq: false,
      customFreqKhz: 100,
      duty: 85.4,
      dutyB: 50,
      phase: 0,
      redNs: 180,
      fedNs: 280,
      lockDb: false,
      mode: 'AHC',
      inMode: 'DBA_ALL',
      muxIdxA: 0,
      muxIdxB: 0,
      enabled: true
    },
    {
      id: 2,
      name: '三相 V 相桥臂 (Phase V)',
      independentFreq: false,
      customFreqKhz: 100,
      duty: 14.6,
      dutyB: 50,
      phase: 0,
      redNs: 180,
      fedNs: 280,
      lockDb: false,
      mode: 'AHC',
      inMode: 'DBA_ALL',
      muxIdxA: 0,
      muxIdxB: 0,
      enabled: true
    },
    {
      id: 3,
      name: '三相 W 相桥臂 (Phase W)',
      independentFreq: false,
      customFreqKhz: 100,
      duty: 60.2,
      dutyB: 50,
      phase: 0,
      redNs: 180,
      fedNs: 280,
      lockDb: false,
      mode: 'AHC',
      inMode: 'DBA_ALL',
      muxIdxA: 0,
      muxIdxB: 0,
      enabled: true
    }
  ]);

  const currentDsp = DSP_MODELS[selectedDspId];

  // 当处于 SPWM 或 SVPWM 模式时，根据电角度实时更新各相瞬时占空比
  useEffect(() => {
    if (modulationMode === 'FIXED') return;
    const inst = computeModulationInstant(modulationMode, phaseSystem, modIndex, elecAngleDeg);
    setChannels(prev =>
      prev.map((ch, idx) => {
        if (idx === 0) return { ...ch, duty: inst.du };
        if (idx === 1) return { ...ch, duty: inst.dv };
        if (idx === 2) return { ...ch, duty: inst.dw };
        if (idx === 3) return { ...ch, duty: Number((50 + 50 * inst.vOffset).toFixed(1)) };
        return ch;
      })
    );
  }, [modulationMode, phaseSystem, modIndex, elecAngleDeg]);

  // 动态调制包络线动画定时器
  useEffect(() => {
    if (!isPlayingMod || modulationMode === 'FIXED') return;
    const timer = setInterval(() => {
      setElecAngleDeg(prev => (prev + 4) % 360);
    }, 50);
    return () => clearInterval(timer);
  }, [isPlayingMod, modulationMode]);

  // ==========================================
  // 2. 单相 / 三相拓扑切换与扩展控制
  // ==========================================
  const handleSwitchPhaseTopology = (sys, sub) => {
    setPhaseSystem(sys);
    setSubTopology(sub);
    setIsPlayingMod(false);
    if (!autoSyncCode) setIsCodeDirty(true);

    if (sub === '1P_HB') {
      setModulationMode('FIXED');
      setChannels([
        { id: 1, name: '单相半桥主桥臂 (1x ePWM)', independentFreq: false, customFreqKhz: freqKhz, duty: 50, dutyB: 50, phase: 0, redNs: 180, fedNs: 260, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true }
      ]);
    } else if (sub === '1P_FB') {
      setModulationMode('FIXED');
      setChannels([
        { id: 1, name: '单相全桥超前臂 (Leading Leg)', independentFreq: false, customFreqKhz: freqKhz, duty: 50, dutyB: 50, phase: 0, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 2, name: '单相全桥滞后臂 (Lagging Leg)', independentFreq: false, customFreqKhz: freqKhz, duty: 50, dutyB: 50, phase: 120, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true }
      ]);
    } else if (sub === '1P_TOTEM') {
      setModulationMode('FIXED');
      setChannels([
        { id: 1, name: '图腾柱高频快管臂 (100kHz SiC)', independentFreq: false, customFreqKhz: freqKhz, duty: 65, dutyB: 50, phase: 0, redNs: 120, fedNs: 180, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 2, name: '图腾柱工频慢管臂 (独立低频)', independentFreq: true, customFreqKhz: 25, duty: 50, dutyB: 50, phase: 0, redNs: 400, fedNs: 400, lockDb: true, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true }
      ]);
    } else if (sub === '3P_3LEG') {
      const inst = computeModulationInstant(modulationMode === 'FIXED' ? 'SVPWM' : modulationMode, '3P', modIndex, elecAngleDeg);
      if (modulationMode === 'FIXED') setModulationMode('SVPWM');
      setChannels([
        { id: 1, name: '三相 U 相桥臂 (Phase U)', independentFreq: false, customFreqKhz: freqKhz, duty: inst.du, dutyB: 50, phase: 0, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 2, name: '三相 V 相桥臂 (Phase V)', independentFreq: false, customFreqKhz: freqKhz, duty: inst.dv, dutyB: 50, phase: 0, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 3, name: '三相 W 相桥臂 (Phase W)', independentFreq: false, customFreqKhz: freqKhz, duty: inst.dw, dutyB: 50, phase: 0, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true }
      ]);
    } else if (sub === '3P_4LEG') {
      const inst = computeModulationInstant(modulationMode === 'FIXED' ? 'SVPWM' : modulationMode, '3P', modIndex, elecAngleDeg);
      if (modulationMode === 'FIXED') setModulationMode('SVPWM');
      setChannels([
        { id: 1, name: '三相 U 相桥臂 (Phase U)', independentFreq: false, customFreqKhz: freqKhz, duty: inst.du, dutyB: 50, phase: 0, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 2, name: '三相 V 相桥臂 (Phase V)', independentFreq: false, customFreqKhz: freqKhz, duty: inst.dv, dutyB: 50, phase: 0, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 3, name: '三相 W 相桥臂 (Phase W)', independentFreq: false, customFreqKhz: freqKhz, duty: inst.dw, dutyB: 50, phase: 0, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 4, name: '第四桥臂 N 相中线 (Neutral Leg)', independentFreq: false, customFreqKhz: freqKhz, duty: 50, dutyB: 50, phase: 0, redNs: 180, fedNs: 280, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true }
      ]);
    } else if (sub === '3P_INTERLEAVED') {
      setModulationMode('FIXED');
      setChannels([
        { id: 1, name: '交错 U 相桥臂 (0°)', independentFreq: false, customFreqKhz: freqKhz, duty: 50, dutyB: 50, phase: 0, redNs: 180, fedNs: 260, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 2, name: '交错 V 相桥臂 (120°)', independentFreq: false, customFreqKhz: freqKhz, duty: 50, dutyB: 50, phase: 120, redNs: 180, fedNs: 260, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true },
        { id: 3, name: '交错 W 相桥臂 (240°)', independentFreq: false, customFreqKhz: freqKhz, duty: 50, dutyB: 50, phase: 240, redNs: 180, fedNs: 260, lockDb: false, mode: 'AHC', inMode: 'DBA_ALL', muxIdxA: 0, muxIdxB: 0, enabled: true }
      ]);
    }
  };

  // ==========================================
  // 3. DSP 寄存器精确数学计算引擎 (独立计算 DBRED 与 DBFED + PHSDIR)
  // ==========================================
  const hardwareMetrics = useMemo(() => {
    const sysTbclkStepNs = 1000 / currentDsp.tbclkMHz;
    const masterTb = computeOptimalTimeBase(currentDsp.tbclkMHz, freqKhz, countMode);

    const channelRegs = channels.map((ch, idx) => {
      const targetFreqKhz = ch.independentFreq && idx > 0 ? ch.customFreqKhz : freqKhz;
      const tb = computeOptimalTimeBase(currentDsp.tbclkMHz, targetFreqKhz, countMode);

      // 在增减对称计数下，CAU=CLEAR, CAD=SET 时，高电平占空比 D 对应 CMPA = D * TBPRD
      const idealCmpaFloat =
        countMode === 'UP_DOWN'
          ? (ch.duty / 100) * tb.tbprdInt
          : (ch.duty / 100) * (tb.tbprdInt + 1);
      const cmpaInt = Math.max(0, Math.min(tb.tbprdInt, Math.round(idealCmpaFloat)));

      const idealCmpbFloat =
        countMode === 'UP_DOWN'
          ? ((ch.dutyB ?? 50) / 100) * tb.tbprdInt
          : ((ch.dutyB ?? 50) / 100) * (tb.tbprdInt + 1);
      const cmpbInt = Math.max(0, Math.min(tb.tbprdInt, Math.round(idealCmpbFloat)));

      const isSyncEnabled = idx > 0 && !ch.independentFreq;
      const normalizedPhase = ((ch.phase % 360) + 360) % 360;
      let tbphsInt = 0;
      let phsDirBit = 'TB_DOWN';
      let phsDirDriver = 'EPWM_COUNT_MODE_DOWN_AFTER_SYNC';

      if (isSyncEnabled) {
        if (countMode === 'UP_DOWN') {
          if (normalizedPhase <= 180) {
            tbphsInt = Math.round((normalizedPhase / 180) * tb.tbprdInt);
            phsDirBit = 'TB_DOWN';
            phsDirDriver = 'EPWM_COUNT_MODE_DOWN_AFTER_SYNC';
          } else {
            tbphsInt = Math.round(((360 - normalizedPhase) / 180) * tb.tbprdInt);
            phsDirBit = 'TB_UP';
            phsDirDriver = 'EPWM_COUNT_MODE_UP_AFTER_SYNC';
          }
        } else {
          tbphsInt = Math.round((((360 - normalizedPhase) % 360) / 360) * (tb.tbprdInt + 1));
          phsDirBit = 'TB_UP';
          phsDirDriver = 'EPWM_COUNT_MODE_UP_AFTER_SYNC';
        }
      }

      const dbMax = currentDsp.dbMaxCount;
      const rawDbred = ch.mode === 'BYPASS' ? 0 : Math.round(ch.redNs / tb.effStepNs);
      const rawDbfed = ch.mode === 'BYPASS' ? 0 : Math.round(ch.fedNs / tb.effStepNs);
      const dbredInt = Math.max(0, Math.min(dbMax, rawDbred));
      const dbfedInt = Math.max(0, Math.min(dbMax, rawDbfed));

      const actualRedNs = dbredInt * tb.effStepNs;
      const actualFedNs = dbfedInt * tb.effStepNs;

      return {
        id: ch.id,
        targetFreqKhz,
        tb,
        isSyncEnabled,
        cmpaInt,
        cmpbInt,
        tbphsInt,
        phsDirBit,
        phsDirDriver,
        dbredInt,
        dbfedInt,
        actualRedNs,
        actualFedNs
      };
    });

    return {
      sysTbclkStepNs,
      masterTb,
      periodNs: masterTb.periodNs,
      periodUs: masterTb.periodUs,
      tbprdInt: masterTb.tbprdInt,
      actualFswKhz: masterTb.actualFswKhz,
      channelRegs
    };
  }, [currentDsp, freqKhz, countMode, channels]);

  // ==========================================
  // 4. 通道状态更新（支持独立调节 RED/FED 与三相参数同步锁）
  // ==========================================
  const updateChannel = useCallback(
    (id, patch) => {
      setChannels(prev =>
        prev.map((ch, idx) => {
          const isTarget = ch.id === id;
          const isSynced3P =
            !isTarget &&
            phaseSystem === '3P' &&
            threePhaseSyncLock &&
            id <= 3 &&
            ch.id <= 3;

          if (!isTarget && !isSynced3P) return ch;

          // 若处于三相联动锁定模式，将死区参数、死区模式或固定占空比同步到其他两相
          const effectivePatch = isTarget
            ? patch
            : {
                ...(patch.redNs !== undefined ? { redNs: patch.redNs } : {}),
                ...(patch.fedNs !== undefined ? { fedNs: patch.fedNs } : {}),
                ...(patch.lockDb !== undefined ? { lockDb: patch.lockDb } : {}),
                ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
                ...(modulationMode === 'FIXED' && patch.duty !== undefined ? { duty: patch.duty } : {})
              };

          if (Object.keys(effectivePatch).length === 0) return ch;

          const updated = { ...ch, ...effectivePatch };
          if (idx === 0) {
            updated.independentFreq = false;
            updated.phase = 0;
          }
          if (updated.duty !== undefined) {
            updated.duty = Math.max(2, Math.min(98, Number(Number(updated.duty).toFixed(1))));
          }
          if (updated.dutyB !== undefined) {
            updated.dutyB = Math.max(2, Math.min(98, Number(Number(updated.dutyB).toFixed(1))));
          }
          if (updated.phase !== undefined) {
            updated.phase = idx === 0 ? 0 : Math.max(0, Math.min(360, Math.round(updated.phase)));
          }
          if (updated.customFreqKhz !== undefined) {
            updated.customFreqKhz = Math.max(0.5, Math.min(500, Number(updated.customFreqKhz)));
          }

          const chFreq = updated.independentFreq && idx > 0 ? updated.customFreqKhz : freqKhz;
          const chPeriodNs = 1e6 / Math.max(0.5, chFreq);
          const maxDbNs = Math.round(chPeriodNs * 0.42);

          if (effectivePatch.redNs !== undefined) {
            updated.redNs = Math.max(0, Math.min(maxDbNs, Math.round(effectivePatch.redNs)));
            if (updated.lockDb) updated.fedNs = updated.redNs;
          }
          if (effectivePatch.fedNs !== undefined) {
            updated.fedNs = Math.max(0, Math.min(maxDbNs, Math.round(effectivePatch.fedNs)));
            if (updated.lockDb) updated.redNs = updated.fedNs;
          }
          return updated;
        })
      );
      if (!autoSyncCode) setIsCodeDirty(true);
    },
    [freqKhz, autoSyncCode, phaseSystem, threePhaseSyncLock, modulationMode]
  );

  const addChannel = () => {
    if (channels.length >= 4) return;
    const nextId = channels.length + 1;
    setChannels(prev => [
      ...prev,
      {
        id: nextId,
        name: `扩展桥臂 ePWM${nextId}`,
        independentFreq: false,
        customFreqKhz: freqKhz,
        duty: 50,
        dutyB: 50,
        phase: ((nextId - 1) * 90) % 360,
        redNs: 180,
        fedNs: 280,
        lockDb: false,
        mode: 'AHC',
        inMode: 'DBA_ALL',
        muxIdxA: 0,
        muxIdxB: 0,
        enabled: true
      }
    ]);
    if (!autoSyncCode) setIsCodeDirty(true);
  };

  const removeChannel = id => {
    if (channels.length <= 1 || id === 1) return;
    setChannels(prev => prev.filter(c => c.id !== id).map((c, i) => ({ ...c, id: i + 1 })));
    if (!autoSyncCode) setIsCodeDirty(true);
  };

  // ==========================================
  // 5. SVG 示波器直接拖拽交互 (支持独立拖拽 RED 与 FED)
  // ==========================================
  const svgContainerRef = useRef(null);
  const [dragState, setDragState] = useState(null);

  useEffect(() => {
    if (!dragState) return;
    const handlePointerMove = e => {
      if (!svgContainerRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const rect = svgContainerRef.current.getBoundingClientRect();
      const svgWidth = rect.width || 750;
      const deltaPx = clientX - dragState.startX;

      const chIdx = channels.findIndex(c => c.id === dragState.chId);
      if (chIdx < 0) return;
      const ch = channels[chIdx];
      const reg = hardwareMetrics.channelRegs[chIdx];
      const periodRatio = Math.max(0.2, Math.min(4, reg.tb.periodNs / hardwareMetrics.periodNs));
      const cyclePx = (330 * periodRatio * svgWidth) / 820;

      if (dragState.type === 'DUTY_A') {
        if (modulationMode !== 'FIXED') setModulationMode('FIXED');
        const deltaPct = (deltaPx / cyclePx) * 100;
        updateChannel(ch.id, { duty: dragState.initVal + deltaPct });
      } else if (dragState.type === 'PHASE') {
        const deltaDeg = (deltaPx / cyclePx) * 360;
        updateChannel(ch.id, { phase: (dragState.initVal + deltaDeg + 360) % 360 });
      } else if (dragState.type === 'RED') {
        const deltaNs = (deltaPx / cyclePx) * reg.tb.periodNs;
        updateChannel(ch.id, { redNs: dragState.initVal + deltaNs });
      } else if (dragState.type === 'FED') {
        const deltaNs = (deltaPx / cyclePx) * reg.tb.periodNs;
        updateChannel(ch.id, { fedNs: dragState.initVal + deltaNs });
      }
    };

    const handlePointerUp = () => setDragState(null);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [dragState, channels, hardwareMetrics, updateChannel, modulationMode]);

  // ==========================================
  // 6. 生成双语注释 (CN/EN) + SPWM/SVPWM ISR 的 C2000 工程代码
  // ==========================================
  const buildCCodeString = useCallback(() => {
    const activeChs = channels.filter(c => c.enabled);
    const isUpDown = countMode === 'UP_DOWN';
    const isCN = commentLang === 'CN';
    const hasModISR = modulationMode === 'SPWM' || modulationMode === 'SVPWM';
    const masterTbprd = hardwareMetrics.masterTb.tbprdInt;

    const gpioLines = activeChs.map(ch => {
      const optA = (currentDsp.muxOptions[`ePWM${ch.id}A`] || [])[ch.muxIdxA || 0] || {
        pin: 16,
        gpio: `GPIO${(ch.id - 1) * 2}`,
        mux: 1,
        reg: 'GPAMUX1'
      };
      const optB = (currentDsp.muxOptions[`ePWM${ch.id}B`] || [])[ch.muxIdxB || 0] || {
        pin: 17,
        gpio: `GPIO${(ch.id - 1) * 2 + 1}`,
        mux: 1,
        reg: 'GPAMUX1'
      };
      if (codeStyle === 'BITFIELD') {
        return `    // ePWM${ch.id}A -> ${optA.gpio} (Pin#${optA.pin}), ePWM${ch.id}B -> ${optB.gpio} (Pin#${optB.pin})
    GpioCtrlRegs.${optA.reg}.bit.${optA.gpio} = ${optA.mux};
    GpioCtrlRegs.${optB.reg}.bit.${optB.gpio} = ${optB.mux};`;
      }
      return `    // ePWM${ch.id}A -> ${optA.gpio} (Pin#${optA.pin}), ePWM${ch.id}B -> ${optB.gpio} (Pin#${optB.pin})
    GPIO_setPinConfig(GPIO_${optA.gpio.replace('GPIO', '')}_EPWM${ch.id}A);
    GPIO_setPinConfig(GPIO_${optB.gpio.replace('GPIO', '')}_EPWM${ch.id}B);`;
    });

    const initFuncs = activeChs
      .map((ch, idx) => {
        const reg = hardwareMetrics.channelRegs.find(r => r.id === ch.id);
        const n = ch.id;
        const isMaster = idx === 0;
        const isIndep = ch.independentFreq && !isMaster;
        const dbMeta = DEADBAND_MODES[ch.mode];
        const inModeMeta = DB_IN_MODES[ch.inMode];
        const needCmpB = ch.mode === 'BYPASS' || inModeMeta?.usesB;

        if (codeStyle === 'BITFIELD') {
          return `// ============================================================================
// ${isCN ? `配置 ePWM${n}: ${ch.name}` : `Configure ePWM${n}: ${ch.name}`}
// ${isCN ? `开关频率: ${reg.targetFreqKhz} kHz (${isIndep ? '独立变频时基, 关闭PHSEN' : '同频锁相时基'})` : `Switching Freq: ${reg.targetFreqKhz} kHz (${isIndep ? 'Independent Freq, PHSEN Disabled' : 'Phase-Locked Time-Base'})`}
// ${isCN ? `独立死区: RED = ${ch.redNs}ns (DBRED=${reg.dbredInt}), FED = ${ch.fedNs}ns (DBFED=${reg.dbfedInt})` : `Independent Dead-Band: RED = ${ch.redNs}ns (DBRED=${reg.dbredInt}), FED = ${ch.fedNs}ns (DBFED=${reg.dbfedInt})`}
// ============================================================================
void InitEPwm${n}_Config(void)
{
    EALLOW;
    // 1. ${isCN ? '时基子模块 (Time-Base) 周期、移相与分频设置' : 'Time-Base Submodule Period, Phase & Prescalers'}
    EPwm${n}Regs.TBPRD = ${reg.tb.tbprdInt}; // f_sw = ${reg.targetFreqKhz} kHz
    EPwm${n}Regs.TBPHS.bit.TBPHS = ${reg.tbphsInt}; // ${isCN ? `相移角 = ${ch.phase} deg` : `Phase Shift = ${ch.phase} deg`}
    EPwm${n}Regs.TBCTR = 0x0000;
    EPwm${n}Regs.TBCTL.bit.CTRMODE = ${isUpDown ? 'TB_COUNT_UPDOWN' : 'TB_COUNT_UP'};
    EPwm${n}Regs.TBCTL.bit.PHSEN = ${reg.isSyncEnabled ? 'TB_ENABLE' : 'TB_DISABLE'};
    EPwm${n}Regs.TBCTL.bit.PHSDIR = ${reg.phsDirBit}; // ${isCN ? '同步事件后计数方向 (区分120度与240度)' : 'Count direction after sync (distinguishes 120 vs 240 deg)'}
    EPwm${n}Regs.TBCTL.bit.CLKDIV = ${reg.tb.clkDiv.bitEnum};
    EPwm${n}Regs.TBCTL.bit.HSPCLKDIV = ${reg.tb.hspClkDiv.bitEnum};

    // 2. ${isCN ? '影子寄存器与计数比较子模块 (CC & AQ)' : 'Shadow Register & Counter-Compare Submodule (CC & AQ)'}
    EPwm${n}Regs.CMPCTL.bit.SHDWAMODE = CC_SHADOW;
    EPwm${n}Regs.CMPCTL.bit.LOADAMODE = CC_CTR_ZERO; // ${isCN ? '在 TBCTR = 0 时安全更新 CMPA' : 'Reload CMPA safely at TBCTR = 0'}
    EPwm${n}Regs.CMPA.bit.CMPA = ${reg.cmpaInt}; // ${isCN ? `初始占空比 DutyA = ${ch.duty}%` : `Initial DutyA = ${ch.duty}%`}
${needCmpB ? `    EPwm${n}Regs.CMPB.bit.CMPB = ${reg.cmpbInt}; // DutyB = ${ch.dutyB}%\n` : ''}    EPwm${n}Regs.AQCTLA.bit.CAU = AQ_CLEAR;
    EPwm${n}Regs.AQCTLA.bit.CAD = AQ_SET;

    // 3. ${isCN ? '死区子模块 (DB): 上升沿 RED 与下降沿 FED 独立寄存器配置' : 'Dead-Band Submodule (DB): Independent RED & FED Registers'}
${
  ch.mode === 'BYPASS'
    ? `    EPwm${n}Regs.DBCTL.bit.OUT_MODE = DB_DISABLE;`
    : `    EPwm${n}Regs.DBCTL.bit.IN_MODE  = ${ch.inMode};
    EPwm${n}Regs.DBCTL.bit.POLSEL   = ${dbMeta.polselBitfield};
    EPwm${n}Regs.DBCTL.bit.OUT_MODE = DB_FULL_ENABLE;
    EPwm${n}Regs.DBRED.bit.DBRED = ${reg.dbredInt}; // RED = ${ch.redNs} ns
    EPwm${n}Regs.DBFED.bit.DBFED = ${reg.dbfedInt}; // FED = ${ch.fedNs} ns`
}
${
  isMaster && hasModISR
    ? `
    // 4. ${isCN ? '事件触发子模块 (ET): 使能零点周期中断用于 SPWM/SVPWM 实时查表调制' : 'Event-Trigger (ET): Enable zero-match ISR for real-time SPWM/SVPWM modulation'}
    EPwm1Regs.ETSEL.bit.INTSEL = ET_CTR_ZERO;
    EPwm1Regs.ETSEL.bit.INTEN  = 1;
    EPwm1Regs.ETPS.bit.INTPRD  = ET_1ST;`
    : ''
}
    EDIS;
}`;
        }

        return `// ${isCN ? `配置 ePWM${n} (DriverLib 风格): RED=${ch.redNs}ns, FED=${ch.fedNs}ns` : `Configure ePWM${n} (DriverLib Style): RED=${ch.redNs}ns, FED=${ch.fedNs}ns`}
void InitEPwm${n}_Config(void)
{
    EPWM_setTimeBasePeriod(EPWM${n}_BASE, ${reg.tb.tbprdInt}U);
    EPWM_setPhaseShift(EPWM${n}_BASE, ${reg.tbphsInt}U);
    EPWM_setTimeBaseCounterMode(EPWM${n}_BASE, ${isUpDown ? 'EPWM_COUNTER_MODE_UP_DOWN' : 'EPWM_COUNTER_MODE_UP'});
    EPWM_setClockPrescaler(EPWM${n}_BASE, ${reg.tb.clkDiv.driverEnum}, ${reg.tb.hspClkDiv.driverEnum});
    ${
      reg.isSyncEnabled
        ? `EPWM_enablePhaseShiftLoad(EPWM${n}_BASE);\n    EPWM_setCountModeAfterSync(EPWM${n}_BASE, ${reg.phsDirDriver});`
        : `EPWM_disablePhaseShiftLoad(EPWM${n}_BASE);`
    }
    EPWM_setCounterCompareShadowLoadMode(EPWM${n}_BASE, EPWM_COUNTER_COMPARE_A, EPWM_COMP_LOAD_ON_CNTR_ZERO);
    EPWM_setCounterCompareValue(EPWM${n}_BASE, EPWM_COUNTER_COMPARE_A, ${reg.cmpaInt}U);
    EPWM_setRisingEdgeDelayCount(EPWM${n}_BASE, ${reg.dbredInt}U); // RED = ${ch.redNs} ns
    EPWM_setFallingEdgeDelayCount(EPWM${n}_BASE, ${reg.dbfedInt}U); // FED = ${ch.fedNs} ns
}`;
      })
      .join('\n\n');

    // 生成 SPWM / SVPWM 周期中断服务函数 (ISR)
    const stepRad = ((2 * Math.PI * fundFreqHz) / (freqKhz * 1000)).toFixed(6);
    const isrBlock = hasModISR
      ? `
// ============================================================================
// ${
          isCN
            ? `${modulationMode} 实时正弦/空间矢量调制中断服务函数 (f_out = ${fundFreqHz} Hz, M = ${modIndex})`
            : `${modulationMode} Real-Time Modulation Interrupt Service Routine (f_out = ${fundFreqHz} Hz, M = ${modIndex})`
        }
// ============================================================================
#include <math.h>
float g_thetaRad = 0.0f;
const float g_stepRad = ${stepRad}f; // 2 * PI * ${fundFreqHz}Hz / ${freqKhz * 1000}Hz
const float g_modIndex = ${modIndex}f;
const uint16_t g_halfPrd = ${Math.round(masterTbprd / 2)}U;

__interrupt void epwm1_isr(void)
{
    g_thetaRad += g_stepRad;
    if (g_thetaRad >= 6.2831853f) g_thetaRad -= 6.2831853f;

${
  phaseSystem === '1P'
    ? `    // ${isCN ? '单相正弦调制 (双极性/单极性倍频)' : 'Single-Phase Sinusoidal Modulation'}
    float v_u = g_modIndex * sinf(g_thetaRad);
    float v_v = -v_u;
    EPwm1Regs.CMPA.bit.CMPA = (uint16_t)(g_halfPrd * (1.0f + v_u));
    ${activeChs.length >= 2 ? 'EPwm2Regs.CMPA.bit.CMPA = (uint16_t)(g_halfPrd * (1.0f + v_v));' : ''}`
    : `    // ${isCN ? '三相基波正弦参考电压计算 (U / V / W 互差 120 度)' : 'Three-Phase Fundamental Reference Calculation (0 / -120 / +120 deg)'}
    float v_u = g_modIndex * sinf(g_thetaRad);
    float v_v = g_modIndex * sinf(g_thetaRad - 2.0943951f);
    float v_w = g_modIndex * sinf(g_thetaRad + 2.0943951f);
${
  modulationMode === 'SVPWM'
    ? `
    // ${isCN ? 'SVPWM 零序分量注入 (最大最小中点钳位法生成马鞍波，提升 15.47% 母线电压利用率)' : 'SVPWM Zero-Sequence Min-Max Injection (Saddle Wave, +15.47% DC Bus Utilization)'}
    float v_max = (v_u > v_v) ? ((v_u > v_w) ? v_u : v_w) : ((v_v > v_w) ? v_v : v_w);
    float v_min = (v_u < v_v) ? ((v_u < v_w) ? v_u : v_w) : ((v_v < v_w) ? v_v : v_w);
    float v_offset = -0.5f * (v_max + v_min);
    v_u += v_offset;
    v_v += v_offset;
    v_w += v_offset;`
    : ''
}
    // ${isCN ? '写入影子寄存器 CMPA，将在下一个周期 TBCTR = 0 时同步生效' : 'Update Shadow CMPA Registers (takes effect at next TBCTR = 0)'}
    EPwm1Regs.CMPA.bit.CMPA = (uint16_t)(g_halfPrd * (1.0f + v_u));
    ${activeChs.length >= 2 ? 'EPwm2Regs.CMPA.bit.CMPA = (uint16_t)(g_halfPrd * (1.0f + v_v));' : ''}
    ${activeChs.length >= 3 ? 'EPwm3Regs.CMPA.bit.CMPA = (uint16_t)(g_halfPrd * (1.0f + v_w));' : ''}`
}

    // ${isCN ? '清除 ePWM1 中断标志并向 PIE 应答' : 'Clear ePWM1 Interrupt Flag and Acknowledge PIE Group 3'}
    EPwm1Regs.ETCLR.bit.INT = 1;
    PieCtrlRegs.PIEACK.all = PIEACK_GROUP3;
}
`
      : '';

    return `/**
 * @file    main.c
 * @target  TI C2000 ${currentDsp.name} (${currentDsp.package})
 * @mode    ${phaseSystem === '3P' ? 'Three-Phase (3P)' : 'Single-Phase (1P)'} | Modulation: ${modulationMode}
 * @clock   SYSCLK = ${currentDsp.sysclkMHz} MHz | TBCLK = ${currentDsp.tbclkMHz} MHz
 */
#include "F28x_Project.h"

void InitEPwmGpio_Custom(void)
{
    EALLOW;
${gpioLines.join('\n')}
    EDIS;
}

${initFuncs}
${isrBlock}
void main(void)
{
    InitSysCtrl();
    DINT;
    InitPieCtrl();
    IER = 0x0000;
    IFR = 0x0000;
    InitPieVectTable();
    InitEPwmGpio_Custom();
${
  hasModISR
    ? `
    EALLOW;
    PieVectTable.EPWM1_INT = &epwm1_isr;
    EDIS;`
    : ''
}

    EALLOW;
    CpuSysRegs.PCLKCR0.bit.TBCLKSYNC = 0;
    EDIS;

${activeChs.map(c => `    InitEPwm${c.id}_Config();`).join('\n')}

    EALLOW;
    // ${isCN ? '所有 ePWM 通道配置完毕后，统一开启 TBCLKSYNC 硬件时钟同步' : 'Enable TBCLKSYNC simultaneously after all ePWM modules are configured'}
    CpuSysRegs.PCLKCR0.bit.TBCLKSYNC = 1;
    EDIS;
${
  hasModISR
    ? `
    IER |= M_INT3;
    PieCtrlRegs.PIEIER3.bit.INTx1 = 1;
    EINT;
    ERTM;`
    : ''
}

    while(1)
    {
        asm(" NOP");
    }
}`;
  }, [
    channels,
    countMode,
    commentLang,
    codeStyle,
    currentDsp,
    hardwareMetrics,
    modulationMode,
    phaseSystem,
    fundFreqHz,
    freqKhz,
    modIndex
  ]);

  useEffect(() => {
    if (displayedCode === '' || autoSyncCode) {
      setDisplayedCode(buildCCodeString());
      setIsCodeDirty(false);
    }
  }, [buildCCodeString, displayedCode, autoSyncCode]);

  const handleManualGenerateCode = () => {
    setDisplayedCode(buildCCodeString());
    setIsCodeDirty(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(displayedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([displayedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `main_${currentDsp.id}_${phaseSystem}_${modulationMode}.c`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导出与导入 JSON 工程配置文件 (便于 GitHub 协作分享)
  const handleExportJson = () => {
    const payload = {
      version: '2.0',
      selectedDspId,
      freqKhz,
      countMode,
      phaseSystem,
      subTopology,
      threePhaseSyncLock,
      modulationMode,
      modIndex,
      fundFreqHz,
      elecAngleDeg,
      channels
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `c2000_epwm_${selectedDspId}_${subTopology}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const cfg = JSON.parse(ev.target.result);
        if (cfg.selectedDspId && DSP_MODELS[cfg.selectedDspId]) setSelectedDspId(cfg.selectedDspId);
        if (cfg.freqKhz) setFreqKhz(cfg.freqKhz);
        if (cfg.countMode) setCountMode(cfg.countMode);
        if (cfg.phaseSystem) setPhaseSystem(cfg.phaseSystem);
        if (cfg.subTopology) setSubTopology(cfg.subTopology);
        if (cfg.modulationMode) setModulationMode(cfg.modulationMode);
        if (cfg.modIndex) setModIndex(cfg.modIndex);
        if (cfg.fundFreqHz) setFundFreqHz(cfg.fundFreqHz);
        if (Array.isArray(cfg.channels)) setChannels(cfg.channels);
        setIsCodeDirty(true);
      } catch {
        // Ignore invalid JSON file
      }
    };
    reader.readAsText(file);
  };

  // ==========================================
  // 7. 渲染 SPWM / SVPWM 正弦与马鞍波包络线预览面板
  // ==========================================
  const renderModulationEnvelope = () => {
    if (modulationMode === 'FIXED') return null;

    const width = 760;
    const height = 140;
    const padX = 55;
    const plotW = width - padX - 20;
    const midY = 70;
    const ampY = 52;

    const ptsU = [];
    const ptsV = [];
    const ptsW = [];
    const ptsZ = [];

    for (let deg = 0; deg <= 360; deg += 4) {
      const x = padX + (deg / 360) * plotW;
      const inst = computeModulationInstant(modulationMode, phaseSystem, modIndex, deg);
      ptsU.push(`${x.toFixed(1)},${(midY - inst.vu * ampY).toFixed(1)}`);
      ptsV.push(`${x.toFixed(1)},${(midY - inst.vv * ampY).toFixed(1)}`);
      if (phaseSystem === '3P') {
        ptsW.push(`${x.toFixed(1)},${(midY - inst.vw * ampY).toFixed(1)}`);
        ptsZ.push(`${x.toFixed(1)},${(midY - inst.vOffset * ampY).toFixed(1)}`);
      }
    }

    const cursorX = padX + (elecAngleDeg / 360) * plotW;
    const curInst = computeModulationInstant(modulationMode, phaseSystem, modIndex, elecAngleDeg);

    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">
              {modulationMode === 'SVPWM'
                ? 'SVPWM 空间矢量调制包络线 (含马鞍波零序分量注入 V_offset)'
                : 'SPWM 正弦脉宽调制参考波包络线'}
            </h3>
            <p className="text-base text-slate-400">
              当前观测电角度 θ = <strong className="text-sky-300">{elecAngleDeg}°</strong> | 瞬时占空比:
              {' '}U相 <strong className="text-sky-400">{curInst.du}%</strong>
              {', '}V相 <strong className="text-emerald-400">{curInst.dv}%</strong>
              {phaseSystem === '3P' && (
                <>
                  {', '}W相 <strong className="text-purple-400">{curInst.dw}%</strong>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-base">
            <span className="text-sky-400 font-semibold">― U相参考波</span>
            <span className="text-emerald-400 font-semibold">― V相参考波</span>
            {phaseSystem === '3P' && <span className="text-purple-400 font-semibold">― W相参考波</span>}
            {phaseSystem === '3P' && modulationMode === 'SVPWM' && (
              <span className="text-amber-400 font-semibold">--- 零序三次谐波 V_offset</span>
            )}
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 bg-[#070b12] rounded-lg border border-slate-800">
          <line x1={padX} y1={midY - ampY} x2={width - 20} y2={midY - ampY} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={padX} y1={midY} x2={width - 20} y2={midY} stroke="#334155" />
          <line x1={padX} y1={midY + ampY} x2={width - 20} y2={midY + ampY} stroke="#1e293b" strokeDasharray="3 3" />

          <text x="8" y={midY - ampY + 5} fill="#94a3b8" fontSize="16">100%</text>
          <text x="16" y={midY + 5} fill="#94a3b8" fontSize="16">50%</text>
          <text x="24" y={midY + ampY + 5} fill="#94a3b8" fontSize="16">0%</text>

          <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={ptsU.join(' ')} />
          <polyline fill="none" stroke="#34d399" strokeWidth="2.5" points={ptsV.join(' ')} />
          {phaseSystem === '3P' && (
            <polyline fill="none" stroke="#c084fc" strokeWidth="2.5" points={ptsW.join(' ')} />
          )}
          {phaseSystem === '3P' && modulationMode === 'SVPWM' && (
            <polyline fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5 4" points={ptsZ.join(' ')} />
          )}

          {/* 当前观测电角度游标线 */}
          <line x1={cursorX} y1="10" x2={cursorX} y2={height - 10} stroke="#f8fafc" strokeWidth="2" />
          <circle cx={cursorX} cy={midY - curInst.vu * ampY} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx={cursorX} cy={midY - curInst.vv * ampY} r="5" fill="#34d399" stroke="#ffffff" strokeWidth="1.5" />
          {phaseSystem === '3P' && (
            <circle cx={cursorX} cy={midY - curInst.vw * ampY} r="5" fill="#c084fc" stroke="#ffffff" strokeWidth="1.5" />
          )}
        </svg>
      </div>
    );
  };

  // ==========================================
  // 8. 渲染 STM32CubeMX 风格四边 LQFP 芯片封装引脚图
  // ==========================================
  const renderCubeMXPinout = () => {
    const activePinMap = {};
    const altPinMap = {};

    channels.forEach(ch => {
      if (!ch.enabled) return;
      ['A', 'B'].forEach(sub => {
        const sig = `ePWM${ch.id}${sub}`;
        const opts = currentDsp.muxOptions[sig] || [];
        const selIdx = sub === 'A' ? ch.muxIdxA || 0 : ch.muxIdxB || 0;
        opts.forEach((opt, oIdx) => {
          if (oIdx === selIdx) {
            activePinMap[opt.pin] = { sig, gpio: opt.gpio, chId: ch.id, sub };
          } else {
            altPinMap[opt.pin] = { sig, gpio: opt.gpio, chId: ch.id, sub, targetIdx: oIdx };
          }
        });
      });
    });

    const handlePinClick = pinNum => {
      if (altPinMap[pinNum]) {
        const info = altPinMap[pinNum];
        updateChannel(info.chId, {
          [info.sub === 'A' ? 'muxIdxA' : 'muxIdxB']: info.targetIdx
        });
      }
    };

    const getPinBadge = pinNum => {
      if (activePinMap[pinNum]) {
        const a = activePinMap[pinNum];
        return {
          cls: 'bg-emerald-600 border-emerald-300 text-white font-bold shadow-md',
          label: `#${pinNum} ${a.gpio} (${a.sig})`,
          clickable: false
        };
      }
      if (altPinMap[pinNum]) {
        const alt = altPinMap[pinNum];
        return {
          cls: 'bg-sky-950 border-sky-400 border-dashed text-sky-200 hover:bg-sky-800 cursor-pointer',
          label: `#${pinNum} ${alt.gpio} (可切:${alt.sig})`,
          clickable: true
        };
      }
      if ([1, 14, 25, 32, 51, 64].includes(pinNum)) {
        return {
          cls: 'bg-amber-950/80 border-amber-600 text-amber-300',
          label: `#${pinNum} VDDIO/VSS`,
          clickable: false
        };
      }
      return {
        cls: 'bg-slate-800/90 border-slate-700 text-slate-400',
        label: `#${pinNum} GPIO`,
        clickable: false
      };
    };

    const leftPins = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const rightPins = [49, 50, 51, 53, 54, 57, 58, 61, 62, 64];

    return (
      <section className="bg-[#0d1424] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Grid className="w-5 h-5 text-emerald-400" />
              STM32CubeMX 风格芯片引脚复用分配图 ({currentDsp.name} · {currentDsp.package})
            </h2>
            <p className="text-base text-slate-400 mt-0.5">
              点击带有 <span className="text-sky-300 font-semibold">蓝色虚线 (可切:ePWMx)</span> 的备选引脚，即可切换 GPIO 复用映射并同步至 C 代码
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-base">
            <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold">已激活 ePWM 引脚</span>
            <span className="px-3 py-1 rounded-lg bg-sky-950 border border-dashed border-sky-400 text-sky-200">备选复用口 (点击切换)</span>
            <span className="px-3 py-1 rounded-lg bg-amber-950 border border-amber-600 text-amber-300">电源 VDD/VSS</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4 space-y-2">
            <div className="text-base font-semibold text-slate-300 mb-1">左侧引脚组 (默认 GPIO0~GPIO7)</div>
            {leftPins.map(p => {
              const st = getPinBadge(p);
              return (
                <div
                  key={p}
                  onClick={() => handlePinClick(p)}
                  className={`px-3.5 py-2 rounded-xl border text-base flex items-center justify-between transition ${st.cls}`}
                >
                  <span>{st.label}</span>
                  {st.clickable && <span className="underline font-bold">切换</span>}
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-4 bg-slate-950 border-4 border-slate-700 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[380px] relative shadow-2xl">
            <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-400 absolute top-5 left-5" title="Pin 1 标识点" />
            <div className="text-base text-slate-400 font-mono tracking-widest">TEXAS INSTRUMENTS</div>
            <div className="text-xl font-extrabold text-white mt-1">{currentDsp.name}</div>
            <div className="text-base text-emerald-400 font-semibold mb-4">{currentDsp.package}</div>

            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 text-base">
              <div className="flex justify-between">
                <span className="text-slate-400">时基主频 TBCLK:</span>
                <span className="text-white font-bold">{currentDsp.tbclkMHz} MHz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">当前相数拓扑:</span>
                <span className="text-sky-300 font-bold">{phaseSystem === '3P' ? '三相系统 (3-Phase)' : '单相系统 (1-Phase)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">已启用 ePWM 通道:</span>
                <span className="text-emerald-400 font-bold">
                  {channels.filter(c => c.enabled).length} / {currentDsp.maxChannels} 组
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">死区计数器位宽:</span>
                <span className="text-amber-300 font-bold">{currentDsp.dbMaxBits}-bit (RED/FED独立)</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-2">
            <div className="text-base font-semibold text-slate-300 mb-1">右侧引脚组 (含 Alternate 备选复用口)</div>
            {rightPins.map(p => {
              const st = getPinBadge(p);
              return (
                <div
                  key={p}
                  onClick={() => handlePinClick(p)}
                  className={`px-3.5 py-2 rounded-xl border text-base flex items-center justify-between transition ${st.cls}`}
                >
                  <span>{st.label}</span>
                  {st.clickable && <span className="underline font-bold">切换</span>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div
      style={{ fontSize: '16px' }}
      className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30"
    >
      {/* ========================================== */}
      {/* 顶部全局导航栏 (严格 >= 16px / 12pt 字号)  */}
      {/* ========================================== */}
      <header className="border-b border-slate-800 bg-[#0b111e]/95 backdrop-blur-md sticky top-0 z-30 px-5 py-4">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-600 flex items-center justify-center shadow-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                TI C2000 DSP ePWM 图形化设计器与 CubeMX 引脚配置工具
              </h1>
              <p className="text-base text-slate-400">
                支持单相/三相拓扑扩展 · SPWM/SVPWM 空间矢量调制 · RED/FED 上下沿死区独立调节 · 双语高亮代码生成
              </p>
            </div>
          </div>

          {/* 工程配置导入导出与视图切换 */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-base font-semibold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-sky-400" />
              导出配置 JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-base font-semibold flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              导入配置 JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />

            <div className="h-6 w-px bg-slate-700 mx-1" />

            {[
              { id: 'SPLIT', label: '波形与引脚分屏视图' },
              { id: 'WAVE', label: '仅看示波器波形画布' },
              { id: 'PINOUT', label: '仅看 CubeMX 引脚图' }
            ].map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewMode(v.id)}
                className={`px-4 py-2 rounded-xl text-base font-bold transition ${
                  viewMode === v.id
                    ? 'bg-sky-500 text-slate-950 shadow-lg'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ========================================== */}
      {/* 主工作区网格布局                           */}
      {/* ========================================== */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto p-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 左栏 (占 7 列) */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {/* 1. 单相 / 三相拓扑切换与调制方式扩展面板 */}
          <section className="bg-[#0d1424] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-bold text-white">
                  1. 单相 / 三相系统切换、调制模式 (SPWM / SVPWM) 与芯片主时基
                </h2>
              </div>
              <span className="text-base text-slate-400">{currentDsp.desc}</span>
            </div>

            {/* 单相 vs 三相扩展控制栏 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold text-white">拓扑相数系统:</span>
                  <button
                    type="button"
                    onClick={() => handleSwitchPhaseTopology('1P', '1P_FB')}
                    className={`px-4 py-2 rounded-xl text-base font-bold transition ${
                      phaseSystem === '1P'
                        ? 'bg-sky-500 text-slate-950 shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    单相模式 (1-Phase)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchPhaseTopology('3P', '3P_3LEG')}
                    className={`px-4 py-2 rounded-xl text-base font-bold transition ${
                      phaseSystem === '3P'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    三相模式 (3-Phase)
                  </button>
                </div>

                {phaseSystem === '3P' && (
                  <button
                    type="button"
                    onClick={() => setThreePhaseSyncLock(v => !v)}
                    className={`px-3.5 py-1.5 rounded-xl border text-base font-bold transition ${
                      threePhaseSyncLock
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    三相参数同步锁定: {threePhaseSyncLock ? '已开启 (U/V/W联动)' : '已关闭 (独立参数)'}
                  </button>
                )}
              </div>

              {/* 子拓扑快速扩展按钮 */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <span className="text-base text-slate-400 font-semibold">子拓扑结构扩展:</span>
                {phaseSystem === '1P' ? (
                  <>
                    {[
                      { id: '1P_HB', label: '单相半桥 (1x ePWM)' },
                      { id: '1P_FB', label: '单相全桥移相/双极性 (2x ePWM)' },
                      { id: '1P_TOTEM', label: '单相图腾柱无桥 PFC (快慢管异频)' }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSwitchPhaseTopology('1P', sub.id)}
                        className={`px-3.5 py-1.5 rounded-xl border text-base font-semibold transition ${
                          subTopology === sub.id
                            ? 'bg-sky-950 border-sky-400 text-sky-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { id: '3P_3LEG', label: '三相三桥臂逆变/整流 (U/V/W 3x ePWM)' },
                      { id: '3P_4LEG', label: '三相四桥臂含N相中线 (U/V/W/N 4x ePWM)' },
                      { id: '3P_INTERLEAVED', label: '三相交错并联 (0°/120°/240°)' }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSwitchPhaseTopology('3P', sub.id)}
                        className={`px-3.5 py-1.5 rounded-xl border text-base font-semibold transition ${
                          subTopology === sub.id
                            ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* 调制方式选择与动态调制参数 */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-white">调制策略选择:</span>
                  {[
                    { id: 'FIXED', label: '固定占空比 / 移相控制 (DC-DC)' },
                    { id: 'SPWM', label: 'SPWM 正弦脉宽调制' },
                    { id: 'SVPWM', label: 'SVPWM 空间矢量调制 (马鞍波注入)' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModulationMode(m.id);
                        if (m.id === 'FIXED') setIsPlayingMod(false);
                        if (!autoSyncCode) setIsCodeDirty(true);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl border text-base font-bold transition ${
                        modulationMode === m.id
                          ? 'bg-purple-600 border-purple-400 text-white shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {modulationMode !== 'FIXED' && (
                  <button
                    type="button"
                    onClick={() => setIsPlayingMod(p => !p)}
                    className={`px-3.5 py-1.5 rounded-xl text-base font-bold flex items-center gap-1.5 transition ${
                      isPlayingMod
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isPlayingMod ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlayingMod ? '暂停调制动画' : '播放调制呼吸动画'}
                  </button>
                )}
              </div>

              {modulationMode !== 'FIXED' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-base mb-1">
                      <span className="text-slate-300">调制比 M (Modulation Index)</span>
                      <span className="font-mono font-bold text-purple-300">{modIndex.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.10"
                      max={modulationMode === 'SVPWM' ? '1.15' : '1.00'}
                      step="0.01"
                      value={modIndex}
                      onChange={e => {
                        setModIndex(Number(e.target.value));
                        if (!autoSyncCode) setIsCodeDirty(true);
                      }}
                      className="w-full accent-purple-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-base mb-1">
                      <span className="text-slate-300">输出基波频率 (f_out)</span>
                      <span className="font-mono font-bold text-emerald-300">{fundFreqHz} Hz</span>
                    </div>
                    <select
                      value={fundFreqHz}
                      onChange={e => {
                        setFundFreqHz(Number(e.target.value));
                        if (!autoSyncCode) setIsCodeDirty(true);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-base text-white font-semibold"
                    >
                      <option value={50}>50 Hz (工频逆变)</option>
                      <option value={60}>60 Hz (美标电网)</option>
                      <option value={400}>400 Hz (航空中频电源)</option>
                      <option value={1000}>1000 Hz (高速电机驱动)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-base mb-1">
                      <span className="text-slate-300">当前观测电角度 θ_e</span>
                      <span className="font-mono font-bold text-sky-300">{elecAngleDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={elecAngleDeg}
                      onChange={e => setElecAngleDeg(Number(e.target.value))}
                      className="w-full accent-sky-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 芯片型号与开关主频设定 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5">
                <label className="block text-base text-slate-300 mb-1.5">目标 DSP 芯片型号</label>
                <select
                  value={selectedDspId}
                  onChange={e => {
                    setSelectedDspId(e.target.value);
                    if (!autoSyncCode) setIsCodeDirty(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-semibold text-white"
                >
                  {Object.values(DSP_MODELS).map(dsp => (
                    <option key={dsp.id} value={dsp.id}>
                      {dsp.name} ({dsp.tbclkMHz}MHz · {dsp.dbMaxBits}bit死区)
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <div className="flex justify-between text-base mb-1.5">
                  <span className="text-slate-300">主载波开关频率 (f_sw)</span>
                  <span className="font-mono font-bold text-sky-400">{freqKhz} kHz</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="500"
                  step="5"
                  value={freqKhz}
                  onChange={e => {
                    setFreqKhz(Number(e.target.value));
                    if (!autoSyncCode) setIsCodeDirty(true);
                  }}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-base text-slate-300 mb-1.5">计数模式 (CTRMODE)</label>
                <select
                  value={countMode}
                  onChange={e => {
                    setCountMode(e.target.value);
                    if (!autoSyncCode) setIsCodeDirty(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-base font-semibold text-white"
                >
                  <option value="UP_DOWN">增减对称计数</option>
                  <option value="UP">单向递增计数</option>
                </select>
              </div>
            </div>
          </section>

          {/* 2. 交互式示波器波形画布 (恢复连续高低电平阶梯方波 + 独立 RED/FED 拖拽手柄) */}
          {(viewMode === 'SPLIT' || viewMode === 'WAVE') && (
            <section
              ref={svgContainerRef}
              className="bg-[#0d1424] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" />
                    2. 连续阶梯方波示波器画布 (支持直接拖拽 RED 上升沿死区、FED 下降沿死区与占空比)
                  </h2>
                  <p className="text-base text-slate-400 mt-0.5">
                    按住波形上的 <strong className="text-amber-300">琥珀色手柄 (RED)</strong>、
                    <strong className="text-orange-400">橙色手柄 (FED)</strong> 或{' '}
                    <strong className="text-white">白色下降沿手柄 (Duty)</strong> 左右拖动即可直接调参
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addChannel}
                  disabled={channels.length >= 4}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-base transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  新增 ePWM 通道
                </button>
              </div>

              {/* 若开启了 SPWM / SVPWM，显示正弦/马鞍波包络线预览 */}
              {renderModulationEnvelope()}

              <div className="space-y-4">
                {channels.map((ch, idx) => {
                  const color = CHANNEL_COLORS[idx % CHANNEL_COLORS.length];
                  const reg = hardwareMetrics.channelRegs[idx];
                  const periodRatio = Math.max(0.25, Math.min(3.5, reg.tb.periodNs / hardwareMetrics.periodNs));
                  const cycleW = 330 * periodRatio;
                  const shiftFrac = reg.isSyncEnabled ? (((ch.phase % 360) + 360) % 360) / 360 : 0;
                  const shiftOffset = shiftFrac * cycleW;

                  const redFrac = ch.mode === 'BYPASS' ? 0 : Math.min(0.35, ch.redNs / reg.tb.periodNs);
                  const fedFrac = ch.mode === 'BYPASS' ? 0 : Math.min(0.35, ch.fedNs / reg.tb.periodNs);
                  const dutyAFrac = ch.duty / 100;
                  const dutyBFrac = (ch.dutyB ?? 50) / 100;

                  const redW0 = redFrac * cycleW;
                  const fedW0 = fedFrac * cycleW;
                  const rawHighWA0 = dutyAFrac * cycleW;
                  const highWA0 = Math.max(8, rawHighWA0 - redW0);

                  const baseX0 = 70 + shiftOffset;
                  const startXA0 = baseX0 + redW0;
                  const endXA0 = baseX0 + rawHighWA0;

                  // 计算连续阶梯方波路径 (ePWMxA 与 ePWMxB)
                  const waveA = buildContinuousSquareWavePath({
                    totalWidth: 810,
                    cycleW,
                    shiftOffset,
                    pulses: [{ start: redW0, end: Math.max(redW0 + 6, rawHighWA0) }],
                    yHigh: 16,
                    yLow: 64,
                    invertBaseline: ch.mode === 'ALC' || ch.mode === 'AL'
                  });

                  const pulsesB =
                    ch.mode === 'BYPASS'
                      ? [{ start: 0, end: Math.max(8, dutyBFrac * cycleW) }]
                      : [{ start: rawHighWA0 + fedW0, end: Math.max(rawHighWA0 + fedW0 + 6, cycleW) }];

                  const waveB = buildContinuousSquareWavePath({
                    totalWidth: 810,
                    cycleW,
                    shiftOffset,
                    pulses: pulsesB,
                    yHigh: 90,
                    yLow: 138,
                    invertBaseline: false
                  });

                  return (
                    <div
                      key={ch.id}
                      onClick={() => setActiveChannelId(ch.id)}
                      className={`bg-slate-950 border rounded-xl p-4 transition ${
                        activeChannelId === ch.id ? 'border-sky-500' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className="px-3 py-1 rounded-lg font-bold text-slate-950 text-base"
                            style={{ backgroundColor: color.main }}
                          >
                            ePWM{ch.id}: {ch.name}
                          </span>
                          <span className="text-base text-slate-300 font-medium">
                            f = <strong className="text-sky-300">{reg.targetFreqKhz} kHz</strong> (TBPRD={reg.tb.tbprdInt}, CMPA={reg.cmpaInt})
                          </span>
                          <span className="text-base text-emerald-300 font-semibold">
                            {reg.isSyncEnabled ? `锁相移相 Δφ=${ch.phase}° (${reg.phsDirBit})` : '独立时基 (PHSEN=0)'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-base">
                          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold">
                            RED: {ch.redNs}ns (DBRED={reg.dbredInt})
                          </span>
                          <span className="px-2.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/40 text-orange-300 font-mono font-bold">
                            FED: {ch.fedNs}ns (DBFED={reg.dbfedInt})
                          </span>
                        </div>
                      </div>

                      <svg
                        viewBox="0 0 820 155"
                        className="w-full h-40 bg-[#070b12] rounded-xl border border-slate-800 select-none"
                      >
                        {[140, 260, 380, 500, 620, 740].map(gx => (
                          <line key={gx} x1={gx} y1="0" x2={gx} y2="155" stroke="#1e293b" strokeDasharray="4 4" />
                        ))}
                        <line x1="70" y1="64" x2="810" y2="64" stroke="#1e293b" />
                        <line x1="70" y1="78" x2="810" y2="78" stroke="#334155" strokeDasharray="2 2" />
                        <line x1="70" y1="138" x2="810" y2="138" stroke="#1e293b" />

                        {/* 渲染两个周期的死区阴影带 */}
                        {[0, 1].map(cycle => {
                          const bX = 70 + cycle * cycleW + shiftOffset;
                          const eXA = bX + rawHighWA0;
                          return (
                            <g key={cycle}>
                              {redW0 > 1 && (
                                <rect
                                  x={bX}
                                  y="16"
                                  width={redW0}
                                  height="48"
                                  fill="rgba(245, 158, 11, 0.32)"
                                  stroke="#f59e0b"
                                  strokeDasharray="2 2"
                                />
                              )}
                              {fedW0 > 1 && (
                                <rect
                                  x={eXA}
                                  y="90"
                                  width={fedW0}
                                  height="48"
                                  fill="rgba(249, 115, 22, 0.32)"
                                  stroke="#fb923c"
                                  strokeDasharray="2 2"
                                />
                              )}
                            </g>
                          );
                        })}

                        {/* 连续阶梯方波 ePWMxA (半透明填充 + 连续高低电平折线) */}
                        <path d={waveA.fillPath} fill={color.fill} />
                        <path d={waveA.linePath} fill="none" stroke={color.main} strokeWidth="2.8" strokeLinejoin="round" />

                        {/* 连续阶梯方波 ePWMxB (半透明填充 + 连续高低电平折线) */}
                        <path
                          d={waveB.fillPath}
                          fill={ch.mode === 'ALC' ? 'rgba(236, 72, 153, 0.20)' : 'rgba(148, 163, 184, 0.16)'}
                        />
                        <path
                          d={waveB.linePath}
                          fill="none"
                          stroke={ch.mode === 'BYPASS' ? color.bMain : ch.mode === 'ALC' ? '#ec4899' : '#94a3b8'}
                          strokeWidth="2.8"
                          strokeLinejoin="round"
                        />

                        {/* 手柄 1: 独立拖拽上升沿死区 RED */}
                        {ch.mode !== 'BYPASS' && (
                          <g
                            style={{ cursor: 'ew-resize' }}
                            onMouseDown={e => {
                              e.stopPropagation();
                              setDragState({ chId: ch.id, type: 'RED', startX: e.clientX, initVal: ch.redNs });
                            }}
                          >
                            <rect
                              x={startXA0 - 5}
                              y="18"
                              width="10"
                              height="22"
                              rx="2"
                              fill="#f59e0b"
                              stroke="#090d16"
                              strokeWidth="1.5"
                            />
                            <text x={startXA0 + 8} y="32" fill="#fcd34d" fontSize="16" fontWeight="bold">
                              RED:{ch.redNs}ns
                            </text>
                          </g>
                        )}

                        {/* 手柄 2: 独立拖拽下降沿死区 FED */}
                        {ch.mode !== 'BYPASS' && (
                          <g
                            style={{ cursor: 'ew-resize' }}
                            onMouseDown={e => {
                              e.stopPropagation();
                              setDragState({ chId: ch.id, type: 'FED', startX: e.clientX, initVal: ch.fedNs });
                            }}
                          >
                            <rect
                              x={endXA0 + fedW0 - 5}
                              y="92"
                              width="10"
                              height="22"
                              rx="2"
                              fill="#fb923c"
                              stroke="#090d16"
                              strokeWidth="1.5"
                            />
                            <text x={endXA0 + fedW0 + 8} y="108" fill="#fdba74" fontSize="16" fontWeight="bold">
                              FED:{ch.fedNs}ns
                            </text>
                          </g>
                        )}

                        {/* 手柄 3: 拖拽 ePWMxA 占空比下降沿 */}
                        <g
                          style={{ cursor: 'ew-resize' }}
                          onMouseDown={e => {
                            e.stopPropagation();
                            setDragState({ chId: ch.id, type: 'DUTY_A', startX: e.clientX, initVal: ch.duty });
                          }}
                        >
                          <rect
                            x={endXA0 - 5}
                            y="34"
                            width="10"
                            height="26"
                            rx="2"
                            fill="#ffffff"
                            stroke="#0284c7"
                            strokeWidth="2"
                          />
                          <text x={endXA0 + 8} y="54" fill="#e2e8f0" fontSize="16" fontWeight="bold">
                            Duty:{ch.duty}%
                          </text>
                        </g>

                        {/* 手柄 4: 同频从通道拖拽移相角 */}
                        {reg.isSyncEnabled && (
                          <g
                            style={{ cursor: 'grab' }}
                            onMouseDown={e => {
                              e.stopPropagation();
                              setDragState({ chId: ch.id, type: 'PHASE', startX: e.clientX, initVal: ch.phase });
                            }}
                          >
                            <circle cx={baseX0} cy="40" r="7" fill="#34d399" stroke="#ffffff" strokeWidth="2" />
                          </g>
                        )}

                        <text x="8" y="45" fill={color.main} fontSize="16" fontWeight="bold">
                          ePWM{ch.id}A
                        </text>
                        <text x="8" y="118" fill="#94a3b8" fontSize="16" fontWeight="bold">
                          ePWM{ch.id}B
                        </text>
                      </svg>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3. CubeMX 四边芯片封装引脚视图 */}
          {(viewMode === 'SPLIT' || viewMode === 'PINOUT') && renderCubeMXPinout()}

          {/* 4. 各通道详细参数控制卡片 (包含独立的 RED 与 FED 滑块 + 数值输入框 + 对称锁) */}
          <section className="bg-[#0d1424] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">
                  3. 各通道独立频率、死区模式与独立上下沿死区 (RED / FED) 精细调节
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {channels.map((ch, idx) => {
                const reg = hardwareMetrics.channelRegs[idx];
                const isMaster = idx === 0;
                const isIndep = ch.independentFreq && !isMaster;
                const maxDbRange = Math.min(2500, Math.round((reg?.tb.periodNs || 10000) * 0.4));

                return (
                  <div
                    key={ch.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <span className="text-lg font-bold text-white">
                        ePWM{ch.id}: {ch.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {!isMaster && (
                          <button
                            type="button"
                            onClick={() => updateChannel(ch.id, { independentFreq: !ch.independentFreq })}
                            className={`px-3 py-1 rounded-xl text-base font-bold border transition ${
                              isIndep
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            }`}
                          >
                            {isIndep ? '独立频率模式' : '跟随主频锁相'}
                          </button>
                        )}
                        {!isMaster && (
                          <button
                            type="button"
                            onClick={() => removeChannel(ch.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isIndep ? (
                      <div>
                        <div className="flex justify-between text-base mb-1">
                          <span className="text-amber-300 font-semibold">通道独立开关频率</span>
                          <span className="font-mono font-bold text-amber-300">{ch.customFreqKhz} kHz</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="500"
                          value={ch.customFreqKhz}
                          onChange={e => updateChannel(ch.id, { customFreqKhz: Number(e.target.value) })}
                          className="w-full accent-amber-400"
                        />
                      </div>
                    ) : (
                      !isMaster && (
                        <div>
                          <div className="flex justify-between text-base mb-1">
                            <span className="text-emerald-300">相对主通道移相角 (Δφ)</span>
                            <span className="font-mono font-bold text-emerald-300">{ch.phase}°</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={ch.phase}
                            onChange={e => updateChannel(ch.id, { phase: Number(e.target.value) })}
                            className="w-full accent-emerald-400"
                          />
                        </div>
                      )
                    )}

                    <div>
                      <div className="flex justify-between text-base mb-1">
                        <span className="text-slate-300">ePWM{ch.id}A 占空比 (CMPA={reg.cmpaInt})</span>
                        <span className="font-mono font-bold text-sky-300">{ch.duty}%</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="98"
                        step="0.5"
                        value={ch.duty}
                        onChange={e => {
                          if (modulationMode !== 'FIXED') setModulationMode('FIXED');
                          updateChannel(ch.id, { duty: Number(e.target.value) });
                        }}
                        className="w-full accent-sky-400"
                      />
                    </div>

                    <div>
                      <label className="block text-base text-slate-300 mb-1">死区硬件模式 (DBCTL)</label>
                      <select
                        value={ch.mode}
                        onChange={e => updateChannel(ch.id, { mode: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-base text-white"
                      >
                        {Object.values(DEADBAND_MODES).map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 独立的上升沿死区 RED 与下降沿死区 FED 滑块 + 数值框 + 对称锁 */}
                    {ch.mode !== 'BYPASS' && (
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-amber-300">
                            独立上下沿死区配置 (DBRED / DBFED)
                          </span>
                          <button
                            type="button"
                            onClick={() => updateChannel(ch.id, { lockDb: !ch.lockDb })}
                            className={`px-2.5 py-1 rounded-lg text-base font-semibold border transition ${
                              ch.lockDb
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                            }`}
                          >
                            {ch.lockDb ? '对称锁定 (RED=FED)' : '独立调节 (RED≠FED)'}
                          </button>
                        </div>

                        <div>
                          <div className="flex justify-between text-base mb-1">
                            <span className="text-amber-300">上升沿死区 RED (DBRED={reg.dbredInt})</span>
                            <span className="font-mono font-bold text-amber-300">{ch.redNs} ns</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max={maxDbRange}
                              step="10"
                              value={ch.redNs}
                              onChange={e => updateChannel(ch.id, { redNs: Number(e.target.value) })}
                              className="flex-1 accent-amber-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max={maxDbRange}
                              step="10"
                              value={ch.redNs}
                              onChange={e => updateChannel(ch.id, { redNs: Number(e.target.value) })}
                              className="w-24 bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-1 font-mono text-base text-center text-amber-200"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-base mb-1">
                            <span className="text-orange-300">下降沿死区 FED (DBFED={reg.dbfedInt})</span>
                            <span className="font-mono font-bold text-orange-300">{ch.fedNs} ns</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max={maxDbRange}
                              step="10"
                              value={ch.fedNs}
                              onChange={e => updateChannel(ch.id, { fedNs: Number(e.target.value) })}
                              className="flex-1 accent-orange-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max={maxDbRange}
                              step="10"
                              value={ch.fedNs}
                              onChange={e => updateChannel(ch.id, { fedNs: Number(e.target.value) })}
                              className="w-24 bg-slate-900 border border-orange-500/40 rounded-lg px-2 py-1 font-mono text-base text-center text-orange-200"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ========================================== */}
        {/* 右栏 (占 5 列): 手动使能 + 语法高亮 + 双语注释 C 代码 */}
        {/* ========================================== */}
        <div className="xl:col-span-5 flex flex-col">
          <div className="bg-[#0d1424] border border-slate-800 rounded-2xl shadow-xl flex flex-col h-full xl:sticky xl:top-24 max-h-[calc(100vh-7rem)]">
            <div className="p-5 border-b border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Code2 className="w-6 h-6 text-sky-400" />
                  <h2 className="text-lg font-bold text-white">DSP main.c 工程代码生成引擎</h2>
                </div>
                {isCodeDirty ? (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 text-base font-bold animate-pulse">
                    参数已变更，待点击更新
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-base font-semibold">
                    代码已同步
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleManualGenerateCode}
                  className={`px-4 py-2 rounded-xl text-base font-extrabold transition flex items-center gap-2 shadow-lg ${
                    isCodeDirty
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  生成 / 更新 DSP 代码
                </button>

                <button
                  type="button"
                  onClick={() => setAutoSyncCode(!autoSyncCode)}
                  className={`px-3 py-2 rounded-xl text-base font-semibold border transition ${
                    autoSyncCode
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  自动同步: {autoSyncCode ? '开' : '关'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCommentLang(l => (l === 'CN' ? 'EN' : 'CN'));
                    if (!autoSyncCode) setIsCodeDirty(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-base font-semibold text-white flex items-center gap-1.5"
                >
                  <Globe className="w-4 h-4 text-sky-400" />
                  {commentLang === 'CN' ? '中文注释 (CN)' : 'English (EN)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCodeStyle(s => (s === 'BITFIELD' ? 'DRIVERLIB' : 'BITFIELD'));
                    if (!autoSyncCode) setIsCodeDirty(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-base font-semibold text-sky-300"
                >
                  {codeStyle === 'BITFIELD' ? 'Bit-Field 寄存器' : 'DriverLib 库函数'}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-base font-semibold flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制代码'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCode}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  下载 main.c
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#070a10]">
              <SyntaxHighlightedCode code={displayedCode} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}