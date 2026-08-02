import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const en = JSON.parse(fs.readFileSync(path.join(root, "messages", "en.json"), "utf8"));

/** @type {typeof en} */
const pa = structuredClone(en);

Object.assign(pa.common, {
  appName: "Persona AI",
  loading: "Load ho riha hai…",
  saving: "Save ho riha hai…",
  save: "Save karo",
  cancel: "Radd karo",
  close: "Band karo",
  more: "Hor",
  moreActions: "Hor karvaian",
  continue: "Jaari rakho",
  back: "Pichhe",
  next: "Agge",
  search: "Khojo",
  viewAll: "Sabh vekho",
  viewDetails: "Vereve vekho",
  showDetails: "Vereve dikhao",
  hideDetails: "Vereve lukao",
  enable: "Chalu karo",
  notNow: "Hun nahi",
  retry: "Phir koshish karo",
  confirm: "Pushti karo",
  delete: "Mitao",
  edit: "Sodho",
  submit: "Jama karo",
  send: "Bhejo",
  openNavigation: "Navigation kholo",
  signOut: "Sign out",
  account: "Khata",
  settings: "Settings",
  notifications: "Suchnavan",
  noResults: "Koi natija nahi milia",
  errorGeneric: "Kujh galat ho gia. Kirpa karke phir koshish karo.",
  successSaved: "Safalta nal save hoia.",
  required: "Lorinda",
  optional: "Vikalpik",
  yes: "Haan",
  no: "Nahi",
  unknown: "Anjaan",
  current: "Maujuda",
  trusted: "Bharoseyog",
  notTrusted: "Abharoseyog",
  risk: "Khatra",
  amount: "Rakam",
  date: "Tarikh",
  status: "Sthiti",
  actions: "Karvaian",
  language: "Bhasha",
  english: "English",
  hindi: "Hindi",
  punjabi: "Punjabi",
});

Object.assign(pa.nav, {
  dashboard: "Dashboard",
  assistant: "Persona AI",
  transactions: "Len-den",
  security: "Surakhia",
  behavior: "Vyavhar profile",
  devices: "Devices ate sessions",
  securityMap: "Surakhia naksha",
  locations: "Bharoseyog sthan",
  events: "Surakhia ghatnavan",
  alerts: "Alerts",
  settings: "Settings",
  contextSimulator: "Context simulator",
  yourSecurityHome: "Tuhada surakhia home",
  accessibilitySettings: "Pahunchyogta settings",
});

Object.assign(pa.auth, {
  loginTitle: "Sign in",
  loginDescription: "Apne Persona AI banking surakhia khate vich dakhal hovo.",
  email: "Email",
  password: "Password",
  signIn: "Sign in",
  signingIn: "Sign in ho riha hai…",
  noAccount: "Khata nahi hai?",
  createAccount: "Khata banao",
  haveAccount: "Pahilan ton khata hai?",
  registerTitle: "Apna khata banao",
  registerDescription: "Apni banking gatividhi di surakhia lai Persona AI set karo.",
  firstName: "Pahila naam",
  lastName: "Aakhri naam",
  confirmPassword: "Password di pushti karo",
  register: "Register",
  registering: "Khata ban riha hai…",
  demoEntry: "Demo khata azmao",
  demoDescription: "Pahilan ton bhare demo gahak nal Persona AI vekho.",
  verifyOtpTitle: "Pushti code darj karo",
  verifyOtpDescription: "Sign in pura karan lai bhejia one-time code darj karo.",
  verify2faTitle: "Authenticator code",
  verify2faDescription: "Apni authenticator app ton 6 ankan da code darj karo.",
  verifyWebauthnTitle: "Biometrics nal pushti karo",
  verifyWebauthnDescription: "Jaari rakhani lai fingerprint, chehra ya security key vartao.",
  invalidCredentials: "Galat email ya password.",
  otpInvalid: "Oh code galat hai ya miad khatam ho gai hai.",
  passwordMismatch: "Password mel nahi khande.",
  emailRequired: "Email lorindi hai.",
  passwordRequired: "Password lorinda hai.",
  passwordMin: "Password ghatt-ton-ghatt 8 akhran da hona chahida hai.",
});

