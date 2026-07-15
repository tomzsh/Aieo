import { cn } from "@/lib/utils";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-400",
    secondary:
      "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
    ghost:
      "bg-transparent text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700",
    danger:
      "bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400",
    outline:
      "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700",
  };
  const sizes = {
    sm: "min-h-9 h-9 px-3 text-xs",
    md: "min-h-11 h-11 px-4 text-sm sm:h-10 sm:min-h-10",
    lg: "min-h-12 h-12 px-5 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none ring-indigo-500/30 placeholder:text-slate-500 focus:ring-2 sm:h-10 sm:text-sm",
        "dark:border-slate-500 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-400 dark:ring-indigo-400/40",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none ring-indigo-500/30 placeholder:text-slate-500 focus:ring-2 sm:text-sm",
        "dark:border-slate-500 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-400 dark:ring-indigo-400/40",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        "dark:border-slate-600 dark:bg-slate-900 dark:shadow-none",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none ring-indigo-500/30 focus:ring-2 sm:h-10 sm:text-sm",
        "dark:border-slate-500 dark:bg-slate-950 dark:text-slate-50 dark:ring-indigo-400/40",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
