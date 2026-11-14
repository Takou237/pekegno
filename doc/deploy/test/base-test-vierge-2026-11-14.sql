-- =====================================================================
-- PEKEGNO — base du SITE DE TEST, vierge (branche corrections, 079d037)
-- Généré le 14/11/2026 ; validé en le rejouant sur PostgreSQL 9.6.
--
-- Contenu : toutes les tables (215 migrations, table `migrations` remplie),
-- 10 rôles, 178 permissions et leur attribution, catégories comptables
-- système, groupe PEKEGNO, catégories de clients, réglages par défaut,
-- rubriques du catalogue, et deux super-admins :
--   admin@pekegno.com   / 12345678   (identifiant : admin)
--   admin2@pekegno.com  / 12345678   (identifiant : admin2)
-- Aucun pays, aucune agence, aucune donnée de démo ni client.
--
-- Import : phpPgAdmin -> base sc1fopa5058_test_pekegno (VIDE) -> onglet
-- « Importer ». Les droits de sc1fopa5058_test sont donnés à la fin.
-- Changer les mots de passe des admins après la première connexion.
-- =====================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';


--
-- Name: accounting_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_categories (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    agency_id uuid,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_pass_through boolean DEFAULT false NOT NULL,
    CONSTRAINT accounting_categories_type_check CHECK (((type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))
);


--
-- Name: accounting_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_transactions (
    id uuid NOT NULL,
    number bigint NOT NULL,
    agency_id uuid,
    category_id uuid,
    type character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    reference character varying(255),
    amount numeric(12,2) NOT NULL,
    client_id uuid,
    invoice_id uuid,
    transacted_at timestamp(0) without time zone NOT NULL,
    operator_id uuid,
    note character varying(255),
    beneficiary character varying(255),
    justification character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    department_id uuid,
    treasury_account_id uuid,
    is_transfer boolean DEFAULT false NOT NULL,
    is_pass_through boolean DEFAULT false NOT NULL,
    country_id uuid,
    CONSTRAINT accounting_transactions_type_check CHECK (((type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))
);


--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid NOT NULL,
    subject_type character varying(50) NOT NULL,
    subject_id uuid NOT NULL,
    assigned_to uuid,
    created_by uuid,
    type character varying(20) NOT NULL,
    title character varying(200) NOT NULL,
    notes text,
    due_at timestamp(0) without time zone,
    completed_at timestamp(0) without time zone,
    outcome character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid NOT NULL,
    user_id uuid,
    agency_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id character varying(100),
    description text,
    old_values json,
    new_values json,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    country_id uuid
);


--
-- Name: ad_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_campaigns (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    branch character varying(255) NOT NULL,
    country_id uuid NOT NULL,
    is_national boolean DEFAULT false NOT NULL,
    agency_id uuid,
    budget numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    description text,
    expense_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agencies (
    id uuid NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    country character varying(100) NOT NULL,
    city character varying(150),
    address text,
    phone character varying(50),
    email character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    organization_id uuid,
    country_id uuid,
    city_id uuid,
    type character varying(20) DEFAULT 'agency'::character varying NOT NULL,
    CONSTRAINT agencies_type_check CHECK (((type)::text = ANY ((ARRAY['agency'::character varying, 'academy'::character varying, 'mixed'::character varying])::text[])))
);


--
-- Name: agency_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agency_activities (
    id uuid NOT NULL,
    agency_id uuid NOT NULL,
    type character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT agency_activities_type_check CHECK (((type)::text = ANY ((ARRAY['agency'::character varying, 'academy'::character varying])::text[])))
);


--
-- Name: agency_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agency_categories (
    id uuid NOT NULL,
    department_id uuid,
    kind character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    color character varying(20),
    icon character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: agency_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agency_notifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    body text,
    entity_type character varying(50),
    entity_id uuid,
    data json,
    dedupe_key character varying(255),
    read_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: agency_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agency_payment_methods (
    id uuid NOT NULL,
    agency_id uuid NOT NULL,
    provider character varying(30) NOT NULL,
    phone_number character varying(30),
    account_holder character varying(150),
    instructions text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendances (
    id uuid NOT NULL,
    training_session_id uuid NOT NULL,
    status character varying(10) DEFAULT 'present'::character varying NOT NULL,
    recorded_by uuid,
    recorded_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    learner_user_id uuid,
    course_module_id uuid,
    session_date date
);


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration bigint NOT NULL
);


--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration bigint NOT NULL
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id uuid NOT NULL,
    cart_id uuid NOT NULL,
    service_id uuid,
    product_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    agency_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: cash_closings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_closings (
    id uuid NOT NULL,
    agency_id uuid,
    treasury_account_id uuid NOT NULL,
    closing_date date NOT NULL,
    opening_balance numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    theoretical_balance numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    actual_balance numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    difference numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    justification text,
    status character varying(20) DEFAULT 'closed'::character varying NOT NULL,
    closed_by uuid,
    validated_by uuid,
    validated_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    opened_at timestamp(0) without time zone,
    closed_at timestamp(0) without time zone,
    reopened_at timestamp(0) without time zone,
    reopened_by uuid
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    color character varying(7),
    icon character varying(100),
    deleted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    number character varying(30) NOT NULL,
    issued_on date NOT NULL,
    mention character varying(100),
    status character varying(10) DEFAULT 'issued'::character varying NOT NULL,
    revoked_reason character varying(255),
    file_path character varying(255),
    created_by uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id uuid NOT NULL,
    country_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: client_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_categories (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: client_team_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_team_roles (
    id uuid NOT NULL,
    department_id uuid,
    name character varying(255) NOT NULL,
    description text,
    color character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: commercial_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commercial_points (
    id uuid NOT NULL,
    commercial_id uuid NOT NULL,
    points integer NOT NULL,
    reason character varying(255) NOT NULL,
    invoice_id uuid,
    created_by uuid,
    created_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT commercial_points_reason_check CHECK (((reason)::text = ANY ((ARRAY['sale'::character varying, 'penalty'::character varying, 'adjustment'::character varying, 'prospect'::character varying, 'conversion'::character varying])::text[])))
);


--
-- Name: commercials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commercials (
    id uuid NOT NULL,
    user_id uuid,
    agency_id uuid,
    first_name character varying(150) NOT NULL,
    last_name character varying(150) NOT NULL,
    email character varying(255),
    phone character varying(50),
    commission_type character varying(255) DEFAULT 'none'::character varying NOT NULL,
    commission_value numeric(12,2),
    points_balance integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    kind character varying(255) DEFAULT 'commercial'::character varying NOT NULL,
    CONSTRAINT commercials_commission_type_check CHECK (((commission_type)::text = ANY ((ARRAY['none'::character varying, 'percent'::character varying, 'fixed'::character varying])::text[]))),
    CONSTRAINT commercials_kind_check CHECK (((kind)::text = ANY ((ARRAY['commercial'::character varying, 'employe'::character varying])::text[])))
);


--
-- Name: commission_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_entries (
    id uuid NOT NULL,
    invoice_id uuid,
    invoice_payment_id uuid,
    commission_rule_id uuid,
    rule_snapshot jsonb,
    beneficiary_commercial_id uuid,
    base_amount numeric(14,2) NOT NULL,
    amount numeric(14,2) NOT NULL,
    status character varying(20) DEFAULT 'calculated'::character varying NOT NULL,
    validated_by uuid,
    validated_at timestamp(0) without time zone,
    paid_by uuid,
    paid_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    seller_profile_id uuid,
    category character varying(20) DEFAULT 'service'::character varying NOT NULL,
    product_id uuid,
    product_type character varying(20),
    beneficiary_team_member_id uuid,
    beneficiary_user_id uuid,
    period character varying(7)
);


--
-- Name: commission_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_payments (
    id uuid NOT NULL,
    commercial_id uuid,
    invoice_id uuid,
    payment_id uuid,
    service_id uuid,
    amount numeric(12,2) NOT NULL,
    base_amount numeric(12,2) NOT NULL,
    rule character varying(20) NOT NULL,
    rate numeric(12,2),
    invoice_total numeric(12,2) NOT NULL,
    created_by uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    seller_profile_id uuid,
    commission_entry_id uuid,
    treasury_account_id uuid,
    payment_method character varying(30),
    beneficiary_team_member_id uuid,
    beneficiary_user_id uuid
);


--
-- Name: commission_rule_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_rule_role (
    rule_group_id uuid NOT NULL,
    role_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: commission_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commission_rules (
    id uuid NOT NULL,
    rule_group_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    name character varying(150) NOT NULL,
    beneficiary_commercial_id uuid,
    scope_country_id uuid,
    scope_agency_id uuid,
    scope_department_id uuid,
    service_id uuid,
    trigger_event character varying(20) NOT NULL,
    formula_type character varying(10) NOT NULL,
    percent_value numeric(5,2),
    fixed_amount numeric(14,2),
    tiers_json jsonb,
    starts_on date,
    ends_on date,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    beneficiary_seller_profile_id uuid,
    course_id uuid,
    package_id uuid,
    basis character varying(30) DEFAULT 'sale'::character varying NOT NULL,
    description text,
    product_id uuid,
    category_id uuid,
    renewal_number smallint,
    revenue_scope character varying(20) DEFAULT 'own'::character varying NOT NULL,
    min_recovery_rate numeric(5,2),
    recovery_period character varying(30) DEFAULT 'previous_month'::character varying NOT NULL,
    growth_multiplier numeric(6,2),
    max_percent numeric(5,2),
    bonus_min numeric(14,2),
    bonus_max numeric(14,2),
    target_kind character varying(20),
    renewal_on_time boolean DEFAULT false NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    industry character varying(100),
    phone character varying(50),
    email character varying(255),
    address character varying(255),
    city character varying(100),
    country character varying(100),
    website character varying(150),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: contract_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_services (
    contract_id uuid NOT NULL,
    service_id uuid NOT NULL,
    price numeric(15,2)
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid NOT NULL,
    number character varying(30) NOT NULL,
    client_id uuid NOT NULL,
    company_id uuid,
    agency_id uuid NOT NULL,
    department_id uuid,
    pack_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    amount numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    auto_renew boolean DEFAULT false NOT NULL,
    renewal_count integer DEFAULT 0 NOT NULL,
    parent_contract_id uuid,
    notes text,
    terminated_at timestamp(0) without time zone,
    terminated_reason character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    origin character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    prestation_id uuid,
    commercial_id uuid,
    budget_allocated numeric(15,2),
    activated_at timestamp(0) without time zone,
    signed_at timestamp(0) without time zone,
    signed_document_path character varying(255),
    suspended_reason text,
    legacy_subscription_id uuid
);


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    id uuid NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    code character varying(10) NOT NULL,
    iso_code character varying(3),
    phone_code character varying(10),
    currency_code character varying(10) DEFAULT 'XAF'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    exchange_rate numeric(18,6) DEFAULT '1'::numeric NOT NULL,
    invoice_settings json
);


--
-- Name: course_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_categories (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    color character varying(7),
    icon character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: course_course_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_course_category (
    course_id uuid NOT NULL,
    course_category_id uuid NOT NULL
);


--
-- Name: course_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_modules (
    id uuid NOT NULL,
    course_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    order_index integer DEFAULT 0 NOT NULL,
    duration_hours integer,
    trainer_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid NOT NULL,
    code character varying(50),
    name character varying(150) NOT NULL,
    description text,
    mode character varying(20) DEFAULT 'in_person'::character varying NOT NULL,
    price numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    duration_hours integer,
    agency_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    objective text,
    prerequisites text,
    cover_image character varying(255),
    duration_type character varying(20) DEFAULT 'limited'::character varying NOT NULL,
    duration_months smallint,
    presentation_video character varying(255),
    is_public boolean DEFAULT false NOT NULL,
    slug character varying(255)
);


--
-- Name: daily_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_balances (
    id uuid NOT NULL,
    agency_id uuid,
    date date NOT NULL,
    solde_initial numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    solde_final numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: department_chiefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_chiefs (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    department_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid NOT NULL,
    agency_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    type character varying(20) DEFAULT 'agency'::character varying NOT NULL,
    CONSTRAINT departments_type_check CHECK (((type)::text = ANY ((ARRAY['academy'::character varying, 'agency'::character varying, 'store'::character varying, 'studio'::character varying])::text[])))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid NOT NULL,
    number character varying(30) NOT NULL,
    agency_id uuid,
    department_id uuid,
    category_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL,
    expense_date date NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp(0) without time zone,
    rejected_by uuid,
    rejection_reason character varying(255),
    paid_by uuid,
    paid_at timestamp(0) without time zone,
    treasury_account_id uuid,
    justification_path character varying(255),
    note text,
    cancelled_by uuid,
    cancelled_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    is_pass_through boolean DEFAULT false NOT NULL,
    invoice_id uuid,
    service_id uuid,
    ad_campaign_id uuid,
    country_id uuid
);


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection character varying(255) NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: formation_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formation_enrollments (
    id uuid NOT NULL,
    course_id uuid NOT NULL,
    learner_user_id uuid NOT NULL,
    invoice_id uuid,
    seller_user_id uuid,
    enrolled_at timestamp(0) without time zone NOT NULL,
    status character varying(20) DEFAULT 'enrolled'::character varying NOT NULL,
    notes text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    seller_trainer_id uuid,
    discount_type character varying(255),
    discount_value numeric(12,2),
    requested_session_id uuid,
    CONSTRAINT formation_enrollments_discount_coherence CHECK ((((discount_type IS NULL) AND (discount_value IS NULL)) OR (((discount_type)::text = 'amount'::text) AND (discount_value IS NOT NULL) AND (discount_value >= (0)::numeric)) OR (((discount_type)::text = 'percent'::text) AND (discount_value IS NOT NULL) AND (discount_value > (0)::numeric) AND (discount_value <= (100)::numeric)))),
    CONSTRAINT formation_enrollments_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['amount'::character varying, 'percent'::character varying])::text[])))
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    service_id uuid,
    label character varying(255) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    line_total numeric(12,2) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    pass_tier character varying(255),
    pass_label character varying(255),
    product_id uuid,
    package_id uuid,
    prestation_id uuid,
    is_pass_through boolean DEFAULT false NOT NULL,
    category_id uuid
);


--
-- Name: invoice_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_payments (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method character varying(20),
    is_advance boolean DEFAULT false NOT NULL,
    paid_at timestamp(0) without time zone NOT NULL,
    received_by uuid,
    comment text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    treasury_account_id uuid,
    receipt_number character varying(30),
    cancelled_at timestamp(0) without time zone,
    received_at timestamp(0) without time zone,
    validated_at timestamp(0) without time zone,
    validation_status character varying(20) DEFAULT 'validated'::character varying NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid NOT NULL,
    number character varying(30) NOT NULL,
    agency_id uuid,
    client_id uuid,
    commercial_id uuid,
    seller_user_id uuid,
    invoice_date timestamp(0) without time zone NOT NULL,
    payment_type character varying(20),
    total_amount numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status character varying(255) DEFAULT 'unpaid'::character varying NOT NULL,
    commission_amount numeric(12,2),
    points_awarded integer DEFAULT 0 NOT NULL,
    comment text,
    cancelled_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    discount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    vat_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    client_name character varying(255),
    validation_status character varying(20) DEFAULT 'validated'::character varying NOT NULL,
    validated_by uuid,
    validated_at timestamp(0) without time zone,
    rejection_reason text,
    source character varying(20) DEFAULT 'in_person'::character varying NOT NULL,
    declared_advance numeric(12,2),
    payer_phone character varying(50),
    contract_id uuid,
    created_by uuid,
    client_was_created boolean DEFAULT false NOT NULL,
    due_date date,
    CONSTRAINT invoices_status_check CHECK (((status)::text = ANY ((ARRAY['unpaid'::character varying, 'partial'::character varying, 'paid'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: learner_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learner_observations (
    id uuid NOT NULL,
    learner_user_id uuid NOT NULL,
    course_id uuid,
    session_id uuid,
    content text NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    course_module_id uuid,
    author_user_id uuid,
    visible_to_client boolean DEFAULT true NOT NULL
);


--
-- Name: login_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_logs (
    id uuid NOT NULL,
    user_id uuid,
    action character varying(20) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    session_id character varying(255),
    failure_reason character varying(255),
    created_at timestamp(0) without time zone NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunities (
    id uuid NOT NULL,
    title character varying(200) NOT NULL,
    prospect_id uuid,
    client_id uuid,
    company_id uuid,
    agency_id uuid NOT NULL,
    department_id uuid,
    commercial_id uuid NOT NULL,
    stage character varying(20) DEFAULT 'new'::character varying NOT NULL,
    expected_amount numeric(15,2),
    expected_close_date date,
    won_at timestamp(0) without time zone,
    lost_at timestamp(0) without time zone,
    loss_reason text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_lines (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    line_type character varying(255) DEFAULT 'catalog'::character varying NOT NULL,
    service_id uuid,
    label character varying(255) NOT NULL,
    description text,
    unit_price numeric(12,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    line_total numeric(12,2) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    product_id uuid
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid NOT NULL,
    number character varying(255) NOT NULL,
    agency_id uuid NOT NULL,
    client_id uuid NOT NULL,
    commercial_id uuid,
    invoice_id uuid,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    order_date date NOT NULL,
    subtotal numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    discount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    vat_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    channel character varying(20) DEFAULT 'in_person'::character varying NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: package_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_items (
    id uuid NOT NULL,
    package_id uuid NOT NULL,
    service_id uuid,
    label character varying(255) NOT NULL,
    quantity integer,
    frequency character varying(20),
    unit character varying(50),
    action_type character varying(30),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: package_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_recommendations (
    id uuid NOT NULL,
    package_id uuid NOT NULL,
    client_team_role_id uuid,
    label character varying(255) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: payment_proofs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_proofs (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    submitted_by uuid,
    payment_method character varying(30) NOT NULL,
    phone_number_used character varying(30),
    reference character varying(100),
    file_path character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp(0) without time zone,
    notes text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    amount numeric(12,2),
    rejection_code character varying(40)
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: personal_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id uuid NOT NULL,
    name text NOT NULL,
    token character varying(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;


--
-- Name: prestation_action_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestation_action_comments (
    id uuid NOT NULL,
    prestation_action_id uuid NOT NULL,
    user_id uuid,
    body text NOT NULL,
    attachment_path character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: prestation_action_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestation_action_executions (
    id uuid NOT NULL,
    prestation_action_id uuid NOT NULL,
    week_number integer DEFAULT 1 NOT NULL,
    week_start_date date,
    week_end_date date,
    occurrence_number integer DEFAULT 1 NOT NULL,
    title character varying(255),
    status character varying(20) DEFAULT 'todo'::character varying NOT NULL,
    scheduled_date date,
    done_at timestamp(0) without time zone,
    proof_url character varying(2048),
    actual_cost numeric(15,2),
    note text,
    is_manual boolean DEFAULT false NOT NULL,
    user_id uuid,
    assigned_to uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    proof_file character varying(2048)
);


--
-- Name: prestation_action_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestation_action_logs (
    id uuid NOT NULL,
    prestation_action_id uuid NOT NULL,
    user_id uuid,
    done_at timestamp(0) without time zone NOT NULL,
    quantity_done integer DEFAULT 1 NOT NULL,
    proof_url character varying(255),
    cost numeric(15,2),
    note text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    proof_file character varying(2048)
);


--
-- Name: prestation_action_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestation_action_reviews (
    id uuid NOT NULL,
    prestation_action_id uuid NOT NULL,
    prestation_id uuid NOT NULL,
    client_user_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: prestation_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestation_actions (
    id uuid NOT NULL,
    prestation_id uuid NOT NULL,
    package_item_id uuid,
    type character varying(30) DEFAULT 'other'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    platform character varying(50),
    quantity integer DEFAULT 1 NOT NULL,
    frequency character varying(20) DEFAULT 'once'::character varying NOT NULL,
    unit character varying(50),
    budget numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    actual_cost numeric(15,2),
    is_pass_through boolean DEFAULT false NOT NULL,
    assigned_to uuid,
    start_date date,
    due_date date,
    status character varying(20) DEFAULT 'todo'::character varying NOT NULL,
    comment text,
    rating smallint,
    sort_order integer DEFAULT 0 NOT NULL,
    overdue_notified_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: prestation_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestation_offers (
    id uuid NOT NULL,
    agency_id uuid NOT NULL,
    department_id uuid,
    category_id uuid,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: prestation_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestation_team_members (
    id uuid NOT NULL,
    prestation_id uuid NOT NULL,
    user_id uuid,
    client_team_role_id uuid,
    is_lead boolean DEFAULT false NOT NULL,
    start_date date,
    end_date date,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    team_member_id uuid
);


--
-- Name: prestations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestations (
    id uuid NOT NULL,
    reference character varying(30) NOT NULL,
    agency_id uuid NOT NULL,
    department_id uuid,
    category_id uuid,
    name character varying(255) NOT NULL,
    description text,
    client_id uuid NOT NULL,
    company_id uuid,
    commercial_id uuid,
    package_id uuid,
    contract_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    budget numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    commission_type character varying(10),
    commission_value numeric(12,2),
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    status_reason text,
    rating_avg numeric(3,1),
    rating_count integer DEFAULT 0 NOT NULL,
    validated_by uuid,
    validated_at timestamp(0) without time zone,
    created_by uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    offer_id uuid,
    declared_advance_amount numeric(15,2),
    declared_total_paid boolean DEFAULT false NOT NULL,
    payment_proof_id uuid,
    submitted_with_proof_at timestamp(0) without time zone,
    client_direct_rating smallint,
    client_direct_comment text,
    client_direct_rated_at timestamp(0) without time zone,
    client_direct_rated_by uuid
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id uuid NOT NULL,
    service_id uuid NOT NULL,
    price numeric(12,2) NOT NULL,
    changed_at timestamp(0) without time zone NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    sku character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    category_id uuid,
    brand character varying(100),
    purchase_price numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    selling_price numeric(14,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    is_stock_managed boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    agency_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    is_public boolean DEFAULT false NOT NULL,
    slug character varying(255),
    cover_image character varying(255),
    branch character varying(20)
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid NOT NULL,
    service_id uuid,
    promo_price numeric(12,2),
    start_date timestamp(0) without time zone NOT NULL,
    end_date timestamp(0) without time zone NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    type character varying(255) DEFAULT 'amount'::character varying NOT NULL,
    discount_percent numeric(5,2),
    formation_id uuid,
    package_id uuid,
    CONSTRAINT promotions_type_check CHECK (((type)::text = ANY ((ARRAY['amount'::character varying, 'percent'::character varying])::text[]))),
    CONSTRAINT promotions_type_coherence CHECK (((((type)::text = 'amount'::text) AND (promo_price IS NOT NULL) AND (discount_percent IS NULL)) OR (((type)::text = 'percent'::text) AND (discount_percent IS NOT NULL) AND (discount_percent > (0)::numeric) AND (discount_percent <= (100)::numeric) AND (promo_price IS NULL))))
);


--
-- Name: prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prospects (
    id uuid NOT NULL,
    commercial_id uuid NOT NULL,
    agency_id uuid,
    first_name character varying(150) NOT NULL,
    last_name character varying(150) NOT NULL,
    email character varying(255),
    phone character varying(50),
    city character varying(100),
    country character varying(100),
    address character varying(255),
    notes text,
    created_by uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    company_id uuid
);


--
-- Name: role_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permission (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: seller_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_profiles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    agency_id uuid NOT NULL,
    kind character varying(20) DEFAULT 'commercial'::character varying NOT NULL,
    commission_type character varying(20) DEFAULT 'none'::character varying NOT NULL,
    commission_value numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: seminar_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seminar_tiers (
    id uuid NOT NULL,
    service_id uuid NOT NULL,
    tier character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    price numeric(12,2) NOT NULL,
    description character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    CONSTRAINT seminar_tiers_tier_check CHECK (((tier)::text = ANY ((ARRAY['classique'::character varying, 'premium'::character varying, 'vip'::character varying])::text[])))
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid NOT NULL,
    agency_id uuid,
    category_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    price numeric(12,2) NOT NULL,
    cover_image character varying(255),
    presentation_video character varying(255),
    deleted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    bonus_fixed numeric(12,2),
    is_seminar boolean DEFAULT false NOT NULL,
    code character varying(50),
    is_public boolean DEFAULT false NOT NULL,
    slug character varying(255),
    commission_type character varying(10),
    commission_value numeric(12,2),
    branch character varying(20)
);


--
-- Name: session_module_trainers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_module_trainers (
    id uuid NOT NULL,
    training_session_id uuid NOT NULL,
    course_module_id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: session_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_participants (
    id uuid NOT NULL,
    training_session_id uuid NOT NULL,
    formation_enrollment_id uuid NOT NULL,
    status character varying(20) DEFAULT 'enrolled'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id uuid,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id uuid NOT NULL,
    key character varying(100) NOT NULL,
    value json NOT NULL,
    description text,
    updated_by uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: subscription_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_notifications (
    id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    notification_type character varying(255) NOT NULL,
    scheduled_for date,
    sent_at timestamp(0) without time zone,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    channel character varying(255) DEFAULT 'in-app'::character varying NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    error_message text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: subscription_pack_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_pack_services (
    id uuid NOT NULL,
    subscription_pack_id uuid NOT NULL,
    service_id uuid NOT NULL,
    price_per_month numeric(12,2) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: subscription_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_packs (
    id uuid NOT NULL,
    agency_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    price_per_month numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    code character varying(30),
    department_id uuid,
    category_id uuid,
    tagline character varying(255),
    prerequisites text,
    original_price numeric(15,2),
    price_is_starting_from boolean DEFAULT false NOT NULL,
    billing_period character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    min_duration_months integer,
    sort_order integer DEFAULT 0 NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    cover_image character varying(255)
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid NOT NULL,
    subscription_pack_id uuid NOT NULL,
    agency_id uuid NOT NULL,
    client_id uuid NOT NULL,
    months integer NOT NULL,
    price_per_month numeric(12,2) NOT NULL,
    total_price numeric(12,2) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    invoice_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    status character varying(255) DEFAULT 'active'::character varying NOT NULL,
    cancelled_at date
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid NOT NULL,
    agency_id uuid,
    department_id uuid,
    first_name character varying(150) NOT NULL,
    last_name character varying(150) NOT NULL,
    email character varying(255),
    phone character varying(50),
    user_id uuid,
    commission_type character varying(20) DEFAULT 'none'::character varying NOT NULL,
    commission_value numeric(12,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: trainer_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trainer_points (
    id uuid NOT NULL,
    trainer_id uuid NOT NULL,
    points integer NOT NULL,
    reason character varying(50) DEFAULT 'sale'::character varying NOT NULL,
    invoice_id uuid,
    created_by uuid,
    created_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: trainers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trainers (
    id uuid NOT NULL,
    agency_id uuid,
    user_id uuid,
    first_name character varying(150),
    last_name character varying(150),
    email character varying(255),
    phone character varying(50),
    bio text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    points_balance integer DEFAULT 0 NOT NULL
);


--
-- Name: training_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_sessions (
    id uuid NOT NULL,
    course_id uuid NOT NULL,
    agency_id uuid,
    start_at timestamp(0) without time zone NOT NULL,
    end_at timestamp(0) without time zone,
    max_capacity integer,
    price numeric(14,2),
    status character varying(20) DEFAULT 'planned'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    trainer_id uuid,
    module_id uuid,
    duration_type character varying(20) DEFAULT 'unlimited'::character varying NOT NULL
);


--
-- Name: treasury_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_accounts (
    id uuid NOT NULL,
    agency_id uuid,
    name character varying(100) NOT NULL,
    type character varying(20) NOT NULL,
    provider character varying(50),
    account_number character varying(50),
    opening_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    currency_code character varying(3) DEFAULT 'XAF'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    code character varying(5),
    visible_roles json,
    method_key character varying(40),
    country_id uuid
);


--
-- Name: treasury_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_transactions (
    id uuid NOT NULL,
    treasury_account_id uuid NOT NULL,
    direction character varying(10) NOT NULL,
    amount numeric(12,2) NOT NULL,
    source_type character varying(50),
    source_id uuid,
    category character varying(50),
    label character varying(200) NOT NULL,
    reference character varying(100),
    transacted_at timestamp(0) without time zone NOT NULL,
    created_by uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    transfer_type character varying(30)
);


--
-- Name: user_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_assignments (
    user_id uuid NOT NULL,
    agency_id uuid NOT NULL,
    department_id uuid,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_department_chief boolean DEFAULT false NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    first_name character varying(150),
    last_name character varying(150),
    phone character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    active_session_id character varying(255),
    last_login_at timestamp(0) without time zone,
    last_login_ip character varying(45),
    is_password_change_required boolean DEFAULT true NOT NULL,
    email_verified_at timestamp(0) without time zone,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    role_id uuid,
    two_factor_secret text,
    last_activity_at timestamp(0) without time zone,
    client_number character varying(20),
    city character varying(100),
    country character varying(100),
    address character varying(255),
    client_category_id uuid,
    country_id uuid,
    city_id uuid,
    failed_attempts smallint DEFAULT '0'::smallint NOT NULL,
    locked_until timestamp(0) without time zone,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    registered_agency_id uuid,
    commercial_user_id uuid,
    registered_at timestamp(0) without time zone,
    two_factor_channel character varying(20) DEFAULT 'totp'::character varying NOT NULL,
    nationality character varying(100),
    quartier character varying(150),
    occupation character varying(150),
    deleted_at timestamp(0) without time zone
);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: personal_access_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);


--
-- Data for Name: accounting_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('48bc78e0-7ae8-43e7-9f3b-641bde740244', 'Publicité Pekegno', 'expense', NULL, true, '2026-11-14 16:30:45', '2026-11-14 16:30:45', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb0f-7042-8b1e-7c4fc3f07d80', 'Encaissement facture', 'income', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb13-736a-97a6-f16bf681cade', 'Admin', 'expense', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb15-70bb-92ff-f97e1ae81d79', 'Commissions', 'expense', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb17-717e-9027-6aeb5f2235b8', 'Publicité Client', 'expense', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb18-70d4-9373-0d53f1e15b2a', 'Publicité PC', 'expense', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb1a-7162-9da3-755a6a7d9f1b', 'Publicité PCI', 'expense', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb1c-71ac-b3ee-7b145289a6cf', 'Matootoo', 'expense', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb1e-72d6-86c0-0276994eb28e', 'Livre', 'expense', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);
INSERT INTO public.accounting_categories (id, name, type, agency_id, is_system, created_at, updated_at, is_pass_through) VALUES ('01a1dae5-eb20-72c6-b433-086f80e88483', 'Dépense diverse', 'expense', NULL, true, '2026-11-14 16:31:03', '2026-11-14 16:31:03', false);


--
-- Data for Name: accounting_transactions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ad_campaigns; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: agencies; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: agency_activities; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: agency_categories; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: agency_notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: agency_payment_methods; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: attendances; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cache; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cache_locks; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cash_closings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.categories (id, name, description, color, icon, deleted_at, created_at, updated_at) VALUES ('a7a6da52-6c24-42c2-9b50-471ae5b679e0', 'Canva', 'Rubrique de vente Canva', '#00C4CC', 'palette', NULL, '2026-11-14 16:30:45', '2026-11-14 16:30:45');
INSERT INTO public.categories (id, name, description, color, icon, deleted_at, created_at, updated_at) VALUES ('27c1c7d7-76f5-43eb-be17-520fb98bcca8', 'Livre', 'Rubrique de vente Livre', '#8B5CF6', 'book', NULL, '2026-11-14 16:30:45', '2026-11-14 16:30:45');
INSERT INTO public.categories (id, name, description, color, icon, deleted_at, created_at, updated_at) VALUES ('bec0653e-2502-4afe-ac20-ddd743b301d4', 'Graphisme', 'Rubrique de vente Graphisme', '#F97316', 'pen-tool', NULL, '2026-11-14 16:30:45', '2026-11-14 16:30:45');
INSERT INTO public.categories (id, name, description, color, icon, deleted_at, created_at, updated_at) VALUES ('2f03fab1-df31-4e60-9019-65ec5452d868', 'Matootoo', 'Rubrique de vente Matootoo', '#10B981', 'shopping-bag', NULL, '2026-11-14 16:30:45', '2026-11-14 16:30:45');
INSERT INTO public.categories (id, name, description, color, icon, deleted_at, created_at, updated_at) VALUES ('0c7aed64-cf2b-4f77-ae52-9f05ff561374', 'Séminaire', 'Rubrique de vente Séminaire', '#EF4444', 'users', NULL, '2026-11-14 16:30:45', '2026-11-14 16:30:45');


--
-- Data for Name: certificates; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cities; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: client_categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.client_categories (id, name, slug, description, is_active, created_at, updated_at) VALUES ('01a1dae5-efff-719e-836b-7c987ce3a20c', 'Apprenant', 'apprenant', 'Client inscrit à une formation (Academy)', true, '2026-11-14 16:31:04', '2026-11-14 16:31:04');
INSERT INTO public.client_categories (id, name, slug, description, is_active, created_at, updated_at) VALUES ('01a1dae5-f003-7019-9092-956286de177a', 'Abonné', 'abonne', 'Client avec un abonnement actif', true, '2026-11-14 16:31:04', '2026-11-14 16:31:04');
INSERT INTO public.client_categories (id, name, slug, description, is_active, created_at, updated_at) VALUES ('01a1dae5-f005-730b-802a-d7ace3244253', 'Prospect', 'prospect', 'Prospection commerciale', true, '2026-11-14 16:31:04', '2026-11-14 16:31:04');
INSERT INTO public.client_categories (id, name, slug, description, is_active, created_at, updated_at) VALUES ('01a1dae5-f006-7330-a50b-8c6e9ec34ba0', 'Autre', 'autre', 'Autre type de client', true, '2026-11-14 16:31:04', '2026-11-14 16:31:04');


--
-- Data for Name: client_team_roles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: commercial_points; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: commercials; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: commission_entries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: commission_payments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: commission_rule_role; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: commission_rules; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: contract_services; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: countries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: course_categories; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: course_course_category; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: course_modules; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: daily_balances; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: department_chiefs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: failed_jobs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: formation_enrollments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: invoice_payments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: job_batches; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: learner_observations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: login_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.migrations (id, migration, batch) VALUES (1, '0001_01_01_000000_create_users_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (2, '0001_01_01_000001_create_cache_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (3, '0001_01_01_000002_create_jobs_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (4, '2026_07_09_000001_create_agencies_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (5, '2026_07_09_000002_create_departments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (6, '2026_07_09_000004_create_roles_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (7, '2026_07_09_000005_create_permissions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (8, '2026_07_09_204845_create_personal_access_tokens_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (9, '2026_07_09_204846_create_login_logs_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (10, '2026_07_10_000001_create_role_permission_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (11, '2026_07_10_000002_create_model_has_roles_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (12, '2026_07_10_000003_create_user_assignments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (13, '2026_07_13_000001_refactor_users_to_mld', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (14, '2026_07_14_000001_create_user_assignments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (15, '2026_07_14_000002_drop_manager_id_from_agencies_departments', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (16, '2026_07_14_000003_drop_agency_id_department_id_from_users', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (17, '2026_07_14_000004_drop_is_system_from_roles', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (18, '2026_07_14_000005_drop_group_label_from_permissions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (19, '2026_07_16_000001_add_two_factor_secret_to_users_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (20, '2026_07_26_000001_add_soft_deletes_to_agencies_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (21, '2026_07_26_000002_add_soft_deletes_to_departments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (22, '2026_07_27_000001_add_last_activity_at_to_users_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (23, '2026_07_27_000002_add_is_department_chief_to_user_assignments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (24, '2026_07_29_000001_add_unique_chief_indexes_to_user_assignments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (25, '2026_07_30_000001_create_department_chiefs_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (26, '2026_08_03_000001_create_categories_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (27, '2026_08_03_000002_create_services_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (28, '2026_08_03_000003_create_promotions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (29, '2026_08_03_000004_create_price_history_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (30, '2026_08_04_000000_drop_formation_tables', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (31, '2026_08_04_000001_drop_department_id_from_services_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (32, '2026_08_05_000001_add_client_fields_to_users', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (33, '2026_08_05_000002_create_commercials_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (34, '2026_08_05_000003_create_commercial_points_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (35, '2026_08_05_000004_create_settings_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (36, '2026_08_05_000005_add_discount_to_promotions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (37, '2026_08_05_000006_create_invoices_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (38, '2026_08_05_000007_add_cancelled_to_invoice_status', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (39, '2026_08_05_000007_create_invoice_items_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (40, '2026_08_05_000008_create_invoice_payments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (41, '2026_08_05_000009_create_activity_logs_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (42, '2026_08_11_000001_add_discount_and_vat_to_invoices', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (43, '2026_08_12_000001_create_prospects_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (44, '2026_08_12_000002_add_prospect_reasons_to_commercial_points', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (45, '2026_08_14_000001_add_client_name_to_invoices', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (46, '2026_08_15_000001_add_bonus_fixed_to_services_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (47, '2026_08_15_000002_create_commission_payments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (48, '2026_08_15_000003_create_accounting_tables', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (49, '2026_08_15_000004_add_kind_to_commercials_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (50, '2026_08_15_000005_create_subscription_tables', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (51, '2026_08_17_000001_add_price_per_month_to_subscription_packs', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (52, '2026_08_17_000001_create_daily_balances_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (53, '2026_08_17_000002_add_seminar_tiers_and_pass_to_invoice_items', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (54, '2026_08_18_000001_extend_payment_type_for_om_momo', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (55, '2026_08_20_000001_create_organizations_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (56, '2026_08_20_000002_create_countries_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (57, '2026_08_20_000003_create_cities_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (58, '2026_08_20_000004_add_org_geo_type_to_agencies_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (59, '2026_08_20_000005_create_client_categories_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (60, '2026_08_20_000006_add_category_geo_to_users_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (61, '2026_08_20_000007_add_login_guard_columns_to_users_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (62, '2026_08_21_000001_add_customer_lifecycle_to_users_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (63, '2026_08_21_000001_create_agency_activities_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (64, '2026_08_21_000002_create_products_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (65, '2026_08_21_000003_add_code_to_services_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (66, '2026_08_21_000004_create_courses_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (67, '2026_08_21_000005_create_training_sessions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (68, '2026_08_21_000006_create_enrollments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (69, '2026_08_21_000007_add_lifecycle_to_subscriptions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (70, '2026_08_21_000008_create_subscription_notifications_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (71, '2026_08_21_000009_create_orders_tables', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (72, '2026_08_21_000010_create_trainers_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (73, '2026_08_25_000001_add_type_to_departments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (74, '2026_08_25_000002_create_treasury_accounts_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (75, '2026_08_25_000003_create_treasury_transactions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (76, '2026_08_25_000004_add_treasury_account_id_to_invoice_payments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (77, '2026_08_26_000001_create_expenses_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (78, '2026_08_26_000002_create_commission_rules_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (79, '2026_08_26_000003_create_commission_entries_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (80, '2026_08_27_000001_create_companies_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (81, '2026_08_27_000002_create_opportunities_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (82, '2026_08_27_000003_create_activities_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (83, '2026_08_28_000001_create_attendances_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (84, '2026_08_28_000002_create_certificates_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (85, '2026_08_28_000003_create_contracts_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (86, '2026_08_28_000004_create_contract_services_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (87, '2026_08_28_000005_add_invoice_id_to_enrollments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (88, '2026_08_28_000006_add_is_pass_through_to_accounting_categories_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (89, '2026_08_29_000001_add_formation_columns_to_courses_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (90, '2026_08_29_000002_create_course_categories_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (91, '2026_08_29_000003_create_course_modules_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (92, '2026_08_29_000004_add_module_id_to_training_sessions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (93, '2026_08_29_000005_create_formation_enrollments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (94, '2026_08_29_000006_create_learner_observations_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (95, '2026_08_29_000007_create_seller_profiles_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (96, '2026_08_29_000008_extend_commission_entries_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (97, '2026_08_29_000009_extend_commission_payments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (98, '2026_08_29_000010_add_formation_id_to_promotions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (99, '2026_08_29_000010_add_seller_trainer_id_to_formation_enrollments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (100, '2026_08_29_000011_add_soft_deletes_to_seller_profiles_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (101, '2026_08_29_000012_make_commission_payments_nullable_columns', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (102, '2026_08_29_000013_add_treasury_account_to_commission_payments', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (103, '2026_08_29_000014_add_presentation_video_to_courses_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (104, '2026_08_29_000015_make_service_id_nullable_on_promotions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (105, '2026_08_29_000016_create_course_categories_tables', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (106, '2026_08_29_000017_drop_category_id_from_courses_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (107, '2026_08_29_000018_drop_location_from_training_sessions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (108, '2026_08_29_000019_change_attendances_to_learner_user_id', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (109, '2026_08_30_000001_add_course_and_seller_to_commission_rules_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (110, '2026_08_30_000002_make_commission_entries_beneficiary_nullable', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (111, '2026_08_30_000003_create_session_participants_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (112, '2026_08_30_000004_make_commission_entries_rule_nullable', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (113, '2026_08_30_000005_backfill_legacy_commissions_as_entries', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (114, '2026_08_30_000006_make_commission_entries_invoice_nullable', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (115, '2026_08_30_000008_add_points_to_trainers_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (116, '2026_09_04_000001_add_payment_method_to_commission_payments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (117, '2026_09_06_000001_add_course_module_id_to_attendances_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (118, '2026_09_07_000001_add_public_flags_to_services_and_products_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (119, '2026_09_07_000002_add_cover_image_to_products_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (120, '2026_09_07_000003_add_channel_to_orders_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (121, '2026_09_07_000004_add_validation_workflow_to_invoices_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (122, '2026_09_07_000005_create_payment_proofs_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (123, '2026_09_07_000006_create_agency_payment_methods_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (124, '2026_09_07_000007_add_module_and_author_to_learner_observations_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (125, '2026_09_08_000001_add_product_id_to_order_lines_and_invoice_items_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (126, '2026_09_09_000001_add_declared_advance_to_invoices_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (127, '2026_09_09_000002_add_public_flags_to_courses_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (128, '2026_09_15_000001_backfill_courses_is_public', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (129, '2026_09_15_000001_create_carts_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (130, '2026_09_15_000002_duplicate_courses_to_country_agencies', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (131, '2026_09_17_000001_backfill_activity_log_agency_from_entities', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (132, '2026_09_17_000002_add_country_to_activity_logs_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (133, '2026_09_17_000003_complete_activity_log_country_agency', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (134, '2026_09_17_000004_backfill_activity_logs_from_actors', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (135, '2026_09_28_000001_add_discount_to_formation_enrollments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (136, '2026_09_28_000002_add_exchange_rate_to_countries_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (137, '2026_09_29_000001_grant_cashier_commission_payment', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (138, '2026_09_29_000002_add_invoice_settings_to_countries_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (139, '2026_09_29_000003_normalize_course_mode', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (140, '2026_09_30_000001_add_receipt_number_to_invoice_payments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (141, '2026_09_30_000002_add_two_factor_channel_to_users_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (142, '2026_09_30_000003_add_payer_phone_to_invoices_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (143, '2026_10_03_000001_create_agency_categories_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (144, '2026_10_03_000002_create_client_team_roles_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (145, '2026_10_03_000003_extend_subscription_packs_for_agency_packages', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (146, '2026_10_03_000004_create_package_items_and_recommendations_tables', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (147, '2026_10_03_000005_add_package_id_to_promotions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (148, '2026_10_03_000006_create_prestations_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (149, '2026_10_03_000007_create_prestation_actions_tables', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (150, '2026_10_03_000008_extend_contracts_for_agency', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (151, '2026_10_03_000009_add_agency_links_to_invoices_and_commissions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (152, '2026_10_03_000010_create_agency_notifications_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (153, '2026_10_03_000011_grant_agency_permissions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (154, '2026_10_03_000012_add_department_id_to_accounting_transactions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (155, '2026_10_08_000001_create_prestation_action_executions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (156, '2026_10_08_000002_create_prestation_offers_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (157, '2026_10_08_000002_grant_cashier_agency', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (158, '2026_10_08_000003_add_offer_id_to_prestations_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (159, '2026_10_08_000003_add_payment_proof_fields_to_prestations_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (160, '2026_10_08_000004_add_direct_rating_to_prestations_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (161, '2026_10_08_000005_packages_public_by_default', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (162, '2026_10_09_000001_create_team_members_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (163, '2026_10_09_000002_team_member_affectation_and_commissions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (164, '2026_10_11_000001_default_commission_20_percent', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (165, '2026_10_11_000002_cashier_accounting_permissions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (166, '2026_10_12_000001_add_client_profile_details_to_users', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (167, '2026_10_13_000001_add_commission_to_services_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (168, '2026_10_13_000002_add_proof_file_to_executions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (169, '2026_10_13_000003_grant_cashier_action_execution', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (170, '2026_10_13_000004_grant_commercial_prestation_create', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (171, '2026_10_16_000001_backfill_agency_country_city_fk', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (172, '2026_10_17_000001_add_amount_to_payment_proofs_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (173, '2026_10_22_000001_create_training_sessions_synced_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (174, '2026_10_22_000002_add_created_by_to_invoices_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (175, '2026_10_22_000003_restrict_invoice_validation_to_admin_and_cashier', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (176, '2026_10_22_000004_role_based_commission_rules', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (177, '2026_10_22_000005_add_target_kind_to_commission_rules', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (178, '2026_10_22_000006_grant_invoice_validation_to_director', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (179, '2026_10_22_000007_renewal_number_on_commission_rules', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (180, '2026_10_30_000001_drop_training_sessions_synced_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (181, '2026_10_30_000002_grant_client_edit_delete_to_all_staff', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (182, '2026_10_30_000003_grant_session_delete_to_department_chief', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (183, '2026_10_31_000001_add_duration_type_to_training_sessions_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (184, '2026_11_03_000001_grant_commercial_permissions_to_community_manager', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (185, '2026_11_03_000002_add_soft_deletes_to_users_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (186, '2026_11_03_000003_add_client_was_created_to_invoices_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (187, '2026_11_04_000001_add_requested_session_id_to_formation_enrollments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (188, '2026_11_05_000001_add_cancelled_at_to_invoice_payments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (189, '2026_11_06_000001_add_received_validated_at_to_invoice_payments_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (190, '2026_11_06_000002_add_code_and_visibility_to_treasury_accounts', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (191, '2026_11_06_000003_add_transfer_type_to_treasury_transactions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (192, '2026_11_06_000004_create_cash_closings_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (193, '2026_11_07_000001_add_treasury_and_transfer_to_accounting_transactions', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (194, '2026_11_09_000001_add_category_id_to_invoice_items', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (195, '2026_11_10_000001_add_branch_to_products_and_services', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (196, '2026_11_10_000002_grant_treasury_permissions_to_cashier', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (197, '2026_11_10_000003_make_cash_closings_open_and_close_the_cash_box', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (198, '2026_11_12_000001_backfill_country_phone_codes', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (199, '2026_11_12_000002_add_rejection_code_to_payment_proofs_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (200, '2026_11_12_000003_apply_role_permission_matrix', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (201, '2026_11_12_000004_add_pass_through_to_expenses', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (202, '2026_11_12_000005_add_service_id_to_expenses', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (203, '2026_11_12_000006_create_ad_campaigns_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (204, '2026_11_12_000007_add_session_date_to_attendances_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (205, '2026_11_12_000008_add_administration_type_to_agencies', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (206, '2026_11_12_000009_add_due_date_to_invoices_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (207, '2026_11_13_000001_create_session_module_trainers_table', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (208, '2026_11_13_000002_add_method_key_to_treasury_accounts', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (209, '2026_11_13_000003_restore_community_manager_sales_rights', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (210, '2026_11_13_000004_cash_boxes_for_administration_roles', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (211, '2026_11_13_000005_activate_trainer_book_sales_rule', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (212, '2026_11_13_000006_administration_entity_per_country', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (213, '2026_11_13_000007_catalog_sale_rubrics', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (214, '2026_11_13_000008_ad_campaign_expense_category', 1);
INSERT INTO public.migrations (id, migration, batch) VALUES (215, '2026_11_13_000009_remove_hardcoded_tiktok_rubric', 1);


--
-- Data for Name: opportunities; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: order_lines; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.organizations (id, name, code, is_active, created_at, updated_at) VALUES ('01a1dae5-ed6b-73ae-9912-4949243bfb65', 'PEKEGNO Group', 'PEKEGNO', true, '2026-11-14 16:31:04', '2026-11-14 16:31:04');


--
-- Data for Name: package_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: package_recommendations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: payment_proofs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3ba-73c1-8838-eccd48d34e4c', 'users.consulter', 'Consulter : les utilisateurs', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3bf-70eb-bfcb-b1042914df03', 'users.creer', 'Créer : les utilisateurs', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3c1-70ad-8a4d-d116aa4dc091', 'users.modifier', 'Modifier : les utilisateurs', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3c3-714c-a0d1-709faacde7a8', 'users.supprimer', 'Supprimer : les utilisateurs', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3c6-718e-8dee-03d984790576', 'users.exporter', 'Exporter : les utilisateurs', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3c8-7216-9b6e-c264d832763b', 'roles.consulter', 'Consulter : les rôles', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3cb-72d5-9728-86be7935a733', 'roles.creer', 'Créer : les rôles', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3cd-7298-8c4e-bc969b06e00b', 'roles.modifier', 'Modifier : les rôles', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3cf-7063-9c22-24dfe752ca07', 'roles.supprimer', 'Supprimer : les rôles', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3d1-7140-ac02-52bd2d4c9f2f', 'agencies.consulter', 'Consulter : les agences', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3d3-70a6-b549-7ba750ff83d5', 'agencies.creer', 'Créer : les agences', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3d6-72bd-ac87-0320aedb0025', 'agencies.modifier', 'Modifier : les agences', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3d7-704f-a1b1-c605789e3eb9', 'agencies.supprimer', 'Supprimer : les agences', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3d9-7245-8cd0-d1a6abcadac4', 'agencies.exporter', 'Exporter : les agences', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3da-7225-a2ad-3625451b7955', 'countries.consulter', 'Consulter : les pays', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3dc-7212-a201-d7044885ed5f', 'countries.creer', 'Créer : les pays', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3de-7195-b7f3-aa8c0f8ffa84', 'countries.modifier', 'Modifier : les pays', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3e0-7257-a6f9-031f18df01ea', 'countries.supprimer', 'Supprimer : les pays', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3e2-73af-8426-31a8561b745f', 'cities.consulter', 'Consulter : les villes', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3e4-7237-934c-ac092d8413af', 'cities.creer', 'Créer : les villes', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3e5-70f6-9f26-c61556aa0f86', 'cities.modifier', 'Modifier : les villes', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3e7-7177-9ad4-f983899d3425', 'cities.supprimer', 'Supprimer : les villes', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3e9-73c2-a4ba-377c8f9a800a', 'departments.consulter', 'Consulter : les départements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3eb-701e-aefe-642f7a4bb380', 'departments.creer', 'Créer : les départements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3ec-7079-acb7-90e0f54cda02', 'departments.modifier', 'Modifier : les départements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3ee-71f8-a161-76a4e28c2467', 'departments.supprimer', 'Supprimer : les départements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3ef-72b1-8917-435d4e75d31a', 'departments.exporter', 'Exporter : les départements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3f1-738e-ba30-aee7433c96f9', 'categories.consulter', 'Consulter : les catégories', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3f4-70ff-b903-38cfb09405cd', 'categories.creer', 'Créer : les catégories', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3f5-7214-91e3-02213a4e43e4', 'categories.modifier', 'Modifier : les catégories', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3f7-732e-9e51-39a66ea06ded', 'categories.supprimer', 'Supprimer : les catégories', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3f9-721d-80da-1b0e2a608a7d', 'services.consulter', 'Consulter : les services', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3fa-7041-a93a-a795be673a0b', 'services.creer', 'Créer : les services', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3fc-729c-8012-4a3be3957d15', 'services.modifier', 'Modifier : les services', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3fe-7023-8731-c9ee63f5432d', 'services.supprimer', 'Supprimer : les services', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e3ff-73ab-baab-0e5ba8cfaa86', 'services.exporter', 'Exporter : les services', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e401-72f7-8990-77b20fea4697', 'products.consulter', 'Consulter : les produits', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e403-7214-8ee1-5c04c3e2f773', 'products.creer', 'Créer : les produits', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e407-7178-b2c7-939eb4329511', 'products.modifier', 'Modifier : les produits', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e40c-7272-bd49-452c4d4ae9a6', 'products.supprimer', 'Supprimer : les produits', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e411-733a-8e0d-ed6794588fb6', 'promotions.consulter', 'Consulter : les promotions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e415-7033-ad44-66dc5101d6d4', 'promotions.creer', 'Créer : les promotions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e41a-700b-a07f-67671afb33a8', 'promotions.modifier', 'Modifier : les promotions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e41e-7277-9d44-cf727621eab6', 'promotions.supprimer', 'Supprimer : les promotions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e423-71a4-978e-a077a5b7b48b', 'clients.consulter', 'Consulter : les clients', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e428-7154-9dbc-d8dee761e6f7', 'clients.creer', 'Créer : les clients', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e42c-714f-8414-05eec0d4586b', 'clients.modifier', 'Modifier : les clients', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e430-734c-9b0d-e16646090365', 'clients.supprimer', 'Supprimer : les clients', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e435-705c-b28d-8440bc0a3d76', 'clients.exporter', 'Exporter : les clients', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e43a-7287-97e9-18992386e367', 'commercials.consulter', 'Consulter : les commerciaux', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e43f-7264-94f3-e93c174fce95', 'commercials.creer', 'Créer : les commerciaux', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e444-7059-8318-bc1f47be6556', 'commercials.modifier', 'Modifier : les commerciaux', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e449-73cb-8c01-4a7060b78cb1', 'commercials.supprimer', 'Supprimer : les commerciaux', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e44d-7207-a98b-dfba6e79bf89', 'commercials.exporter', 'Exporter : les commerciaux', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e451-7016-bc9b-b009c2d635bc', 'commercials.reporting', 'Reporting : les commerciaux', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e456-73ed-b040-0745c8aff3c3', 'employes.consulter', 'Consulter : les employés', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e45b-7274-8717-1e39f8b7bdff', 'employes.creer', 'Créer : les employés', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e45f-715e-b83c-c6e63f73dd8a', 'employes.modifier', 'Modifier : les employés', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e464-72a1-9e53-703956e70234', 'employes.supprimer', 'Supprimer : les employés', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e46a-7185-9fff-ee74258eea1b', 'employes.exporter', 'Exporter : les employés', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e46e-7373-a15f-999ee660781a', 'prospects.consulter', 'Consulter : les prospects', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e473-722e-9f9f-00175da72624', 'prospects.creer', 'Créer : les prospects', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e477-7291-a807-a0150b3520aa', 'prospects.modifier', 'Modifier : les prospects', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e47c-712c-b117-5d19e72ae52e', 'prospects.supprimer', 'Supprimer : les prospects', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e480-717f-ab13-4779d0c67355', 'invoices.consulter', 'Consulter : les factures', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e485-7234-9cd4-26cfc4646a69', 'invoices.creer', 'Créer : les factures', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e489-7173-b382-99b9ba318d42', 'invoices.modifier', 'Modifier : les factures', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e48e-71dc-a8ef-8b00650839f0', 'invoices.imprimer', 'Imprimer : les factures', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e493-7281-93c1-2a317ff45448', 'invoices.annuler', 'Annuler : les factures', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e497-73d2-b042-f141e27da678', 'invoices.encaisser', 'Encaisser : les factures', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e49c-7329-925e-41e0156ced09', 'invoices.valider', 'Valider : les factures', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4a1-7172-844e-237b530a3e63', 'invoices.exporter', 'Exporter : les factures', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4a6-729d-ba9f-1850e826a122', 'activity-logs.consulter', 'Consulter : le journal d''activité', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4aa-7151-946c-5bbd335b35da', 'activity-logs.exporter', 'Exporter : le journal d''activité', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4ae-72ea-b0c2-479b919e5372', 'settings.modifier', 'Modifier : les réglages', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4b3-712e-93db-aa199152366f', 'stats.consulter', 'Consulter : les statistiques', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4b8-7088-ad89-0c4a023f21d3', 'comptabilite.consulter', 'Consulter : la comptabilité', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4bd-722c-b77b-8eeb55e412d2', 'comptabilite.creer', 'Créer : la comptabilité', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4c0-70cc-8065-aac36e7dc832', 'comptabilite.modifier', 'Modifier : la comptabilité', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4c3-7270-a15b-742bbd475af2', 'comptabilite.supprimer', 'Supprimer : la comptabilité', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4c6-7292-8927-fa93ebfafd91', 'comptabilite.exporter', 'Exporter : la comptabilité', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4c9-7141-b3eb-346d18347376', 'accounting-categories.consulter', 'Consulter : les catégories comptables', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4ce-73b2-837c-e4995d49e67d', 'accounting-categories.creer', 'Créer : les catégories comptables', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4d2-7041-b1fa-9a2cbf9d80a0', 'accounting-categories.modifier', 'Modifier : les catégories comptables', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4d6-730f-9060-86166ee36da3', 'accounting-categories.supprimer', 'Supprimer : les catégories comptables', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4da-72ab-bf5d-77f85ad008bf', 'bilans.consulter', 'Consulter : les bilans du jour', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4de-7364-b223-edb4f592d913', 'bilans.exporter', 'Exporter : les bilans du jour', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4e2-73da-99bb-853fa5252c1b', 'abonnements.consulter', 'Consulter : les abonnements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4e5-72b8-8a7a-3d8a6f674092', 'abonnements.creer', 'Créer : les abonnements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4e8-7349-ae93-bc5f2c3e7409', 'abonnements.modifier', 'Modifier : les abonnements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4eb-72ad-b2e0-7bb7fa1c431a', 'abonnements.supprimer', 'Supprimer : les abonnements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4ed-7050-97ea-bf535272a864', 'abonnements.renouveler', 'Renouveler : les abonnements', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4f0-738e-9572-92b43231efd1', 'tresories.consulter', 'Consulter : la trésorerie', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4f2-71ff-9bea-494c92332120', 'tresories.modifier', 'Modifier : la trésorerie', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6', 'courses.consulter', 'Consulter : les cours', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4f7-7152-885f-a3e970310606', 'courses.creer', 'Créer : les cours', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4f9-726d-8668-b0f3dc94676a', 'courses.modifier', 'Modifier : les cours', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4fc-73c4-afb6-99ba77b14c9f', 'courses.supprimer', 'Supprimer : les cours', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e4fe-72f3-a069-704f6ceccffe', 'sessions.consulter', 'Consulter : les sessions de formation', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e501-735a-ad52-0d44a73b5487', 'sessions.creer', 'Créer : les sessions de formation', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e503-700f-983d-6c16a12197ac', 'sessions.modifier', 'Modifier : les sessions de formation', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e506-712a-8632-476866703832', 'sessions.supprimer', 'Supprimer : les sessions de formation', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e508-70eb-8855-c5bc6849e11e', 'enrollments.consulter', 'Consulter : les inscriptions aux formations', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e50b-72b1-bf21-f1f2389d39eb', 'enrollments.creer', 'Créer : les inscriptions aux formations', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e50e-70ce-83a1-1515647304bb', 'enrollments.modifier', 'Modifier : les inscriptions aux formations', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e510-73b4-8a79-3f8cb103d91b', 'enrollments.supprimer', 'Supprimer : les inscriptions aux formations', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e513-72c9-af8f-61f8183f9b5f', 'orders.consulter', 'Consulter : les commandes', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e515-7386-a886-81fe8f636b27', 'orders.creer', 'Créer : les commandes', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e518-7052-b559-976165b4b3b0', 'orders.modifier', 'Modifier : les commandes', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e51a-72ef-a7ac-97854d3c82bd', 'orders.supprimer', 'Supprimer : les commandes', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e51d-70e5-a0c9-aa99130a2c15', 'reports.consulter', 'Consulter : les rapports', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e51f-737f-90f5-bd1a4befd628', 'reports.exporter', 'Exporter : les rapports', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e522-73b6-b7bd-62d1725a8d68', 'depenses.consulter', 'Consulter : les dépenses', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e525-7217-b82e-298664bb8ae3', 'depenses.creer', 'Créer : les dépenses', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e529-700f-ae79-19b662aae456', 'depenses.modifier', 'Modifier : les dépenses', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e52d-7224-978b-c4a6d5daab1c', 'depenses.supprimer', 'Supprimer : les dépenses', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e532-7189-9f80-265ee7c61309', 'depenses.valider', 'Valider : les dépenses', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e537-7153-8b3b-45091eda2c00', 'depenses.encaisser', 'Encaisser : les dépenses', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e53b-71a9-9fd6-e7b0f214bfdb', 'depenses.exporter', 'Exporter : les dépenses', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e540-7020-b049-b1f66e29554a', 'commissions.consulter', 'Consulter : les commissions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e545-7348-95db-90425767d731', 'commissions.creer', 'Créer : les commissions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e549-7009-a0aa-4ed5e60260df', 'commissions.modifier', 'Modifier : les commissions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e54e-7068-8763-079c54783293', 'commissions.supprimer', 'Supprimer : les commissions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e553-7233-ba6d-315199303406', 'commissions.valider', 'Valider : les commissions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e557-7203-872c-40c76c824dec', 'commissions.encaisser', 'Encaisser : les commissions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e55c-736c-a10b-1a15af9f4b3d', 'commissions.exporter', 'Exporter : les commissions', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e561-72d3-a59f-1a8350b4685b', 'entreprises.consulter', 'Consulter : les entreprises', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e566-7176-8099-9be974a59deb', 'entreprises.creer', 'Créer : les entreprises', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e56a-7076-8129-a648f20e2d10', 'entreprises.modifier', 'Modifier : les entreprises', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e56f-7184-9662-0f8d9eda65fe', 'entreprises.supprimer', 'Supprimer : les entreprises', '2026-11-14 16:31:01', '2026-11-14 16:31:01');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e574-7192-87ba-b233be460ca3', 'entreprises.exporter', 'Exporter : les entreprises', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e579-70d6-b564-a024c3943ee0', 'opportunites.consulter', 'Consulter : les opportunités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e57e-738f-a1b2-948f0e642a2d', 'opportunites.creer', 'Créer : les opportunités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e582-703f-ba18-97d2068ed361', 'opportunites.modifier', 'Modifier : les opportunités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e587-710f-9fad-1e5bae8d034f', 'opportunites.supprimer', 'Supprimer : les opportunités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e58c-71e5-a7c3-5e59669283bc', 'opportunites.exporter', 'Exporter : les opportunités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e591-70c0-80ba-c451c5a7f8ca', 'activites.consulter', 'Consulter : les activités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e596-7066-bf18-9c742a5c752b', 'activites.creer', 'Créer : les activités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e59a-72f8-9029-42d1b44ad5f6', 'activites.modifier', 'Modifier : les activités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e59f-7274-9475-b25717c18af9', 'activites.supprimer', 'Supprimer : les activités', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5a4-70b9-a4b9-993813dc8e2c', 'presences.consulter', 'Consulter : les présences', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5a9-7017-90f5-7f64ef7cb2b9', 'presences.creer', 'Créer : les présences', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5ad-7051-a912-383ef67b1cc6', 'presences.modifier', 'Modifier : les présences', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5b1-70e3-b8a0-08b57ed393e8', 'presences.supprimer', 'Supprimer : les présences', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5b5-7018-a5ee-00d7e761135e', 'certificats.consulter', 'Consulter : les certificats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5b9-71ed-a63e-9d4394db4eb9', 'certificats.creer', 'Créer : les certificats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5bd-73e0-a163-03616b1947f7', 'certificats.modifier', 'Modifier : les certificats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5c2-72ea-9065-ad4984f6d70b', 'certificats.supprimer', 'Supprimer : les certificats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5c6-73bc-9b55-68f404517b91', 'certificats.exporter', 'Exporter : les certificats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5ca-717e-9e08-f9708d66e781', 'contrats.consulter', 'Consulter : les contrats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5cd-73cc-aec4-863b96e9770d', 'contrats.creer', 'Créer : les contrats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5d0-732b-baff-53dd85e1ce6b', 'contrats.modifier', 'Modifier : les contrats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5d2-7299-bacf-f4a4872b1eae', 'contrats.supprimer', 'Supprimer : les contrats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5d5-7392-af53-e505557ec725', 'contrats.exporter', 'Exporter : les contrats', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5d7-70f8-944a-719f823aea82', 'modules.consulter', 'Consulter : les modules de formation', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5da-706f-bf63-dcf5151f957c', 'modules.creer', 'Créer : les modules de formation', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5dc-70a9-8bcc-509720388463', 'modules.modifier', 'Modifier : les modules de formation', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5de-7140-a0f5-a54fcb5b675e', 'modules.supprimer', 'Supprimer : les modules de formation', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5e0-73c0-a6d3-bb5983957ddb', 'vendeurs.consulter', 'Consulter : les profils vendeurs', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5e1-73fe-88c9-5e299dea7b60', 'vendeurs.creer', 'Créer : les profils vendeurs', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5e3-70d7-95ee-db61127b2ca8', 'vendeurs.modifier', 'Modifier : les profils vendeurs', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5e6-7398-b51b-45483cf5a6bb', 'vendeurs.supprimer', 'Supprimer : les profils vendeurs', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5e7-7301-a012-e0a080d8a151', 'packages.consulter', 'Consulter : les packages Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5e9-719f-8a33-0ec2ad2957ea', 'packages.creer', 'Créer : les packages Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5eb-7203-93b5-2eb4bebf7ed6', 'packages.modifier', 'Modifier : les packages Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5ed-7261-834f-300d48b25665', 'packages.supprimer', 'Supprimer : les packages Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5ef-7200-90c3-b6174ded5e16', 'prestations.consulter', 'Consulter : les prestations Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5f1-7359-9601-553e3856028f', 'prestations.creer', 'Créer : les prestations Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5f3-71c5-ac02-d213a32f4d11', 'prestations.modifier', 'Modifier : les prestations Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5f5-7167-94e7-d0056a946aba', 'prestations.supprimer', 'Supprimer : les prestations Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5f7-73ea-8c44-6339535d60d9', 'prestations.valider', 'Valider : les prestations Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5f8-7244-9c08-f91e19dc7eef', 'prestations.exporter', 'Exporter : les prestations Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5fa-70d8-9598-33864629ea7f', 'prestation-actions.consulter', 'Consulter : les actions des prestations', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5fb-7330-bdd3-fac01592a928', 'prestation-actions.creer', 'Créer : les actions des prestations', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5fd-7061-bb82-88cdc7b9327a', 'prestation-actions.modifier', 'Modifier : les actions des prestations', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e5fe-72fd-927b-be015ac33dd7', 'prestation-actions.supprimer', 'Supprimer : les actions des prestations', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e600-7166-8d96-f5563675bef5', 'equipe-client.consulter', 'Consulter : l''équipe client Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.permissions (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e602-73c3-9273-c868db1636ae', 'equipe-client.gerer', 'Gérer : l''équipe client Agency', '2026-11-14 16:31:02', '2026-11-14 16:31:02');


--
-- Data for Name: personal_access_tokens; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prestation_action_comments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prestation_action_executions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prestation_action_logs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prestation_action_reviews; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prestation_actions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prestation_offers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prestation_team_members; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prestations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: price_history; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: prospects; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: role_permission; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3ba-73c1-8838-eccd48d34e4c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3bf-70eb-bfcb-b1042914df03');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3c1-70ad-8a4d-d116aa4dc091');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3c3-714c-a0d1-709faacde7a8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3c6-718e-8dee-03d984790576');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3c8-7216-9b6e-c264d832763b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3cb-72d5-9728-86be7935a733');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3cd-7298-8c4e-bc969b06e00b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3cf-7063-9c22-24dfe752ca07');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3d1-7140-ac02-52bd2d4c9f2f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3d3-70a6-b549-7ba750ff83d5');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3d6-72bd-ac87-0320aedb0025');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3d7-704f-a1b1-c605789e3eb9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3d9-7245-8cd0-d1a6abcadac4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3da-7225-a2ad-3625451b7955');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3dc-7212-a201-d7044885ed5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3de-7195-b7f3-aa8c0f8ffa84');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3e0-7257-a6f9-031f18df01ea');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3e2-73af-8426-31a8561b745f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3e4-7237-934c-ac092d8413af');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3e5-70f6-9f26-c61556aa0f86');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3e7-7177-9ad4-f983899d3425');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3e9-73c2-a4ba-377c8f9a800a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3eb-701e-aefe-642f7a4bb380');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3ec-7079-acb7-90e0f54cda02');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3ee-71f8-a161-76a4e28c2467');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3ef-72b1-8917-435d4e75d31a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3f4-70ff-b903-38cfb09405cd');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3f5-7214-91e3-02213a4e43e4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3f7-732e-9e51-39a66ea06ded');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3fa-7041-a93a-a795be673a0b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3fc-729c-8012-4a3be3957d15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3fe-7023-8731-c9ee63f5432d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e3ff-73ab-baab-0e5ba8cfaa86');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e403-7214-8ee1-5c04c3e2f773');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e407-7178-b2c7-939eb4329511');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e40c-7272-bd49-452c4d4ae9a6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e411-733a-8e0d-ed6794588fb6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e415-7033-ad44-66dc5101d6d4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e41a-700b-a07f-67671afb33a8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e41e-7277-9d44-cf727621eab6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e423-71a4-978e-a077a5b7b48b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e428-7154-9dbc-d8dee761e6f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e42c-714f-8414-05eec0d4586b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e430-734c-9b0d-e16646090365');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e435-705c-b28d-8440bc0a3d76');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e43a-7287-97e9-18992386e367');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e43f-7264-94f3-e93c174fce95');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e444-7059-8318-bc1f47be6556');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e449-73cb-8c01-4a7060b78cb1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e44d-7207-a98b-dfba6e79bf89');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e451-7016-bc9b-b009c2d635bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e456-73ed-b040-0745c8aff3c3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e45b-7274-8717-1e39f8b7bdff');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e45f-715e-b83c-c6e63f73dd8a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e464-72a1-9e53-703956e70234');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e46a-7185-9fff-ee74258eea1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e46e-7373-a15f-999ee660781a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e473-722e-9f9f-00175da72624');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e477-7291-a807-a0150b3520aa');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e47c-712c-b117-5d19e72ae52e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e480-717f-ab13-4779d0c67355');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e485-7234-9cd4-26cfc4646a69');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e489-7173-b382-99b9ba318d42');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e48e-71dc-a8ef-8b00650839f0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e493-7281-93c1-2a317ff45448');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e497-73d2-b042-f141e27da678');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e49c-7329-925e-41e0156ced09');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4a1-7172-844e-237b530a3e63');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4a6-729d-ba9f-1850e826a122');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4aa-7151-946c-5bbd335b35da');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4ae-72ea-b0c2-479b919e5372');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4b3-712e-93db-aa199152366f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4b8-7088-ad89-0c4a023f21d3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4bd-722c-b77b-8eeb55e412d2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4c0-70cc-8065-aac36e7dc832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4c3-7270-a15b-742bbd475af2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4c6-7292-8927-fa93ebfafd91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4c9-7141-b3eb-346d18347376');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4ce-73b2-837c-e4995d49e67d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4d2-7041-b1fa-9a2cbf9d80a0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4d6-730f-9060-86166ee36da3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4da-72ab-bf5d-77f85ad008bf');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4de-7364-b223-edb4f592d913');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4e2-73da-99bb-853fa5252c1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4e5-72b8-8a7a-3d8a6f674092');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4e8-7349-ae93-bc5f2c3e7409');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4eb-72ad-b2e0-7bb7fa1c431a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4ed-7050-97ea-bf535272a864');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4f0-738e-9572-92b43231efd1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4f2-71ff-9bea-494c92332120');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4f7-7152-885f-a3e970310606');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4f9-726d-8668-b0f3dc94676a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4fc-73c4-afb6-99ba77b14c9f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e501-735a-ad52-0d44a73b5487');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e503-700f-983d-6c16a12197ac');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e506-712a-8632-476866703832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e50b-72b1-bf21-f1f2389d39eb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e50e-70ce-83a1-1515647304bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e510-73b4-8a79-3f8cb103d91b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e513-72c9-af8f-61f8183f9b5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e515-7386-a886-81fe8f636b27');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e518-7052-b559-976165b4b3b0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e51a-72ef-a7ac-97854d3c82bd');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e51d-70e5-a0c9-aa99130a2c15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e51f-737f-90f5-bd1a4befd628');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e522-73b6-b7bd-62d1725a8d68');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e525-7217-b82e-298664bb8ae3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e529-700f-ae79-19b662aae456');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e52d-7224-978b-c4a6d5daab1c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e532-7189-9f80-265ee7c61309');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e537-7153-8b3b-45091eda2c00');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e53b-71a9-9fd6-e7b0f214bfdb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e540-7020-b049-b1f66e29554a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e545-7348-95db-90425767d731');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e549-7009-a0aa-4ed5e60260df');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e54e-7068-8763-079c54783293');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e553-7233-ba6d-315199303406');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e557-7203-872c-40c76c824dec');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e55c-736c-a10b-1a15af9f4b3d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e561-72d3-a59f-1a8350b4685b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e566-7176-8099-9be974a59deb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e56a-7076-8129-a648f20e2d10');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e56f-7184-9662-0f8d9eda65fe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e574-7192-87ba-b233be460ca3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e579-70d6-b564-a024c3943ee0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e57e-738f-a1b2-948f0e642a2d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e582-703f-ba18-97d2068ed361');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e587-710f-9fad-1e5bae8d034f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e58c-71e5-a7c3-5e59669283bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e591-70c0-80ba-c451c5a7f8ca');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e596-7066-bf18-9c742a5c752b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e59a-72f8-9029-42d1b44ad5f6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e59f-7274-9475-b25717c18af9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5a4-70b9-a4b9-993813dc8e2c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5a9-7017-90f5-7f64ef7cb2b9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5ad-7051-a912-383ef67b1cc6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5b1-70e3-b8a0-08b57ed393e8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5b5-7018-a5ee-00d7e761135e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5b9-71ed-a63e-9d4394db4eb9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5bd-73e0-a163-03616b1947f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5c2-72ea-9065-ad4984f6d70b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5c6-73bc-9b55-68f404517b91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5ca-717e-9e08-f9708d66e781');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5cd-73cc-aec4-863b96e9770d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5d0-732b-baff-53dd85e1ce6b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5d2-7299-bacf-f4a4872b1eae');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5d5-7392-af53-e505557ec725');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5d7-70f8-944a-719f823aea82');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5da-706f-bf63-dcf5151f957c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5dc-70a9-8bcc-509720388463');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5de-7140-a0f5-a54fcb5b675e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5e0-73c0-a6d3-bb5983957ddb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5e1-73fe-88c9-5e299dea7b60');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5e3-70d7-95ee-db61127b2ca8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5e6-7398-b51b-45483cf5a6bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5e7-7301-a012-e0a080d8a151');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5e9-719f-8a33-0ec2ad2957ea');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5eb-7203-93b5-2eb4bebf7ed6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5ed-7261-834f-300d48b25665');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5ef-7200-90c3-b6174ded5e16');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5f1-7359-9601-553e3856028f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5f3-71c5-ac02-d213a32f4d11');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5f5-7167-94e7-d0056a946aba');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5f7-73ea-8c44-6339535d60d9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5f8-7244-9c08-f91e19dc7eef');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5fa-70d8-9598-33864629ea7f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5fb-7330-bdd3-fac01592a928');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5fd-7061-bb82-88cdc7b9327a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e5fe-72fd-927b-be015ac33dd7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e600-7166-8d96-f5563675bef5');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', '01a1dae5-e602-73c3-9273-c868db1636ae');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3ba-73c1-8838-eccd48d34e4c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3bf-70eb-bfcb-b1042914df03');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3c1-70ad-8a4d-d116aa4dc091');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3c3-714c-a0d1-709faacde7a8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3c6-718e-8dee-03d984790576');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3c8-7216-9b6e-c264d832763b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3cb-72d5-9728-86be7935a733');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3cd-7298-8c4e-bc969b06e00b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3cf-7063-9c22-24dfe752ca07');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3d1-7140-ac02-52bd2d4c9f2f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3d3-70a6-b549-7ba750ff83d5');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3d6-72bd-ac87-0320aedb0025');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3d7-704f-a1b1-c605789e3eb9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3d9-7245-8cd0-d1a6abcadac4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3da-7225-a2ad-3625451b7955');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3dc-7212-a201-d7044885ed5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3de-7195-b7f3-aa8c0f8ffa84');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3e0-7257-a6f9-031f18df01ea');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3e2-73af-8426-31a8561b745f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3e4-7237-934c-ac092d8413af');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3e5-70f6-9f26-c61556aa0f86');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3e7-7177-9ad4-f983899d3425');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3e9-73c2-a4ba-377c8f9a800a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3eb-701e-aefe-642f7a4bb380');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3ec-7079-acb7-90e0f54cda02');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3ee-71f8-a161-76a4e28c2467');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3ef-72b1-8917-435d4e75d31a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3f4-70ff-b903-38cfb09405cd');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3f5-7214-91e3-02213a4e43e4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3f7-732e-9e51-39a66ea06ded');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3fa-7041-a93a-a795be673a0b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3fc-729c-8012-4a3be3957d15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3fe-7023-8731-c9ee63f5432d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e3ff-73ab-baab-0e5ba8cfaa86');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e403-7214-8ee1-5c04c3e2f773');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e407-7178-b2c7-939eb4329511');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e40c-7272-bd49-452c4d4ae9a6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e411-733a-8e0d-ed6794588fb6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e415-7033-ad44-66dc5101d6d4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e41a-700b-a07f-67671afb33a8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e41e-7277-9d44-cf727621eab6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e423-71a4-978e-a077a5b7b48b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e428-7154-9dbc-d8dee761e6f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e42c-714f-8414-05eec0d4586b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e430-734c-9b0d-e16646090365');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e435-705c-b28d-8440bc0a3d76');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e43a-7287-97e9-18992386e367');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e43f-7264-94f3-e93c174fce95');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e444-7059-8318-bc1f47be6556');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e449-73cb-8c01-4a7060b78cb1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e44d-7207-a98b-dfba6e79bf89');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e451-7016-bc9b-b009c2d635bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e456-73ed-b040-0745c8aff3c3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e45b-7274-8717-1e39f8b7bdff');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e45f-715e-b83c-c6e63f73dd8a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e464-72a1-9e53-703956e70234');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e46a-7185-9fff-ee74258eea1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e46e-7373-a15f-999ee660781a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e473-722e-9f9f-00175da72624');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e477-7291-a807-a0150b3520aa');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e47c-712c-b117-5d19e72ae52e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e480-717f-ab13-4779d0c67355');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e485-7234-9cd4-26cfc4646a69');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e489-7173-b382-99b9ba318d42');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e48e-71dc-a8ef-8b00650839f0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e493-7281-93c1-2a317ff45448');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e497-73d2-b042-f141e27da678');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e49c-7329-925e-41e0156ced09');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4a1-7172-844e-237b530a3e63');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4a6-729d-ba9f-1850e826a122');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4aa-7151-946c-5bbd335b35da');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4ae-72ea-b0c2-479b919e5372');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4b3-712e-93db-aa199152366f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4b8-7088-ad89-0c4a023f21d3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4bd-722c-b77b-8eeb55e412d2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4c0-70cc-8065-aac36e7dc832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4c3-7270-a15b-742bbd475af2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4c6-7292-8927-fa93ebfafd91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4c9-7141-b3eb-346d18347376');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4ce-73b2-837c-e4995d49e67d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4d2-7041-b1fa-9a2cbf9d80a0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4d6-730f-9060-86166ee36da3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4da-72ab-bf5d-77f85ad008bf');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4de-7364-b223-edb4f592d913');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4e2-73da-99bb-853fa5252c1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4e5-72b8-8a7a-3d8a6f674092');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4e8-7349-ae93-bc5f2c3e7409');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4eb-72ad-b2e0-7bb7fa1c431a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4ed-7050-97ea-bf535272a864');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4f0-738e-9572-92b43231efd1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4f2-71ff-9bea-494c92332120');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4f7-7152-885f-a3e970310606');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4f9-726d-8668-b0f3dc94676a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4fc-73c4-afb6-99ba77b14c9f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e501-735a-ad52-0d44a73b5487');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e503-700f-983d-6c16a12197ac');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e506-712a-8632-476866703832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e50b-72b1-bf21-f1f2389d39eb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e50e-70ce-83a1-1515647304bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e510-73b4-8a79-3f8cb103d91b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e513-72c9-af8f-61f8183f9b5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e515-7386-a886-81fe8f636b27');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e518-7052-b559-976165b4b3b0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e51a-72ef-a7ac-97854d3c82bd');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e51d-70e5-a0c9-aa99130a2c15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e51f-737f-90f5-bd1a4befd628');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e522-73b6-b7bd-62d1725a8d68');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e525-7217-b82e-298664bb8ae3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e529-700f-ae79-19b662aae456');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e52d-7224-978b-c4a6d5daab1c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e532-7189-9f80-265ee7c61309');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e537-7153-8b3b-45091eda2c00');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e53b-71a9-9fd6-e7b0f214bfdb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e540-7020-b049-b1f66e29554a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e545-7348-95db-90425767d731');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e549-7009-a0aa-4ed5e60260df');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e54e-7068-8763-079c54783293');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e553-7233-ba6d-315199303406');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e557-7203-872c-40c76c824dec');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e55c-736c-a10b-1a15af9f4b3d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e561-72d3-a59f-1a8350b4685b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e566-7176-8099-9be974a59deb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e56a-7076-8129-a648f20e2d10');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e56f-7184-9662-0f8d9eda65fe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e574-7192-87ba-b233be460ca3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e579-70d6-b564-a024c3943ee0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e57e-738f-a1b2-948f0e642a2d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e582-703f-ba18-97d2068ed361');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e587-710f-9fad-1e5bae8d034f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e58c-71e5-a7c3-5e59669283bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e591-70c0-80ba-c451c5a7f8ca');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e596-7066-bf18-9c742a5c752b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e59a-72f8-9029-42d1b44ad5f6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e59f-7274-9475-b25717c18af9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5a4-70b9-a4b9-993813dc8e2c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5a9-7017-90f5-7f64ef7cb2b9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5ad-7051-a912-383ef67b1cc6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5b1-70e3-b8a0-08b57ed393e8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5b5-7018-a5ee-00d7e761135e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5b9-71ed-a63e-9d4394db4eb9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5bd-73e0-a163-03616b1947f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5c2-72ea-9065-ad4984f6d70b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5c6-73bc-9b55-68f404517b91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5ca-717e-9e08-f9708d66e781');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5cd-73cc-aec4-863b96e9770d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5d0-732b-baff-53dd85e1ce6b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5d2-7299-bacf-f4a4872b1eae');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5d5-7392-af53-e505557ec725');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5d7-70f8-944a-719f823aea82');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5da-706f-bf63-dcf5151f957c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5dc-70a9-8bcc-509720388463');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5de-7140-a0f5-a54fcb5b675e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5e0-73c0-a6d3-bb5983957ddb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5e1-73fe-88c9-5e299dea7b60');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5e3-70d7-95ee-db61127b2ca8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5e6-7398-b51b-45483cf5a6bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5e7-7301-a012-e0a080d8a151');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5e9-719f-8a33-0ec2ad2957ea');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5eb-7203-93b5-2eb4bebf7ed6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5ed-7261-834f-300d48b25665');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5ef-7200-90c3-b6174ded5e16');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5f1-7359-9601-553e3856028f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5f3-71c5-ac02-d213a32f4d11');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5f5-7167-94e7-d0056a946aba');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5f7-73ea-8c44-6339535d60d9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5f8-7244-9c08-f91e19dc7eef');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5fa-70d8-9598-33864629ea7f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5fb-7330-bdd3-fac01592a928');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5fd-7061-bb82-88cdc7b9327a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e5fe-72fd-927b-be015ac33dd7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e600-7166-8d96-f5563675bef5');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', '01a1dae5-e602-73c3-9273-c868db1636ae');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e46e-7373-a15f-999ee660781a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e473-722e-9f9f-00175da72624');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e477-7291-a807-a0150b3520aa');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e47c-712c-b117-5d19e72ae52e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3d1-7140-ac02-52bd2d4c9f2f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3d6-72bd-ac87-0320aedb0025');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3d9-7245-8cd0-d1a6abcadac4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3e9-73c2-a4ba-377c8f9a800a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3eb-701e-aefe-642f7a4bb380');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3ec-7079-acb7-90e0f54cda02');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3ef-72b1-8917-435d4e75d31a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3f4-70ff-b903-38cfb09405cd');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3f5-7214-91e3-02213a4e43e4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3f7-732e-9e51-39a66ea06ded');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3fa-7041-a93a-a795be673a0b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3fc-729c-8012-4a3be3957d15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3fe-7023-8731-c9ee63f5432d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3ff-73ab-baab-0e5ba8cfaa86');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e403-7214-8ee1-5c04c3e2f773');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e407-7178-b2c7-939eb4329511');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e40c-7272-bd49-452c4d4ae9a6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e411-733a-8e0d-ed6794588fb6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e415-7033-ad44-66dc5101d6d4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e41a-700b-a07f-67671afb33a8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e41e-7277-9d44-cf727621eab6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3ba-73c1-8838-eccd48d34e4c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3bf-70eb-bfcb-b1042914df03');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3c1-70ad-8a4d-d116aa4dc091');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3c3-714c-a0d1-709faacde7a8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3c6-718e-8dee-03d984790576');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e423-71a4-978e-a077a5b7b48b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e428-7154-9dbc-d8dee761e6f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e42c-714f-8414-05eec0d4586b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e430-734c-9b0d-e16646090365');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e435-705c-b28d-8440bc0a3d76');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e43a-7287-97e9-18992386e367');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e43f-7264-94f3-e93c174fce95');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e444-7059-8318-bc1f47be6556');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e449-73cb-8c01-4a7060b78cb1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e44d-7207-a98b-dfba6e79bf89');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e451-7016-bc9b-b009c2d635bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e456-73ed-b040-0745c8aff3c3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e45b-7274-8717-1e39f8b7bdff');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e45f-715e-b83c-c6e63f73dd8a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e464-72a1-9e53-703956e70234');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e46a-7185-9fff-ee74258eea1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3da-7225-a2ad-3625451b7955');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e3e2-73af-8426-31a8561b745f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e480-717f-ab13-4779d0c67355');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e485-7234-9cd4-26cfc4646a69');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e489-7173-b382-99b9ba318d42');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e48e-71dc-a8ef-8b00650839f0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e493-7281-93c1-2a317ff45448');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e497-73d2-b042-f141e27da678');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4a1-7172-844e-237b530a3e63');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4b3-712e-93db-aa199152366f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4f0-738e-9572-92b43231efd1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4f2-71ff-9bea-494c92332120');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4b8-7088-ad89-0c4a023f21d3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4bd-722c-b77b-8eeb55e412d2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4c0-70cc-8065-aac36e7dc832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4c3-7270-a15b-742bbd475af2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4c6-7292-8927-fa93ebfafd91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4c9-7141-b3eb-346d18347376');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4ce-73b2-837c-e4995d49e67d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4d2-7041-b1fa-9a2cbf9d80a0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4d6-730f-9060-86166ee36da3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4da-72ab-bf5d-77f85ad008bf');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4de-7364-b223-edb4f592d913');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4e2-73da-99bb-853fa5252c1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4e5-72b8-8a7a-3d8a6f674092');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4e8-7349-ae93-bc5f2c3e7409');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4eb-72ad-b2e0-7bb7fa1c431a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4ed-7050-97ea-bf535272a864');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4f7-7152-885f-a3e970310606');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4f9-726d-8668-b0f3dc94676a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4fc-73c4-afb6-99ba77b14c9f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e501-735a-ad52-0d44a73b5487');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e503-700f-983d-6c16a12197ac');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e506-712a-8632-476866703832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e50b-72b1-bf21-f1f2389d39eb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e50e-70ce-83a1-1515647304bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e510-73b4-8a79-3f8cb103d91b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e513-72c9-af8f-61f8183f9b5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e515-7386-a886-81fe8f636b27');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e518-7052-b559-976165b4b3b0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e51a-72ef-a7ac-97854d3c82bd');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e51d-70e5-a0c9-aa99130a2c15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e51f-737f-90f5-bd1a4befd628');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e522-73b6-b7bd-62d1725a8d68');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e525-7217-b82e-298664bb8ae3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e529-700f-ae79-19b662aae456');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e52d-7224-978b-c4a6d5daab1c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e532-7189-9f80-265ee7c61309');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e537-7153-8b3b-45091eda2c00');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e53b-71a9-9fd6-e7b0f214bfdb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e540-7020-b049-b1f66e29554a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e545-7348-95db-90425767d731');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e549-7009-a0aa-4ed5e60260df');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e54e-7068-8763-079c54783293');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e553-7233-ba6d-315199303406');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e557-7203-872c-40c76c824dec');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e55c-736c-a10b-1a15af9f4b3d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e561-72d3-a59f-1a8350b4685b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e566-7176-8099-9be974a59deb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e56a-7076-8129-a648f20e2d10');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e56f-7184-9662-0f8d9eda65fe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e574-7192-87ba-b233be460ca3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e579-70d6-b564-a024c3943ee0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e57e-738f-a1b2-948f0e642a2d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e582-703f-ba18-97d2068ed361');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e587-710f-9fad-1e5bae8d034f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e58c-71e5-a7c3-5e59669283bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e591-70c0-80ba-c451c5a7f8ca');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e596-7066-bf18-9c742a5c752b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e59a-72f8-9029-42d1b44ad5f6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e59f-7274-9475-b25717c18af9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5a4-70b9-a4b9-993813dc8e2c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5a9-7017-90f5-7f64ef7cb2b9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5ad-7051-a912-383ef67b1cc6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5b1-70e3-b8a0-08b57ed393e8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5b5-7018-a5ee-00d7e761135e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5b9-71ed-a63e-9d4394db4eb9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5bd-73e0-a163-03616b1947f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5c2-72ea-9065-ad4984f6d70b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5c6-73bc-9b55-68f404517b91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5ca-717e-9e08-f9708d66e781');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5cd-73cc-aec4-863b96e9770d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5d0-732b-baff-53dd85e1ce6b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5d2-7299-bacf-f4a4872b1eae');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5d5-7392-af53-e505557ec725');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5d7-70f8-944a-719f823aea82');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5da-706f-bf63-dcf5151f957c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5dc-70a9-8bcc-509720388463');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5de-7140-a0f5-a54fcb5b675e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5e0-73c0-a6d3-bb5983957ddb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5e1-73fe-88c9-5e299dea7b60');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5e3-70d7-95ee-db61127b2ca8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5e6-7398-b51b-45483cf5a6bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5e7-7301-a012-e0a080d8a151');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5e9-719f-8a33-0ec2ad2957ea');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5eb-7203-93b5-2eb4bebf7ed6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5ed-7261-834f-300d48b25665');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5ef-7200-90c3-b6174ded5e16');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5f1-7359-9601-553e3856028f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5f3-71c5-ac02-d213a32f4d11');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5f5-7167-94e7-d0056a946aba');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5f7-73ea-8c44-6339535d60d9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5f8-7244-9c08-f91e19dc7eef');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5fa-70d8-9598-33864629ea7f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5fb-7330-bdd3-fac01592a928');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5fd-7061-bb82-88cdc7b9327a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e5fe-72fd-927b-be015ac33dd7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e600-7166-8d96-f5563675bef5');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', '01a1dae5-e602-73c3-9273-c868db1636ae');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e46e-7373-a15f-999ee660781a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e473-722e-9f9f-00175da72624');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e477-7291-a807-a0150b3520aa');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e47c-712c-b117-5d19e72ae52e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3d1-7140-ac02-52bd2d4c9f2f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3d6-72bd-ac87-0320aedb0025');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3d9-7245-8cd0-d1a6abcadac4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3e9-73c2-a4ba-377c8f9a800a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3eb-701e-aefe-642f7a4bb380');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3ec-7079-acb7-90e0f54cda02');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3ef-72b1-8917-435d4e75d31a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3f4-70ff-b903-38cfb09405cd');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3f5-7214-91e3-02213a4e43e4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3f7-732e-9e51-39a66ea06ded');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3fa-7041-a93a-a795be673a0b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3fc-729c-8012-4a3be3957d15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3fe-7023-8731-c9ee63f5432d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3ff-73ab-baab-0e5ba8cfaa86');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e403-7214-8ee1-5c04c3e2f773');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e407-7178-b2c7-939eb4329511');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e40c-7272-bd49-452c4d4ae9a6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e411-733a-8e0d-ed6794588fb6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e415-7033-ad44-66dc5101d6d4');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e41a-700b-a07f-67671afb33a8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e41e-7277-9d44-cf727621eab6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3ba-73c1-8838-eccd48d34e4c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3bf-70eb-bfcb-b1042914df03');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3c1-70ad-8a4d-d116aa4dc091');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3c3-714c-a0d1-709faacde7a8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3c6-718e-8dee-03d984790576');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e423-71a4-978e-a077a5b7b48b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e428-7154-9dbc-d8dee761e6f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e42c-714f-8414-05eec0d4586b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e430-734c-9b0d-e16646090365');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e435-705c-b28d-8440bc0a3d76');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e43a-7287-97e9-18992386e367');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e43f-7264-94f3-e93c174fce95');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e444-7059-8318-bc1f47be6556');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e449-73cb-8c01-4a7060b78cb1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e44d-7207-a98b-dfba6e79bf89');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e451-7016-bc9b-b009c2d635bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e480-717f-ab13-4779d0c67355');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e485-7234-9cd4-26cfc4646a69');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e489-7173-b382-99b9ba318d42');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e48e-71dc-a8ef-8b00650839f0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e493-7281-93c1-2a317ff45448');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e497-73d2-b042-f141e27da678');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4a1-7172-844e-237b530a3e63');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4b3-712e-93db-aa199152366f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4f0-738e-9572-92b43231efd1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4f2-71ff-9bea-494c92332120');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4b8-7088-ad89-0c4a023f21d3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4bd-722c-b77b-8eeb55e412d2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4c0-70cc-8065-aac36e7dc832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4c3-7270-a15b-742bbd475af2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4c6-7292-8927-fa93ebfafd91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4c9-7141-b3eb-346d18347376');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4ce-73b2-837c-e4995d49e67d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4d2-7041-b1fa-9a2cbf9d80a0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4d6-730f-9060-86166ee36da3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4da-72ab-bf5d-77f85ad008bf');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4de-7364-b223-edb4f592d913');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4f7-7152-885f-a3e970310606');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4f9-726d-8668-b0f3dc94676a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e501-735a-ad52-0d44a73b5487');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e503-700f-983d-6c16a12197ac');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e506-712a-8632-476866703832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e50b-72b1-bf21-f1f2389d39eb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e50e-70ce-83a1-1515647304bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e513-72c9-af8f-61f8183f9b5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e515-7386-a886-81fe8f636b27');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e518-7052-b559-976165b4b3b0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e51d-70e5-a0c9-aa99130a2c15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e51f-737f-90f5-bd1a4befd628');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e522-73b6-b7bd-62d1725a8d68');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e525-7217-b82e-298664bb8ae3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e529-700f-ae79-19b662aae456');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e52d-7224-978b-c4a6d5daab1c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e53b-71a9-9fd6-e7b0f214bfdb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e540-7020-b049-b1f66e29554a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e54e-7068-8763-079c54783293');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e55c-736c-a10b-1a15af9f4b3d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3da-7225-a2ad-3625451b7955');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e3e2-73af-8426-31a8561b745f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e561-72d3-a59f-1a8350b4685b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e566-7176-8099-9be974a59deb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e56a-7076-8129-a648f20e2d10');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e56f-7184-9662-0f8d9eda65fe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e579-70d6-b564-a024c3943ee0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e57e-738f-a1b2-948f0e642a2d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e582-703f-ba18-97d2068ed361');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e587-710f-9fad-1e5bae8d034f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e591-70c0-80ba-c451c5a7f8ca');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e596-7066-bf18-9c742a5c752b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e59a-72f8-9029-42d1b44ad5f6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e59f-7274-9475-b25717c18af9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5a4-70b9-a4b9-993813dc8e2c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5a9-7017-90f5-7f64ef7cb2b9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5ad-7051-a912-383ef67b1cc6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5b1-70e3-b8a0-08b57ed393e8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5b5-7018-a5ee-00d7e761135e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5ca-717e-9e08-f9708d66e781');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5cd-73cc-aec4-863b96e9770d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5d0-732b-baff-53dd85e1ce6b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5d7-70f8-944a-719f823aea82');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5da-706f-bf63-dcf5151f957c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5dc-70a9-8bcc-509720388463');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5de-7140-a0f5-a54fcb5b675e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5e0-73c0-a6d3-bb5983957ddb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5e1-73fe-88c9-5e299dea7b60');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5e3-70d7-95ee-db61127b2ca8');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5e6-7398-b51b-45483cf5a6bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5e7-7301-a012-e0a080d8a151');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5e9-719f-8a33-0ec2ad2957ea');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5eb-7203-93b5-2eb4bebf7ed6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5ef-7200-90c3-b6174ded5e16');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5f1-7359-9601-553e3856028f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5f3-71c5-ac02-d213a32f4d11');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5f8-7244-9c08-f91e19dc7eef');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5fa-70d8-9598-33864629ea7f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5fb-7330-bdd3-fac01592a928');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5fd-7061-bb82-88cdc7b9327a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e5fe-72fd-927b-be015ac33dd7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e600-7166-8d96-f5563675bef5');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', '01a1dae5-e602-73c3-9273-c868db1636ae');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e46e-7373-a15f-999ee660781a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e473-722e-9f9f-00175da72624');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e477-7291-a807-a0150b3520aa');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e47c-712c-b117-5d19e72ae52e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e423-71a4-978e-a077a5b7b48b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e428-7154-9dbc-d8dee761e6f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e42c-714f-8414-05eec0d4586b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e430-734c-9b0d-e16646090365');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e43a-7287-97e9-18992386e367');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e451-7016-bc9b-b009c2d635bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e456-73ed-b040-0745c8aff3c3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e411-733a-8e0d-ed6794588fb6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e3da-7225-a2ad-3625451b7955');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e480-717f-ab13-4779d0c67355');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e485-7234-9cd4-26cfc4646a69');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e48e-71dc-a8ef-8b00650839f0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e493-7281-93c1-2a317ff45448');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e4b3-712e-93db-aa199152366f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e513-72c9-af8f-61f8183f9b5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e515-7386-a886-81fe8f636b27');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e518-7052-b559-976165b4b3b0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e51d-70e5-a0c9-aa99130a2c15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e51f-737f-90f5-bd1a4befd628');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e561-72d3-a59f-1a8350b4685b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e566-7176-8099-9be974a59deb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e56a-7076-8129-a648f20e2d10');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e579-70d6-b564-a024c3943ee0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e57e-738f-a1b2-948f0e642a2d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e582-703f-ba18-97d2068ed361');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e587-710f-9fad-1e5bae8d034f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e591-70c0-80ba-c451c5a7f8ca');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e596-7066-bf18-9c742a5c752b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e59a-72f8-9029-42d1b44ad5f6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e59f-7274-9475-b25717c18af9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e5a4-70b9-a4b9-993813dc8e2c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e5b5-7018-a5ee-00d7e761135e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e5ca-717e-9e08-f9708d66e781');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e5cd-73cc-aec4-863b96e9770d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e50b-72b1-bf21-f1f2389d39eb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e5e7-7301-a012-e0a080d8a151');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e5ef-7200-90c3-b6174ded5e16');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e5f1-7359-9601-553e3856028f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e5fa-70d8-9598-33864629ea7f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', '01a1dae5-e600-7166-8d96-f5563675bef5');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e423-71a4-978e-a077a5b7b48b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e428-7154-9dbc-d8dee761e6f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e42c-714f-8414-05eec0d4586b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e3da-7225-a2ad-3625451b7955');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e456-73ed-b040-0745c8aff3c3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e480-717f-ab13-4779d0c67355');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e485-7234-9cd4-26cfc4646a69');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e48e-71dc-a8ef-8b00650839f0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e497-73d2-b042-f141e27da678');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e49c-7329-925e-41e0156ced09');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4b8-7088-ad89-0c4a023f21d3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4c6-7292-8927-fa93ebfafd91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4c9-7141-b3eb-346d18347376');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4da-72ab-bf5d-77f85ad008bf');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4de-7364-b223-edb4f592d913');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4e2-73da-99bb-853fa5252c1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4e5-72b8-8a7a-3d8a6f674092');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4ed-7050-97ea-bf535272a864');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e50b-72b1-bf21-f1f2389d39eb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e50e-70ce-83a1-1515647304bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e513-72c9-af8f-61f8183f9b5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e51d-70e5-a0c9-aa99130a2c15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e522-73b6-b7bd-62d1725a8d68');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e525-7217-b82e-298664bb8ae3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e537-7153-8b3b-45091eda2c00');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e540-7020-b049-b1f66e29554a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e557-7203-872c-40c76c824dec');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4b3-712e-93db-aa199152366f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e5ca-717e-9e08-f9708d66e781');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4f0-738e-9572-92b43231efd1');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e4f2-71ff-9bea-494c92332120');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e5e7-7301-a012-e0a080d8a151');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e5ef-7200-90c3-b6174ded5e16');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e5f1-7359-9601-553e3856028f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e5f7-73ea-8c44-6339535d60d9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e5fa-70d8-9598-33864629ea7f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', '01a1dae5-e5fd-7061-bb82-88cdc7b9327a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e423-71a4-978e-a077a5b7b48b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e42c-714f-8414-05eec0d4586b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e430-734c-9b0d-e16646090365');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e435-705c-b28d-8440bc0a3d76');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e43a-7287-97e9-18992386e367');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e44d-7207-a98b-dfba6e79bf89');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e451-7016-bc9b-b009c2d635bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e456-73ed-b040-0745c8aff3c3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e46a-7185-9fff-ee74258eea1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e480-717f-ab13-4779d0c67355');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e48e-71dc-a8ef-8b00650839f0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e497-73d2-b042-f141e27da678');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4a1-7172-844e-237b530a3e63');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4b3-712e-93db-aa199152366f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4b8-7088-ad89-0c4a023f21d3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4bd-722c-b77b-8eeb55e412d2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4c0-70cc-8065-aac36e7dc832');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4c3-7270-a15b-742bbd475af2');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4c6-7292-8927-fa93ebfafd91');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4c9-7141-b3eb-346d18347376');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4ce-73b2-837c-e4995d49e67d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4d2-7041-b1fa-9a2cbf9d80a0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4d6-730f-9060-86166ee36da3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4da-72ab-bf5d-77f85ad008bf');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4de-7364-b223-edb4f592d913');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4e2-73da-99bb-853fa5252c1b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e513-72c9-af8f-61f8183f9b5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e51d-70e5-a0c9-aa99130a2c15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e51f-737f-90f5-bd1a4befd628');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e522-73b6-b7bd-62d1725a8d68');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e525-7217-b82e-298664bb8ae3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e529-700f-ae79-19b662aae456');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e532-7189-9f80-265ee7c61309');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e537-7153-8b3b-45091eda2c00');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e53b-71a9-9fd6-e7b0f214bfdb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e540-7020-b049-b1f66e29554a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e545-7348-95db-90425767d731');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e549-7009-a0aa-4ed5e60260df');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e553-7233-ba6d-315199303406');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e557-7203-872c-40c76c824dec');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e55c-736c-a10b-1a15af9f4b3d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e561-72d3-a59f-1a8350b4685b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e574-7192-87ba-b233be460ca3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e579-70d6-b564-a024c3943ee0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e58c-71e5-a7c3-5e59669283bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e591-70c0-80ba-c451c5a7f8ca');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e5b5-7018-a5ee-00d7e761135e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e5ca-717e-9e08-f9708d66e781');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e5e7-7301-a012-e0a080d8a151');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e5ef-7200-90c3-b6174ded5e16');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', '01a1dae5-e5f8-7244-9c08-f91e19dc7eef');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e411-733a-8e0d-ed6794588fb6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e501-735a-ad52-0d44a73b5487');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e503-700f-983d-6c16a12197ac');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e50b-72b1-bf21-f1f2389d39eb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e50e-70ce-83a1-1515647304bb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e5a4-70b9-a4b9-993813dc8e2c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e5ad-7051-a912-383ef67b1cc6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e5d7-70f8-944a-719f823aea82');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', '01a1dae5-e5e0-73c0-a6d3-bb5983957ddb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e46e-7373-a15f-999ee660781a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e473-722e-9f9f-00175da72624');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e477-7291-a807-a0150b3520aa');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e47c-712c-b117-5d19e72ae52e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e423-71a4-978e-a077a5b7b48b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e428-7154-9dbc-d8dee761e6f7');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e42c-714f-8414-05eec0d4586b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e430-734c-9b0d-e16646090365');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e43a-7287-97e9-18992386e367');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e451-7016-bc9b-b009c2d635bc');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e456-73ed-b040-0745c8aff3c3');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e411-733a-8e0d-ed6794588fb6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e3da-7225-a2ad-3625451b7955');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e480-717f-ab13-4779d0c67355');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e485-7234-9cd4-26cfc4646a69');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e48e-71dc-a8ef-8b00650839f0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e493-7281-93c1-2a317ff45448');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e4b3-712e-93db-aa199152366f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e513-72c9-af8f-61f8183f9b5f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e515-7386-a886-81fe8f636b27');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e518-7052-b559-976165b4b3b0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e51d-70e5-a0c9-aa99130a2c15');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e51f-737f-90f5-bd1a4befd628');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e561-72d3-a59f-1a8350b4685b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e566-7176-8099-9be974a59deb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e56a-7076-8129-a648f20e2d10');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e579-70d6-b564-a024c3943ee0');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e57e-738f-a1b2-948f0e642a2d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e582-703f-ba18-97d2068ed361');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e587-710f-9fad-1e5bae8d034f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e591-70c0-80ba-c451c5a7f8ca');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e596-7066-bf18-9c742a5c752b');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e59a-72f8-9029-42d1b44ad5f6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e59f-7274-9475-b25717c18af9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5a4-70b9-a4b9-993813dc8e2c');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5b5-7018-a5ee-00d7e761135e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5ca-717e-9e08-f9708d66e781');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5cd-73cc-aec4-863b96e9770d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e508-70eb-8855-c5bc6849e11e');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e50b-72b1-bf21-f1f2389d39eb');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5e7-7301-a012-e0a080d8a151');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5ef-7200-90c3-b6174ded5e16');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5f1-7359-9601-553e3856028f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5fa-70d8-9598-33864629ea7f');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e600-7166-8d96-f5563675bef5');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5fd-7061-bb82-88cdc7b9327a');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', '01a1dae5-e5d7-70f8-944a-719f823aea82');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88e-7204-ae8a-078146406805', '01a1dae5-e3f9-721d-80da-1b0e2a608a7d');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88e-7204-ae8a-078146406805', '01a1dae5-e401-72f7-8990-77b20fea4697');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88e-7204-ae8a-078146406805', '01a1dae5-e3f1-738e-ba30-aee7433c96f9');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88e-7204-ae8a-078146406805', '01a1dae5-e4f4-7326-95d8-fb5c1e13e0c6');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88e-7204-ae8a-078146406805', '01a1dae5-e4fe-72f3-a069-704f6ceccffe');
INSERT INTO public.role_permission (role_id, permission_id) VALUES ('01a1dae5-e88e-7204-ae8a-078146406805', '01a1dae5-e508-70eb-8855-c5bc6849e11e');


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e87d-7034-b6f9-88139cd6c8b4', 'super-admin', 'Accès complet à l''ensemble de l''application', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e882-73ef-87bc-15dc9f0ee1b3', 'direction-generale', 'Pilote toutes les agences, les équipes et la comptabilité', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e884-7029-82f4-eda3bf80899c', 'responsable-agence', 'Gère une agence, ses commerciaux, factures et promotions', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e885-70d4-825c-1c0ec4990c28', 'responsable-departement', 'Gère un département et ses équipes', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e887-7173-bb55-a8e09ebaf21b', 'commercial', 'Suit sa clientèle, crée des factures et gagne des points', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e889-71b1-8aef-c00f109ed292', 'caissier', 'Encaisse les paiements et édite les factures', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e88a-71be-aa79-38650c88efd0', 'comptable', 'Consulte et exporte les factures et la comptabilité', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e88c-732c-8019-4f780ab64cf1', 'formateur', 'Consulte le catalogue de services et les promotions', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e88e-7204-ae8a-078146406805', 'client', 'Compte client enregistré lors de l''inscription en ligne', '2026-11-14 16:31:02', '2026-11-14 16:31:02');
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES ('01a1dae5-e890-7357-a2a3-a1509bf028e6', 'community-manager', 'Exécute les prestations Agency auxquelles il est affecté', '2026-11-14 16:31:02', '2026-11-14 16:31:02');


