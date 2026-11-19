-- Payroll demo database (SQLite). Amounts are whole VND (no fractional unit).
CREATE TABLE departments (
  id   INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);
CREATE TABLE employees (
  id            INTEGER PRIMARY KEY,
  employee_no   TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  hired_on      TEXT NOT NULL,
  terminated_on TEXT,
  CHECK (terminated_on IS NULL OR terminated_on >= hired_on)
);
-- Effective-dated salary: one row per change, valid_to NULL = current.
CREATE TABLE salary_history (
  id          INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  base_salary INTEGER NOT NULL CHECK (base_salary > 0),
  valid_from  TEXT NOT NULL,
  valid_to    TEXT,
  reason      TEXT,
  UNIQUE (employee_id, valid_from),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE TABLE pay_components (
  id      INTEGER PRIMARY KEY,
  code    TEXT NOT NULL UNIQUE,
  name    TEXT NOT NULL,
  kind    TEXT NOT NULL CHECK (kind IN ('earning', 'deduction')),
  taxable INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE payroll_periods (
  id      INTEGER PRIMARY KEY,
  period  TEXT NOT NULL UNIQUE,            -- 'YYYY-MM'
  status  TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'paid')),
  paid_on TEXT
);
-- A payslip is a snapshot: department and base salary are copied at calculation time.
CREATE TABLE payslips (
  id            INTEGER PRIMARY KEY,
  period_id     INTEGER NOT NULL REFERENCES payroll_periods(id),
  employee_id   INTEGER NOT NULL REFERENCES employees(id),
  department_id INTEGER NOT NULL REFERENCES departments(id),
  base_salary   INTEGER NOT NULL,
  UNIQUE (period_id, employee_id)
);
CREATE TABLE payslip_lines (
  id           INTEGER PRIMARY KEY,
  payslip_id   INTEGER NOT NULL REFERENCES payslips(id),
  component_id INTEGER NOT NULL REFERENCES pay_components(id),
  amount       INTEGER NOT NULL CHECK (amount >= 0),
  UNIQUE (payslip_id, component_id)
);
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id  INTEGER NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  old_value  TEXT,
  new_value  TEXT
);
CREATE INDEX idx_salary_employee ON salary_history(employee_id, valid_from);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);

INSERT INTO departments VALUES (1, 'ENG', 'Engineering'), (2, 'SALES', 'Sales'), (3, 'HR', 'Human Resources');
INSERT INTO employees VALUES
 (1, 'E001', 'Nguyen Van An',  1, '2024-03-01', NULL),
 (2, 'E002', 'Tran Thi Binh',  1, '2025-01-15', NULL),
 (3, 'E003', 'Le Minh Chau',   2, '2023-07-10', NULL),
 (4, 'E004', 'Pham Quoc Dung', 2, '2025-06-01', NULL),
 (5, 'E005', 'Hoang Thu Ha',   3, '2022-11-20', '2026-09-30');
INSERT INTO salary_history (employee_id, base_salary, valid_from, valid_to, reason) VALUES
 (1, 25000000, '2024-03-01', '2025-04-01', 'hire'),
 (1, 30000000, '2025-04-01', '2026-10-01', 'annual review'),
 (1, 34000000, '2026-10-01', NULL,         'promotion'),
 (2, 22000000, '2025-01-15', NULL,         'hire'),
 (3, 18000000, '2023-07-10', '2026-01-01', 'hire'),
 (3, 20000000, '2026-01-01', NULL,         'annual review'),
 (4, 15000000, '2025-06-01', NULL,         'hire'),
 (5, 21000000, '2022-11-20', NULL,         'hire');
INSERT INTO pay_components VALUES
 (1, 'BASE', 'Base salary',       'earning',   1),
 (2, 'OT',   'Overtime',          'earning',   1),
 (3, 'MEAL', 'Meal allowance',    'earning',   0),
 (4, 'SI',   'Social insurance',  'deduction', 0),
 (5, 'PIT',  'Personal income tax', 'deduction', 0);
INSERT INTO payroll_periods VALUES (1, '2026-09', 'paid', '2026-10-05'), (2, '2026-10', 'approved', NULL);
INSERT INTO payslips VALUES
 (1, 1, 1, 1, 30000000), (2, 1, 2, 1, 22000000), (3, 1, 3, 2, 20000000), (4, 1, 4, 2, 15000000), (5, 1, 5, 3, 21000000),
 (6, 2, 1, 1, 34000000), (7, 2, 2, 1, 22000000), (8, 2, 3, 2, 20000000), (9, 2, 4, 2, 15000000);
INSERT INTO payslip_lines (payslip_id, component_id, amount) VALUES
 (1,1,30000000),(1,3,730000),(1,4,2400000),(1,5,2150000),
 (2,1,22000000),(2,2,1500000),(2,3,730000),(2,4,1760000),(2,5,1120000),
 (3,1,20000000),(3,3,730000),(3,4,1600000),(3,5,830000),
 (4,1,15000000),(4,2,800000),(4,3,730000),(4,4,1200000),(4,5,310000),
 (5,1,21000000),(5,3,730000),(5,4,1680000),(5,5,940000),
 (6,1,34000000),(6,2,2000000),(6,3,730000),(6,4,2720000),(6,5,3050000),
 (7,1,22000000),(7,3,730000),(7,4,1760000),(7,5,1000000),
 (8,1,20000000),(8,2,1200000),(8,3,730000),(8,4,1600000),(8,5,950000),
 (9,1,15000000),(9,3,730000),(9,4,1200000),(9,5,250000);
INSERT INTO audit_log (table_name, record_id, action, changed_by, changed_at, old_value, new_value) VALUES
 ('salary_history', 3, 'insert', 'hr.manager', '2026-09-25T09:12:00', NULL, '{"employee_id":1,"base_salary":34000000}'),
 ('payroll_periods', 2, 'update', 'cfo', '2026-10-28T16:40:00', '{"status":"draft"}', '{"status":"approved"}');
