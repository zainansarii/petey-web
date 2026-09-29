export function sessionPrice(pricePerSessionGbp: number): string {
  return `£${pricePerSessionGbp.toFixed(Number.isInteger(pricePerSessionGbp) ? 0 : 2)} / session`;
}
