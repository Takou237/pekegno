import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function RegisterForm() {
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await authApi.register({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        password,
        password_confirmation: passwordConfirmation,
        city,
        country,
        address,
      });
      setIsSubmitted(true);
    } catch (error) {
      setFormError(extractErrorMessage(error, t('register.failed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="success">{t('register.success')}</Alert>
        <Link
          to="/login"
          className="text-center text-sm font-medium text-brand-600 hover:underline"
        >
          {t('register.signIn')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          label={t('auth.firstName')}
          type="text"
          name="first_name"
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={fieldErrors.first_name}
        />
        <Input
          label={t('auth.lastName')}
          type="text"
          name="last_name"
          autoComplete="family-name"
          required
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          error={fieldErrors.last_name}
        />
      </div>

      <Input
        label={t('auth.email')}
        type="email"
        name="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        placeholder={t('auth.emailPlaceholder')}
      />

      <Input
        label={t('auth.phone')}
        type="tel"
        name="phone"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={fieldErrors.phone}
        placeholder="+237 6XX XXX XXX"
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          label={t('register.city')}
          type="text"
          name="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={fieldErrors.city}
        />
        <Input
          label={t('register.country')}
          type="text"
          name="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors.country}
        />
      </div>

      <Input
        label={t('register.address')}
        type="text"
        name="address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        error={fieldErrors.address}
        placeholder={t('register.addressPlaceholder')}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input
          label={t('auth.password')}
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint={t('auth.passwordHint')}
        />
        <Input
          label={t('auth.confirmPassword')}
          type="password"
          name="password_confirmation"
          autoComplete="new-password"
          required
          value={passwordConfirmation}
          onChange={(e) => setPasswordConfirmation(e.target.value)}
          error={fieldErrors.password_confirmation}
        />
      </div>

      <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting} fullWidth>
        {t('register.submit')}
      </Button>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        {t('register.alreadyRegistered')}{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          {t('register.signIn')}
        </Link>
      </p>
    </form>
  );
}
