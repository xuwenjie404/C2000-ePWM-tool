import type { DiagnosticIssue, Severity } from '../types';
import { countIssues } from '../lib/validation';
import { Badge, Card, PanelHeader, cx } from './ui';
import { Icon, type IconName } from './Icon';

const SEVERITY_META: Record<
  Severity,
  { label: string; icon: IconName; box: string; text: string }
> = {
  error: {
    label: '错误',
    icon: 'x',
    box: 'border-rose-500/40 bg-rose-500/10',
    text: 'text-rose-200',
  },
  warn: {
    label: '警告',
    icon: 'alert',
    box: 'border-amber-500/40 bg-amber-500/10',
    text: 'text-amber-200',
  },
  info: {
    label: '提示',
    icon: 'info',
    box: 'border-sky-500/30 bg-sky-500/10',
    text: 'text-sky-200',
  },
};

export function DiagnosticsPanel({ issues }: { issues: DiagnosticIssue[] }) {
  const counts = countIssues(issues);

  return (
    <Card>
      <PanelHeader
        icon="shield"
        title="设计校验"
        hint="时基可达性、死区溢出、脉宽被吞、引脚冲突、过调制等隐患会自动检查。"
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={counts.error ? 'rose' : 'slate'}>{counts.error} 错误</Badge>
            <Badge tone={counts.warn ? 'amber' : 'slate'}>{counts.warn} 警告</Badge>
            <Badge tone={counts.info ? 'sky' : 'slate'}>{counts.info} 提示</Badge>
          </div>
        }
      />

      <div className="max-h-[340px] space-y-2 overflow-y-auto p-4">
        {issues.length === 0 && (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-base text-emerald-200">
            <Icon name="check" size={16} />
            当前配置未发现隐患。
          </p>
        )}

        {issues.map(issue => {
          const meta = SEVERITY_META[issue.severity];
          return (
            <div key={issue.id} className={cx('rounded-xl border px-3 py-2', meta.box)}>
              <div className="flex items-start gap-2">
                <span className={cx('mt-0.5 shrink-0', meta.text)}>
                  <Icon name={meta.icon} size={16} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx('text-base font-bold', meta.text)}>{issue.title}</span>
                    {issue.channelId !== undefined && (
                      <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-base text-slate-300">
                        ePWM{issue.channelId}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-base leading-snug text-slate-300">{issue.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
