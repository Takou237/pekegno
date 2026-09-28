import { Link } from 'react-router-dom';
import logoUrl from '@/assets/pekegno-logo.png';

interface BrandLogoProps {
  /** Classe de hauteur Tailwind (la largeur suit le ratio). */
  className?: string;
  /** Rend le logo cliquable vers le tableau de bord général. */
  linkToHome?: boolean;
  onClick?: () => void;
}

export function BrandLogo({ className = 'h-8', linkToHome = true, onClick }: BrandLogoProps) {
  const img = <img src={logoUrl} alt="PEKEGNO" className={`${className} w-auto select-none`} draggable={false} />;

  if (!linkToHome) return img;

  return (
    <Link to="/" onClick={onClick} aria-label="PEKEGNO — tableau de bord" className="inline-flex shrink-0 items-center">
      {img}
    </Link>
  );
}
