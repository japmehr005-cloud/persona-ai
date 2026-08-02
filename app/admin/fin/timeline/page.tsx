import { redirect } from "next/navigation";

/** Demoted for demo focus — FIN event logger remains available. */
export default function FinTimelineRedirectPage() {
  redirect("/admin/fin/recommendations");
}
