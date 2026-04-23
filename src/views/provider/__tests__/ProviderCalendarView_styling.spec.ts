
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ProviderCalendarView from "../ProviderCalendarView.vue";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";

// Mocks
const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

const selectMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: selectMock,
      // Default other methods to avoid crashes
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [] }),
      order: vi.fn().mockResolvedValue({ data: [] }),
      single: vi.fn(),
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

// Mock availabilityService
vi.mock("@/services/availabilityService", () => ({
  fetchBlockedDates: vi.fn().mockResolvedValue([]),
  fetchAvailability: vi.fn().mockResolvedValue([
    // Mock availability: Monday (1) is available, Sunday (0) is NOT available
    { day_of_week: 1, is_available: true, start_time: '09:00', end_time: '17:00', staff_id: 's1' }
  ]),
  createBlockedDate: vi.fn().mockResolvedValue({}),
  deleteBlockedDate: vi.fn().mockResolvedValue({}),
}));

// Mock child components
vi.mock("@/components/provider/AppointmentDetailsModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/provider/BlockTimeModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/provider/BlockDetailsModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/common/ConfirmationModal.vue", () => ({ default: { template: "<div></div>" } }));

// Mock Lucide Icons
vi.mock("lucide-vue-next", () => ({
  ChevronLeft: { template: "<span></span>" },
  ChevronRight: { template: "<span></span>" },
  ArrowLeft: { template: "<span></span>" },
  Loader2: { template: "<span></span>" },
}));

vi.mock("vue-i18n", () => ({
  createI18n: () => ({ global: { locale: { value: "en" } } }),
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: "en" },
  }),
}));

// Mock Card components
vi.mock("@/components/ui/card", () => ({
    Card: { template: "<div><slot /></div>" },
    CardHeader: { template: "<div><slot /></div>" },
    CardContent: { template: "<div><slot /></div>" },
}));


describe("ProviderCalendarView Styling", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        const settingsStore = useSettingsStore();
        settingsStore.language = "en-US";
        
        // Reset Supabase mock chain
        const chain = {
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ data: [] }),
            order: vi.fn().mockImplementation(async (arg) => {
                 if (arg === 'name') {
                     return { data: [{ id: 's1', name: 'Staff A', provider_id: 'p1', active: true }] };
                 }
                 return { data: [] };
            }),
            single: vi.fn(),
        };
        selectMock.mockReturnValue(chain);
        
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("applies grey class to past days", async () => {
        const mockToday = new Date(2024, 0, 10, 12, 0, 0); // Jan 10
        vi.setSystemTime(mockToday);

        const authStore = useAuthStore();
        authStore.provider = { id: "p1", name: "Provider" } as any;

        const wrapper = mount(ProviderCalendarView, {
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    Button: true,
                    // Card stubs removed, mocked via vi.mock
                    Tabs: true,
                    TabsList: true,
                    TabsTrigger: true,
                },
            },
        });
        
        await flushPromises();
        
        const dayColumns = wrapper.findAll(".flex-1.grid.grid-cols-7 .relative.min-h-full");
        
        // Sunday Jan 7 is past.
        expect(dayColumns.length).toBe(7);
        const sundayColumn = dayColumns[0]!;
        expect(sundayColumn.classes()).toContain("bg-gray-100/60"); 
    });

    it("applies grey class to unworkable future days", async () => {
         const mockToday = new Date(2024, 0, 8, 10, 0, 0); // Mon Jan 8
         vi.setSystemTime(mockToday);
         
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
                 }
             }
         });
         await flushPromises();
         
         const dayColumns = wrapper.findAll(".flex-1.grid.grid-cols-7 .relative.min-h-full");
         
         expect(dayColumns.length).toBe(7);
         
         const mondayColumn = dayColumns[1]!; // Today, working
         // Should NOT have the class
         expect(mondayColumn.classes()).not.toContain("bg-gray-100/60");
         
         const tuesdayColumn = dayColumns[2]!; // Future, NOT working
         expect(tuesdayColumn.classes()).toContain("bg-gray-100/60");
    });
});