--
-- Data for Name: seller_profiles; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: seminar_tiers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: session_module_trainers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: session_participants; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-a330-727c-ac5f-e2525c886385', 'default_commission_type', '"percent"', 'Type de commission par défaut (none, percent, fixed)', NULL, '2026-11-14 16:30:45', '2026-11-14 16:30:45');
INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-a33b-7339-9fbb-90c0b73d27bf', 'default_commission_value', '20', 'Valeur de commission par défaut', NULL, '2026-11-14 16:30:45', '2026-11-14 16:30:45');
INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-f265-7387-b570-b9c73bcb37fc', 'sales_points_per_sale', '3', 'Points attribués par vente payée intégralement', NULL, '2026-11-14 16:31:05', '2026-11-14 16:31:05');
INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-f26a-7270-b3c5-a42aee76a872', 'inactivity_period_days', '14', 'Jours sans vente payée avant pénalité d''inactivité', NULL, '2026-11-14 16:31:05', '2026-11-14 16:31:05');
INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-f26d-71bb-bfca-8d071f6f2859', 'inactivity_penalty_points', '5', 'Points retirés en cas d''inactivité', NULL, '2026-11-14 16:31:05', '2026-11-14 16:31:05');
INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-f273-70d0-b9bc-f22c0d60dbb8', 'invoice_prefix', '"PK"', 'Préfixe des numéros de facture', NULL, '2026-11-14 16:31:05', '2026-11-14 16:31:05');
INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-f276-708b-a658-8f18be6e83e4', 'group_currency', '"XAF"', 'Monnaie d''affichage des agrégats PEKEGNO GROUP', NULL, '2026-11-14 16:31:05', '2026-11-14 16:31:05');
INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-f278-7046-8527-129444dad150', 'prospect_points_per_add', '2', 'Points attribués par prospect ramené', NULL, '2026-11-14 16:31:05', '2026-11-14 16:31:05');
INSERT INTO public.settings (id, key, value, description, updated_by, created_at, updated_at) VALUES ('01a1dae5-f27b-7308-aa68-8726036f5812', 'prospect_points_per_conversion', '5', 'Points attribués lors de la conversion d''un prospect en client', NULL, '2026-11-14 16:31:05', '2026-11-14 16:31:05');


