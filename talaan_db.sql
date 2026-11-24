-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 24, 2026 at 08:16 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `talaan_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `borrowers`
--

CREATE TABLE `borrowers` (
  `borrower_id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `barangay` varchar(100) DEFAULT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `borrowers`
--

INSERT INTO `borrowers` (`borrower_id`, `full_name`, `contact_number`, `address`, `created_at`, `barangay`, `is_archived`) VALUES
(1, 'Rene', '09088184444', NULL, '2026-11-22 18:37:43', 'San Juan', 1),
(2, 'Maria', '09088184444', NULL, '2026-11-22 19:28:34', 'San Miguel', 0),
(3, 'Saint Rene', '09088184444', NULL, '2026-11-23 05:24:54', 'Bangkal', 1);

-- --------------------------------------------------------

--
-- Table structure for table `installments`
--

CREATE TABLE `installments` (
  `installment_id` int(11) NOT NULL,
  `loan_id` int(11) NOT NULL,
  `due_date` date NOT NULL,
  `amount_due` decimal(12,2) NOT NULL,
  `amount_paid` decimal(12,2) DEFAULT 0.00,
  `status` varchar(20) DEFAULT 'UNPAID'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `installments`
--

INSERT INTO `installments` (`installment_id`, `loan_id`, `due_date`, `amount_due`, `amount_paid`, `status`) VALUES
(1, 1, '2026-11-23', 2200.00, 2200.00, 'PAID'),
(2, 1, '2026-11-24', 2200.00, 800.00, 'PARTIAL'),
(3, 1, '2026-11-25', 2200.00, 0.00, 'UNPAID'),
(4, 1, '2026-11-26', 2200.00, 0.00, 'UNPAID'),
(5, 1, '2026-11-27', 2200.00, 0.00, 'UNPAID'),
(6, 2, '2026-11-10', 2200.00, 2200.00, 'PAID'),
(7, 2, '2026-11-11', 2200.00, 2200.00, 'PAID'),
(8, 2, '2026-11-12', 2200.00, 2200.00, 'PAID'),
(9, 2, '2026-11-13', 2200.00, 2200.00, 'PAID'),
(10, 2, '2026-11-14', 2200.00, 2200.00, 'PAID'),
(11, 3, '2026-11-10', 556.00, 556.00, 'PAID'),
(12, 3, '2026-11-11', 555.00, 555.00, 'PAID');

-- --------------------------------------------------------

--
-- Table structure for table `loans`
--

CREATE TABLE `loans` (
  `loan_id` int(11) NOT NULL,
  `borrower_id` int(11) NOT NULL,
  `principal` decimal(12,2) NOT NULL,
  `interest_rate` decimal(5,2) DEFAULT 0.00,
  `total_amount` decimal(12,2) NOT NULL,
  `loan_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `payment_frequency` varchar(20) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'ACTIVE',
  `is_archived` tinyint(1) DEFAULT 0,
  `num_payments` int(11) NOT NULL,
  `archived_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `loans`
--

INSERT INTO `loans` (`loan_id`, `borrower_id`, `principal`, `interest_rate`, `total_amount`, `loan_date`, `due_date`, `payment_frequency`, `status`, `is_archived`, `num_payments`, `archived_at`) VALUES
(1, 1, 10000.00, 10.00, 11000.00, '2026-11-23', '2026-11-27', 'daily', 'ACTIVE', 1, 5, '2026-11-23 02:43:58'),
(2, 2, 10000.00, 10.00, 11000.00, '2026-11-10', '2026-11-14', 'daily', 'CLOSED', 0, 5, NULL),
(3, 3, 1010.00, 10.00, 1111.00, '2026-11-10', '2026-11-11', 'daily', 'CLOSED', 1, 2, '2026-11-23 13:28:19');

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `payment_id` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` datetime DEFAULT current_timestamp(),
  `remarks` text DEFAULT NULL,
  `loan_id` int(11) NOT NULL,
  `balance_after` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`payment_id`, `amount`, `payment_date`, `remarks`, `loan_id`, `balance_after`) VALUES
(1, 3000.00, '2026-11-23 02:42:09', 'cash', 1, 8000.00),
(2, 5990.00, '2026-11-23 04:39:57', 'cash', 2, 6000.00),
(3, 6000.00, '2026-11-23 04:55:47', 'cash', 2, 0.00),
(4, 1111.00, '2026-11-23 13:27:09', 'cash', 3, 133.32),
(5, 133.32, '2026-11-23 13:27:50', 'cash', 3, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `payment_allocations`
--

CREATE TABLE `payment_allocations` (
  `allocation_id` int(11) NOT NULL,
  `payment_id` int(11) NOT NULL,
  `installment_id` int(11) NOT NULL,
  `amount_allocated` decimal(12,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payment_allocations`
--

INSERT INTO `payment_allocations` (`allocation_id`, `payment_id`, `installment_id`, `amount_allocated`, `created_at`) VALUES
(1, 1, 1, 2200.00, '2026-11-22 18:42:09'),
(2, 1, 2, 800.00, '2026-11-22 18:42:09'),
(3, 2, 6, 2200.00, '2026-11-22 20:39:57'),
(4, 2, 7, 2200.00, '2026-11-22 20:39:57'),
(5, 2, 8, 1590.00, '2026-11-22 20:39:57'),
(6, 3, 8, 610.00, '2026-11-22 20:55:47'),
(7, 3, 9, 2200.00, '2026-11-22 20:55:47'),
(8, 3, 10, 2200.00, '2026-11-22 20:55:47'),
(9, 4, 11, 556.00, '2026-11-23 05:27:09'),
(10, 4, 12, 555.00, '2026-11-23 05:27:09');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) DEFAULT 'ADMIN'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `role`) VALUES
(1, 'admin', '$2a$10$AL8o.1ZkalLi7sf9fVIOt.ozLBvWTVJHJjD/yAZMdDbdFPioRuSt6', 'ADMIN');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `borrowers`
--
ALTER TABLE `borrowers`
  ADD PRIMARY KEY (`borrower_id`);

