# In-Dept-Pendent: A Borrower Record and Payment Tracking System for Small Community Lenders

## System Overview
**In-Dept-Pendent** is a full-stack web application designed for small community lenders to record borrowers, generate installment schedules, track payments, calculate post-maturity overdue interest, and preserve financial records through a non-destructive Archive Folder.

## Group Members
- **Joshua Ranoco**
- **Mikko Cudiamat**
- *(Add your full name here if needed)*

## Technology Stack
- **Backend:** Java 21, Spring Boot 4.2.0 (Spring Web & Spring JDBC), Maven
- **Frontend:** Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Database:** XAMPP MySQL (`talaan_db`)

## Key Features Implemented
- **Secure User Authentication:** Account registration and login backed by MySQL (`users` table) with BCrypt password hashing (`BCryptPasswordEncoder`).
- **Borrower & Loan Management:** Supports creating and editing borrower profiles (`full_name`, `barangay`, `contact_number`) and loan terms (`principal`, `interest_rate`, `num_payments`, and daily, weekly, fortnightly, or monthly schedules).
- **Automated Installment Generation:** Automatically splits total loan amounts into scheduled due dates starting on the loan date, rounding regular installments to whole pesos and adjusting the final installment to match the exact total.
- **Sequential FIFO Payment Allocation:** Recording a payment automatically distributes funds across unpaid or partially paid installments starting from the earliest due date, recording exact splits in `payment_allocations` and updating `balance_after` on every transaction.
- **Post-Maturity Daily Overdue Interest (1% per day):** Loans with a remaining unpaid balance past their final maturity date automatically accrue 1% daily overdue interest on the remaining balance (calculated dynamically in Philippine Standard Time, `Asia/Manila`).
- **Archive-Only Financial Audit Rule (No-Delete Policy):** Records are never permanently deleted from the database. Moving a record to the Archive Folder sets `is_archived = 1` and timestamps `archived_at`, allowing full restoration and preserving a complete financial audit trail.
- **Dashboard, Calendar, & Analytics Views:** Provides real-time totals (total lent, total collected, collectible due, overdue accounts), a monthly due-date calendar, and collection analytics.

## Database Architecture (`talaan_db`)
The MySQL relational schema consists of 6 normalized tables:
1. **`users`** (`user_id`, `username`, `password_hash`, `role`, `created_at`) — Stores authenticated lender accounts.
2. **`borrowers`** (`borrower_id`, `full_name`, `contact_number`, `address`, `barangay`, `is_archived`, `created_at`) — Stores borrower personal details and archive flag.
3. **`loans`** (`loan_id`, `borrower_id`, `principal`, `interest_rate`, `total_amount`, `loan_date`, `due_date`, `payment_frequency`, `status`, `num_payments`, `is_archived`, `archived_at`) — Stores loan contracts and maturity dates.
4. **`installments`** (`installment_id`, `loan_id`, `due_date`, `amount_due`, `amount_paid`, `status`) — Tracks individual scheduled due dates (`UNPAID`, `PARTIAL`, `PAID`, `VOID`).
5. **`payments`** (`payment_id`, `loan_id`, `amount`, `payment_date`, `remarks`, `balance_after`) — Logs every payment transaction, payment method, and remaining balance.
6. **`payment_allocations`** (`allocation_id`, `payment_id`, `installment_id`, `amount_allocated`, `created_at`) — Links each payment to the exact installment(s) it satisfied.

## Backend Software Architecture (`com.talaan.ledger`)
The Java Spring Boot backend follows a strict 4-layer architecture:
- **Controller Layer (`controller/`):** `AuthController` and `LedgerController` handle HTTP REST requests (`/api/auth/*` and `/api/ledger/*`) and return structured JSON responses.
- **Service Layer (`service/`):** `AuthService` and `LedgerService` enforce business rules inside `@Transactional` boundaries (schedule math, FIFO payment splitting, 1% daily overdue calculator, soft-archiving, and undo logic).
- **Data Access Layer (`dao/`):** `UserDAO`, `BorrowerDAO`, `LoanDAO`, `InstallmentDAO`, `PaymentDAO`, and `PaymentAllocationDAO` execute parameterized SQL queries using Spring `JdbcTemplate` and `RowMapper` with zero SQL `DELETE` statements.
- **Model Layer (`model/`):** `User`, `Borrower`, `Loan`, `Installment`, `Payment`, and `PaymentAllocation` map 1:1 to the database tables.

## How to Run Locally

### Prerequisites
- **Java Development Kit (JDK) 21**
- **XAMPP** (for running the local MySQL server)
- **Maven** (or use the included Maven wrapper `./mvnw`)

### 1. Set Up the Database (XAMPP)
1. Open the **XAMPP Control Panel** and click **Start** on **Apache** and **MySQL**.
2. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) and create a new database named **`talaan_db`**.
3. Select **`talaan_db`** on the left sidebar, click the **Import** tab at the top, choose **`talaan_db.sql`** from this repository, and click **Import** (or **Go**).
4. Ensure MySQL is running on port `3306` with the default username `root` and a blank password (matching `src/main/resources/application.properties`).

### 2. Clone & Run the Application
1. **Clone the repository:**
   ```bash
   git clone https://github.com
   cd In-Dept-Pendent
   ```
2. **Run the Spring Boot backend:**
   - **Using VS Code:** Open `src/main/java/com/talaan/ledger/LedgerApplication.java` and click **Run**.
   - **Using Terminal:**
     ```bash
     ./mvnw spring-boot:run
     ```
3. **Open in your browser:**
   Navigate to `http://localhost:8080` to use the application.