--
-- Data for Name: subscription_notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: subscription_pack_services; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: subscription_packs; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: trainer_points; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: trainers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: training_sessions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: treasury_accounts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: treasury_transactions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: user_assignments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, username, email, password, first_name, last_name, phone, is_active, two_factor_enabled, active_session_id, last_login_at, last_login_ip, is_password_change_required, email_verified_at, remember_token, created_at, updated_at, role_id, two_factor_secret, last_activity_at, client_number, city, country, address, client_category_id, country_id, city_id, failed_attempts, locked_until, status, registered_agency_id, commercial_user_id, registered_at, two_factor_channel, nationality, quartier, occupation, deleted_at) VALUES ('01a1dae5-f62d-712f-a4af-f74a381c3982', 'admin', 'admin@pekegno.com', '$2y$12$rVyGLc.6XoPGaPiXnQNbx.PQCERrK4bggSdv1lk4ppJ1HbUX8Pm0y', 'Admin', 'PEKEGNO', NULL, true, false, NULL, NULL, NULL, false, NULL, NULL, '2026-11-14 16:31:06', '2026-11-14 16:31:06', '01a1dae5-e87d-7034-b6f9-88139cd6c8b4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 'active', NULL, NULL, NULL, 'totp', NULL, NULL, NULL, NULL);
INSERT INTO public.users (id, username, email, password, first_name, last_name, phone, is_active, two_factor_enabled, active_session_id, last_login_at, last_login_ip, is_password_change_required, email_verified_at, remember_token, created_at, updated_at, role_id, two_factor_secret, last_activity_at, client_number, city, country, address, client_category_id, country_id, city_id, failed_attempts, locked_until, status, registered_agency_id, commercial_user_id, registered_at, two_factor_channel, nationality, quartier, occupation, deleted_at) VALUES ('01a1dae5-f70a-72d6-95ee-18b6a020de69', 'admin2', 'admin2@pekegno.com', '$2y$12$nN/yID3CwX8woR05ZW25YOzZvhLyagDtUt3xRqKSIRelfzmABnvz2', 'Admin 2', 'PEKEGNO', NULL, true, false, NULL, NULL, NULL, false, NULL, NULL, '2026-11-14 16:31:06', '2026-11-14 16:31:06', '01a1dae5-e87d-7034-b6f9-88139cd6c8b4', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 'active', NULL, NULL, NULL, 'totp', NULL, NULL, NULL, NULL);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.failed_jobs_id_seq', 1, false);


--
-- Name: jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.jobs_id_seq', 1, false);


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 215, true);


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.personal_access_tokens_id_seq', 1, false);


