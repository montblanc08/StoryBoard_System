/** Shared shadcn primitives plus the explicit FRAMEFORGE icon surface. */

export { Button, IconButton, Input, TextArea, Field, Select, UIProvider } from './primitives';
export type { ButtonProps, IconButtonProps, FieldProps, Option, SelectProps } from './primitives';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './components/card';
export { Badge, badgeVariants } from './components/badge';
export { Checkbox } from './components/checkbox';
export { NativeSelect } from './components/native-select';
export { buttonVariants } from './components/button';
export { cn } from './lib/utils';
import {
  AlertTriangle, ArrowRight, ArrowUpDown, Check, ChevronLeft, ChevronRight,
  CircleUserRound, Clapperboard, Clock, Clock3, Columns3, Download, Filter,
  FileDown, Film, Image, Images, LayoutGrid, Lightbulb, ListVideo,
  Lock, LockOpen, MessageSquare, Mic, Moon, Palette, PanelRightOpen, Pause, Play, Plus,
  RefreshCw, Search, Settings, SlidersHorizontal, Sun, Table2, Trash2, TriangleAlert, Undo2, X
} from 'lucide-react';

// Keep the shared icon surface explicit so a consumer does not bundle all of Lucide.
export const Icons = {
  AlertTriangle, ArrowRight, ArrowUpDown, Check, ChevronLeft, ChevronRight,
  CircleUserRound, Clapperboard, Clock, Clock3, Columns3, Download, Filter,
  FileDown, Film, Image, Images, LayoutGrid, Lightbulb, ListVideo,
  Lock, LockOpen, MessageSquare, Mic, Moon, Palette, PanelRightOpen, Pause, Play, Plus,
  RefreshCw, Search, Settings, SlidersHorizontal, Sun, Table2, Trash2, TriangleAlert, Undo2, X
};
