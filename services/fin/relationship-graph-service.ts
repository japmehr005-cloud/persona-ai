import { prisma } from "@/lib/prisma";
import { findSimilarDevicesAcrossUsers } from "@/services/fin/device-intelligence";

export type GraphNodeType =
  | "user"
  | "device"
  | "session"
  | "location"
  | "beneficiary"
  | "fraudReport"
  | "fri"
  | "mnrl";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  subtitle?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** Dotted "possible fraud ring" link (e.g. two accounts sharing a
   * device fingerprint) rather than a direct, confirmed relationship. */
  dashed?: boolean;
}

export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const DEFAULT_REPORT_LIMIT = 60;

/** Small helper so the main builder and the expand-on-click path share one
 * consistent add/dedupe strategy without a class or extra module state. */
function createGraphBuilder() {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  return {
    addNode(node: GraphNode) {
      const existing = nodes.get(node.id);
      if (!existing || (node.riskLevel && !existing.riskLevel)) nodes.set(node.id, node);
    },
    addEdge(source: string, target: string, label?: string, dashed?: boolean) {
      const id = `${source}->${target}:${label ?? ""}`;
      const reverseId = `${target}->${source}:${label ?? ""}`;
      if (!edges.has(id) && !edges.has(reverseId)) edges.set(id, { id, source, target, label, dashed });
    },
    hasNode: (id: string) => nodes.has(id),
    result: (): RelationshipGraph => ({ nodes: [...nodes.values()], edges: [...edges.values()] }),
  };
}

/** Adds dotted "similar device" edges between devices that share a
 * platform/timezone/language/screen similarity key across *different*
 * users — the "fraud ring visible without a shared fraud report" signal
 * called for in the FIN spec. Mutates the builder in place. */
async function addDeviceSimilarityEdges(
  builder: ReturnType<typeof createGraphBuilder>,
  devices: { id: string; userId: string; similarityKey: string | null }[]
) {
  for (const device of devices) {
    if (!device.similarityKey) continue;

    const similar = await findSimilarDevicesAcrossUsers(device.userId, device.similarityKey);
    for (const match of similar) {
      const matchDeviceNodeId = `device:${match.id}`;
      const matchUserNodeId = `user:${match.userId}`;

      builder.addNode({
        id: matchDeviceNodeId,
        type: "device",
        label: match.label,
        subtitle: "Shared fingerprint",
        riskLevel: match.trusted ? "MEDIUM" : "HIGH",
      });
      builder.addNode({ id: matchUserNodeId, type: "user", label: match.userLabel });
      builder.addEdge(matchUserNodeId, matchDeviceNodeId, "used");
      builder.addEdge(`device:${device.id}`, matchDeviceNodeId, "similar device", true);
    }
  }
}

/**
 * Builds the Admin SOC relationship graph: Users → Devices → Sessions →
 * Locations → Recipients → Fraud Reports → Government Intelligence (split
 * into FRI/MNRL). Reused (parameterized by `focusUserId`) for every graph
 * "view" the SOC exposes (device graph, user graph, beneficiary graph)
 * rather than maintaining four separate graph builders — selecting a node
 * client-side filters to its neighborhood instead of re-querying, and
 * `expandRelationshipNode` fetches further 1-hop neighbors on demand.
 */
