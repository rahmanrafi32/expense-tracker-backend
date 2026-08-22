# Expense Tracker — Allocation & Sinking Fund Context

## Purpose

This document captures the work completed so far around automatic allocation, sinking funds, recurring expenses, allocation batches, and cycle handling.

It is intended to be given to another coding agent so the agent can understand:

- what the system is supposed to do
- what has already been implemented
- what bugs were found and fixed
- the current data model/behavior
- what is still broken or incomplete
- what must be verified before considering the feature complete

The agent should analyze the existing repository/code before changing anything. Do not assume snippets in this document are the exact current repository state.

---

# 1. Product Concept

The expense tracker has evolved into a predictive cash-flow / obligation management system.

A major part of the system is the use of sinking funds for recurring obligations.

Examples:

- monthly insurance
- quarterly insurance
- half-yearly obligations
- yearly insurance
- pension-like obligations
- other recurring expenses

Instead of requiring the user to pay/save the entire amount immediately, the system reserves money gradually.

A sinking fund tracks:

- target amount
- saved amount
- remaining amount
- deadline
- cycle start
- deposits
- required monthly amount

---

# 2. Core Relationship

Recurring Expense
    |
    +---- Sinking Fund

A recurring expense represents the actual future obligation.

A sinking fund represents the money being accumulated for that obligation.

When the recurring expense is paid:

1. recurring expense becomes PAID
2. nextDueDate advances
3. an EXPENSE transaction is created
4. sinking fund is reset for the next cycle
5. book balance is updated

---

# 3. Automatic Allocation

When an INCOME transaction is created, the system can automatically allocate incoming money to eligible sinking funds.

Example:

Income = 1,000
Fund requirement = 500

Expected:

Allocation = 500
Unallocated = 500

The allocation creates/updates:

- AllocationBatch
- SinkingFundDeposit
- SinkingFund.savedAmount

---

# 4. AllocationBatch

An allocation batch represents money originating from a particular income transaction.

Relevant fields include:

- id
- bookId
- amount
- allocatedAmount
- unallocatedAmount
- date
- note
- sourceTransactionId

Example:

Income = 100,000

Allocation batch:

amount = 100,000
allocatedAmount = 53,814
unallocatedAmount = 46,186

The unallocated amount represents money that has not yet been assigned to a sinking fund/goal.

Different income transactions must remain independent.

sourceTransactionId is used to associate an allocation batch with its source transaction and protect against duplicate source processing.

---

# 5. Allocation Rules Already Implemented / Tested

The allocation system has been tested against:

1. Exact funding
2. Partial funding
3. Existing savings + new income
4. Overfund protection
5. Multiple sinking funds
6. Deadline priority
7. Sinking funds before goals
8. Everything already funded
9. Different transactions don't merge
10. Duplicate source transaction protection
11. Different books remain isolated
12. Expense transactions do not allocate
13. Decimal amounts
14. Future-dated transactions
15. Cycle reset after markPaid

Important fixed case:

Target = 1,500
Already saved = 700
New income = 1,000

Expected:

Remaining requirement = 800
Allocation = 800
Unallocated = 200

The allocator must use the actual remaining target, not simply allocate a fixed monthly requirement.

---

# 6. Overfund Protection

A fund must never receive more than its remaining target.

Example:

Target = 1,500
Saved = 1,400
Available = 500

Expected:

Allocation = 100
Unallocated = 400
Saved = 1,500

The system must never allow Saved > Target.

---

# 7. Multiple Funds

If multiple sinking funds exist, allocation should consider their requirements and priority.

Deadline priority is part of the intended behavior.

The allocator should not distribute money arbitrarily.

---

# 8. Sinking Funds Before Goals

The intended priority is:

1. eligible sinking funds / obligations
2. then goals / other allocation targets

Recurring obligations have payment deadlines and should generally be funded before goals.

---

# 9. Recurring Expense markPaid()

The recurring expense payment flow is:

- verify recurring expense exists and belongs to user
- if linked sinking fund exists, verify it is fully funded
- mark recurring expense PAID
- advance nextDueDate
- create EXPENSE transaction
- reset sinking fund
- update book balance

The relevant existing method has this general structure:

```ts
const months = EXPENSE_FREQUENCY_MONTHS[expense.frequency];
const nextDueDate = dayjs(expense.nextDueDate).add(months, 'month');

await tx.reccuringExpenses.update(...);

await tx.transaction.create({
  data: {
    bookId: expense.bookId,
    type: TransactionType.EXPENSE,
    amount: expense.amount,
    remark: expense.name,
    date: new Date(),
    categoryId: expense.categoryId,
    paymentMethodId: expense.paymentMethodId,
    recurringExpenseId: id,
  },
});

const sinkingFund = await tx.sinkingFund.findUnique({
  where: {
    recurringExpenseId: id,
  },
});

if (sinkingFund) {
  await tx.sinkingFund.update({
    where: {
      id: sinkingFund.id,
    },
    data: {
      savedAmount: new Prisma.Decimal(0),
      deadline: nextDueDate.toDate(),
      cycleStartedAt: nextDueDate.toDate(),
    },
  });
}
```

