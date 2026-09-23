import React from 'react';

type DecimalInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step'
> & {
  /** The number to show while the field is not being edited. `null` shows an empty field. */
  value: number | null;
  /** Digits after the point when showing `value` (not while typing). */
  digits: number;
  /** Called with every complete number the user types; partial input ("-", "1.", "") is not reported. */
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Amount for ArrowUp / ArrowDown. */
  step?: number;
};

const COMPLETE_NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)$/;

/**
 * A numeric field that lets you type.
 *
 * A controlled `type="number"` input whose value is re-rendered from a rounded
 * model value rewrites the text under the caret on every keystroke: typing "1."
 * or "-" or "0.05" snaps to "1.00" / "0.00" / "0.005". So while the field has
 * focus it shows exactly what was typed, pushes each complete number up as it
 * appears, and only goes back to the formatted model value on blur.
 *
 * `type="text"` with `inputMode="decimal"` because a number input reports ""
 * for partial input and cannot be trusted to keep it. Comma is accepted as the
 * decimal separator.
 */
export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(function DecimalInput(
  { value, digits, onValueChange, min, max, step, onBlur, onKeyDown, ...rest },
  ref
) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? (value === null || !Number.isFinite(value) ? '' : value.toFixed(digits));

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const normalised = text.trim().replace(',', '.');
        if (!COMPLETE_NUMBER.test(normalised)) return;
        const parsed = Number(normalised);
        if (Number.isFinite(parsed)) onValueChange(parsed);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && step) {
          event.preventDefault();
          const current = Number((draft ?? shown).replace(',', '.'));
          const base = Number.isFinite(current) ? current : (value ?? 0);
          const factor = event.shiftKey ? 10 : 1;
          const next = clamp(base + (event.key === 'ArrowUp' ? step : -step) * factor);
          const rounded = Number(next.toFixed(Math.max(digits, 6)));
          setDraft(String(rounded));
          onValueChange(rounded);
        }
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
});
