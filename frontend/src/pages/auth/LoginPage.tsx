import { AuthLayout } from '@/layouts/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <AuthLayout
      title="Connexion à votre espace"
      subtitle="Accédez à la gestion de votre agence PEKEGNO."
    >
      <LoginForm />
    </AuthLayout>
  );
}
