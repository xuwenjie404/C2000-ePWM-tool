import type { DiagnosticIssue, Severity } from '../types';
import { countIssues } from '../lib/validation';
import { useI18n } from '../i18n';
import { Badge, Card, PanelHeader, cx } from './ui';
import { Icon, type IconName } from './Icon';

// TODO(i18n): 模块级元数据，label 目前没有在界面上渲染（计数文案在组件内用 t()），故保留中文。
/** 极简：错误/警告/提示只靠左侧细线与文字色区分，不用色块填充 */
const SEVERITY_META: Record<Severity, { icon: IconName; box: string; text: string }> = {
  error: { icon: 'x', box: 'border-slate-800 border-l-2 border-l-rose-500/70', text: 'text-rose-300' },
  warn: { icon: 'alert', box: 'border-slate-800 border-l-2 border-l-amber-500/70', text: 'text-amber-300' },
  info: { icon: 'info', box: 'border-slate-800 border-l-2 border-l-sky-500/70', text: 'text-slate-300' },
};

export function DiagnosticsPanel({ issues }: { issues: DiagnosticIssue[] }) {
  const { t } = useI18n();
  const counts = countIssues(issues);

  return (
    <Card>
      <PanelHeader
        icon="shield"
        title={t('设计校验', 'Design checks')}
        hint={t(
          '时基可达性、死区溢出、脉宽被吞、引脚冲突、过调制等隐患会自动检查。',
          'Time-base reachability, dead-band overflow, swallowed pulses, pin conflicts and over-modulation are checked automatically.',
        )}
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={counts.error ? 'rose' : 'slate'}>
              {t(`${counts.error} 错误`, `${counts.error} ${counts.error === 1 ? 'error' : 'errors'}`)}
            </Badge>
            <Badge tone={counts.warn ? 'amber' : 'slate'}>
              {t(`${counts.warn} 警告`, `${counts.warn} ${counts.warn === 1 ? 'warning' : 'warnings'}`)}
            </Badge>
            <Badge tone={counts.info ? 'sky' : 'slate'}>
              {t(`${counts.info} 提示`, `${counts.info} info`)}
            </Badge>
          </div>
        }
      />

      <div className="max-h-[340px] space-y-2 overflow-y-auto p-4">
        {issues.length === 0 && (
          <p className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-base text-emerald-200">
            <Icon name="check" size={16} />
            {t('当前配置未发现隐患。', 'No issues found in the current configuration.')}
          </p>
        )}

        {issues.map(issue => {
          const meta = SEVERITY_META[issue.severity];
          return (
            <div key={issue.id} className={cx('rounded-md border px-3 py-2', meta.box)}>
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
