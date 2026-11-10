import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * 极简 i18n。
 *
 * 刻意不用 key 字典：本项目只有中英两种语言，直接用
 * `t('中文', 'English')` 把两种文案写在调用处，
 * 好处是「用到的和翻译的永远在一起」，不会出现字典里加了 key 但界面没接、
 * 或者删了界面还留着死 key 的问题。
 */
export type UiLang = 'zh' | 'en';

export const UI_LANG_KEY = 'c2000-epwm-ui-lang';

interface I18nValue {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  toggleLang: () => void;
  /** 中英二选一 */
  t: (zh: string, en: string) => string;
}

const I18nContext = createContext<I18nValue>({
  lang: 'zh',
  setLang: () => {},
  toggleLang: () => {},
  t: zh => zh,
});

function readInitialLang(): UiLang {
  if (typeof window === 'undefined') return 'zh';
  const url = new URLSearchParams(window.location.search).get('lang');
  if (url === 'en' || url === 'zh') return url;
  try {
    const saved = localStorage.getItem(UI_LANG_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    /* 忽略隐私模式 */
  }
  // 浏览器语言兜底
  const nav = navigator.language.toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({
  children,
  defaultLang,
}: {
  children: ReactNode;
  /** 测试与 SSR 用的初始语言；不传则按 URL / localStorage / 浏览器语言推断 */
  defaultLang?: UiLang;
}) {
  const [lang, setLangState] = useState<UiLang>(() => defaultLang ?? readInitialLang());

  useEffect(() => {
    try {
      localStorage.setItem(UI_LANG_KEY, lang);
    } catch {
      /* 忽略 */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }
  }, [lang]);

  const setLang = useCallback((l: UiLang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState(v => (v === 'zh' ? 'en' : 'zh')), []);
  const t = useCallback((zh: string, en: string) => (lang === 'zh' ? zh : en), [lang]);

  const value = useMemo<I18nValue>(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** 供非组件代码（规则、日志）使用的纯函数版本 */
export function translator(lang: UiLang) {
  return (zh: string, en: string) => (lang === 'zh' ? zh : en);
}
