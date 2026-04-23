import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ProviderCalendarView from "../ProviderCalendarView.vue";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { format } from "date-fns";

// Mocks
const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

const selectMock = vi.fn();

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

vi.mock("@/services/availabilityService", () => ({
  fetchBlockedDates: vi.fn().mockResolvedValue([]),
  fetchAvailability: vi.fn().mockResolvedValue([]),
  createBlockedDate: vi.fn().mockResolvedValue({}),
  deleteBlockedDate: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/components/provider/AppointmentDetailsModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/provider/BlockTimeModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/provider/BlockDetailsModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/common/ConfirmationModal.vue", () => ({ default: { template: "<div></div>" } }));

vi.mock("lucide-vue-next", () => ({
  ChevronLeft: { template: "<span class='lucide-chevron-left'></span>" },
  ChevronRight: { template: "<span class='lucide-chevron-right'></span>" },
  ArrowLeft: { template: "<span class='lucide-arrow-left'></span>" },
  Plus: { template: "<span class='lucide-plus'></span>" },
  Loader2: { template: "<span class='lucide-loader-2'></span>" },
}));

vi.mock("vue-i18n", () => ({
  createI18n: () => ({ global: { locale: { value: "en" } } }),
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: "en" },
  }),
}));

describe("ProviderCalendarView Buffer Logic", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    
    // Default chain for selectMock
    const chain = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [] }),
        order: vi.fn().mockResolvedValue({ data: [] }),
        single: vi.fn(),
    };
    selectMock.mockReturnValue(chain);

    const settingsStore = useSettingsStore();
    settingsStore.language = "en-US";
  });

  it("calculates visual start/end including buffers", async () => {
    const authStore = useAuthStore();
    authStore.provider = { id: "p1", name: "Provider" } as any;

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    // Appointment at 10:00, 20 min duration, 5 min buffer before, 5 min buffer after
    // DB Start: 10:00
    // DB End: 10:20
    // Visual Start: 9:55
    // Visual End: 10:25
    // Visual Duration: 30 min
    const mockAppointments = [
      {
        id: "a1",
        appointment_date: todayStr,
        start_time: "10:00:00",
        status: "confirmed",
        services: { 
            name: "Haircut", 
            duration: 20,
            buffer_before: 5,
            buffer_after: 5
        },
        customers: { profiles: { name: "John Doe" } },
        staff: { name: "Staff A", provider_id: "p1" },
        staff_id: "s1"
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

    // Find the event element
    const eventEl = wrapper.find("button.absolute");
    expect(eventEl.exists()).toBe(true);

    // Calculate expected style
    // PIXELS_PER_HOUR = 78
    // Start 9:55 = 9 + 55/60 = 9.91666 hours from midnight
    // 9:55 is 595 minutes from 00:00
    // 595 / 60 = 9.91666 hours.
    // Top = 9.91666 * 78 = 773.5px
    
    // Duration: 30 minutes = 0.5 hours
    // Height = 0.5 * 78 = 39px
    
    const style = eventEl.attributes("style");
    // Check height
    expect(style).toContain("height: 39px");
    
    // Check top. 773.5px.
    expect(style).toContain("top: 773.5px");

    // Check text label (should show original time 10:00 - 10:20)
    // 10:00 + 20 min = 10:20.
    // Start: 10:00
    // End: 10:20
    expect(eventEl.text()).toContain("10:00");
    expect(eventEl.text()).toContain("10:20");
    
    // Ensure "9:55" or "10:25" is NOT in the text
    expect(eventEl.text()).not.toContain("9:55");
    expect(eventEl.text()).not.toContain("10:25");
  });
});
