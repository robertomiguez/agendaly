CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE public.plan_status AS ENUM (
    'active',
    'coming_soon',
    'legacy',
    'archived'
);


ALTER TYPE public.plan_status OWNER TO postgres;

--
-- TOC entry 495 (class 1255 OID 112366)
-- Name: check_plan_archive(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_plan_archive() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  -- If status is changing to 'archived'
  IF NEW.status = 'archived' AND OLD.status != 'archived' THEN
    -- Check if there are any active subscriptions linked to this plan
    IF EXISTS (
      SELECT 1 FROM public.subscriptions 
      WHERE plan_id = NEW.id 
      AND status IN ('active', 'trialing', 'past_due')
    ) THEN
      RAISE EXCEPTION 'Cannot archive a plan that has active subscriptions.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_plan_archive() OWNER TO postgres;

--
-- TOC entry 661 (class 1255 OID 110146)
-- Name: check_plan_limits(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_plan_limits() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_provider_id uuid;
  v_plan_limits record;
  v_current_count integer;
  v_resource_type text;
begin
  -- Determine resource type and provider_id based on table
  if TG_TABLE_NAME = 'service_staff' or TG_TABLE_NAME = 'staff' then
    v_resource_type := 'staff';
    v_provider_id := NEW.provider_id;
  elsif TG_TABLE_NAME = 'services' then
    v_resource_type := 'services';
    v_provider_id := NEW.provider_id;
  elsif TG_TABLE_NAME = 'provider_addresses' then
    v_resource_type := 'locations';
    v_provider_id := NEW.provider_id;
  else
    return NEW;
  end if;

  -- Bypass if provider_id is null (should normally not happen for these resources)
  if v_provider_id is null then
    return NEW;
  end if;

  -- Get active plan limits for the provider
  select 
    p.max_staff,
    p.max_services,
    p.max_locations,
    p.display_name
  into v_plan_limits
  from subscriptions s
  join plans p on s.plan_id = p.id
  where s.provider_id = v_provider_id
  and s.status in ('active', 'trialing')
  order by s.created_at desc
  limit 1;

  -- If no subscription found, block (or allow if you have a default free tier logic)
  if not found then
    raise exception 'No active subscription found for provider.';
  end if;

  -- Check Limits based on resource type
  if v_resource_type = 'staff' and v_plan_limits.max_staff is not null then
    select count(*) into v_current_count from staff where provider_id = v_provider_id and active = true;
    if v_current_count >= v_plan_limits.max_staff then
      raise exception 'Plan limit reached: % allows maximum % staff members.', v_plan_limits.display_name, v_plan_limits.max_staff;
    end if;
  end if;

  if v_resource_type = 'services' and v_plan_limits.max_services is not null then
    select count(*) into v_current_count from services where provider_id = v_provider_id and active = true;
    if v_current_count >= v_plan_limits.max_services then
      raise exception 'Plan limit reached: % allows maximum % services.', v_plan_limits.display_name, v_plan_limits.max_services;
    end if;
  end if;

  if v_resource_type = 'locations' and v_plan_limits.max_locations is not null then
    select count(*) into v_current_count from provider_addresses where provider_id = v_provider_id;
    if v_current_count >= v_plan_limits.max_locations then
      raise exception 'Plan limit reached: % allows maximum % locations.', v_plan_limits.display_name, v_plan_limits.max_locations;
    end if;
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION public.check_plan_limits() OWNER TO postgres;

--
-- TOC entry 673 (class 1255 OID 96576)
-- Name: cleanup_old_debug_logs(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_debug_logs() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.debug_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;


ALTER FUNCTION public.cleanup_old_debug_logs() OWNER TO postgres;

--
-- TOC entry 693 (class 1255 OID 21161)
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    user_email TEXT;
    is_admin BOOLEAN;
    is_provider BOOLEAN;
BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    
    SELECT EXISTS (
        SELECT 1 FROM public.staff
        WHERE staff.email = user_email
        AND staff.role = 'admin'
        AND staff.active = true
    ) INTO is_admin;
    
    IF is_admin THEN
        RETURN 'admin';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM public.providers
        WHERE auth_user_id = auth.uid()
        AND status = 'approved'
    ) INTO is_provider;
    
    IF is_provider THEN
        RETURN 'provider';
    END IF;
    
    RETURN 'customer';
END;
$$;


ALTER FUNCTION public.get_user_role() OWNER TO postgres;

--
-- TOC entry 637 (class 1255 OID 21149)
-- Name: trigger_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_set_updated_at() OWNER TO postgres;

--
-- TOC entry 630 (class 1255 OID 17577)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- TOC entry 426 (class 1255 OID 25313)
-- Name: user_owns_provider(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_owns_provider(provider_uuid uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.providers
    WHERE id = provider_uuid
    AND auth_user_id::text = auth.uid()::text
  );
END;
$$;


ALTER FUNCTION public.user_owns_provider(provider_uuid uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 385 (class 1259 OID 18798)
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    service_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    appointment_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    address_id uuid,
    booked_price numeric(10,2),
    CONSTRAINT appointments_check CHECK ((end_time > start_time)),
    CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'pending'::text, 'cancelled'::text, 'no-show'::text, 'completed'::text])))
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- TOC entry 4431 (class 0 OID 0)
-- Dependencies: 385
-- Name: COLUMN appointments.booked_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appointments.booked_price IS 'Service price locked at time of booking';


