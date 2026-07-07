# Expense Tracker API — Rules, Payloads and Response Structure

This document lists the API endpoints, request payloads and example responses for the Expense Tracker backend.

Common response format
----------------------
All endpoints return a JSON object with this shape (wrapped by `CommonResponse`):

{
  "success": true | false,
  "statusCode": number,
  "message": string,
  "data": any (optional)
}

Authentication
--------------
Base path: `/auth`

1) POST /auth/login
- Payload:
  {
    "email": "user@example.com",
    "password": "P@ssw0rd!"
  }
- Successful response (200):
  {
    "success": true,
    "statusCode": 200,
    "message": "Logged in",
    "data": {
      "access_token": "<jwt>",
      "refresh_token": "<refresh-token>",
      "user": { /* user object */ }
    }
  }

2) POST /auth/signup
- Payload: (CreateUserDto)
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "P@ssw0rd!",
    "profilePic": "https://...",     // optional
    "address": "123 Main St",        // optional
    "phoneNumber": "+8801...",       // optional
    "country": "Bangladesh"          // optional
  }
- Successful response (201): CommonResponse with created user in `data`.

3) POST /auth/refresh
- Payload:
  { "refresh_token": "<refresh-token>" }
- Response: new access token (CommonResponse.data)

4) POST /auth/logout
- Requires Authorization: Bearer <access_token>
- Payload:
  { "refresh_token": "<refresh-token>" }
- Response: success message

User endpoints
--------------
Base path: `/user` (all endpoints require Authorization header)

- GET /user/get/all-users
  - Returns list of users

- GET /user/get/:id
  - Returns a single user

- PATCH /user/update/:id
  - Payload: (UpdateUserDto) — partial of CreateUserDto
  - Returns updated user

- DELETE /user/delete/:id
  - Deletes and returns the deleted user

Books
-----
Base path: `/books` (requires Authorization)

- POST /books/create
  - Payload (CreateBookDto):
    {
      "name": "Monthly Budget",
      "userId": "<user-uuid>",
      "transactionAmount": 0
    }
  - Response: created book (CommonResponse.data)

- GET /books?userId=<userId>
  - Returns books for provided user

- GET /books/:id
  - Returns single book

- PATCH /books/:id
  - Payload (UpdateBookDto): partial fields

- DELETE /books/:id
  - Deletes the book

Transactions
------------
Base path: `/transactions` (requires Authorization)

- POST /transactions/add
  - Payload (CreateTransactionDto):
    {
      "bookId": "<book-uuid>",
      "type": "INCOME" | "EXPENSE",
      "date": "YYYY-MM-DD",
      "amount": 100.5,
      "remark": "optional",
      "category": "optional",
      "paymentMethod": "optional"
    }
  - Response: created transaction in `data` (status 201)

- GET /transactions?bookId=<bookId>
  - Returns transactions for a book

- GET /transactions/:id
  - Returns single transaction

- PATCH /transactions/:id
  - Payload (UpdateTransactionDto): any of the transaction fields (optional)

- DELETE /transactions/:id
  - Deletes the transaction

Categories
----------
Base path: `/categories` (requires Authorization)

- GET /categories
  - Returns global categories + user categories

- GET /categories/user-specific
  - Returns only the categories created by the authenticated user

- POST /categories
  - Payload (CreateCategoryDto): { "name": "Food" }
  - Returns created category

- PUT /categories/:id
  - Payload (UpdateCategoryDto): { "name": "New name" }

- DELETE /categories/:id
  - Deletes a category

Payment methods
---------------
Base path: `/payment-methods` (requires Authorization)

- GET /payment-methods
  - Returns global + user payment methods

- GET /payment-methods/user-specific
  - Returns only user-created methods

- POST /payment-methods
  - Payload (CreatePaymentMethodDto): { "name": "Credit Card" }

- PUT /payment-methods/:id
  - Payload (UpdatePaymentMethodDto): { "name": "Updated name" }

- DELETE /payment-methods/:id
  - Deletes a payment method

Notes & rules
-------------
- All protected routes require an `Authorization: Bearer <access_token>` header.
- Validation rules are enforced via `class-validator` on DTOs — invalid payloads return 400 with validation messages.
- Dates should be ISO 8601 date strings (YYYY-MM-DD) as validated by `IsDateString`.

Viewing interactive docs
-------------------------
After installing dependencies and running the server, open:

`http://localhost:<PORT>/api/docs`

This exposes Swagger UI with the documented routes, DTOs and models.


If you want, I can also:
- Add more precise response schemas per-route (e.g. ApiOkResponse({ type: SomeDto }))
- Add example responses inline in controllers


