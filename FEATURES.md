# Expense Tracker Backend — Feature Inventory

This document lists the features currently implemented in the backend source code. It is based on the NestJS controllers, services, DTOs, Prisma schema, and migrations in this repository.

## Product scope

The project is a REST API for personal expense and cash-flow management. Users can create financial “books” (budgets/accounts), record income and expenses, organize transactions, track recurring bills, save toward goals, and manage emergency-fund borrowing and repayments.

## Authentication and account access

- User signup with:
  - First name and last name.
  - Email validation and unique-email conflict handling.
  - Password validation requiring at least six characters and a special character.
  - Secure bcrypt password hashing before persistence.
  - Optional profile picture, address, phone number, and country.
- User login with email/password verification.
- JWT access-token authentication.
- Refresh-token authentication with:
  - Cryptographically random refresh tokens.
  - SHA-256 token-hash storage instead of storing the raw token.
  - Configurable expiry, defaulting to seven days.
  - Expiration checks and cleanup of expired tokens.
  - Refresh-token rotation: the old token is deleted and a new access/refresh-token pair is issued.
- Logout that revokes the submitted refresh token.
- Service support for revoking all refresh tokens for a user.
- Bearer-token authentication guards on protected resources.
- Configurable JWT secret and access-token expiration through environment variables.

### Authentication routes

| Method | Route | Feature |
|---|---|---|
| POST | `/auth/signup` | Register a user |
| POST | `/auth/login` | Authenticate and receive access/refresh tokens |
| POST | `/auth/refresh` | Rotate refresh token and issue a new access token |
| POST | `/auth/logout` | Revoke a refresh token; requires JWT authentication |

## User management

- List all users.
- Retrieve a user by ID.
- Update user profile fields using a partial DTO.
- Delete a user.
- Lookup users by email internally for authentication.
- Cascade deletion of a user’s books, refresh tokens, categories, and payment methods through the data model.

### User routes

| Method | Route | Feature |
|---|---|---|
| GET | `/user/get/all-users` | List users |
| GET | `/user/get/:id` | Get a user |
| PATCH | `/user/update/:id` | Update a user |
| DELETE | `/user/delete/:id` | Delete a user |

## Books / budgets

- Create a financial book for an existing user.
- Store a book name, currency, expected monthly income, and calculated total balance.
- Supported book currencies: USD, EUR, GBP, BDT, and INR.
- List all books belonging to a user.
- Retrieve one book by ID.
- Update book name, currency, and monthly income.
- Delete a book, cascading its related transactions, goals, recurring expenses, and emergency-fund entries.
- Protect book updates and deletion by checking the authenticated user’s ownership.
- Maintain `bookTotalAmount` as calculated cash balance:
  - Total income minus total expenses.
  - Recalculated after transaction creation, update, and deletion.
  - Recalculated after emergency-fund operations and recurring-payment posting.

### Book routes

| Method | Route | Feature |
|---|---|---|
| POST | `/books/create` | Create a book |
| GET | `/books?userId=:userId` | List a user’s books |
| GET | `/books/:id` | Get a book |
| PATCH | `/books/:id` | Update a book |
| DELETE | `/books/:id` | Delete a book |

## Transactions

- Record income and expense transactions.
- Validate transaction type as `INCOME` or `EXPENSE`.
- Store amount, date, optional remark, book, category, and payment method.
- Reject negative amounts.
- Automatically create a user-owned category when a supplied category name does not already exist.
- Automatically create a user-owned payment method when a supplied payment-method name does not already exist.
- Reuse matching user-specific or default categories/payment methods.
- Include book owner, category, and payment-method details in transaction responses where applicable.
- List transactions for a book in newest-first order.
- Cursor-based pagination with configurable limit and `nextCursor`.
- Return aggregate `totalIncome` and `totalExpense` values alongside paginated results.
- Retrieve a transaction by ID.
- Update transaction type, date, amount, remark, category, and payment method.
- Delete transactions.
- Recalculate the associated book balance atomically after create, update, and delete.
- Link transactions to recurring expenses or emergency-fund entries when those features generate them.

### Transaction routes