--
-- TOC entry 383 (class 1259 OID 18769)
-- Name: availability; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.availability (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    staff_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_available boolean DEFAULT true,
    provider_id uuid,
    CONSTRAINT availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


ALTER TABLE public.availability OWNER TO postgres;

--
-- TOC entry 384 (class 1259 OID 18784)
-- Name: blocked_dates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blocked_dates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    staff_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    provider_id uuid,
    start_time time without time zone,
    end_time time without time zone,
    recurrence_rule text,
    title text,
    CONSTRAINT blocked_dates_check CHECK ((end_date >= start_date))
);


ALTER TABLE public.blocked_dates OWNER TO postgres;

--
-- TOC entry 387 (class 1259 OID 23055)
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- TOC entry 380 (class 1259 OID 18719)
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    auth_user_id uuid,
    email text NOT NULL,
    name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 397 (class 1259 OID 93083)
-- Name: debug_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.debug_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.debug_logs OWNER TO postgres;

--
-- TOC entry 396 (class 1259 OID 87521)
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'usd'::text,
    status text NOT NULL,
    payment_method text,
    stripe_payment_intent_id text,
    invoice_url text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    description text
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- TOC entry 4432 (class 0 OID 0)
-- Dependencies: 396
-- Name: COLUMN payments.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payments.description IS 'Human-readable description of the payment';


--
-- TOC entry 394 (class 1259 OID 87484)
-- Name: plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    price_yearly numeric(10,2),
    max_staff integer,
    max_locations integer,
    max_services integer,
    features jsonb DEFAULT '[]'::jsonb,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    discount_percent integer DEFAULT 0,
    discount_duration_months integer DEFAULT 0,
    prices jsonb DEFAULT '{}'::jsonb,
    status public.plan_status DEFAULT 'coming_soon'::public.plan_status NOT NULL
);


ALTER TABLE public.plans OWNER TO postgres;

--
-- TOC entry 388 (class 1259 OID 25318)
-- Name: provider_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid NOT NULL,
    label character varying(100),
    street_address text NOT NULL,
    street_address_2 text,
    city text NOT NULL,
    state text,
    postal_code text NOT NULL,
    country text DEFAULT 'USA'::text,
    is_primary boolean DEFAULT false,
    latitude numeric(10,8),
    longitude numeric(11,8),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.provider_addresses OWNER TO postgres;

--
-- TOC entry 4433 (class 0 OID 0)
-- Dependencies: 388
-- Name: TABLE provider_addresses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.provider_addresses IS 'Service locations for providers - supports multiple addresses per provider';


--
-- TOC entry 4434 (class 0 OID 0)
-- Dependencies: 388
-- Name: COLUMN provider_addresses.is_primary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.provider_addresses.is_primary IS 'One address should be marked as primary/default location';


--
-- TOC entry 4435 (class 0 OID 0)
-- Dependencies: 388
-- Name: COLUMN provider_addresses.latitude; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.provider_addresses.latitude IS 'Latitude coordinate for mapping (optional)';


--
-- TOC entry 4436 (class 0 OID 0)
-- Dependencies: 388
-- Name: COLUMN provider_addresses.longitude; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.provider_addresses.longitude IS 'Longitude coordinate for mapping (optional)';


--
-- TOC entry 386 (class 1259 OID 21098)
-- Name: providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid,
    business_name text NOT NULL,
    email text NOT NULL,
    phone text,
    description text,
    avatar_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    logo_url text,
    logo_path text,
    active boolean DEFAULT true NOT NULL,
    subscription_id uuid,
    CONSTRAINT providers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])))
);


ALTER TABLE public.providers OWNER TO postgres;

--
-- TOC entry 4437 (class 0 OID 0)
-- Dependencies: 386
-- Name: TABLE providers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.providers IS 'Service providers who register and manage their own services';


--
-- TOC entry 4438 (class 0 OID 0)
-- Dependencies: 386
-- Name: COLUMN providers.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.providers.status IS 'Provider status: pending (awaiting approval), approved (active), rejected, suspended';


--
-- TOC entry 4439 (class 0 OID 0)
-- Dependencies: 386
-- Name: COLUMN providers.approved_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.providers.approved_by IS 'Staff member who approved this provider';


--
-- TOC entry 392 (class 1259 OID 85169)
-- Name: service_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    url text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.service_images OWNER TO postgres;

