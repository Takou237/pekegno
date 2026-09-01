import { useParams } from 'react-router-dom';
import ProduitTrashPage from '@/pages/produit/ProduitTrashPage';

export default function AgencyProduitTrashPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  return <ProduitTrashPage agencyId={agencyId} />;
}
