import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * 日间 / 夜间主题。
 *
 * 实现要点：主题只是给 `[data-theme]` 挂一个属性，
 * 真正的换色发生在 index.css 的变量层 —— 组件类名完全不用改。
 *
 * 波形面板和代码块永远保持深色（`--surface-instrument` 不随主题变化），
 * 因为它们承担的是「仪器面 / 终端面」的角色：四路波形的荧光色放到白底上会糊。
 */
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'c2000-epwm-theme';

interface ThemeValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: true,
});

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* 隐私模式 */
  }
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export function ThemeProvider({
  children,
  defaultTheme,
}: {
  children: ReactNode;
  /** 测试与 SSR 用的初始主题；不传则按 localStorage / 系统偏好推断 */
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(() => defaultTheme ?? readInitialTheme());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // 挂到 html 上：body 背景、原生控件（滚动条/输入框）的配色都跟着变
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* 忽略 */
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState(v => (v === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo<ThemeValue>(
    () => ({ theme, setTheme, toggleTheme, isDark: theme === 'dark' }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
