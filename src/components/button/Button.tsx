import React, { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = {
  accentColor: string;
  children: ReactNode;
  className?: string;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button: React.FC<ButtonProps> = ({
  accentColor,
  children,
  className = '',
  variant = 'solid',
  disabled,
  ...allProps
}) => {
  const baseStyles = "px-4 py-2 rounded-lg font-bold tracking-wide uppercase text-sm transition-all duration-200";

  const variantStyles = variant === 'solid'
    ? `bg-${accentColor}-500 hover:bg-${accentColor}-600 text-white`
    : `border-2 border-${accentColor}-500 text-${accentColor}-500 hover:bg-${accentColor}-500 hover:text-white`;

  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${disabledStyles} ${className}`}
      disabled={disabled}
      {...allProps}
    >
      {children}
    </button>
  );
};
