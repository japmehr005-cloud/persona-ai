"use server";

import { requireUser } from "@/lib/session";
import { getSecurityMapForUser, type SecurityMapData } from "@/services/fin/geo-intelligence";

/** On-demand refresh for the customer Security Map — used by the live SSE
 * client so a new login appears without a full page reload. */
export async function getSecurityMapAction(): Promise<SecurityMapData> {
  const user = await requireUser();
  return getSecurityMapForUser(user.id);
}
