import { ContactType, Language, BalanceStatus, BalanceInfo, TransactionType } from '../types';

/**
 * Converts a string or number input representing Taka into safe integer Poisha (1 Taka = 100 Poisha).
 * Handles decimals correctly without floating point inaccuracies.
 * E.g., "500" -> 50000, "120.5" -> 12050, "120.55" -> 12055.
 */
export function takaToPoisha(takaInput: string | number): number {
  if (typeof takaInput === 'number') {
    if (isNaN(takaInput) || takaInput <= 0) return 0;
    takaInput = takaInput.toString();
  }

  const cleaned = takaInput.trim().replace(/,/g, '');
  if (!cleaned || cleaned.startsWith('-')) return 0;

  const parts = cleaned.split('.');
  const wholePart = parseInt(parts[0] || '0', 10);
  if (isNaN(wholePart) || wholePart < 0) return 0;

  let decimalPart = 0;
  if (parts.length > 1) {
    const decStr = (parts[1] + '00').slice(0, 2);
    decimalPart = parseInt(decStr, 10);
    if (isNaN(decimalPart)) decimalPart = 0;
  }

  return wholePart * 100 + decimalPart;
}

/**
 * Converts integer Poisha into Taka string (e.g. 50050 -> "500.50" or "500")
 */
export function poishaToTaka(poisha: number, includeDecimalsIfZero = false): string {
  const isNegative = poisha < 0;
  const absPoisha = Math.abs(poisha);
  const whole = Math.floor(absPoisha / 100);
  const cents = absPoisha % 100;

  let result = whole.toString();
  if (cents > 0 || includeDecimalsIfZero) {
    result += '.' + cents.toString().padStart(2, '0');
  }

  return isNegative ? `-${result}` : result;
}

/**
 * Converts Arabic numerals (0-9) to Bengali numerals (০-৯).
 */
export function toBengaliNumerals(strOrNum: string | number): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return strOrNum
    .toString()
    .replace(/[0-9]/g, (digit) => bengaliDigits[parseInt(digit, 10)] || digit);
}

/**
 * Formats integer poisha with commas (Indian / South Asian grouping or standard) and currency symbol (৳).
 */
export function formatMoney(
  poisha: number,
  lang: Language = 'bn',
  options?: {
    showSign?: boolean;
    includeDecimals?: boolean;
    compact?: boolean;
  }
): string {
  const isNegative = poisha < 0;
  const absPoisha = Math.abs(poisha);
  const whole = Math.floor(absPoisha / 100);
  const cents = absPoisha % 100;

  // South Asian comma formatting: e.g. 1,00,000
  const wholeStr = whole.toString();
  let formattedWhole = wholeStr;
  if (wholeStr.length > 3) {
    const lastThree = wholeStr.substring(wholeStr.length - 3);
    const otherNumbers = wholeStr.substring(0, wholeStr.length - 3);
    formattedWhole = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  let amountStr = formattedWhole;
  if (cents > 0 || options?.includeDecimals) {
    amountStr += '.' + cents.toString().padStart(2, '0');
  }

  if (lang === 'bn') {
    amountStr = toBengaliNumerals(amountStr);
  }

  const sign = options?.showSign ? (isNegative ? '-' : poisha > 0 ? '+' : '') : (isNegative ? '-' : '');
  const symbol = '৳';

  return `${sign}${symbol} ${amountStr}`;
}

/**
 * Interprets balance for Customer and Supplier accounts and provides user-friendly labels.
 *
 * For Customer:
 * - balance > 0: Customer owes user money ("পাবো" / "You will receive")
 * - balance < 0: User owes customer (e.g. advance payment) ("দিতে হবে" / "Advance received")
 * - balance === 0: Settled ("পরিশোধিত" / "Settled")
 *
 * For Supplier:
 * - balance > 0: User owes supplier money ("দিতে হবে" / "You will pay")
 * - balance < 0: Supplier owes user (e.g. advance payment to supplier) ("পাবো" / "Advance given")
 * - balance === 0: Settled ("পরিশোধিত" / "Settled")
 */
export function getBalanceInfo(
  contactType: ContactType,
  balanceInPoisha: number,
  lang: Language = 'bn'
): BalanceInfo {
  const isBn = lang === 'bn';

  if (balanceInPoisha === 0) {
    return {
      status: 'settled',
      label: isBn ? 'পরিশোধিত' : 'Settled',
      subLabel: isBn ? 'কোনো বাকি বা দেনা নেই' : 'No dues pending',
      colorClass: 'text-slate-600',
      bgClass: 'bg-slate-100',
      borderClass: 'border-slate-200',
      textClass: 'text-slate-700',
      amountInPoisha: 0,
    };
  }

  if (contactType === 'customer') {
    if (balanceInPoisha > 0) {
      // Customer owes me -> Receivable (Green/Emerald in Khata apps)
      return {
        status: 'receivable',
        label: isBn ? 'আপনি পাবেন' : 'You will receive',
        subLabel: isBn ? 'কাস্টমারের কাছে বাকি' : 'Customer due',
        colorClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
        textClass: 'text-emerald-800',
        amountInPoisha: balanceInPoisha,
      };
    } else {
      // User owes customer -> Advance
      return {
        status: 'payable',
        label: isBn ? 'দিতে হবে (অগ্রিম)' : 'Advance received',
        subLabel: isBn ? 'কাস্টমারকে ফেরত/সমন্বয়' : 'Advance from customer',
        colorClass: 'text-amber-700',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        textClass: 'text-amber-800',
        amountInPoisha: Math.abs(balanceInPoisha),
      };
    }
  } else {
    // Supplier
    if (balanceInPoisha > 0) {
      // User owes supplier -> Payable (Red/Rose)
      return {
        status: 'payable',
        label: isBn ? 'আপনি দেবেন' : 'You will pay',
        subLabel: isBn ? 'সাপ্লায়ারের কাছে দেনা' : 'Supplier debt',
        colorClass: 'text-rose-700',
        bgClass: 'bg-rose-50',
        borderClass: 'border-rose-200',
        textClass: 'text-rose-800',
        amountInPoisha: balanceInPoisha,
      };
    } else {
      // Supplier owes user -> Advance given
      return {
        status: 'receivable',
        label: isBn ? 'পাবেন (অগ্রিম)' : 'Advance given',
        subLabel: isBn ? 'সাপ্লায়ারের কাছে জমা' : 'Advance to supplier',
        colorClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
        textClass: 'text-emerald-800',
        amountInPoisha: Math.abs(balanceInPoisha),
      };
    }
  }
}

/**
 * Calculates the delta change on a contact's currentBalanceInPoisha.
 *
 * For Customer:
 *   - credit_given: customer owes more (+ delta)
 *   - payment_received: customer paid (- delta)
 *
 * For Supplier:
 *   - purchase_credit: user owes supplier more (+ delta)
 *   - payment_given: user paid supplier (- delta)
 */
export function calculateBalanceDelta(
  contactType: ContactType,
  txType: TransactionType,
  amountInPoisha: number
): number {
  if (contactType === 'customer') {
    if (txType === 'credit_given') {
      return amountInPoisha;
    } else if (txType === 'payment_received') {
      return -amountInPoisha;
    }
  } else {
    // Supplier
    if (txType === 'purchase_credit') {
      return amountInPoisha;
    } else if (txType === 'payment_given') {
      return -amountInPoisha;
    }
  }
  return 0;
}
