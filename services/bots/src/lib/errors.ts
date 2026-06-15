export function formatError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
    return error.name.trim() || "Unknown error";
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message =
      typeof record.message === "string" ? record.message.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const errorField =
      typeof record.error === "string" ? record.error.trim() : "";

    if (message) {
      return message;
    }
    if (name && errorField) {
      return `${name}: ${errorField}`;
    }
    if (name) {
      return name;
    }
    if (errorField) {
      return errorField;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }

  if (error === undefined || error === null) {
    return "Unknown error";
  }

  return String(error);
}
