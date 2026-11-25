import { describe, expect, it } from "vitest";
import { signJwt, verifyJwt } from "@/server/pg-adapter.server";

describe("Render Postgres JWT auth", () => {
  it("signs and verifies a valid user JWT", () => {
    const uid = "11111111-1111-4111-8111-111111111111";
    const token = signJwt(uid, 3600);
    const claims = verifyJwt(token);
    expect(claims?.sub).toBe(uid);
    expect(claims?.role).toBe("authenticated");
  });

  it("rejects tampered or expired tokens", () => {
    const uid = "11111111-1111-4111-8111-111111111111";
    const token = signJwt(uid, 3600);
    const tampered = token.slice(0, -4) + "xxxx";
    expect(verifyJwt(tampered)).toBeNull();
    const expired = signJwt(uid, -10);
    expect(verifyJwt(expired)).toBeNull();
  });
});
