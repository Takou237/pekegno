import {
  Award,
  BarChart3,
  Book,
  Box,
  Briefcase,
  Building2,
  Camera,
  CheckCircle,
  Clipboard,
  Coins,
  Cog,
  Database,
  Dumbbell,
  Folder,
  Globe,
  GraduationCap,
  Grid,
  Headphones,
  Heart,
  Home,
  Laptop,
  Landmark,
  Music,
  Palette,
  PenTool,
  Plane,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Target,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Video,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  award: Award,
  'bar-chart': BarChart3,
  book: Book,
  box: Box,
  briefcase: Briefcase,
  building: Building2,
  camera: Camera,
  'check-circle': CheckCircle,
  clipboard: Clipboard,
  coins: Coins,
  cog: Cog,
  database: Database,
  dumbbell: Dumbbell,
  folder: Folder,
  globe: Globe,
  'graduation-cap': GraduationCap,
  grid: Grid,
  headphones: Headphones,
  heart: Heart,
  home: Home,
  laptop: Laptop,
  landmark: Landmark,
  music: Music,
  palette: Palette,
  'pen-tool': PenTool,
  plane: Plane,
  settings: Settings,
  shield: Shield,
  'shopping-bag': ShoppingBag,
  sparkles: Sparkles,
  star: Star,
  store: Store,
  tag: Tag,
  target: Target,
  'trending-up': TrendingUp,
  truck: Truck,
  'user-cog': UserCog,
  users: Users,
  video: Video,
  wrench: Wrench,
  zap: Zap,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICON_MAP);

export function resolveCategoryIcon(name?: string | null): LucideIcon {
  if (!name) return Tag;
  return ICON_MAP[name] ?? Tag;
}

export function CategoryIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const Icon = resolveCategoryIcon(name);
  return <Icon className={className} />;
}
