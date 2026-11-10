import type { ChangeEvent, RefObject } from 'react';
import type { ViewMode } from '../types';
import { Badge, Btn, Segmented, cx } from './ui';
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
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#101215]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30">
            <Icon name="activity" size={22} />
          </span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight text-white">
              C2000 ePWM Tool
            </h1>
            <p className="text-base leading-tight text-slate-400">
              TI DSP 图形化 ePWM 设计器 · 死区仿真 / 移相同步 / SPWM·SVPWM / 代码生成
            </p>
          </div>
          <div className="ml-1 hidden flex-wrap items-center gap-1.5 xl:flex">
            <Badge tone="sky" mono>
              {deviceName}
            </Badge>
            <Badge tone="slate" mono>
              {freqKhz} kHz
            </Badge>
            <Badge tone="slate" mono>
              {subTopology}
            </Badge>
            <Badge tone={protection === '未启用' ? 'slate' : 'emerald'} mono>
              TZ {protection}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented
            value={viewMode}
            onChange={v => onView(v)}
            options={[
              { value: 'SPLIT', label: '全部' },
              { value: 'WAVE', label: '波形' },
              { value: 'PINOUT', label: '引脚' },
            ]}
          />
          <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />
          <Btn compact icon="upload" onClick={onImportClick}>
            导入
          </Btn>
          <Btn compact icon="download" onClick={onExportJson}>
            导出
          </Btn>
          <Btn compact icon="share" onClick={onShare}>
            分享链接
          </Btn>
          <Btn compact icon="refresh" onClick={onReset}>
            重置
          </Btn>
          <Btn compact variant="primary" icon="download" onClick={onDownloadCode}>
            下载代码
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

      <div className={cx('mx-auto max-w-[1800px] px-4 pb-2 text-base text-slate-500 xl:hidden')}>
        {deviceName} · {freqKhz} kHz · {subTopology} · TZ {protection}
      </div>
    </header>
  );
}
