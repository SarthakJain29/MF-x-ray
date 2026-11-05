export interface LearnCard {
  id: string;
  emoji: string;
  title: string;
  minutes: number;
  body: string[];
  tag: "Basics" | "Costs" | "Returns" | "Risk" | "Your CAS";
}

export const LEARN_CARDS: LearnCard[] = [
  {
    id: "what-is-mf", emoji: "🧺", tag: "Basics", minutes: 1, title: "What is a mutual fund, really?",
    body: [
      "Many people pool their money. A professional manager buys shares, bonds or both with it. You own “units” of that pool.",
      "When the things inside the pool rise in value, the price of each unit (NAV) rises too.",
      "You can usually sell units any working day and get money in 1–3 days (ELSS funds have a 3-year lock-in).",
    ],
  },
  {
    id: "xirr", emoji: "📐", tag: "Returns", minutes: 2, title: "Why XIRR, not “total return”?",
    body: [
      "If you invested ₹1 lakh 5 years ago and ₹1 lakh last month, your total return mixes very different holding periods.",
      "XIRR treats every instalment fairly by asking: what single yearly rate would turn all my investments, on their actual dates, into today's value?",
      "It's the fairest way to describe what already happened. It says nothing about what will happen next.",
    ],
  },
  {
    id: "ter", emoji: "🧾", tag: "Costs", minutes: 2, title: "The fee you never see",
    body: [
      "Funds charge an annual expense ratio (TER), deducted from the NAV every day. You never get a bill.",
      "₹10 lakh at a 1.5% TER costs about ₹15,000 this year — and because fees compound, the gap widens every year.",
      "Index funds often have TERs under 0.3%. Actively managed funds charge more for the manager's stock-picking.",
    ],
  },
  {
    id: "direct", emoji: "🔀", tag: "Costs", minutes: 2, title: "Direct vs regular: same fund, different price",
    body: [
      "Each fund has a regular plan (sold via distributors, includes commission) and a direct plan (bought directly, no commission).",
      "The portfolio is identical. Only the fee differs — typically 0.5% to 1.5% a year.",
      "Switching plans counts as selling and buying, which may have tax and exit-load consequences. Learn about those before acting, or talk to a SEBI-registered adviser.",
    ],
  },
  {
    id: "overlap", emoji: "🧩", tag: "Risk", minutes: 1, title: "Five funds ≠ five times the diversification",
    body: [
      "Two large-cap funds will both likely own HDFC Bank, ICICI Bank and Reliance.",
      "Overlap measures how much of two portfolios is the same. High overlap means your “different” funds behave alike.",
      "Look-through exposure adds up how much of each company you own across all funds.",
    ],
  },
  {
    id: "volatility", emoji: "🎢", tag: "Risk", minutes: 2, title: "Ups and downs are normal",
    body: [
      "Equity funds can fall 20–40% in a bad year and still do well over a decade. Debt funds move much less.",
      "That's why the money you need soon is usually kept away from equity, and long-term money can ride the swings.",
      "Your portfolio's past path is a reminder of what volatility feels like — not a forecast.",
    ],
  },
  {
    id: "sip", emoji: "🗓️", tag: "Basics", minutes: 1, title: "SIPs: investing on autopilot",
    body: [
      "A SIP invests a fixed amount every month. When NAV is low you get more units; when it's high, fewer.",
      "It removes the urge to time the market and builds a habit.",
      "A SIP isn't a product — it's just a way of paying into a fund.",
    ],
  },
  {
    id: "cas", emoji: "📄", tag: "Your CAS", minutes: 1, title: "Getting your CAS in 2 minutes",
    body: [
      "Go to camsonline.com → Investors → Statements → CAS – CAMS+KFintech (or the same at kfintech.com).",
      "Choose “Detailed”, period “Specific period” from your first investment (or “Since inception”), and set a password.",
      "The PDF arrives by email in minutes. MF X-ray reads it inside your browser — the file never leaves your device.",
    ],
  },
  {
    id: "goals", emoji: "🎯", tag: "Basics", minutes: 2, title: "Goals make numbers meaningful",
    body: [
      "“₹14 lakh” means more as “72% of my home down-payment”.",
      "Goal maths needs a growth rate. We never guess one for you — you pick it, and we show what happens under that assumption.",
      "Try a few assumptions (say 4%, 8%, 12%) to see how sensitive the plan is.",
    ],
  },
  {
    id: "tax", emoji: "🧮", tag: "Returns", minutes: 2, title: "How fund gains are taxed",
    body: [
      "Tax is due only when you sell (or switch). Each unit is judged by how long you held it — the oldest units are treated as sold first (FIFO).",
      "Equity funds: held over 12 months → long-term, 12.5% on gains above ₹1.25 lakh a year; otherwise 20%. Debt funds bought since April 2023: taxed at your slab rate, however long you hold.",
      "MF X-ray's Tax tab estimates this from your statement. It's a guide — your fund house's capital-gains statement and a tax professional have the final word.",
    ],
  },
  {
    id: "advice", emoji: "🛡️", tag: "Basics", minutes: 1, title: "Facts vs advice",
    body: [
      "MF X-ray explains what's in your portfolio. It doesn't tell you what to buy or sell.",
      "For personal advice, look for a SEBI-registered investment adviser (RIA) — they're paid a fee by you, not commissions.",
      "Verify any registration at sebi.gov.in.",
    ],
  },
];
