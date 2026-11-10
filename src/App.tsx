import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ChannelConfig, ProjectState, ViewMode } from './types';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { WaveformPanel } from './components/WaveformPanel';
import { PinoutPanel } from './components/PinoutPanel';
import { ChannelPanel } from './components/ChannelPanel';
import { ProtectionPanel, protectionSummary } from './components/ProtectionPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { CodePanel } from './components/CodePanel';
import { Badge } from './components/ui';
import { Icon } from './components/Icon';
import { makeChannel } from './data/presets';
import { getTopology } from './data/topologies';
import { DEVICES, DEFAULT_DEVICE_ID } from './data/devices';
import { clampFreqKhz } from './lib/limits';
import { resolveHardware } from './lib/hardware';
import { validateProject } from './lib/validation';
import { generateCode, generateSingleFile } from './lib/targets';
import { computeModulationInstant } from './lib/modulation';
import {
  MAX_CHANNELS,
  applyPreset,
  buildShareUrl,
  createDefaultProject,
  loadProjectFromStorage,
  readProjectFromLocation,
  sanitizeProject,
  saveProjectToStorage,
} from './lib/project';
import { copyText, downloadJson, downloadText, readTextFile } from './lib/io';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export default function App() {
  const [project, setProject] = useState<ProjectState>(() => {
    return readProjectFromLocation() ?? loadProjectFromStorage() ?? createDefaultProject();
  });
  const [viewMode, setViewMode] = useState<ViewMode>('SPLIT');
  const [activeChannelId, setActiveChannelId] = useState(1);
  const [activeFileName, setActiveFileName] = useState('main.c');
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hw = useMemo(() => resolveHardware(project), [project]);
  const issues = useMemo(() => validateProject(project, hw), [project, hw]);
  const files = useMemo(() => generateCode(project, hw), [project, hw]);
  const lineCount = useMemo(() => files.reduce((n, f) => n + f.content.split('\n').length, 0), [files]);

  /* 自动保存 */
  useEffect(() => {
    const t = setTimeout(() => saveProjectToStorage(project), 500);
    return () => clearTimeout(t);
  }, [project]);

  /* 调制模式下把瞬时占空比写入通道 */
  useEffect(() => {
    if (project.modulationMode === 'FIXED') return;
    const inst = computeModulationInstant(
      project.modulationMode,
      project.phaseSystem,
      project.modIndex,
      project.elecAngleDeg,
    );
    setProject(prev => {
      if (prev.modulationMode === 'FIXED') return prev;
      const duties = [inst.du, inst.dv, inst.dw];
      let changed = false;
      const channels = prev.channels.map((ch, idx) => {
        const target = idx < 3 ? duties[idx] : 50;
        if (Math.abs(ch.duty - target) < 0.05) return ch;
        changed = true;
        return { ...ch, duty: round1(target) };
      });
      return changed ? { ...prev, channels } : prev;
    });
  }, [project.modulationMode, project.phaseSystem, project.modIndex, project.elecAngleDeg]);

  /* 电角度扫描动画 */
  useEffect(() => {
    if (!playing || project.modulationMode === 'FIXED') return;
    const id = setInterval(() => {
      setProject(prev => ({ ...prev, elecAngleDeg: (prev.elecAngleDeg + 3) % 360 }));
    }, 60);
    return () => clearInterval(id);
  }, [playing, project.modulationMode]);

  /* 提示条自动消失 */
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  const patch = useCallback((p: Partial<ProjectState>) => {
    setProject(prev => {
      const next = { ...prev, ...p };
      // 换器件或换计数模式后，原频率可能落到新的可行域之外（上限由 TBCLK 决定）
      if (p.deviceId !== undefined || p.countMode !== undefined) {
        const dev = DEVICES[next.deviceId] ?? DEVICES[DEFAULT_DEVICE_ID];
        next.freqKhz = clampFreqKhz(next.freqKhz, dev.tbclkMHz, next.countMode);
      }
      return next;
    });
  }, []);

  const updateChannel = useCallback((id: number, raw: Partial<ChannelConfig>) => {
    setProject(prev => {
      const channels = prev.channels.map(ch => {
        const isTarget = ch.id === id;
        const syncable =
          prev.phaseSystem === '3P' && prev.threePhaseSyncLock && id <= 3 && ch.id <= 3;
        if (!isTarget && !syncable) return ch;

        let change: Partial<ChannelConfig> = raw;
        if (!isTarget) {
          change = {};
          if (raw.redNs !== undefined) change.redNs = raw.redNs;
          if (raw.fedNs !== undefined) change.fedNs = raw.fedNs;
          if (raw.lockDb !== undefined) change.lockDb = raw.lockDb;
          if (raw.mode !== undefined) change.mode = raw.mode;
          if (raw.inMode !== undefined) change.inMode = raw.inMode;
          if (prev.modulationMode === 'FIXED' && raw.duty !== undefined) change.duty = raw.duty;
        }

        const next: ChannelConfig = { ...ch, ...change };
        next.duty = clamp(round1(next.duty), 0.5, 99.5);
        next.dutyB = clamp(round1(next.dutyB), 0.5, 99.5);
        next.phase = Math.round(clamp(next.phase, 0, 360));
        next.redNs = Math.round(clamp(next.redNs, 0, 50000));
        next.fedNs = Math.round(clamp(next.fedNs, 0, 50000));
        next.customFreqKhz = clamp(next.customFreqKhz, 0.05, 500);

        if (next.lockDb) {
          if (change.redNs !== undefined) next.fedNs = next.redNs;
          else if (change.fedNs !== undefined) next.redNs = next.fedNs;
        }
        if (next.id === 1) {
          next.phase = 0;
          next.independentFreq = false;
        }
        return next;
      });
      // 手动改占空比意味着接管调制：切到固定占空比，否则下一次调制刷新会把用户的值覆盖掉
      const tookOverDuty = raw.duty !== undefined && prev.modulationMode !== 'FIXED';
      return {
        ...prev,
        channels,
        modulationMode: tookOverDuty ? 'FIXED' : prev.modulationMode,
      };
    });
  }, []);

  const addChannel = useCallback(() => {
    setProject(prev => {
      if (prev.channels.length >= MAX_CHANNELS) return prev;
      const nextId = prev.channels.reduce((m, c) => Math.max(m, c.id), 0) + 1;
      const maxModules = DEVICES[prev.deviceId]?.epwmModules ?? 4;
      if (nextId > maxModules) return prev;
      return {
        ...prev,
        channels: [
          ...prev.channels,
          makeChannel({
            id: nextId,
            name: `扩展桥臂 ePWM${nextId}`,
            phase: ((nextId - 1) * 90) % 360,
            redNs: 200,
            fedNs: 200,
          }),
        ],
      };
    });
  }, []);

  const removeChannel = useCallback((id: number) => {
    setProject(prev => {
      if (prev.channels.length <= 1 || id === 1) return prev;
      const kept = prev.channels.filter(c => c.id !== id).map((c, i) => ({ ...c, id: i + 1 }));
      return { ...prev, channels: kept };
    });
  }, []);

  const handleTopology = useCallback((sys: '1P' | '3P', sub: string) => {
    const topology = getTopology(sub);
    setProject(prev => {
      const channels = topology ? topology.build(prev) : prev.channels;
      const phaseSystem = topology?.phaseSystem ?? sys;
      let modulationMode = prev.modulationMode;
      if (phaseSystem === '1P' && modulationMode === 'SVPWM') modulationMode = 'SPWM';
      return {
        ...prev,
        phaseSystem,
        subTopology: sub,
        channels,
        modulationMode,
        threePhaseSyncLock: phaseSystem === '3P' ? prev.threePhaseSyncLock : false,
      };
    });
    setPlaying(false);
    setActiveChannelId(1);
  }, []);

  const handlePreset = useCallback((id: string) => {
    setProject(prev => applyPreset(prev, id));
    setPlaying(false);
    setActiveChannelId(1);
    setNotice('已装载预设');
  }, []);

  const handleImportFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const parsed = sanitizeProject(JSON.parse(text));
      setProject(parsed);
      setNotice('配置已导入');
    } catch {
      setNotice('导入失败：不是合法的工程 JSON');
    } finally {
      e.target.value = '';
    }
  }, []);

  const handleExportJson = useCallback(() => {
    const name = `c2000-epwm_${project.deviceId}_${project.subTopology}.json`;
    downloadJson(name, project);
    setNotice('已导出 ' + name);
  }, [project]);

  const handleShare = useCallback(async () => {
    const ok = await copyText(buildShareUrl(project));
    setNotice(ok ? '分享链接已复制到剪贴板' : '复制失败，请手动复制地址栏 URL');
  }, [project]);

  const handleReset = useCallback(() => {
    setProject(createDefaultProject());
    setPlaying(false);
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setNotice('已恢复默认工程');
  }, []);

  const handleCopyCode = useCallback(async () => {
    const active = files.find(f => f.name === activeFileName) ?? files[0];
    if (!active) return;
    const ok = await copyText(active.content);
    setCopied(ok);
    setNotice(ok ? `已复制 ${active.name}` : '复制失败');
    setTimeout(() => setCopied(false), 1800);
  }, [files, activeFileName]);

  const handleDownloadFile = useCallback(
    (name: string) => {
      const f = files.find(x => x.name === name);
      if (f) downloadText(f.name, f.content);
    },
    [files],
  );

  const handleDownloadAll = useCallback(() => {
    downloadText(`c2000-epwm_${project.deviceId}_all.c`, generateSingleFile(project, hw));
    setNotice('已下载合并源码');
  }, [project, hw]);

  const protection = protectionSummary(project);

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-slate-100">
      <Header
        viewMode={viewMode}
        onView={setViewMode}
        onExportJson={handleExportJson}
        onImportClick={() => fileInputRef.current?.click()}
        onImportFile={handleImportFile}
        onShare={handleShare}
        onReset={handleReset}
        onDownloadCode={handleDownloadAll}
        fileInputRef={fileInputRef}
        deviceName={hw.device.name}
        freqKhz={project.freqKhz}
        subTopology={project.subTopology}
        protection={protection}
      />

      {notice && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-xl border border-sky-500/50 bg-slate-900/95 px-4 py-2 text-base font-semibold text-sky-100 shadow-xl">
            <Icon name="info" size={16} />
            {notice}
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-4 p-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-7">
          <ControlPanel
            project={project}
            hw={hw}
            onPatch={patch}
            onTopology={handleTopology}
            onPreset={handlePreset}
          />

          {(viewMode === 'SPLIT' || viewMode === 'WAVE') && (
            <WaveformPanel
              project={project}
              hw={hw}
              activeChannelId={activeChannelId}
              onActiveChannel={setActiveChannelId}
              onChannelChange={updateChannel}
              onPatch={patch}
              onAddChannel={addChannel}
              onRemoveChannel={removeChannel}
              onPlayToggle={() => setPlaying(p => !p)}
              playing={playing}
            />
          )}

          {(viewMode === 'SPLIT' || viewMode === 'PINOUT') && (
            <PinoutPanel project={project} hw={hw} onChannelChange={updateChannel} />
          )}

          <ChannelPanel
            project={project}
            hw={hw}
            onChannelChange={updateChannel}
            onRemoveChannel={removeChannel}
            onAddChannel={addChannel}
          />

          <ProtectionPanel project={project} onPatch={patch} />
        </div>

        <div className="xl:col-span-5">
          <div className="flex flex-col gap-4 xl:sticky xl:top-[84px]">
            <DiagnosticsPanel issues={issues} />
            <CodePanel
              files={files}
              activeName={activeFileName}
              onActiveName={setActiveFileName}
              target={project.codeTarget}
              lang={project.commentLang}
              onTarget={t => patch({ codeTarget: t })}
              onLang={() => patch({ commentLang: project.commentLang === 'CN' ? 'EN' : 'CN' })}
              onCopy={handleCopyCode}
              onDownloadFile={handleDownloadFile}
              onDownloadAll={handleDownloadAll}
              copied={copied}
              lineCount={lineCount}
            />
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-[1800px] px-4 pb-8 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-base text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="slate" mono>
              schema v{project.schemaVersion}
            </Badge>
            <Badge tone={issues.some(i => i.severity === 'error') ? 'rose' : 'emerald'}>
              {issues.some(i => i.severity === 'error') ? '存在错误，请先修正' : '校验通过'}
            </Badge>
            <span>工程自动保存在本地浏览器</span>
          </div>
          <p>
            生成的代码仅供参考 —— 上电前请用示波器确认死区与最小脉宽。开源工程：
            <span className="font-mono text-slate-400">C2000-ePWM-tool</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
