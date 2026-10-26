-- ============================================================
-- Limbe Police CMS - PostgreSQL Database Initialization Script
-- Server: PostgreSQL 12+
-- Usage:
--   psql -U postgres -f database/init.sql
--   (This drops and recreates the limbe_police_cms database.)
-- ============================================================

\set ON_ERROR_STOP on

-- Create database (drop first if it exists)
DROP DATABASE IF EXISTS limbe_police;
CREATE DATABASE limbe_police
  WITH
  ENCODING 'UTF8'
  TEMPLATE template0;

\connect limbe_police_cms;

-- Reset the public schema for a clean slate
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ============================================================
-- 1. SEED / LOOKUP TABLES
-- ============================================================

-- Roles
DROP TABLE IF EXISTS roles CASCADE;
CREATE TABLE roles (
  id           SERIAL PRIMARY KEY,
  name         varchar(50)  NOT NULL,
  description  varchar(255) DEFAULT NULL,
  created_at   timestamptz  NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name)
);

INSERT INTO roles (id, name, description) VALUES
(1,  'Admin',           'System Administration & User Access Management'),
(6,  'Prosecutor',      'Receives Forwarded Files, Court Preparation, and Physical File Custody'),
(7,  'Police Officer',  'Records and registers cases; investigates assigned cases'),
(8,  'Records Officer', 'Assigns OB and criminal numbers to registered cases'),
(9,  'Station Officer', 'Classifies cases, reviews files, approves closure, forwards to prosecution'),
(10, 'Branch Officer',  'Assigns investigating officers within a workflow branch');

SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT MAX(id) FROM roles));

-- Station Branch
DROP TABLE IF EXISTS station_branch CASCADE;
CREATE TABLE station_branch (
  id           SERIAL PRIMARY KEY,
  code         varchar(20)  NOT NULL,
  name         varchar(100) NOT NULL,
  description  text,
  created_at   timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (code)
);

INSERT INTO station_branch (id, code, name, description) VALUES
(1, 'CID', 'Criminal Investigation Department', 'Handles serious crimes, homicide, armed robbery, and complex inquiries (High / Critical cases)'),
(2, 'INV', 'Investigation Branch',              'Handles minor and medium cases and general investigations');

SELECT setval(pg_get_serial_sequence('station_branch', 'id'), (SELECT MAX(id) FROM station_branch));

-- Crime Categories
DROP TABLE IF EXISTS crime_categories CASCADE;
CREATE TABLE crime_categories (
  id             SERIAL PRIMARY KEY,
  name           varchar(100) NOT NULL,
  severity_level varchar(20)  DEFAULT 'Moderate',
  created_at     timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name),
  CONSTRAINT chk_crime_categories_severity CHECK (severity_level IN ('Minor', 'Moderate', 'Severe', 'Critical'))
);

INSERT INTO crime_categories (id, name, severity_level) VALUES
(1, 'Theft / Larceny',           'Minor'),
(2, 'Burglary / Housebreaking',  'Moderate'),
(3, 'Robbery with Violence',     'Severe'),
(4, 'Assault / ABH',            'Moderate'),
(5, 'Homicide',                  'Critical'),
(6, 'Fraud & Financial Crimes',  'Moderate'),
(7, 'Cybercrime',                'Moderate'),
(8, 'Traffic Offense',           'Minor');

SELECT setval(pg_get_serial_sequence('crime_categories', 'id'), (SELECT MAX(id) FROM crime_categories));

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- Users
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  badge_number  varchar(50)  NOT NULL,
  rank_title    varchar(50)  NOT NULL,
  first_name    varchar(50)  NOT NULL,
  last_name     varchar(50)  NOT NULL,
  email         varchar(100) NOT NULL,
  phone_number  varchar(20)  DEFAULT NULL,
  password_hash varchar(255) NOT NULL,
  role          varchar(50)  NOT NULL DEFAULT 'Police Officer',
  role_id       int DEFAULT NULL,
  branch_id     int DEFAULT NULL,
  branch        varchar(50)  DEFAULT NULL,
  is_active     smallint     NOT NULL DEFAULT 1,
  created_at    timestamptz  NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamptz  NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (badge_number),
  UNIQUE (email),
  CONSTRAINT users_ibfk_1 FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE SET NULL,
  CONSTRAINT users_ibfk_2 FOREIGN KEY (branch_id) REFERENCES station_branch (id) ON DELETE SET NULL,
  CONSTRAINT chk_users_role CHECK (role IN (
      'Admin', 'admin',
      'Police Officer', 'police officer',
      'Records Officer', 'records officer',
      'Station Officer', 'station officer',
      'Branch Officer', 'branch officer',
      'Prosecutor', 'prosecutor'
  ))
);

CREATE INDEX idx_users_badge ON users (badge_number);
CREATE INDEX idx_users_email ON users (email);

