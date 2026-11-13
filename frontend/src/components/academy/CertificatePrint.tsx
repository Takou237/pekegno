import { currentLocale } from '@/i18n';
import type { Certificate } from '@/types/certificate';
import logoUrl from '@/assets/pekegno-logo.png';

const BLUE = '#00AEEF';

function longDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Certificat imprimable (A4 paysage) : apprenant, formation, date, mention,
 * numéro de série vérifiable sur la page publique « Vérifier un certificat ».
 * Un certificat révoqué porte la mention RÉVOQUÉ.
 */
export function CertificatePrint({ certificate }: { certificate: Certificate }) {
  const learner = certificate.enrollment?.learner;
  const name = [learner?.first_name, learner?.last_name].filter(Boolean).join(' ') || '—';
  const course = certificate.enrollment?.course?.name ?? '—';
  const revoked = certificate.status === 'revoked';

  return (
    <div
      className="relative mx-auto bg-white text-gray-900"
      style={{ width: '297mm', maxWidth: '100%', aspectRatio: '297 / 210', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <div className="absolute inset-[6mm] border-[3px]" style={{ borderColor: BLUE }} />
      <div className="absolute inset-[9mm] border border-gray-300" />

      <div className="relative flex h-full flex-col items-center justify-between px-[22mm] py-[16mm] text-center">
        <img src={logoUrl} alt="Pekegno" className="h-16 object-contain" />

        <div className="flex flex-col items-center gap-3">
          <p className="text-[13px] uppercase tracking-[0.35em] text-gray-500">Pekegno Academy</p>
          <h1 className="text-[42px] font-bold uppercase tracking-wide" style={{ color: BLUE }}>Certificat</h1>
          <p className="text-[15px] italic text-gray-600">Ce certificat est décerné à</p>
          <p className="border-b-2 px-10 pb-1 text-[34px] font-semibold" style={{ borderColor: BLUE }}>{name}</p>
          <p className="max-w-[200mm] text-[15px] text-gray-700">
            pour avoir suivi avec succès la formation
          </p>
          <p className="text-[24px] font-semibold">« {course} »</p>
          {certificate.mention && (
            <p className="text-[16px]">
              Mention : <span className="font-semibold">{certificate.mention}</span>
            </p>
          )}
        </div>

        <div className="flex w-full items-end justify-between text-[12px] text-gray-600" style={{ fontFamily: 'Verdana, Arial, sans-serif' }}>
          <div className="text-left">
            <p>Délivré le <span className="font-semibold text-gray-900">{longDate(certificate.issued_on)}</span></p>
            <p>N° <span className="font-mono font-semibold text-gray-900">{certificate.number}</span></p>
            <p className="mt-1 text-[10px]">Authenticité vérifiable avec ce numéro sur la page « Vérifier un certificat » du site Pekegno.</p>
          </div>
          <div className="text-center">
            <div className="mb-1 h-12 w-56 border-b border-gray-400" />
            <p>La Direction</p>
          </div>
        </div>
      </div>

      {revoked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-18deg] border-[6px] border-red-500 px-10 py-2 text-[64px] font-bold uppercase tracking-widest text-red-500/70">
            Révoqué
          </span>
        </div>
      )}
    </div>
  );
}

/** Format paysage pour l'impression du certificat (actif seulement quand il est ouvert). */
export function CertificatePrintPageStyle() {
  return <style>{'@media print { @page { size: A4 landscape; margin: 0; } }'}</style>;
}