--
-- TOC entry 390 (class 1259 OID 41001)
-- Name: service_staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.service_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.service_staff OWNER TO postgres;

--
-- TOC entry 381 (class 1259 OID 18738)
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    duration integer NOT NULL,
    price numeric(10,2) DEFAULT NULL::numeric,
    buffer_before integer DEFAULT 0,
    buffer_after integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    provider_id uuid,
    description text,
    image_url text,
    category_id uuid,
    CONSTRAINT services_buffer_after_check CHECK ((buffer_after >= 0)),
    CONSTRAINT services_buffer_before_check CHECK ((buffer_before >= 0)),
    CONSTRAINT services_duration_check CHECK ((duration > 0))
);


ALTER TABLE public.services OWNER TO postgres;

--
-- TOC entry 382 (class 1259 OID 18755)
-- Name: staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    provider_id uuid,
    CONSTRAINT staff_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text])))
);


ALTER TABLE public.staff OWNER TO postgres;

--
-- TOC entry 391 (class 1259 OID 61716)
-- Name: staff_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    address_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.staff_addresses OWNER TO postgres;

--
-- TOC entry 395 (class 1259 OID 87499)
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_id uuid,
    plan_id uuid,
    status text DEFAULT 'trialing'::text NOT NULL,
    trial_ends_at timestamp with time zone,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    cancelled_at timestamp with time zone,
    stripe_subscription_id text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    discount_ends_at timestamp with time zone,
    locked_price numeric,
    locked_discount_percent integer,
    pending_downgrade_plan_id uuid,
    trial_plan_change_count integer DEFAULT 0,
    currency text DEFAULT 'usd'::text
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- TOC entry 398 (class 1259 OID 94197)
-- Name: user_agreements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_agreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    agreement_type text NOT NULL,
    version text NOT NULL,
    ip_address text,
    user_agent text,
    accepted_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_agreements OWNER TO postgres;

    
ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- TOC entry 4080 (class 2606 OID 18776)
-- Name: availability availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_pkey PRIMARY KEY (id);


--
-- TOC entry 4082 (class 2606 OID 18778)
-- Name: availability availability_staff_id_day_of_week_start_time_end_time_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_staff_id_day_of_week_start_time_end_time_key UNIQUE (staff_id, day_of_week, start_time, end_time);


--
-- TOC entry 4086 (class 2606 OID 18792)
-- Name: blocked_dates blocked_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_dates
    ADD CONSTRAINT blocked_dates_pkey PRIMARY KEY (id);


--
-- TOC entry 4109 (class 2606 OID 23065)
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- TOC entry 4111 (class 2606 OID 23063)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4063 (class 2606 OID 18732)
-- Name: customers customers_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_auth_user_id_key UNIQUE (auth_user_id);


--
-- TOC entry 4065 (class 2606 OID 18730)
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- TOC entry 4067 (class 2606 OID 18728)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 4143 (class 2606 OID 93091)
-- Name: debug_logs debug_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debug_logs
    ADD CONSTRAINT debug_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4098 (class 2606 OID 95397)
-- Name: appointments no_overlapping_appointments; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT no_overlapping_appointments EXCLUDE USING gist (staff_id WITH =, appointment_date WITH =, tsrange((appointment_date + start_time), (appointment_date + end_time), '[)'::text) WITH &&) WHERE ((status <> 'cancelled'::text));


--
-- TOC entry 4141 (class 2606 OID 87530)
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- TOC entry 4130 (class 2606 OID 87498)
-- Name: plans plans_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_name_key UNIQUE (name);


--
-- TOC entry 4132 (class 2606 OID 87496)
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- TOC entry 4115 (class 2606 OID 25329)
-- Name: provider_addresses provider_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_addresses
    ADD CONSTRAINT provider_addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 4105 (class 2606 OID 21111)
-- Name: providers providers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_email_key UNIQUE (email);


--
-- TOC entry 4107 (class 2606 OID 21109)
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- TOC entry 4128 (class 2606 OID 85178)
-- Name: service_images service_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_images
    ADD CONSTRAINT service_images_pkey PRIMARY KEY (id);


--
-- TOC entry 4118 (class 2606 OID 41007)
-- Name: service_staff service_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_pkey PRIMARY KEY (id);


--
-- TOC entry 4120 (class 2606 OID 41009)
-- Name: service_staff service_staff_service_id_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_service_id_staff_id_key UNIQUE (service_id, staff_id);


--
-- TOC entry 4073 (class 2606 OID 18754)
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- TOC entry 4123 (class 2606 OID 61722)
-- Name: staff_addresses staff_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_addresses
    ADD CONSTRAINT staff_addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 4125 (class 2606 OID 61724)
-- Name: staff_addresses staff_addresses_staff_id_address_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_addresses
    ADD CONSTRAINT staff_addresses_staff_id_address_id_key UNIQUE (staff_id, address_id);


