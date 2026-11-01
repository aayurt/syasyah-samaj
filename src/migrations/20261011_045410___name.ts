import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_documents_tax_lines_nature" AS ENUM('additive', 'inclusive', 'withholding');
  CREATE TYPE "public"."enum_documents_order_status" AS ENUM('draft', 'confirmed', 'cancelled');
  CREATE TYPE "public"."enum_documents_donation_purpose" AS ENUM('individual', 'corporate', 'community', 'other');
  CREATE TYPE "public"."enum_doc_sequences_doc_type" AS ENUM('sales-invoice', 'purchase-invoice', 'receipt-voucher', 'payment-voucher', 'journal-voucher', 'contra-voucher', 'credit-note', 'debit-note', 'grn', 'delivery-challan');
  CREATE TYPE "public"."enum_tax_types_nature" AS ENUM('additive', 'inclusive', 'withholding');
  CREATE TYPE "public"."enum_tenants_type" AS ENUM('central', 'illaka');
  CREATE TYPE "public"."enum_members_payment_status" AS ENUM('unpaid', 'paid', 'overdue');
  CREATE TYPE "public"."enum_members_application_citizenship_district" AS ENUM('taplejung', 'panchthar', 'ilam', 'jhapa', 'tehrathum', 'sankhuwasabha', 'bhojpur', 'solukhumbu', 'okhaldhunga', 'khotang', 'dhankuta', 'udayapur', 'saptari', 'morang', 'siraha', 'dhanusha', 'mahottari', 'sarlahi', 'rautahat', 'bara', 'parsa', 'sindhupalchok', 'kabhre-palanchowk', 'sindhuli', 'ramechhap', 'dolakha', 'bhaktapur', 'kathmandu', 'lalitpur', 'nuwakot', 'rasuwa', 'dhading', 'makwanpur', 'chitwan', 'gorkha', 'manang', 'mustang', 'kaski', 'lamjung', 'tanahu', 'myagdi', 'baglung', 'parbat', 'syangja', 'nawalparasi-east', 'nawalparasi-west', 'kapilvastu', 'rupandehi', 'palpa', 'gulmi', 'arghakhanchi', 'banke', 'bardiya', 'rolpa', 'pyuthan', 'dang', 'rukum-east', 'rukum-west', 'surkhet', 'dailekh', 'jumla', 'kalikot', 'mugu', 'humla', 'salyan', 'jajarkot', 'dolpa', 'humla-2', 'kailali', 'kanchanpur', 'dadeldhura', 'baitadi', 'darchula', 'achham', 'doti', 'bajura', 'bajhang');
  CREATE TYPE "public"."enum_archives_category" AS ENUM('manuscript', 'photo', 'guthi', 'general');
  CREATE TYPE "public"."enum_fixed_assets_category" AS ENUM('vehicle', 'equipment', 'furniture', 'computer', 'building', 'land', 'other');
  CREATE TYPE "public"."enum_fixed_assets_status" AS ENUM('active', 'disposed');
  CREATE TYPE "public"."enum_audit_logs_action" AS ENUM('create', 'update', 'delete', 'post', 'void', 'transfer');
  CREATE TYPE "public"."enum_recurring_schedules_doc_type" AS ENUM('sales-invoice', 'purchase-invoice', 'membership-receipt', 'donation-receipt');
  CREATE TYPE "public"."enum_recurring_schedules_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');
  CREATE TYPE "public"."enum_recurring_schedules_status" AS ENUM('active', 'paused', 'completed');
  CREATE TYPE "public"."enum_expense_claims_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'reimbursed');
  CREATE TYPE "public"."enum_employees_employment_state" AS ENUM('Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Meghalaya', 'Odisha', 'Punjab', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'West Bengal');
  CREATE TYPE "public"."enum_employees_gender" AS ENUM('Female', 'Male', 'Other');
  CREATE TYPE "public"."enum_employees_tax_regime" AS ENUM('new', 'old');
  CREATE TYPE "public"."enum_fiscal_years_status" AS ENUM('active', 'closed');
  CREATE TYPE "public"."enum_payroll_runs_salary_slips_status" AS ENUM('Draft', 'Submitted', 'Paid', 'Cancelled');
  CREATE TYPE "public"."enum_payroll_runs_status" AS ENUM('Draft', 'Submitted', 'Paid', 'Cancelled');
  CREATE TYPE "public"."enum_payroll_slips_payroll_frequency" AS ENUM('Monthly', 'Fortnightly', 'Bimonthly', 'Weekly', 'Daily');
  CREATE TYPE "public"."enum_payroll_slips_status" AS ENUM('Draft', 'Submitted', 'Cancelled');
  CREATE TYPE "public"."enum_salary_components_type" AS ENUM('Earning', 'Deduction', 'EmployerContribution');
  CREATE TYPE "public"."enum_salary_structures_payroll_frequency" AS ENUM('Monthly', 'Fortnightly', 'Bimonthly', 'Weekly', 'Daily');
  CREATE TYPE "public"."enum_additional_salaries_type" AS ENUM('Earning', 'Deduction', 'Flex Benefit');
  CREATE TYPE "public"."enum_additional_salaries_payroll_frequency" AS ENUM('Once', 'Monthly', 'Yearly');
  CREATE TYPE "public"."enum_additional_salaries_status" AS ENUM('Active', 'Inactive', 'Cancelled');
  CREATE TYPE "public"."enum_loans_repayment_schedule_status" AS ENUM('Paid', 'Unpaid', 'Partially Paid');
  CREATE TYPE "public"."enum_loans_status" AS ENUM('Active', 'Closed', 'Cancelled');
  CREATE TYPE "public"."enum_loan_types_type" AS ENUM('Staff Loan', 'Car Loan', 'Housing Loan', 'Personal Loan', 'Education Loan', 'Other Loan');
  CREATE TYPE "public"."enum_loan_types_interest_type" AS ENUM('Flat Rate', 'Declining Balance', 'Reducing Balance');
  CREATE TYPE "public"."enum_loan_types_repayment_method" AS ENUM('Installment', 'Bullet', 'Flexible', 'Staff Recovery');
  CREATE TYPE "public"."enum_loan_types_doc_field_for_status" AS ENUM('Active', 'Inactive', 'Paid', 'Overdue', 'Closed');
  CREATE TYPE "public"."enum_loan_types_doc_field_for_status_in_list" AS ENUM('Active', 'Inactive', 'Paid', 'Overdue', 'Closed');
  CREATE TYPE "public"."enum_loan_types_loanschedule_basedon" AS ENUM('Repayment', 'Disbursement');
  CREATE TYPE "public"."enum_tax_exemption_declarations_deductions_deduction_type" AS ENUM('Section 80C', 'Section 80D', 'Section 80E', 'Section 80G', 'Section 80GG', 'Section 80CCD(1B)', 'Section 80CCD(2)', 'Section 80TTA', 'Section 80TTB', 'Other');
  CREATE TYPE "public"."enum_tax_exemption_declarations_submit_for" AS ENUM('ITR Filing', 'Tax Exemption');
  CREATE TYPE "public"."enum_tax_exemption_declarations_status" AS ENUM('Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled');
  CREATE TYPE "public"."enum_payroll_periods_payroll_frequency" AS ENUM('Monthly', 'Fortnightly', 'Bimonthly', 'Weekly', 'Daily');
  CREATE TYPE "public"."enum_payroll_periods_doc_status" AS ENUM('Draft', 'Submitted', 'Cancelled');
  CREATE TYPE "public"."enum_flexible_benefit_returns_return_type" AS ENUM('Cash', 'Non-Cash');
  CREATE TYPE "public"."enum_salary_structure_flexible_benefits_type" AS ENUM('Flex Benefit', 'Flexible Benefit');
  CREATE TYPE "public"."enum_payroll_run_employees_status" AS ENUM('Active', 'Inactive');
  CREATE TYPE "public"."enum_billing_settings_calendar_type" AS ENUM('AD', 'BS');
  CREATE TYPE "public"."enum_billing_settings_time_format" AS ENUM('12h', '24h');
  CREATE TYPE "public"."enum_payroll_settings_default_employment_state" AS ENUM('Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Meghalaya', 'Odisha', 'Punjab', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'West Bengal');
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'central-treasurer';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'central-auditor';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'central-exec';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'illaka-chair';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'illaka-treasurer';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'illaka-secretary';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'illaka-accountant';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'illaka-member-officer';
  ALTER TYPE "public"."enum_users_role" ADD VALUE 'viewer';
  ALTER TYPE "public"."enum_documents_doc_type" ADD VALUE 'sales-quote' BEFORE 'sales-invoice';
  ALTER TYPE "public"."enum_documents_doc_type" ADD VALUE 'sales-order' BEFORE 'sales-invoice';
  ALTER TYPE "public"."enum_documents_doc_type" ADD VALUE 'purchase-order' BEFORE 'purchase-invoice';
  ALTER TYPE "public"."enum_documents_doc_type" ADD VALUE 'contra';
  ALTER TYPE "public"."enum_documents_doc_type" ADD VALUE 'membership-receipt';
  ALTER TYPE "public"."enum_documents_doc_type" ADD VALUE 'donation-receipt';
  CREATE TABLE "timeline" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" varchar NOT NULL,
  	"ad_year" numeric,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "timeline_locales" (
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"tag" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "documents_voided_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_index" numeric NOT NULL,
  	"quantity" numeric NOT NULL,
  	"reason" varchar,
  	"credit_note_id_id" integer,
  	"note_number" varchar,
  	"voided_at" timestamp(3) with time zone,
  	"voided_by" varchar
  );
  
  CREATE TABLE "documents_tax_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tax_type_id" integer,
  	"nature" "enum_documents_tax_lines_nature",
  	"rate" numeric,
  	"base_amount" numeric,
  	"amount" numeric
  );
  
  CREATE TABLE "tax_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"nature" "enum_tax_types_nature" DEFAULT 'additive' NOT NULL,
  	"rate" numeric NOT NULL,
  	"sales_account_id" integer,
  	"purchase_account_id" integer,
  	"active" boolean DEFAULT true,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "elders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"photo_id" integer,
  	"is_living" boolean DEFAULT true,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "elders_locales" (
  	"name" varchar NOT NULL,
  	"honorific_title" varchar,
  	"field" varchar,
  	"bio" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "membership_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"fee" numeric NOT NULL,
  	"period_months" numeric DEFAULT 12,
  	"description" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bank_statements_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"description" varchar,
  	"reference" varchar,
  	"amount" numeric NOT NULL,
  	"matched_entry_id" integer
  );
  
  CREATE TABLE "bank_statements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"period_start" timestamp(3) with time zone,
  	"period_end" timestamp(3) with time zone,
  	"opening_balance" numeric DEFAULT 0,
  	"closing_balance" numeric DEFAULT 0,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "fixed_assets_depreciation_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"amount" numeric NOT NULL,
  	"journal_entry_id" integer
  );
  
  CREATE TABLE "fixed_assets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"name" varchar NOT NULL,
  	"category" "enum_fixed_assets_category" DEFAULT 'other',
  	"purchase_date" timestamp(3) with time zone,
  	"purchase_cost" numeric DEFAULT 0 NOT NULL,
  	"salvage_value" numeric DEFAULT 0,
  	"useful_life_years" numeric DEFAULT 5 NOT NULL,
  	"location" varchar,
  	"status" "enum_fixed_assets_status" DEFAULT 'active',
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" "enum_audit_logs_action" NOT NULL,
  	"entity_type" varchar NOT NULL,
  	"entity_id" varchar NOT NULL,
  	"entity_label" varchar,
  	"tenant_id" integer,
  	"user_name" varchar,
  	"user_role" varchar,
  	"before" jsonb,
  	"after" jsonb,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "recurring_schedules_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"qty" numeric DEFAULT 1,
  	"rate" numeric NOT NULL,
  	"amount" numeric,
  	"item_id" integer
  );
  
  CREATE TABLE "recurring_schedules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"doc_type" "enum_recurring_schedules_doc_type" DEFAULT 'sales-invoice' NOT NULL,
  	"frequency" "enum_recurring_schedules_frequency" DEFAULT 'monthly' NOT NULL,
  	"day_of_month" numeric,
  	"party_id" integer NOT NULL,
  	"tax_rate" numeric DEFAULT 0,
  	"narration" varchar,
  	"start_date" varchar NOT NULL,
  	"end_date" varchar,
  	"next_run_date" varchar NOT NULL,
  	"last_run_date" varchar,
  	"last_doc_id" numeric,
  	"status" "enum_recurring_schedules_status" DEFAULT 'active' NOT NULL,
  	"generated_count" numeric DEFAULT 0,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "expense_claims_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"account_id" integer
  );
  
  CREATE TABLE "expense_claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"claim_number" varchar NOT NULL,
  	"claimant" varchar NOT NULL,
  	"date" varchar NOT NULL,
  	"status" "enum_expense_claims_status" DEFAULT 'draft' NOT NULL,
  	"total_amount" numeric DEFAULT 0,
  	"billable" boolean DEFAULT false,
  	"party_id" integer,
  	"billed_invoice_id" numeric,
  	"submitted_at" varchar,
  	"approved_at" varchar,
  	"approved_by" varchar,
  	"rejected_at" varchar,
  	"rejection_reason" varchar,
  	"reimbursed_at" varchar,
  	"journal_entry" numeric,
  	"payment_journal_entry" numeric,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "employees_allowances" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"amount" numeric DEFAULT 0 NOT NULL
  );
  
  CREATE TABLE "employees_deductions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"amount" numeric DEFAULT 0 NOT NULL,
  	"account_id" integer
  );
  
  CREATE TABLE "employees" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"employee_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"position" varchar,
  	"phone" varchar,
  	"pan" varchar,
  	"employment_state" "enum_employees_employment_state",
  	"uan" varchar,
  	"esic_number" varchar,
  	"gender" "enum_employees_gender",
  	"tax_regime" "enum_employees_tax_regime" DEFAULT 'new',
  	"epf_applicable" boolean DEFAULT true,
  	"lwf_exempt" boolean DEFAULT false,
  	"vpf_amount" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"basic_salary" numeric DEFAULT 0,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "fiscal_years" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"status" "enum_fiscal_years_status" DEFAULT 'active' NOT NULL,
  	"is_active" boolean DEFAULT false,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opening_balances" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"account_id" integer NOT NULL,
  	"fiscal_year_id" integer NOT NULL,
  	"amount" numeric DEFAULT 0,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "data_ops" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payroll_runs_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"employee_id" integer NOT NULL,
  	"employee_name" varchar,
  	"designation" varchar,
  	"department" varchar,
  	"base" numeric DEFAULT 0,
  	"gross_pay" numeric DEFAULT 0,
  	"total_deductions" numeric DEFAULT 0,
  	"net_pay" numeric DEFAULT 0,
  	"salary_slip_id" integer
  );
  
  CREATE TABLE "payroll_runs_salary_slips" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"salary_slip_id" integer NOT NULL,
  	"employee_id" integer,
  	"net_pay" numeric DEFAULT 0,
  	"status" "enum_payroll_runs_salary_slips_status"
  );
  
  CREATE TABLE "payroll_runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"fiscal_year_id" integer NOT NULL,
  	"period" varchar NOT NULL,
  	"posting_date" timestamp(3) with time zone NOT NULL,
  	"status" "enum_payroll_runs_status" DEFAULT 'Draft',
  	"gross_pay" numeric DEFAULT 0,
  	"total_deductions" numeric DEFAULT 0,
  	"net_pay" numeric DEFAULT 0,
  	"total_employer_contributions" numeric DEFAULT 0,
  	"journal_entry_id" integer,
  	"payment_journal_entry_id" integer,
  	"paid_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"notes" varchar,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payroll_slips_earnings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer,
  	"label" varchar,
  	"amount" numeric DEFAULT 0,
  	"is_tax_applicable" boolean DEFAULT true,
  	"exempted_from_income_tax" boolean DEFAULT false,
  	"do_not_include_in_total" boolean DEFAULT false
  );
  
  CREATE TABLE "payroll_slips_deductions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer,
  	"label" varchar,
  	"amount" numeric DEFAULT 0,
  	"is_tax_applicable" boolean DEFAULT true,
  	"do_not_include_in_total" boolean DEFAULT false,
  	"do_not_include_in_accounts" boolean DEFAULT false
  );
  
  CREATE TABLE "payroll_slips_employer_contributions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer,
  	"label" varchar,
  	"amount" numeric DEFAULT 0,
  	"do_not_include_in_total" boolean DEFAULT false,
  	"do_not_include_in_accounts" boolean DEFAULT false
  );
  
  CREATE TABLE "payroll_slips_leave_details" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"leave_type" varchar,
  	"days" numeric DEFAULT 0,
  	"paid_days" numeric DEFAULT 0,
  	"unpaid_days" numeric DEFAULT 0
  );
  
  CREATE TABLE "payroll_slips_timesheets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"timesheet" varchar,
  	"days" numeric DEFAULT 0,
  	"amount" numeric DEFAULT 0
  );
  
  CREATE TABLE "payroll_slips_accrued_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer,
  	"label" varchar,
  	"amount" numeric DEFAULT 0
  );
  
  CREATE TABLE "payroll_slips_additional_salary" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"additional_salary_id" integer,
  	"amount" numeric DEFAULT 0,
  	"type" varchar
  );
  
  CREATE TABLE "payroll_slips_loan_repayment" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"loan_id" integer,
  	"amount" numeric DEFAULT 0,
  	"principal_amount" numeric DEFAULT 0,
  	"interest_amount" numeric DEFAULT 0
  );
  
  CREATE TABLE "payroll_slips_advance_recovery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"additional_salary_id" integer,
  	"amount" numeric DEFAULT 0
  );
  
  CREATE TABLE "payroll_slips_flexible_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer,
  	"label" varchar,
  	"amount" numeric DEFAULT 0
  );
  
  CREATE TABLE "payroll_slips_payroll_cost_centers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"cost_center" varchar,
  	"percentage" numeric DEFAULT 100
  );
  
  CREATE TABLE "payroll_slips" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slip_number" varchar NOT NULL,
  	"employee_id" integer NOT NULL,
  	"employee_name" varchar,
  	"company_id" integer,
  	"currency" varchar DEFAULT 'INR',
  	"period" varchar NOT NULL,
  	"posting_date" timestamp(3) with time zone NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"payroll_frequency" "enum_payroll_slips_payroll_frequency" DEFAULT 'Monthly',
  	"salary_structure_id" integer,
  	"salary_structure_assignment_id" integer,
  	"payroll_run_id" integer,
  	"department" varchar,
  	"designation" varchar,
  	"branch" varchar,
  	"total_working_days" numeric DEFAULT 0,
  	"payment_days" numeric DEFAULT 0,
  	"leave_without_pay" numeric DEFAULT 0,
  	"absent_days" numeric DEFAULT 0,
  	"salary_mode" varchar,
  	"bank_name" varchar,
  	"bank_account_number" varchar,
  	"base" numeric DEFAULT 0,
  	"variable" numeric DEFAULT 0,
  	"gross_pay" numeric DEFAULT 0,
  	"total_earnings" numeric DEFAULT 0,
  	"total_deductions_amount" numeric DEFAULT 0,
  	"total_employer_contributions" numeric DEFAULT 0,
  	"net_pay" numeric DEFAULT 0,
  	"rounded_total" numeric DEFAULT 0,
  	"employee_gross_pay" numeric DEFAULT 0,
  	"employer_gross_pay" numeric DEFAULT 0,
  	"employee_total_deduction" numeric DEFAULT 0,
  	"employer_total_contribution" numeric DEFAULT 0,
  	"employee_net_pay" numeric DEFAULT 0,
  	"employer_net_pay" numeric DEFAULT 0,
  	"ctc" numeric DEFAULT 0,
  	"annual_taxable_amount" numeric DEFAULT 0,
  	"total_income_tax" numeric DEFAULT 0,
  	"income_tax_deducted_till_date" numeric DEFAULT 0,
  	"current_month_income_tax" numeric DEFAULT 0,
  	"year_to_date" numeric DEFAULT 0,
  	"month_to_date" numeric DEFAULT 0,
  	"taxable_earnings_till_date" numeric DEFAULT 0,
  	"tax_deducted_till_date" numeric DEFAULT 0,
  	"status" "enum_payroll_slips_status" DEFAULT 'Draft',
  	"journal_entry_id" integer,
  	"payment_journal_entry_id" integer,
  	"paid_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"approved_by_id" integer,
  	"notes" varchar,
  	"tax_exemption_declaration_id" integer,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "salary_components_accounts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"company_id" integer NOT NULL,
  	"account_id" integer,
  	"expense_account_id" integer,
  	"liability_account_id" integer
  );
  
  CREATE TABLE "salary_components" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"abbr" varchar NOT NULL,
  	"type" "enum_salary_components_type" NOT NULL,
  	"condition" varchar,
  	"amount" numeric DEFAULT 0,
  	"amount_based_on_formula" boolean DEFAULT false,
  	"formula" varchar,
  	"depends_on_payment_days" boolean DEFAULT false,
  	"is_tax_applicable" boolean DEFAULT true,
  	"exempted_from_income_tax" boolean DEFAULT false,
  	"statistical_component" boolean DEFAULT false,
  	"do_not_include_in_total" boolean DEFAULT false,
  	"do_not_include_in_accounts" boolean DEFAULT false,
  	"remove_if_zero_valued" boolean DEFAULT false,
  	"variable_based_on_taxable_salary" boolean DEFAULT false,
  	"is_flexible_benefit" boolean DEFAULT false,
  	"accrual_component" boolean DEFAULT false,
  	"active" boolean DEFAULT true,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "salary_structures_earnings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer NOT NULL,
  	"amount" numeric DEFAULT 0,
  	"amount_based_on_formula" boolean DEFAULT false,
  	"formula" varchar,
  	"condition" varchar,
  	"depends_on_payment_days" boolean DEFAULT false,
  	"is_tax_applicable" boolean DEFAULT true,
  	"exempted_from_income_tax" boolean DEFAULT false,
  	"do_not_include_in_total" boolean DEFAULT false,
  	"statistical_component" boolean DEFAULT false,
  	"do_not_include_in_accounts" boolean DEFAULT false
  );
  
  CREATE TABLE "salary_structures_deductions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer NOT NULL,
  	"amount" numeric DEFAULT 0,
  	"amount_based_on_formula" boolean DEFAULT false,
  	"formula" varchar,
  	"condition" varchar,
  	"depends_on_payment_days" boolean DEFAULT false,
  	"is_tax_applicable" boolean DEFAULT true,
  	"do_not_include_in_accounts" boolean DEFAULT false
  );
  
  CREATE TABLE "salary_structures_employer_contributions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer NOT NULL,
  	"amount" numeric DEFAULT 0,
  	"amount_based_on_formula" boolean DEFAULT false,
  	"formula" varchar,
  	"condition" varchar,
  	"depends_on_payment_days" boolean DEFAULT false,
  	"do_not_include_in_total" boolean DEFAULT false,
  	"do_not_include_in_accounts" boolean DEFAULT false
  );
  
  CREATE TABLE "salary_structures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"description" varchar,
  	"company_id" integer NOT NULL,
  	"currency" varchar DEFAULT 'INR',
  	"letter_head" varchar,
  	"payroll_frequency" "enum_salary_structures_payroll_frequency" DEFAULT 'Monthly',
  	"salary_slip_based_on_timesheet" boolean DEFAULT false,
  	"timesheet_salary_component_id" integer,
  	"hourly_rate_component_id" integer,
  	"hourly_rate_amount" numeric DEFAULT 0,
  	"leave_encashment_amount_per_day" numeric DEFAULT 0,
  	"max_benefits" numeric DEFAULT 0,
  	"mode_of_payment" varchar,
  	"payment_account_id" integer,
  	"is_active" boolean DEFAULT true,
  	"is_default" boolean DEFAULT false,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "salary_structure_assignments_employee_benefits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"component_id" integer,
  	"amount" numeric DEFAULT 0,
  	"description" varchar
  );
  
  CREATE TABLE "salary_structure_assignments_cost_centers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"cost_center" varchar,
  	"percentage" numeric DEFAULT 100
  );
  
  CREATE TABLE "salary_structure_assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"employee_id" integer NOT NULL,
  	"salary_structure_id" integer NOT NULL,
  	"from_date" timestamp(3) with time zone NOT NULL,
  	"company_id" integer,
  	"currency" varchar DEFAULT 'INR',
  	"base" numeric DEFAULT 0,
  	"variable" numeric DEFAULT 0,
  	"annual_gross_earning" numeric DEFAULT 0,
  	"ctc" numeric DEFAULT 0,
  	"income_tax_slab" varchar,
  	"payroll_payable_account_id" integer,
  	"taxable_earnings_till_date" numeric DEFAULT 0,
  	"tax_deducted_till_date" numeric DEFAULT 0,
  	"leave_encashment_amount_per_day" numeric DEFAULT 0,
  	"max_benefits" numeric DEFAULT 0,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "additional_salaries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"employee_id" integer NOT NULL,
  	"salary_structure_assignment_id" integer,
  	"component_id" integer,
  	"type" "enum_additional_salaries_type" NOT NULL,
  	"amount" numeric DEFAULT 0 NOT NULL,
  	"payroll_frequency" "enum_additional_salaries_payroll_frequency" DEFAULT 'Once',
  	"is_recurring" boolean DEFAULT false,
  	"repeat_every" numeric DEFAULT 0,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"reference" varchar,
  	"is_tax_applicable" boolean DEFAULT true,
  	"is_payable" boolean DEFAULT true,
  	"is_recoverable" boolean DEFAULT false,
  	"is_effected_through_payroll" boolean DEFAULT true,
  	"status" "enum_additional_salaries_status" DEFAULT 'Active',
  	"created_by_id" integer,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "loans_repayment_schedule" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"principal" numeric DEFAULT 0,
  	"interest" numeric DEFAULT 0,
  	"total" numeric DEFAULT 0,
  	"status" "enum_loans_repayment_schedule_status",
  	"journal_entry_id" integer
  );
  
  CREATE TABLE "loans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"loan_name" varchar NOT NULL,
  	"employee_id" integer NOT NULL,
  	"employee_name" varchar,
  	"loan_type_id" integer NOT NULL,
  	"sanction_date" timestamp(3) with time zone NOT NULL,
  	"sanction_amount" numeric DEFAULT 0 NOT NULL,
  	"principal_amount" numeric DEFAULT 0 NOT NULL,
  	"interest_rate" numeric DEFAULT 0 NOT NULL,
  	"disbursement_date" timestamp(3) with time zone,
  	"disbursement_account_id" integer,
  	"disbursement_journal_entry_id" integer,
  	"payment_account_id" integer,
  	"repayment_start_date" timestamp(3) with time zone,
  	"repayment_end_date" timestamp(3) with time zone,
  	"total_payment" numeric DEFAULT 0,
  	"total_interest" numeric DEFAULT 0,
  	"total_principal" numeric DEFAULT 0,
  	"paid_amount" numeric DEFAULT 0,
  	"balance_amount" numeric DEFAULT 0,
  	"repay_from_salary" boolean DEFAULT false,
  	"repay_amount" numeric DEFAULT 0,
  	"repay_from_salary_account_id" integer,
  	"status" "enum_loans_status" DEFAULT 'Active',
  	"created_by_id" integer,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "loan_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"type" "enum_loan_types_type" NOT NULL,
  	"interest_type" "enum_loan_types_interest_type" DEFAULT 'Reducing Balance',
  	"repayment_method" "enum_loan_types_repayment_method" DEFAULT 'Installment',
  	"repayment_method_detail" varchar,
  	"min_principal_amount" numeric DEFAULT 0,
  	"max_principal_amount" numeric DEFAULT 0,
  	"min_rate_of_interest" numeric DEFAULT 0,
  	"max_rate_of_interest" numeric DEFAULT 0,
  	"min_tenure" numeric DEFAULT 0,
  	"max_tenure" numeric DEFAULT 0,
  	"max_loan_amount" numeric DEFAULT 0,
  	"min_loan_amount" numeric DEFAULT 0,
  	"active" boolean DEFAULT true,
  	"doc_field_for_status" "enum_loan_types_doc_field_for_status" DEFAULT 'Active',
  	"doc_field_for_status_in_list" "enum_loan_types_doc_field_for_status_in_list" DEFAULT 'Active',
  	"max_count" numeric DEFAULT 0,
  	"allow_overpayment" boolean DEFAULT false,
  	"recall" boolean DEFAULT false,
  	"recall_msg" varchar,
  	"loanschedule_basedon" "enum_loan_types_loanschedule_basedon" DEFAULT 'Repayment',
  	"is_slab_based" boolean DEFAULT false,
  	"notes" varchar,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tax_exemption_declarations_deductions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"deduction_type" "enum_tax_exemption_declarations_deductions_deduction_type",
  	"description" varchar,
  	"amount" numeric DEFAULT 0,
  	"proof_attached" boolean DEFAULT false
  );
  
  CREATE TABLE "tax_exemption_declarations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"employee_id" integer NOT NULL,
  	"employee_name" varchar,
  	"income_year" varchar NOT NULL,
  	"declaration_date" timestamp(3) with time zone NOT NULL,
  	"submit_date" timestamp(3) with time zone,
  	"submit_for" "enum_tax_exemption_declarations_submit_for",
  	"status" "enum_tax_exemption_declarations_status" DEFAULT 'Draft',
  	"total_deduction" numeric DEFAULT 0,
  	"notes" varchar,
  	"created_by_id" integer,
  	"approved_by_id" integer,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payroll_periods" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"period" varchar NOT NULL,
  	"company_id" integer NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"payroll_frequency" "enum_payroll_periods_payroll_frequency" DEFAULT 'Monthly',
  	"active" boolean DEFAULT true,
  	"is_draft" boolean DEFAULT false,
  	"is_submit" boolean DEFAULT false,
  	"doc_status" "enum_payroll_periods_doc_status" DEFAULT 'Draft',
  	"payroll_entry_id" integer,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payroll_component_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"company_id" integer NOT NULL,
  	"salary_component_id" integer NOT NULL,
  	"account_id" integer,
  	"expense_account_id" integer,
  	"liability_account_id" integer,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "flexible_benefit_returns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"employee_id" integer NOT NULL,
  	"employee_name" varchar,
  	"salary_structure_assignment_id" integer,
  	"component_id" integer,
  	"amount" numeric DEFAULT 0 NOT NULL,
  	"return_type" "enum_flexible_benefit_returns_return_type",
  	"description" varchar,
  	"active" boolean DEFAULT true,
  	"retire_on_declaration" boolean DEFAULT false,
  	"declaration_id" integer,
  	"created_by_id" integer,
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "salary_structure_flexible_benefits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"salary_structure_id" integer NOT NULL,
  	"component_id" integer NOT NULL,
  	"amount" numeric DEFAULT 0 NOT NULL,
  	"base_amount" numeric DEFAULT 0,
  	"benefit_amount" numeric DEFAULT 0,
  	"type" "enum_salary_structure_flexible_benefits_type",
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payroll_run_employees" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"payroll_run_id" integer NOT NULL,
  	"employee_id" integer NOT NULL,
  	"employee_name" varchar,
  	"salary_structure_assignment_id" integer,
  	"base" numeric DEFAULT 0,
  	"variable" numeric DEFAULT 0,
  	"create_payroll_slip" boolean DEFAULT true,
  	"status" "enum_payroll_run_employees_status" DEFAULT 'Active',
  	"fiscal_year_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payroll_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"epf_enabled" boolean DEFAULT false,
  	"esic_enabled" boolean DEFAULT false,
  	"professional_tax_enabled" boolean DEFAULT false,
  	"lwf_enabled" boolean DEFAULT false,
  	"tds_enabled" boolean DEFAULT false,
  	"pf_number" varchar,
  	"esi_number" varchar,
  	"lwf_number" varchar,
  	"default_employment_state" "enum_payroll_settings_default_employment_state",
  	"epf_payable_account_id" integer,
  	"eps_payable_account_id" integer,
  	"edli_payable_account_id" integer,
  	"esic_payable_account_id" integer,
  	"pt_payable_account_id" integer,
  	"lwf_payable_account_id" integer,
  	"tds_payable_account_id" integer,
  	"statutory_expense_account_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-10-11T04:54:10.154Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-10-11T04:54:10.154Z';
  ALTER TABLE "gl_accounts" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "journal_entries" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "parties" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "documents" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "items" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "stock_movements" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "account_groups" ADD COLUMN "description" varchar;
  ALTER TABLE "account_groups" ADD COLUMN "sort_order" numeric DEFAULT 0;
  ALTER TABLE "journal_entries" ADD COLUMN "cleared" boolean DEFAULT false;
  ALTER TABLE "journal_entries" ADD COLUMN "cleared_at" timestamp(3) with time zone;
  ALTER TABLE "journal_entries" ADD COLUMN "transfer_ref" varchar;
  ALTER TABLE "journal_entries" ADD COLUMN "created_by_user" varchar;
  ALTER TABLE "parties" ADD COLUMN "receivable_account_id" integer;
  ALTER TABLE "parties" ADD COLUMN "payable_account_id" integer;
  ALTER TABLE "parties" ADD COLUMN "donor" boolean DEFAULT false;
  ALTER TABLE "documents" ADD COLUMN "order_status" "enum_documents_order_status" DEFAULT 'draft';
  ALTER TABLE "documents" ADD COLUMN "confirmed_at" timestamp(3) with time zone;
  ALTER TABLE "documents" ADD COLUMN "cancelled_at" timestamp(3) with time zone;
  ALTER TABLE "documents" ADD COLUMN "reference_to_doc_type" varchar;
  ALTER TABLE "documents" ADD COLUMN "linked_invoice_id" integer;
  ALTER TABLE "documents" ADD COLUMN "source_quote_id" integer;
  ALTER TABLE "documents" ADD COLUMN "voided_amount" numeric DEFAULT 0;
  ALTER TABLE "documents" ADD COLUMN "from_account_id" integer;
  ALTER TABLE "documents" ADD COLUMN "to_account_id" integer;
  ALTER TABLE "documents" ADD COLUMN "donation_purpose" "enum_documents_donation_purpose";
  ALTER TABLE "doc_sequences" ADD COLUMN "name" varchar NOT NULL;
  ALTER TABLE "doc_sequences" ADD COLUMN "doc_type" "enum_doc_sequences_doc_type" NOT NULL;
  ALTER TABLE "doc_sequences" ADD COLUMN "prefix" varchar DEFAULT '';
  ALTER TABLE "doc_sequences" ADD COLUMN "format" varchar DEFAULT '{prefix}{year}-{number}';
  ALTER TABLE "doc_sequences" ADD COLUMN "fiscal_year_id" integer;
  ALTER TABLE "doc_sequences" ADD COLUMN "next_preview" varchar;
  ALTER TABLE "tenants" ADD COLUMN "code" varchar;
  ALTER TABLE "tenants" ADD COLUMN "type" "enum_tenants_type" DEFAULT 'illaka';
  ALTER TABLE "tenants" ADD COLUMN "active" boolean DEFAULT true;
  ALTER TABLE "members" ADD COLUMN "membership_type_id" integer;
  ALTER TABLE "members" ADD COLUMN "renewal_date" timestamp(3) with time zone;
  ALTER TABLE "members" ADD COLUMN "last_receipt_id" integer;
  ALTER TABLE "members" ADD COLUMN "payment_status" "enum_members_payment_status" DEFAULT 'unpaid';
  ALTER TABLE "members" ADD COLUMN "application_citizenship_no" varchar;
  ALTER TABLE "members" ADD COLUMN "application_citizenship_issued_date_bs" varchar;
  ALTER TABLE "members" ADD COLUMN "application_citizenship_district" "enum_members_application_citizenship_district";
  ALTER TABLE "members" ADD COLUMN "application_address_permanent" varchar;
  ALTER TABLE "members" ADD COLUMN "application_address_temporary" varchar;
  ALTER TABLE "members" ADD COLUMN "application_mobile" varchar;
  ALTER TABLE "members" ADD COLUMN "application_special_qualification" varchar;
  ALTER TABLE "members" ADD COLUMN "application_occupation" varchar;
  ALTER TABLE "members" ADD COLUMN "application_office_name" varchar;
  ALTER TABLE "members" ADD COLUMN "application_father_name" varchar;
  ALTER TABLE "members" ADD COLUMN "application_grandfather_name" varchar;
  ALTER TABLE "members" ADD COLUMN "application_father_in_law_name" varchar;
  ALTER TABLE "members" ADD COLUMN "application_spouse_name" varchar;
  ALTER TABLE "members" ADD COLUMN "application_son_name" varchar;
  ALTER TABLE "members" ADD COLUMN "application_daughter_name" varchar;
  ALTER TABLE "members" ADD COLUMN "application_applied_date_bs" varchar;
  ALTER TABLE "archives" ADD COLUMN "category" "enum_archives_category" DEFAULT 'general';
  ALTER TABLE "archives" ADD COLUMN "document_file_id" integer;
  ALTER TABLE "archives_locales" ADD COLUMN "source_or_location" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "timeline_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tax_types_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "elders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "membership_types_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bank_statements_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fixed_assets_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_logs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "recurring_schedules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "expense_claims_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "employees_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "fiscal_years_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "opening_balances_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "data_ops_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payroll_runs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payroll_slips_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "salary_components_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "salary_structures_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "salary_structure_assignments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "additional_salaries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "loans_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "loan_types_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tax_exemption_declarations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payroll_periods_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payroll_component_accounts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "flexible_benefit_returns_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "salary_structure_flexible_benefits_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payroll_run_employees_id" integer;
  ALTER TABLE "billing_settings" ADD COLUMN "calendar_type" "enum_billing_settings_calendar_type" DEFAULT 'BS';
  ALTER TABLE "billing_settings" ADD COLUMN "date_format" varchar DEFAULT 'YYYY-MM-DD';
  ALTER TABLE "billing_settings" ADD COLUMN "time_format" "enum_billing_settings_time_format" DEFAULT '12h';
  ALTER TABLE "billing_settings" ADD COLUMN "active_fiscal_year_id" integer;
  ALTER TABLE "billing_settings" ADD COLUMN "bank_reconciliation_enabled" boolean DEFAULT false;
  ALTER TABLE "billing_settings" ADD COLUMN "simplified_invoice_enabled" boolean DEFAULT true;
  ALTER TABLE "billing_settings" ADD COLUMN "simplified_invoice_threshold" numeric DEFAULT 5000;
  ALTER TABLE "billing_settings" ADD COLUMN "demo_seed_enabled" boolean DEFAULT true;
  ALTER TABLE "billing_settings" ADD COLUMN "nepali_digits_enabled" boolean DEFAULT false;
  ALTER TABLE "billing_settings" ADD COLUMN "nepali_words_on_print_enabled" boolean DEFAULT false;
  ALTER TABLE "billing_settings" ADD COLUMN "company_name" varchar;
  ALTER TABLE "billing_settings" ADD COLUMN "company_pan" varchar;
  ALTER TABLE "billing_settings" ADD COLUMN "company_contact" varchar;
  ALTER TABLE "billing_settings" ADD COLUMN "company_email" varchar;
  ALTER TABLE "billing_settings" ADD COLUMN "company_address" varchar;
  ALTER TABLE "billing_settings" ADD COLUMN "company_logo" varchar;
  ALTER TABLE "billing_settings" ADD COLUMN "membership_fee_account_id" integer;
  ALTER TABLE "billing_settings" ADD COLUMN "donation_account_id" integer;
  ALTER TABLE "billing_settings" ADD COLUMN "depreciation_account_id" integer;
  ALTER TABLE "billing_settings" ADD COLUMN "accumulated_depreciation_account_id" integer;
  ALTER TABLE "billing_settings" ADD COLUMN "def_account_order" jsonb;
  ALTER TABLE "billing_settings" ADD COLUMN "data_epoch" numeric DEFAULT 0;
  ALTER TABLE "timeline_locales" ADD CONSTRAINT "timeline_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."timeline"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_voided_items" ADD CONSTRAINT "documents_voided_items_credit_note_id_id_documents_id_fk" FOREIGN KEY ("credit_note_id_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_voided_items" ADD CONSTRAINT "documents_voided_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "documents_tax_lines" ADD CONSTRAINT "documents_tax_lines_tax_type_id_tax_types_id_fk" FOREIGN KEY ("tax_type_id") REFERENCES "public"."tax_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents_tax_lines" ADD CONSTRAINT "documents_tax_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tax_types" ADD CONSTRAINT "tax_types_sales_account_id_gl_accounts_id_fk" FOREIGN KEY ("sales_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tax_types" ADD CONSTRAINT "tax_types_purchase_account_id_gl_accounts_id_fk" FOREIGN KEY ("purchase_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tax_types" ADD CONSTRAINT "tax_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "elders" ADD CONSTRAINT "elders_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "elders_locales" ADD CONSTRAINT "elders_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."elders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bank_statements_rows" ADD CONSTRAINT "bank_statements_rows_matched_entry_id_journal_entries_id_fk" FOREIGN KEY ("matched_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bank_statements_rows" ADD CONSTRAINT "bank_statements_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fixed_assets_depreciation_rows" ADD CONSTRAINT "fixed_assets_depreciation_rows_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fixed_assets_depreciation_rows" ADD CONSTRAINT "fixed_assets_depreciation_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recurring_schedules_lines" ADD CONSTRAINT "recurring_schedules_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recurring_schedules_lines" ADD CONSTRAINT "recurring_schedules_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."recurring_schedules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expense_claims_lines" ADD CONSTRAINT "expense_claims_lines_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expense_claims_lines" ADD CONSTRAINT "expense_claims_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."expense_claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "employees_allowances" ADD CONSTRAINT "employees_allowances_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "employees_deductions" ADD CONSTRAINT "employees_deductions_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "employees_deductions" ADD CONSTRAINT "employees_deductions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs_lines" ADD CONSTRAINT "payroll_runs_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs_lines" ADD CONSTRAINT "payroll_runs_lines_salary_slip_id_payroll_slips_id_fk" FOREIGN KEY ("salary_slip_id") REFERENCES "public"."payroll_slips"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs_lines" ADD CONSTRAINT "payroll_runs_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_runs_salary_slips" ADD CONSTRAINT "payroll_runs_salary_slips_salary_slip_id_payroll_slips_id_fk" FOREIGN KEY ("salary_slip_id") REFERENCES "public"."payroll_slips"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs_salary_slips" ADD CONSTRAINT "payroll_runs_salary_slips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs_salary_slips" ADD CONSTRAINT "payroll_runs_salary_slips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payment_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("payment_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_earnings" ADD CONSTRAINT "payroll_slips_earnings_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_earnings" ADD CONSTRAINT "payroll_slips_earnings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_deductions" ADD CONSTRAINT "payroll_slips_deductions_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_deductions" ADD CONSTRAINT "payroll_slips_deductions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_employer_contributions" ADD CONSTRAINT "payroll_slips_employer_contributions_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_employer_contributions" ADD CONSTRAINT "payroll_slips_employer_contributions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_leave_details" ADD CONSTRAINT "payroll_slips_leave_details_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_timesheets" ADD CONSTRAINT "payroll_slips_timesheets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_accrued_benefits" ADD CONSTRAINT "payroll_slips_accrued_benefits_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_accrued_benefits" ADD CONSTRAINT "payroll_slips_accrued_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_additional_salary" ADD CONSTRAINT "payroll_slips_additional_salary_additional_salary_id_additional_salaries_id_fk" FOREIGN KEY ("additional_salary_id") REFERENCES "public"."additional_salaries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_additional_salary" ADD CONSTRAINT "payroll_slips_additional_salary_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_loan_repayment" ADD CONSTRAINT "payroll_slips_loan_repayment_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_loan_repayment" ADD CONSTRAINT "payroll_slips_loan_repayment_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_advance_recovery" ADD CONSTRAINT "payroll_slips_advance_recovery_additional_salary_id_additional_salaries_id_fk" FOREIGN KEY ("additional_salary_id") REFERENCES "public"."additional_salaries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_advance_recovery" ADD CONSTRAINT "payroll_slips_advance_recovery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_flexible_benefits" ADD CONSTRAINT "payroll_slips_flexible_benefits_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips_flexible_benefits" ADD CONSTRAINT "payroll_slips_flexible_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips_payroll_cost_centers" ADD CONSTRAINT "payroll_slips_payroll_cost_centers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_company_id_tenants_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_salary_structure_id_salary_structures_id_fk" FOREIGN KEY ("salary_structure_id") REFERENCES "public"."salary_structures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_salary_structure_assignment_id_salary_structure_assignments_id_fk" FOREIGN KEY ("salary_structure_assignment_id") REFERENCES "public"."salary_structure_assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_payment_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("payment_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_tax_exemption_declaration_id_tax_exemption_declarations_id_fk" FOREIGN KEY ("tax_exemption_declaration_id") REFERENCES "public"."tax_exemption_declarations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_slips" ADD CONSTRAINT "payroll_slips_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_components_accounts" ADD CONSTRAINT "salary_components_accounts_company_id_tenants_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_components_accounts" ADD CONSTRAINT "salary_components_accounts_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_components_accounts" ADD CONSTRAINT "salary_components_accounts_expense_account_id_gl_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_components_accounts" ADD CONSTRAINT "salary_components_accounts_liability_account_id_gl_accounts_id_fk" FOREIGN KEY ("liability_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_components_accounts" ADD CONSTRAINT "salary_components_accounts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salary_components"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures_earnings" ADD CONSTRAINT "salary_structures_earnings_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures_earnings" ADD CONSTRAINT "salary_structures_earnings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salary_structures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salary_structures_deductions" ADD CONSTRAINT "salary_structures_deductions_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures_deductions" ADD CONSTRAINT "salary_structures_deductions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salary_structures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salary_structures_employer_contributions" ADD CONSTRAINT "salary_structures_employer_contributions_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures_employer_contributions" ADD CONSTRAINT "salary_structures_employer_contributions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salary_structures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_company_id_tenants_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_timesheet_salary_component_id_salary_components_id_fk" FOREIGN KEY ("timesheet_salary_component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_hourly_rate_component_id_salary_components_id_fk" FOREIGN KEY ("hourly_rate_component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_payment_account_id_gl_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments_employee_benefits" ADD CONSTRAINT "salary_structure_assignments_employee_benefits_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments_employee_benefits" ADD CONSTRAINT "salary_structure_assignments_employee_benefits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salary_structure_assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments_cost_centers" ADD CONSTRAINT "salary_structure_assignments_cost_centers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."salary_structure_assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments" ADD CONSTRAINT "salary_structure_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments" ADD CONSTRAINT "salary_structure_assignments_salary_structure_id_salary_structures_id_fk" FOREIGN KEY ("salary_structure_id") REFERENCES "public"."salary_structures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments" ADD CONSTRAINT "salary_structure_assignments_company_id_tenants_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments" ADD CONSTRAINT "salary_structure_assignments_payroll_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("payroll_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments" ADD CONSTRAINT "salary_structure_assignments_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_assignments" ADD CONSTRAINT "salary_structure_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "additional_salaries" ADD CONSTRAINT "additional_salaries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "additional_salaries" ADD CONSTRAINT "additional_salaries_salary_structure_assignment_id_salary_structure_assignments_id_fk" FOREIGN KEY ("salary_structure_assignment_id") REFERENCES "public"."salary_structure_assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "additional_salaries" ADD CONSTRAINT "additional_salaries_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "additional_salaries" ADD CONSTRAINT "additional_salaries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "additional_salaries" ADD CONSTRAINT "additional_salaries_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "additional_salaries" ADD CONSTRAINT "additional_salaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans_repayment_schedule" ADD CONSTRAINT "loans_repayment_schedule_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans_repayment_schedule" ADD CONSTRAINT "loans_repayment_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_loan_type_id_loan_types_id_fk" FOREIGN KEY ("loan_type_id") REFERENCES "public"."loan_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_disbursement_account_id_gl_accounts_id_fk" FOREIGN KEY ("disbursement_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_disbursement_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("disbursement_journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_payment_account_id_gl_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_repay_from_salary_account_id_gl_accounts_id_fk" FOREIGN KEY ("repay_from_salary_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loans" ADD CONSTRAINT "loans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loan_types" ADD CONSTRAINT "loan_types_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "loan_types" ADD CONSTRAINT "loan_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tax_exemption_declarations_deductions" ADD CONSTRAINT "tax_exemption_declarations_deductions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tax_exemption_declarations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tax_exemption_declarations" ADD CONSTRAINT "tax_exemption_declarations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tax_exemption_declarations" ADD CONSTRAINT "tax_exemption_declarations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tax_exemption_declarations" ADD CONSTRAINT "tax_exemption_declarations_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tax_exemption_declarations" ADD CONSTRAINT "tax_exemption_declarations_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tax_exemption_declarations" ADD CONSTRAINT "tax_exemption_declarations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_company_id_tenants_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_payroll_entry_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_entry_id") REFERENCES "public"."payroll_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_component_accounts" ADD CONSTRAINT "payroll_component_accounts_company_id_tenants_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_component_accounts" ADD CONSTRAINT "payroll_component_accounts_salary_component_id_salary_components_id_fk" FOREIGN KEY ("salary_component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_component_accounts" ADD CONSTRAINT "payroll_component_accounts_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_component_accounts" ADD CONSTRAINT "payroll_component_accounts_expense_account_id_gl_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_component_accounts" ADD CONSTRAINT "payroll_component_accounts_liability_account_id_gl_accounts_id_fk" FOREIGN KEY ("liability_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_component_accounts" ADD CONSTRAINT "payroll_component_accounts_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_component_accounts" ADD CONSTRAINT "payroll_component_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flexible_benefit_returns" ADD CONSTRAINT "flexible_benefit_returns_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flexible_benefit_returns" ADD CONSTRAINT "flexible_benefit_returns_salary_structure_assignment_id_salary_structure_assignments_id_fk" FOREIGN KEY ("salary_structure_assignment_id") REFERENCES "public"."salary_structure_assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flexible_benefit_returns" ADD CONSTRAINT "flexible_benefit_returns_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flexible_benefit_returns" ADD CONSTRAINT "flexible_benefit_returns_declaration_id_tax_exemption_declarations_id_fk" FOREIGN KEY ("declaration_id") REFERENCES "public"."tax_exemption_declarations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flexible_benefit_returns" ADD CONSTRAINT "flexible_benefit_returns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flexible_benefit_returns" ADD CONSTRAINT "flexible_benefit_returns_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "flexible_benefit_returns" ADD CONSTRAINT "flexible_benefit_returns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_flexible_benefits" ADD CONSTRAINT "salary_structure_flexible_benefits_salary_structure_id_salary_structures_id_fk" FOREIGN KEY ("salary_structure_id") REFERENCES "public"."salary_structures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_flexible_benefits" ADD CONSTRAINT "salary_structure_flexible_benefits_component_id_salary_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_flexible_benefits" ADD CONSTRAINT "salary_structure_flexible_benefits_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "salary_structure_flexible_benefits" ADD CONSTRAINT "salary_structure_flexible_benefits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_salary_structure_assignment_id_salary_structure_assignments_id_fk" FOREIGN KEY ("salary_structure_assignment_id") REFERENCES "public"."salary_structure_assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_run_employees" ADD CONSTRAINT "payroll_run_employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_epf_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("epf_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_eps_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("eps_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_edli_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("edli_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_esic_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("esic_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_pt_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("pt_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_lwf_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("lwf_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_tds_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("tds_payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_statutory_expense_account_id_gl_accounts_id_fk" FOREIGN KEY ("statutory_expense_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "timeline_year_idx" ON "timeline" USING btree ("year");
  CREATE INDEX "timeline_updated_at_idx" ON "timeline" USING btree ("updated_at");
  CREATE INDEX "timeline_created_at_idx" ON "timeline" USING btree ("created_at");
  CREATE UNIQUE INDEX "timeline_locales_locale_parent_id_unique" ON "timeline_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "documents_voided_items_order_idx" ON "documents_voided_items" USING btree ("_order");
  CREATE INDEX "documents_voided_items_parent_id_idx" ON "documents_voided_items" USING btree ("_parent_id");
  CREATE INDEX "documents_voided_items_credit_note_id_idx" ON "documents_voided_items" USING btree ("credit_note_id_id");
  CREATE INDEX "documents_tax_lines_order_idx" ON "documents_tax_lines" USING btree ("_order");
  CREATE INDEX "documents_tax_lines_parent_id_idx" ON "documents_tax_lines" USING btree ("_parent_id");
  CREATE INDEX "documents_tax_lines_tax_type_idx" ON "documents_tax_lines" USING btree ("tax_type_id");
  CREATE UNIQUE INDEX "tax_types_code_idx" ON "tax_types" USING btree ("code");
  CREATE INDEX "tax_types_sales_account_idx" ON "tax_types" USING btree ("sales_account_id");
  CREATE INDEX "tax_types_purchase_account_idx" ON "tax_types" USING btree ("purchase_account_id");
  CREATE INDEX "tax_types_tenant_idx" ON "tax_types" USING btree ("tenant_id");
  CREATE INDEX "tax_types_updated_at_idx" ON "tax_types" USING btree ("updated_at");
  CREATE INDEX "tax_types_created_at_idx" ON "tax_types" USING btree ("created_at");
  CREATE INDEX "elders_photo_idx" ON "elders" USING btree ("photo_id");
  CREATE INDEX "elders_updated_at_idx" ON "elders" USING btree ("updated_at");
  CREATE INDEX "elders_created_at_idx" ON "elders" USING btree ("created_at");
  CREATE UNIQUE INDEX "elders_locales_locale_parent_id_unique" ON "elders_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "membership_types_name_idx" ON "membership_types" USING btree ("name");
  CREATE INDEX "membership_types_updated_at_idx" ON "membership_types" USING btree ("updated_at");
  CREATE INDEX "membership_types_created_at_idx" ON "membership_types" USING btree ("created_at");
  CREATE INDEX "bank_statements_rows_order_idx" ON "bank_statements_rows" USING btree ("_order");
  CREATE INDEX "bank_statements_rows_parent_id_idx" ON "bank_statements_rows" USING btree ("_parent_id");
  CREATE INDEX "bank_statements_rows_matched_entry_idx" ON "bank_statements_rows" USING btree ("matched_entry_id");
  CREATE INDEX "bank_statements_account_idx" ON "bank_statements" USING btree ("account_id");
  CREATE INDEX "bank_statements_tenant_idx" ON "bank_statements" USING btree ("tenant_id");
  CREATE INDEX "bank_statements_updated_at_idx" ON "bank_statements" USING btree ("updated_at");
  CREATE INDEX "bank_statements_created_at_idx" ON "bank_statements" USING btree ("created_at");
  CREATE INDEX "fixed_assets_depreciation_rows_order_idx" ON "fixed_assets_depreciation_rows" USING btree ("_order");
  CREATE INDEX "fixed_assets_depreciation_rows_parent_id_idx" ON "fixed_assets_depreciation_rows" USING btree ("_parent_id");
  CREATE INDEX "fixed_assets_depreciation_rows_journal_entry_idx" ON "fixed_assets_depreciation_rows" USING btree ("journal_entry_id");
  CREATE INDEX "fixed_assets_tenant_idx" ON "fixed_assets" USING btree ("tenant_id");
  CREATE INDEX "fixed_assets_updated_at_idx" ON "fixed_assets" USING btree ("updated_at");
  CREATE INDEX "fixed_assets_created_at_idx" ON "fixed_assets" USING btree ("created_at");
  CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");
  CREATE INDEX "audit_logs_updated_at_idx" ON "audit_logs" USING btree ("updated_at");
  CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
  CREATE INDEX "recurring_schedules_lines_order_idx" ON "recurring_schedules_lines" USING btree ("_order");
  CREATE INDEX "recurring_schedules_lines_parent_id_idx" ON "recurring_schedules_lines" USING btree ("_parent_id");
  CREATE INDEX "recurring_schedules_lines_item_idx" ON "recurring_schedules_lines" USING btree ("item_id");
  CREATE INDEX "recurring_schedules_party_idx" ON "recurring_schedules" USING btree ("party_id");
  CREATE INDEX "recurring_schedules_tenant_idx" ON "recurring_schedules" USING btree ("tenant_id");
  CREATE INDEX "recurring_schedules_updated_at_idx" ON "recurring_schedules" USING btree ("updated_at");
  CREATE INDEX "recurring_schedules_created_at_idx" ON "recurring_schedules" USING btree ("created_at");
  CREATE INDEX "expense_claims_lines_order_idx" ON "expense_claims_lines" USING btree ("_order");
  CREATE INDEX "expense_claims_lines_parent_id_idx" ON "expense_claims_lines" USING btree ("_parent_id");
  CREATE INDEX "expense_claims_lines_account_idx" ON "expense_claims_lines" USING btree ("account_id");
  CREATE UNIQUE INDEX "expense_claims_claim_number_idx" ON "expense_claims" USING btree ("claim_number");
  CREATE INDEX "expense_claims_party_idx" ON "expense_claims" USING btree ("party_id");
  CREATE INDEX "expense_claims_tenant_idx" ON "expense_claims" USING btree ("tenant_id");
  CREATE INDEX "expense_claims_updated_at_idx" ON "expense_claims" USING btree ("updated_at");
  CREATE INDEX "expense_claims_created_at_idx" ON "expense_claims" USING btree ("created_at");
  CREATE INDEX "employees_allowances_order_idx" ON "employees_allowances" USING btree ("_order");
  CREATE INDEX "employees_allowances_parent_id_idx" ON "employees_allowances" USING btree ("_parent_id");
  CREATE INDEX "employees_deductions_order_idx" ON "employees_deductions" USING btree ("_order");
  CREATE INDEX "employees_deductions_parent_id_idx" ON "employees_deductions" USING btree ("_parent_id");
  CREATE INDEX "employees_deductions_account_idx" ON "employees_deductions" USING btree ("account_id");
  CREATE INDEX "employees_tenant_idx" ON "employees" USING btree ("tenant_id");
  CREATE INDEX "employees_updated_at_idx" ON "employees" USING btree ("updated_at");
  CREATE INDEX "employees_created_at_idx" ON "employees" USING btree ("created_at");
  CREATE INDEX "fiscal_years_tenant_idx" ON "fiscal_years" USING btree ("tenant_id");
  CREATE INDEX "fiscal_years_updated_at_idx" ON "fiscal_years" USING btree ("updated_at");
  CREATE INDEX "fiscal_years_created_at_idx" ON "fiscal_years" USING btree ("created_at");
  CREATE INDEX "opening_balances_account_idx" ON "opening_balances" USING btree ("account_id");
  CREATE INDEX "opening_balances_fiscal_year_idx" ON "opening_balances" USING btree ("fiscal_year_id");
  CREATE INDEX "opening_balances_tenant_idx" ON "opening_balances" USING btree ("tenant_id");
  CREATE INDEX "opening_balances_updated_at_idx" ON "opening_balances" USING btree ("updated_at");
  CREATE INDEX "opening_balances_created_at_idx" ON "opening_balances" USING btree ("created_at");
  CREATE INDEX "data_ops_updated_at_idx" ON "data_ops" USING btree ("updated_at");
  CREATE INDEX "data_ops_created_at_idx" ON "data_ops" USING btree ("created_at");
  CREATE INDEX "payroll_runs_lines_order_idx" ON "payroll_runs_lines" USING btree ("_order");
  CREATE INDEX "payroll_runs_lines_parent_id_idx" ON "payroll_runs_lines" USING btree ("_parent_id");
  CREATE INDEX "payroll_runs_lines_employee_idx" ON "payroll_runs_lines" USING btree ("employee_id");
  CREATE INDEX "payroll_runs_lines_salary_slip_idx" ON "payroll_runs_lines" USING btree ("salary_slip_id");
  CREATE INDEX "payroll_runs_salary_slips_order_idx" ON "payroll_runs_salary_slips" USING btree ("_order");
  CREATE INDEX "payroll_runs_salary_slips_parent_id_idx" ON "payroll_runs_salary_slips" USING btree ("_parent_id");
  CREATE INDEX "payroll_runs_salary_slips_salary_slip_idx" ON "payroll_runs_salary_slips" USING btree ("salary_slip_id");
  CREATE INDEX "payroll_runs_salary_slips_employee_idx" ON "payroll_runs_salary_slips" USING btree ("employee_id");
  CREATE INDEX "payroll_runs_fiscal_year_idx" ON "payroll_runs" USING btree ("fiscal_year_id");
  CREATE INDEX "payroll_runs_journal_entry_idx" ON "payroll_runs" USING btree ("journal_entry_id");
  CREATE INDEX "payroll_runs_payment_journal_entry_idx" ON "payroll_runs" USING btree ("payment_journal_entry_id");
  CREATE INDEX "payroll_runs_created_by_idx" ON "payroll_runs" USING btree ("created_by_id");
  CREATE INDEX "payroll_runs_tenant_idx" ON "payroll_runs" USING btree ("tenant_id");
  CREATE INDEX "payroll_runs_updated_at_idx" ON "payroll_runs" USING btree ("updated_at");
  CREATE INDEX "payroll_runs_created_at_idx" ON "payroll_runs" USING btree ("created_at");
  CREATE INDEX "payroll_slips_earnings_order_idx" ON "payroll_slips_earnings" USING btree ("_order");
  CREATE INDEX "payroll_slips_earnings_parent_id_idx" ON "payroll_slips_earnings" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_earnings_component_idx" ON "payroll_slips_earnings" USING btree ("component_id");
  CREATE INDEX "payroll_slips_deductions_order_idx" ON "payroll_slips_deductions" USING btree ("_order");
  CREATE INDEX "payroll_slips_deductions_parent_id_idx" ON "payroll_slips_deductions" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_deductions_component_idx" ON "payroll_slips_deductions" USING btree ("component_id");
  CREATE INDEX "payroll_slips_employer_contributions_order_idx" ON "payroll_slips_employer_contributions" USING btree ("_order");
  CREATE INDEX "payroll_slips_employer_contributions_parent_id_idx" ON "payroll_slips_employer_contributions" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_employer_contributions_component_idx" ON "payroll_slips_employer_contributions" USING btree ("component_id");
  CREATE INDEX "payroll_slips_leave_details_order_idx" ON "payroll_slips_leave_details" USING btree ("_order");
  CREATE INDEX "payroll_slips_leave_details_parent_id_idx" ON "payroll_slips_leave_details" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_timesheets_order_idx" ON "payroll_slips_timesheets" USING btree ("_order");
  CREATE INDEX "payroll_slips_timesheets_parent_id_idx" ON "payroll_slips_timesheets" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_accrued_benefits_order_idx" ON "payroll_slips_accrued_benefits" USING btree ("_order");
  CREATE INDEX "payroll_slips_accrued_benefits_parent_id_idx" ON "payroll_slips_accrued_benefits" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_accrued_benefits_component_idx" ON "payroll_slips_accrued_benefits" USING btree ("component_id");
  CREATE INDEX "payroll_slips_additional_salary_order_idx" ON "payroll_slips_additional_salary" USING btree ("_order");
  CREATE INDEX "payroll_slips_additional_salary_parent_id_idx" ON "payroll_slips_additional_salary" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_additional_salary_additional_salary_idx" ON "payroll_slips_additional_salary" USING btree ("additional_salary_id");
  CREATE INDEX "payroll_slips_loan_repayment_order_idx" ON "payroll_slips_loan_repayment" USING btree ("_order");
  CREATE INDEX "payroll_slips_loan_repayment_parent_id_idx" ON "payroll_slips_loan_repayment" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_loan_repayment_loan_idx" ON "payroll_slips_loan_repayment" USING btree ("loan_id");
  CREATE INDEX "payroll_slips_advance_recovery_order_idx" ON "payroll_slips_advance_recovery" USING btree ("_order");
  CREATE INDEX "payroll_slips_advance_recovery_parent_id_idx" ON "payroll_slips_advance_recovery" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_advance_recovery_additional_salary_idx" ON "payroll_slips_advance_recovery" USING btree ("additional_salary_id");
  CREATE INDEX "payroll_slips_flexible_benefits_order_idx" ON "payroll_slips_flexible_benefits" USING btree ("_order");
  CREATE INDEX "payroll_slips_flexible_benefits_parent_id_idx" ON "payroll_slips_flexible_benefits" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_flexible_benefits_component_idx" ON "payroll_slips_flexible_benefits" USING btree ("component_id");
  CREATE INDEX "payroll_slips_payroll_cost_centers_order_idx" ON "payroll_slips_payroll_cost_centers" USING btree ("_order");
  CREATE INDEX "payroll_slips_payroll_cost_centers_parent_id_idx" ON "payroll_slips_payroll_cost_centers" USING btree ("_parent_id");
  CREATE INDEX "payroll_slips_employee_idx" ON "payroll_slips" USING btree ("employee_id");
  CREATE INDEX "payroll_slips_company_idx" ON "payroll_slips" USING btree ("company_id");
  CREATE INDEX "payroll_slips_salary_structure_idx" ON "payroll_slips" USING btree ("salary_structure_id");
  CREATE INDEX "payroll_slips_salary_structure_assignment_idx" ON "payroll_slips" USING btree ("salary_structure_assignment_id");
  CREATE INDEX "payroll_slips_payroll_run_idx" ON "payroll_slips" USING btree ("payroll_run_id");
  CREATE INDEX "payroll_slips_journal_entry_idx" ON "payroll_slips" USING btree ("journal_entry_id");
  CREATE INDEX "payroll_slips_payment_journal_entry_idx" ON "payroll_slips" USING btree ("payment_journal_entry_id");
  CREATE INDEX "payroll_slips_created_by_idx" ON "payroll_slips" USING btree ("created_by_id");
  CREATE INDEX "payroll_slips_approved_by_idx" ON "payroll_slips" USING btree ("approved_by_id");
  CREATE INDEX "payroll_slips_tax_exemption_declaration_idx" ON "payroll_slips" USING btree ("tax_exemption_declaration_id");
  CREATE INDEX "payroll_slips_fiscal_year_idx" ON "payroll_slips" USING btree ("fiscal_year_id");
  CREATE INDEX "payroll_slips_tenant_idx" ON "payroll_slips" USING btree ("tenant_id");
  CREATE INDEX "payroll_slips_updated_at_idx" ON "payroll_slips" USING btree ("updated_at");
  CREATE INDEX "payroll_slips_created_at_idx" ON "payroll_slips" USING btree ("created_at");
  CREATE INDEX "salary_components_accounts_order_idx" ON "salary_components_accounts" USING btree ("_order");
  CREATE INDEX "salary_components_accounts_parent_id_idx" ON "salary_components_accounts" USING btree ("_parent_id");
  CREATE INDEX "salary_components_accounts_company_idx" ON "salary_components_accounts" USING btree ("company_id");
  CREATE INDEX "salary_components_accounts_account_idx" ON "salary_components_accounts" USING btree ("account_id");
  CREATE INDEX "salary_components_accounts_expense_account_idx" ON "salary_components_accounts" USING btree ("expense_account_id");
  CREATE INDEX "salary_components_accounts_liability_account_idx" ON "salary_components_accounts" USING btree ("liability_account_id");
  CREATE INDEX "salary_components_tenant_idx" ON "salary_components" USING btree ("tenant_id");
  CREATE INDEX "salary_components_updated_at_idx" ON "salary_components" USING btree ("updated_at");
  CREATE INDEX "salary_components_created_at_idx" ON "salary_components" USING btree ("created_at");
  CREATE INDEX "salary_structures_earnings_order_idx" ON "salary_structures_earnings" USING btree ("_order");
  CREATE INDEX "salary_structures_earnings_parent_id_idx" ON "salary_structures_earnings" USING btree ("_parent_id");
  CREATE INDEX "salary_structures_earnings_component_idx" ON "salary_structures_earnings" USING btree ("component_id");
  CREATE INDEX "salary_structures_deductions_order_idx" ON "salary_structures_deductions" USING btree ("_order");
  CREATE INDEX "salary_structures_deductions_parent_id_idx" ON "salary_structures_deductions" USING btree ("_parent_id");
  CREATE INDEX "salary_structures_deductions_component_idx" ON "salary_structures_deductions" USING btree ("component_id");
  CREATE INDEX "salary_structures_employer_contributions_order_idx" ON "salary_structures_employer_contributions" USING btree ("_order");
  CREATE INDEX "salary_structures_employer_contributions_parent_id_idx" ON "salary_structures_employer_contributions" USING btree ("_parent_id");
  CREATE INDEX "salary_structures_employer_contributions_component_idx" ON "salary_structures_employer_contributions" USING btree ("component_id");
  CREATE INDEX "salary_structures_company_idx" ON "salary_structures" USING btree ("company_id");
  CREATE INDEX "salary_structures_timesheet_salary_component_idx" ON "salary_structures" USING btree ("timesheet_salary_component_id");
  CREATE INDEX "salary_structures_hourly_rate_component_idx" ON "salary_structures" USING btree ("hourly_rate_component_id");
  CREATE INDEX "salary_structures_payment_account_idx" ON "salary_structures" USING btree ("payment_account_id");
  CREATE INDEX "salary_structures_fiscal_year_idx" ON "salary_structures" USING btree ("fiscal_year_id");
  CREATE INDEX "salary_structures_tenant_idx" ON "salary_structures" USING btree ("tenant_id");
  CREATE INDEX "salary_structures_updated_at_idx" ON "salary_structures" USING btree ("updated_at");
  CREATE INDEX "salary_structures_created_at_idx" ON "salary_structures" USING btree ("created_at");
  CREATE INDEX "salary_structure_assignments_employee_benefits_order_idx" ON "salary_structure_assignments_employee_benefits" USING btree ("_order");
  CREATE INDEX "salary_structure_assignments_employee_benefits_parent_id_idx" ON "salary_structure_assignments_employee_benefits" USING btree ("_parent_id");
  CREATE INDEX "salary_structure_assignments_employee_benefits_component_idx" ON "salary_structure_assignments_employee_benefits" USING btree ("component_id");
  CREATE INDEX "salary_structure_assignments_cost_centers_order_idx" ON "salary_structure_assignments_cost_centers" USING btree ("_order");
  CREATE INDEX "salary_structure_assignments_cost_centers_parent_id_idx" ON "salary_structure_assignments_cost_centers" USING btree ("_parent_id");
  CREATE INDEX "salary_structure_assignments_employee_idx" ON "salary_structure_assignments" USING btree ("employee_id");
  CREATE INDEX "salary_structure_assignments_salary_structure_idx" ON "salary_structure_assignments" USING btree ("salary_structure_id");
  CREATE INDEX "salary_structure_assignments_company_idx" ON "salary_structure_assignments" USING btree ("company_id");
  CREATE INDEX "salary_structure_assignments_payroll_payable_account_idx" ON "salary_structure_assignments" USING btree ("payroll_payable_account_id");
  CREATE INDEX "salary_structure_assignments_fiscal_year_idx" ON "salary_structure_assignments" USING btree ("fiscal_year_id");
  CREATE INDEX "salary_structure_assignments_tenant_idx" ON "salary_structure_assignments" USING btree ("tenant_id");
  CREATE INDEX "salary_structure_assignments_updated_at_idx" ON "salary_structure_assignments" USING btree ("updated_at");
  CREATE INDEX "salary_structure_assignments_created_at_idx" ON "salary_structure_assignments" USING btree ("created_at");
  CREATE INDEX "additional_salaries_employee_idx" ON "additional_salaries" USING btree ("employee_id");
  CREATE INDEX "additional_salaries_salary_structure_assignment_idx" ON "additional_salaries" USING btree ("salary_structure_assignment_id");
  CREATE INDEX "additional_salaries_component_idx" ON "additional_salaries" USING btree ("component_id");
  CREATE INDEX "additional_salaries_created_by_idx" ON "additional_salaries" USING btree ("created_by_id");
  CREATE INDEX "additional_salaries_fiscal_year_idx" ON "additional_salaries" USING btree ("fiscal_year_id");
  CREATE INDEX "additional_salaries_tenant_idx" ON "additional_salaries" USING btree ("tenant_id");
  CREATE INDEX "additional_salaries_updated_at_idx" ON "additional_salaries" USING btree ("updated_at");
  CREATE INDEX "additional_salaries_created_at_idx" ON "additional_salaries" USING btree ("created_at");
  CREATE INDEX "loans_repayment_schedule_order_idx" ON "loans_repayment_schedule" USING btree ("_order");
  CREATE INDEX "loans_repayment_schedule_parent_id_idx" ON "loans_repayment_schedule" USING btree ("_parent_id");
  CREATE INDEX "loans_repayment_schedule_journal_entry_idx" ON "loans_repayment_schedule" USING btree ("journal_entry_id");
  CREATE INDEX "loans_employee_idx" ON "loans" USING btree ("employee_id");
  CREATE INDEX "loans_loan_type_idx" ON "loans" USING btree ("loan_type_id");
  CREATE INDEX "loans_disbursement_account_idx" ON "loans" USING btree ("disbursement_account_id");
  CREATE INDEX "loans_disbursement_journal_entry_idx" ON "loans" USING btree ("disbursement_journal_entry_id");
  CREATE INDEX "loans_payment_account_idx" ON "loans" USING btree ("payment_account_id");
  CREATE INDEX "loans_repay_from_salary_account_idx" ON "loans" USING btree ("repay_from_salary_account_id");
  CREATE INDEX "loans_created_by_idx" ON "loans" USING btree ("created_by_id");
  CREATE INDEX "loans_fiscal_year_idx" ON "loans" USING btree ("fiscal_year_id");
  CREATE INDEX "loans_tenant_idx" ON "loans" USING btree ("tenant_id");
  CREATE INDEX "loans_updated_at_idx" ON "loans" USING btree ("updated_at");
  CREATE INDEX "loans_created_at_idx" ON "loans" USING btree ("created_at");
  CREATE INDEX "loan_types_fiscal_year_idx" ON "loan_types" USING btree ("fiscal_year_id");
  CREATE INDEX "loan_types_tenant_idx" ON "loan_types" USING btree ("tenant_id");
  CREATE INDEX "loan_types_updated_at_idx" ON "loan_types" USING btree ("updated_at");
  CREATE INDEX "loan_types_created_at_idx" ON "loan_types" USING btree ("created_at");
  CREATE INDEX "tax_exemption_declarations_deductions_order_idx" ON "tax_exemption_declarations_deductions" USING btree ("_order");
  CREATE INDEX "tax_exemption_declarations_deductions_parent_id_idx" ON "tax_exemption_declarations_deductions" USING btree ("_parent_id");
  CREATE INDEX "tax_exemption_declarations_employee_idx" ON "tax_exemption_declarations" USING btree ("employee_id");
  CREATE INDEX "tax_exemption_declarations_created_by_idx" ON "tax_exemption_declarations" USING btree ("created_by_id");
  CREATE INDEX "tax_exemption_declarations_approved_by_idx" ON "tax_exemption_declarations" USING btree ("approved_by_id");
  CREATE INDEX "tax_exemption_declarations_fiscal_year_idx" ON "tax_exemption_declarations" USING btree ("fiscal_year_id");
  CREATE INDEX "tax_exemption_declarations_tenant_idx" ON "tax_exemption_declarations" USING btree ("tenant_id");
  CREATE INDEX "tax_exemption_declarations_updated_at_idx" ON "tax_exemption_declarations" USING btree ("updated_at");
  CREATE INDEX "tax_exemption_declarations_created_at_idx" ON "tax_exemption_declarations" USING btree ("created_at");
  CREATE INDEX "payroll_periods_company_idx" ON "payroll_periods" USING btree ("company_id");
  CREATE INDEX "payroll_periods_payroll_entry_idx" ON "payroll_periods" USING btree ("payroll_entry_id");
  CREATE INDEX "payroll_periods_fiscal_year_idx" ON "payroll_periods" USING btree ("fiscal_year_id");
  CREATE INDEX "payroll_periods_tenant_idx" ON "payroll_periods" USING btree ("tenant_id");
  CREATE INDEX "payroll_periods_updated_at_idx" ON "payroll_periods" USING btree ("updated_at");
  CREATE INDEX "payroll_periods_created_at_idx" ON "payroll_periods" USING btree ("created_at");
  CREATE INDEX "payroll_component_accounts_company_idx" ON "payroll_component_accounts" USING btree ("company_id");
  CREATE INDEX "payroll_component_accounts_salary_component_idx" ON "payroll_component_accounts" USING btree ("salary_component_id");
  CREATE INDEX "payroll_component_accounts_account_idx" ON "payroll_component_accounts" USING btree ("account_id");
  CREATE INDEX "payroll_component_accounts_expense_account_idx" ON "payroll_component_accounts" USING btree ("expense_account_id");
  CREATE INDEX "payroll_component_accounts_liability_account_idx" ON "payroll_component_accounts" USING btree ("liability_account_id");
  CREATE INDEX "payroll_component_accounts_fiscal_year_idx" ON "payroll_component_accounts" USING btree ("fiscal_year_id");
  CREATE INDEX "payroll_component_accounts_tenant_idx" ON "payroll_component_accounts" USING btree ("tenant_id");
  CREATE INDEX "payroll_component_accounts_updated_at_idx" ON "payroll_component_accounts" USING btree ("updated_at");
  CREATE INDEX "payroll_component_accounts_created_at_idx" ON "payroll_component_accounts" USING btree ("created_at");
  CREATE INDEX "flexible_benefit_returns_employee_idx" ON "flexible_benefit_returns" USING btree ("employee_id");
  CREATE INDEX "flexible_benefit_returns_salary_structure_assignment_idx" ON "flexible_benefit_returns" USING btree ("salary_structure_assignment_id");
  CREATE INDEX "flexible_benefit_returns_component_idx" ON "flexible_benefit_returns" USING btree ("component_id");
  CREATE INDEX "flexible_benefit_returns_declaration_idx" ON "flexible_benefit_returns" USING btree ("declaration_id");
  CREATE INDEX "flexible_benefit_returns_created_by_idx" ON "flexible_benefit_returns" USING btree ("created_by_id");
  CREATE INDEX "flexible_benefit_returns_fiscal_year_idx" ON "flexible_benefit_returns" USING btree ("fiscal_year_id");
  CREATE INDEX "flexible_benefit_returns_tenant_idx" ON "flexible_benefit_returns" USING btree ("tenant_id");
  CREATE INDEX "flexible_benefit_returns_updated_at_idx" ON "flexible_benefit_returns" USING btree ("updated_at");
  CREATE INDEX "flexible_benefit_returns_created_at_idx" ON "flexible_benefit_returns" USING btree ("created_at");
  CREATE INDEX "salary_structure_flexible_benefits_salary_structure_idx" ON "salary_structure_flexible_benefits" USING btree ("salary_structure_id");
  CREATE INDEX "salary_structure_flexible_benefits_component_idx" ON "salary_structure_flexible_benefits" USING btree ("component_id");
  CREATE INDEX "salary_structure_flexible_benefits_fiscal_year_idx" ON "salary_structure_flexible_benefits" USING btree ("fiscal_year_id");
  CREATE INDEX "salary_structure_flexible_benefits_tenant_idx" ON "salary_structure_flexible_benefits" USING btree ("tenant_id");
  CREATE INDEX "salary_structure_flexible_benefits_updated_at_idx" ON "salary_structure_flexible_benefits" USING btree ("updated_at");
  CREATE INDEX "salary_structure_flexible_benefits_created_at_idx" ON "salary_structure_flexible_benefits" USING btree ("created_at");
  CREATE INDEX "payroll_run_employees_payroll_run_idx" ON "payroll_run_employees" USING btree ("payroll_run_id");
  CREATE INDEX "payroll_run_employees_employee_idx" ON "payroll_run_employees" USING btree ("employee_id");
  CREATE INDEX "payroll_run_employees_salary_structure_assignment_idx" ON "payroll_run_employees" USING btree ("salary_structure_assignment_id");
  CREATE INDEX "payroll_run_employees_fiscal_year_idx" ON "payroll_run_employees" USING btree ("fiscal_year_id");
  CREATE INDEX "payroll_run_employees_tenant_idx" ON "payroll_run_employees" USING btree ("tenant_id");
  CREATE INDEX "payroll_run_employees_updated_at_idx" ON "payroll_run_employees" USING btree ("updated_at");
  CREATE INDEX "payroll_run_employees_created_at_idx" ON "payroll_run_employees" USING btree ("created_at");
  CREATE INDEX "payroll_settings_epf_payable_account_idx" ON "payroll_settings" USING btree ("epf_payable_account_id");
  CREATE INDEX "payroll_settings_eps_payable_account_idx" ON "payroll_settings" USING btree ("eps_payable_account_id");
  CREATE INDEX "payroll_settings_edli_payable_account_idx" ON "payroll_settings" USING btree ("edli_payable_account_id");
  CREATE INDEX "payroll_settings_esic_payable_account_idx" ON "payroll_settings" USING btree ("esic_payable_account_id");
  CREATE INDEX "payroll_settings_pt_payable_account_idx" ON "payroll_settings" USING btree ("pt_payable_account_id");
  CREATE INDEX "payroll_settings_lwf_payable_account_idx" ON "payroll_settings" USING btree ("lwf_payable_account_id");
  CREATE INDEX "payroll_settings_tds_payable_account_idx" ON "payroll_settings" USING btree ("tds_payable_account_id");
  CREATE INDEX "payroll_settings_statutory_expense_account_idx" ON "payroll_settings" USING btree ("statutory_expense_account_id");
  ALTER TABLE "parties" ADD CONSTRAINT "parties_receivable_account_id_gl_accounts_id_fk" FOREIGN KEY ("receivable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "parties" ADD CONSTRAINT "parties_payable_account_id_gl_accounts_id_fk" FOREIGN KEY ("payable_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_linked_invoice_id_documents_id_fk" FOREIGN KEY ("linked_invoice_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_source_quote_id_documents_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_from_account_id_gl_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_to_account_id_gl_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "doc_sequences" ADD CONSTRAINT "doc_sequences_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "members" ADD CONSTRAINT "members_membership_type_id_membership_types_id_fk" FOREIGN KEY ("membership_type_id") REFERENCES "public"."membership_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "members" ADD CONSTRAINT "members_last_receipt_id_documents_id_fk" FOREIGN KEY ("last_receipt_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "archives" ADD CONSTRAINT "archives_document_file_id_media_id_fk" FOREIGN KEY ("document_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_timeline_fk" FOREIGN KEY ("timeline_id") REFERENCES "public"."timeline"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tax_types_fk" FOREIGN KEY ("tax_types_id") REFERENCES "public"."tax_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_elders_fk" FOREIGN KEY ("elders_id") REFERENCES "public"."elders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_membership_types_fk" FOREIGN KEY ("membership_types_id") REFERENCES "public"."membership_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bank_statements_fk" FOREIGN KEY ("bank_statements_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fixed_assets_fk" FOREIGN KEY ("fixed_assets_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_logs_fk" FOREIGN KEY ("audit_logs_id") REFERENCES "public"."audit_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_recurring_schedules_fk" FOREIGN KEY ("recurring_schedules_id") REFERENCES "public"."recurring_schedules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expense_claims_fk" FOREIGN KEY ("expense_claims_id") REFERENCES "public"."expense_claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_employees_fk" FOREIGN KEY ("employees_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_fiscal_years_fk" FOREIGN KEY ("fiscal_years_id") REFERENCES "public"."fiscal_years"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opening_balances_fk" FOREIGN KEY ("opening_balances_id") REFERENCES "public"."opening_balances"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_data_ops_fk" FOREIGN KEY ("data_ops_id") REFERENCES "public"."data_ops"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payroll_runs_fk" FOREIGN KEY ("payroll_runs_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payroll_slips_fk" FOREIGN KEY ("payroll_slips_id") REFERENCES "public"."payroll_slips"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_salary_components_fk" FOREIGN KEY ("salary_components_id") REFERENCES "public"."salary_components"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_salary_structures_fk" FOREIGN KEY ("salary_structures_id") REFERENCES "public"."salary_structures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_salary_structure_assignment_fk" FOREIGN KEY ("salary_structure_assignments_id") REFERENCES "public"."salary_structure_assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_additional_salaries_fk" FOREIGN KEY ("additional_salaries_id") REFERENCES "public"."additional_salaries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_loans_fk" FOREIGN KEY ("loans_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_loan_types_fk" FOREIGN KEY ("loan_types_id") REFERENCES "public"."loan_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tax_exemption_declarations_fk" FOREIGN KEY ("tax_exemption_declarations_id") REFERENCES "public"."tax_exemption_declarations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payroll_periods_fk" FOREIGN KEY ("payroll_periods_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payroll_component_accounts_fk" FOREIGN KEY ("payroll_component_accounts_id") REFERENCES "public"."payroll_component_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_flexible_benefit_returns_fk" FOREIGN KEY ("flexible_benefit_returns_id") REFERENCES "public"."flexible_benefit_returns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_salary_structure_flexible_b_fk" FOREIGN KEY ("salary_structure_flexible_benefits_id") REFERENCES "public"."salary_structure_flexible_benefits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payroll_run_employees_fk" FOREIGN KEY ("payroll_run_employees_id") REFERENCES "public"."payroll_run_employees"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_active_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("active_fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_membership_fee_account_id_gl_accounts_id_fk" FOREIGN KEY ("membership_fee_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_donation_account_id_gl_accounts_id_fk" FOREIGN KEY ("donation_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_depreciation_account_id_gl_accounts_id_fk" FOREIGN KEY ("depreciation_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billing_settings" ADD CONSTRAINT "billing_settings_accumulated_depreciation_account_id_gl_accounts_id_fk" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "account_groups_code_idx" ON "account_groups" USING btree ("code");
  CREATE INDEX "parties_receivable_account_idx" ON "parties" USING btree ("receivable_account_id");
  CREATE INDEX "parties_payable_account_idx" ON "parties" USING btree ("payable_account_id");
  CREATE INDEX "documents_linked_invoice_idx" ON "documents" USING btree ("linked_invoice_id");
  CREATE INDEX "documents_source_quote_idx" ON "documents" USING btree ("source_quote_id");
  CREATE INDEX "documents_from_account_idx" ON "documents" USING btree ("from_account_id");
  CREATE INDEX "documents_to_account_idx" ON "documents" USING btree ("to_account_id");
  CREATE INDEX "doc_sequences_fiscal_year_idx" ON "doc_sequences" USING btree ("fiscal_year_id");
  CREATE UNIQUE INDEX "tenants_code_idx" ON "tenants" USING btree ("code");
  CREATE INDEX "members_membership_type_idx" ON "members" USING btree ("membership_type_id");
  CREATE INDEX "members_last_receipt_idx" ON "members" USING btree ("last_receipt_id");
  CREATE INDEX "archives_category_idx" ON "archives" USING btree ("category");
  CREATE INDEX "archives_document_file_idx" ON "archives" USING btree ("document_file_id");
  CREATE INDEX "payload_locked_documents_rels_timeline_id_idx" ON "payload_locked_documents_rels" USING btree ("timeline_id");
  CREATE INDEX "payload_locked_documents_rels_tax_types_id_idx" ON "payload_locked_documents_rels" USING btree ("tax_types_id");
  CREATE INDEX "payload_locked_documents_rels_elders_id_idx" ON "payload_locked_documents_rels" USING btree ("elders_id");
  CREATE INDEX "payload_locked_documents_rels_membership_types_id_idx" ON "payload_locked_documents_rels" USING btree ("membership_types_id");
  CREATE INDEX "payload_locked_documents_rels_bank_statements_id_idx" ON "payload_locked_documents_rels" USING btree ("bank_statements_id");
  CREATE INDEX "payload_locked_documents_rels_fixed_assets_id_idx" ON "payload_locked_documents_rels" USING btree ("fixed_assets_id");
  CREATE INDEX "payload_locked_documents_rels_audit_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_logs_id");
  CREATE INDEX "payload_locked_documents_rels_recurring_schedules_id_idx" ON "payload_locked_documents_rels" USING btree ("recurring_schedules_id");
  CREATE INDEX "payload_locked_documents_rels_expense_claims_id_idx" ON "payload_locked_documents_rels" USING btree ("expense_claims_id");
  CREATE INDEX "payload_locked_documents_rels_employees_id_idx" ON "payload_locked_documents_rels" USING btree ("employees_id");
  CREATE INDEX "payload_locked_documents_rels_fiscal_years_id_idx" ON "payload_locked_documents_rels" USING btree ("fiscal_years_id");
  CREATE INDEX "payload_locked_documents_rels_opening_balances_id_idx" ON "payload_locked_documents_rels" USING btree ("opening_balances_id");
  CREATE INDEX "payload_locked_documents_rels_data_ops_id_idx" ON "payload_locked_documents_rels" USING btree ("data_ops_id");
  CREATE INDEX "payload_locked_documents_rels_payroll_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("payroll_runs_id");
  CREATE INDEX "payload_locked_documents_rels_payroll_slips_id_idx" ON "payload_locked_documents_rels" USING btree ("payroll_slips_id");
  CREATE INDEX "payload_locked_documents_rels_salary_components_id_idx" ON "payload_locked_documents_rels" USING btree ("salary_components_id");
  CREATE INDEX "payload_locked_documents_rels_salary_structures_id_idx" ON "payload_locked_documents_rels" USING btree ("salary_structures_id");
  CREATE INDEX "payload_locked_documents_rels_salary_structure_assignmen_idx" ON "payload_locked_documents_rels" USING btree ("salary_structure_assignments_id");
  CREATE INDEX "payload_locked_documents_rels_additional_salaries_id_idx" ON "payload_locked_documents_rels" USING btree ("additional_salaries_id");
  CREATE INDEX "payload_locked_documents_rels_loans_id_idx" ON "payload_locked_documents_rels" USING btree ("loans_id");
  CREATE INDEX "payload_locked_documents_rels_loan_types_id_idx" ON "payload_locked_documents_rels" USING btree ("loan_types_id");
  CREATE INDEX "payload_locked_documents_rels_tax_exemption_declarations_idx" ON "payload_locked_documents_rels" USING btree ("tax_exemption_declarations_id");
  CREATE INDEX "payload_locked_documents_rels_payroll_periods_id_idx" ON "payload_locked_documents_rels" USING btree ("payroll_periods_id");
  CREATE INDEX "payload_locked_documents_rels_payroll_component_accounts_idx" ON "payload_locked_documents_rels" USING btree ("payroll_component_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_flexible_benefit_returns_i_idx" ON "payload_locked_documents_rels" USING btree ("flexible_benefit_returns_id");
  CREATE INDEX "payload_locked_documents_rels_salary_structure_flexible__idx" ON "payload_locked_documents_rels" USING btree ("salary_structure_flexible_benefits_id");
  CREATE INDEX "payload_locked_documents_rels_payroll_run_employees_id_idx" ON "payload_locked_documents_rels" USING btree ("payroll_run_employees_id");
  CREATE INDEX "billing_settings_active_fiscal_year_idx" ON "billing_settings" USING btree ("active_fiscal_year_id");
  CREATE INDEX "billing_settings_membership_fee_account_idx" ON "billing_settings" USING btree ("membership_fee_account_id");
  CREATE INDEX "billing_settings_donation_account_idx" ON "billing_settings" USING btree ("donation_account_id");
  CREATE INDEX "billing_settings_depreciation_account_idx" ON "billing_settings" USING btree ("depreciation_account_id");
  CREATE INDEX "billing_settings_accumulated_depreciation_account_idx" ON "billing_settings" USING btree ("accumulated_depreciation_account_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "timeline" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "timeline_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents_voided_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "documents_tax_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tax_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "elders" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "elders_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bank_statements_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bank_statements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "fixed_assets_depreciation_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "fixed_assets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "recurring_schedules_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "recurring_schedules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "expense_claims_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "expense_claims" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "employees_allowances" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "employees_deductions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "employees" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "fiscal_years" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "opening_balances" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "data_ops" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_runs_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_runs_salary_slips" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_runs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_earnings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_deductions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_employer_contributions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_leave_details" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_timesheets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_accrued_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_additional_salary" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_loan_repayment" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_advance_recovery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_flexible_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips_payroll_cost_centers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_slips" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_components_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_components" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_structures_earnings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_structures_deductions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_structures_employer_contributions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_structures" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_structure_assignments_employee_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_structure_assignments_cost_centers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_structure_assignments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "additional_salaries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "loans_repayment_schedule" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "loans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "loan_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tax_exemption_declarations_deductions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tax_exemption_declarations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_periods" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_component_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "flexible_benefit_returns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "salary_structure_flexible_benefits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_run_employees" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payroll_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "timeline" CASCADE;
  DROP TABLE "timeline_locales" CASCADE;
  DROP TABLE "documents_voided_items" CASCADE;
  DROP TABLE "documents_tax_lines" CASCADE;
  DROP TABLE "tax_types" CASCADE;
  DROP TABLE "elders" CASCADE;
  DROP TABLE "elders_locales" CASCADE;
  DROP TABLE "membership_types" CASCADE;
  DROP TABLE "bank_statements_rows" CASCADE;
  DROP TABLE "bank_statements" CASCADE;
  DROP TABLE "fixed_assets_depreciation_rows" CASCADE;
  DROP TABLE "fixed_assets" CASCADE;
  DROP TABLE "audit_logs" CASCADE;
  DROP TABLE "recurring_schedules_lines" CASCADE;
  DROP TABLE "recurring_schedules" CASCADE;
  DROP TABLE "expense_claims_lines" CASCADE;
  DROP TABLE "expense_claims" CASCADE;
  DROP TABLE "employees_allowances" CASCADE;
  DROP TABLE "employees_deductions" CASCADE;
  DROP TABLE "employees" CASCADE;
  DROP TABLE "fiscal_years" CASCADE;
  DROP TABLE "opening_balances" CASCADE;
  DROP TABLE "data_ops" CASCADE;
  DROP TABLE "payroll_runs_lines" CASCADE;
  DROP TABLE "payroll_runs_salary_slips" CASCADE;
  DROP TABLE "payroll_runs" CASCADE;
  DROP TABLE "payroll_slips_earnings" CASCADE;
  DROP TABLE "payroll_slips_deductions" CASCADE;
  DROP TABLE "payroll_slips_employer_contributions" CASCADE;
  DROP TABLE "payroll_slips_leave_details" CASCADE;
  DROP TABLE "payroll_slips_timesheets" CASCADE;
  DROP TABLE "payroll_slips_accrued_benefits" CASCADE;
  DROP TABLE "payroll_slips_additional_salary" CASCADE;
  DROP TABLE "payroll_slips_loan_repayment" CASCADE;
  DROP TABLE "payroll_slips_advance_recovery" CASCADE;
  DROP TABLE "payroll_slips_flexible_benefits" CASCADE;
  DROP TABLE "payroll_slips_payroll_cost_centers" CASCADE;
  DROP TABLE "payroll_slips" CASCADE;
  DROP TABLE "salary_components_accounts" CASCADE;
  DROP TABLE "salary_components" CASCADE;
  DROP TABLE "salary_structures_earnings" CASCADE;
  DROP TABLE "salary_structures_deductions" CASCADE;
  DROP TABLE "salary_structures_employer_contributions" CASCADE;
  DROP TABLE "salary_structures" CASCADE;
  DROP TABLE "salary_structure_assignments_employee_benefits" CASCADE;
  DROP TABLE "salary_structure_assignments_cost_centers" CASCADE;
  DROP TABLE "salary_structure_assignments" CASCADE;
  DROP TABLE "additional_salaries" CASCADE;
  DROP TABLE "loans_repayment_schedule" CASCADE;
  DROP TABLE "loans" CASCADE;
  DROP TABLE "loan_types" CASCADE;
  DROP TABLE "tax_exemption_declarations_deductions" CASCADE;
  DROP TABLE "tax_exemption_declarations" CASCADE;
  DROP TABLE "payroll_periods" CASCADE;
  DROP TABLE "payroll_component_accounts" CASCADE;
  DROP TABLE "flexible_benefit_returns" CASCADE;
  DROP TABLE "salary_structure_flexible_benefits" CASCADE;
  DROP TABLE "payroll_run_employees" CASCADE;
  DROP TABLE "payroll_settings" CASCADE;
  ALTER TABLE "parties" DROP CONSTRAINT "parties_receivable_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "parties" DROP CONSTRAINT "parties_payable_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "documents" DROP CONSTRAINT "documents_linked_invoice_id_documents_id_fk";
  
  ALTER TABLE "documents" DROP CONSTRAINT "documents_source_quote_id_documents_id_fk";
  
  ALTER TABLE "documents" DROP CONSTRAINT "documents_from_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "documents" DROP CONSTRAINT "documents_to_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "doc_sequences" DROP CONSTRAINT "doc_sequences_fiscal_year_id_fiscal_years_id_fk";
  
  ALTER TABLE "members" DROP CONSTRAINT "members_membership_type_id_membership_types_id_fk";
  
  ALTER TABLE "members" DROP CONSTRAINT "members_last_receipt_id_documents_id_fk";
  
  ALTER TABLE "archives" DROP CONSTRAINT "archives_document_file_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_timeline_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tax_types_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_elders_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_membership_types_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bank_statements_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_fixed_assets_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_logs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_recurring_schedules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_expense_claims_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_employees_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_fiscal_years_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_opening_balances_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_data_ops_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payroll_runs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payroll_slips_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_salary_components_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_salary_structures_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_salary_structure_assignment_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_additional_salaries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_loans_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_loan_types_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tax_exemption_declarations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payroll_periods_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payroll_component_accounts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_flexible_benefit_returns_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_salary_structure_flexible_b_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payroll_run_employees_fk";
  
  ALTER TABLE "billing_settings" DROP CONSTRAINT "billing_settings_active_fiscal_year_id_fiscal_years_id_fk";
  
  ALTER TABLE "billing_settings" DROP CONSTRAINT "billing_settings_membership_fee_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "billing_settings" DROP CONSTRAINT "billing_settings_donation_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "billing_settings" DROP CONSTRAINT "billing_settings_depreciation_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "billing_settings" DROP CONSTRAINT "billing_settings_accumulated_depreciation_account_id_gl_accounts_id_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'admin', 'super-admin');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  ALTER TABLE "documents" ALTER COLUMN "doc_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_documents_doc_type";
  CREATE TYPE "public"."enum_documents_doc_type" AS ENUM('sales-invoice', 'purchase-invoice', 'payment-voucher', 'receipt-voucher', 'credit-note', 'debit-note', 'petty-cash-voucher', 'grn', 'delivery-challan', 'journal-voucher');
  ALTER TABLE "documents" ALTER COLUMN "doc_type" SET DATA TYPE "public"."enum_documents_doc_type" USING "doc_type"::"public"."enum_documents_doc_type";
  DROP INDEX "account_groups_code_idx";
  DROP INDEX "parties_receivable_account_idx";
  DROP INDEX "parties_payable_account_idx";
  DROP INDEX "documents_linked_invoice_idx";
  DROP INDEX "documents_source_quote_idx";
  DROP INDEX "documents_from_account_idx";
  DROP INDEX "documents_to_account_idx";
  DROP INDEX "doc_sequences_fiscal_year_idx";
  DROP INDEX "tenants_code_idx";
  DROP INDEX "members_membership_type_idx";
  DROP INDEX "members_last_receipt_idx";
  DROP INDEX "archives_category_idx";
  DROP INDEX "archives_document_file_idx";
  DROP INDEX "payload_locked_documents_rels_timeline_id_idx";
  DROP INDEX "payload_locked_documents_rels_tax_types_id_idx";
  DROP INDEX "payload_locked_documents_rels_elders_id_idx";
  DROP INDEX "payload_locked_documents_rels_membership_types_id_idx";
  DROP INDEX "payload_locked_documents_rels_bank_statements_id_idx";
  DROP INDEX "payload_locked_documents_rels_fixed_assets_id_idx";
  DROP INDEX "payload_locked_documents_rels_audit_logs_id_idx";
  DROP INDEX "payload_locked_documents_rels_recurring_schedules_id_idx";
  DROP INDEX "payload_locked_documents_rels_expense_claims_id_idx";
  DROP INDEX "payload_locked_documents_rels_employees_id_idx";
  DROP INDEX "payload_locked_documents_rels_fiscal_years_id_idx";
  DROP INDEX "payload_locked_documents_rels_opening_balances_id_idx";
  DROP INDEX "payload_locked_documents_rels_data_ops_id_idx";
  DROP INDEX "payload_locked_documents_rels_payroll_runs_id_idx";
  DROP INDEX "payload_locked_documents_rels_payroll_slips_id_idx";
  DROP INDEX "payload_locked_documents_rels_salary_components_id_idx";
  DROP INDEX "payload_locked_documents_rels_salary_structures_id_idx";
  DROP INDEX "payload_locked_documents_rels_salary_structure_assignmen_idx";
  DROP INDEX "payload_locked_documents_rels_additional_salaries_id_idx";
  DROP INDEX "payload_locked_documents_rels_loans_id_idx";
  DROP INDEX "payload_locked_documents_rels_loan_types_id_idx";
  DROP INDEX "payload_locked_documents_rels_tax_exemption_declarations_idx";
  DROP INDEX "payload_locked_documents_rels_payroll_periods_id_idx";
  DROP INDEX "payload_locked_documents_rels_payroll_component_accounts_idx";
  DROP INDEX "payload_locked_documents_rels_flexible_benefit_returns_i_idx";
  DROP INDEX "payload_locked_documents_rels_salary_structure_flexible__idx";
  DROP INDEX "payload_locked_documents_rels_payroll_run_employees_id_idx";
  DROP INDEX "billing_settings_active_fiscal_year_idx";
  DROP INDEX "billing_settings_membership_fee_account_idx";
  DROP INDEX "billing_settings_donation_account_idx";
  DROP INDEX "billing_settings_depreciation_account_idx";
  DROP INDEX "billing_settings_accumulated_depreciation_account_idx";
  ALTER TABLE "events" ALTER COLUMN "start_datetime" SET DEFAULT '2026-08-12T16:17:10.643Z';
  ALTER TABLE "events" ALTER COLUMN "end_datetime" SET DEFAULT '2026-08-12T16:17:10.643Z';
  ALTER TABLE "gl_accounts" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "journal_entries" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "parties" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "documents" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "items" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "stock_movements" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "account_groups" DROP COLUMN "description";
  ALTER TABLE "account_groups" DROP COLUMN "sort_order";
  ALTER TABLE "journal_entries" DROP COLUMN "cleared";
  ALTER TABLE "journal_entries" DROP COLUMN "cleared_at";
  ALTER TABLE "journal_entries" DROP COLUMN "transfer_ref";
  ALTER TABLE "journal_entries" DROP COLUMN "created_by_user";
  ALTER TABLE "parties" DROP COLUMN "receivable_account_id";
  ALTER TABLE "parties" DROP COLUMN "payable_account_id";
  ALTER TABLE "parties" DROP COLUMN "donor";
  ALTER TABLE "documents" DROP COLUMN "order_status";
  ALTER TABLE "documents" DROP COLUMN "confirmed_at";
  ALTER TABLE "documents" DROP COLUMN "cancelled_at";
  ALTER TABLE "documents" DROP COLUMN "reference_to_doc_type";
  ALTER TABLE "documents" DROP COLUMN "linked_invoice_id";
  ALTER TABLE "documents" DROP COLUMN "source_quote_id";
  ALTER TABLE "documents" DROP COLUMN "voided_amount";
  ALTER TABLE "documents" DROP COLUMN "from_account_id";
  ALTER TABLE "documents" DROP COLUMN "to_account_id";
  ALTER TABLE "documents" DROP COLUMN "donation_purpose";
  ALTER TABLE "doc_sequences" DROP COLUMN "name";
  ALTER TABLE "doc_sequences" DROP COLUMN "doc_type";
  ALTER TABLE "doc_sequences" DROP COLUMN "prefix";
  ALTER TABLE "doc_sequences" DROP COLUMN "format";
  ALTER TABLE "doc_sequences" DROP COLUMN "fiscal_year_id";
  ALTER TABLE "doc_sequences" DROP COLUMN "next_preview";
  ALTER TABLE "tenants" DROP COLUMN "code";
  ALTER TABLE "tenants" DROP COLUMN "type";
  ALTER TABLE "tenants" DROP COLUMN "active";
  ALTER TABLE "members" DROP COLUMN "membership_type_id";
  ALTER TABLE "members" DROP COLUMN "renewal_date";
  ALTER TABLE "members" DROP COLUMN "last_receipt_id";
  ALTER TABLE "members" DROP COLUMN "payment_status";
  ALTER TABLE "members" DROP COLUMN "application_citizenship_no";
  ALTER TABLE "members" DROP COLUMN "application_citizenship_issued_date_bs";
  ALTER TABLE "members" DROP COLUMN "application_citizenship_district";
  ALTER TABLE "members" DROP COLUMN "application_address_permanent";
  ALTER TABLE "members" DROP COLUMN "application_address_temporary";
  ALTER TABLE "members" DROP COLUMN "application_mobile";
  ALTER TABLE "members" DROP COLUMN "application_special_qualification";
  ALTER TABLE "members" DROP COLUMN "application_occupation";
  ALTER TABLE "members" DROP COLUMN "application_office_name";
  ALTER TABLE "members" DROP COLUMN "application_father_name";
  ALTER TABLE "members" DROP COLUMN "application_grandfather_name";
  ALTER TABLE "members" DROP COLUMN "application_father_in_law_name";
  ALTER TABLE "members" DROP COLUMN "application_spouse_name";
  ALTER TABLE "members" DROP COLUMN "application_son_name";
  ALTER TABLE "members" DROP COLUMN "application_daughter_name";
  ALTER TABLE "members" DROP COLUMN "application_applied_date_bs";
  ALTER TABLE "archives" DROP COLUMN "category";
  ALTER TABLE "archives" DROP COLUMN "document_file_id";
  ALTER TABLE "archives_locales" DROP COLUMN "source_or_location";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "timeline_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tax_types_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "elders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "membership_types_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "bank_statements_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "fixed_assets_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_logs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "recurring_schedules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "expense_claims_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "employees_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "fiscal_years_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "opening_balances_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "data_ops_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payroll_runs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payroll_slips_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "salary_components_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "salary_structures_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "salary_structure_assignments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "additional_salaries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "loans_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "loan_types_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tax_exemption_declarations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payroll_periods_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payroll_component_accounts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "flexible_benefit_returns_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "salary_structure_flexible_benefits_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payroll_run_employees_id";
  ALTER TABLE "billing_settings" DROP COLUMN "calendar_type";
  ALTER TABLE "billing_settings" DROP COLUMN "date_format";
  ALTER TABLE "billing_settings" DROP COLUMN "time_format";
  ALTER TABLE "billing_settings" DROP COLUMN "active_fiscal_year_id";
  ALTER TABLE "billing_settings" DROP COLUMN "bank_reconciliation_enabled";
  ALTER TABLE "billing_settings" DROP COLUMN "simplified_invoice_enabled";
  ALTER TABLE "billing_settings" DROP COLUMN "simplified_invoice_threshold";
  ALTER TABLE "billing_settings" DROP COLUMN "demo_seed_enabled";
  ALTER TABLE "billing_settings" DROP COLUMN "nepali_digits_enabled";
  ALTER TABLE "billing_settings" DROP COLUMN "nepali_words_on_print_enabled";
  ALTER TABLE "billing_settings" DROP COLUMN "company_name";
  ALTER TABLE "billing_settings" DROP COLUMN "company_pan";
  ALTER TABLE "billing_settings" DROP COLUMN "company_contact";
  ALTER TABLE "billing_settings" DROP COLUMN "company_email";
  ALTER TABLE "billing_settings" DROP COLUMN "company_address";
  ALTER TABLE "billing_settings" DROP COLUMN "company_logo";
  ALTER TABLE "billing_settings" DROP COLUMN "membership_fee_account_id";
  ALTER TABLE "billing_settings" DROP COLUMN "donation_account_id";
  ALTER TABLE "billing_settings" DROP COLUMN "depreciation_account_id";
  ALTER TABLE "billing_settings" DROP COLUMN "accumulated_depreciation_account_id";
  ALTER TABLE "billing_settings" DROP COLUMN "def_account_order";
  ALTER TABLE "billing_settings" DROP COLUMN "data_epoch";
  DROP TYPE "public"."enum_documents_tax_lines_nature";
  DROP TYPE "public"."enum_documents_order_status";
  DROP TYPE "public"."enum_documents_donation_purpose";
  DROP TYPE "public"."enum_doc_sequences_doc_type";
  DROP TYPE "public"."enum_tax_types_nature";
  DROP TYPE "public"."enum_tenants_type";
  DROP TYPE "public"."enum_members_payment_status";
  DROP TYPE "public"."enum_members_application_citizenship_district";
  DROP TYPE "public"."enum_archives_category";
  DROP TYPE "public"."enum_fixed_assets_category";
  DROP TYPE "public"."enum_fixed_assets_status";
  DROP TYPE "public"."enum_audit_logs_action";
  DROP TYPE "public"."enum_recurring_schedules_doc_type";
  DROP TYPE "public"."enum_recurring_schedules_frequency";
  DROP TYPE "public"."enum_recurring_schedules_status";
  DROP TYPE "public"."enum_expense_claims_status";
  DROP TYPE "public"."enum_employees_employment_state";
  DROP TYPE "public"."enum_employees_gender";
  DROP TYPE "public"."enum_employees_tax_regime";
  DROP TYPE "public"."enum_fiscal_years_status";
  DROP TYPE "public"."enum_payroll_runs_salary_slips_status";
  DROP TYPE "public"."enum_payroll_runs_status";
  DROP TYPE "public"."enum_payroll_slips_payroll_frequency";
  DROP TYPE "public"."enum_payroll_slips_status";
  DROP TYPE "public"."enum_salary_components_type";
  DROP TYPE "public"."enum_salary_structures_payroll_frequency";
  DROP TYPE "public"."enum_additional_salaries_type";
  DROP TYPE "public"."enum_additional_salaries_payroll_frequency";
  DROP TYPE "public"."enum_additional_salaries_status";
  DROP TYPE "public"."enum_loans_repayment_schedule_status";
  DROP TYPE "public"."enum_loans_status";
  DROP TYPE "public"."enum_loan_types_type";
  DROP TYPE "public"."enum_loan_types_interest_type";
  DROP TYPE "public"."enum_loan_types_repayment_method";
  DROP TYPE "public"."enum_loan_types_doc_field_for_status";
  DROP TYPE "public"."enum_loan_types_doc_field_for_status_in_list";
  DROP TYPE "public"."enum_loan_types_loanschedule_basedon";
  DROP TYPE "public"."enum_tax_exemption_declarations_deductions_deduction_type";
  DROP TYPE "public"."enum_tax_exemption_declarations_submit_for";
  DROP TYPE "public"."enum_tax_exemption_declarations_status";
  DROP TYPE "public"."enum_payroll_periods_payroll_frequency";
  DROP TYPE "public"."enum_payroll_periods_doc_status";
  DROP TYPE "public"."enum_flexible_benefit_returns_return_type";
  DROP TYPE "public"."enum_salary_structure_flexible_benefits_type";
  DROP TYPE "public"."enum_payroll_run_employees_status";
  DROP TYPE "public"."enum_billing_settings_calendar_type";
  DROP TYPE "public"."enum_billing_settings_time_format";
  DROP TYPE "public"."enum_payroll_settings_default_employment_state";`)
}