| Method | Route | Feature |
|---|---|---|
| POST | `/transactions/add` | Add a transaction |
| GET | `/transactions?bookId=:bookId&cursor=:cursor&limit=:limit` | Paginated book transactions and totals |
| GET | `/transactions/:id` | Get a transaction |
| PATCH | `/transactions/:id` | Update a transaction |
| DELETE | `/transactions/:id` | Delete a transaction |

## Categories

- Shared category catalog with three scopes:
  - System categories.
  - Shared default categories.
  - User-specific categories.
- Return the combined category list available to a user.
- Return only user-specific categories.
- Return only shared default categories.
- Return only system categories.
- Create custom user categories.
- Rename custom user categories.
- Delete custom categories.
- Prevent duplicate names across system, default, and user-visible categories.
- Prevent deletion of a category currently referenced by transactions.
- Keep system and default categories read-only through the public category-management routes.

### Category routes

| Method | Route | Feature |
|---|---|---|
| GET | `/categories` | Get system, default, and user categories |
| GET | `/categories/user-specific` | Get custom user categories |
| GET | `/categories/default` | Get shared default categories |
| GET | `/categories/system` | Get system categories |
| POST | `/categories` | Create a custom category |
| PUT | `/categories/:id` | Rename a custom category |
| DELETE | `/categories/:id` | Delete a custom category |

## Payment methods

- Shared payment-method catalog with system, default, and user-specific scopes in the data model.
- Return all payment methods available to a user.
- Return only custom user payment methods.
- Create custom payment methods.
- Rename custom payment methods.
- Delete custom payment methods.
- Prevent duplicate names across system, default, and user-visible payment methods.
- Prevent deletion of a payment method currently referenced by transactions.
- Keep system and default payment methods protected from user modification/deletion.
- Automatically create and reuse payment methods during transaction creation/update.

### Payment-method routes

| Method | Route | Feature |
|---|---|---|
| GET | `/payment-methods` | Get available payment methods |
| GET | `/payment-methods/user-specific` | Get custom user payment methods |
| POST | `/payment-methods` | Create a custom payment method |
| PUT | `/payment-methods/:id` | Rename a custom payment method |
| DELETE | `/payment-methods/:id` | Delete a custom payment method |

## Recurring expenses

- Create recurring expenses tied to a book.
- Supported frequencies: monthly, quarterly, half-yearly, and yearly.
- Supported categories: insurance, pension, installment, utility, internet, rent, subscription, tax, and other.
- Store expense name, amount, category, frequency, next due date, and status.
- List recurring expenses ordered by next due date.
- Calculate a normalized monthly equivalent for each recurring expense.
- Calculate days until each expense is due.
- Derive display status from due date:
  - Overdue when the due date has passed.
  - Unpaid when due within seven days.
  - Paid when due later than seven days.
- Retrieve one recurring expense.
- Update recurring expense details and status.
- Mark an expense as paid:
  - Set status to paid.
  - Advance the next due date by its configured frequency.
  - Create a linked `EXPENSE` transaction automatically.
  - Recalculate the book balance atomically.
- Delete recurring expenses.
- Generate a recurring-expense summary containing:
  - Total monthly equivalent.
  - Number and amount due this month.
  - Next upcoming payment and days until due.
  - Current book balance.
  - Shortfall amount and shortfall flag.
  - Upcoming payment list.

### Recurring-expense routes

| Method | Route | Feature |
|---|---|---|
| POST | `/recurring-expense` | Create a recurring expense |
| GET | `/recurring-expense?bookId=:bookId` | List recurring expenses with derived fields |
| GET | `/recurring-expense/summary?bookId=:bookId` | Get recurring-expense summary |
| GET | `/recurring-expense/:id` | Get a recurring expense |
| PATCH | `/recurring-expense/:id` | Update a recurring expense |
| PATCH | `/recurring-expense/:id/mark-paid` | Post payment and advance due date |
| DELETE | `/recurring-expense/:id` | Delete a recurring expense |

## Savings goals

