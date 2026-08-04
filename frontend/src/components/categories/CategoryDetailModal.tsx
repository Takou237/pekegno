import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CategoryIcon } from '@/utils/categoryIcons';
import type { Category } from '@/types/category';

interface CategoryDetailModalProps {
  category: Category | null;
  onClose: () => void;
}

export function CategoryDetailModal({ category, onClose }: CategoryDetailModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={Boolean(category)}
      onClose={onClose}
      title={t('categories.detailTitle')}
      maxWidth="max-w-lg"
    >
      {category && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700"
              style={{ backgroundColor: category.color ?? '#CBD5E1' }}
            >
              <CategoryIcon name={category.icon} className="h-6 w-6 text-white" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {category.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {category.services_count ?? 0} {t('categories.colServices').toLowerCase()}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-gray-400">{t('categories.color')}</dt>
              <dd className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                  style={{ backgroundColor: category.color ?? '#CBD5E1' }}
                />
                {category.color ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-400">{t('categories.icon')}</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                {category.icon ? (
                  <>
                    <CategoryIcon name={category.icon} className="h-4 w-4 text-gray-500" />
                    <span>{category.icon}</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">{t('categories.description')}</dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {category.description ?? '—'}
              </dd>
            </div>
          </dl>

          <div className="flex justify-end gap-3">
            <div className="w-48">
              <Link to={`/catalog/services?category_id=${category.id}`}>
                <Button variant="outline">{t('categories.viewServices')}</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