IMPORTANT: cycle semantics were later identified as needing careful handling for historical/future-dated tests.

The intended semantic is:

- cycleStartedAt = beginning of the current funding cycle
- deadline = end of/current cycle's next payment date

When a payment occurs, the new cycle should begin at the effective payment date, while the next due date becomes the new deadline.

Do not blindly use today's server time if the application supports simulated historical/future transaction dates.

The agent should inspect the current implementation and determine the correct effective payment date based on the application's date model.

---

# 10. Sinking Fund Cycle

A field was introduced:

cycleStartedAt: DateTime?

Its purpose is NOT to delete old deposits.

The database should retain all historical deposits.

Instead, the API should only show deposits belonging to the current cycle.

Old cycle deposits remain in the database but are hidden from the current-cycle response.

Current-cycle deposits remain in the database and are shown.

---

# 11. Correct Cycle Semantics

cycleStartedAt means:

"when the current funding cycle started"

It should NOT mean:

"the next payment/deadline"

Example:

Payment occurs:
2026-09-20

Next payment:
2026-12-20

New cycle:

cycleStartedAt = 2026-09-20
deadline = 2026-12-20

Then deposits between September 20 and December 20 belong to the new cycle.

If cycleStartedAt is incorrectly set to December 20, deposits made during September/October/November disappear.

---

# 12. Deposit History Filtering

The current SinkingFundService serializes deposits and filters them by cycleStartedAt.

The intended logic is:

```ts
const cycleStartedAt = fund.cycleStartedAt
  ? dayjs(fund.cycleStartedAt)
  : null;

const deposits = cycleStartedAt
  ? fund.deposits.filter((deposit) =>
      dayjs(deposit.date).isSameOrAfter(cycleStartedAt),
    )
  : fund.deposits;
```

If using isSameOrAfter, the Day.js plugin must be registered:

```ts
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrAfter);
```

Alternatively, use Day.js comparison primitives without the plugin if that matches project conventions.

---

# 13. SinkingFundService findAllByBook() and findOne()

The current methods fetch the fund and all deposits, then serialize/filter them.

General structure:

```ts
async findAllByBook(userId: string, bookId: string) {
  const book = await this.prisma.book.findFirst({
    where: {
      id: bookId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!book) {
    throw new NotFoundException(`Book ${bookId} not found`);
  }

  const funds = await this.prisma.sinkingFund.findMany({
    where: { bookId },
    orderBy: { deadline: 'asc' },
    include: {
      deposits: { orderBy: { date: 'desc' } },
      category: { select: { id: true, name: true } },
    },
  });

  const now = dayjs().startOf('day');

  return funds.map((fund) => ({
    ...this.serializeFund(fund),
    ...this.computeFundMetrics(fund, now),
  }));
}
```

and:

```ts
async findOne(userId: string, id: string) {
  const fund = await this.prisma.sinkingFund.findFirst({
    where: { id, book: { userId } },
    include: {
      deposits: { orderBy: { date: 'desc' } },
      category: { select: { id: true, name: true } },
    },
  });

  if (!fund) {
    throw new NotFoundException(`Sinking fund ${id} not found`);
  }

  const now = dayjs().startOf('day');

  return {
    ...this.serializeFund(fund),
    ...this.computeFundMetrics(fund, now),
  };
}
```

These methods themselves were investigated and were not the core problem.

---

# 14. SinkingFundService.update()

Normal sinking fund edits should NOT reset the cycle.

Intended behavior:

- name change -> update name
- target amount change -> update targetAmount
- deadline change -> update deadline
- category change -> update category
- icon change -> update icon

Do NOT automatically change:

- savedAmount
- cycleStartedAt
- historical deposits

Example:

Current:

savedAmount = 700
targetAmount = 1,500
cycleStartedAt = Aug 22

User changes target:

1,500 -> 2,000

Expected:

savedAmount = 700
targetAmount = 2,000
remaining = 1,300
cycleStartedAt unchanged

---

# 15. RecurringExpenseService.update()

The recurring expense update flow synchronizes its linked sinking fund.

Current intended synchronization:

- name -> sinkingFund.name
- amount -> sinkingFund.targetAmount
- nextDueDate -> sinkingFund.deadline
- category -> sinkingFund.categoryId

It does NOT reset:

- savedAmount
- cycleStartedAt
- deposits

This is intentional.

Normal editing is NOT a payment/cycle reset.