-- NOTE: Passwords below are bcrypt hashes of their default password.
-- Admin default password: Admin@12345
-- Other accounts may have different passwords set through the UI.
-- Demo accounts share the seed default password noted above.
INSERT INTO users (id, badge_number, rank_title, first_name, last_name, email, phone_number, password_hash, role, role_id, branch_id, branch, is_active) VALUES
(2,  'LIM-001', 'Station Commander', 'Station',    'Administrator', 'admin@limbe.police.mw',      '+265999000000', '$2b$10$/4nrS3UAzJjj7DNAKR9kkOKBaWxtCtaSUV/naRG3VPFNkPqCinZEO', 'Admin',           1, 1,    NULL,                   1),
(4,  'LIM-002', 'Station Commander', 'George',     'Dambo',         'dambogeorge992@gmail.com',   '+265996697165', '$2b$10$9O2FFvFfnbcC3kyfsMG2F.qgyQ7u1g.rDx3LjzwYvq4FEDnBxMB0m', 'Station Officer',  9, 1,    NULL,                   1),
(7,  'Phady',     'Constable',       'Patrick',    'Magule',        'patrick@gmail.com',          '+265996697165', '$2b$10$9O2FFvFfnbcC3kyfsMG2F.qgyQ7u1g.rDx3LjzwYvq4FEDnBxMB0m', 'Police Officer',   7, NULL, NULL,                   1),
(13, 'LIM-003', 'Sergeant',          'Kumbukani',  'Mbewe',         'branch@limbe.police.mw',     '+265888001003', '$2b$10$9O2FFvFfnbcC3kyfsMG2F.qgyQ7u1g.rDx3LjzwYvq4FEDnBxMB0m', 'Branch Officer',  10, 2,    'Investigation Branch', 1),
(14, 'LIM-004', 'Inspector',         'Chikondi',   'Nyirenda',      'prosecutor@limbe.police.mw', '+265888001004', '$2b$10$9O2FFvFfnbcC3kyfsMG2F.qgyQ7u1g.rDx3LjzwYvq4FEDnBxMB0m', 'Prosecutor',       6, NULL, NULL,                   1),
(30, 'LIM-005', 'Sergeant',          'Grace',      'Banda',         'records@limbe.police.mw',    '+265888001005', '$2b$10$9O2FFvFfnbcC3kyfsMG2F.qgyQ7u1g.rDx3LjzwYvq4FEDnBxMB0m', 'Records Officer',  8, NULL, NULL,                   1),
(32, 'LIM-007', 'Sergeant',          'Thandiwe',   'Mwale',         'cid-chief@limbe.police.mw',  '+265888001007', '$2b$10$9O2FFvFfnbcC3kyfsMG2F.qgyQ7u1g.rDx3LjzwYvq4FEDnBxMB0m', 'Branch Officer',  10, NULL, 'Criminal Investigation Department', 1);

SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));

