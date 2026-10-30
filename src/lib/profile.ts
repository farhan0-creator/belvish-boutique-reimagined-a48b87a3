import { z } from "zod";

export type SavedAddress = { line: string; city: string; state: string; pincode: string };

/** Reads the profile's default delivery address safely from its stored JSON. */
export function readAddress(raw: unknown): SavedAddress {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return { line: str(o.line), city: str(o.city), state: str(o.state), pincode: str(o.pincode) };
}

/** Profile edits: every field optional (empty allowed) but valid when filled. */
export const profileSchema = z.object({
  name: z.string().trim().max(100, "Keep your name under 100 characters"),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")]),
  line: z.union([z.literal(""), z.string().trim().min(5, "Please enter your full address").max(300)]),
  city: z.string().trim().max(80),
  state: z.string().trim().max(80),
  pincode: z.union([z.literal(""), z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code")]),
});
export type ProfileForm = z.infer<typeof profileSchema>;

export const INDIAN_STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];
