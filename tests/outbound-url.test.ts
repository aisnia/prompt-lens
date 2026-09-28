import { describe, expect, it } from "vitest";
import {
  assertSafeOutboundUrl,
  isPrivateOrReservedIp,
  UnsafeOutboundUrlError,
} from "@/lib/utils/outbound-url";

describe("outbound URL validation", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fd00::1",
    "fe80::1",
  ])("blocks private or reserved address %s", (address) => {
    expect(isPrivateOrReservedIp(address)).toBe(true);
  });

  it("accepts public IP literals", async () => {
    await expect(assertSafeOutboundUrl("https://1.1.1.1/service")).resolves.toBeInstanceOf(URL);
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:8000",
    "http://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "https://user:pass@example.com",
  ])("rejects unsafe URL %s", async (value) => {
    await expect(assertSafeOutboundUrl(value)).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
  });

  it("allows an explicitly configured private service", async () => {
    await expect(
      assertSafeOutboundUrl("http://192.168.1.10:8000", { allowPrivate: true }),
    ).resolves.toBeInstanceOf(URL);
    await expect(
      assertSafeOutboundUrl("http://localhost:8000", { allowPrivate: true }),
    ).resolves.toBeInstanceOf(URL);
  });
});
