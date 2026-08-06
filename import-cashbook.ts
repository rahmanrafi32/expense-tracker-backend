import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import csv from 'csv-parser';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { PrismaClient } from '@prisma/client';

import fs from 'fs';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const CSV_FILE_PATH = './My_Salary_Expense_06-08-2026_19-25-05@CashBook.csv';

const TARGET_BOOK_ID: string = 'e02e03d2-61b9-444d-801c-4262c31e2375';
const USER_ID = 'c30dcc3f-58e5-4640-ae65-3e1b90a38bdb';

const SOURCE_TIMEZONE = 'Asia/Dhaka';

const BATCH_SIZE = 100;
const DRY_RUN = false;
const ALLOW_IMPORT_INTO_NON_EMPTY_BOOK = false;

const FALLBACK_EXPENSE_CATEGORY_NAME = 'Miscellaneous';
const FALLBACK_INCOME_CATEGORY_NAME = 'Other Income';
const FALLBACK_PAYMENT_METHOD_NAME = 'Bank Transfer';

const LARGE_DATASET_WARNING_ROWS = 5_000;
const MAX_SINGLE_TRANSACTION_ROWS = 20_000;

const TRANSACTION_BASE_TIMEOUT_MS = 30_000;
const TRANSACTION_TIMEOUT_PER_ROW_MS = 15;
const MIN_TRANSACTION_TIMEOUT_MS = 60_000;
const MAX_TRANSACTION_TIMEOUT_MS = 10 * 60_000;
const TRANSACTION_MAX_WAIT_MS = 15_000;

const MAX_DISPLAYED_PARSE_ERRORS = 100;

const FLOAT_EPSILON = 1e-9;

/* ──────────────────────────────────────────────────────────────
 * Category keyword map
 * ────────────────────────────────────────────────────────────── */

const EXPENSE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': [
    'food',
    'dining',
    'lunch',
    'dinner',
    'breakfast',
    'meal',
    'restaurant',
    'cafe',
    'tea',
    'coffee',
    'snack',
    'biryani',
    'khichuri',
    'biriani',
    'kacchi',
    'pizza',
    'burger',
    'canteen',
    'mess',
    'cook',
    'khabar',
    'tiffin',
    'iftar',
    'sehri',
    'nasta',
    'roll',
    'chop',
    'singara',
    'samosa',
    'pitha',
    'mishti',
    'sweet',
    'dessert',
    'ice cream',
    'juice',
    'cold drink',
    'mineral water',
    'water bottle',
    'eating',
    'eat',
    'khawa',
  ],
  Transportation: [
    'transport',
    'bus',
    'train',
    'rickshaw',
    'uber',
    'pathao',
    'taxi',
    'cab',
    'fare',
    'cng',
    'auto',
    'metro',
    'rail',
    'flight',
    'ticket',
    'commute',
    'petrol',
    'fuel',
    'parking',
    'journey',
    'ride',
    'bike',
    'motorcycle',
    'launch',
    'toll',
    'station',
    'airport',
    'travel',
    'jatra',
  ],
  Rent: [
    'house rent',
    'flat rent',
    'room rent',
    'accommodation',
    'landlord',
    'bhadha',
  ],
  Utilities: [
    'electricity',
    'water bill',
    'gas bill',
    'wasa',
    'desco',
    'dpdc',
    'titas',
    'utility',
    'bpdb',
  ],
  'Mobile & Internet': [
    'mobile bill',
    'internet',
    'wifi',
    'broadband',
    'gp',
    'robi',
    'banglalink',
    'teletalk',
    'airtel',
    'recharge',
    'data pack',
    'sim',
    'router',
    'modem',
    'ftth',
    'mbill',
  ],
  Groceries: [
    'grocery',
    'groceries',
    'market',
    'super shop',
    'kitchen market',
    'cooking oil',
    'spice',
    'flour',
    'sugar',
    'salt',
    'onion',
    'potato',
    'tomato',
    'garlic',
    'ginger',
    'chili',
    'vegetables',
    'fruits',
    'baazar',
    'bazar',
  ],
  Healthcare: [
    'health',
    'medical',
    'hospital',
    'doctor',
    'medicine',
    'pharmacy',
    'diagnostic',
    'lab test',
    'clinic',
    'dental',
    'eye',
    'checkup',
    'surgery',
    'prescription',
    'vaccine',
    'ambulance',
    'physiotherapy',
    'chikitsa',
    'oshudh',
  ],
  Education: [
    'education',
    'school',
    'college',
    'university',
    'tuition',
    'course',
    'book',
    'exam',
    'coaching',
    'training',
    'admission',
    'semester',
    'registration',
    'certificate',
    'workshop',
    'seminar',
    'shikkha',
  ],
  Entertainment: [
    'entertainment',
    'movie',
    'cinema',
    'concert',
    'game',
    'gaming',
    'netflix',
    'spotify',
    'subscription',
    'park',
    'tour',
    'outing',
    'picnic',
    'party',
    'gym',
    'fitness',
    'sports',
    'cricket',
    'football',
    'bijoy',
  ],
  Shopping: [
    'shopping',
    'cloth',
    'dress',
    'shirt',
    'pant',
    'shoe',
    'bag',
    'cosmetic',
    'beauty',
    'salon',
    'parlour',
    'electronics',
    'gadget',
    'laptop',
    'watch',
    'household',
    'kitchenware',
    'bedsheet',
    'curtain',
    'juta',
    'kapor',
  ],
  'Gifts & Donations': [
    'gift',
    'donation',
    'charity',
    'zakat',
    'sadaqah',
    'fitra',
    'qurbani',
    'eid gift',
    'birthday gift',
    'wedding gift',
  ],
  Insurance: ['insurance', 'premium', 'policy'],
  Savings: ['savings', 'fixed deposit', 'dps', 'pension', 'postal'],
  Investment: [
    'investment',
    'stock',
    'share',
    'mutual fund',
    'bond',
    'ipo',
    'brokerage',
  ],
  'Home Maintenance': [
    'maintenance',
    'repair',
    'plumber',
    'electrician',
    'painter',
    'cleaning',
    'renovation',
    'furniture',
    'carpenter',
    'pest control',
  ],
  Tax: ['tax', 'vat', 'government tax', 'income tax'],
  Gifts: ['gift'],
  Fees: [
    'fee',
    'charge',
    'commission',
    'penalty',
    'fine',
    'late fee',
    'service charge',
    'processing fee',
  ],
};

