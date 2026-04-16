export interface Category {
    id: string
    name: string
    created_at?: string
}

export interface ServiceImage {
    id: string
    service_id: string
    url: string
    display_order: number
    created_at?: string
}

export interface Service {
    id: string
    name: string
    duration: number // in minutes
    price?: number
    buffer_before: number
    buffer_after: number
    category_id?: string // References categories table
    categories?: Category // Joined data
    description?: string
    image_url?: string
    active: boolean
    provider_id?: string // References providers table
    created_at?: string
    updated_at?: string
    provider?: Provider // Joined data
    staff?: Staff[] // Joined data
    images?: ServiceImage[] // Joined data
}

export interface Customer {
    id: string
    auth_user_id?: string
    email: string
    name?: string
    phone?: string
    avatar_url?: string
    created_at?: string
    updated_at?: string
}

export type ProviderStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export interface Provider {
    id: string
    auth_user_id?: string
    business_name: string
    email: string
    phone?: string
    description?: string
    logo_url?: string
    logo_path?: string
    avatar_url?: string
    status: ProviderStatus
    approved_by?: string // References staff table
    approved_at?: string
    rejection_reason?: string
    created_at?: string
    updated_at?: string
    provider_addresses?: ProviderAddress[] // Joined data
}

export interface Staff {
    id: string
    name: string
    email: string
    role: 'admin' | 'staff'
    active: boolean
    provider_id?: string // References providers table
    photo_url?: string | null
    photo_path?: string | null
    created_at?: string
    updated_at?: string
    addresses?: ProviderAddress[] // Joined data via staff_addresses
}

export interface StaffAddress {
    id: string
    staff_id: string
    address_id: string
    created_at?: string
}

export interface ProviderAddress {
    id: string
    provider_id: string
    label?: string // e.g., "Main Location", "Downtown Branch"
    street_address: string
    street_address_2?: string // Apt, Suite, etc.
    city: string
    state?: string
    postal_code: string
    country: string
    is_primary: boolean
    latitude?: number
    longitude?: number
    photo_url?: string | null
    photo_path?: string | null
    created_at?: string
    updated_at?: string
}

export interface Availability {
    id: string
    staff_id: string
    provider_id?: string // References providers table
    day_of_week: number // 0-6 (Sunday-Saturday)
    start_time: string // HH:mm format
    end_time: string // HH:mm format
    is_available: boolean
}

export interface BlockedDate {
    id: string
    staff_id: string
    provider_id?: string // References providers table
    start_date: string // YYYY-MM-DD
    end_date: string // YYYY-MM-DD
    start_time?: string // HH:mm:ss
    end_time?: string // HH:mm:ss
    recurrence_rule?: string // RRule string
    title?: string
    reason?: string
}

export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled' | 'no-show' | 'completed'

export interface Appointment {
    id: string
    service_id: string
    staff_id: string
    address_id?: string // References provider_addresses table
    customer_id: string // Now references customers table
    appointment_date: string // YYYY-MM-DD
    start_time: string // HH:mm format
    end_time: string // HH:mm format
    status: AppointmentStatus
    booked_price?: number // Service price locked at time of booking
    notes?: string
    created_at?: string
    updated_at?: string
    customer?: Customer // Joined data
    service?: Service // Joined data
    provider?: Provider // Joined data
    staff?: Staff // Joined data
}

export interface TimeSlot {
    time: string // HH:mm format
    available: boolean
    reason?: string // Why it's not available
}

export type UserRole = 'customer' | 'provider' | 'admin'

// Subscription types
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'
export type PaymentStatus = 'succeeded' | 'pending' | 'failed'

export interface Plan {
    id: string
    name: string                    // 'solo', 'solo_plus', 'store', 'chain'
    display_name: string
    description?: string
    price_yearly?: number           // null = coming soon
    prices: Record<string, number> // Map of locale/currency to price (e.g. { "eur": 900, "brl": 5000 })
    discount_percent?: number       // 0-100
    discount_duration_months?: number // e.g. 3 for 3 months
    max_staff?: number              // null = unlimited
    max_locations?: number          // null = unlimited
    max_services?: number           // null = unlimited
    features: string[]
    status: 'active' | 'coming_soon' | 'legacy' | 'archived'
    sort_order: number
    created_at?: string
    updated_at?: string
}

export interface Subscription {
    id: string
    provider_id: string
    plan_id: string
    status: SubscriptionStatus
    currency?: string               // 'usd', 'eur', 'brl', etc.
    trial_ends_at?: string
    current_period_start?: string
    current_period_end?: string
    locked_price?: number           // Snapshot of plan price at signup
    locked_discount_percent?: number // Snapshot of plan discount at signup
    discount_ends_at?: string       // When the discount expires
    cancel_at_period_end: boolean
    cancelled_at?: string
    pending_downgrade_plan_id?: string // Scheduled downgrade for next cycle
    trial_plan_change_count?: number   // Track plan changes during trial
    stripe_subscription_id?: string
    stripe_customer_id?: string
    created_at?: string
    updated_at?: string
    plan?: Plan                     // Joined data
    pending_downgrade_plan?: Plan   // Joined data for UI
}

export interface Payment {
    id: string
    subscription_id: string
    amount: number
    currency: string
    status: PaymentStatus
    payment_method?: string
    stripe_payment_intent_id?: string
    invoice_url?: string
    paid_at?: string
    proration_credit?: number       // Credit for old plan's unused time
    proration_charge?: number       // Charge for new plan's remaining time
    description?: string            // Description of the payment (e.g., "Upgrade: Solo → Store")
    created_at?: string
    subscription?: Subscription     // Joined data
}
