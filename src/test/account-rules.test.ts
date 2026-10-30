import { describe, expect, it } from "vitest";
import { profileSchema, readAddress } from "@/lib/profile";
import { safeAnnouncementHref } from "@/lib/store-settings.functions";

const base = { name: "Asha Rao", phone: "", line: "", city: "", state: "", pincode: "" };

describe("Customer profile rules", () => {
  it("accepts a 10-digit Indian mobile number starting 6-9", () => {
    expect(profileSchema.safeParse({ ...base, phone: "9876543210" }).success).toBe(true);
  });
  it("rejects a mobile number that does not start 6-9", () => {
    expect(profileSchema.safeParse({ ...base, phone: "5876543210" }).success).toBe(false);
  });
  it("rejects a PIN code that is not 6 digits", () => {
    expect(profileSchema.safeParse({ ...base, pincode: "4000" }).success).toBe(false);
  });
  it("reads a saved default address and ignores malformed data", () => {
    expect(readAddress({ line: "12 Lane", city: "Pune", state: "Maharashtra", pincode: "411001" }).city).toBe("Pune");
    expect(readAddress("bad").line).toBe("");
  });
});

describe("Announcement link rules", () => {
  it("allows on-site paths and https links", () => {
    expect(safeAnnouncementHref("/shop")).toBe("/shop");
    expect(safeAnnouncementHref("https://example.com/sale")).toBe("https://example.com/sale");
  });
  it("blocks scripts and protocol-relative links", () => {
    expect(safeAnnouncementHref("javascript:alert(1)")).toBeNull();
    expect(safeAnnouncementHref("//evil.example")).toBeNull();
  });
});
