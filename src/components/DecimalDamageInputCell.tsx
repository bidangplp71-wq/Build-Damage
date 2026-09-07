import React, { useState, useEffect } from 'react';

interface DecimalDamageInputCellProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * High-precision input for damage percentage supporting up to 3 decimal places (e.g., 5.125 or 5,125).
 * Supports both dot (.) and comma (,) decimal separators for standard Indonesian keyboard input.
 */
export const DecimalDamageInputCell: React.FC<DecimalDamageInputCellProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  // Local text representation so typing decimals is smooth without premature reset
  const [localText, setLocalText] = useState<string>(() => {
    return (value === 0 || value === undefined || value === null) ? '0' : String(value);
  });

  // Sync when value changes externally (e.g. from dropdown preset or form reset)
  useEffect(() => {
    const safeVal = value ?? 0;
    const currentParsed = parseFloat(localText.replace(',', '.'));
    // Only synchronize if numerical difference is significant (> 0.0001)
    if (isNaN(currentParsed) || Math.abs(currentParsed - safeVal) > 0.0005) {
      setLocalText(safeVal === 0 ? '0' : String(safeVal));
    }
  }, [value, localText]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow empty string
    if (raw === '') {
      setLocalText('');
      onChange(0);
      return;
    }

    // Only allow numbers and at most one decimal separator (. or ,)
    if (!/^[0-9]*[.,]?[0-9]*$/.test(raw)) {
      return;
    }

    // Restrict to maximum 3 decimal digits
    const separatorMatch = raw.match(/[.,]/);
    if (separatorMatch && separatorMatch.index !== undefined) {
      const decimals = raw.slice(separatorMatch.index + 1);
      if (decimals.length > 3) {
        return; // Reject 4th decimal place
      }
    }

    setLocalText(raw);

    const normalized = raw.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed)) {
      if (parsed > 100) {
        setLocalText('100');
        onChange(100);
      } else if (parsed < 0) {
        setLocalText('0');
        onChange(0);
      } else {
        const rounded = Math.round(parsed * 1000) / 1000;
        onChange(rounded);
      }
    } else {
      onChange(0);
    }
  };

  const handleBlur = () => {
    const normalized = localText.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (isNaN(parsed) || parsed <= 0) {
      setLocalText('0');
      onChange(0);
    } else {
      const clamped = Math.max(0, Math.min(100, parsed));
      const rounded = Math.round(clamped * 1000) / 1000;
      setLocalText(String(rounded));
      onChange(rounded);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={localText ?? ''}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="0.000"
      className={`w-20 px-2 py-1 text-center font-bold font-mono rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white text-xs transition-shadow ${className}`}
      title="Ketik persentase kerusakan (bisa hingga 3 angka desimal, contoh: 5.125 atau 5,125)"
    />
  );
};
