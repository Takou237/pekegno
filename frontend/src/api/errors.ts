import { AxiosError } from 'axios';
import type { ApiValidationError } from '@/types/auth';

/**
 * Laravel renvoie les erreurs de validation au format :
 * { message: string, errors: { field: string[] } }
 * Ce helper extrait un message lisible, utilisable directement dans un Alert.
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiValidationError | undefined;

    if (data?.errors) {
      return Object.values(data.errors).flat().join(' ');
    }

    if (data?.message) {
      return data.message;
    }
  }

  return fallback;
}

/**
 * Extrait les erreurs par champ (pour affichage sous chaque Input).
 */
export function extractFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiValidationError | undefined;
    if (data?.errors) {
      return Object.fromEntries(
        Object.entries(data.errors).map(([field, messages]) => [field, messages[0]])
      );
    }
  }
  return {};
}