const INCOME_CATEGORY_KEYWORDS: Record<string, string[]> = {
  Salary: ['salary', 'wage', 'stipend', 'salary pay', 'monthly salary'],
  Freelance: ['freelance', 'freelancing', 'outsourcing', 'client work'],
  Business: ['business', 'profit', 'revenue', 'sales income'],
  'Investment Income': [
    'dividend',
    'interest income',
    'investment return',
    'capital gain',
    'roi',
  ],
  'Rental Income': ['rent income', 'house rent income', 'tenant'],
  'Other Income': ['refund', 'cashback', 'bonus', 'reward', 'extra income'],
};

interface CsvRow {
  Index?: string;
  Date?: string;
  Time?: string;
  Remark?: string;
  'Entry by'?: string;
  Contact?: string;
  Category?: string;
  Mode?: string;
  'Cash In'?: string;
  'Cash Out'?: string;
  Balance?: string;
}

type TransactionTypeValue = 'INCOME' | 'EXPENSE';

interface PreparedTransaction {
  id: string;
  csvRowNumber: number;
  csvIndex: string | null;
  bookId: string;
  type: TransactionTypeValue;
  date: Date;
  amount: number;
  remark: string | null;
  categoryId: string | null;
  paymentMethodId: string | null;
}

interface CategoryResolutionStats {
  exact: number;
  partial: number;
  remark: number;
  fallback: number;
}

interface PaymentMethodResolutionStats {
  exact: number;
  partial: number;
  fallback: number;
}

interface ParsedMigrationData {
  transactions: PreparedTransaction[];
  emptyRowsSkipped: number;
  errors: string[];
  incomeTotal: number;
  expenseTotal: number;
  categoryResolution: CategoryResolutionStats;
  paymentMethodResolution: PaymentMethodResolutionStats;
}

interface VerificationResult {
  incomeTotal: number;
  expenseTotal: number;
  finalBalance: number;
}

interface MigrationResult {
  importedCount: number;
  incomeTotal: number;
  expenseTotal: number;
  finalBalance: number;
}

/* ──────────────────────────────────────────────────────────────
 * Text / money helpers
 * ────────────────────────────────────────────────────────────── */

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.replace(/^\uFEFF/, '').trim();
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value).trim();
  }
  try {
    return JSON.stringify(value)
      .replace(/^\uFEFF/, '')
      .trim();
  } catch {
    return '';
  }
}

function normalizeName(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, ' ');
}

function normalizeLookupKey(value: unknown): string {
  return normalizeName(value).toLocaleLowerCase('en-US');
}

function categoryLookupKey(name: unknown, isIncome: boolean): string {
  return `${normalizeLookupKey(name)}::${isIncome ? 'income' : 'expense'}`;
}

function normalizeRemark(value: unknown): string | null {
  const valueString = normalizeName(value);
  return valueString.length > 0 ? valueString : null;
}

function isCompletelyEmptyRow(row: CsvRow): boolean {
  return Object.values(row).every((value) => normalizeText(value).length === 0);
}

