import peteyLogo from "../../assets/brand/petey-logo.svg";

export function BrandMark({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <img
      className={`brand-mark ${light ? "brand-mark--light" : ""} ${className}`.trim()}
      src={peteyLogo}
      alt="Petey"
    />
  );
}
