-- ============================================================
-- PEKEGNO - Schema PostgreSQL complet (genere depuis les migrations Laravel)
-- Genere le 2026-09-17 - a executer UNE SEULE FOIS sur une base vide
--
-- Utilisation (o2switch, via phpPgAdmin -> onglet SQL, ou psql en SSH) :
--   psql -h HOTE -U sc1fopa5058_sc1fopa5058 -d sc1fopa5058_pekegno -f schema.sql
--
-- Ce fichier cree toutes les tables/contraintes de l'app + remplit la table
-- 'migrations' pour que 'php artisan migrate' sache que tout est deja applique
-- (sinon Laravel tenterait de rejouer les ~134 migrations et echouerait sur
-- des tables deja existantes).
-- ============================================================

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
    course_module_id uuid
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
    product_type character varying(20)
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
    payment_method character varying(30)
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
    course_id uuid
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
    deleted_at timestamp(0) without time zone
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
    updated_at timestamp(0) without time zone
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
    agency_id uuid NOT NULL,
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
    deleted_at timestamp(0) without time zone
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
    seller_trainer_id uuid
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
    product_id uuid
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
    treasury_account_id uuid
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
    updated_at timestamp(0) without time zone
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
    cover_image character varying(255)
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
    slug character varying(255)
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
    price_per_month numeric(12,2) DEFAULT '0'::numeric NOT NULL
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
    module_id uuid
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
    deleted_at timestamp(0) without time zone
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
    deleted_at timestamp(0) without time zone
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
    registered_at timestamp(0) without time zone
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
-- Name: attendances attendances_session_module_learner_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_session_module_learner_unique UNIQUE (training_session_id, course_module_id, learner_user_id);


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
-- Name: expenses_agency_id_expense_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_agency_id_expense_date_index ON public.expenses USING btree (agency_id, expense_date);


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
-- Name: invoices_agency_id_invoice_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_agency_id_invoice_date_index ON public.invoices USING btree (agency_id, invoice_date);


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
-- Name: products_agency_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_agency_id_index ON public.products USING btree (agency_id);


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



-- Marque toutes les migrations comme deja appliquees
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

SELECT setval(pg_get_serial_sequence('public.migrations','id'), (SELECT MAX(id) FROM public.migrations));