--
-- Name: accounting_categories accounting_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_categories
    ADD CONSTRAINT accounting_categories_pkey PRIMARY KEY (id);


--
-- Name: accounting_transactions accounting_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_pkey PRIMARY KEY (id);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: ad_campaigns ad_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_pkey PRIMARY KEY (id);


--
-- Name: agencies agencies_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_code_unique UNIQUE (code);


--
-- Name: agencies agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_pkey PRIMARY KEY (id);


--
-- Name: agency_activities agency_activities_agency_id_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_activities
    ADD CONSTRAINT agency_activities_agency_id_type_unique UNIQUE (agency_id, type);


--
-- Name: agency_activities agency_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_activities
    ADD CONSTRAINT agency_activities_pkey PRIMARY KEY (id);


--
-- Name: agency_categories agency_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_categories
    ADD CONSTRAINT agency_categories_pkey PRIMARY KEY (id);


--
-- Name: agency_notifications agency_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_notifications
    ADD CONSTRAINT agency_notifications_pkey PRIMARY KEY (id);


--
-- Name: agency_payment_methods agency_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_payment_methods
    ADD CONSTRAINT agency_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- Name: attendances attendances_session_module_date_learner_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_session_module_date_learner_unique UNIQUE (training_session_id, course_module_id, session_date, learner_user_id);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: cash_closings cash_closings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_closings
    ADD CONSTRAINT cash_closings_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_number_unique UNIQUE (number);


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: cities cities_country_id_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_country_id_name_unique UNIQUE (country_id, name);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: client_categories client_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_categories
    ADD CONSTRAINT client_categories_pkey PRIMARY KEY (id);


