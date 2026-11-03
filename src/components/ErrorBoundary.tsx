import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { clearProjectStorage } from '../lib/project';
import { Btn } from './ui';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string;
}

/**
 * 顶层错误边界。
 *
 * 平台应有的韧性：一个坏的工程配置 / 一条扩展规则抛异常，
 * 不应该让用户看到白屏而丢失全部工作。
 * 这里至少给出：错误信息 + 一键清空本地工程重载 + 复制诊断信息。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info: info.componentStack ?? '' });
    // 控制台保留完整栈，便于用户反馈时复制
    console.error('[C2000 ePWM Tool] 渲染失败', error, info);
  }

  private handleReset = (): void => {
    clearProjectStorage();
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.location.reload();
    }
  };

  private handleCopy = async (): Promise<void> => {
    const text = [`${this.state.error?.name}: ${this.state.error?.message}`, this.state.info].join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* 忽略 */
    }
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b12] p-6 text-slate-100">
        <div className="w-full max-w-3xl space-y-4 rounded-2xl border border-rose-500/40 bg-[#0d1424] p-6 shadow-2xl">
          <div className="flex items-center gap-2.5 text-rose-300">
            <Icon name="alert" size={24} />
            <h1 className="text-lg font-bold text-white">界面渲染失败</h1>
          </div>
          <p className="text-base leading-relaxed text-slate-300">
            这通常是一个未预期的参数组合触发的缺陷。你的配置仍保存在浏览器本地，可以先尝试重置；
            如果问题可复现，请把下面的信息连同「分享链接」一起提交到 issue。
          </p>

          <pre className="max-h-52 overflow-auto rounded-xl border border-slate-800 bg-[#070a10] p-3 font-mono text-base text-rose-200">
            {error.name}: {error.message}
            {this.state.info ? `\n${this.state.info}` : ''}
          </pre>

          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" icon="refresh" onClick={this.handleReset}>
              清空本地工程并重载
            </Btn>
            <Btn variant="ghost" icon="copy" onClick={this.handleCopy}>
              复制诊断信息
            </Btn>
            <Btn variant="ghost" icon="link" onClick={() => window.location.assign(window.location.pathname)}>
              重新载入页面
            </Btn>
          </div>
        </div>
      </div>
    );
  }
}
