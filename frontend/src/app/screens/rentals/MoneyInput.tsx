import { Input } from '@vera/ui';

/** Input de dinero con separador de miles (es-AR) mientras se escribe. Devuelve number. */
export const MoneyInput = ({ label, value, onChange, prefix = '$', testId }: {
  label: string; value?: number; onChange: (n: number) => void; prefix?: string; testId?: string;
}) => {
  const display = value === undefined || value === null || Number.isNaN(value) ? '' : Number(value).toLocaleString('es-AR');
  return (
    <Input
      label={`${label}${prefix ? ` (${prefix})` : ''}`}
      inputMode="numeric"
      value={display}
      onChange={(e) => { const digits = e.target.value.replace(/\D/g, ''); onChange(digits === '' ? 0 : Number(digits)); }}
      data-testid={testId}
    />
  );
};

export default MoneyInput;
