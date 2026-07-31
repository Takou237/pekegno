import { AuthLayout } from '@/layouts/AuthLayout';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Créer un compte client"
      subtitle="Rejoignez la plateforme PEKEGNO en tant que client / apprenant."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