--
-- TOC entry 4076 (class 2606 OID 18768)
-- Name: staff staff_provider_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_provider_email_key UNIQUE (provider_id, email);


--
-- TOC entry 4078 (class 2606 OID 18766)
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- TOC entry 4138 (class 2606 OID 87510)
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- TOC entry 4146 (class 2606 OID 94205)
-- Name: user_agreements user_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_agreements
    ADD CONSTRAINT user_agreements_pkey PRIMARY KEY (id);


--
-- TOC entry 4091 (class 1259 OID 96515)
-- Name: idx_appointments_address_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_address_id ON public.appointments USING btree (address_id);


--
-- TOC entry 4092 (class 1259 OID 18828)
-- Name: idx_appointments_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_customer ON public.appointments USING btree (customer_id);


--
-- TOC entry 4093 (class 1259 OID 18829)
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (appointment_date);


--
-- TOC entry 4094 (class 1259 OID 96516)
-- Name: idx_appointments_service_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_service_id ON public.appointments USING btree (service_id);


--
-- TOC entry 4095 (class 1259 OID 18830)
-- Name: idx_appointments_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_staff ON public.appointments USING btree (staff_id);


--
-- TOC entry 4096 (class 1259 OID 18831)
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);


--
-- TOC entry 4083 (class 1259 OID 21142)
-- Name: idx_availability_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_availability_provider_id ON public.availability USING btree (provider_id);


--
-- TOC entry 4084 (class 1259 OID 18832)
-- Name: idx_availability_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_availability_staff ON public.availability USING btree (staff_id);


--
-- TOC entry 4087 (class 1259 OID 21148)
-- Name: idx_blocked_dates_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocked_dates_provider_id ON public.blocked_dates USING btree (provider_id);


--
-- TOC entry 4088 (class 1259 OID 18833)
-- Name: idx_blocked_dates_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blocked_dates_staff ON public.blocked_dates USING btree (staff_id);


--
-- TOC entry 4068 (class 1259 OID 18826)
-- Name: idx_customers_auth_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_auth_user ON public.customers USING btree (auth_user_id);


--
-- TOC entry 4069 (class 1259 OID 18827)
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- TOC entry 4139 (class 1259 OID 87547)
-- Name: idx_payments_subscription_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_subscription_id ON public.payments USING btree (subscription_id);


--
-- TOC entry 4112 (class 1259 OID 25336)
-- Name: idx_provider_addresses_is_primary; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_provider_addresses_is_primary ON public.provider_addresses USING btree (provider_id, is_primary) WHERE (is_primary = true);


--
-- TOC entry 4113 (class 1259 OID 25335)
-- Name: idx_provider_addresses_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_provider_addresses_provider_id ON public.provider_addresses USING btree (provider_id);


--
-- TOC entry 4099 (class 1259 OID 96524)
-- Name: idx_providers_approved_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_providers_approved_by ON public.providers USING btree (approved_by);


--
-- TOC entry 4100 (class 1259 OID 21122)
-- Name: idx_providers_auth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_providers_auth_user_id ON public.providers USING btree (auth_user_id);


--
-- TOC entry 4101 (class 1259 OID 21124)
-- Name: idx_providers_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_providers_email ON public.providers USING btree (email);


--
-- TOC entry 4102 (class 1259 OID 21123)
-- Name: idx_providers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_providers_status ON public.providers USING btree (status);


--
-- TOC entry 4103 (class 1259 OID 87548)
-- Name: idx_providers_subscription_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_providers_subscription_id ON public.providers USING btree (subscription_id);


--
-- TOC entry 4126 (class 1259 OID 96521)
-- Name: idx_service_images_service_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_service_images_service_id ON public.service_images USING btree (service_id);


--
-- TOC entry 4116 (class 1259 OID 96520)
-- Name: idx_service_staff_staff_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_service_staff_staff_id ON public.service_staff USING btree (staff_id);


--
-- TOC entry 4070 (class 1259 OID 96517)
-- Name: idx_services_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_category_id ON public.services USING btree (category_id);


--
-- TOC entry 4071 (class 1259 OID 21136)
-- Name: idx_services_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_services_provider_id ON public.services USING btree (provider_id);


--
-- TOC entry 4121 (class 1259 OID 96522)
-- Name: idx_staff_addresses_address_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_addresses_address_id ON public.staff_addresses USING btree (address_id);


--
-- TOC entry 4074 (class 1259 OID 21130)
-- Name: idx_staff_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_provider_id ON public.staff USING btree (provider_id);


--
-- TOC entry 4133 (class 1259 OID 96519)
-- Name: idx_subscriptions_pending_downgrade_plan_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_pending_downgrade_plan_id ON public.subscriptions USING btree (pending_downgrade_plan_id);