function parseMoney(
  rawValue: unknown,
  fieldName: string,
  csvRowNumber: number,
): number {
  let value = normalizeText(rawValue);

  if (
    value === '' ||
    value === '-' ||
    value === '—' ||
    value.toLowerCase() === 'null'
  ) {
    return 0;
  }

  const isParenthesizedNegative = value.startsWith('(') && value.endsWith(')');

  value = value
    .replace(/[,\s]/g, '')
    .replace(/৳/g, '')
    .replace(/\/=/g, '')
    .replace(/[^\d.+-]/g, '');

  if (isParenthesizedNegative) {
    value = `-${value.replace(/[()]/g, '')}`;
  }

  if (value === '' || value === '.' || value === '-' || value === '+') {
    throw new Error(
      `CSV row ${csvRowNumber}: "${fieldName}" contains an invalid amount.`,
    );
  }

  const dotIndex = value.indexOf('.');

  if (dotIndex !== -1 && value.length - dotIndex - 1 > 2) {
    throw new Error(
      `CSV row ${csvRowNumber}: ${fieldName} "${safeStringify(rawValue)}" has more than 2 decimal places and requires review.`,
    );
  }

  const decimal = parseFloat(value);

  if (!Number.isFinite(decimal)) {
    throw new Error(`CSV row ${csvRowNumber}: ${fieldName} must be finite.`);
  }

  return decimal;
}

