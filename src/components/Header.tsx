import type { ChangeEvent, RefObject } from 'react';
import type { ViewMode } from '../types';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { Badge, Btn, Segmented } from './ui';
import { Icon } from './Icon';

interface Props {
  viewMode: ViewMode;
  onView: (v: ViewMode) => void;
  onExportJson: () => void;
  onImportClick: () => void;
  onImportFile: (e: ChangeEvent<HTMLInputElement>) => void;
  onShare: () => void;
  onReset: () => void;
  onDownloadCode: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  deviceName: string;
  freqKhz: number;
  subTopology: string;
  protection: string;
}

export function Header({
  viewMode,
  onView,
  onExportJson,
  onImportClick,
  onImportFile,
  onShare,
  onReset,
  onDownloadCode,
  fileInputRef,
  deviceName,
  freqKhz,
  subTopology,
  protection,
}: Props) {
  const { t, lang, toggleLang } = useI18n();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[var(--surface-app)] backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-300">
            <Icon name="activity" size={18} />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight tracking-tight text-white">
              C2000 ePWM Tool
            </h1>
            <p className="text-base leading-tight text-slate-500">
              {t(
                'TI DSP 图形化 ePWM 设计器 · 死区仿真 / 移相同步 / 代码生成',
                'Graphical ePWM designer for TI C2000 · dead-band, phase sync, code generation',
              )}
            </p>
          </div>
          <div className="ml-1 hidden flex-wrap items-center gap-1.5 xl:flex">
            <Badge mono>{deviceName}</Badge>
            <Badge mono>{freqKhz} kHz</Badge>
            <Badge mono>{subTopology}</Badge>
            <Badge mono>TZ {protection}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented
            value={viewMode}
            onChange={v => onView(v)}
            options={[
              { value: 'SPLIT', label: t('全部', 'All') },
              { value: 'WAVE', label: t('波形', 'Waveform') },
              { value: 'PINOUT', label: t('引脚', 'Pinout') },
            ]}
          />
          <span className="mx-1 hidden h-5 w-px bg-slate-800 sm:block" />
          <Btn compact icon="upload" onClick={onImportClick}>
            {t('导入', 'Import')}
          </Btn>
          <Btn compact icon="download" onClick={onExportJson}>
            {t('导出', 'Export')}
          </Btn>
          <Btn compact icon="share" onClick={onShare}>
            {t('分享链接', 'Share link')}
          </Btn>
          <Btn compact icon="refresh" onClick={onReset}>
            {t('重置', 'Reset')}
          </Btn>
          <Btn compact variant="primary" icon="download" onClick={onDownloadCode}>
            {t('下载代码', 'Download')}
          </Btn>
          <Btn
            compact
            icon={isDark ? 'sun' : 'moon'}
            onClick={toggleTheme}
            title={isDark ? t('切换到日间模式', 'Switch to day mode') : t('切换到夜间模式', 'Switch to night mode')}
            aria-label={isDark ? t('切换到日间模式', 'Switch to day mode') : t('切换到夜间模式', 'Switch to night mode')}
          >
            {isDark ? t('日间', 'Day') : t('夜间', 'Night')}
          </Btn>
          <Btn compact onClick={toggleLang} title={t('切换到英文', 'Switch to Chinese')}>
            {lang === 'zh' ? 'EN' : '中文'}
          </Btn>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onImportFile}
            className="hidden"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-4 pb-2 text-base text-slate-500 xl:hidden">
        {deviceName} · {freqKhz} kHz · {subTopology} · TZ {protection}
      </div>
    </header>
  );
}
