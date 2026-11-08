// Minimal 1.6px stroke icon set (inline SVG, inherits currentColor)
const S = ({ children, fill = "none", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const Icon = {
  logo: () => (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="9" width="17" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="11" y="4" width="17" height="19" rx="3" fill="var(--accent)" />
    </svg>
  ),
  plus: () => <S><path d="M12 5v14M5 12h14" /></S>,
  x: () => <S size={16}><path d="M6 6l12 12M18 6L6 18" /></S>,
  star: () => <S><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" /></S>,
  starFill: () => <S fill="currentColor"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" /></S>,
  ext: () => <S size={15}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></S>,
  share: () => <S><path d="M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" /></S>,
  image: () => <S><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-9 9" /></S>,
  trash: () => <S><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></S>,
  download: () => <S><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></S>,
  shuffle: () => <S><path d="M16 4h4v4M4 20l16-16M20 16v4h-4M15 15l5 5M4 4l5 5" /></S>,
  globe: () => <S size={15}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></S>,
  book: () => <S size={22}><path d="M4 5a2 2 0 012-2h5v17H6a2 2 0 00-2 2zM20 5a2 2 0 00-2-2h-5v17h5a2 2 0 012 2z" /></S>,
  left: () => <S><path d="M15 6l-6 6 6 6" /></S>,
  right: () => <S><path d="M9 6l6 6-6 6" /></S>,
};