Object.assign(pa.dashboard, {
  title: "Sat sri akal, {name}",
  titleFallback: "tusi",
  description: "Eh tuhade khate da sankhep hai.",
  totalBalance: "Kul bakaya",
  monthlySpending: "Mahinavar kharch",
  securityStatus: "Surakhia sthiti",
  recentTransactions: "Halia len-den",
  alerts: "Alerts",
  spendingTrend: "Kharch di rujhan",
  categories: "Shrenian",
  behavior: "Vyavhar snapshot",
  importStatements: "Statement ayat karo",
  simulatePayment: "Bhugtan simulate karo",
  noTransactionsTitle: "Hale koi len-den nahi",
  noTransactionsDescription:
    "Apni gatividhi vekhan ate Persona AI nu tuhada vyavhar sikhan den lai bank statement ayat karo.",
  noAlertsTitle: "Koi khulla alert nahi",
  noAlertsDescription: "Sabh theek hai. Je dhian di lor hovegi tan asin suchit karange.",
  accountMask: "Khata ···· {mask}",
  vsLastMonth: "Pichhle mahine ton {value}%",
});

Object.assign(pa.transactions, {
  title: "Len-den",
  description: "Apna bhugtan itihas vekho ate khojo.",
  import: "Statement ayat karo",
  searchMerchants: "Vapari khojo…",
  filterCategory: "Shreni nal filter karo",
  fromDate: "Ton tarikh",
  toDate: "Tak tarikh",
  allCategories: "Sarian shrenian",
  merchant: "Vapari",
  category: "Shreni",
  emptyTitle: "Koi len-den nahi milia",
  emptyDescription: "Filter badlo ya statement ayat karo.",
  importTitle: "Statement ayat karo",
  importDescription: "Vishleshan lai CSV ya PDF bank statement upload karo.",
  detailTitle: "Len-den vereve",
  riskBreakdown: "Khatre da vereva",
  simulateTitle: "Bhugtan simulate karo",
  simulateDescription: "Adaptive Risk Engine rahi demo bhugtan chalao.",
});

Object.assign(pa.alerts, {
  title: "Alerts",
  description: "Surakhia ate khatre dian suchnavan jinhan vall dhian chahida hai.",
  emptyTitle: "Koi alert nahi",
  emptyDescription: "Is vele dikhaun lai koi alert nahi hai.",
  acknowledge: "Svikar karo",
  markResolved: "Hal hoia chinhit karo",
  resolved: "Hal ho gia",
  acknowledged: "Alert svikar kita gia.",
  markedResolved: "Alert hal hoia chinhit kita gia.",
  viewAlert: "Alert vereva vekho",
  riskBreakdown: "Khatre da vereva",
  severity: { LOW: "Ghatt", MEDIUM: "Madham", HIGH: "Uch" },
  status: { OPEN: "Khulla", ACKNOWLEDGED: "Svikarit", RESOLVED: "Hal" },
});

Object.assign(pa.security, {
  mapTitle: "Surakhia naksha",
  mapDescription: "Vekho tusi kitthe ate kiven sign in hoe. Verevian lai marker te tap karo.",
  reportSuspiciousLogin: "Shakki login report karo",
  timeline: "Timeline",
  details: "Vereve",
  openIntel: "Intelligence panel kholo",
  currentLogin: "Maujuda login",
  suspiciousLogin: "Shakki login",
  trustedLogin: "Bharoseyog login",
  previousLogin: "Pichhla login",
  impossible: "Asambhav",
  currentSession: "Maujuda session",
  aiExplanation: "AI viakhia",
  location: "Sthan",
  browser: "Browser",
  operatingSystem: "Operating system",
  authentication: "Pramanikaran",
  deviceFingerprint: "Device fingerprint",
  phoneIdentity: "Phone pehchan code",
  trustDevice: "Is device te bharosa karo",
  deviceTrusted: "Device bharoseyog",
  deviceNotTrusted: "Device abharoseyog",
  locationTrusted: "Sthan bharoseyog",
  locationNotTrusted: "Sthan abharoseyog",
  thisWasntMe: "Eh main nahi si",
  behaviorTitle: "Vyavhar profile",
  behaviorDescription: "Persona AI tuhade aam banking pattern nu kiven samajhda hai.",
  devicesTitle: "Devices ate sessions",
  devicesDescription: "Bharoseyog devices ate sargarm sessions prabandhit karo.",
  locationsTitle: "Bharoseyog sthan",
  locationsDescription: "Oh thavan jitthon tusi niyamit taur te sign in karde ho.",
  eventsTitle: "Surakhia ghatnavan",
  eventsDescription: "Tuhade khate te surakhia gatividhi di timeline.",
});