--
-- Name: client_categories client_categories_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_categories
    ADD CONSTRAINT client_categories_slug_unique UNIQUE (slug);


--
-- Name: client_team_roles client_team_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_team_roles
    ADD CONSTRAINT client_team_roles_pkey PRIMARY KEY (id);


--
-- Name: commercial_points commercial_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_points
    ADD CONSTRAINT commercial_points_pkey PRIMARY KEY (id);


--
-- Name: commercials commercials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercials
    ADD CONSTRAINT commercials_pkey PRIMARY KEY (id);


--
-- Name: commercials commercials_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercials
    ADD CONSTRAINT commercials_user_id_unique UNIQUE (user_id);


--
-- Name: commission_entries commission_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_pkey PRIMARY KEY (id);


--
-- Name: commission_payments commission_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_pkey PRIMARY KEY (id);


--
-- Name: commission_rule_role commission_rule_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rule_role
    ADD CONSTRAINT commission_rule_role_pkey PRIMARY KEY (rule_group_id, role_id);


--
-- Name: commission_rules commission_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_pkey PRIMARY KEY (id);


--
-- Name: commission_rules commission_rules_rule_group_id_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_rule_group_id_version_unique UNIQUE (rule_group_id, version);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: contract_services contract_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_services
    ADD CONSTRAINT contract_services_pkey PRIMARY KEY (contract_id, service_id);


