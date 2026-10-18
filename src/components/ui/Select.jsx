import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Field, fieldBase } from './Input';

export const Select = forwardRef(function Select(
  { label, error, helper, className, wrapperClassName, children, required, id, ...props },
  ref,
) {
  const auto = useId();
  const selectId = id || auto;
  return (
    <Field label={label} error={error} helper={helper} required={required} htmlFor={selectId} className={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(fieldBase, 'cursor-pointer appearance-none pe-9', error && 'border-rose-400', className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      </div>
    </Field>
  );
});
