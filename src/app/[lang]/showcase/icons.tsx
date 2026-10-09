import {
  ArrowLeftRight,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleMinus,
  Contrast,
  Copy,
  Database,
  Download,
  Equal,
  Eye,
  EyeOff,
  FileCode2,
  ListRestart,
  Loader2,
  Minus,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Table2,
  TriangleAlert,
  Undo2,
  UploadCloud,
  X,
} from 'lucide-react';

// Every lucide icon the app renders. Keep in step with the imports in src/.
const ICONS = {
  ArrowLeftRight,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleMinus,
  Contrast,
  Copy,
  Database,
  Download,
  Equal,
  Eye,
  EyeOff,
  FileCode2,
  ListRestart,
  Loader2,
  Minus,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Table2,
  TriangleAlert,
  Undo2,
  UploadCloud,
  X,
};

export const IconGrid = () => (
  <ul className="grid w-full grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
    {Object.entries(ICONS).map(([name, Icon]) => (
      <li
        key={name}
        className="flex items-center gap-2 rounded-base border-2 px-2 py-1.5"
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="identifier truncate text-xs">{name}</span>
      </li>
    ))}
  </ul>
);