Cycle reset happens only when the recurring expense is actually paid.

A possible rule discussed for frequency changes: if frequency changes without a new nextDueDate, the API should either calculate the new date deterministically or require nextDueDate. Inspect the current DTO/business rules before changing this.

---

# 16. SinkingFundService.addDeposit()

Manual/automatic deposits should:

- be greater than zero
- not exceed remaining target
- create SinkingFundDeposit
- increment savedAmount
- respect the current cycle

Automatic deposits commonly use:

note = "Automatic allocation"

Historical deposits should remain in the database.

---

# 17. Existing Data / Historical Data

A major requirement is that valid existing data must work.

Example allocation batches:

```text
amount = 100,000
allocatedAmount = 53,814
unallocatedAmount = 46,186
date = 2026-02-10
createdAt = 2026-08-22
sourceTransactionId = ...
```

and:

```text
amount = 5,000
allocatedAmount = 5,000
unallocatedAmount = 0
date = 2026-03-10
```

The first batch has valid available money:

46,186

If a new sinking fund becomes eligible, that existing unallocated money should be usable.

The system must not require another income transaction merely to trigger allocation.

---

# 18. Current Biggest Allocation Issue

The most important remaining issue is:

Existing unallocated allocation batches are not necessarily reprocessed when a new funding requirement appears.

Example:

Existing batch:

amount = 100,000
allocated = 53,814
unallocated = 46,186

Later:

New sinking fund requires = 20,000

Expected:

new fund receives = 20,000

existing batch becomes:

allocated = 73,814
unallocated = 26,186

No new income transaction should be required.

---

# 19. Allocation Should Be a Reconciliation Engine

The allocation system should evolve from:

income -> allocation

to a reusable reconciliation operation.

Conceptually:

```text
allocate(bookId)
    |
    +-- find eligible sinking funds
    |
    +-- calculate current requirements
    |
    +-- find allocation batches with unallocatedAmount > 0
    |
    +-- allocate available money
    |
    +-- update batches
    |
    +-- create deposits
    |
    +-- update savedAmount
```

The same allocation engine should be reusable from:

- income transaction created
- new sinking fund created
- sinking fund requirement increased
- recurring expense amount changed
- new cycle starts after markPaid
- explicit reconciliation
- migration/backfill for valid existing data

Do not duplicate the allocation algorithm in each service.

---

# 20. Existing Data Must Work

It is NOT acceptable for the feature to only work with freshly created data.

Valid existing data must participate in allocation.

If an existing AllocationBatch has:

unallocatedAmount > 0

that money is real available money and should be considered.

If some legacy data has an incorrect state because automatic allocation did not exist previously, a one-time reconciliation/backfill may be required.

Do not simply ignore old data.

---

# 21. Historical/Future-Dated Testing

The user intentionally creates new records with old/future dates to simulate months.

Examples:

- 2026-02-10
- 2026-03-10
- 2026-09-20
- 2026-09-21
- 2026-09-22
- 2026-10-20

The system must be deterministic with these dates.

Do not assume server current time is the business date when a transaction/recurring payment has an explicit date.

The agent should inspect existing transaction and recurring-expense date semantics.

---

# 22. Date Semantics

Relevant dates include:

- Transaction.date
- AllocationBatch.date
- AllocationBatch.createdAt
- SinkingFundDeposit.date
- SinkingFund.cycleStartedAt
- SinkingFund.deadline
- RecurringExpense.nextDueDate
- record updatedAt
- server current time

Do not mix these.

Business calculations should use the relevant business date, not createdAt.

In particular:

createdAt = when record entered database

date = when transaction/deposit is supposed to occur

These are not interchangeable.

---

# 23. Advance-Paid Recurring Obligations

There are scenarios where September and October are paid in advance.

The system must model this correctly rather than assuming the current calendar month is always the active payment cycle.

RecurringExpense.nextDueDate and SinkingFund cycle state should be authoritative.

---

# 24. Goals

Goals exist in the broader allocation design.

Priority discussed:

Sinking funds -> goals

Sinking funds represent upcoming obligations and should generally be funded before goals.

Inspect the actual goal implementation in the repository before changing it.

---

# 25. Balance / Ledger Integration

Transactions affect book balance through BalanceService.

Recurring expense payment creates an EXPENSE transaction and then updates book balance.

Automatic sinking-fund allocation must NOT create an extra income transaction or double-count cash.

A sinking-fund deposit is an internal reservation/allocation record, not additional income.

---

# 26. Test Matrix

Run all of these after changes:

## 1. Exact funding

Fund requirement = 500
Income = 500

Expected:
allocation = 500
unallocated = 0
savedAmount = 500

## 2. Partial funding

Fund requirement = 1,000
Income = 400

Expected:
allocation = 400
unallocated = 0
savedAmount = 400

