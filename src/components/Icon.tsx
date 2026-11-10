import type { ReactNode, SVGProps } from 'react';

/**
 * 内联 SVG 图标集。
 * 刻意不引入图标库：既避免了版本改名风险，也让打包体积保持极小。
 */
export type IconName =
  | 'activity'
  | 'sliders'
  | 'shield'
  | 'code'
  | 'copy'
  | 'check'
  | 'download'
  | 'upload'
  | 'link'
  | 'refresh'
  | 'play'
  | 'pause'
  | 'plus'
  | 'trash'
  | 'alert'
  | 'info'
  | 'x'
  | 'chip'
  | 'wave'
  | 'grid'
  | 'share'
  | 'zap'
  | 'file'
  | 'sun'
  | 'moon'
  | 'chevron';

const PATHS: Record<IconName, ReactNode> = {
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  sliders: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="9" cy="6" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="7" cy="18" r="2.2" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  code: <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  download: <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />,
  upload: <path d="M12 21V9m0 0L8 13m4-4l4 4M4 3h16" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  refresh: <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />,
  play: <path d="M6 4l14 8-14 8z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />,
  alert: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 8h.01" />
    </>
  ),
  x: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </>
  ),
  wave: <path d="M2 12h3l2-6 3 12 3-9 2 3h7" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2" />
    </>
  ),
  zap: <path d="M13 2L3 14h7l-1 8 10-12h-7z" />,
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  chevron: <path d="M6 9l6 6 6-6" />,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
