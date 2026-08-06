# Expense Tracker Backend

REST API for personal budgeting, transaction tracking, recurring bills, savings goals, emergency funds, sinking funds, cash-flow forecasting, and financial insights.

Built with NestJS, TypeScript, PostgreSQL, and Prisma. The API is organized around a user's financial **books**: each book represents a budget, account, or spending plan with its own currency, balance, income, expenses, and planning features.

## Highlights

- JWT access-token authentication with rotating, hashed refresh tokens
- User profiles and account lifecycle management
- Multiple books with currencies: `USD`, `EUR`, `GBP`, `BDT`, and `INR`
- Income and expense transactions with automatic balance recalculation
- Cursor-based pagination for transactions and emergency-fund entries
- System, default, and user-owned categories and payment methods
- Recurring expenses with due dates, normalized monthly costs, and automatic payment posting
- Savings goals and sinking funds with deposits and progress metrics
- Emergency-fund withdrawals, repayments, linked transactions, and summaries
- Projected cash-flow timelines with shortfall detection
- Monthly dashboards and yearly financial insights
- Global validation, response normalization, centralized errors, CORS, and Swagger

## Technology

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | NestJS 11 |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM and migrations | Prisma 7 |
| Authentication | Passport JWT, bcrypt |
| Documentation | Swagger / OpenAPI |
| Package manager | Yarn |

## Quick start

### Prerequisites

- Node.js 20+ recommended
- Yarn
- Docker Desktop (recommended for local PostgreSQL)

### Install and configure

```bash
yarn install
```

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://expense_user:expense_password@localhost:5432/expense_tracker?schema=public"

POSTGRES_USER=expense_user
POSTGRES_PASSWORD=expense_password
POSTGRES_DB=expense_tracker

PORT=3000
JWT_SECRET="replace-this-with-a-long-random-secret"
JWT_EXPIRATION_TIME="1d"
JWT_REFRESH_TOKEN_EXPIRATION=7
```

`DATABASE_URL` is required. `PORT` defaults to `3000`; the JWT secret defaults to a development placeholder if omitted, so set it in every non-local environment.

### Start PostgreSQL, migrate, and run

```bash
docker compose up -d postgres
yarn prisma migrate deploy

# Development
yarn start:dev

# Production
yarn build
yarn start:prod
```

The API is available at `http://localhost:3000`. Swagger UI is available at `http://localhost:3000/api/docs`.

## Response format

Successful endpoints use a global response envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": {}
}
```

Errors use the same top-level structure:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "data": {}
}
```

Unless noted otherwise, protected endpoints require:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

IDs are UUIDs. Dates use ISO 8601 strings.

## Authentication API

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | Public | Register a user |
| `POST` | `/auth/login` | Public | Validate credentials and issue tokens |
| `POST` | `/auth/refresh` | Public | Rotate a refresh token |
| `POST` | `/auth/logout` | Bearer JWT | Revoke a refresh token |

Signup body:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "P@ssw0rd!",
  "profilePic": "https://example.com/avatar.jpg",
  "address": "Dhaka, Bangladesh",
  "phoneNumber": "+8801712345678",
  "country": "Bangladesh"
}
```

Password must be at least six characters and contain a special character. Email addresses must be valid and unique.

Login body:

```json
{ "email": "jane@example.com", "password": "P@ssw0rd!" }
```

The response contains `access_token` and `refresh_token`. Refresh-token requests use:

```json
{ "refresh_token": "<refresh-token>" }
```

Refresh tokens are stored as SHA-256 hashes, expire after `JWT_REFRESH_TOKEN_EXPIRATION` days (default `7`), and are rotated on refresh.

## User API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/user/get/all-users` | List users |
| `GET` | `/user/get/:id` | Get a user by ID |
| `PATCH` | `/user/update/:id` | Partially update profile fields |
| `DELETE` | `/user/delete/:id` | Delete a user and related data |

Passwords are never returned. User deletion cascades related books, tokens, categories, and payment methods according to the data model.

## Books API

Books are the parent resource for transactions and most planning features. `bookTotalAmount` is calculated as total income minus total expenses.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/books/create` | Create a book |
| `GET` | `/books?userId=<userId>` | List books for a user |
| `GET` | `/books/:id` | Get a book |
| `PATCH` | `/books/:id` | Update name, currency, or monthly income |
| `DELETE` | `/books/:id` | Delete a book and related records |

Create body:

```json
{
  "name": "Monthly Budget",
  "userId": "00000000-0000-4000-8000-000000000000",
  "currency": "BDT",
  "monthlyIncome": 51700
}
```

Supported currencies are `USD`, `EUR`, `GBP`, `BDT`, and `INR`.

## Transactions API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/transactions/add` | Create an income or expense |
| `GET` | `/transactions?bookId=<bookId>&cursor=<cursor>&limit=<limit>` | List transactions and totals |
| `GET` | `/transactions/:id` | Get one transaction |
| `PATCH` | `/transactions/:id` | Update transaction fields |
| `DELETE` | `/transactions/:id` | Delete a transaction |

