const SECRET_KEY = /^(api[-_]?key|token|secret|password|authorization|private[-_]?key)$/i;

export function redact(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted]")
    .replace(/\b(api[_-]?key|token|secret|password|authorization)\b(\s*[:=]\s*)(Bearer\s+\S+|\S+)/gi, "$1$2[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/\bsk-(?:ant-)?[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
}

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redact(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      output[key] = SECRET_KEY.test(key) ? "[redacted]" : redactValue(inner);
    }
    return output;
  }
  return value;
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export function createLogger(write: (line: string) => void = (line) => {
  process.stderr.write(line);
}): Logger {
  const emit = (level: string, message: string, fields?: Record<string, unknown>): void => {
    const payload: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      message: redact(message),
    };
    if (fields) {
      payload.fields = redactValue(fields);
    }
    write(`${JSON.stringify(payload)}\n`);
  };
  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
  };
}
