import { redirect } from "next/navigation";

/** Demoted for demo focus — investigation services remain available via Recommendation Center. */
export default function FraudInvestigationsRedirectPage() {
  redirect("/admin/fin/recommendations");
}