--
-- TOC entry 4134 (class 1259 OID 96518)
-- Name: idx_subscriptions_plan_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_plan_id ON public.subscriptions USING btree (plan_id);


--
-- TOC entry 4135 (class 1259 OID 87545)
-- Name: idx_subscriptions_provider_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_provider_id ON public.subscriptions USING btree (provider_id);


--
-- TOC entry 4136 (class 1259 OID 87546)
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- TOC entry 4144 (class 1259 OID 96523)
-- Name: idx_user_agreements_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_agreements_user_id ON public.user_agreements USING btree (user_id);


--
-- TOC entry 4180 (class 2620 OID 110149)
-- Name: provider_addresses check_location_limit_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER check_location_limit_trigger BEFORE INSERT ON public.provider_addresses FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();


--
-- TOC entry 4182 (class 2620 OID 112367)
-- Name: plans check_plan_archive_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER check_plan_archive_trigger BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.check_plan_archive();


--
-- TOC entry 4174 (class 2620 OID 110148)
-- Name: services check_service_limit_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER check_service_limit_trigger BEFORE INSERT ON public.services FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();


--
-- TOC entry 4176 (class 2620 OID 110147)
-- Name: staff check_staff_limit_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER check_staff_limit_trigger BEFORE INSERT ON public.staff FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();


--
-- TOC entry 4181 (class 2620 OID 25343)
-- Name: provider_addresses set_provider_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_provider_addresses_updated_at BEFORE UPDATE ON public.provider_addresses FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- TOC entry 4179 (class 2620 OID 21150)
-- Name: providers set_providers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_providers_updated_at BEFORE UPDATE ON public.providers FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


--
-- TOC entry 4178 (class 2620 OID 18837)
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4173 (class 2620 OID 18834)
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4175 (class 2620 OID 18835)
-- Name: services update_services_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4177 (class 2620 OID 18836)
-- Name: staff update_staff_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4155 (class 2606 OID 61737)
-- Name: appointments appointments_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.provider_addresses(id);


--
-- TOC entry 4156 (class 2606 OID 18821)
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- TOC entry 4157 (class 2606 OID 18811)
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- TOC entry 4158 (class 2606 OID 18816)
-- Name: appointments appointments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- TOC entry 4151 (class 2606 OID 32142)
-- Name: availability availability_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 4152 (class 2606 OID 32147)
-- Name: availability availability_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- TOC entry 4153 (class 2606 OID 32137)
-- Name: blocked_dates blocked_dates_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_dates
    ADD CONSTRAINT blocked_dates_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 4154 (class 2606 OID 32132)
-- Name: blocked_dates blocked_dates_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blocked_dates
    ADD CONSTRAINT blocked_dates_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- TOC entry 4147 (class 2606 OID 18733)
-- Name: customers customers_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4171 (class 2606 OID 97763)
-- Name: payments payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE RESTRICT;


--
-- TOC entry 4162 (class 2606 OID 32127)
-- Name: provider_addresses provider_addresses_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_addresses
    ADD CONSTRAINT provider_addresses_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 4159 (class 2606 OID 21117)
-- Name: providers providers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff(id);


--
-- TOC entry 4160 (class 2606 OID 21112)
-- Name: providers providers_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4161 (class 2606 OID 87536)
-- Name: providers providers_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- TOC entry 4167 (class 2606 OID 97733)
-- Name: service_images service_images_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_images
    ADD CONSTRAINT service_images_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- TOC entry 4163 (class 2606 OID 97738)
-- Name: service_staff service_staff_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;


--
-- TOC entry 4164 (class 2606 OID 97743)
-- Name: service_staff service_staff_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.service_staff
    ADD CONSTRAINT service_staff_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- TOC entry 4148 (class 2606 OID 32112)
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- TOC entry 4149 (class 2606 OID 32117)
-- Name: services services_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 4165 (class 2606 OID 97753)
-- Name: staff_addresses staff_addresses_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_addresses
    ADD CONSTRAINT staff_addresses_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.provider_addresses(id) ON DELETE RESTRICT;


--
-- TOC entry 4166 (class 2606 OID 97748)
-- Name: staff_addresses staff_addresses_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_addresses
    ADD CONSTRAINT staff_addresses_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;


--
-- TOC entry 4150 (class 2606 OID 32122)
-- Name: staff staff_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 4168 (class 2606 OID 94214)
-- Name: subscriptions subscriptions_pending_downgrade_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pending_downgrade_plan_id_fkey FOREIGN KEY (pending_downgrade_plan_id) REFERENCES public.plans(id);


--
-- TOC entry 4169 (class 2606 OID 87516)
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- TOC entry 4170 (class 2606 OID 97758)
-- Name: subscriptions subscriptions_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE RESTRICT;


