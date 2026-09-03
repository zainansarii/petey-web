import type { ComponentProps } from "react";

type TwinOrbitProps = ComponentProps<"span">;

export function TwinOrbit({ className = "", ...props }: TwinOrbitProps) {
  return (
    <span className={`twin-orbit ${className}`.trim()} role="status" {...props}>
      <span aria-hidden="true" className="twin-orbit__marker" />
      <span aria-hidden="true" className="twin-orbit__marker twin-orbit__marker--delayed" />
      <span className="sr-only">Loading</span>
    </span>
  );
}