Create body:

```json
{
  "bookId": "00000000-0000-4000-8000-000000000000",
  "type": "EXPENSE",
  "date": "2026-08-06",
  "amount": 450,
  "remark": "Groceries",
  "category": "Food",
  "paymentMethod": "Debit Card"
}
```

`type` is `INCOME` or `EXPENSE`. Category and payment-method names resolve against shared and user-owned records; missing names can be created automatically. List responses are newest-first and include paginated results, `nextCursor`, `totalIncome`, and `totalExpense`. The default page size is `20`. Create, update, and delete operations recalculate the book balance.

## Categories API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/categories` | Get system, default, and user categories |
| `GET` | `/categories?isIncome=true` | Filter available categories by income flag |
| `GET` | `/categories/user-specific` | Get current user's categories |
| `GET` | `/categories/default` | Get shared default categories |
| `GET` | `/categories/system` | Get read-only system categories |
| `GET` | `/categories/system-expenses` | Get expense/sinking-fund categories |
| `POST` | `/categories` | Create a custom category |
| `PUT` | `/categories/:id` | Rename a custom category |
| `DELETE` | `/categories/:id` | Delete a custom category |

Body: `{ "name": "Subscriptions" }`. Names are limited to 50 characters. System/default categories cannot be modified, and categories referenced by transactions cannot be deleted.

## Payment-method API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/payment-methods` | Get system, default, and user methods |
| `GET` | `/payment-methods/user-specific` | Get custom user methods |
| `POST` | `/payment-methods` | Create a custom method |
| `PUT` | `/payment-methods/:id` | Rename a custom method |
| `DELETE` | `/payment-methods/:id` | Delete a custom method |

Body: `{ "name": "Mobile Banking" }`. Names are limited to 50 characters. System/default methods are protected, and methods referenced by transactions cannot be deleted.

## Recurring-expense API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/recurring-expense` | Create a recurring expense |
| `GET` | `/recurring-expense?bookId=<bookId>` | List bills with derived fields |
| `GET` | `/recurring-expense/summary?bookId=<bookId>` | Get summary statistics |
| `GET` | `/recurring-expense/:id` | Get one bill |
| `PATCH` | `/recurring-expense/:id` | Update a bill |
| `PATCH` | `/recurring-expense/:id/mark-paid` | Post payment and advance due date |
| `DELETE` | `/recurring-expense/:id` | Delete a bill |

Create body:

```json
{
  "bookId": "00000000-0000-4000-8000-000000000000",
  "name": "Internet Bill",
  "amount": 1200,
  "frequency": "MONTHLY",
  "category": "Internet",
  "paymentMethod": "Bank Transfer",
  "nextDueDate": "2026-08-15T00:00:00.000Z"
}
```

Frequencies are `MONTHLY`, `QUARTERLY`, `HALF_YEARLY`, and `YEARLY`. Listing returns `monthlyEquivalent` and `daysUntilDue`; status is derived as `OVERDUE`, `UNPAID`, or `PAID`. Marking a bill paid creates a linked expense transaction, advances its due date, and recalculates the book balance.

## Goals API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/goals` | Create a savings goal |
| `GET` | `/goals?bookId=<bookId>` | List goals with progress metrics |
| `GET` | `/goals/:id` | Get a goal and deposits |
| `PATCH` | `/goals/:id` | Update goal details |
| `POST` | `/goals/:id/deposits` | Add a deposit |
| `DELETE` | `/goals/deposits/:depositId` | Remove a deposit |
| `DELETE` | `/goals/:id` | Delete a goal |

Goal body:

```json
{
  "bookId": "00000000-0000-4000-8000-000000000000",
  "name": "Annual Vacation",
  "targetAmount": 50000,
  "deadline": "2026-12-31T00:00:00.000Z",
  "icon": "plane"
}
```

Responses include progress percentage, remaining amount, months remaining, monthly amount needed, and deposits. Deposits cannot exceed the target; removing a deposit reverses the saved amount. The default icon is `target`.

## Emergency-fund API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/emergency` | Add a withdrawal or repayment |
| `GET` | `/emergency?bookId=<bookId>&cursor=<cursor>&limit=<limit>` | List entries, newest-first |
| `GET` | `/emergency/summary?bookId=<bookId>` | Get borrowed, repaid, and owed totals |
| `DELETE` | `/emergency/:id` | Delete an entry and linked transaction |