export async function getRelationshipGraph(options?: { focusUserId?: string }): Promise<RelationshipGraph> {
  const reports = await prisma.fraudReport.findMany({
    where: options?.focusUserId
      ? {
          OR: [
            { reporterUserId: options.focusUserId },
            { device: { userId: options.focusUserId } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: DEFAULT_REPORT_LIMIT,
    include: {
      reporter: { select: { firstName: true, lastName: true } },
      device: true,
      session: true,
    },
  });

  const builder = createGraphBuilder();
  const devicesForSimilarity: { id: string; userId: string; similarityKey: string | null }[] = [];

  for (const report of reports) {
    const userNodeId = `user:${report.reporterUserId}`;
    builder.addNode({ id: userNodeId, type: "user", label: `${report.reporter.firstName} ${report.reporter.lastName}` });

    const reportNodeId = `fraudReport:${report.id}`;
    builder.addNode({
      id: reportNodeId,
      type: "fraudReport",
      label: report.type.replaceAll("_", " "),
      subtitle: report.status,
      riskLevel: report.status === "CONFIRMED" ? "CRITICAL" : "MEDIUM",
    });
    builder.addEdge(userNodeId, reportNodeId, "reported");

    if (report.device) {
      const deviceNodeId = `device:${report.device.id}`;
      builder.addNode({
        id: deviceNodeId,
        type: "device",
        label: report.device.label,
        riskLevel: report.device.trusted ? undefined : "HIGH",
      });
      builder.addEdge(userNodeId, deviceNodeId, "used");
      builder.addEdge(reportNodeId, deviceNodeId, "involves");
      devicesForSimilarity.push({
        id: report.device.id,
        userId: report.device.userId,
        similarityKey: report.device.similarityKey,
      });
    }

    if (report.session) {
      const sessionNodeId = `session:${report.session.id}`;
      builder.addNode({
        id: sessionNodeId,
        type: "session",
        label: report.session.city ? `Session · ${report.session.city}` : "Session",
        riskLevel: report.session.isSuspicious ? "HIGH" : undefined,
      });
      builder.addEdge(userNodeId, sessionNodeId, "session");
      if (report.session.city || report.session.country) {
        const locationNodeId = `location:${report.session.city ?? ""}:${report.session.country ?? ""}`;
        builder.addNode({
          id: locationNodeId,
          type: "location",
          label: [report.session.city, report.session.country].filter(Boolean).join(", "),
        });
        builder.addEdge(sessionNodeId, locationNodeId, "from");
      }
      if (report.device) builder.addEdge(`device:${report.device.id}`, sessionNodeId, "opened");
    }

    if (report.beneficiary) {
      const beneficiaryNodeId = `beneficiary:${report.beneficiary.toLowerCase().trim()}`;
      builder.addNode({ id: beneficiaryNodeId, type: "beneficiary", label: report.beneficiary });
      builder.addEdge(userNodeId, beneficiaryNodeId, "sent to");
      builder.addEdge(reportNodeId, beneficiaryNodeId, "involves");
    }
  }

  await addDeviceSimilarityEdges(builder, devicesForSimilarity);

  const graph = builder.result();
  const beneficiaryLabels = graph.nodes.filter((node) => node.type === "beneficiary").map((node) => node.label);

  if (beneficiaryLabels.length > 0) {
    const govHits = await prisma.governmentRiskRecord.findMany({
      where: { subjectType: "BENEFICIARY", subjectValue: { in: beneficiaryLabels }, matched: true },
    });

    for (const hit of govHits) {
      const govNodeId = `${hit.source === "FRI" ? "fri" : "mnrl"}:${hit.id}`;
      builder.addNode({
        id: govNodeId,
        type: hit.source === "FRI" ? "fri" : "mnrl",
        label: `${hit.source} match`,
        subtitle: hit.riskLevel,
        riskLevel: "CRITICAL",
      });
      builder.addEdge(`beneficiary:${hit.subjectValue.toLowerCase().trim()}`, govNodeId, "flagged by");
    }
  }

  return builder.result();
}

/**
 * Click-to-expand: fetches 1-hop neighbors of a node that the initial
 * fraud-report-seeded graph doesn't already include (e.g. a user's other
 * devices/sessions that never triggered a report), merged client-side into
 * the existing graph state. Returns a small delta graph rather than the
 * full graph so repeated expansion stays cheap.
 */
export async function expandRelationshipNode(nodeId: string, nodeType: GraphNodeType): Promise<RelationshipGraph> {
  const builder = createGraphBuilder();
  const rawId = nodeId.slice(nodeId.indexOf(":") + 1);

  if (nodeType === "user") {
    const devices = await prisma.device.findMany({
      where: { userId: rawId },
      orderBy: { lastSeenAt: "desc" },
      take: 8,
    });
    for (const device of devices) {
      const deviceNodeId = `device:${device.id}`;
      builder.addNode({ id: deviceNodeId, type: "device", label: device.label, riskLevel: device.trusted ? undefined : "MEDIUM" });
      builder.addEdge(nodeId, deviceNodeId, "used");
    }
  }

  if (nodeType === "device") {
    const [device, sessions] = await Promise.all([
      prisma.device.findUnique({ where: { id: rawId }, include: { user: { select: { firstName: true, lastName: true } } } }),
      prisma.session.findMany({ where: { deviceId: rawId }, orderBy: { startedAt: "desc" }, take: 8 }),
    ]);

    if (device) {
      const userNodeId = `user:${device.userId}`;
      builder.addNode({ id: userNodeId, type: "user", label: `${device.user.firstName} ${device.user.lastName}` });
      builder.addEdge(userNodeId, nodeId, "used");
    }

    for (const session of sessions) {
      const sessionNodeId = `session:${session.id}`;
      builder.addNode({
        id: sessionNodeId,
        type: "session",
        label: session.city ? `Session · ${session.city}` : "Session",
        riskLevel: session.isSuspicious ? "HIGH" : undefined,
      });
      builder.addEdge(nodeId, sessionNodeId, "opened");

      if (session.city || session.country) {
        const locationNodeId = `location:${session.city ?? ""}:${session.country ?? ""}`;
        builder.addNode({ id: locationNodeId, type: "location", label: [session.city, session.country].filter(Boolean).join(", ") });
        builder.addEdge(sessionNodeId, locationNodeId, "from");
      }
    }
  }

  if (nodeType === "session") {
    const session = await prisma.session.findUnique({
      where: { id: rawId },
      include: { device: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (session) {
      const userNodeId = `user:${session.userId}`;
      builder.addNode({ id: userNodeId, type: "user", label: `${session.user.firstName} ${session.user.lastName}` });
      builder.addEdge(userNodeId, nodeId, "session");

      if (session.device) {
        const deviceNodeId = `device:${session.device.id}`;
        builder.addNode({ id: deviceNodeId, type: "device", label: session.device.label, riskLevel: session.device.trusted ? undefined : "MEDIUM" });
        builder.addEdge(deviceNodeId, nodeId, "opened");
      }
    }
  }

  if (nodeType === "beneficiary") {
    const reports = await prisma.fraudReport.findMany({
      where: { beneficiary: { equals: rawId, mode: "insensitive" } },
      include: { reporter: { select: { firstName: true, lastName: true } } },
      take: 10,
      orderBy: { createdAt: "desc" },
    });
    for (const report of reports) {
      const userNodeId = `user:${report.reporterUserId}`;
      const reportNodeId = `fraudReport:${report.id}`;
      builder.addNode({ id: userNodeId, type: "user", label: `${report.reporter.firstName} ${report.reporter.lastName}` });
      builder.addNode({
        id: reportNodeId,
        type: "fraudReport",
        label: report.type.replaceAll("_", " "),
        subtitle: report.status,
        riskLevel: report.status === "CONFIRMED" ? "CRITICAL" : "MEDIUM",
      });
      builder.addEdge(userNodeId, reportNodeId, "reported");
      builder.addEdge(reportNodeId, nodeId, "involves");
    }
  }

  if (nodeType === "fraudReport") {
    const report = await prisma.fraudReport.findUnique({ where: { id: rawId } });
    if (report) {
      const relatedWhere = [
        report.deviceId ? { deviceId: report.deviceId } : undefined,
        report.beneficiary ? { beneficiary: report.beneficiary } : undefined,
      ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause));

      const relatedReports =
        relatedWhere.length > 0
          ? await prisma.fraudReport.findMany({
              where: { id: { not: report.id }, OR: relatedWhere },
              include: { reporter: { select: { firstName: true, lastName: true } } },
              orderBy: { createdAt: "desc" },
              take: 8,
            })
          : [];

      for (const otherReport of relatedReports) {
        const otherReportNodeId = `fraudReport:${otherReport.id}`;
        const otherUserNodeId = `user:${otherReport.reporterUserId}`;
        const sameDevice = otherReport.deviceId && otherReport.deviceId === report.deviceId;

        builder.addNode({
          id: otherReportNodeId,
          type: "fraudReport",
          label: otherReport.type.replaceAll("_", " "),
          subtitle: otherReport.status,
          riskLevel: otherReport.status === "CONFIRMED" ? "CRITICAL" : "MEDIUM",
        });
        builder.addNode({
          id: otherUserNodeId,
          type: "user",
          label: `${otherReport.reporter.firstName} ${otherReport.reporter.lastName}`,
        });
        builder.addEdge(otherUserNodeId, otherReportNodeId, "reported");
        builder.addEdge(nodeId, otherReportNodeId, sameDevice ? "same device" : "same recipient", true);
      }
    }
  }

  return builder.result();
}