--
-- TOC entry 4172 (class 2606 OID 94206)
-- Name: user_agreements user_agreements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_agreements
    ADD CONSTRAINT user_agreements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- TOC entry 4355 (class 3256 OID 93093)
-- Name: debug_logs Allow all select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all select" ON public.debug_logs FOR SELECT USING (true);


--
-- TOC entry 4380 (class 3256 OID 96531)
-- Name: appointments Allow auth users to insert own appointments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow auth users to insert own appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.customers
  WHERE ((customers.id = appointments.customer_id) AND ((customers.auth_user_id)::text = (( SELECT auth.uid() AS uid))::text)))));


--
-- TOC entry 4378 (class 3256 OID 96530)
-- Name: appointments Allow authenticated users to update own appointments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users to update own appointments" ON public.appointments FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.customers
  WHERE ((customers.id = appointments.customer_id) AND ((customers.auth_user_id)::text = (( SELECT auth.uid() AS uid))::text)))) OR (EXISTS ( SELECT 1
   FROM (public.services
     JOIN public.providers ON ((services.provider_id = providers.id)))
  WHERE ((services.id = appointments.service_id) AND ((providers.auth_user_id)::text = (( SELECT auth.uid() AS uid))::text)))));


--
-- TOC entry 4362 (class 3256 OID 52783)
-- Name: appointments Allow public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read access" ON public.appointments FOR SELECT USING (true);


--
-- TOC entry 4393 (class 3256 OID 96552)
-- Name: provider_addresses Anyone can view approved provider addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view approved provider addresses" ON public.provider_addresses FOR SELECT TO authenticated, anon USING ((public.user_owns_provider(provider_id) OR (EXISTS ( SELECT 1
   FROM public.providers p
  WHERE ((p.id = provider_addresses.provider_id) AND (p.status = 'approved'::text))))));


--
-- TOC entry 4354 (class 3256 OID 87550)
-- Name: plans Anyone can view plans; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);


--
-- TOC entry 4376 (class 3256 OID 96550)
-- Name: customers Authenticated users can view allowed customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view allowed customers" ON public.customers FOR SELECT TO authenticated USING ((((( SELECT auth.uid() AS uid))::text = (auth_user_id)::text) OR (EXISTS ( SELECT 1
   FROM ((public.appointments a
     JOIN public.services s ON ((a.service_id = s.id)))
     JOIN public.providers p ON ((s.provider_id = p.id)))
  WHERE ((a.customer_id = customers.id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid)))))));


--
-- TOC entry 4367 (class 3256 OID 30965)
-- Name: availability Availability is viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Availability is viewable by everyone" ON public.availability FOR SELECT USING (true);


--
-- TOC entry 4368 (class 3256 OID 30966)
-- Name: blocked_dates Blocked dates are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Blocked dates are viewable by everyone" ON public.blocked_dates FOR SELECT USING (true);


--
-- TOC entry 4357 (class 3256 OID 96541)
-- Name: payments Providers can create own payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can create own payments" ON public.payments FOR INSERT TO authenticated WITH CHECK ((subscription_id IN ( SELECT subscriptions.id
   FROM public.subscriptions
  WHERE (subscriptions.provider_id IN ( SELECT providers.id
           FROM public.providers
          WHERE (providers.auth_user_id = ( SELECT auth.uid() AS uid)))))));


--
-- TOC entry 4373 (class 3256 OID 96548)
-- Name: subscriptions Providers can create own subscription; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can create own subscription" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK ((provider_id IN ( SELECT providers.id
   FROM public.providers
  WHERE (providers.auth_user_id = ( SELECT auth.uid() AS uid)))));


--
-- TOC entry 4383 (class 3256 OID 96573)
-- Name: service_images Providers can delete service images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can delete service images" ON public.service_images FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.services s
     JOIN public.providers p ON ((s.provider_id = p.id)))
  WHERE ((s.id = service_images.service_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4377 (class 3256 OID 96568)
-- Name: staff_addresses Providers can delete staff_addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can delete staff_addresses" ON public.staff_addresses FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.staff s
  WHERE ((s.id = staff_addresses.staff_id) AND public.user_owns_provider(s.provider_id)))));


--
-- TOC entry 4366 (class 3256 OID 96513)
-- Name: provider_addresses Providers can delete their own addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can delete their own addresses" ON public.provider_addresses FOR DELETE TO authenticated USING (public.user_owns_provider(provider_id));


--
-- TOC entry 4401 (class 3256 OID 33259)
-- Name: availability Providers can delete their own availability; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can delete their own availability" ON public.availability FOR DELETE TO authenticated USING (public.user_owns_provider(provider_id));


--
-- TOC entry 4372 (class 3256 OID 58356)
-- Name: blocked_dates Providers can delete their own blocked dates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can delete their own blocked dates" ON public.blocked_dates FOR DELETE TO authenticated USING (public.user_owns_provider(provider_id));


