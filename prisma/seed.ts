import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { runCsvImport } from "@/services/import/run-csv-import";
import { generateDemoStatementCsv } from "@/prisma/seed-data";
import { registerDevice } from "@/services/security/register-device";
import { submitFraudReport, resolveFraudReport } from "@/services/fin/fraud-report-service";
import { recomputeClusters } from "@/services/fin/cluster-engine";
import { checkFriForBeneficiary } from "@/services/government-intelligence/fri-service";

const DEMO_HISTORY_DAYS = 100;

/** Reused across every seeded "victim" device below so the mock IP
 * geolocation provider resolves them to a plausible home city instead of a
 * loopback address, matching what a real browser session would send. */
const HOME_IP = "127.0.0.1";

async function main() {
  const demoPasswordHash = await bcrypt.hash("demo-password", 12);
  const adminPasswordHash = await bcrypt.hash("admin-password", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@securebank.ai" },
    update: { firstName: "Arjun", lastName: "Mehta" },
    create: {
      email: "demo@securebank.ai",
      passwordHash: demoPasswordHash,
      firstName: "Arjun",
      lastName: "Mehta",
      role: "CUSTOMER",
      isDemo: true,
      accounts: {
        create: [
          { name: "Primary Checking", mask: "4821", type: "CHECKING", balance: 124580.75 },
          { name: "Savings", mask: "1190", type: "SAVINGS", balance: 385200.0 },
        ],
      },
    },
  });

  const analystUser = await prisma.user.upsert({
    where: { email: "analyst@securebank.ai" },
    update: {
      firstName: "Priya",
      lastName: "Nair",
      role: "ADMIN",
      passwordHash: adminPasswordHash,
    },
    create: {
      email: "analyst@securebank.ai",
      passwordHash: adminPasswordHash,
      firstName: "Priya",
      lastName: "Nair",
      role: "ADMIN",
      isDemo: false,
    },
  });

  console.log("Seeded demo user:", demoUser.email);

  const checkingAccount = await prisma.account.findFirstOrThrow({
    where: { userId: demoUser.id, type: "CHECKING" },
  });
  const existingTransactionCount = await prisma.transaction.count({
    where: { accountId: checkingAccount.id },
  });

  if (existingTransactionCount === 0) {
    const csvText = generateDemoStatementCsv(new Date(), DEMO_HISTORY_DAYS);
    const result = await runCsvImport({
      userId: demoUser.id,
      accountId: checkingAccount.id,
      filename: "seed-demo-history.csv",
      csvText,
      mapping: { date: "Date", amount: "Amount", description: "Description", category: "Category" },
    });
    console.log(`Seeded ${result.importedCount} demo transactions and calculated the behavioral baseline.`);
  } else {
    console.log("Demo account already has transaction history, skipping synthetic history seed.");
  }

  // -------------------------------------------------------------------------
  // Phase 9 — Fraud Intelligence Network demo data. Four additional customers
  // upserted every run (cheap, idempotent, keeps names in sync); the
  // devices/sessions/fraud-reports/clusters network that connects them to
  // each other (and to Arjun) is only built once, guarded by
  // `existingFraudReportCount`, so re-running seeding never duplicates FIN
  // events or fraud clusters.
  // -------------------------------------------------------------------------
  const networkPasswordHash = await bcrypt.hash("demo-password", 12);
  const networkUserSeeds = [
    { email: "rohan.kapoor@securebank.ai", firstName: "Rohan", lastName: "Kapoor", mask: "5510", balance: 42300 },
    { email: "sana.iyer@securebank.ai", firstName: "Sana", lastName: "Iyer", mask: "5522", balance: 18750 },
    { email: "vikram.singh@securebank.ai", firstName: "Vikram", lastName: "Singh", mask: "5533", balance: 96400 },
    { email: "devika.rao@securebank.ai", firstName: "Devika", lastName: "Rao", mask: "5544", balance: 27650 },
  ] as const;

  const networkUsers = new Map<string, Awaited<ReturnType<typeof prisma.user.upsert>>>();
  for (const seedUser of networkUserSeeds) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: { firstName: seedUser.firstName, lastName: seedUser.lastName },
      create: {
        email: seedUser.email,
        passwordHash: networkPasswordHash,
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        role: "CUSTOMER",
        isDemo: true,
        accounts: {
          create: [{ name: "Primary Checking", mask: seedUser.mask, type: "CHECKING", balance: seedUser.balance }],
        },
      },
    });
    networkUsers.set(seedUser.email, user);
  }
  console.log(`Seeded ${networkUsers.size} Fraud Intelligence Network demo customers.`);

  const existingFraudReportCount = await prisma.fraudReport.count();
  if (existingFraudReportCount > 0) {
    console.log("Fraud Intelligence Network demo network already present, skipping.");
    return;
  }

  console.log("Building Fraud Intelligence Network demo network (devices, sessions, fraud reports, clusters)...");

  const rohan = networkUsers.get("rohan.kapoor@securebank.ai")!;
  const sana = networkUsers.get("sana.iyer@securebank.ai")!;
  const vikram = networkUsers.get("vikram.singh@securebank.ai")!;
  const devika = networkUsers.get("devika.rao@securebank.ai")!;

  // Demo day story for Arjun Mehta (customer map + SOC narrative):
  // Morning Delhi (trusted) → Afternoon Delhi → Evening New Delhi transfer
  // → Night impossible travel on unknown laptop → FRI-flagged beneficiary.
  const DELHI = { latitude: 28.6139, longitude: 77.209, accuracy: 35 };
  const NEW_DELHI = { latitude: 28.6139, longitude: 77.209, accuracy: 40 };
  const now = Date.now();
  const morning = new Date(now - 14 * 60 * 60 * 1000);
  const afternoon = new Date(now - 8 * 60 * 60 * 1000);
  const evening = new Date(now - 4 * 60 * 60 * 1000);
  const night = new Date(now - 90 * 60 * 1000);

  const arjunHomeDeviceInput = {
    userId: demoUser.id,
    fingerprintHash: "seed-arjun-macbook-pro",
    label: "MacBook Pro — Chrome on macOS",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Chrome/124.0",
    ipAddress: HOME_IP,
    platform: "MacIntel",
    language: "en-US",
    timezone: "Asia/Kolkata",
    screenResolution: "1920x1080",
    hardwareConcurrency: 8,
    colorDepth: 24,
    browserLocation: DELHI,
  };
  // Three home registrations cross the auto-trust threshold.
  await registerDevice(arjunHomeDeviceInput);
  await registerDevice(arjunHomeDeviceInput);
  await registerDevice(arjunHomeDeviceInput);

  const arjunHomeDevice = await prisma.device.findFirstOrThrow({
    where: { userId: demoUser.id, fingerprintHash: "seed-arjun-macbook-pro" },
  });

  // Explicit same-day geo timeline (registerDevice reuses one session window).
  await prisma.session.createMany({
    data: [
      {
        userId: demoUser.id,
        deviceId: arjunHomeDevice.id,
        ipAddress: HOME_IP,
        userAgent: arjunHomeDeviceInput.userAgent,
        city: "Delhi",
        region: "Delhi",
        country: "IN",
        latitude: DELHI.latitude,
        longitude: DELHI.longitude,
        accuracy: DELHI.accuracy,
        locationSource: "BROWSER",
        trusted: true,
        isSuspicious: false,
        riskScore: 12,
        riskTier: "LOW",
        authMethod: "PASSWORD_ONLY",
        startedAt: morning,
        lastActiveAt: morning,
      },
      {
        userId: demoUser.id,
        deviceId: arjunHomeDevice.id,
        ipAddress: HOME_IP,
        userAgent: arjunHomeDeviceInput.userAgent,
        city: "Delhi",
        region: "Delhi",
        country: "IN",
        latitude: DELHI.latitude + 0.01,
        longitude: DELHI.longitude + 0.01,
        accuracy: 40,
        locationSource: "BROWSER",
        trusted: true,
        isSuspicious: false,
        riskScore: 18,
        riskTier: "LOW",
        authMethod: "PASSWORD_ONLY",
        startedAt: afternoon,
        lastActiveAt: afternoon,
      },
      {
        userId: demoUser.id,
        deviceId: arjunHomeDevice.id,
        ipAddress: HOME_IP,
        userAgent: arjunHomeDeviceInput.userAgent,
        city: "New Delhi",
        region: "Delhi",
        country: "IN",
        latitude: NEW_DELHI.latitude,
        longitude: NEW_DELHI.longitude + 0.02,
        accuracy: 45,
        locationSource: "BROWSER",
        trusted: true,
        isSuspicious: false,
        riskScore: 28,
        riskTier: "LOW",
        authMethod: "PASSWORD_OTP",
        startedAt: evening,
        lastActiveAt: evening,
      },
    ],
  });

  await prisma.transaction.create({
    data: {
      accountId: checkingAccount.id,
      date: evening,
      amount: -125000,
      merchant: "Offshore Holdings Ltd",
      category: "Transfer",
      beneficiary: "Offshore Holdings Ltd",
      channel: "TRANSFER",
      status: "FLAGGED",
      isSimulated: true,
    },
  });

  // Night: unknown laptop from a distant IP (impossible travel vs Delhi evening).
  // Fingerprint intentionally overlaps the shared fraud kit so FIN links Arjun
  // into the Rohan/Sana mule ring.
  const arjunSuspiciousDevice = await registerDevice({
    userId: demoUser.id,
    fingerprintHash: "seed-shared-fraud-device",
    label: "Unrecognized Windows Laptop — Edge",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edge/124.0",
    ipAddress: "203.0.113.77",
    platform: "Win32",
    language: "en-GB",
    timezone: "Europe/London",
    screenResolution: "1366x768",
    hardwareConcurrency: 4,
    colorDepth: 24,
    browserLocation: { latitude: 51.5074, longitude: -0.1278, accuracy: 80 },
  });
  const arjunSuspiciousSession = await prisma.session.findFirst({
    where: { userId: demoUser.id, deviceId: arjunSuspiciousDevice.id },
    orderBy: { lastActiveAt: "desc" },
  });
  if (arjunSuspiciousSession) {
    await prisma.session.update({
      where: { id: arjunSuspiciousSession.id },
      data: {
        startedAt: night,
        lastActiveAt: night,
        city: "London",
        region: "England",
        country: "GB",
        latitude: 51.5074,
        longitude: -0.1278,
        isSuspicious: true,
        trusted: false,
        riskScore: 92,
        riskTier: "CRITICAL",
      },
    });
  }
  await submitFraudReport({
    reporterUserId: demoUser.id,
    type: "NOT_ME",
    description: "I don't recognize this night sign-in — unfamiliar laptop and London location after Delhi evening activity.",
    deviceId: arjunSuspiciousDevice.id,
    sessionId: arjunSuspiciousSession?.id ?? null,
  });
  await submitFraudReport({
    reporterUserId: demoUser.id,
    type: "SUSPICIOUS_BENEFICIARY",
    description: "Large evening transfer to a payee I do not recognize — please investigate.",
    beneficiary: "Offshore Holdings Ltd",
  });
  await submitFraudReport({
    reporterUserId: demoUser.id,
    type: "SUSPICIOUS_LOGIN",
    description: "Multiple alerts around the same unrecognized device.",
    deviceId: arjunSuspiciousDevice.id,
    sessionId: arjunSuspiciousSession?.id ?? null,
  });

  // A shared "fraud kit" device — identical fingerprint and characteristics —
  // used to open sessions for two otherwise-unrelated victims. This is what
  // lets the cluster engine link Rohan and Sana by device, and (since both
  // name the same mule beneficiary) by recipient too.
  const sharedFraudDeviceInput = {
    fingerprintHash: "seed-shared-fraud-device",
    label: "Android Device — Chrome Mobile",
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/124.0 Mobile",
    ipAddress: "198.51.100.23",
    platform: "Linux armv8l",
    language: "en-IN",
    timezone: "Asia/Kolkata",
    screenResolution: "412x915",
    hardwareConcurrency: 8,
    colorDepth: 24,
  };
  const rohanDevice = await registerDevice({ ...sharedFraudDeviceInput, userId: rohan.id });
  const sanaDevice = await registerDevice({ ...sharedFraudDeviceInput, userId: sana.id });

  const MULE_BENEFICIARY = "Rapid Mule Transfers";
  const sanaMuleTransaction = await prisma.transaction.create({
    data: {
      accountId: (await prisma.account.findFirstOrThrow({ where: { userId: sana.id } })).id,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      amount: -48500,
      merchant: MULE_BENEFICIARY,
      category: "Transfer",
      beneficiary: MULE_BENEFICIARY,
      channel: "TRANSFER",
      status: "FLAGGED",
      isSimulated: true,
    },
  });

  await submitFraudReport({
    reporterUserId: rohan.id,
    type: "SUSPICIOUS_BENEFICIARY",
    description: "I was pressured over a phone call to transfer funds to this recipient.",
    deviceId: rohanDevice.id,
    beneficiary: MULE_BENEFICIARY,
  });
  await submitFraudReport({
    reporterUserId: sana.id,
    type: "SUSPICIOUS_TRANSACTION",
    description: "A transaction to this recipient appeared that I never authorized.",
    deviceId: sanaDevice.id,
    transactionId: sanaMuleTransaction.id,
    beneficiary: MULE_BENEFICIARY,
  });

  // Vikram — legitimate home device, then an unrecognized sign-in from a
  // different foreign location that he reports himself.
  await registerDevice({
    userId: vikram.id,
    fingerprintHash: "seed-vikram-home-pc",
    label: "Windows PC — Chrome",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0",
    ipAddress: HOME_IP,
    platform: "Win32",
    language: "en-IN",
    timezone: "Asia/Kolkata",
    screenResolution: "1536x864",
    hardwareConcurrency: 6,
    colorDepth: 24,
  });
  const vikramSuspiciousDevice = await registerDevice({
    userId: vikram.id,
    fingerprintHash: "seed-vikram-cybercafe",
    label: "Unrecognized Device — Firefox",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Firefox/125.0",
    ipAddress: "192.0.2.44",
    platform: "Linux x86_64",
    language: "en-US",
    timezone: "Europe/London",
    screenResolution: "1280x1024",
    hardwareConcurrency: 2,
    colorDepth: 24,
  });
  const vikramSuspiciousSession = await prisma.session.findFirst({
    where: { userId: vikram.id, deviceId: vikramSuspiciousDevice.id },
    orderBy: { lastActiveAt: "desc" },
  });
  await submitFraudReport({
    reporterUserId: vikram.id,
    type: "NOT_ME",
    description: "This login was not initiated by me.",
    deviceId: vikramSuspiciousDevice.id,
    sessionId: vikramSuspiciousSession?.id ?? null,
  });

  // Devika — reports a suspicious login that an analyst later confirms,
  // demonstrating the full report -> investigation -> resolution lifecycle.
  await registerDevice({
    userId: devika.id,
    fingerprintHash: "seed-devika-macbook-air",
    label: "MacBook Air — Safari",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    ipAddress: HOME_IP,
    platform: "MacIntel",
    language: "en-US",
    timezone: "Asia/Kolkata",
    screenResolution: "1440x900",
    hardwareConcurrency: 8,
    colorDepth: 24,
  });
  const devikaReport = await submitFraudReport({
    reporterUserId: devika.id,
    type: "SUSPICIOUS_LOGIN",
    description: "Received an alert about a login attempt I did not recognize.",
  });
  await resolveFraudReport(
    devikaReport.id,
    analystUser.id,
    "CONFIRMED",
    "Confirmed unauthorized access. Account secured and credentials reset."
  );

  // Warm the government-intelligence cache for the beneficiaries referenced
  // above — the relationship graph reads this cache directly rather than
  // calling the provider live, so seeding it here makes the Government
  // Intelligence nodes visible immediately without any manual demo step.
  await checkFriForBeneficiary(MULE_BENEFICIARY);
  await checkFriForBeneficiary("Offshore Holdings Ltd");

  const clusterResult = await recomputeClusters();
  console.log(
    `Seeded Fraud Intelligence Network demo network. Fraud clusters created: ${clusterResult.clustersCreated}, updated: ${clusterResult.clustersUpdated}.`
  );
  console.log("Demo logins: demo@securebank.ai / demo-password · analyst@securebank.ai / admin-password");
  console.log("Story: Arjun Delhi morning→evening → London night attack → FRI beneficiary → AI Recommendation Center.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