## 3. Existing saved amount

Saved = 700
Target = 1,500
Income = 1,000

Expected:
allocation = 800
unallocated = 200
saved = 1,500

## 4. Overfund protection

Saved = 1,400
Target = 1,500
Income = 500

Expected:
allocation = 100
unallocated = 400
saved = 1,500

## 5. Multiple funds

Multiple eligible funds.

Expected:
allocation follows priority/deadline rules.

## 6. Deadline priority

Funds with different deadlines.

Expected:
earlier obligation gets funded first.

## 7. Sinking funds before goals

Expected:
eligible sinking funds are handled before goals.

## 8. Everything funded

Expected:
income remains unallocated.

## 9. Different source transactions

Expected:
batches remain separate.

## 10. Duplicate source transaction

Expected:
no duplicate batch or allocation.

## 11. Different books

Expected:
money never crosses books.

## 12. Expense transaction

Expected:
no income allocation.

## 13. Decimal amounts

Example:
33923.33

Expected:
no floating point corruption.

## 14. Future/historical dates

Expected:
allocation uses business dates correctly.

## 15. Cycle reset

Fund fully funded.
Mark recurring expense paid.

Expected:
savedAmount resets
new cycle starts
old deposits remain in DB
old deposits are hidden
new-cycle deposits appear.

## 16. Existing unallocated batch

Existing:
unallocated = 46,186

Create new fund requiring 20,000.

Expected:
20,000 is taken from existing unallocated money.

Remaining:
26,186

No new income required.

## 17. New cycle with existing unallocated money

Recurring expense is paid and new cycle begins.

If unallocated batches exist, new cycle requirement should be eligible according to date/business rules.

## 18. Recurring expense update

Change name/amount/deadline/category.

Expected:
linked sinking fund configuration synchronizes.

Cycle state remains unchanged.

## 19. Amount decrease below saved amount

Saved = 700
Attempt target = 500

Expected:
reject update.

## 20. Old deposits remain

After cycle reset:
database still contains old deposits.
API returns only current-cycle deposits.

---

# 27. Implementation Principles

1. Use Prisma.Decimal for monetary values.
2. Never use JavaScript floating point arithmetic for money.
3. Keep allocation operations transactional.
4. Keep allocation batches tied to source transactions.
5. Never allocate more than remaining fund target.
6. Never cross books.
7. Never merge unrelated income transactions.
8. Do not delete historical sinking-fund deposits.
9. Use cycleStartedAt to determine current-cycle deposits.
10. Do not reset cycle state on ordinary edits.
11. Reset cycle only on actual payment.
12. Separate database history from current-cycle presentation.
13. Treat transaction.date as business date when appropriate.
14. Do not use createdAt for business calculations.
15. Avoid duplicating allocation algorithms.
16. Make allocation/reconciliation reusable.
17. Existing valid unallocated batches must remain usable.
18. Historical/future-dated tests must be deterministic.

---

# 28. Current State

Most original allocation bugs have been addressed.

The main remaining areas are:

### A. Existing unallocated money

Existing AllocationBatch.unallocatedAmount is not necessarily reused when new funding requirements appear.

### B. Allocation trigger architecture

Allocation behaves too much like:

income -> allocation

It needs to become a reusable reconciliation mechanism that can be invoked when funding requirements change.

### C. Cycle/date semantics

cycleStartedAt, deadline, transaction.date, deposit.date, and server current time must be clearly separated.

This matters especially for historical/future-dated testing.

### D. Legacy/historical data

The final allocator must work with valid existing data rather than requiring a fresh book.

If legacy data is inconsistent, use controlled reconciliation/backfill.

---

# 29. Recommended Agent Workflow

Do NOT immediately rewrite everything.

First inspect the repository and identify:

1. Current AllocationService
2. TransactionService create/update/delete
3. SinkingFundService create/update/addDeposit
4. RecurringExpenseService create/update/markPaid
5. Prisma models:
   - Transaction
   - AllocationBatch
   - SinkingFund
   - SinkingFundDeposit
   - ReccuringExpenses
   - Goal
6. Relations and indexes
7. Existing allocation triggers
8. sourceTransactionId implementation
9. Date handling
10. Existing tests

Trace:

Income
 -> Transaction
 -> AllocationBatch
 -> AllocationService
 -> SinkingFund
 -> SinkingFundDeposit

and:

RecurringExpense
 -> markPaid
 -> Expense Transaction
 -> SinkingFund cycle reset
 -> next allocation opportunity

Then implement one reusable reconciliation mechanism.

Primary acceptance criterion:

> Given valid existing allocation batches with unallocated money, the system must be able to allocate that money to newly eligible/current funding requirements without requiring another income transaction.

After that, run all 20 test cases.

Do not sacrifice historical correctness just to make fresh-book tests pass.
