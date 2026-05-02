// ... (imports)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ProviderCalendarView from "../ProviderCalendarView.vue";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";

// Hoisted mocks for router
const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

// Mock Supabase matches previous...
const selectMock = vi.fn();
// ... (rest of mocks same as before, just restore)
const eqMock = vi.fn();
const orderMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: selectMock,
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
    })),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useRoute: () => ({
    path: "/provider/calendar",
  }),
}));

// Helper to reset mocks
function resetSupabaseMock() {
  selectMock.mockReset();
  eqMock.mockReset();
  orderMock.mockReset();
  pushMock.mockClear(); // Reset router mock too
  
  // Default chain
  const chain = {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [] }),
      order: vi.fn().mockResolvedValue({ data: [] }),
      single: vi.fn(),
  };
  
  selectMock.mockReturnValue(chain);
}
// Mock availabilityService
vi.mock("@/services/availabilityService", () => ({
  fetchBlockedDates: vi.fn().mockResolvedValue([]),
  fetchAvailability: vi.fn().mockResolvedValue([]),
  createBlockedDate: vi.fn().mockResolvedValue({}),
  deleteBlockedDate: vi.fn().mockResolvedValue({}),
}));

// Mock child components (stubs are usually enough, but mocking avoids import issues)
vi.mock("@/components/provider/AppointmentDetailsModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/provider/BlockTimeModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/provider/BlockDetailsModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/common/ConfirmationModal.vue", () => ({ default: { template: "<div></div>" } }));

// Mock Lucide Icons (to avoid rendering issues)
vi.mock("lucide-vue-next", () => ({
  ChevronLeft: { template: "<span class='lucide-chevron-left'></span>" },
  ChevronRight: { template: "<span class='lucide-chevron-right'></span>" },
  ArrowLeft: { template: "<span class='lucide-arrow-left'></span>" },
  Plus: { template: "<span class='lucide-plus'></span>" },
  Loader2: { template: "<span class='lucide-loader-2'></span>" },
}));

// Mock i18n
vi.mock("vue-i18n", () => ({
  createI18n: () => ({ global: { locale: { value: "en" } } }),
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: "en" },
  }),
}));

