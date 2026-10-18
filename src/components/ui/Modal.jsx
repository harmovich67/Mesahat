import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' };

export function Modal({
  isOpen, onClose, title, description, children, size, maxWidth, className, bodyClassName, footer, hideClose,
}) {
  const dir = useLanguageStore((s) => s.dir);
  return (
    <Dialog.Root open={Boolean(isOpen)} onOpenChange={(open) => !open && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-brand-950/55 backdrop-blur-sm" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-3 sm:p-6">
          <Dialog.Content
            dir={dir}
            className={cn(
              'pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-glow outline-none animate-pop',
              maxWidth || SIZES[size] || SIZES.md,
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-sand-100 px-6 py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-bold leading-tight text-ink">{title}</Dialog.Title>
                <Dialog.Description className={description ? 'mt-0.5 text-xs text-stone-500' : 'sr-only'}>
                  {description || title}
                </Dialog.Description>
              </div>
              {!hideClose && (
                <Dialog.Close
                  className="-m-1 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-sand-100 hover:text-ink"
                  aria-label="close"
                >
                  <X className="size-5" />
                </Dialog.Close>
              )}
            </div>
            <div className={cn('flex-1 overflow-y-auto p-6', bodyClassName)}>{children}</div>
            {footer && <div className="border-t border-sand-100 bg-sand-50/60 px-6 py-4">{footer}</div>}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Side sheet — used for booking / customer detail panels in the admin. */
export function Drawer({ isOpen, onClose, title, description, children, width = 'max-w-xl', footer }) {
  const dir = useLanguageStore((s) => s.dir);
  return (
    <Dialog.Root open={Boolean(isOpen)} onOpenChange={(open) => !open && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-brand-950/45 backdrop-blur-[2px]" />
        <Dialog.Content
          dir={dir}
          className={cn(
            'fixed inset-y-0 end-0 z-50 flex w-full flex-col border-s border-sand-200 bg-white shadow-glow outline-none animate-fade-in',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-sand-100 px-6 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold text-ink">{title}</Dialog.Title>
              <Dialog.Description className={description ? 'mt-0.5 text-xs text-stone-500' : 'sr-only'}>
                {description || title}
              </Dialog.Description>
            </div>
            <Dialog.Close className="-m-1 rounded-lg p-1.5 text-stone-400 hover:bg-sand-100 hover:text-ink" aria-label="close">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
          {footer && <div className="border-t border-sand-100 bg-sand-50/60 px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