Object.assign(pa.assistant, {
  title: "Persona AI",
  description: "Khatre, kharch, login ate agle kadam bare puchho.",
  placeholder: "Persona AI ton puchho…",
  sendMessage: "Suneha bhejo",
  openVoice: "Voice assistant kholo",
  voice: "Awaz",
  newConversation: "Navi galbat",
  conversations: "Galbatan",
  thinking: "Persona AI soch riha hai…",
  errorRespond: "Persona AI jawab nahi de sakia. Kirpa karke phir koshish karo.",
  voiceListening: "Sun riha hai…",
  voiceSpeak: "Apna sawal bolo",
  voiceSend: "Bhejo",
  voiceCancel: "Radd karo",
  voiceReplay: "Dubara suno",
  voiceMute: "Mute",
  voiceStop: "Bolna band karo",
  quickActions: "Tez karvaian",
  prompts: {
    fraudScore: "Mera dhokhadhari score samjhao",
    todayActivity: "Ajj di gatividhi da saar dio",
    analyzeSpending: "Mere kharch da vishleshan karo",
    findSubscriptions: "Subscriptions labho",
    unusualExpenses: "Asadharan kharch dikhao",
    trustLogin: "Ki mainu apne naveentam login te bharosa karna chahida hai?",
    compareMonth: "Pichhle mahine nal tulna karo",
    predictMonthEnd: "Mahine de ant da kharch anumanit karo",
    save5000: "Is mahine main ₹5,000 kiven bacha sakda haan?",
    reviewAlerts: "Halia alerts vekho",
    analyzeCategories: "Len-den shrenian da vishleshan karo",
    suspiciousTx: "Shakki len-den dikhao",
    compareThisMonth: "Is mahine di pichhle mahine nal tulna karo",
    expensiveSubscriptions: "Kihrian subscriptions mahingian han?",
  },
  chips: {
    fraudRisk: "Dhokhadhari khatra",
    spending: "Kharch",
    budget: "Budget",
    savings: "Bachat",
    subscriptions: "Subscriptions",
    security: "Surakhia",
    recentLogin: "Halia login",
    unusual: "Asadharan",
  },
});

Object.assign(pa.settings, {
  title: "Settings",
  description:
    "Apni profile, surakhia tarjihan, ate Adaptive Risk Engine tuhade len-den da mulankan kiven karda hai, prabandhit karo.",
  tabs: {
    profile: "Profile",
    security: "Surakhia",
    accessibility: "Pahunchyogta",
    riskEngine: "Risk Engine",
    accounts: "Jude khate",
    sessions: "Sessions",
    developer: "Developer",
  },
  profileTitle: "Profile",
  profileDescription: "Apne niji vereve update karo.",
  securityTitle: "Surakhia",
  securityUpdated: "Surakhia tarjihan update hoian.",
  accessibilityUpdated: "Pahunchyogta tarjihan update hoian.",
  accessibilitySaveError: "Pahunchyogta tarjihan save nahi ho sakian.",
  organization: "Sanstha",
  phone: "Phone",
});

Object.assign(pa.accessibility, {
  seniorModeTitle: "Senior Mode",
  seniorModeDescription:
    "Vadda text, vadhere contrast, voice sahaita ate ghatt dujian controls nal saral, padhan vich aasan banking anubhav. Pahili var sign in te vi eh vikalp dikh sakda hai.",
  enableSeniorMode: "Senior Mode chalu karo",
  turnOn: "Senior Mode chalu karo",
  turnOff: "Senior Mode band karo",
  displayTitle: "Display",
  displayDescription: "Text aakar, contrast ate gati apni pasand anusar adjust karo.",
  largeText: "Vadda text",
  largeTextDescription: "Mobile te ghatt-ton-ghatt 18px ate desktop te 18–20px body text vadhao.",
  highContrast: "Uch contrast",
  highContrastDescription: "Majboot text, border, badge ate button contrast. Sirf rang te nirbhar na raho.",
  reducedMotion: "Ghatt gati",
  reducedMotionDescription: "App vich animation ate transition ghatao.",
  voiceLanguageTitle: "Awaz ate bhasha",
  voiceLanguageDescription: "Voice sahaita, Persona AI jawab, ate poori gahak interface bhasha.",
  voiceResponses: "Awazi jawab",
  voiceResponsesDescription: "Persona AI de jawab apne aap ucchi awaz vich padho.",
  language: "Bhasha",
  chooseLanguage: "Bhasha chuno",
  onboardingTitle: "Persona AI vich ji ayan nu",
  onboardingDescription: "Sanu lagda hai ki sadian pahunchyogta suvidhavan tuhade lai labhdaiyak ho sakdian han.",
  onboardingQuestion: "Senior Mode chalu karo?",
  benefitLargeText: "Vadda text",
  benefitContrast: "Vadhere contrast",
  benefitVoice: "Voice sahaita",
  benefitSimplified: "Saral interface",
  onboardingHint: "Tusi is nu baad vich Settings → Pahunchyogta vich chalu kar sakde ho.",
  seniorEnabledToast: "Senior Mode chalu hai. Tusi is nu kade vi Settings vich badal sakde ho.",
});