function decimalEquals(first: number, second: number): boolean {
  return Math.abs(first - second) < FLOAT_EPSILON;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/* ──────────────────────────────────────────────────────────────
 * Error message builders
 *
 * Extracted into separate functions returning `string` to avoid
 * @typescript-eslint/restrict-template-expressions false positives
 * inside `never`-returning scopes.
 * ────────────────────────────────────────────────────────────── */

function buildCollectedParseErrorMessage(errors: string[]): string {
  const displayed = errors.slice(0, MAX_DISPLAYED_PARSE_ERRORS);
  const hiddenCount = errors.length - displayed.length;

  const parts = [
    `CSV validation found ${errors.length} error(s). Nothing was inserted.`,
    '',
    ...displayed.map((error, index) => `${index + 1}. ${error}`),
    hiddenCount > 0
      ? `\n...plus ${hiddenCount} additional error(s). Increase MAX_DISPLAYED_PARSE_ERRORS to display them.`
      : '',
  ].filter(Boolean);

  return parts.join('\n');
}

function buildVerificationErrorMessage(errors: string[]): string {
  const displayed = errors.slice(0, 100);
  const hiddenCount = errors.length - displayed.length;

  const parts = [
    'Post-insert verification failed. The transaction will roll back.',
    '',
    ...displayed.map((error, index) => `${index + 1}. ${error}`),
    hiddenCount > 0
      ? `\n...plus ${hiddenCount} additional verification error(s).`
      : '',
  ].filter(Boolean);

  return parts.join('\n');
}

function throwCollectedParseErrors(errors: string[]): never {
  throw new Error(buildCollectedParseErrorMessage(errors));
}

/* ──────────────────────────────────────────────────────────────
 * Timezone-safe parsing
 * ────────────────────────────────────────────────────────────── */

function parseTransactionDate(
  rawDate: unknown,
  rawTime: unknown,
  csvRowNumber: number,
): Date {
  const dateValue = normalizeText(rawDate);
  const timeValue = normalizeText(rawTime);

  if (!dateValue) {
    throw new Error(`CSV row ${csvRowNumber}: Transaction date is missing.`);
  }

  const dateFormats = [
    'DD MMMM YYYY',
    'D MMMM YYYY',
    'DD MMM YYYY',
    'D MMM YYYY',
    'DD-MM-YYYY',
    'D-M-YYYY',
    'DD/MM/YYYY',
    'D/M/YYYY',
    'YYYY-MM-DD',
  ];

  const timeFormats = [
    'hh:mm A',
    'h:mm A',
    'hh:mm a',
    'h:mm a',
    'hh:mm:ss A',
    'h:mm:ss A',
    'hh:mm:ss a',
    'h:mm:ss a',
    'HH:mm',
    'H:mm',
    'HH:mm:ss',
    'H:mm:ss',
  ];

  let locallyValidated: Dayjs | null = null;

  if (timeValue) {
    let found = false;

    for (const dateFormat of dateFormats) {
      for (const timeFormat of timeFormats) {
        const candidate = dayjs(
          `${dateValue} ${timeValue}`,
          `${dateFormat} ${timeFormat}`,
          true,
        );

        if (candidate.isValid()) {
          locallyValidated = candidate;
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
  } else {
    for (const dateFormat of dateFormats) {
      const candidate = dayjs(dateValue, dateFormat, true);
      if (candidate.isValid()) {
        locallyValidated = candidate.startOf('day');
        break;
      }
    }
  }

  // Split the null check from isValid() to properly narrow the type
  if (!locallyValidated || !locallyValidated.isValid()) {
    throw new Error(
      `CSV row ${csvRowNumber}: Invalid date/time "${dateValue}${
        timeValue ? ` ${timeValue}` : ''
      }".`,
    );
  }

  const normalizedWallClock = locallyValidated.format('YYYY-MM-DD HH:mm:ss');

  const zoned = dayjs.tz(
    normalizedWallClock,
    'YYYY-MM-DD HH:mm:ss',
    SOURCE_TIMEZONE,
  );

  if (!zoned.isValid()) {
    throw new Error(
      `CSV row ${csvRowNumber}: Date/time could not be interpreted in ${SOURCE_TIMEZONE}.`,
    );
  }

  if (zoned.format('YYYY-MM-DD HH:mm:ss') !== normalizedWallClock) {
    throw new Error(
      `CSV row ${csvRowNumber}: "${normalizedWallClock}" is not a valid wall-clock time in ${SOURCE_TIMEZONE}.`,
    );
  }

  return zoned.toDate();
}

/* ──────────────────────────────────────────────────────────────
 * Configuration / target validation
 * ────────────────────────────────────────────────────────────── */

function validateTimezone(): void {
  try {
    Intl.DateTimeFormat('en-US', {
      timeZone: SOURCE_TIMEZONE,
    }).format(new Date());
  } catch {
    throw new Error(
      `SOURCE_TIMEZONE "${SOURCE_TIMEZONE}" is not a valid IANA timezone.`,
    );
  }
}

async function validateConfiguration(): Promise<void> {
  validateTimezone();

  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`CSV file was not found:\n${path.resolve(CSV_FILE_PATH)}`);
  }

  if (!TARGET_BOOK_ID) {
    throw new Error('Set TARGET_BOOK_ID to the real destination book UUID.');
  }

  const [user, book] = await Promise.all([
    prisma.user.findUnique({
      where: { id: USER_ID },
      select: { id: true },
    }),
    prisma.book.findUnique({
      where: { id: TARGET_BOOK_ID },
      select: {
        id: true,
        userId: true,
        _count: {
          select: { transactions: true },
        },
      },
    }),
  ]);

  if (!user) {
    throw new Error(`User "${USER_ID}" does not exist.`);
  }
  if (!book) {
    throw new Error(`Book "${TARGET_BOOK_ID}" does not exist.`);
  }
  if (book.userId !== USER_ID) {
    throw new Error(
      `Book "${TARGET_BOOK_ID}" does not belong to user "${USER_ID}".`,
    );
  }
  if (
    !DRY_RUN &&
    !ALLOW_IMPORT_INTO_NON_EMPTY_BOOK &&
    book._count.transactions > 0
  ) {
    throw new Error(
      `Target book already contains ${book._count.transactions} transaction(s). Import cancelled to prevent duplicates.`,
    );
  }
}

/* ──────────────────────────────────────────────────────────────
 * Reference data
 * ────────────────────────────────────────────────────────────── */

interface ReferenceData {
  categoryMap: Map<string, string>;
  paymentMethodMap: Map<string, string>;
  fallbackExpenseCategoryId: string;
  fallbackIncomeCategoryId: string;
  fallbackPaymentMethodId: string;
}

async function loadReferenceData(): Promise<ReferenceData> {
  const [existingCategories, existingPaymentMethods] = await Promise.all([
    prisma.category.findMany({
      where: {
        OR: [{ userId: USER_ID }, { isDefault: true, userId: null }],
      },
      select: {
        id: true,
        name: true,
        isIncome: true,
      },
    }),
    prisma.paymentMethod.findMany({
      where: {
        OR: [{ userId: USER_ID }, { isDefault: true, userId: null }],
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const categoryMap = new Map<string, string>();

  for (const category of existingCategories) {
    const key = categoryLookupKey(category.name, category.isIncome);
    categoryMap.set(key, category.id);
  }

  const paymentMethodMap = new Map<string, string>();

  for (const method of existingPaymentMethods) {
    const key = normalizeLookupKey(method.name);
    paymentMethodMap.set(key, method.id);
  }

  const fallbackExpenseCategoryId =
    categoryMap.get(categoryLookupKey(FALLBACK_EXPENSE_CATEGORY_NAME, false)) ??
    '';

  const fallbackIncomeCategoryId =
    categoryMap.get(categoryLookupKey(FALLBACK_INCOME_CATEGORY_NAME, true)) ??
    '';

  const fallbackPaymentMethodId =
    paymentMethodMap.get(normalizeLookupKey(FALLBACK_PAYMENT_METHOD_NAME)) ??
    '';

  if (!fallbackExpenseCategoryId) {
    throw new Error(
      `Fallback expense category "${FALLBACK_EXPENSE_CATEGORY_NAME}" does not exist in the database.`,
    );
  }

  if (!fallbackIncomeCategoryId) {
    throw new Error(
      `Fallback income category "${FALLBACK_INCOME_CATEGORY_NAME}" does not exist in the database.`,
    );
  }

  if (!fallbackPaymentMethodId) {
    throw new Error(
      `Fallback payment method "${FALLBACK_PAYMENT_METHOD_NAME}" does not exist in the database.`,
    );
  }

  return {
    categoryMap,
    paymentMethodMap,
    fallbackExpenseCategoryId,
    fallbackIncomeCategoryId,
    fallbackPaymentMethodId,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Category / payment-method resolution
 * ────────────────────────────────────────────────────────────── */

function findCategoryByPartialMatch(
  rawName: unknown,
  isIncome: boolean,
  categoryMap: Map<string, string>,
): string | null {
  const name = normalizeName(rawName);
  if (!name || name.length < 3) {
    return null;
  }

  const normalizedInput = name.toLowerCase();
  const suffix = isIncome ? '::income' : '::expense';

  let bestId: string | null = null;
  let bestLength = Infinity;

  for (const [key, id] of categoryMap) {
    if (!key.endsWith(suffix)) {
      continue;
    }

    const categoryName = key.slice(0, -suffix.length);

    if (
      categoryName.includes(normalizedInput) &&
      categoryName.length < bestLength
    ) {
      bestId = id;
      bestLength = categoryName.length;
    }
  }

  return bestId;
}

function guessCategoryFromRemark(
  remark: string | null,
  isIncome: boolean,
  categoryMap: Map<string, string>,
): string | null {
  if (!remark) {
    return null;
  }

  const normalizedRemark = remark.toLowerCase().trim();
  if (normalizedRemark.length < 2) {
    return null;
  }

  const keywords = isIncome
    ? INCOME_CATEGORY_KEYWORDS
    : EXPENSE_CATEGORY_KEYWORDS;

  let bestCategoryId: string | null = null;
  let bestScore = 0;

  for (const [categoryName, categoryKeywords] of Object.entries(keywords)) {
    let score = 0;

    for (const keyword of categoryKeywords) {
      if (normalizedRemark.includes(keyword.toLowerCase())) {
        score += keyword.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      const key = categoryLookupKey(categoryName, isIncome);
      bestCategoryId = categoryMap.get(key) ?? null;
    }
  }

  return bestCategoryId;
}

function findPaymentMethodByPartialMatch(
  rawName: unknown,
  paymentMethodMap: Map<string, string>,
): string | null {
  const name = normalizeName(rawName);
  if (!name || name.length < 3) {
    return null;
  }

  const normalizedInput = name.toLowerCase();

  let bestId: string | null = null;
  let bestLength = Infinity;

  for (const [key, id] of paymentMethodMap) {
    if (key.includes(normalizedInput) && key.length < bestLength) {
      bestId = id;
      bestLength = key.length;
    }
  }

  return bestId;
}

/* ──────────────────────────────────────────────────────────────
 * Collect-all CSV parsing
 * ────────────────────────────────────────────────────────────── */

async function parseCsvFile(): Promise<ParsedMigrationData> {
  const ref = await loadReferenceData();

  const transactions: PreparedTransaction[] = [];
  const errors: string[] = [];

  const categoryStats: CategoryResolutionStats = {
    exact: 0,
    partial: 0,
    remark: 0,
    fallback: 0,
  };

  const paymentMethodStats: PaymentMethodResolutionStats = {
    exact: 0,
    partial: 0,
    fallback: 0,
  };

  let emptyRowsSkipped = 0;
  let physicalCsvRowNumber = 1;
  let incomeTotal = 0;
  let expenseTotal = 0;

  const resolveCategoryId = (
    rawName: unknown,
    isIncome: boolean,
    remark: string | null,
  ): string => {
    const name = normalizeName(rawName);

    if (name) {
      const exactKey = categoryLookupKey(name, isIncome);
      const exactId = ref.categoryMap.get(exactKey);

      if (exactId) {
        categoryStats.exact++;
        return exactId;
      }

      const partialId = findCategoryByPartialMatch(
        name,
        isIncome,
        ref.categoryMap,
      );

      if (partialId) {
        categoryStats.partial++;
        return partialId;
      }
    }

    const remarkId = guessCategoryFromRemark(remark, isIncome, ref.categoryMap);

    if (remarkId) {
      categoryStats.remark++;
      return remarkId;
    }

    categoryStats.fallback++;
    return isIncome
      ? ref.fallbackIncomeCategoryId
      : ref.fallbackExpenseCategoryId;
  };

  const resolvePaymentMethodId = (rawName: unknown): string => {
    const name = normalizeName(rawName);

    if (name) {
      const exactKey = normalizeLookupKey(name);
      const exactId = ref.paymentMethodMap.get(exactKey);

      if (exactId) {
        paymentMethodStats.exact++;
        return exactId;
      }

      const partialId = findPaymentMethodByPartialMatch(
        name,
        ref.paymentMethodMap,
      );

      if (partialId) {
        paymentMethodStats.partial++;
        return partialId;
      }
    }

    paymentMethodStats.fallback++;
    return ref.fallbackPaymentMethodId;
  };

  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(CSV_FILE_PATH).pipe(
      csv({
        separator: ',',
        mapHeaders: ({ header }) => normalizeText(header),
        mapValues: ({ value }) => normalizeText(value),
      }),
    );

    stream.on('data', (row: CsvRow) => {
      physicalCsvRowNumber++;

      if (physicalCsvRowNumber === 2) {
        console.log('DEBUG keys:', Object.keys(row));
        console.log('DEBUG row:', JSON.stringify(row, null, 2));
      }

      if (isCompletelyEmptyRow(row)) {
        emptyRowsSkipped++;
        return;
      }

      try {
        const cashIn = parseMoney(
          row['Cash In'],
          'Cash In',
          physicalCsvRowNumber,
        );
        const cashOut = parseMoney(
          row['Cash Out'],
          'Cash Out',
          physicalCsvRowNumber,
        );

        if (cashIn < 0 || cashOut < 0) {
          throw new Error(
            `CSV row ${physicalCsvRowNumber}: Cash In and Cash Out cannot be negative.`,
          );
        }

        const hasCashIn = cashIn > 0;
        const hasCashOut = cashOut > 0;

        if (hasCashIn && hasCashOut) {
          throw new Error(
            `CSV row ${physicalCsvRowNumber}: Both Cash In and Cash Out contain positive values.`,
          );
        }

        if (!hasCashIn && !hasCashOut) {
          throw new Error(
            `CSV row ${physicalCsvRowNumber}: Both Cash In and Cash Out are zero or empty.`,
          );
        }

        const type: TransactionTypeValue = hasCashIn ? 'INCOME' : 'EXPENSE';
        const amount: number = hasCashIn ? cashIn : cashOut;
        const remark = normalizeRemark(row.Remark);

        const transaction: PreparedTransaction = {
          id: randomUUID(),
          csvRowNumber: physicalCsvRowNumber,
          csvIndex: normalizeText(row.Index) || null,
          bookId: TARGET_BOOK_ID,
          type,
          date: parseTransactionDate(row.Date, row.Time, physicalCsvRowNumber),
          amount,
          remark,
          categoryId: resolveCategoryId(
            row.Category,
            type === 'INCOME',
            remark,
          ),
          paymentMethodId: resolvePaymentMethodId(row.Mode),
        };

        transactions.push(transaction);

        if (type === 'INCOME') {
          incomeTotal += amount;
        } else {
          expenseTotal += amount;
        }
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : `CSV row ${physicalCsvRowNumber}: ${safeStringify(error)}`,
        );
      }
    });

    stream.on('end', resolve);
    stream.on('error', reject);
  });

  return {
    transactions,
    emptyRowsSkipped,
    errors,
    incomeTotal,
    expenseTotal,
    categoryResolution: categoryStats,
    paymentMethodResolution: paymentMethodStats,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Timeout / large dataset policy
 * ────────────────────────────────────────────────────────────── */

function calculateTransactionTimeout(rowCount: number): number {
  const calculated =
    TRANSACTION_BASE_TIMEOUT_MS + rowCount * TRANSACTION_TIMEOUT_PER_ROW_MS;

  return Math.min(
    MAX_TRANSACTION_TIMEOUT_MS,
    Math.max(MIN_TRANSACTION_TIMEOUT_MS, calculated),
  );
}

function validateDatasetSize(rowCount: number): void {
  if (rowCount > MAX_SINGLE_TRANSACTION_ROWS) {
    throw new Error(
      [
        `Dataset contains ${rowCount} rows.`,
        `This exceeds MAX_SINGLE_TRANSACTION_ROWS=${MAX_SINGLE_TRANSACTION_ROWS}.`,
        'Do not use one long interactive transaction for this import.',
        'Use a staged importRun-based migration with cleanup/retry support.',
      ].join(' '),
    );
  }

  if (rowCount > LARGE_DATASET_WARNING_ROWS) {
    console.warn(
      [
        `\n⚠️  LARGE DATASET WARNING: ${rowCount} rows will be imported`,
        'inside one interactive transaction.',
        'This can hold locks and consume a database connection for a long time.',
      ].join(' '),
    );
  }
}

/* ──────────────────────────────────────────────────────────────
 * Batched insertion
 * ────────────────────────────────────────────────────────────── */

async function insertInBatches(
  tx: Prisma.TransactionClient,
  transactions: PreparedTransaction[],
): Promise<void> {
  const batches = chunkArray(transactions, BATCH_SIZE);

  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];

    await tx.transaction.createMany({
      data: batch.map((transaction) => ({
        id: transaction.id,
        bookId: transaction.bookId,
        type: transaction.type,
        date: transaction.date,
        amount: transaction.amount,
        remark: transaction.remark,
        categoryId: transaction.categoryId,
        paymentMethodId: transaction.paymentMethodId,
      })),
    });

    console.log(`⏳ Inserted batch ${index + 1}/${batches.length}`);
  }
}

/* ──────────────────────────────────────────────────────────────
 * Chunked exact verification
 * ────────────────────────────────────────────────────────────── */

async function verifyImportedTransactions(
  tx: Prisma.TransactionClient,
  sourceTransactions: PreparedTransaction[],
  expectedIncomeTotal: number,
  expectedExpenseTotal: number,
): Promise<VerificationResult> {
  console.log('\n🔍 Running chunked exact verification...\n');

  const sourceBatches = chunkArray(sourceTransactions, BATCH_SIZE);
  const verificationErrors: string[] = [];
  let databaseRowCount = 0;
  let databaseIncomeCount = 0;
  let databaseExpenseCount = 0;
  let databaseIncomeTotal = 0;
  let databaseExpenseTotal = 0;

  for (let batchIndex = 0; batchIndex < sourceBatches.length; batchIndex++) {
    const sourceBatch = sourceBatches[batchIndex];
    const ids = sourceBatch.map((item) => item.id);

    const databaseRows = await tx.transaction.findMany({
      where: {
        bookId: TARGET_BOOK_ID,
        id: { in: ids },
      },
      select: {
        id: true,
        bookId: true,
        type: true,
        date: true,
        amount: true,
        remark: true,
        categoryId: true,
        paymentMethodId: true,
      },
    });

    databaseRowCount += databaseRows.length;
    const databaseMap = new Map(databaseRows.map((row) => [row.id, row]));

    for (const databaseRow of databaseRows) {
      if (databaseRow.type === 'INCOME') {
        databaseIncomeCount++;
        databaseIncomeTotal += databaseRow.amount;
      } else if (databaseRow.type === 'EXPENSE') {
        databaseExpenseCount++;
        databaseExpenseTotal += databaseRow.amount;
      } else {
        verificationErrors.push(
          `Database transaction ${databaseRow.id}: Unknown type "${String(databaseRow.type)}".`,
        );
      }
    }

    for (const source of sourceBatch) {
      const database = databaseMap.get(source.id);

      const rowLabel = source.csvIndex
        ? `CSV row ${source.csvRowNumber}, Index ${source.csvIndex}`
        : `CSV row ${source.csvRowNumber}`;

      if (!database) {
        verificationErrors.push(`${rowLabel}: Transaction was not inserted.`);

        continue;
      }

      if (database.bookId !== source.bookId) {
        verificationErrors.push(`${rowLabel}: Book ID mismatch.`);
      }
      if (database.type !== source.type) {
        verificationErrors.push(
          `${rowLabel}: Type mismatch. CSV=${source.type}, DB=${database.type}.`,
        );
      }
      if (database.date.getTime() !== source.date.getTime()) {
        verificationErrors.push(
          `${rowLabel}: Date mismatch. CSV=${source.date.toISOString()}, DB=${database.date.toISOString()}.`,
        );
      }
      if (!decimalEquals(database.amount, source.amount)) {
        verificationErrors.push(
          `${rowLabel}: Amount mismatch. CSV=${formatMoney(source.amount)}, DB=${formatMoney(database.amount)}.`,
        );
      }
      if (database.remark !== source.remark) {
        verificationErrors.push(`${rowLabel}: Remark mismatch.`);
      }
      if (database.categoryId !== source.categoryId) {
        verificationErrors.push(`${rowLabel}: Category mismatch.`);
      }
      if (database.paymentMethodId !== source.paymentMethodId) {
        verificationErrors.push(`${rowLabel}: Payment method mismatch.`);
      }
    }

    console.log(`🔎 Verified batch ${batchIndex + 1}/${sourceBatches.length}`);
  }

  const sourceIncomeCount = sourceTransactions.filter(
    (item) => item.type === 'INCOME',
  ).length;

  const sourceExpenseCount = sourceTransactions.filter(
    (item) => item.type === 'EXPENSE',
  ).length;

  const countMatches = databaseRowCount === sourceTransactions.length;
  const incomeCountMatches = databaseIncomeCount === sourceIncomeCount;
  const expenseCountMatches = databaseExpenseCount === sourceExpenseCount;
  const incomeTotalMatches = decimalEquals(
    databaseIncomeTotal,
    expectedIncomeTotal,
  );
  const expenseTotalMatches = decimalEquals(
    databaseExpenseTotal,
    expectedExpenseTotal,
  );

  console.table([
    {
      Metric: 'Total rows',
      'CSV source': sourceTransactions.length,
      Database: databaseRowCount,
      Status: countMatches ? '✅ MATCH' : '❌ MISMATCH',
    },
    {
      Metric: 'Income rows',
      'CSV source': sourceIncomeCount,
      Database: databaseIncomeCount,
      Status: incomeCountMatches ? '✅ MATCH' : '❌ MISMATCH',
    },
    {
      Metric: 'Expense rows',
      'CSV source': sourceExpenseCount,
      Database: databaseExpenseCount,
      Status: expenseCountMatches ? '✅ MATCH' : '❌ MISMATCH',
    },
    {
      Metric: 'Cash In',
      'CSV source': formatMoney(expectedIncomeTotal),
      Database: formatMoney(databaseIncomeTotal),
      Status: incomeTotalMatches ? '✅ MATCH' : '❌ MISMATCH',
    },
    {
      Metric: 'Cash Out',
      'CSV source': formatMoney(expectedExpenseTotal),
      Database: formatMoney(databaseExpenseTotal),
      Status: expenseTotalMatches ? '✅ MATCH' : '❌ MISMATCH',
    },
  ]);

  if (
    verificationErrors.length > 0 ||
    !countMatches ||
    !incomeCountMatches ||
    !expenseCountMatches ||
    !incomeTotalMatches ||
    !expenseTotalMatches
  ) {
    throw new Error(buildVerificationErrorMessage(verificationErrors));
  }

  return {
    incomeTotal: databaseIncomeTotal,
    expenseTotal: databaseExpenseTotal,
    finalBalance: databaseIncomeTotal - databaseExpenseTotal,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Migration
 * ────────────────────────────────────────────────────────────── */

async function migrate(): Promise<void> {
  console.log('🚀 Starting CashBook migration...\n');

  await validateConfiguration();
  console.log('✅ Configuration and target book validated.');

  const migrationData = await parseCsvFile();

  if (migrationData.errors.length > 0) {
    throwCollectedParseErrors(migrationData.errors);
  }

  if (migrationData.transactions.length === 0) {
    throw new Error('The CSV contains no valid financial transactions.');
  }

  validateDatasetSize(migrationData.transactions.length);

  const transactionTimeout = calculateTransactionTimeout(
    migrationData.transactions.length,
  );

  const cStats = migrationData.categoryResolution;
  const pStats = migrationData.paymentMethodResolution;

  console.table([
    {
      Metric: 'Source timezone',
      Value: SOURCE_TIMEZONE,
    },
    {
      Metric: 'Valid transactions',
      Value: migrationData.transactions.length,
    },
    {
      Metric: 'Empty rows skipped',
      Value: migrationData.emptyRowsSkipped,
    },
    {
      Metric: 'Categories — exact match',
      Value: cStats.exact,
    },
    {
      Metric: 'Categories — partial name match',
      Value: cStats.partial,
    },
    {
      Metric: 'Categories — guessed from remark',
      Value: cStats.remark,
    },
    {
      Metric: `Categories — defaulted to ${FALLBACK_EXPENSE_CATEGORY_NAME} / ${FALLBACK_INCOME_CATEGORY_NAME}`,
      Value: cStats.fallback,
    },
    {
      Metric: 'Payment methods — exact match',
      Value: pStats.exact,
    },
    {
      Metric: 'Payment methods — partial name match',
      Value: pStats.partial,
    },
    {
      Metric: `Payment methods — defaulted to ${FALLBACK_PAYMENT_METHOD_NAME}`,
      Value: pStats.fallback,
    },
    {
      Metric: 'Cash In',
      Value: formatMoney(migrationData.incomeTotal),
    },
    {
      Metric: 'Cash Out',
      Value: formatMoney(migrationData.expenseTotal),
    },
    {
      Metric: 'Calculated balance',
      Value: formatMoney(
        migrationData.incomeTotal - migrationData.expenseTotal,
      ),
    },
    {
      Metric: 'Transaction timeout',
      Value: `${transactionTimeout} ms`,
    },
  ]);

  if (DRY_RUN) {
    console.log('\n🧪 DRY RUN passed. No database records were changed.');
    return;
  }

  const result = await prisma.$transaction(
    async (tx): Promise<MigrationResult> => {
      if (!ALLOW_IMPORT_INTO_NON_EMPTY_BOOK) {
        const existingCount = await tx.transaction.count({
          where: { bookId: TARGET_BOOK_ID },
        });

        if (existingCount > 0) {
          throw new Error(
            `Target book contains ${existingCount} transaction(s). Import cancelled.`,
          );
        }
      }

      await insertInBatches(tx, migrationData.transactions);

      const verification = await verifyImportedTransactions(
        tx,
        migrationData.transactions,
        migrationData.incomeTotal,
        migrationData.expenseTotal,
      );

      await tx.book.update({
        where: { id: TARGET_BOOK_ID },
        data: {
          bookTotalAmount: verification.finalBalance,
        },
      });

      const updatedBook = await tx.book.findUniqueOrThrow({
        where: { id: TARGET_BOOK_ID },
        select: { bookTotalAmount: true },
      });

      if (
        !decimalEquals(updatedBook.bookTotalAmount, verification.finalBalance)
      ) {
        throw new Error(
          `Book balance verification failed. Expected=${formatMoney(verification.finalBalance)}, DB=${formatMoney(updatedBook.bookTotalAmount)}.`,
        );
      }

      return {
        importedCount: migrationData.transactions.length,
        ...verification,
      };
    },
    {
      maxWait: TRANSACTION_MAX_WAIT_MS,
      timeout: transactionTimeout,
    },
  );

  console.log('\n🏆 MIGRATION AND VERIFICATION PASSED');
  console.table([
    {
      Metric: 'Transactions imported',
      Value: result.importedCount,
    },
    {
      Metric: 'Cash In',
      Value: formatMoney(result.incomeTotal),
    },
    {
      Metric: 'Cash Out',
      Value: formatMoney(result.expenseTotal),
    },
    {
      Metric: 'Final book balance',
      Value: formatMoney(result.finalBalance),
    },
  ]);
}

migrate()
  .catch((error: unknown) => {
    console.error('\n💥 MIGRATION FAILED');

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(safeStringify(error));
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