--
-- Indexes for table `installments`
--
ALTER TABLE `installments`
  ADD PRIMARY KEY (`installment_id`),
  ADD KEY `loan_id` (`loan_id`);

--
-- Indexes for table `loans`
--
ALTER TABLE `loans`
  ADD PRIMARY KEY (`loan_id`),
  ADD KEY `borrower_id` (`borrower_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`payment_id`),
  ADD KEY `fk_payments_loan` (`loan_id`);

--
-- Indexes for table `payment_allocations`
--
ALTER TABLE `payment_allocations`
  ADD PRIMARY KEY (`allocation_id`),
  ADD UNIQUE KEY `uq_payment_installment` (`payment_id`,`installment_id`),
  ADD KEY `idx_allocations_installment` (`installment_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `uq_users_username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `borrowers`
--
ALTER TABLE `borrowers`
  MODIFY `borrower_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `installments`
--
ALTER TABLE `installments`
  MODIFY `installment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `loans`
--
ALTER TABLE `loans`
  MODIFY `loan_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `payment_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `payment_allocations`
--
ALTER TABLE `payment_allocations`
  MODIFY `allocation_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `installments`
--
ALTER TABLE `installments`
  ADD CONSTRAINT `installments_ibfk_1` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`loan_id`);

--
-- Constraints for table `loans`
--
ALTER TABLE `loans`
  ADD CONSTRAINT `loans_ibfk_1` FOREIGN KEY (`borrower_id`) REFERENCES `borrowers` (`borrower_id`);

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_payments_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`loan_id`) ON UPDATE CASCADE;

--
-- Constraints for table `payment_allocations`
--
ALTER TABLE `payment_allocations`
  ADD CONSTRAINT `fk_allocations_installment` FOREIGN KEY (`installment_id`) REFERENCES `installments` (`installment_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_allocations_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`payment_id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
