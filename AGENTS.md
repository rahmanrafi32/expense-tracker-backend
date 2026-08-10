# AGENTS.md — expense-tracker-backend

Read this file completely before writing or changing code. These project-specific
rules take precedence over general defaults.

## Project

- Name: `expense-tracker-backend`
- Purpose: NestJS REST API for budgeting, transactions, recurring expenses,
  savings goals, emergency funds, sinking funds, cash-flow forecasts, and
  financial insights.
- Stack: TypeScript, NestJS 11, Prisma 7, PostgreSQL 16, and the Prisma
  PostgreSQL driver adapter (`@prisma/adapter-pg` over `pg`).
- Authentication: JWT with `@nestjs/jwt` and `passport-jwt`; passwords are
  hashed with `bcrypt`.
- Package manager: Yarn. `yarn.lock` is committed; do not introduce a
  `package-lock.json`.

## Setup

```bash
yarn install                 # runs prisma generate through postinstall
docker compose up -d postgres
```

The root `.env` is local configuration and is ignored by Git. Do not overwrite
it or commit it. Add new keys only when they are required and consistent with
the existing configuration. The repository has no `.env.example`.

Prisma reads `DATABASE_URL` through `prisma.config.ts`; the schema is the
directory `src/prisma/`, not a root-level `prisma/` directory.

## Commands

| Task | Command |
|---|---|
| Dev server (watch) | `yarn start:dev` |
| Debug server | `yarn start:debug` |
| Build | `yarn build` |
| Start (production; build first) | `yarn start:prod` |
| Lint | `yarn lint` — includes `--fix` and mutates files |
| Format | `yarn format` |
| Unit tests | `yarn test` |
| Test (watch) | `yarn test:watch` |
| Test (coverage) | `yarn test:cov` |
| Test (e2e) | `yarn test:e2e` — requires a `test/` setup, which is currently absent |
| Typecheck | `yarn exec tsc --noEmit` |
| Prisma client | `yarn prisma generate` |
| Prisma migration | `yarn prisma migrate dev --name <description>` |
| Prisma deploy | `yarn prisma migrate deploy` |
| Prisma Studio | `yarn prisma studio` |

Before declaring an implementation task complete, run `yarn build` and `yarn lint`. Because lint auto-fixes, inspect `git diff` afterward. Never
use `// @ts-ignore` or an eslint-disable comment to hide an underlying issue.

## Directory map

| Path | Purpose |
|---|---|
| `src/main.ts` | Bootstrap, CORS, global validation, response interceptor, exception filter, and Swagger |
| `src/app.module.ts` | Root module and global configuration/throttler registration |
| `src/auth/` | Signup, login, JWT strategy, refresh/logout, and password reset |
| `src/user/` | User accounts |
| `src/book/` | Books/ledgers that own transactions and planning records |
| `src/transaction/` | Income and expense transactions, scoped to a book |
| `src/category/` | System, default, and user categories |
| `src/payment-method/` | System, default, and user payment methods |
| `src/recurring-expense/` | Recurring expense scheduling and posting |
| `src/balance/` | Shared `BalanceService`, used by transaction and recurring-expense flows |
| `src/cash-flow/` | Cash-flow reporting and projections; imports spending-trends services |
| `src/spending-trends/` | Spending trend analytics |
| `src/insights/` | Monthly and yearly financial insights; registered as its own module/controller |
| `src/goals/` | Savings goals and deposits |
| `src/emergency-funds/` | Emergency-fund entries, withdrawals, repayments, and summaries |
| `src/sinking-funds/` | Sinking funds and deposits |
| `src/email-notification/` | Password-reset email delivery through Resend |
| `src/database/` | Global Prisma service and database module |
| `src/prisma/` | Prisma schema fragments, `schema.prisma`, and migrations |
| `src/common/` | Shared response DTOs, interceptor, exception filter, types, and exports |
| `src/utils/` | Shared utilities |
| `**/*.spec.ts` | Colocated unit tests; none are currently present |
| `test/` | Intended e2e test location; currently absent |
| `docker-compose.yml` | Local PostgreSQL 16 service and persistent volume |
| `prisma.config.ts` | Prisma 7 schema, datasource, and migration-path configuration |

## Code style and NestJS conventions

- Use TypeScript and avoid introducing `any` in new code.
- Use Prettier (`yarn format`) and ESLint 9 flat config with
  `typescript-eslint` and `eslint-config-prettier`.
- Follow Nest naming: `user.controller.ts`, `user.service.ts`,
  `user.module.ts`, `create-user.dto.ts`, and similar names.
- Keep controllers thin; business logic and Prisma access belong in services.
- Use dependency injection; do not manually construct Nest services.
- Validate external request data with `class-validator` DTOs and the global
  `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, and `transform` are
  enabled). Auth login/refresh/logout currently use body interfaces or selected
  body fields; use DTOs when changing those endpoints.
- Add `@ApiProperty`/`@ApiPropertyOptional` to DTO fields and
  `@ApiOperation`/related decorators to new controller routes.
- Throw Nest `HttpException` subclasses, not generic errors, for request-level
  failures. Preserve the existing global response envelope and exception
  filter.

## Prisma rules

- Prisma schema changes belong in `src/prisma/` and require a migration. Use
  Prisma’s configured schema path; do not create a root `prisma/` directory.
- Commit generated migration directories. Never edit an applied migration.
- Never hand-edit generated Prisma client output.
- `PrismaService` uses `@prisma/adapter-pg` and `DATABASE_URL`.

## Authentication and security

- Keep JWT secrets, `DATABASE_URL`, and `RESEND_API_KEY` in environment
  configuration; never hardcode or log real secrets.
- Passwords must be hashed with `bcrypt.hash` on write and checked with
  `bcrypt.compare` on read. Never store or log plaintext passwords.
- Password-reset email delivery uses Resend. Preserve the existing
  configuration-based key and sender settings; do not hardcode credentials.
- `ThrottlerModule` is globally registered with a 10-request/60-second
  default. The forgot-password route has an explicit 2-request/60-second
  limit. Apply appropriate throttling to any new rate-sensitive public route.
- Validate and authorize ownership of all user- and book-scoped resources.

## Git conventions

- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, etc.
- Never commit `.env`, `dist/`, `coverage/`, `node_modules/`, or generated
  local artifacts.
- When relevant, describe what changed, why, and how it was tested.

## Agent efficiency

- Preserve unrelated working-tree changes. Inspect before editing overlapping
  files.
- Prefer extending an existing module over creating a new feature module.
- State assumptions briefly and proceed when repository evidence is sufficient.
- End with a short summary of what changed and the verification performed.
