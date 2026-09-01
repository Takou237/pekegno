import { useParams } from 'react-router-dom';
import ProduitListPage from '@/pages/produit/ProduitListPage';

export default function AgencyProduitsPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  return <ProduitListPage agencyId={agencyId} />;
}
