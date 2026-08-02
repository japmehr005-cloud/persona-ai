import { redirect } from "next/navigation";

/** Demoted for demo focus — device intelligence service remains available. */
export default function DeviceIntelligenceRedirectPage() {
  redirect("/admin/fin/recommendations");
}