--
-- Name: contracts contracts_legacy_subscription_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_legacy_subscription_id_unique UNIQUE (legacy_subscription_id);


--
-- Name: contracts contracts_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_number_unique UNIQUE (number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: countries countries_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_code_unique UNIQUE (code);


--
-- Name: countries countries_iso_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_iso_code_unique UNIQUE (iso_code);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: course_categories course_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_categories
    ADD CONSTRAINT course_categories_pkey PRIMARY KEY (id);


--
-- Name: course_course_category course_course_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_course_category
    ADD CONSTRAINT course_course_category_pkey PRIMARY KEY (course_id, course_category_id);


--
-- Name: course_modules course_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_modules
    ADD CONSTRAINT course_modules_pkey PRIMARY KEY (id);


--
-- Name: courses courses_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_code_unique UNIQUE (code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: courses courses_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_slug_unique UNIQUE (slug);


--
-- Name: daily_balances daily_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_balances
    ADD CONSTRAINT daily_balances_pkey PRIMARY KEY (id);


--
-- Name: department_chiefs department_chiefs_department_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_chiefs
    ADD CONSTRAINT department_chiefs_department_id_unique UNIQUE (department_id);


--
-- Name: department_chiefs department_chiefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_chiefs
    ADD CONSTRAINT department_chiefs_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_number_unique UNIQUE (number);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: formation_enrollments formation_enrollments_course_id_learner_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formation_enrollments
    ADD CONSTRAINT formation_enrollments_course_id_learner_user_id_unique UNIQUE (course_id, learner_user_id);


--
-- Name: formation_enrollments formation_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formation_enrollments
    ADD CONSTRAINT formation_enrollments_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_payments invoice_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_pkey PRIMARY KEY (id);


--
-- Name: invoice_payments invoice_payments_receipt_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_receipt_number_unique UNIQUE (receipt_number);


--
-- Name: invoices invoices_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_number_unique UNIQUE (number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: learner_observations learner_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_pkey PRIMARY KEY (id);


--
-- Name: login_logs login_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: order_lines order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_pkey PRIMARY KEY (id);


--
-- Name: orders orders_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_number_unique UNIQUE (number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_code_unique UNIQUE (code);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: package_items package_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_items
    ADD CONSTRAINT package_items_pkey PRIMARY KEY (id);


--
-- Name: package_recommendations package_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_recommendations
    ADD CONSTRAINT package_recommendations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: payment_proofs payment_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_proofs
    ADD CONSTRAINT payment_proofs_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_unique UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);


--
-- Name: prestation_action_comments prestation_action_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_comments
    ADD CONSTRAINT prestation_action_comments_pkey PRIMARY KEY (id);


--
-- Name: prestation_action_executions prestation_action_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_executions
    ADD CONSTRAINT prestation_action_executions_pkey PRIMARY KEY (id);


--
-- Name: prestation_action_logs prestation_action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_logs
    ADD CONSTRAINT prestation_action_logs_pkey PRIMARY KEY (id);


--
-- Name: prestation_action_reviews prestation_action_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_reviews
    ADD CONSTRAINT prestation_action_reviews_pkey PRIMARY KEY (id);


--
-- Name: prestation_actions prestation_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_actions
    ADD CONSTRAINT prestation_actions_pkey PRIMARY KEY (id);


--
-- Name: prestation_offers prestation_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_offers
    ADD CONSTRAINT prestation_offers_pkey PRIMARY KEY (id);


--
-- Name: prestation_team_members prestation_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_team_members
    ADD CONSTRAINT prestation_team_members_pkey PRIMARY KEY (id);


--
-- Name: prestations prestations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_pkey PRIMARY KEY (id);


--
-- Name: prestations prestations_reference_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_reference_unique UNIQUE (reference);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_unique UNIQUE (sku);


--
-- Name: products products_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_unique UNIQUE (slug);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: prospects prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_pkey PRIMARY KEY (id);


--
-- Name: role_permission role_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_unique UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: seller_profiles seller_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_profiles
    ADD CONSTRAINT seller_profiles_pkey PRIMARY KEY (id);


--
-- Name: seller_profiles seller_profiles_user_id_agency_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_profiles
    ADD CONSTRAINT seller_profiles_user_id_agency_id_unique UNIQUE (user_id, agency_id);


--
-- Name: seminar_tiers seminar_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seminar_tiers
    ADD CONSTRAINT seminar_tiers_pkey PRIMARY KEY (id);


--
-- Name: seminar_tiers seminar_tiers_service_id_tier_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seminar_tiers
    ADD CONSTRAINT seminar_tiers_service_id_tier_unique UNIQUE (service_id, tier);


--
-- Name: services services_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_code_unique UNIQUE (code);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: services services_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_slug_unique UNIQUE (slug);


--
-- Name: session_module_trainers session_module_trainers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_module_trainers
    ADD CONSTRAINT session_module_trainers_pkey PRIMARY KEY (id);


--
-- Name: session_module_trainers session_module_trainers_training_session_id_course_module_id_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_module_trainers
    ADD CONSTRAINT session_module_trainers_training_session_id_course_module_id_un UNIQUE (training_session_id, course_module_id);


--
-- Name: session_participants session_participant_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_participants
    ADD CONSTRAINT session_participant_unique UNIQUE (training_session_id, formation_enrollment_id);


--
-- Name: session_participants session_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_participants
    ADD CONSTRAINT session_participants_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_unique UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: subscription_notifications subscription_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_notifications
    ADD CONSTRAINT subscription_notifications_pkey PRIMARY KEY (id);


--
-- Name: subscription_notifications subscription_notifications_subscription_id_notification_type_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_notifications
    ADD CONSTRAINT subscription_notifications_subscription_id_notification_type_un UNIQUE (subscription_id, notification_type);


--
-- Name: subscription_pack_services subscription_pack_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pack_services
    ADD CONSTRAINT subscription_pack_services_pkey PRIMARY KEY (id);


--
-- Name: subscription_packs subscription_packs_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_packs
    ADD CONSTRAINT subscription_packs_code_unique UNIQUE (code);


--
-- Name: subscription_packs subscription_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_packs
    ADD CONSTRAINT subscription_packs_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_unique UNIQUE (user_id);


--
-- Name: trainer_points trainer_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_points
    ADD CONSTRAINT trainer_points_pkey PRIMARY KEY (id);


--
-- Name: trainers trainers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainers
    ADD CONSTRAINT trainers_pkey PRIMARY KEY (id);


--
-- Name: trainers trainers_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainers
    ADD CONSTRAINT trainers_user_id_unique UNIQUE (user_id);


--
-- Name: training_sessions training_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_pkey PRIMARY KEY (id);


--
-- Name: treasury_accounts treasury_accounts_agency_id_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts
    ADD CONSTRAINT treasury_accounts_agency_id_code_unique UNIQUE (agency_id, code);


--
-- Name: treasury_accounts treasury_accounts_agency_id_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts
    ADD CONSTRAINT treasury_accounts_agency_id_name_unique UNIQUE (agency_id, name);


--
-- Name: treasury_accounts treasury_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts
    ADD CONSTRAINT treasury_accounts_pkey PRIMARY KEY (id);


--
-- Name: treasury_transactions treasury_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_pkey PRIMARY KEY (id);


--
-- Name: prestation_action_reviews uq_action_review_client; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_reviews
    ADD CONSTRAINT uq_action_review_client UNIQUE (prestation_action_id, client_user_id);


--
-- Name: agency_notifications uq_agency_notification_dedupe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_notifications
    ADD CONSTRAINT uq_agency_notification_dedupe UNIQUE (user_id, dedupe_key);


--
-- Name: prestation_team_members uq_prestation_team_member; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_team_members
    ADD CONSTRAINT uq_prestation_team_member UNIQUE (prestation_id, user_id, client_team_role_id);


--
-- Name: user_assignments user_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_pkey PRIMARY KEY (user_id, agency_id);


--
-- Name: users users_client_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_client_number_unique UNIQUE (client_number);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: accounting_transactions_agency_id_transacted_at_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounting_transactions_agency_id_transacted_at_type_index ON public.accounting_transactions USING btree (agency_id, transacted_at, type);


--
-- Name: accounting_transactions_department_id_transacted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounting_transactions_department_id_transacted_at_index ON public.accounting_transactions USING btree (department_id, transacted_at);


--
-- Name: accounting_transactions_type_is_transfer_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounting_transactions_type_is_transfer_index ON public.accounting_transactions USING btree (type, is_transfer);


--
-- Name: activities_assigned_to_due_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_assigned_to_due_at_index ON public.activities USING btree (assigned_to, due_at);


--
-- Name: activities_subject_type_subject_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_subject_type_subject_id_index ON public.activities USING btree (subject_type, subject_id);


--
-- Name: activity_logs_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_created_at_index ON public.activity_logs USING btree (created_at);


--
-- Name: activity_logs_entity_type_entity_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_entity_type_entity_id_index ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: ad_campaigns_country_id_branch_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ad_campaigns_country_id_branch_index ON public.ad_campaigns USING btree (country_id, branch);


--
-- Name: ad_campaigns_is_national_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ad_campaigns_is_national_status_index ON public.ad_campaigns USING btree (is_national, status);


--
-- Name: ad_campaigns_start_date_end_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ad_campaigns_start_date_end_date_index ON public.ad_campaigns USING btree (start_date, end_date);


--
-- Name: agencies_city_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agencies_city_id_index ON public.agencies USING btree (city_id);


--
-- Name: agencies_country_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agencies_country_id_index ON public.agencies USING btree (country_id);


--
-- Name: agency_activities_agency_id_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agency_activities_agency_id_is_active_index ON public.agency_activities USING btree (agency_id, is_active);


--
-- Name: agency_categories_department_id_kind_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agency_categories_department_id_kind_index ON public.agency_categories USING btree (department_id, kind);


--
-- Name: agency_notifications_user_id_read_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agency_notifications_user_id_read_at_index ON public.agency_notifications USING btree (user_id, read_at);


--
-- Name: agency_payment_methods_agency_id_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agency_payment_methods_agency_id_is_active_index ON public.agency_payment_methods USING btree (agency_id, is_active);


--
-- Name: attendances_course_module_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendances_course_module_id_index ON public.attendances USING btree (course_module_id);


--
-- Name: attendances_training_session_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendances_training_session_id_index ON public.attendances USING btree (training_session_id);


--
-- Name: attendances_training_session_id_session_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendances_training_session_id_session_date_index ON public.attendances USING btree (training_session_id, session_date);


--
-- Name: cache_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_expiration_index ON public.cache USING btree (expiration);


--
-- Name: cache_locks_expiration_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_locks_expiration_index ON public.cache_locks USING btree (expiration);


--
-- Name: cart_items_cart_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cart_items_cart_id_index ON public.cart_items USING btree (cart_id);


--
-- Name: cash_closings_agency_id_closing_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_closings_agency_id_closing_date_index ON public.cash_closings USING btree (agency_id, closing_date);


--
-- Name: cash_closings_treasury_account_id_reopened_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cash_closings_treasury_account_id_reopened_at_index ON public.cash_closings USING btree (treasury_account_id, reopened_at);


--
-- Name: certificates_number_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX certificates_number_index ON public.certificates USING btree (number);


--
-- Name: certificates_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX certificates_status_index ON public.certificates USING btree (status);


--
-- Name: commercial_points_commercial_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commercial_points_commercial_id_created_at_index ON public.commercial_points USING btree (commercial_id, created_at);


--
-- Name: commission_entries_beneficiary_commercial_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_entries_beneficiary_commercial_id_status_index ON public.commission_entries USING btree (beneficiary_commercial_id, status);


--
-- Name: commission_entries_commission_rule_id_beneficiary_user_id_perio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_entries_commission_rule_id_beneficiary_user_id_perio ON public.commission_entries USING btree (commission_rule_id, beneficiary_user_id, period);


--
-- Name: commission_entries_invoice_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_entries_invoice_id_index ON public.commission_entries USING btree (invoice_id);


--
-- Name: commission_entries_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_entries_status_index ON public.commission_entries USING btree (status);


--
-- Name: commission_payments_commercial_id_invoice_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_payments_commercial_id_invoice_id_index ON public.commission_payments USING btree (commercial_id, invoice_id);


--
-- Name: commission_payments_payment_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_payments_payment_id_index ON public.commission_payments USING btree (payment_id);


--
-- Name: commission_rule_role_role_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_rule_role_role_id_index ON public.commission_rule_role USING btree (role_id);


--
-- Name: commission_rules_beneficiary_seller_profile_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_rules_beneficiary_seller_profile_id_index ON public.commission_rules USING btree (beneficiary_seller_profile_id);


--
-- Name: commission_rules_course_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_rules_course_id_index ON public.commission_rules USING btree (course_id);


--
-- Name: commission_rules_scope_agency_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_rules_scope_agency_id_index ON public.commission_rules USING btree (scope_agency_id);


--
-- Name: commission_rules_scope_department_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_rules_scope_department_id_index ON public.commission_rules USING btree (scope_department_id);


--
-- Name: commission_rules_service_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commission_rules_service_id_index ON public.commission_rules USING btree (service_id);


--
-- Name: companies_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_name_index ON public.companies USING btree (name);


--
-- Name: contracts_client_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contracts_client_id_index ON public.contracts USING btree (client_id);


--
-- Name: contracts_status_end_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contracts_status_end_date_index ON public.contracts USING btree (status, end_date);


--
-- Name: course_modules_course_id_order_index_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_modules_course_id_order_index_index ON public.course_modules USING btree (course_id, order_index);


--
-- Name: courses_agency_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_agency_id_index ON public.courses USING btree (agency_id);


--
-- Name: courses_mode_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_mode_index ON public.courses USING btree (mode);


--
-- Name: daily_balances_agency_id_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_balances_agency_id_date_index ON public.daily_balances USING btree (agency_id, date);


--
-- Name: expenses_ad_campaign_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_ad_campaign_id_index ON public.expenses USING btree (ad_campaign_id);


--
-- Name: expenses_agency_id_expense_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_agency_id_expense_date_index ON public.expenses USING btree (agency_id, expense_date);


--
-- Name: expenses_invoice_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_invoice_id_index ON public.expenses USING btree (invoice_id);


--
-- Name: expenses_service_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_service_id_index ON public.expenses USING btree (service_id);


--
-- Name: expenses_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_status_index ON public.expenses USING btree (status);


--
-- Name: failed_jobs_connection_queue_failed_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX failed_jobs_connection_queue_failed_at_index ON public.failed_jobs USING btree (connection, queue, failed_at);


--
-- Name: formation_enrollments_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX formation_enrollments_status_index ON public.formation_enrollments USING btree (status);


--
-- Name: idx_pa_exec_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_exec_status ON public.prestation_action_executions USING btree (prestation_action_id, status);


--
-- Name: idx_pa_exec_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_exec_week ON public.prestation_action_executions USING btree (prestation_action_id, week_number);


--
-- Name: invoice_items_category_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_category_id_index ON public.invoice_items USING btree (category_id);


--
-- Name: invoice_payments_received_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_payments_received_at_index ON public.invoice_payments USING btree (received_at);


--
-- Name: invoice_payments_validation_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_payments_validation_status_index ON public.invoice_payments USING btree (validation_status);


--
-- Name: invoices_agency_id_invoice_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_agency_id_invoice_date_index ON public.invoices USING btree (agency_id, invoice_date);


--
-- Name: invoices_due_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_due_date_index ON public.invoices USING btree (due_date);


--
-- Name: invoices_invoice_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_invoice_date_index ON public.invoices USING btree (invoice_date);


--
-- Name: invoices_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_status_index ON public.invoices USING btree (status);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: learner_observations_learner_user_id_course_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learner_observations_learner_user_id_course_id_index ON public.learner_observations USING btree (learner_user_id, course_id);


--
-- Name: opportunities_agency_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX opportunities_agency_id_index ON public.opportunities USING btree (agency_id);


--
-- Name: opportunities_commercial_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX opportunities_commercial_id_index ON public.opportunities USING btree (commercial_id);


--
-- Name: opportunities_stage_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX opportunities_stage_index ON public.opportunities USING btree (stage);


--
-- Name: orders_agency_id_order_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_agency_id_order_date_index ON public.orders USING btree (agency_id, order_date);


--
-- Name: orders_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_status_index ON public.orders USING btree (status);


--
-- Name: payment_proofs_invoice_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_proofs_invoice_id_status_index ON public.payment_proofs USING btree (invoice_id, status);


--
-- Name: personal_access_tokens_expires_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_expires_at_index ON public.personal_access_tokens USING btree (expires_at);


--
-- Name: personal_access_tokens_tokenable_type_tokenable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- Name: prestation_action_reviews_prestation_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestation_action_reviews_prestation_id_index ON public.prestation_action_reviews USING btree (prestation_id);


--
-- Name: prestation_actions_prestation_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestation_actions_prestation_id_status_index ON public.prestation_actions USING btree (prestation_id, status);


--
-- Name: prestation_offers_agency_id_department_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestation_offers_agency_id_department_id_index ON public.prestation_offers USING btree (agency_id, department_id);


--
-- Name: prestations_agency_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestations_agency_id_status_index ON public.prestations USING btree (agency_id, status);


--
-- Name: prestations_client_direct_rating_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestations_client_direct_rating_index ON public.prestations USING btree (client_direct_rating);


--
-- Name: prestations_client_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestations_client_id_index ON public.prestations USING btree (client_id);


--
-- Name: prestations_offer_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prestations_offer_id_index ON public.prestations USING btree (offer_id);


--
-- Name: products_agency_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_agency_id_index ON public.products USING btree (agency_id);


--
-- Name: products_branch_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_branch_index ON public.products USING btree (branch);


--
-- Name: products_category_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_category_id_index ON public.products USING btree (category_id);


--
-- Name: products_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_is_active_index ON public.products USING btree (is_active);


--
-- Name: prospects_commercial_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prospects_commercial_id_created_at_index ON public.prospects USING btree (commercial_id, created_at);


--
-- Name: seller_profiles_kind_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seller_profiles_kind_index ON public.seller_profiles USING btree (kind);


--
-- Name: services_branch_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_branch_index ON public.services USING btree (branch);


--
-- Name: session_module_trainers_trainer_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_module_trainers_trainer_id_index ON public.session_module_trainers USING btree (trainer_id);


--
-- Name: session_participants_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_participants_status_index ON public.session_participants USING btree (status);


--
-- Name: sessions_last_activity_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);


--
-- Name: sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);


--
-- Name: subscription_notifications_status_notification_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscription_notifications_status_notification_type_index ON public.subscription_notifications USING btree (status, notification_type);


--
-- Name: subscriptions_agency_id_start_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_agency_id_start_date_index ON public.subscriptions USING btree (agency_id, start_date);


--
-- Name: subscriptions_client_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_client_id_index ON public.subscriptions USING btree (client_id);


--
-- Name: subscriptions_end_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_end_date_index ON public.subscriptions USING btree (end_date);


--
-- Name: subscriptions_end_date_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_end_date_status_index ON public.subscriptions USING btree (end_date, status);


--
-- Name: subscriptions_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_status_index ON public.subscriptions USING btree (status);


--
-- Name: team_members_agency_id_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_members_agency_id_is_active_index ON public.team_members USING btree (agency_id, is_active);


--
-- Name: team_members_department_id_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_members_department_id_is_active_index ON public.team_members USING btree (department_id, is_active);


--
-- Name: trainer_points_trainer_id_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trainer_points_trainer_id_created_at_index ON public.trainer_points USING btree (trainer_id, created_at);


--
-- Name: trainers_agency_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trainers_agency_id_index ON public.trainers USING btree (agency_id);


--
-- Name: training_sessions_agency_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_sessions_agency_id_index ON public.training_sessions USING btree (agency_id);


--
-- Name: training_sessions_start_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_sessions_start_at_index ON public.training_sessions USING btree (start_at);


--
-- Name: training_sessions_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_sessions_status_index ON public.training_sessions USING btree (status);


--
-- Name: treasury_accounts_method_key_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treasury_accounts_method_key_index ON public.treasury_accounts USING btree (method_key);


--
-- Name: treasury_accounts_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treasury_accounts_type_index ON public.treasury_accounts USING btree (type);


--
-- Name: treasury_transactions_source_type_source_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treasury_transactions_source_type_source_id_index ON public.treasury_transactions USING btree (source_type, source_id);


--
-- Name: treasury_transactions_treasury_account_id_transacted_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treasury_transactions_treasury_account_id_transacted_at_index ON public.treasury_transactions USING btree (treasury_account_id, transacted_at);


--
-- Name: uq_agency_chief; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_agency_chief ON public.user_assignments USING btree (agency_id) WHERE (is_primary = true);


--
-- Name: uq_department_chief; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_department_chief ON public.user_assignments USING btree (department_id) WHERE ((is_department_chief = true) AND (department_id IS NOT NULL));


--
-- Name: users_city_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_city_id_index ON public.users USING btree (city_id);


--
-- Name: users_client_category_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_client_category_id_index ON public.users USING btree (client_category_id);


--
-- Name: users_commercial_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_commercial_user_id_index ON public.users USING btree (commercial_user_id);


--
-- Name: users_country_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_country_id_index ON public.users USING btree (country_id);


--
-- Name: users_registered_agency_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_registered_agency_id_index ON public.users USING btree (registered_agency_id);


--
-- Name: users_registered_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_registered_at_index ON public.users USING btree (registered_at);


--
-- Name: users_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_status_index ON public.users USING btree (status);


--
-- Name: accounting_categories accounting_categories_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_categories
    ADD CONSTRAINT accounting_categories_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: accounting_transactions accounting_transactions_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: accounting_transactions accounting_transactions_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.accounting_categories(id) ON DELETE SET NULL;


--
-- Name: accounting_transactions accounting_transactions_client_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_client_id_foreign FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: accounting_transactions accounting_transactions_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_country_id_foreign FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: accounting_transactions accounting_transactions_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: accounting_transactions accounting_transactions_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: accounting_transactions accounting_transactions_operator_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_operator_id_foreign FOREIGN KEY (operator_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: accounting_transactions accounting_transactions_treasury_account_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_transactions
    ADD CONSTRAINT accounting_transactions_treasury_account_id_foreign FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;


--
-- Name: activities activities_assigned_to_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_assigned_to_foreign FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: activities activities_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_country_id_foreign FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: activity_logs activity_logs_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ad_campaigns ad_campaigns_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: ad_campaigns ad_campaigns_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_campaigns
    ADD CONSTRAINT ad_campaigns_country_id_foreign FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE CASCADE;


--
-- Name: agencies agencies_city_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_city_id_foreign FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;


--
-- Name: agencies agencies_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_country_id_foreign FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: agencies agencies_organization_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: agency_activities agency_activities_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_activities
    ADD CONSTRAINT agency_activities_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: agency_categories agency_categories_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_categories
    ADD CONSTRAINT agency_categories_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: agency_notifications agency_notifications_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_notifications
    ADD CONSTRAINT agency_notifications_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: agency_payment_methods agency_payment_methods_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agency_payment_methods
    ADD CONSTRAINT agency_payment_methods_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: attendances attendances_course_module_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_course_module_id_foreign FOREIGN KEY (course_module_id) REFERENCES public.course_modules(id) ON DELETE SET NULL;


--
-- Name: attendances attendances_learner_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_learner_user_id_foreign FOREIGN KEY (learner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendances attendances_recorded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_recorded_by_foreign FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendances attendances_training_session_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_training_session_id_foreign FOREIGN KEY (training_session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_cart_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_foreign FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: cart_items cart_items_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: carts carts_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: carts carts_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cash_closings cash_closings_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_closings
    ADD CONSTRAINT cash_closings_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: cash_closings cash_closings_closed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_closings
    ADD CONSTRAINT cash_closings_closed_by_foreign FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cash_closings cash_closings_reopened_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_closings
    ADD CONSTRAINT cash_closings_reopened_by_foreign FOREIGN KEY (reopened_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cash_closings cash_closings_treasury_account_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_closings
    ADD CONSTRAINT cash_closings_treasury_account_id_foreign FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE CASCADE;


--
-- Name: cash_closings cash_closings_validated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_closings
    ADD CONSTRAINT cash_closings_validated_by_foreign FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: certificates certificates_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: certificates certificates_enrollment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_enrollment_id_foreign FOREIGN KEY (enrollment_id) REFERENCES public.formation_enrollments(id) ON DELETE CASCADE;


--
-- Name: cities cities_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_country_id_foreign FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE CASCADE;


--
-- Name: client_team_roles client_team_roles_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_team_roles
    ADD CONSTRAINT client_team_roles_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: commercial_points commercial_points_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_points
    ADD CONSTRAINT commercial_points_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES public.commercials(id) ON DELETE CASCADE;


--
-- Name: commercial_points commercial_points_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_points
    ADD CONSTRAINT commercial_points_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commercial_points commercial_points_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercial_points
    ADD CONSTRAINT commercial_points_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: commercials commercials_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercials
    ADD CONSTRAINT commercials_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: commercials commercials_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commercials
    ADD CONSTRAINT commercials_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commission_entries commission_entries_beneficiary_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_beneficiary_commercial_id_foreign FOREIGN KEY (beneficiary_commercial_id) REFERENCES public.commercials(id) ON DELETE RESTRICT;


--
-- Name: commission_entries commission_entries_beneficiary_team_member_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_beneficiary_team_member_id_foreign FOREIGN KEY (beneficiary_team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: commission_entries commission_entries_beneficiary_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_beneficiary_user_id_foreign FOREIGN KEY (beneficiary_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commission_entries commission_entries_commission_rule_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_commission_rule_id_foreign FOREIGN KEY (commission_rule_id) REFERENCES public.commission_rules(id) ON DELETE RESTRICT;


--
-- Name: commission_entries commission_entries_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: commission_entries commission_entries_invoice_payment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_invoice_payment_id_foreign FOREIGN KEY (invoice_payment_id) REFERENCES public.invoice_payments(id) ON DELETE SET NULL;


--
-- Name: commission_entries commission_entries_paid_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_paid_by_foreign FOREIGN KEY (paid_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commission_entries commission_entries_seller_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_seller_profile_id_foreign FOREIGN KEY (seller_profile_id) REFERENCES public.seller_profiles(id) ON DELETE SET NULL;


--
-- Name: commission_entries commission_entries_validated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_entries
    ADD CONSTRAINT commission_entries_validated_by_foreign FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commission_payments commission_payments_beneficiary_team_member_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_beneficiary_team_member_id_foreign FOREIGN KEY (beneficiary_team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: commission_payments commission_payments_beneficiary_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_beneficiary_user_id_foreign FOREIGN KEY (beneficiary_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commission_payments commission_payments_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES public.commercials(id) ON DELETE CASCADE;


--
-- Name: commission_payments commission_payments_commission_entry_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_commission_entry_id_foreign FOREIGN KEY (commission_entry_id) REFERENCES public.commission_entries(id) ON DELETE SET NULL;


--
-- Name: commission_payments commission_payments_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: commission_payments commission_payments_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: commission_payments commission_payments_payment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_payment_id_foreign FOREIGN KEY (payment_id) REFERENCES public.invoice_payments(id) ON DELETE SET NULL;


--
-- Name: commission_payments commission_payments_seller_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_seller_profile_id_foreign FOREIGN KEY (seller_profile_id) REFERENCES public.seller_profiles(id) ON DELETE SET NULL;


--
-- Name: commission_payments commission_payments_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: commission_payments commission_payments_treasury_account_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_payments
    ADD CONSTRAINT commission_payments_treasury_account_id_foreign FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;


--
-- Name: commission_rule_role commission_rule_role_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rule_role
    ADD CONSTRAINT commission_rule_role_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: commission_rules commission_rules_beneficiary_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_beneficiary_commercial_id_foreign FOREIGN KEY (beneficiary_commercial_id) REFERENCES public.commercials(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_beneficiary_seller_profile_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_beneficiary_seller_profile_id_foreign FOREIGN KEY (beneficiary_seller_profile_id) REFERENCES public.seller_profiles(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_course_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_course_id_foreign FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: commission_rules commission_rules_package_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_package_id_foreign FOREIGN KEY (package_id) REFERENCES public.subscription_packs(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_product_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_scope_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_scope_agency_id_foreign FOREIGN KEY (scope_agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_scope_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_scope_country_id_foreign FOREIGN KEY (scope_country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_scope_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_scope_department_id_foreign FOREIGN KEY (scope_department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: commission_rules commission_rules_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commission_rules
    ADD CONSTRAINT commission_rules_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: contract_services contract_services_contract_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_services
    ADD CONSTRAINT contract_services_contract_id_foreign FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contract_services contract_services_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_services
    ADD CONSTRAINT contract_services_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- Name: contracts contracts_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_client_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_client_id_foreign FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: contracts contracts_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES public.commercials(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_company_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_company_id_foreign FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_legacy_subscription_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_legacy_subscription_id_foreign FOREIGN KEY (legacy_subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_pack_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pack_id_foreign FOREIGN KEY (pack_id) REFERENCES public.subscription_packs(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_parent_contract_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_parent_contract_id_foreign FOREIGN KEY (parent_contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_prestation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES public.prestations(id) ON DELETE SET NULL;


--
-- Name: countries countries_organization_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_organization_id_foreign FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: course_course_category course_course_category_course_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_course_category
    ADD CONSTRAINT course_course_category_course_category_id_foreign FOREIGN KEY (course_category_id) REFERENCES public.course_categories(id) ON DELETE CASCADE;


--
-- Name: course_course_category course_course_category_course_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_course_category
    ADD CONSTRAINT course_course_category_course_id_foreign FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_modules course_modules_course_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_modules
    ADD CONSTRAINT course_modules_course_id_foreign FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_modules course_modules_trainer_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_modules
    ADD CONSTRAINT course_modules_trainer_id_foreign FOREIGN KEY (trainer_id) REFERENCES public.trainers(id) ON DELETE SET NULL;


--
-- Name: courses courses_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: daily_balances daily_balances_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_balances
    ADD CONSTRAINT daily_balances_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: department_chiefs department_chiefs_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_chiefs
    ADD CONSTRAINT department_chiefs_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: department_chiefs department_chiefs_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_chiefs
    ADD CONSTRAINT department_chiefs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: departments departments_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_ad_campaign_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_ad_campaign_id_foreign FOREIGN KEY (ad_campaign_id) REFERENCES public.ad_campaigns(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_approved_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_approved_by_foreign FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_cancelled_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_cancelled_by_foreign FOREIGN KEY (cancelled_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.accounting_categories(id) ON DELETE RESTRICT;


--
-- Name: expenses expenses_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_country_id_foreign FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_paid_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_paid_by_foreign FOREIGN KEY (paid_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_rejected_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_rejected_by_foreign FOREIGN KEY (rejected_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_requested_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_requested_by_foreign FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: expenses expenses_treasury_account_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_treasury_account_id_foreign FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;


--
-- Name: formation_enrollments formation_enrollments_course_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formation_enrollments
    ADD CONSTRAINT formation_enrollments_course_id_foreign FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: formation_enrollments formation_enrollments_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formation_enrollments
    ADD CONSTRAINT formation_enrollments_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: formation_enrollments formation_enrollments_learner_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formation_enrollments
    ADD CONSTRAINT formation_enrollments_learner_user_id_foreign FOREIGN KEY (learner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: formation_enrollments formation_enrollments_requested_session_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formation_enrollments
    ADD CONSTRAINT formation_enrollments_requested_session_id_foreign FOREIGN KEY (requested_session_id) REFERENCES public.training_sessions(id) ON DELETE SET NULL;


--
-- Name: formation_enrollments formation_enrollments_seller_trainer_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formation_enrollments
    ADD CONSTRAINT formation_enrollments_seller_trainer_id_foreign FOREIGN KEY (seller_trainer_id) REFERENCES public.trainers(id) ON DELETE SET NULL;


--
-- Name: formation_enrollments formation_enrollments_seller_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formation_enrollments
    ADD CONSTRAINT formation_enrollments_seller_user_id_foreign FOREIGN KEY (seller_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_package_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_package_id_foreign FOREIGN KEY (package_id) REFERENCES public.subscription_packs(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_prestation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES public.prestations(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_product_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: invoice_payments invoice_payments_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_payments invoice_payments_received_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_received_by_foreign FOREIGN KEY (received_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoice_payments invoice_payments_treasury_account_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payments
    ADD CONSTRAINT invoice_payments_treasury_account_id_foreign FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_client_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_foreign FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES public.commercials(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_contract_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contract_id_foreign FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_seller_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_seller_user_id_foreign FOREIGN KEY (seller_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_validated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_validated_by_foreign FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: learner_observations learner_observations_author_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_author_user_id_foreign FOREIGN KEY (author_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: learner_observations learner_observations_course_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_course_id_foreign FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: learner_observations learner_observations_course_module_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_course_module_id_foreign FOREIGN KEY (course_module_id) REFERENCES public.course_modules(id) ON DELETE CASCADE;


--
-- Name: learner_observations learner_observations_learner_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_learner_user_id_foreign FOREIGN KEY (learner_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: learner_observations learner_observations_session_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learner_observations
    ADD CONSTRAINT learner_observations_session_id_foreign FOREIGN KEY (session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE;


--
-- Name: login_logs login_logs_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: opportunities opportunities_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: opportunities opportunities_client_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_client_id_foreign FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: opportunities opportunities_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES public.commercials(id) ON DELETE CASCADE;


--
-- Name: opportunities opportunities_company_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_company_id_foreign FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: opportunities opportunities_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: opportunities opportunities_prospect_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_prospect_id_foreign FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;


--
-- Name: order_lines order_lines_order_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_order_id_foreign FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_lines order_lines_product_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_lines order_lines_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_lines
    ADD CONSTRAINT order_lines_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: orders orders_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: orders orders_client_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_client_id_foreign FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES public.commercials(id) ON DELETE SET NULL;


--
-- Name: orders orders_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: package_items package_items_package_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_items
    ADD CONSTRAINT package_items_package_id_foreign FOREIGN KEY (package_id) REFERENCES public.subscription_packs(id) ON DELETE CASCADE;


--
-- Name: package_items package_items_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_items
    ADD CONSTRAINT package_items_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: package_recommendations package_recommendations_client_team_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_recommendations
    ADD CONSTRAINT package_recommendations_client_team_role_id_foreign FOREIGN KEY (client_team_role_id) REFERENCES public.client_team_roles(id) ON DELETE SET NULL;


--
-- Name: package_recommendations package_recommendations_package_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_recommendations
    ADD CONSTRAINT package_recommendations_package_id_foreign FOREIGN KEY (package_id) REFERENCES public.subscription_packs(id) ON DELETE CASCADE;


--
-- Name: payment_proofs payment_proofs_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_proofs
    ADD CONSTRAINT payment_proofs_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: payment_proofs payment_proofs_reviewed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_proofs
    ADD CONSTRAINT payment_proofs_reviewed_by_foreign FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: payment_proofs payment_proofs_submitted_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_proofs
    ADD CONSTRAINT payment_proofs_submitted_by_foreign FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestation_action_comments prestation_action_comments_prestation_action_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_comments
    ADD CONSTRAINT prestation_action_comments_prestation_action_id_foreign FOREIGN KEY (prestation_action_id) REFERENCES public.prestation_actions(id) ON DELETE CASCADE;


--
-- Name: prestation_action_comments prestation_action_comments_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_comments
    ADD CONSTRAINT prestation_action_comments_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestation_action_executions prestation_action_executions_assigned_to_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_executions
    ADD CONSTRAINT prestation_action_executions_assigned_to_foreign FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestation_action_executions prestation_action_executions_prestation_action_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_executions
    ADD CONSTRAINT prestation_action_executions_prestation_action_id_foreign FOREIGN KEY (prestation_action_id) REFERENCES public.prestation_actions(id) ON DELETE CASCADE;


--
-- Name: prestation_action_executions prestation_action_executions_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_executions
    ADD CONSTRAINT prestation_action_executions_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestation_action_logs prestation_action_logs_prestation_action_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_logs
    ADD CONSTRAINT prestation_action_logs_prestation_action_id_foreign FOREIGN KEY (prestation_action_id) REFERENCES public.prestation_actions(id) ON DELETE CASCADE;


--
-- Name: prestation_action_logs prestation_action_logs_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_logs
    ADD CONSTRAINT prestation_action_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestation_action_reviews prestation_action_reviews_client_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_reviews
    ADD CONSTRAINT prestation_action_reviews_client_user_id_foreign FOREIGN KEY (client_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: prestation_action_reviews prestation_action_reviews_prestation_action_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_reviews
    ADD CONSTRAINT prestation_action_reviews_prestation_action_id_foreign FOREIGN KEY (prestation_action_id) REFERENCES public.prestation_actions(id) ON DELETE CASCADE;


--
-- Name: prestation_action_reviews prestation_action_reviews_prestation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_action_reviews
    ADD CONSTRAINT prestation_action_reviews_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES public.prestations(id) ON DELETE CASCADE;


--
-- Name: prestation_actions prestation_actions_assigned_to_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_actions
    ADD CONSTRAINT prestation_actions_assigned_to_foreign FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestation_actions prestation_actions_package_item_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_actions
    ADD CONSTRAINT prestation_actions_package_item_id_foreign FOREIGN KEY (package_item_id) REFERENCES public.package_items(id) ON DELETE SET NULL;


--
-- Name: prestation_actions prestation_actions_prestation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_actions
    ADD CONSTRAINT prestation_actions_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES public.prestations(id) ON DELETE CASCADE;


--
-- Name: prestation_offers prestation_offers_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_offers
    ADD CONSTRAINT prestation_offers_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: prestation_offers prestation_offers_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_offers
    ADD CONSTRAINT prestation_offers_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.agency_categories(id) ON DELETE SET NULL;


--
-- Name: prestation_offers prestation_offers_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_offers
    ADD CONSTRAINT prestation_offers_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestation_offers prestation_offers_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_offers
    ADD CONSTRAINT prestation_offers_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: prestation_team_members prestation_team_members_client_team_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_team_members
    ADD CONSTRAINT prestation_team_members_client_team_role_id_foreign FOREIGN KEY (client_team_role_id) REFERENCES public.client_team_roles(id) ON DELETE SET NULL;


--
-- Name: prestation_team_members prestation_team_members_prestation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_team_members
    ADD CONSTRAINT prestation_team_members_prestation_id_foreign FOREIGN KEY (prestation_id) REFERENCES public.prestations(id) ON DELETE CASCADE;


--
-- Name: prestation_team_members prestation_team_members_team_member_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_team_members
    ADD CONSTRAINT prestation_team_members_team_member_id_foreign FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: prestation_team_members prestation_team_members_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestation_team_members
    ADD CONSTRAINT prestation_team_members_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: prestations prestations_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: prestations prestations_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.agency_categories(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_client_direct_rated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_client_direct_rated_by_foreign FOREIGN KEY (client_direct_rated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_client_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_client_id_foreign FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: prestations prestations_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES public.commercials(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_company_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_company_id_foreign FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_contract_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_contract_id_foreign FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_offer_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_offer_id_foreign FOREIGN KEY (offer_id) REFERENCES public.prestation_offers(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_package_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_package_id_foreign FOREIGN KEY (package_id) REFERENCES public.subscription_packs(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_payment_proof_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_payment_proof_id_foreign FOREIGN KEY (payment_proof_id) REFERENCES public.payment_proofs(id) ON DELETE SET NULL;


--
-- Name: prestations prestations_validated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestations
    ADD CONSTRAINT prestations_validated_by_foreign FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: price_history price_history_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: products products_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: promotions promotions_formation_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_formation_id_foreign FOREIGN KEY (formation_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: promotions promotions_package_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_package_id_foreign FOREIGN KEY (package_id) REFERENCES public.subscription_packs(id) ON DELETE CASCADE;


--
-- Name: promotions promotions_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: prospects prospects_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: prospects prospects_commercial_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_commercial_id_foreign FOREIGN KEY (commercial_id) REFERENCES public.commercials(id) ON DELETE CASCADE;


--
-- Name: prospects prospects_company_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_company_id_foreign FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: prospects prospects_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: role_permission role_permission_permission_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permission role_permission_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT role_permission_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: seller_profiles seller_profiles_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_profiles
    ADD CONSTRAINT seller_profiles_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: seller_profiles seller_profiles_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_profiles
    ADD CONSTRAINT seller_profiles_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: seminar_tiers seminar_tiers_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seminar_tiers
    ADD CONSTRAINT seminar_tiers_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: services services_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: services services_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: session_module_trainers session_module_trainers_course_module_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_module_trainers
    ADD CONSTRAINT session_module_trainers_course_module_id_foreign FOREIGN KEY (course_module_id) REFERENCES public.course_modules(id) ON DELETE CASCADE;


--
-- Name: session_module_trainers session_module_trainers_trainer_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_module_trainers
    ADD CONSTRAINT session_module_trainers_trainer_id_foreign FOREIGN KEY (trainer_id) REFERENCES public.trainers(id) ON DELETE CASCADE;


--
-- Name: session_module_trainers session_module_trainers_training_session_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_module_trainers
    ADD CONSTRAINT session_module_trainers_training_session_id_foreign FOREIGN KEY (training_session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE;


--
-- Name: session_participants session_participants_formation_enrollment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_participants
    ADD CONSTRAINT session_participants_formation_enrollment_id_foreign FOREIGN KEY (formation_enrollment_id) REFERENCES public.formation_enrollments(id) ON DELETE CASCADE;


--
-- Name: session_participants session_participants_training_session_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_participants
    ADD CONSTRAINT session_participants_training_session_id_foreign FOREIGN KEY (training_session_id) REFERENCES public.training_sessions(id) ON DELETE CASCADE;


--
-- Name: settings settings_updated_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_updated_by_foreign FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: subscription_notifications subscription_notifications_subscription_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_notifications
    ADD CONSTRAINT subscription_notifications_subscription_id_foreign FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_pack_services subscription_pack_services_service_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pack_services
    ADD CONSTRAINT subscription_pack_services_service_id_foreign FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: subscription_pack_services subscription_pack_services_subscription_pack_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_pack_services
    ADD CONSTRAINT subscription_pack_services_subscription_pack_id_foreign FOREIGN KEY (subscription_pack_id) REFERENCES public.subscription_packs(id) ON DELETE CASCADE;


--
-- Name: subscription_packs subscription_packs_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_packs
    ADD CONSTRAINT subscription_packs_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: subscription_packs subscription_packs_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_packs
    ADD CONSTRAINT subscription_packs_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.agency_categories(id) ON DELETE SET NULL;


--
-- Name: subscription_packs subscription_packs_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_packs
    ADD CONSTRAINT subscription_packs_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_client_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_client_id_foreign FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_subscription_pack_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subscription_pack_id_foreign FOREIGN KEY (subscription_pack_id) REFERENCES public.subscription_packs(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: team_members team_members_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: team_members team_members_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: trainer_points trainer_points_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_points
    ADD CONSTRAINT trainer_points_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: trainer_points trainer_points_invoice_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_points
    ADD CONSTRAINT trainer_points_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: trainer_points trainer_points_trainer_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_points
    ADD CONSTRAINT trainer_points_trainer_id_foreign FOREIGN KEY (trainer_id) REFERENCES public.trainers(id) ON DELETE CASCADE;


--
-- Name: trainers trainers_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainers
    ADD CONSTRAINT trainers_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: trainers trainers_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainers
    ADD CONSTRAINT trainers_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: training_sessions training_sessions_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: training_sessions training_sessions_course_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_course_id_foreign FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: training_sessions training_sessions_module_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_module_id_foreign FOREIGN KEY (module_id) REFERENCES public.course_modules(id) ON DELETE SET NULL;


--
-- Name: training_sessions training_sessions_trainer_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_trainer_id_foreign FOREIGN KEY (trainer_id) REFERENCES public.trainers(id) ON DELETE SET NULL;


--
-- Name: treasury_accounts treasury_accounts_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts
    ADD CONSTRAINT treasury_accounts_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: treasury_accounts treasury_accounts_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_accounts
    ADD CONSTRAINT treasury_accounts_country_id_foreign FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: treasury_transactions treasury_transactions_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: treasury_transactions treasury_transactions_treasury_account_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_treasury_account_id_foreign FOREIGN KEY (treasury_account_id) REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT;


--
-- Name: user_assignments user_assignments_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: user_assignments user_assignments_department_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_department_id_foreign FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: user_assignments user_assignments_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_assignments
    ADD CONSTRAINT user_assignments_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_city_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_city_id_foreign FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;


--
-- Name: users users_client_category_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_client_category_id_foreign FOREIGN KEY (client_category_id) REFERENCES public.client_categories(id) ON DELETE SET NULL;


--
-- Name: users users_commercial_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_commercial_user_id_foreign FOREIGN KEY (commercial_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_country_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_country_id_foreign FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: users users_registered_agency_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_registered_agency_id_foreign FOREIGN KEY (registered_agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: users users_role_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--



-- Droits de l'utilisateur applicatif du site de test (cf. piège #3.3).
GRANT USAGE ON SCHEMA public TO sc1fopa5058_test;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sc1fopa5058_test;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sc1fopa5058_test;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO sc1fopa5058_test;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO sc1fopa5058_test;
