import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeOutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeOutboundUrlError";
  }
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;

  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4[1]) : false;
}

export function isPrivateOrReservedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeOutboundUrl(
  value: unknown,
  options: { allowPrivate?: boolean; fieldName?: string } = {},
): Promise<URL> {
  const fieldName = options.fieldName || "URL";
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    throw new UnsafeOutboundUrlError(`${fieldName} is invalid`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new UnsafeOutboundUrlError(`${fieldName} is invalid`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new UnsafeOutboundUrlError(`${fieldName} must use HTTP or HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeOutboundUrlError(`${fieldName} must not contain credentials`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) {
    throw new UnsafeOutboundUrlError(`${fieldName} is invalid`);
  }

  const allowPrivate = options.allowPrivate ?? process.env.ALLOW_PRIVATE_SERVICE_URLS === "true";
  if (!allowPrivate && (hostname === "localhost" || hostname.endsWith(".localhost"))) {
    throw new UnsafeOutboundUrlError(`${fieldName} points to a private host`);
  }
  if (allowPrivate) return parsed;

  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeOutboundUrlError(`${fieldName} points to a private or reserved address`);
    }
    return parsed;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeOutboundUrlError(`${fieldName} hostname could not be resolved`);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
    throw new UnsafeOutboundUrlError(`${fieldName} resolves to a private or reserved address`);
  }

  return parsed;
}
