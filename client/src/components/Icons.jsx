// Small inline icons (no icon library needed). All are decorative: the button
// or text next to them carries the meaning, so they're hidden from screen readers.
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
};

export const PlayIcon = (props) => (
  <svg {...base} {...props}><path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" /></svg>
);

export const PauseIcon = (props) => (
  <svg {...base} {...props}><path d="M8 5v14M16 5v14" strokeWidth="3" /></svg>
);

export const ChevronLeft = (props) => (
  <svg {...base} {...props}><path d="M15 5l-7 7 7 7" /></svg>
);

export const ChevronRight = (props) => (
  <svg {...base} {...props}><path d="M9 5l7 7-7 7" /></svg>
);

export const SunIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = (props) => (
  <svg {...base} {...props}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>
);

export const MenuIcon = (props) => (
  <svg {...base} {...props}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);

export const CloseIcon = (props) => (
  <svg {...base} {...props}><path d="M6 6l12 12M18 6L6 18" /></svg>
);

// A small cut ruby, used for ratings.
export const GemIcon = (props) => (
  <svg {...base} viewBox="0 0 24 24" {...props}>
    <path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor" stroke="none" />
    <path d="M2 9h20M9 3l3 6 3-6M7.5 9 12 21l4.5-12" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
  </svg>
);

export const TrendUp = (props) => (
  <svg {...base} {...props}><path d="M12 5l7 9H5z" fill="currentColor" stroke="none" /></svg>
);

export const TrendDown = (props) => (
  <svg {...base} {...props}><path d="M12 19l7-9H5z" fill="currentColor" stroke="none" /></svg>
);

export const PrintIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />
  </svg>
);

export const ChatIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
  </svg>
);

// ---------- Tab bar and admin menu icons ----------

export const HomeIcon = (props) => (
  <svg {...base} {...props}><path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5" /></svg>
);

export const GamepadIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M7 7h10a5 5 0 0 1 4.8 6.4l-1.3 4.3a2.2 2.2 0 0 1-3.7.9L14.5 16h-5l-2.3 2.6a2.2 2.2 0 0 1-3.7-.9l-1.3-4.3A5 5 0 0 1 7 7z" />
    <path d="M7.5 10.5v3M6 12h3M15.5 11.5h.01M17.5 13h.01" strokeWidth="2.4" />
  </svg>
);

export const InfoIcon = (props) => (
  <svg {...base} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeWidth="2.4" /></svg>
);

export const UserIcon = (props) => (
  <svg {...base} {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);

export const GridIcon = (props) => (
  <svg {...base} {...props}><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>
);

export const ListIcon = (props) => (
  <svg {...base} {...props}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" strokeWidth="2.2" /></svg>
);

export const PlusIcon = (props) => (
  <svg {...base} {...props}><path d="M12 5v14M5 12h14" /></svg>
);

export const ChartIcon = (props) => (
  <svg {...base} {...props}><path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" /></svg>
);

export const FlagIcon = (props) => (
  <svg {...base} {...props}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>
);

export const UsersIcon = (props) => (
  <svg {...base} {...props}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></svg>
);

export const WrenchIcon = (props) => (
  <svg {...base} {...props}><path d="M14.7 6.3a4 4 0 0 0-5.4 5l-6 6a1.4 1.4 0 0 0 2 2l6-6a4 4 0 0 0 5-5.4l-2.6 2.6-2.2-.4-.4-2.2z" /></svg>
);

export const ExitIcon = (props) => (
  <svg {...base} {...props}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>
);
