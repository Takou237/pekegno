import { useEffect, useState, type FormEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usersApi } from '@/api/users.api';
import { agenciesApi } from '@/api/agencies.api';
import { departmentsApi } from '@/api/departments.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { CreateUserPayload, RoleListItem } from '@/types/user';
import type { Agency } from '@/types/agency';
import type { Department } from '@/types/department';
import { assignableRoleNames, CHIEF_ROLE_NAMES } from '@/utils/employeeRoles';
import { useUsernameSuggestion } from '@/hooks/useUsernameSuggestion';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  fixedAgencyId?: string;
  fixedAgencyName?: string;
  fixedDepartmentId?: string;
  fixedDepartmentName?: string;
}

export function CreateUserModal({
  isOpen,
  onClose,
  onCreated,
  fixedAgencyId,
  fixedAgencyName,
  fixedDepartmentId,
  fixedDepartmentName,
}: CreateUserModalProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<CreateUserPayload>({
    username: '',
    email: '',
    password: 'password',
    password_confirmation: 'password',
    first_name: '',
    last_name: '',
    phone: '',
    role_id: '',
    agency_id: fixedAgencyId ?? '',
    department_id: fixedDepartmentId ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setUsername = useCallback((username: string) => setForm((p) => ({ ...p, username })), []);
  useUsernameSuggestion(form.first_name ?? '', form.last_name ?? '', form.username, setUsername);

  useEffect(() => {
    if (isOpen) {
      setForm({
        username: '',
        email: '',
        password: 'password',
        password_confirmation: 'password',
        first_name: '',
        last_name: '',
        phone: '',
        role_id: '',
        agency_id: fixedAgencyId ?? '',
        department_id: fixedDepartmentId ?? '',
      });
      setErrors({});
      usersApi.listRoles().then(setRoles).catch(() => {});
      if (!fixedAgencyId) {
        agenciesApi
          .list({ per_page: 100, sort_by: 'name', sort_order: 'asc' })
          .then((res) => setAgencies(res.data))
          .catch(() => {});
      }
    }
  }, [isOpen, fixedAgencyId, fixedDepartmentId]);

  // Liste déroulante des départements de l'agence (fixe ou choisie).
  const departmentAgencyId = fixedAgencyId ?? form.agency_id ?? '';
  useEffect(() => {
    setDepartments([]);
    if (!isOpen || !departmentAgencyId || fixedDepartmentId) return;
    departmentsApi
      .list({ agency_id: departmentAgencyId, per_page: 100 })
      .then((res) => setDepartments([...res.data].sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, [isOpen, departmentAgencyId, fixedDepartmentId]);

  const departmentSelect = (
    <Select
      label={t('users.optionalDepartment')}
      value={form.department_id ?? ''}
      onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))}
      disabled={!departmentAgencyId}
      error={errors.department_id}
    >
      <option value="">{departmentAgencyId ? t('users.noDepartmentOption') : t('users.selectAgencyFirst')}</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </Select>
  );

  const assignableRoles = roles.filter(
    (r) =>
      !CHIEF_ROLE_NAMES.has(r.name) &&
      assignableRoleNames(currentUser?.role?.name).includes(r.name)
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      await usersApi.create(form);
      showToast(t('users.created'), 'success');
      onCreated();
      onClose();
    } catch (err) {
      const fieldErrors = extractFieldErrors(err) as Record<string, string>;
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        showToast(extractErrorMessage(err, t('users.saveFailed')), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('users.createTitle')}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {Object.keys(errors).length > 0 && (
          <Alert variant="error">{Object.values(errors).join(' ')}</Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('users.firstName')}
            name="first_name"
            value={form.first_name ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
            error={errors.first_name}
          />
          <Input
            label={t('users.lastName')}
            name="last_name"
            value={form.last_name ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
            error={errors.last_name}
          />
        </div>

        <Input
          label={t('users.username')}
          name="username"
          required
          value={form.username}
          onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
          error={errors.username}
        />

        <Input
          label={t('users.email')}
          type="email"
          name="email"
          required
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          error={errors.email}
        />

        <Input
          label={t('users.phone')}
          name="phone"
          value={form.phone ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          error={errors.phone}
        />

        <Select
          label={t('users.role')}
          value={form.role_id ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))}
        >
          <option value="">{t('users.noRoleOption')}</option>
          {assignableRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>

        {fixedAgencyId ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('users.agency')}
              </label>
              <input
                type="text"
                value={fixedAgencyName ?? ''}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              />
            </div>
            {!fixedDepartmentId && departmentSelect}
          </>
        ) : (
          <>
            <Select
              label={t('users.optionalAgency')}
              value={form.agency_id ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, agency_id: e.target.value, department_id: '' }))}
              error={errors.agency_id}
            >
              <option value="">{t('users.noAgencyOption')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>

            {departmentSelect}
          </>
        )}

        {fixedDepartmentId && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('users.department')}
            </label>
            <input
              type="text"
              value={fixedDepartmentName ?? ''}
              disabled
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
