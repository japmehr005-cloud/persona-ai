import { redirect } from "next/navigation";

/** Demoted for demo focus — backend cluster engine remains available. */
export default function FraudClustersRedirectPage() {
  redirect("/admin/fin/recommendations");
}
