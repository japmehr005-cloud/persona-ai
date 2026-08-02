import type { Metadata } from "next";
import { format } from "date-fns";
import { MapPin } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getTrustedLocationsForUser } from "@/services/geolocation/resolve-session-location";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MarkLocationTrustedButton } from "@/features/fin/mark-location-trusted-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Trusted locations" };

export default async function TrustedLocationsPage() {
  const user = await requireUser();
  const locations = await getTrustedLocationsForUser(user.id);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader
        title="Trusted locations"
        description="Places we've seen you sign in from. Trusted locations reduce how often we ask for extra verification."
      />

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>
            A location becomes trusted automatically after a few sign-ins, or you can trust it right away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No locations recorded yet"
              description="Locations are learned automatically from your sign-in activity."
            />
          ) : (
            <ul className="divide-y divide-border">
              {locations.map((location) => (
                <li
                  key={location.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <MapPin className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {[location.city, location.region, location.country].filter(Boolean).join(", ") ||
                          "Unknown location"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Seen {location.useCount} time{location.useCount === 1 ? "" : "s"} · Last{" "}
                        {format(location.lastSeenAt, "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={location.trusted ? "success" : "warning"}>
                      {location.trusted ? "Trusted" : "Not yet trusted"}
                    </Badge>
                    {!location.trusted && <MarkLocationTrustedButton locationId={location.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