Object.assign(pa.notifications, {
  title: "Suchnavan",
  empty: "Koi navi suchna nahi",
  viewAllAlerts: "Sare alerts vekho",
});

Object.assign(pa.userMenu, {
  settings: "Settings",
  customerView: "Gahak drish",
  signOut: "Sign out",
});

Object.assign(pa.validation, {
  required: "Eh khettar lorinda hai.",
  invalidEmail: "Vaidh email pata darj karo.",
  invalidPhone: "Vaidh phone number darj karo.",
  minLength: "Ghatt-ton-ghatt {min} akhar hone chahide han.",
  maxLength: "Vadh ton vadh {max} akhar hone chahide han.",
});

// Prefer proper Gurmukhi from Hindi where we can map closely for key UX surfaces.
// Load Gurmukhi overlay written as unicode escapes to avoid shell encoding issues.
const gurmukhi = {
  common: {
    appName: "\u0A2A\u0A30\u0A38\u0A4B\u0A28\u0A3E AI",
    loading: "\u0A32\u0A4B\u0A21 \u0A39\u0A4B \u0A30\u0A3F\u0A39\u0A3E \u0A39\u0A48\u2026",
    save: "\u0A38\u0A47\u0A35 \u0A15\u0A30\u0A4B",
    cancel: "\u0A30\u0A71\u0A26 \u0A15\u0A30\u0A4B",
    more: "\u0A39\u0A4B\u0A30",
    search: "\u0A16\u0A4B\u0A1C\u0A4B",
    enable: "\u0A1A\u0A3E\u0A32\u0A42 \u0A15\u0A30\u0A4B",
    notNow: "\u0A39\u0A41\u0A23 \u0A28\u0A39\u0A40\u0A02",
    language: "\u0A2D\u0A3E\u0A38\u0A3C\u0A3E",
    hindi: "\u0A39\u0A3F\u0A70\u0A26\u0A40",
    punjabi: "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40",
    english: "\u0A05\u0A70\u0A17\u0A30\u0A47\u0A1C\u0A3C\u0A40",
    settings: "\u0A38\u0A48\u0A1F\u0A3F\u0A70\u0A17\u0A3E\u0A02",
    notifications: "\u0A38\u0A42\u0A1A\u0A28\u0A3E\u0A35\u0A3E\u0A02",
  },
  nav: {
    dashboard: "\u0A21\u0A48\u0A38\u0A3C\u0A2C\u0A4B\u0A30\u0A21",
    assistant: "\u0A2A\u0A30\u0A38\u0A4B\u0A28\u0A3E AI",
    transactions: "\u0A32\u0A48\u0A23-\u0A26\u0A47\u0A23",
    security: "\u0A38\u0A41\u0A30\u0A71\u0A16\u0A3F\u0A06",
    securityMap: "\u0A38\u0A41\u0A30\u0A71\u0A16\u0A3F\u0A06 \u0A28\u0A15\u0A38\u0A3C\u0A3E",
    alerts: "\u0A05\u0A32\u0A30\u0A1F",
    settings: "\u0A38\u0A48\u0A1F\u0A3F\u0A70\u0A17\u0A3E\u0A02",
  },
  accessibility: {
    seniorModeTitle: "\u0A38\u0A40\u0A28\u0A40\u0A05\u0A30 \u0A2E\u0A4B\u0A21",
    language: "\u0A2D\u0A3E\u0A38\u0A3C\u0A3E",
    chooseLanguage: "\u0A2D\u0A3E\u0A38\u0A3C\u0A3E \u0A1A\u0A41\u0A23\u0A4B",
    enableSeniorMode: "\u0A38\u0A40\u0A28\u0A40\u0A05\u0A30 \u0A2E\u0A4B\u0A21 \u0A1A\u0A3E\u0A32\u0A42 \u0A15\u0A30\u0A4B",
    onboardingTitle: "\u0A2A\u0A30\u0A38\u0A4B\u0A28\u0A3E AI \u0A35\u0A3F\u0A71\u0A1A \u0A1C\u0A40 \u0A06\u0A07\u0A06\u0A02 \u0A28\u0A42\u0A70",
    onboardingQuestion: "\u0A38\u0A40\u0A28\u0A40\u0A05\u0A30 \u0A2E\u0A4B\u0A21 \u0A1A\u0A3E\u0A32\u0A42 \u0A15\u0A30\u0A4B?",
  },
};

function deepAssign(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] ??= {};
      deepAssign(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

deepAssign(pa, gurmukhi);

fs.writeFileSync(path.join(root, "messages", "pa.json"), JSON.stringify(pa, null, 2) + "\n", "utf8");
console.log("Wrote messages/pa.json");