- Create savings goals tied to a book.
- Store goal name, target amount, deadline, optional icon, and saved amount.
- Default goal icon to `target` when no icon is supplied.
- Add deposits to a goal with optional note and date.
- Automatically increment `savedAmount` when a deposit is added.
- Reject deposits that would exceed the target amount.
- Remove deposits and automatically decrement `savedAmount`.
- Retrieve one goal with deposits newest-first.
- List goals ordered by deadline.
- Calculate goal progress percentage.
- Calculate remaining amount.
- Calculate months remaining until the deadline.
- Calculate the monthly amount needed to reach the target.
- Update goal name, target, deadline, and icon.
- Delete goals and cascade their deposits.

### Goal routes

| Method | Route | Feature |
|---|---|---|
| POST | `/goals` | Create a goal |
| GET | `/goals?bookId=:bookId` | List goals with progress metrics and deposits |
| GET | `/goals/:id` | Get a goal and its deposits |
| PATCH | `/goals/:id` | Update a goal |
| POST | `/goals/:id/deposits` | Add a goal deposit |
| DELETE | `/goals/deposits/:depositId` | Remove a deposit and reverse saved amount |
| DELETE | `/goals/:id` | Delete a goal |

## Emergency funds

- Log emergency-fund withdrawals and repayments for a book.
- Support `WITHDRAWAL` and `REPAYMENT` entry types.
- Store amount, remark, optional category, entry date, and book.
- Validate that amounts are positive.
- Prevent repayments larger than the current outstanding amount.
- Automatically create a linked financial transaction:
  - Withdrawal becomes an `EXPENSE`.
  - Repayment becomes an `INCOME`.
- Recalculate the book balance atomically after creating an entry.
- List emergency entries newest-first with cursor-based pagination.
- Return emergency-fund summary values:
  - Total borrowed.
  - Total repaid.
  - Net amount owed.
  - Most recent withdrawal.
- Delete an emergency entry and its linked transaction together.
- Recalculate the book balance after deletion.

### Emergency-fund routes

| Method | Route | Feature |
|---|---|---|
| POST | `/emergency` | Add a withdrawal or repayment |
| GET | `/emergency?bookId=:bookId&cursor=:cursor&limit=:limit` | Paginated emergency entries |
| GET | `/emergency/summary?bookId=:bookId` | Get emergency-fund summary |
| DELETE | `/emergency/:id` | Delete an entry and linked transaction |

## API-wide platform features

- NestJS modular architecture for authentication, users, books, transactions, categories, payment methods, recurring expenses, goals, and emergency funds.
- PostgreSQL persistence through Prisma and the PostgreSQL adapter.
- Prisma migrations for the evolving data model.
- UUID identifiers for primary entities.
- Automatic created/updated timestamps on persisted entities.
- Referential integrity and cascade/set-null behavior for related records.
- DTO validation using `class-validator`.
- Swagger/OpenAPI documentation at `/api/docs`.
- JWT bearer-auth scheme documented in Swagger.
- Configurable application port through `PORT`, defaulting to `3000`.
- CORS enabled for the configured production frontend and local development frontend ports.
- Standard success-response wrapper containing `success`, `statusCode`, `message`, and optional `data`.
- Global exception handling that:
  - Converts framework and unexpected errors into the common response shape.
  - Preserves HTTP status codes.
  - Logs error details through NestJS logging.
- Global response interceptor that wraps ordinary controller results in the common response shape.
- Build, development-watch, production-start, lint, unit-test, coverage, and e2e-test scripts are configured in `package.json`.

## Current implementation notes

These are relevant details discovered during the code review:

- All feature controllers are JWT-protected, but ownership checks are explicitly implemented only for book update/delete. Several book-scoped modules accept a `bookId` or entity ID without an explicit authenticated-user ownership check in their services.
- The `GET /books?userId=...` route takes the user ID from the query string rather than deriving it from the authenticated JWT.
- The service contains methods for retrieving default/system payment methods and categories by ID, but not all of those helper methods have public controller routes.
- An emergency-fund update DTO exists, but the emergency-fund controller currently exposes create, list, summary, and delete only; no update route is implemented.
- Swagger setup explicitly includes the core modules but does not list the recurring-expense, goals, or emergency-funds modules in the `include` array, even though those controllers are registered in the application module.
- There are no application feature tests in the repository’s listed source files; the configured Jest scripts are present, but this inventory was derived from implementation and schema inspection rather than test results.

