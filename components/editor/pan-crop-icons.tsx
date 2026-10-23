import type { ReactNode } from "react";
type Props = { size?: number };
// Self-contained, code-drawn desktop glyphs. Explicit dimensions and colors avoid
// inherited icon defaults and keep the small controls readable at browser zoom.
function Glyph({
  size = 16,
  children,
}: {
  size?: number;
  children: ReactNode;
}) {
  return (
    <svg
      className="ec-icon"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="#e8eded"
      strokeWidth="1"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      style={{
        display: "block",
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
        position: "static",
        visibility: "visible",
        opacity: 1,
      }}
    >
      {children}
    </svg>
  );
}
export const Settings = (p: Props) => (
  <Glyph {...p}>
    <path
      fill="#f4f4f4"
      stroke="#ddd"
      d="M6 1h4v2l2 1 2-1 1 3-2 1v2l2 1-1 3-2-1-2 1v2H6v-2l-2-1-2 1-1-3 2-1V7L1 6l1-3 2 1 2-1z"
    />
    <circle cx="8" cy="8" r="3" fill="#343434" stroke="#343434" />
  </Glyph>
);
export const MousePointer2 = (p: Props) => (
  <Glyph {...p}>
    <path fill="#fff" stroke="#202020" d="M2 1v13l4-4 3 5 2-1-3-5h6z" />
  </Glyph>
);
export const ZoomIn = (p: Props) => (
  <Glyph {...p}>
    <circle cx="6" cy="6" r="4.5" fill="#78969f" stroke="#eef6f7" />
    <path d="m10 10 4 4" stroke="#ddd" strokeWidth="3" />
    <path d="M3 6h6M6 3v6" stroke="#23343d" />
  </Glyph>
);
export const Magnet = (p: Props) => (
  <Glyph {...p}>
    <path
      d="M3 13V6a5 5 0 0 1 10 0v7h-3V6a2 2 0 0 0-4 0v7z"
      fill="#ad6570"
      stroke="#eac2ca"
    />
    <path d="M3 10h3v3H3zM10 10h3v3h-3z" fill="#d4dce0" stroke="#abb4b8" />
  </Glyph>
);
export const Lock = (p: Props) => (
  <Glyph {...p}>
    <path d="M6 7V4a3 3 0 0 1 6 0v3" stroke="#f4f4f4" />
    <rect x="5" y="7" width="8" height="7" fill="#ddd" stroke="#222" />
    <path d="M9 10v2" stroke="#333" />
    <path d="M1 2h3M1 4h3" stroke="#d2767f" />
  </Glyph>
);
export const Aspect = (p: Props) => (
  <Glyph {...p}>
    <rect x="1" y="2" width="14" height="11" stroke="#ddd" />
    <path d="M3 4l4 5m0-5L3 9m7-5 2 3 2-3m-2 3v3" stroke="#e598a2" />
    <path d="M2 14h12" stroke="#8ebcc5" />
  </Glyph>
);
export const Focus = (p: Props) => (
  <Glyph {...p}>
    <path d="M1 5V1h4m6 0h4v4m0 6v4h-4m-6 0H1v-4" stroke="#dedede" />
    <circle cx="8" cy="8" r="3" fill="#ddd" />
    <path d="M8 3v10M3 8h10" stroke="#222" />
  </Glyph>
);
export const Move = (p: Props) => (
  <Glyph {...p}>
    <path
      fill="#ddd"
      stroke="#ddd"
      d="m8 1-3 3h2v3H4V5L1 8l3 3V9h3v3H5l3 3 3-3H9V9h3v2l3-3-3-3v2H9V4h2z"
    />
  </Glyph>
);
export const Save = (p: Props) => (
  <Glyph {...p}>
    <path d="M2 1h10l2 2v12H2z" fill="#78929d" stroke="#d0e0e5" />
    <path d="M4 1h7v5H4zM4 9h8v6H4z" fill="#e0e5e7" stroke="#26343a" />
    <path d="M9 2v3" stroke="#26343a" />
  </Glyph>
);
export const X = (p: Props) => (
  <Glyph {...p}>
    <path d="m3 3 10 10M13 3 3 13" stroke="#c4c8ca" strokeWidth="2" />
  </Glyph>
);
export const Diamond = (p: Props) => (
  <Glyph {...p}>
    <path d="m8 1 7 7-7 7-7-7z" fill="#b9dfe9" stroke="#304b57" />
    <path d="m8 3 5 5-5 5-5-5z" stroke="#e7f5fa" />
  </Glyph>
);
export const ArrowLeft = (p: Props) => (
  <Glyph {...p}>
    <path d="M8 2 1 8l7 6v-4h7V6H8z" fill="#8fc9e1" stroke="#e2edf2" />
  </Glyph>
);
export const ArrowRight = (p: Props) => (
  <Glyph {...p}>
    <path d="m8 2 7 6-7 6v-4H1V6h7z" fill="#8fc9e1" stroke="#e2edf2" />
  </Glyph>
);
export const SkipBack = (p: Props) => (
  <Glyph {...p}>
    <path d="M2 2v12M10 2 3 8l7 6v-4h5V6h-5z" fill="#8fc9e1" stroke="#e2edf2" />
  </Glyph>
);
export const SkipForward = (p: Props) => (
  <Glyph {...p}>
    <path d="M14 2v12M6 2l7 6-7 6v-4H1V6h5z" fill="#8fc9e1" stroke="#e2edf2" />
  </Glyph>
);
export const Plus = (p: Props) => (
  <Glyph {...p}>
    <path d="M8 2v12M2 8h12" stroke="#8edf9c" strokeWidth="3" />
  </Glyph>
);
export const Minus = (p: Props) => (
  <Glyph {...p}>
    <path d="M2 8h12" stroke="#c9d9df" strokeWidth="2" />
  </Glyph>
);
export const AddKey = (p: Props) => (
  <Glyph {...p}>
    <path d="m9 1 5 5-5 5-5-5z" fill="#ddd" stroke="#eff5f6" />
    <path d="M4 8v7M1 12h7" stroke="#71bd87" strokeWidth="2" />
  </Glyph>
);
export const DeleteKey = (p: Props) => (
  <Glyph {...p}>
    <path d="m9 1 5 5-5 5-5-5z" fill="#ddd" stroke="#eff5f6" />
    <path d="m1 9 6 6m0-6-6 6" stroke="#d97585" strokeWidth="2" />
  </Glyph>
);
export const SyncCursor = (p: Props) => (
  <Glyph {...p}>
    <path d="M1 1h4v4L3 7 1 5z" fill="#ddd" />
    <path d="M3 5v9m4-7V5a3 3 0 0 1 6 0v2" stroke="#eee" />
    <rect x="6" y="7" width="8" height="7" fill="#ddd" stroke="#222" />
    <path d="M10 10v2" stroke="#333" />
  </Glyph>
);

export const MaskPen = () => (
  <Glyph>
    <path d="M3 3l9 3-4 7-5-2zM3 3l4 5" />
    <circle cx="7" cy="8" r="1" />
  </Glyph>
);
export const MaskDelete = () => (
  <Glyph>
    <path d="M3 3l9 3-4 7-5-2z" />
    <path d="M10 1l5 5m0-5l-5 5" stroke="#ed9292" />
  </Glyph>
);
export const MaskRectangle = () => (
  <Glyph>
    <rect x="2" y="3" width="12" height="10" />
  </Glyph>
);
export const MaskEllipse = () => (
  <Glyph>
    <ellipse cx="8" cy="8" rx="6" ry="4" />
  </Glyph>
);
