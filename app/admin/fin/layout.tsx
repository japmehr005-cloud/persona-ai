// Scopes the Fraud Intelligence Network section — including the Security
// Operations Center and its existing analytics/graph/cluster/timeline/
// device sibling pages — to the dark theme tokens already defined in
// globals.css but otherwise unused anywhere in the app. This is what gives
// FIN its Splunk/CrowdStrike-style dark, high-density command-center look
// without touching the rest of the (light) admin console.
export default function FinLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-full bg-background text-foreground">{children}</div>;
}
