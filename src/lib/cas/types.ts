export type TransactionType =
  | "PURCHASE"
  | "PURCHASE_SIP"
  | "REDEMPTION"
  | "SWITCH_IN"
  | "SWITCH_OUT"
  | "DIVIDEND_PAYOUT"
  | "DIVIDEND_REINVEST"
  | "STAMP_DUTY_TAX"
  | "STT_TAX"
  | "TDS_TAX"
  | "REVERSAL"
  | "SEGREGATION"
  | "MISC";

export interface Transaction {
  /** ISO date YYYY-MM-DD */
  date: string;
  description: string;
  /** Rupees. Negative for money leaving the fund (redemption) as printed in the CAS. */
  amount: number | null;
  /** Units added (+) or removed (-) */
  units: number | null;
  nav: number | null;
  /** Unit balance after this transaction */
  balance: number | null;
  type: TransactionType;
}

export interface Valuation {
  date: string | null;
  nav: number | null;
  value: number | null;
  cost: number | null;
}

export interface CASScheme {
  /** RTA product code, e.g. "B205RG" */
  rtaCode: string | null;
  name: string;
  isin: string | null;
  advisor: string | null;
  rta: string | null;
  open: number;
  close: number;
  valuation: Valuation;
  transactions: Transaction[];
}

export interface CASFolio {
  folio: string;
  amc: string;
  pan: string | null;
  kyc: string | null;
  schemes: CASScheme[];
}

export interface CASInvestor {
  name: string | null;
  email: string | null;
  mobile: string | null;
  address: string | null;
}

export interface CASData {
  casType: "DETAILED" | "SUMMARY" | "UNKNOWN";
  statementPeriod: { from: string | null; to: string | null };
  investor: CASInvestor;
  folios: CASFolio[];
  /** Non-fatal parsing issues worth surfacing to developers / users. */
  warnings: string[];
}

export class CASParseError extends Error {
  code: "PASSWORD_REQUIRED" | "INCORRECT_PASSWORD" | "NOT_A_CAS" | "SUMMARY_CAS" | "EMPTY" | "UNKNOWN";
  constructor(code: CASParseError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "CASParseError";
  }
}
