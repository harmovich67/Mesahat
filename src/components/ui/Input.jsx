import { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

export const fieldBase =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-150 ' +
  'border-sand-300 placeholder:text-stone-400 hover:border-sand-400 ' +
  'focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 ' +
  'disabled:cursor-not-allowed disabled:bg-sand-50 disabled:text-stone-400';

export function Field({ label, error, helper, required, htmlFor, children, className }) {
  return (
    <div className={cn(!/(^| )w-/.test(className || '') && 'w-full', 'space-y-1.5 text-start', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-semibold text-stone-700">
          {label}
          {required && <span className="ms-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>
      ) : helper ? (
        <p className="text-xs text-stone-500">{helper}</p>
      ) : null}
    </div>
  );
}

const LTR_TYPES = ['email', 'tel', 'number', 'url', 'date', 'time', 'password'];

export const Input = forwardRef(function Input(
  { label, error, helper, className, wrapperClassName, type = 'text', icon: Icon, required, id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} error={error} helper={helper} required={required} htmlFor={inputId} className={wrapperClassName}>
      <div className="relative">
        {Icon && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-stone-400">
            <Icon className="size-4" />
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            fieldBase,
            Icon && 'ps-10',
            LTR_TYPES.includes(type) && 'text-start',
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10',
            className,
          )}
          {...props}
        />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, helper, className, wrapperClassName, rows = 3, required, id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} error={error} helper={helper} required={required} htmlFor={inputId} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(fieldBase, 'resize-y', error && 'border-rose-400', className)}
        {...props}
      />
    </Field>
  );
});
