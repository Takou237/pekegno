import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '@/api/public.api';
import { clientApi } from '@/api/client.api';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, displayPrice } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, ShoppingCart, GraduationCap } from 'lucide-react';
import type { Service, Product, PublicCourse } from '@/types';

type ItemType = 'service' | 'product' | 'course';

export default function ProductDetailPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [item, setItem] = useState<Service | Product | PublicCourse | null>(null);
  const [itemType, setItemType] = useState<ItemType>('service');
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [sessionId, setSessionId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    publicApi.getService(slug)
      .then((s) => {
        setItem(s);
        setItemType('service');
      })
      .catch(() =>
        publicApi.getProduct(slug)
          .then((p) => {
            setItem(p);
            setItemType('product');
          })
          .catch(() =>
            publicApi.getCourse(slug)
              .then((c) => {
                setItem(c);
                setItemType('course');
              })
              .catch(() => setItem(null)),
          ),
      )
      .finally(() => setLoading(false));
  }, [slug]);

  const price = item ? displayPrice({ ...item, type: itemType }) : 0;
  const course = itemType === 'course' ? (item as PublicCourse) : null;

  const handleAddToCart = () => {
    if (!item || itemType === 'course') return;
    addItem({
      type: itemType,
      id: item.id,
      name: item.name,
      unitPrice: price,
      quantity,
      slug,
      coverImage: item.cover_image,
      agencyName: item.agency && typeof item.agency === 'object' ? item.agency.name : undefined,
      categoryName: 'category' in item && item.category && typeof item.category === 'object' ? item.category.name : undefined,
    });
    showToast(t('cart.added'), 'success');
    navigate('/panier');
  };

  async function handleEnroll() {
    if (!course) return;
    if (!isAuthenticated) {
      showToast(t('academy.loginToEnroll'), 'info');
      navigate('/connexion');
      return;
    }
    setEnrolling(true);
    try {
      await clientApi.enroll({
        course_id: course.id,
        training_session_id: sessionId || undefined,
      });
      showToast(t('academy.enrollmentCreated'), 'success');
      navigate('/mon-compte/formations');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('academy.enrollFailed');
      showToast(message, 'error');
    } finally {
      setEnrolling(false);
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-16"><Spinner /></div>;
  if (!item) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500">{t('common.noData')}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/catalogue" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 mb-6">
        <ArrowLeft size={16} /> {t('common.back')}
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {item.cover_image && (
          <div className="h-64 md:h-80 bg-gray-100">
            <img src={item.cover_image} alt={item.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
              {itemType === 'service' ? t('catalog.typeServices') : itemType === 'course' ? t('catalog.typeFormations') : t('catalog.typeProducts')}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{item.name}</h1>

          {item.description && (
            <p className="text-gray-600 mb-6 whitespace-pre-wrap">{item.description}</p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end gap-6 mb-8">
            <div>
              <p className="text-sm text-gray-500 mb-1">{t('product.price')}</p>
              <p className="text-3xl font-bold text-brand-600">{formatCurrency(price)}</p>
            </div>
            {item.agency && (
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('product.agency')}</p>
                <p className="font-medium text-gray-900">{typeof item.agency === 'object' ? item.agency.name : item.agency}</p>
              </div>
            )}
            {!course && 'category' in item && item.category && typeof item.category === 'object' && (
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('product.category')}</p>
                <p className="font-medium text-gray-900">{item.category.name}</p>
              </div>
            )}
          </div>

          {course ? (
            <div className="bg-gray-50 rounded-lg p-6 flex flex-col gap-4">
              {course.sessions && course.sessions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">{t('academy.selectSession')}</label>
                  <select
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                  >
                    <option value="">{t('academy.noSessionYet')}</option>
                    {course.sessions.map((session) => (
                      <option
                        key={session.id}
                        value={session.id}
                        disabled={session.max_capacity !== null && session.enrolled_count >= session.max_capacity}
                      >
                        {new Date(session.start_at).toLocaleDateString('fr-FR')}
                        {session.max_capacity !== null ? ` (${session.enrolled_count}/${session.max_capacity})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button onClick={handleEnroll} isLoading={enrolling} fullWidth>
                <GraduationCap size={18} className="mr-2" />
                {t('academy.enrollNow')} — {formatCurrency(price)}
              </Button>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">{t('checkout.quantity')}</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                />
              </div>

              <div className="flex-1 flex items-center gap-3">
                <Button onClick={handleAddToCart} fullWidth>
                  <ShoppingCart size={18} className="mr-2" />
                  {t('cart.addToCart')} — {formatCurrency(price * quantity)}
                </Button>
                {isAuthenticated && (
                  <Link to="/panier" className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-brand-600 whitespace-nowrap">
                    {t('nav.cart')}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