--
-- TOC entry 4388 (class 3256 OID 30986)
-- Name: services Providers can delete their own services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can delete their own services" ON public.services FOR DELETE TO authenticated USING (public.user_owns_provider(provider_id));


--
-- TOC entry 4385 (class 3256 OID 30982)
-- Name: staff Providers can delete their own staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can delete their own staff" ON public.staff FOR DELETE TO authenticated USING (public.user_owns_provider(provider_id));


--
-- TOC entry 4351 (class 3256 OID 96562)
-- Name: service_staff Providers can delete their service_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can delete their service_staff" ON public.service_staff FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.services s
     JOIN public.providers p ON ((s.provider_id = p.id)))
  WHERE ((s.id = service_staff.service_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4381 (class 3256 OID 96569)
-- Name: service_images Providers can insert service images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can insert service images" ON public.service_images FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.services s
     JOIN public.providers p ON ((s.provider_id = p.id)))
  WHERE ((s.id = service_images.service_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4364 (class 3256 OID 96511)
-- Name: provider_addresses Providers can insert their own addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can insert their own addresses" ON public.provider_addresses FOR INSERT TO authenticated WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4398 (class 3256 OID 33257)
-- Name: availability Providers can insert their own availability; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can insert their own availability" ON public.availability FOR INSERT TO authenticated WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4370 (class 3256 OID 58354)
-- Name: blocked_dates Providers can insert their own blocked dates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can insert their own blocked dates" ON public.blocked_dates FOR INSERT TO authenticated WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4390 (class 3256 OID 30988)
-- Name: services Providers can insert their own services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can insert their own services" ON public.services FOR INSERT TO authenticated WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4386 (class 3256 OID 30983)
-- Name: staff Providers can insert their own staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can insert their own staff" ON public.staff FOR INSERT TO authenticated WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4359 (class 3256 OID 96566)
-- Name: staff_addresses Providers can manage staff_addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can manage staff_addresses" ON public.staff_addresses FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.staff s
  WHERE ((s.id = staff_addresses.staff_id) AND public.user_owns_provider(s.provider_id)))));


--
-- TOC entry 4349 (class 3256 OID 96558)
-- Name: service_staff Providers can manage their service_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can manage their service_staff" ON public.service_staff FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.services s
     JOIN public.providers p ON ((s.provider_id = p.id)))
  WHERE ((s.id = service_staff.service_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4363 (class 3256 OID 96547)
-- Name: subscriptions Providers can update own subscription; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update own subscription" ON public.subscriptions FOR UPDATE TO authenticated USING ((provider_id IN ( SELECT providers.id
   FROM public.providers
  WHERE (providers.auth_user_id = ( SELECT auth.uid() AS uid)))));


--
-- TOC entry 4382 (class 3256 OID 96571)
-- Name: service_images Providers can update service images; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update service images" ON public.service_images FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.services s
     JOIN public.providers p ON ((s.provider_id = p.id)))
  WHERE ((s.id = service_images.service_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4360 (class 3256 OID 96567)
-- Name: staff_addresses Providers can update staff_addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update staff_addresses" ON public.staff_addresses FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.staff s
  WHERE ((s.id = staff_addresses.staff_id) AND public.user_owns_provider(s.provider_id)))));


--
-- TOC entry 4365 (class 3256 OID 96512)
-- Name: provider_addresses Providers can update their own addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update their own addresses" ON public.provider_addresses FOR UPDATE TO authenticated USING (public.user_owns_provider(provider_id)) WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4399 (class 3256 OID 33258)
-- Name: availability Providers can update their own availability; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update their own availability" ON public.availability FOR UPDATE TO authenticated USING (public.user_owns_provider(provider_id)) WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4371 (class 3256 OID 58355)
-- Name: blocked_dates Providers can update their own blocked dates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update their own blocked dates" ON public.blocked_dates FOR UPDATE TO authenticated USING (public.user_owns_provider(provider_id)) WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4391 (class 3256 OID 30989)
-- Name: services Providers can update their own services; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update their own services" ON public.services FOR UPDATE TO authenticated USING (public.user_owns_provider(provider_id)) WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4387 (class 3256 OID 30985)
-- Name: staff Providers can update their own staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update their own staff" ON public.staff FOR UPDATE TO authenticated USING (public.user_owns_provider(provider_id)) WITH CHECK (public.user_owns_provider(provider_id));


--
-- TOC entry 4350 (class 3256 OID 96560)
-- Name: service_staff Providers can update their service_staff; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can update their service_staff" ON public.service_staff FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.services s
     JOIN public.providers p ON ((s.provider_id = p.id)))
  WHERE ((s.id = service_staff.service_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))));


--
-- TOC entry 4356 (class 3256 OID 96540)
-- Name: payments Providers can view own payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can view own payments" ON public.payments FOR SELECT TO authenticated USING ((subscription_id IN ( SELECT subscriptions.id
   FROM public.subscriptions
  WHERE (subscriptions.provider_id IN ( SELECT providers.id
           FROM public.providers
          WHERE (providers.auth_user_id = ( SELECT auth.uid() AS uid)))))));


