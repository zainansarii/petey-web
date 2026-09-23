// Provider exception messages can echo prompts. Only emit bounded, recognised
// error classifications; never log a provider's free-form message or payload.
const statuses = new Set([
  "CANCELLED", "UNKNOWN", "INVALID_ARGUMENT", "DEADLINE_EXCEEDED", "NOT_FOUND",
  "ALREADY_EXISTS", "PERMISSION_DENIED", "RESOURCE_EXHAUSTED", "FAILED_PRECONDITION",
  "ABORTED", "OUT_OF_RANGE", "UNIMPLEMENTED", "INTERNAL", "UNAVAILABLE",
  "DATA_LOSS", "UNAUTHENTICATED",
]);

function safeCode(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 599) return value;
  if (typeof value === "string" && statuses.has(value)) return value;
  return null;
}

export function providerErrorDetails(error: unknown) {
  const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  return {
    errorType: "model-provider-error",
    errorStatus: safeCode(record.status),
    errorCode: safeCode(record.code),
  };
}
