import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('button', { variants: {
  variant: { primary: 'button-primary', secondary: 'button-secondary', ghost: 'button-ghost', danger: 'button-danger' },
  size: { default: '', small: 'button-small', icon: 'button-icon' },
}, defaultVariants: { variant: 'primary', size: 'default' } });

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ className, variant, size, loading = false, disabled, children, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {children}{loading && <span className="busy-dot" aria-hidden="true" />}
  </button>;
}
