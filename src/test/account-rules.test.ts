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

describe("Pop-up ad rules", async () => {
  const { storeSettingsSchema } = await import("@/lib/admin.functions");
  const { DEFAULT_STORE_SETTINGS } = await import("@/lib/store-settings.functions");
  const { popup_image_src: _src, ...base } = DEFAULT_STORE_SETTINGS;
  const ad = { ...base, popup_enabled: true, popup_title: "Diwali edit" };

  it("accepts an ad with an uploaded image and a 0–60 second delay", () => {
    expect(storeSettingsSchema.safeParse({ ...ad, popup_image_url: "popup-ads/123-abc.jpg", popup_delay_seconds: 60 }).success).toBe(true);
  });
  it("rejects a delay over 60 seconds", () => {
    expect(storeSettingsSchema.safeParse({ ...ad, popup_delay_seconds: 61 }).success).toBe(false);
  });
  it("rejects an unsafe button link", () => {
    expect(storeSettingsSchema.safeParse({ ...ad, popup_button_link: "javascript:alert(1)" }).success).toBe(false);
  });
  it("rejects an image that is not an upload or https link", () => {
    expect(storeSettingsSchema.safeParse({ ...ad, popup_image_url: "http://example.com/a.jpg" }).success).toBe(false);
  });
  it("won't switch the pop-up on with nothing in it", () => {
    expect(storeSettingsSchema.safeParse({ ...ad, popup_title: "" }).success).toBe(false);
  });
});
