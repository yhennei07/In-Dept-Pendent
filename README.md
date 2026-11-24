# Talaan Load Ledger (`In-Dept-Pendent`)

A web-based load and transaction ledger application built with **Java Spring Boot**, **MySQL**, and **JavaScript**.

## Tech Stack
- **Backend:** Java 21, Spring Boot, Maven
- **Frontend:** HTML5, CSS, JavaScript (ES Modules)
- **Database:** MySQL (via XAMPP)

## Prerequisites
- **Java Development Kit (JDK) 21**
- **XAMPP** (for running the local MySQL server)
- **Maven** (or use the included Maven wrapper `./mvnw`)

## How to Run Locally

### 1. Start the Database (XAMPP)
1. Open the **XAMPP Control Panel** and click **Start** on **Apache** and **MySQL**.
2. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) and create a new database named **`talaan`** (matching `spring.datasource.url` in `src/main/resources/application.properties`).
3. Ensure MySQL is running on port `3306` with the default username `root` and a blank password.

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