-- Cases
DROP TABLE IF EXISTS cases CASCADE;
CREATE TABLE cases (
  id                     SERIAL PRIMARY KEY,
  ob_number              varchar(50) DEFAULT NULL,
  complainant_name       varchar(100) NOT NULL,
  complainant_id_number  varchar(50) DEFAULT NULL,
  complainant_phone      varchar(20) NOT NULL,
  complainant_address    text,
  complainant_age        int DEFAULT NULL,
  complainant_occupation varchar(100) DEFAULT NULL,
  complainant_ta         varchar(100) DEFAULT NULL,
  complainant_village    varchar(100) DEFAULT NULL,
  complainant_gender     varchar(10) DEFAULT 'Other',
  category_id            int NOT NULL,
  branch_id              int NOT NULL,
  priority               varchar(10) DEFAULT 'Medium',
  incident_datetime      timestamp DEFAULT NULL,
  incident_location      varchar(255) NOT NULL,
  incident_details       text NOT NULL,
  recorded_by            int DEFAULT NULL,
  recorded_at            timestamptz NULL DEFAULT NULL,
  status                 varchar(30) DEFAULT 'Registered',
  requested_status       varchar(30) DEFAULT NULL,
  status_request_notes   text,
  status_requested_by    int DEFAULT NULL,
  status_requested_at    timestamp NULL DEFAULT NULL,
  branch_review_status   varchar(20) DEFAULT NULL,
  branch_reviewed_by     int DEFAULT NULL,
  branch_reviewed_at     timestamp NULL DEFAULT NULL,
  forwarded_at           timestamp NULL DEFAULT NULL,
  file_location          varchar(120) DEFAULT NULL,
  court_date             date DEFAULT NULL,
  court_outcome          varchar(30) DEFAULT NULL,
  prosecution_query      text,
  prosecution_query_at   timestamp NULL DEFAULT NULL,
  prosecution_query_resolved_at timestamp NULL DEFAULT NULL,
  criminal_number        varchar(50) DEFAULT NULL,
  numbers_assigned_by    int DEFAULT NULL,
  numbers_assigned_at    timestamptz NULL DEFAULT NULL,
  classification         varchar(20) DEFAULT NULL,
  workflow_branch        varchar(50) DEFAULT NULL,
  classified_by          int DEFAULT NULL,
  classified_at          timestamptz NULL DEFAULT NULL,
  assigned_to            int DEFAULT NULL,
  assigned_by            int DEFAULT NULL,
  assigned_at            timestamptz NULL DEFAULT NULL,
  created_at             timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ob_number),
  UNIQUE (criminal_number),
  CONSTRAINT cases_ibfk_1 FOREIGN KEY (category_id) REFERENCES crime_categories (id),
  CONSTRAINT cases_ibfk_2 FOREIGN KEY (branch_id) REFERENCES station_branch (id),
  CONSTRAINT fk_case_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_numbers_assigned_by FOREIGN KEY (numbers_assigned_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_classified_by FOREIGN KEY (classified_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_assigned_to FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_status_requested_by FOREIGN KEY (status_requested_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_branch_reviewed_by FOREIGN KEY (branch_reviewed_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_cases_gender CHECK (complainant_gender IN ('Male', 'Female', 'Other')),
  CONSTRAINT chk_cases_priority CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  CONSTRAINT chk_cases_status CHECK (status IN ('Registered', 'Numbered', 'Classified', 'Assigned', 'Under Investigation', 'Submitted for Review', 'Court Pending', 'Forwarded to Prosecution', 'Closed', 'Archived')),
  CONSTRAINT chk_cases_requested_status CHECK (requested_status IN ('Closed', 'Court Pending', 'Forwarded to Prosecution')),
  CONSTRAINT chk_cases_branch_review CHECK (branch_review_status IN ('Pending Review', 'Recommended', 'Returned')),
  CONSTRAINT chk_cases_court_outcome CHECK (court_outcome IN ('Convicted', 'Acquitted', 'Withdrawn', 'Adjourned')),
  CONSTRAINT chk_cases_classification CHECK (classification IS NULL OR classification IN ('Minor', 'Medium', 'High', 'Critical')),
  CONSTRAINT chk_cases_workflow_branch CHECK (workflow_branch IS NULL OR workflow_branch IN ('Investigation Branch', 'Criminal Investigation Department'))
);

CREATE INDEX idx_cases_ob_number ON cases (ob_number);
CREATE INDEX idx_cases_status ON cases (status);
CREATE INDEX idx_cases_requested_status ON cases (requested_status);
CREATE INDEX idx_cases_status_requested_by ON cases (status_requested_by);
CREATE INDEX idx_cases_recorded_by ON cases (recorded_by);
CREATE INDEX idx_cases_workflow_branch ON cases (workflow_branch);
CREATE INDEX idx_cases_assigned_to ON cases (assigned_to);

-- Case lifecycle: a case is Registered when recorded, Numbered once the
-- Records Officer assigns its OB and criminal numbers, Classified once the
-- Station Officer classifies it, Assigned once a Branch Officer assigns an
-- investigating officer, and Under Investigation once the officer begins
-- recording diary entries.
INSERT INTO cases (id, ob_number, complainant_name, complainant_id_number, complainant_phone, complainant_address, complainant_gender, category_id, branch_id, priority, incident_datetime, incident_location, incident_details, recorded_by, recorded_at, status, requested_status, status_request_notes, status_requested_by, status_requested_at, branch_review_status, branch_reviewed_by, branch_reviewed_at, forwarded_at, file_location, court_date, court_outcome, prosecution_query, prosecution_query_at, prosecution_query_resolved_at, criminal_number, numbers_assigned_by, numbers_assigned_at, classification, workflow_branch, classified_by, classified_at, assigned_to, assigned_by, assigned_at, created_at, updated_at) VALUES
(1, 'OB-20260816-0001', 'George Dambo', NULL, '0996697165', 'Lumbadzi, Lilongwe Malawi', 'Male', 5, 2, 'Medium', '2025-03-21 12:00:00', 'Chichiri', 'mdjmsmskakamd', 7, '2026-08-16 14:30:27', 'Under Investigation', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CR-20260819-0001', 30, '2026-08-19 08:55:00', 'Medium', 'Investigation Branch', 4, '2026-08-19 09:00:00', 7, 13, '2026-08-19 09:33:04', '2026-08-16 14:30:27', '2026-08-19 09:33:04'),
(2, 'OB-20260905-0001', 'Patrick Magule', '004939939', '08840399483', 'Lumbadzi, Lilongwe Malawi', 'Male', 6, 1, 'High', '2026-09-05 11:45:00', 'Zingwangwa Market', 'fjjkfkdjsKLKAJGJDKSKFHSJKSKKKSHFHFH', 7, '2026-09-05 09:45:58', 'Numbered', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CR-20260916-0001', 30, '2026-09-16 16:02:53', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-09-05 09:45:58', '2026-09-16 16:02:53'),
(3, 'OB-20260905-0002', 'George Dambo', 'pfoodld', '0996697165', 'Lumbadzi, Lilongwe Malawi', 'Male', 7, 2, 'Medium', '2026-09-03 12:42:00', 'oflsllsld', 'kqalL;;dlszmmdk', 7, '2026-09-05 10:43:05', 'Submitted for Review', 'Closed', 'gdjjs', 7, '2026-09-16 16:40:50', 'Pending Review', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'CR-20260916-0002', 30, '2026-09-16 15:45:00', 'Medium', 'Investigation Branch', 4, '2026-09-16 16:00:00', 7, 13, '2026-09-16 16:36:55', '2026-09-05 10:43:05', '2026-09-16 16:40:50');

SELECT setval(pg_get_serial_sequence('cases', 'id'), (SELECT MAX(id) FROM cases));
-- Case <> Investigators (many-to-many)
DROP TABLE IF EXISTS case_investigators CASCADE;
CREATE TABLE case_investigators (
  id              SERIAL PRIMARY KEY,
  case_id         int NOT NULL,
  investigator_id int NOT NULL,
  assigned_by     int DEFAULT NULL,
  assigned_at     timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  is_lead         smallint NOT NULL DEFAULT 0,
  UNIQUE (case_id, investigator_id),
  CONSTRAINT ci_ibfk_1 FOREIGN KEY (case_id)         REFERENCES cases (id)  ON DELETE CASCADE,
  CONSTRAINT ci_ibfk_2 FOREIGN KEY (investigator_id) REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT ci_ibfk_3 FOREIGN KEY (assigned_by)     REFERENCES users (id)  ON DELETE SET NULL
);

INSERT INTO case_investigators (id, case_id, investigator_id, assigned_by, assigned_at, is_lead) VALUES
(1, 1, 7, 13, '2026-08-19 09:33:04', 1),
(2, 3, 7, 13, '2026-09-16 16:36:55', 1);

SELECT setval(pg_get_serial_sequence('case_investigators', 'id'), (SELECT MAX(id) FROM case_investigators));

-- Case Assignment History (every assignment and reassignment;
-- a reason is required on reassignment)
DROP TABLE IF EXISTS case_assignments CASCADE;
CREATE TABLE case_assignments (
  id          SERIAL PRIMARY KEY,
  case_id     int NOT NULL,
  assigned_to int NOT NULL,
  assigned_by int DEFAULT NULL,
  reason      text,
  created_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignments_case   FOREIGN KEY (case_id)     REFERENCES cases (id)  ON DELETE CASCADE,
  CONSTRAINT fk_assignments_target FOREIGN KEY (assigned_to) REFERENCES users (id)  ON DELETE RESTRICT,
  CONSTRAINT fk_assignments_by     FOREIGN KEY (assigned_by) REFERENCES users (id)  ON DELETE SET NULL
);

CREATE INDEX idx_case_assignments_case   ON case_assignments (case_id);
CREATE INDEX idx_case_assignments_target ON case_assignments (assigned_to);

-- Seed the history from the assignment table above.
INSERT INTO case_assignments (case_id, assigned_to, assigned_by, reason, created_at) VALUES
(1, 7, 13, NULL, '2026-08-19 09:33:04'),
(3, 7, 13, NULL, '2026-09-16 16:36:55');

SELECT setval(pg_get_serial_sequence('case_assignments', 'id'), (SELECT MAX(id) FROM case_assignments));

-- Case File Movements (physical file handover log)
DROP TABLE IF EXISTS case_file_movements CASCADE;
CREATE TABLE case_file_movements (
  id             SERIAL PRIMARY KEY,
  case_id        int NOT NULL,
  handed_over_by int NOT NULL,
  received_by    int NOT NULL,
  moved_at       timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  notes          text,
  CONSTRAINT fk_movements_case FOREIGN KEY (case_id)        REFERENCES cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_from FOREIGN KEY (handed_over_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_movements_to   FOREIGN KEY (received_by)    REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX idx_case_file_movements_case ON case_file_movements (case_id);

-- OB / Criminal Number Sequences (yearly counters drawn on by
-- the Records Officer when numbering a registered case)
DROP TABLE IF EXISTS number_sequences CASCADE;
CREATE TABLE number_sequences (
  year        int NOT NULL,
  type        varchar(10) NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  updated_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (year, type),
  CONSTRAINT chk_number_type CHECK (type IN ('OB', 'CR', 'EV'))
);

-- Seed the yearly counters past the existing seed numbers.
INSERT INTO number_sequences (year, type, last_number, updated_at) VALUES
(2026, 'OB', 2, '2026-09-16 16:02:53'),
(2026, 'CR', 2, '2026-09-16 16:02:53');

-- Suspects
DROP TABLE IF EXISTS suspects CASCADE;
CREATE TABLE suspects (
  id            SERIAL PRIMARY KEY,
  first_name    varchar(50) NOT NULL,
  last_name     varchar(50) NOT NULL,
  alias         varchar(50) DEFAULT NULL,
  national_id   varchar(50) DEFAULT NULL,
  date_of_birth date DEFAULT NULL,
  gender        varchar(10) NOT NULL,
  age           int DEFAULT NULL,
  occupation    varchar(100) DEFAULT NULL,
  ta            varchar(100) DEFAULT NULL,
  village       varchar(100) DEFAULT NULL,
  phone_number  varchar(20) DEFAULT NULL,
  address       text,
  photo_url     varchar(255) DEFAULT NULL,
  notes         text,
  created_at    timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_suspects_gender CHECK (gender IN ('Male', 'Female', 'Other'))
);

CREATE INDEX idx_suspect_name ON suspects (last_name, first_name);

-- Case <-> Suspects junction
DROP TABLE IF EXISTS case_suspects CASCADE;
CREATE TABLE case_suspects (
  id          SERIAL PRIMARY KEY,
  case_id     int NOT NULL,
  suspect_id  int NOT NULL,
  status      varchar(30) DEFAULT 'Under Investigation',
  arrest_date date DEFAULT NULL,
  created_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, suspect_id),
  CONSTRAINT case_suspects_ibfk_1 FOREIGN KEY (case_id)    REFERENCES cases (id)    ON DELETE CASCADE,
  CONSTRAINT case_suspects_ibfk_2 FOREIGN KEY (suspect_id) REFERENCES suspects (id)  ON DELETE CASCADE,
  CONSTRAINT chk_case_suspects_status CHECK (status IN ('Under Investigation', 'In Custody', 'Released on Bail', 'At Large / Wanted'))
);

-- Victims
DROP TABLE IF EXISTS victims CASCADE;
CREATE TABLE victims (
  id           SERIAL PRIMARY KEY,
  case_id      int NOT NULL,
  full_name    varchar(100) NOT NULL,
  phone_number varchar(20) DEFAULT NULL,
  email        varchar(100) DEFAULT NULL,
  national_id  varchar(30) DEFAULT NULL,
  age          int DEFAULT NULL,
  occupation   varchar(100) DEFAULT NULL,
  ta           varchar(100) DEFAULT NULL,
  village      varchar(100) DEFAULT NULL,
  address      text,
  statement    text,
  created_at   timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_victims_case FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE
);

CREATE INDEX idx_victims_case_id ON victims (case_id);

-- Evidence
DROP TABLE IF EXISTS evidence CASCADE;
CREATE TABLE evidence (
  id                      SERIAL PRIMARY KEY,
  case_id                 int NOT NULL,
  item_number             varchar(50) NOT NULL,
  description             text NOT NULL,
  category                varchar(20) NOT NULL DEFAULT 'Physical',
  storage_location        varchar(150) NOT NULL,
  collected_by_officer_id int NOT NULL,
  collected_at            timestamp NOT NULL,
  status                  varchar(30) NOT NULL DEFAULT 'In Locker',
  created_at              timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evidence_case         FOREIGN KEY (case_id)                REFERENCES cases (id)  ON DELETE CASCADE,
  CONSTRAINT fk_evidence_collected_by FOREIGN KEY (collected_by_officer_id) REFERENCES users (id)  ON DELETE RESTRICT,
  CONSTRAINT chk_evidence_category CHECK (category IN ('Physical', 'Documentary', 'Digital', 'Forensic', 'Weapon', 'Other')),
  CONSTRAINT chk_evidence_status CHECK (status IN ('In Locker', 'Transferred to Lab', 'Presented in Court', 'Returned', 'Disposed'))
);

CREATE INDEX idx_evidence_case_id ON evidence (case_id);
CREATE INDEX idx_evidence_item_number ON evidence (item_number);

-- Case Parties
DROP TABLE IF EXISTS evidence_custody_events CASCADE;
DROP TABLE IF EXISTS evidence_ledger CASCADE;
DROP TABLE IF EXISTS case_statements CASCADE;
DROP TABLE IF EXISTS case_parties CASCADE;
CREATE TABLE case_parties (
  id              SERIAL PRIMARY KEY,
  case_id         int NOT NULL,
  party_type      varchar(20) NOT NULL,
  witness_number  int DEFAULT NULL,
  suspect_id      int DEFAULT NULL,
  full_name       varchar(150) NOT NULL,
  first_name      varchar(50) DEFAULT NULL,
  last_name       varchar(50) DEFAULT NULL,
  alias           varchar(50) DEFAULT NULL,
  national_id     varchar(50) DEFAULT NULL,
  phone_number    varchar(20) DEFAULT NULL,
  email           varchar(100) DEFAULT NULL,
  gender          varchar(10) DEFAULT NULL,
  date_of_birth   date DEFAULT NULL,
  age             int DEFAULT NULL,
  occupation      varchar(100) DEFAULT NULL,
  ta              varchar(100) DEFAULT NULL,
  village         varchar(100) DEFAULT NULL,
  address         text,
  photo_url       varchar(255) DEFAULT NULL,
  notes           text,
  suspect_status  varchar(30) DEFAULT NULL,
  legacy_source   varchar(30) DEFAULT NULL,
  legacy_id       int DEFAULT NULL,
  created_by      int DEFAULT NULL,
  created_at      timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_case_parties_case       FOREIGN KEY (case_id)    REFERENCES cases (id)    ON DELETE CASCADE,
  CONSTRAINT fk_case_parties_suspect    FOREIGN KEY (suspect_id) REFERENCES suspects (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_parties_created_by FOREIGN KEY (created_by) REFERENCES users (id)    ON DELETE SET NULL,
  CONSTRAINT chk_case_parties_type CHECK (party_type IN ('Complainant', 'Witness', 'Suspect')),
  CONSTRAINT chk_case_parties_gender CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
  CONSTRAINT chk_case_parties_witness_number CHECK (
    (party_type = 'Complainant' AND witness_number = 1)
    OR (party_type = 'Witness' AND witness_number IS NOT NULL AND witness_number >= 2)
    OR (party_type = 'Suspect' AND witness_number IS NULL)
  ),
  CONSTRAINT chk_case_parties_suspect_link CHECK (
    (party_type = 'Suspect' AND suspect_id IS NOT NULL)
    OR (party_type <> 'Suspect' AND suspect_id IS NULL)
  ),
  CONSTRAINT uq_case_parties_witness UNIQUE (case_id, witness_number),
  CONSTRAINT uq_case_parties_legacy UNIQUE (case_id, legacy_source, legacy_id)
);

CREATE INDEX idx_case_parties_case_id ON case_parties (case_id);
CREATE INDEX idx_case_parties_type ON case_parties (case_id, party_type);
CREATE INDEX idx_case_parties_suspect_id ON case_parties (suspect_id);

CREATE TABLE case_statements (
  id             SERIAL PRIMARY KEY,
  case_id        int NOT NULL,
  party_id       int NOT NULL,
  statement_text text NOT NULL,
  source         varchar(30) NOT NULL DEFAULT 'INTAKE',
  recorded_by    int DEFAULT NULL,
  recorded_at    timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_case_statements_case        FOREIGN KEY (case_id)  REFERENCES cases (id)        ON DELETE CASCADE,
  CONSTRAINT fk_case_statements_party       FOREIGN KEY (party_id) REFERENCES case_parties (id) ON DELETE CASCADE,
  CONSTRAINT fk_case_statements_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (id)     ON DELETE SET NULL
);

CREATE INDEX idx_case_statements_case_id ON case_statements (case_id);
CREATE INDEX idx_case_statements_party_id ON case_statements (party_id);

CREATE TABLE evidence_ledger (
  id                      SERIAL PRIMARY KEY,
  ledger_no               varchar(20) NOT NULL,
  case_id                 int NOT NULL,
  party_id                int DEFAULT NULL,
  item_number             varchar(50) DEFAULT NULL,
  evidence_type           varchar(20) NOT NULL DEFAULT 'Physical',
  description             text NOT NULL,
  file_name               varchar(255) DEFAULT NULL,
  file_path               varchar(500) DEFAULT NULL,
  mime_type               varchar(100) DEFAULT NULL,
  file_size               bigint DEFAULT NULL,
  sha256                  char(64) DEFAULT NULL,
  collected_by_officer_id int NOT NULL,
  collected_at            timestamp NOT NULL,
  current_custodian_id    int DEFAULT NULL,
  status                  varchar(30) NOT NULL DEFAULT 'In Locker',
  storage_location        varchar(150) DEFAULT NULL,
  migration_flags         text[] NOT NULL DEFAULT '{}',
  legacy_source           varchar(30) DEFAULT NULL,
  legacy_id               int DEFAULT NULL,
  created_by              int DEFAULT NULL,
  created_at              timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evidence_ledger_case         FOREIGN KEY (case_id)                 REFERENCES cases (id)        ON DELETE CASCADE,
  CONSTRAINT fk_evidence_ledger_party        FOREIGN KEY (party_id)                REFERENCES case_parties (id) ON DELETE SET NULL,
  CONSTRAINT fk_evidence_ledger_collected_by FOREIGN KEY (collected_by_officer_id) REFERENCES users (id)         ON DELETE RESTRICT,
  CONSTRAINT fk_evidence_ledger_custodian    FOREIGN KEY (current_custodian_id)    REFERENCES users (id)         ON DELETE SET NULL,
  CONSTRAINT fk_evidence_ledger_created_by   FOREIGN KEY (created_by)              REFERENCES users (id)         ON DELETE SET NULL,
  CONSTRAINT uq_evidence_ledger_no UNIQUE (ledger_no),
  CONSTRAINT uq_evidence_ledger_legacy UNIQUE (legacy_source, legacy_id),
  CONSTRAINT chk_evidence_ledger_type CHECK (evidence_type IN ('Physical', 'Documentary', 'Digital', 'Forensic', 'Weapon', 'Other')),
  CONSTRAINT chk_evidence_ledger_status CHECK (status IN ('In Locker', 'Transferred to Lab', 'Presented in Court', 'Returned', 'Disposed')),
  CONSTRAINT chk_evidence_ledger_hash CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT chk_evidence_ledger_size CHECK (file_size IS NULL OR file_size >= 0)
);

CREATE INDEX idx_evidence_ledger_case_id ON evidence_ledger (case_id);
CREATE INDEX idx_evidence_ledger_party_id ON evidence_ledger (party_id);
CREATE INDEX idx_evidence_ledger_status ON evidence_ledger (status);

CREATE TABLE evidence_custody_events (
  id                SERIAL PRIMARY KEY,
  ledger_id         int NOT NULL,
  event_type        varchar(30) NOT NULL DEFAULT 'Collected',
  from_custodian_id int DEFAULT NULL,
  to_custodian_id   int DEFAULT NULL,
  location          varchar(150) DEFAULT NULL,
  notes             text,
  recorded_by       int NOT NULL,
  event_at          timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  created_at        timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evidence_events_ledger      FOREIGN KEY (ledger_id)         REFERENCES evidence_ledger (id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_events_from        FOREIGN KEY (from_custodian_id) REFERENCES users (id)           ON DELETE SET NULL,
  CONSTRAINT fk_evidence_events_to          FOREIGN KEY (to_custodian_id)   REFERENCES users (id)           ON DELETE SET NULL,
  CONSTRAINT fk_evidence_events_recorded_by FOREIGN KEY (recorded_by)       REFERENCES users (id)           ON DELETE RESTRICT,
  CONSTRAINT chk_evidence_events_type CHECK (event_type IN ('Collected', 'Transferred', 'Returned', 'Presented in Court', 'Disposed'))
);

CREATE INDEX idx_evidence_events_ledger_id ON evidence_custody_events (ledger_id);

-- Evidence Transfer Requests (chain-of-custody handover: an investigator asks
-- to move an item and a station officer approves or rejects the movement)
CREATE TABLE evidence_transfers (
  id             SERIAL PRIMARY KEY,
  ledger_id      int NOT NULL,
  case_id        int NOT NULL,
  from_user_id   int DEFAULT NULL,
  to_user_id     int NOT NULL,
  location       varchar(150) DEFAULT NULL,
  reason         text,
  status         varchar(20) NOT NULL DEFAULT 'Requested',
  approved_by    int DEFAULT NULL,
  approved_at    timestamptz NULL DEFAULT NULL,
  requested_at   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transfers_ledger      FOREIGN KEY (ledger_id)    REFERENCES evidence_ledger (id) ON DELETE CASCADE,
  CONSTRAINT fk_transfers_case        FOREIGN KEY (case_id)      REFERENCES cases (id)           ON DELETE CASCADE,
  CONSTRAINT fk_transfers_from        FOREIGN KEY (from_user_id) REFERENCES users (id)           ON DELETE SET NULL,
  CONSTRAINT fk_transfers_to          FOREIGN KEY (to_user_id)   REFERENCES users (id)           ON DELETE RESTRICT,
  CONSTRAINT fk_transfers_approved_by FOREIGN KEY (approved_by)  REFERENCES users (id)           ON DELETE SET NULL,
  CONSTRAINT chk_transfers_status CHECK (status IN ('Requested', 'Approved', 'Rejected', 'Cancelled'))
);

CREATE INDEX idx_evidence_transfers_ledger ON evidence_transfers (ledger_id);
CREATE INDEX idx_evidence_transfers_case ON evidence_transfers (case_id);
CREATE INDEX idx_evidence_transfers_status ON evidence_transfers (status);

CREATE OR REPLACE FUNCTION next_evidence_ledger_no() RETURNS varchar AS $$
DECLARE
  target_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  next_number int;
BEGIN
  INSERT INTO number_sequences (year, type, last_number, updated_at)
  VALUES (target_year, 'EV', 1, CURRENT_TIMESTAMP)
  ON CONFLICT (year, type)
  DO UPDATE SET last_number = number_sequences.last_number + 1, updated_at = CURRENT_TIMESTAMP
  RETURNING last_number INTO next_number;

  RETURN 'EV-' || target_year::text || '-' || LPAD(next_number::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_append_only_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '%.% is append-only', TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_evidence_ledger() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'evidence_ledger is append-only';
  END IF;

  IF NEW.id <> OLD.id
     OR NEW.ledger_no <> OLD.ledger_no
     OR NEW.case_id <> OLD.case_id
     OR NEW.party_id IS DISTINCT FROM OLD.party_id
     OR NEW.item_number IS DISTINCT FROM OLD.item_number
     OR NEW.evidence_type <> OLD.evidence_type
     OR NEW.description <> OLD.description
     OR NEW.file_name IS DISTINCT FROM OLD.file_name
     OR NEW.file_path IS DISTINCT FROM OLD.file_path
     OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
     OR NEW.file_size IS DISTINCT FROM OLD.file_size
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.collected_by_officer_id <> OLD.collected_by_officer_id
     OR NEW.collected_at <> OLD.collected_at
     OR NEW.legacy_source IS DISTINCT FROM OLD.legacy_source
     OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'evidence_ledger core fields are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_case_party_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_evidence_ledger_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_case_statements_update
  BEFORE UPDATE OR DELETE ON case_statements
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_change();

CREATE TRIGGER prevent_evidence_events_update
  BEFORE UPDATE OR DELETE ON evidence_custody_events
  FOR EACH ROW EXECUTE FUNCTION prevent_append_only_change();

CREATE TRIGGER protect_evidence_ledger_update
  BEFORE UPDATE OR DELETE ON evidence_ledger
  FOR EACH ROW EXECUTE FUNCTION protect_evidence_ledger();

CREATE TRIGGER set_case_parties_updated_at
  BEFORE UPDATE ON case_parties
  FOR EACH ROW EXECUTE FUNCTION set_case_party_updated_at();

CREATE TRIGGER set_evidence_ledger_updated_at
  BEFORE UPDATE ON evidence_ledger
  FOR EACH ROW EXECUTE FUNCTION set_evidence_ledger_updated_at();

INSERT INTO case_parties (
  case_id, party_type, witness_number, full_name, national_id, phone_number,
  gender, age, occupation, ta, village, address, legacy_source, legacy_id,
  created_by, created_at
)
SELECT
  c.id, 'Complainant', 1, c.complainant_name, c.complainant_id_number,
  c.complainant_phone, c.complainant_gender, c.complainant_age,
  c.complainant_occupation, c.complainant_ta, c.complainant_village,
  c.complainant_address, 'cases', c.id, c.recorded_by, c.created_at
FROM cases c;

-- Case Notes
DROP TABLE IF EXISTS case_notes CASCADE;
CREATE TABLE case_notes (
  id         SERIAL PRIMARY KEY,
  case_id    int NOT NULL,
  officer_id int NOT NULL,
  note       text NOT NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_case    FOREIGN KEY (case_id)   REFERENCES cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_officer FOREIGN KEY (officer_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX idx_notes_case_id ON case_notes (case_id);

INSERT INTO case_notes (id, case_id, officer_id, note, created_at) VALUES
(1, 1, 7, 'we have now find the evidence', '2026-08-21 17:43:07');

SELECT setval(pg_get_serial_sequence('case_notes', 'id'), (SELECT MAX(id) FROM case_notes));

-- Case Minutes (Sign-off Chain: Branch Review + Station Review/Approval + Prosecutor Query)
DROP TABLE IF EXISTS case_minutes CASCADE;
CREATE TABLE case_minutes (
  id          SERIAL PRIMARY KEY,
  case_id     int NOT NULL,
  minute_type varchar(30) NOT NULL DEFAULT 'BRANCH_REVIEW',
  author_id   int NOT NULL,
  decision    varchar(20) NOT NULL,
  comment     text,
  created_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_minutes_case   FOREIGN KEY (case_id)   REFERENCES cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_minutes_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_minutes_type CHECK (minute_type IN ('BRANCH_REVIEW', 'COMMANDER_APPROVAL', 'PROSECUTOR_QUERY', 'STATION_REVIEW')),
  CONSTRAINT chk_minutes_decision CHECK (decision IN ('Recommended', 'Returned', 'Approved', 'Rejected', 'Query', 'Forwarded'))
);

CREATE INDEX idx_minutes_case_id ON case_minutes (case_id);

-- External Reports (Social Welfare / Medical follow-ups)
DROP TABLE IF EXISTS external_reports CASCADE;
CREATE TABLE external_reports (
  id           SERIAL PRIMARY KEY,
  case_id      int NOT NULL,
  report_type  varchar(40) NOT NULL,
  requested_by int NOT NULL,
  requested_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  status       varchar(20) NOT NULL DEFAULT 'Requested',
  received_at  timestamp NULL DEFAULT NULL,
  notes        text,
  created_at   timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_external_case           FOREIGN KEY (case_id)       REFERENCES cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_external_requested_by   FOREIGN KEY (requested_by)  REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_external_type CHECK (report_type IN ('Social Welfare Report', 'Medical Report')),
  CONSTRAINT chk_external_status CHECK (status IN ('Requested', 'Received'))
);

CREATE INDEX idx_external_case_id ON external_reports (case_id);

-- Case Custody / Handover Log (Submission to the Prosecution Branch)
DROP TABLE IF EXISTS case_custody_log CASCADE;
CREATE TABLE case_custody_log (
  id              SERIAL PRIMARY KEY,
  case_id         int NOT NULL,
  handed_over_by  int NOT NULL,
  handed_over_at  timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  received_by     int DEFAULT NULL,
  received_at     timestamp NULL DEFAULT NULL,
  status          varchar(20) NOT NULL DEFAULT 'Pending',
  file_location   varchar(120) DEFAULT NULL,
  notes           text,
  created_at      timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_custody_case        FOREIGN KEY (case_id)          REFERENCES cases (id) ON DELETE CASCADE,
  CONSTRAINT fk_custody_handover_by FOREIGN KEY (handed_over_by)   REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_custody_received_by FOREIGN KEY (received_by)      REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_custody_status CHECK (status IN ('Pending', 'Acknowledged'))
);

CREATE INDEX idx_custody_case_id ON case_custody_log (case_id);

-- Reassignment Proposals (raised by Branch Officer, decided by Station Officer)
DROP TABLE IF EXISTS reassignment_proposals CASCADE;
CREATE TABLE reassignment_proposals (
  id                     SERIAL PRIMARY KEY,
  case_id                int NOT NULL,
  current_investigator_id int DEFAULT NULL,
  proposed_investigator_id int NOT NULL,
  proposed_by            int NOT NULL,
  reason                 text,
  status                 varchar(20) NOT NULL DEFAULT 'Pending',
  decided_by             int DEFAULT NULL,
  decision_note          text,
  decided_at             timestamp NULL DEFAULT NULL,
  created_at             timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proposal_case       FOREIGN KEY (case_id)                 REFERENCES cases (id)  ON DELETE CASCADE,
  CONSTRAINT fk_proposal_current    FOREIGN KEY (current_investigator_id) REFERENCES users (id)  ON DELETE SET NULL,
  CONSTRAINT fk_proposal_proposed   FOREIGN KEY (proposed_investigator_id) REFERENCES users (id)  ON DELETE RESTRICT,
  CONSTRAINT fk_proposal_by         FOREIGN KEY (proposed_by)             REFERENCES users (id)  ON DELETE RESTRICT,
  CONSTRAINT fk_proposal_decided_by FOREIGN KEY (decided_by)              REFERENCES users (id)  ON DELETE SET NULL,
  CONSTRAINT chk_proposal_status CHECK (status IN ('Pending', 'Approved', 'Rejected'))
);

CREATE INDEX idx_proposal_case_id ON reassignment_proposals (case_id);

-- Audit Logs
DROP TABLE IF EXISTS audit_logs CASCADE;
CREATE TABLE audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    int DEFAULT NULL,
  action     varchar(50) NOT NULL,
  details    text NOT NULL,
  ip_address varchar(45) DEFAULT NULL,
  created_at timestamptz NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_action ON audit_logs (action);
CREATE INDEX idx_audit_created ON audit_logs (created_at);

INSERT INTO audit_logs (id, user_id, action, details, ip_address, created_at) VALUES
(1,  2,  'USER_LOGIN',              'Officer LIM-001 logged into web portal.',                                                       NULL, '2026-08-15 09:37:45'),
(2,  2,  'USER_CREATED',            'Created user LIM-002 (George Dambo) with role Station Officer (Role ID: 9)',                     NULL, '2026-08-15 09:40:59'),
(3,  2,  'USER_CREATED',            'Created user Phady (Patrick Magule) with role Police Officer (Role ID: 7)',                      NULL, '2026-08-15 09:41:07'),
(4,  2,  'USER_CREATED',            'Created user LIM-003 (Kumbukani Mbewe) with role Branch Officer (Role ID: 10), workflow branch: Investigation Branch', NULL, '2026-08-15 09:41:11'),
(5,  2,  'USER_CREATED',            'Created user LIM-004 (Chikondi Nyirenda) with role Prosecutor (Role ID: 6)',                    NULL, '2026-08-15 09:41:13'),
(6,  2,  'USER_CREATED',            'Created user LIM-005 (Grace Banda) with role Records Officer (Role ID: 8)',                     NULL, '2026-08-15 09:41:33'),
(7,  2,  'USER_CREATED',            'Created user LIM-007 (Thandiwe Mwale) with role Branch Officer (Role ID: 10), workflow branch: Criminal Investigation Department', NULL, '2026-08-15 09:41:44'),
(8,  7,  'USER_LOGIN',              'Officer Phady logged in successfully.',                                                       NULL, '2026-08-16 14:27:39'),
(9,  7,  'CASE_REGISTERED',         'Registered new Case OB OB-20260816-0001 for complainant George Dambo.',                       NULL, '2026-08-16 14:30:27'),
(10, 30, 'NUMBERS_ASSIGNED',        'Assigned OB number OB-20260816-0001 and criminal number CR-20260819-0001 to Case ID 1.',      NULL, '2026-08-19 08:55:00'),
(11, 4,  'CASE_CLASSIFIED',         'Classified Case ID 1 as Medium; routed to Investigation Branch.',                             NULL, '2026-08-19 09:00:00'),
(12, 13, 'CASE_ASSIGNED',           'Assigned Case ID 1 to Police Officer Patrick Magule.',                                        NULL, '2026-08-19 09:33:04'),
(13, 7,  'CASE_NOTE_ADDED',         'Added investigation note to Case ID 1.',                                                      NULL, '2026-08-21 17:43:07'),
(14, 7,  'CASE_REGISTERED',         'Registered new Case OB OB-20260905-0001 for complainant Patrick Magule.',                     NULL, '2026-09-05 09:45:58'),
(15, 7,  'CASE_REGISTERED',         'Registered new Case OB OB-20260905-0002 for complainant George Dambo.',                       NULL, '2026-09-05 10:43:05'),
(16, 30, 'NUMBERS_ASSIGNED',        'Assigned OB number OB-20260905-0002 and criminal number CR-20260916-0002 to Case ID 3.',      NULL, '2026-09-16 15:45:00'),
(17, 4,  'CASE_CLASSIFIED',         'Classified Case ID 3 as Medium; routed to Investigation Branch.',                             NULL, '2026-09-16 16:00:00'),
(18, 30, 'NUMBERS_ASSIGNED',        'Assigned OB number OB-20260905-0001 and criminal number CR-20260916-0001 to Case ID 2.',      NULL, '2026-09-16 16:02:53'),
(19, 13, 'CASE_ASSIGNED',           'Assigned Case ID 3 to Police Officer Patrick Magule. Note: do this within a month',            NULL, '2026-09-16 16:36:55'),
(20, 7,  'STATUS_CHANGE_REQUESTED', 'Requested status change to "Closed" for Case ID 3.',                                          '::1', '2026-09-16 16:40:50');

SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), (SELECT MAX(id) FROM audit_logs));

-- Session store (kept for compatibility; app uses in-memory sessions by default)
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
  session_id varchar(128) NOT NULL,
  expires    integer NOT NULL,
  data       text,
  PRIMARY KEY (session_id)
);

-- ============================================================
-- 3. TRIGGERS (emulate MySQL ON UPDATE CURRENT_TIMESTAMP)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Default Admin login credentials:
--   Badge Number : LIM-001
--   Password     : Admin@12345  (change on first login)
-- ============================================================
