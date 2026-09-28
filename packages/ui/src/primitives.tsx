import * as React from 'react';
import { Tooltip } from 'radix-ui';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = 'ghost', className = '', type = 'button', ...props }, ref) {
    return <button ref={ref} type={type} className={`ffui-button ffui-${variant} ${className}`.trim()} {...props} />;
  }
);

export type IconButtonProps = ButtonProps & { label: string };

export function UIProvider({ children }: React.PropsWithChildren) {
  return <Tooltip.Provider delayDuration={450}>{children}</Tooltip.Provider>;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, className = '', children, ...props }, ref) {
    return (
      <UIProvider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button {...props} ref={ref} aria-label={label} className={`ffui-icon-button ${className}`.trim()}>{children}</Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="ffui-tooltip" sideOffset={6} collisionPadding={12}>{label}</Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </UIProvider>
    );
  }
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`ffui-input ${className}`.trim()} {...props} />;
  }
);

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`ffui-textarea ${className}`.trim()} {...props} />;
  }
);

export type FieldProps = React.PropsWithChildren<{ label: string }>;

export function Field({ label, children }: FieldProps) {
  return <label className="ffui-field"><span>{label}</span>{children}</label>;
}
