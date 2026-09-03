import type { ComponentProps } from "react";

type TextDotsProps = ComponentProps<"span"> & {
  dots?: number;
};

export function TextDots({ children, className = "", dots = 3, ...props }: TextDotsProps) {
  const dotCount = Number.isFinite(dots) ? Math.max(1, Math.floor(dots)) : 3;

  return (
    <span className={`text-dots ${className}`.trim()} role="status" {...props}>
      <span>{children}</span>
      <span aria-hidden="true" className="text-dots__ellipsis">
        {Array.from({ length: dotCount }, (_, index) => (
          <span
            className="text-dots__dot"
            key={index}
            style={{ animationDelay: `calc(var(--text-dots-delay, 0.2s) * ${index + 1})` }}
          >.</span>
        ))}
      </span>
    </span>
  );
}