--
-- TOC entry 4361 (class 3256 OID 96546)
-- Name: subscriptions Providers can view own subscription; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Providers can view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING ((provider_id IN ( SELECT providers.id
   FROM public.providers
  WHERE (providers.auth_user_id = ( SELECT auth.uid() AS uid)))));


--
-- TOC entry 4369 (class 3256 OID 30967)
-- Name: categories Public categories are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public categories are viewable by everyone" ON public.categories FOR SELECT USING (true);


--
-- TOC entry 4379 (class 3256 OID 30977)
-- Name: providers Public providers are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public providers are viewable by everyone" ON public.providers FOR SELECT USING (true);


--
-- TOC entry 4389 (class 3256 OID 30987)
-- Name: services Public services are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public services are viewable by everyone" ON public.services FOR SELECT USING (true);


--
-- TOC entry 4400 (class 3256 OID 96553)
-- Name: service_images Service images are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service images are viewable by everyone" ON public.service_images FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4348 (class 3256 OID 96557)
-- Name: service_staff Service staff are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service staff are viewable by everyone" ON public.service_staff FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4358 (class 3256 OID 96565)
-- Name: staff_addresses Staff addresses are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff addresses are viewable by everyone" ON public.staff_addresses FOR SELECT TO authenticated, anon USING (true);


--
-- TOC entry 4353 (class 3256 OID 96564)
-- Name: staff Staff are viewable by everyone or own provider; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Staff are viewable by everyone or own provider" ON public.staff FOR SELECT TO authenticated, anon USING (((active = true) OR public.user_owns_provider(provider_id)));


--
-- TOC entry 4397 (class 3256 OID 96539)
-- Name: providers Users can delete their own provider profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own provider profile" ON public.providers FOR DELETE TO authenticated USING (((( SELECT auth.uid() AS uid))::text = (auth_user_id)::text));


--
-- TOC entry 4384 (class 3256 OID 96533)
-- Name: customers Users can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile" ON public.customers FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid))::text = (auth_user_id)::text));


--
-- TOC entry 4395 (class 3256 OID 96537)
-- Name: providers Users can insert their own provider profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own provider profile" ON public.providers FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid))::text = (auth_user_id)::text));


--
-- TOC entry 4392 (class 3256 OID 96534)
-- Name: customers Users can update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own profile" ON public.customers FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid))::text = (auth_user_id)::text));


--
-- TOC entry 4396 (class 3256 OID 96538)
-- Name: providers Users can update their own provider profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own provider profile" ON public.providers FOR UPDATE TO authenticated USING (((( SELECT auth.uid() AS uid))::text = (auth_user_id)::text)) WITH CHECK (((( SELECT auth.uid() AS uid))::text = (auth_user_id)::text));


--
-- TOC entry 4374 (class 3256 OID 96549)
-- Name: user_agreements Users can view their own agreements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own agreements" ON public.user_agreements FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- TOC entry 4336 (class 0 OID 18798)
-- Dependencies: 385
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4334 (class 0 OID 18769)
-- Dependencies: 383
-- Name: availability; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4335 (class 0 OID 18784)
-- Dependencies: 384
-- Name: blocked_dates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4338 (class 0 OID 23055)
-- Dependencies: 387
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4331 (class 0 OID 18719)
-- Dependencies: 380
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4346 (class 0 OID 93083)
-- Dependencies: 397
-- Name: debug_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4345 (class 0 OID 87521)
-- Dependencies: 396
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4343 (class 0 OID 87484)
-- Dependencies: 394
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4339 (class 0 OID 25318)
-- Dependencies: 388
-- Name: provider_addresses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.provider_addresses ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4337 (class 0 OID 21098)
-- Dependencies: 386
-- Name: providers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4342 (class 0 OID 85169)
-- Dependencies: 392
-- Name: service_images; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.service_images ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4340 (class 0 OID 41001)
-- Dependencies: 390
-- Name: service_staff; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.service_staff ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4332 (class 0 OID 18738)
-- Dependencies: 381
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4333 (class 0 OID 18755)
-- Dependencies: 382
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4341 (class 0 OID 61716)
-- Dependencies: 391
-- Name: staff_addresses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.staff_addresses ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4344 (class 0 OID 87499)
-- Dependencies: 395
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 4347 (class 0 OID 94197)
-- Dependencies: 398
-- Name: user_agreements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

-- Completed on 2026-02-26 23:00:07 -03

--
-- PostgreSQL database dump complete
--

\unrestrict vUDAMEnEQX4GTXQAbUOj95WrtJV1zy3QkxNv354KJ5A7FcAeEcjs15ZefKCubk3

