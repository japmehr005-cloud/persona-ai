import type { Metadata } from "next";
import { Network } from "lucide-react";

import { getRelationshipGraph } from "@/services/fin/relationship-graph-service";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RelationshipGraphView } from "@/components/charts/admin-fin-graph";
import { RelationshipGraphMobileList } from "@/features/admin/relationship-graph-mobile-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Relationship graph" };

export default async function RelationshipGraphPage() {
  const graph = await getRelationshipGraph();

  return (
    <PageContainer>
      <PageHeader
        title="Relationship graph"
        description="Users, devices, sessions, locations, recipients, fraud reports, and government intelligence — all connected."
      />

      <Card>
        <CardHeader>
          <CardTitle>Fraud network</CardTitle>
          <CardDescription>
            Built from fraud reports and their linked entities. Select a node to reveal what it&apos;s
            connected to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {graph.nodes.length === 0 ? (
            <EmptyState
              icon={Network}
              title="No relationships to show yet"
              description="The graph populates as customers file fraud reports and FIN links them to devices, sessions, and recipients."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <RelationshipGraphView graph={graph} />
              </div>
              <div className="md:hidden">
                <RelationshipGraphMobileList graph={graph} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