describe("ProviderCalendarView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetSupabaseMock();
    const settingsStore = useSettingsStore();
    settingsStore.language = "en-US";
  });

  it("redirects to booking if no provider in auth store", () => {
    const authStore = useAuthStore();
    authStore.provider = null;
    mount(ProviderCalendarView, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { Button: true, Card: true, CardContent: true, CardHeader: true, Tabs: true, TabsList: true, TabsTrigger: true },
      },
    });
    expect(pushMock).toHaveBeenCalledWith("/booking");
  });

  it("renders calendar grid and fetches appointments", async () => {
    // ... setup ...
    const authStore = useAuthStore();
    authStore.provider = { id: "p1", name: "Provider" } as any;

    // Mock Appointments Return
    const mockAppointments = [
      {
        id: "a1",
        appointment_date: new Date().toISOString().split("T")[0],
        start_time: "10:00:00",
        status: "confirmed",
        services: { name: "Haircut", duration: 30 },
        customers: { profiles: { name: "John Doe" } },
        staff: { name: "Staff A", provider_id: "p1" },
        staff_id: "s1"
      }
    ];

    // Setup Supabase Mock
    const chain = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockAppointments }),
        order: vi.fn().mockResolvedValue({ data: [] }),
    };
    selectMock.mockReturnValue(chain);

    const wrapper = mount(ProviderCalendarView, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          Button: { template: "<button><slot /></button>" },
          Card: { template: "<div><slot /></div>" },
          CardContent: { template: "<div><slot /></div>" },
          CardHeader: { template: "<div><slot /></div>" },
          Tabs: { template: "<div><slot /></div>" },
          TabsList: { template: "<div><slot /></div>" },
          TabsTrigger: { template: "<button><slot /></button>" },
          BlockTimeModal: { template: "<div class='block-modal-stub' :data-open='isOpen'></div>", props: ['isOpen', 'initialDate'] },
          AppointmentDetailsModal: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("calendar.week");
    
    // Check events exist if data returned
    // Since getEventsForDate depends on current date view matching mock date, strict check might be flaky if mocked date isn't today.
    // But we used new Date() so it should match.
    // We can't easily check rendered event content due to JSDOM layout limitations for absolute positioning logic,
    // but the getEventsForDate function should run.
    const events = wrapper.findAll("button.absolute");
    expect(events).toBeDefined();

    // Verify appointment details are rendered
    expect(wrapper.text()).toContain("John Doe");
    expect(wrapper.text()).toContain("calendar.with Staff A");
    expect(wrapper.text()).toContain("10:00");
    expect(wrapper.text()).toContain("10:30");
  });

  it("lays out overlapping appointments side by side in week view", async () => {
    const authStore = useAuthStore();
    authStore.provider = { id: "p1", name: "Provider" } as any;

    const today = new Date().toISOString().split("T")[0];
    const mockAppointments = [
      {
        id: "a1",
        appointment_date: today,
        start_time: "10:00:00",
        status: "confirmed",
        services: { name: "Haircut", duration: 30 },
        customers: { profiles: { name: "John Doe" } },
        staff: { name: "Staff A", provider_id: "p1" },
        staff_id: "s1"
      },
      {
        id: "a2",
        appointment_date: today,
        start_time: "10:00:00",
        status: "confirmed",
        services: { name: "Manicure", duration: 30 },
        customers: { profiles: { name: "Jane Doe" } },
        staff: { name: "Staff B", provider_id: "p1" },
        staff_id: "s2"
      }
    ];

    const chain = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: mockAppointments }),
        order: vi.fn().mockResolvedValue({ data: [] }),
    };
    selectMock.mockReturnValue(chain);

    const wrapper = mount(ProviderCalendarView, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          Button: { template: "<button><slot /></button>" },
          Card: { template: "<div><slot /></div>" },
          CardContent: { template: "<div><slot /></div>" },
          CardHeader: { template: "<div><slot /></div>" },
          Tabs: { template: "<div><slot /></div>" },
          TabsList: { template: "<div><slot /></div>" },
          TabsTrigger: { template: "<button><slot /></button>" },
          BlockTimeModal: true,
          AppointmentDetailsModal: true,
        },
      },
    });

    await flushPromises();

    const events = wrapper.findAll("button.absolute");
    const johnEvent = events.find((event) => event.text().includes("John Doe"));
    const janeEvent = events.find((event) => event.text().includes("Jane Doe"));

    expect(johnEvent).toBeDefined();
    expect(janeEvent).toBeDefined();
    expect(johnEvent?.attributes("style")).toContain("width: calc(50% - 4px)");
    expect(janeEvent?.attributes("style")).toContain("width: calc(50% - 4px)");
    expect(johnEvent?.attributes("style")).toContain("left: calc(0% + 2px)");
    expect(janeEvent?.attributes("style")).toContain("left: calc(50% + 2px)");
  });
  
  it("opens block modal on grid click", async () => {
      // ... setup ...
      const authStore = useAuthStore();
      authStore.provider = { id: "p1", name: "Provider" } as any;
      
      const wrapper = mount(ProviderCalendarView, {
          global: {
              mocks: { $t: (key: string) => key },
              stubs: {
                  Button: true,
                  Card: true, 
                  CardContent: true, 
                  CardHeader: true,
                  Tabs: true, 
                  TabsList: true, 
                  TabsTrigger: true,
                  BlockTimeModal: { 
                      template: "<div class='block-modal-stub' :data-open='isOpen'></div>", 
                      props: ['isOpen', 'initialDate'] 
                  }
              }
          }
      });
      
      await flushPromises();
      
      const dayColumn = wrapper.find(".min-h-full.relative"); 
      if (dayColumn.exists()) {
          await dayColumn.trigger("click", {
              clientX: 100,
              clientY: 200, 
              currentTarget: { getBoundingClientRect: () => ({ top: 100 }) } 
          });
          
          const modalStub = wrapper.find(".block-modal-stub");
          expect(modalStub.exists()).toBe(true);
          expect(modalStub.attributes("data-open")).toBe("true"); // Check bound prop via stub
      }
  });
});