Create body:

```json
{
  "bookId": "00000000-0000-4000-8000-000000000000",
  "type": "WITHDRAWAL",
  "amount": 3000,
  "remark": "Medical expense",
  "category": "Health",
  "date": "2026-08-06"
}
```

Types are `WITHDRAWAL` and `REPAYMENT`. Withdrawals create linked `EXPENSE` transactions; repayments create linked `INCOME` transactions. Repayment amounts cannot exceed the outstanding amount. Default page size is `20`.

## Sinking-funds API

Sinking funds are planned savings for known future expenses such as vehicle maintenance, annual fees, or repairs.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/sinking-funds` | Create a sinking fund |
| `GET` | `/sinking-funds?bookId=<bookId>` | List funds with progress metrics |
| `GET` | `/sinking-funds/:id` | Get one fund and deposits |
| `PATCH` | `/sinking-funds/:id` | Update fund details |
| `POST` | `/sinking-funds/:id/deposits` | Add a deposit |
| `DELETE` | `/sinking-funds/deposits/:depositId` | Remove a deposit |
| `DELETE` | `/sinking-funds/:id` | Delete a fund |

Create body:

```json
{
  "bookId": "00000000-0000-4000-8000-000000000000",
  "name": "Car Servicing",
  "targetAmount": 15000,
  "deadline": "2026-11-30",
  "category": "Vehicle"
}
```

List responses include `progressPct`, `remaining`, `monthlyNeeded`, `monthsLeft`, and deposits. Deposits cannot push `savedAmount` above `targetAmount`.

## Cash-flow API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/cash-flow?bookId=<bookId>&days=<days>` | Project a daily cash-flow timeline |

`days` defaults to `90` and must be between `30` and `365`. Projections consider monthly income, expected monthly expenses, recurring bills, and unfunded sinking-fund deadlines. Each item contains `date`, `balance`, and `isShortfall`.

## Insights API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/insights/monthly-dashboard?bookId=<bookId>&month=<month>&year=<year>` | Combined monthly dashboard |
| `GET` | `/insights/monthly-overview?bookId=<bookId>&month=<month>&year=<year>` | Income, expenses, savings, savings rate |
| `GET` | `/insights/category-breakdown?bookId=<bookId>&month=<month>&year=<year>` | Top expense categories |
| `GET` | `/insights/yearly-trend?bookId=<bookId>&year=<year>` | Monthly income, expenses, and net |

The monthly dashboard combines overview, category breakdown, fixed-vs-variable expenses, payment-method distribution, and the top five expense transactions. `month` must be between `1` and `12`.

> The insights controller currently has no JWT guard in source, so these routes are public by implementation. Add a guard before exposing them to untrusted clients if this is not intentional.

## Swagger and API discovery

Swagger UI: `http://localhost:3000/api/docs`.

Use **Authorize** and enter `Bearer <access_token>`. The OpenAPI setup currently explicitly includes auth, user, book, transaction, category, and payment-method modules. The newer recurring-expense, goal, emergency, sinking-fund, cash-flow, and insights routes are implemented and available through REST, but may not appear in Swagger until their modules are added to the `include` list in `src/main.ts`.

## Project structure

```text
src/
├── auth/                 JWT login, signup, refresh, logout
├── user/                 User profile management
├── book/                 Books and balances
├── transaction/          Income and expense transactions
├── category/             Category catalogs and custom categories
├── payment-method/       Payment-method catalogs and custom methods
├── recurring-expense/    Recurring bills and automatic payment posting
├── goals/                Savings goals and deposits
├── emergency-funds/      Emergency borrowing and repayment
├── sinking-funds/        Planned future-expense savings
├── cash-flow/            Projected daily cash-flow timeline
├── insights/             Monthly and yearly analytics
├── database/             Prisma service and database module
├── prisma/               Schema fragments and migrations
└── common/               Response envelope, filters, interceptors, and types
```

## Development commands

```bash
yarn start:dev       # Run with file watching
yarn build           # Compile the application
yarn lint            # Run ESLint and apply fixes
yarn format          # Format TypeScript files
yarn test            # Run unit tests
yarn test:watch      # Run tests in watch mode
yarn test:cov        # Generate coverage
yarn test:e2e        # Run end-to-end tests
yarn prisma studio  # Inspect the database locally
```

## Database workflow

Prisma schema files are in `src/prisma/`; migrations are in `src/prisma/migrations/`.

```bash
yarn prisma migrate deploy
yarn prisma migrate dev --name describe-your-change
yarn prisma generate
```

Do not commit secrets or a production `.env`. Use a strong `JWT_SECRET`, restrict database access, and run migrations as part of deployment.

## License

This project is currently marked `UNLICENSED` in `package.json`.
