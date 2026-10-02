export function sessionPrice(pricePerSessionGbp: number | null): string {
  if (pricePerSessionGbp === null) return "Rates on enquiry";
  return `£${pricePerSessionGbp.toFixed(Number.isInteger(pricePerSessionGbp) ? 0 : 2)} / session`;
}
