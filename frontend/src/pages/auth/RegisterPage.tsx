import { AuthLayout } from '@/layouts/AuthLayout';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Rejoignez la plateforme PEKEGNO."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
