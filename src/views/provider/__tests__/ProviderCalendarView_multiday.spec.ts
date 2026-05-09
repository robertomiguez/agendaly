
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

// Mock availabilityService to return a multi-day block
vi.mock("@/services/availabilityService", () => ({
  fetchBlockedDates: vi.fn().mockResolvedValue([
      {
          id: 'block1',
          start_date: '2024-01-08', // Monday
          end_date: '2024-01-10',   // Wednesday
          start_time: '09:00',
          end_time: '17:00',
          staff_id: 's1',
          reason: 'Multi-day Block'
      }
  ]),
  fetchBlockedDateExceptions: vi.fn().mockResolvedValue([]),
  fetchAvailability: vi.fn().mockResolvedValue([
    { day_of_week: 1, is_available: true, start_time: '09:00', end_time: '17:00', staff_id: 's1' },
    { day_of_week: 2, is_available: true, start_time: '09:00', end_time: '17:00', staff_id: 's1' },
    { day_of_week: 3, is_available: true, start_time: '09:00', end_time: '17:00', staff_id: 's1' }
  ]),
  createBlockedDate: vi.fn().mockResolvedValue({}),
  createBlockedDateException: vi.fn().mockResolvedValue({}),
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

describe("ProviderCalendarView Multi-Day Blocks", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        const settingsStore = useSettingsStore();
        settingsStore.language = "en-US";
        
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

    it("renders multi-day block across all affected days", async () => {
        const mockToday = new Date(2024, 0, 8, 12, 0, 0); // Mon Jan 8
        vi.setSystemTime(mockToday);

        const authStore = useAuthStore();
        authStore.provider = { id: "p1", name: "Provider" } as any;

        const wrapper = mount(ProviderCalendarView, {
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    Button: true,
                    Tabs: true,
                    TabsList: true,
                    TabsTrigger: true,
                },
            },
        });
        
        await flushPromises();
        
        // Find day columns
        const dayColumns = wrapper.findAll(".flex-1.grid.grid-cols-7 .relative.min-h-full");
        expect(dayColumns.length).toBe(7);
        
        // Block is Mon-Wed (Indices 1, 2, 3 in current week view logic usually (if sun=0))
        // View defaults to 'week'. Week starts on Sunday Jan 7.
        // Index 0: Sun Jan 7
        // Index 1: Mon Jan 8 -> Should have block
        // Index 2: Tue Jan 9 -> Should have block
        // Index 3: Wed Jan 10 -> Should have block
        // Index 4: Thu Jan 11 -> No block
        
        const verifyColumnHasBlock = (colIndex: number, hasBlock: boolean) => {
            const column = dayColumns[colIndex];
            if (!column) throw new Error(`Column ${colIndex} not found`);
            const blocks = column.findAll("button.border-l-4.border-l-gray-500"); // Block styling class
            if (hasBlock) {
                 expect(blocks.length).toBeGreaterThan(0);
                 const firstBlock = blocks[0];
                 if (!firstBlock) throw new Error(`Block not found in column ${colIndex}`);
                 expect(firstBlock.text()).toContain("Multi-day Block");
            } else {
                 expect(blocks.length).toBe(0);
            }
        };

        verifyColumnHasBlock(1, true); // Monday
        verifyColumnHasBlock(2, true); // Tuesday
        verifyColumnHasBlock(3, true); // Wednesday
        verifyColumnHasBlock(4, false); // Thursday
    });

    it("renders block on non-workable day", async () => {
        // Mock Sunday (Jan 7) as non-workable (which it is by default in mock)
        // Mock a block that covers Sunday
        
        // Update mock for this specific test
         vi.mocked(await import("@/services/availabilityService")).fetchBlockedDates.mockResolvedValue([
            {
                id: 'block-sunday',
                start_date: '2024-01-07', // Sunday
                end_date: '2024-01-07',   // Sunday
                start_time: '09:00',
                end_time: '17:00',
                staff_id: 's1',
                reason: 'Sunday Block'
            }
        ]);

        const mockToday = new Date(2024, 0, 8, 12, 0, 0); // Mon Jan 8
        vi.setSystemTime(mockToday);

        const authStore = useAuthStore();
        authStore.provider = { id: "p1", name: "Provider" } as any;

        const wrapper = mount(ProviderCalendarView, {
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    Button: true,
                    Tabs: true,
                    TabsList: true,
                    TabsTrigger: true,
                },
            },
        });
        
        await flushPromises();
        
        // Find day columns
        const dayColumns = wrapper.findAll(".flex-1.grid.grid-cols-7 .relative.min-h-full");
        expect(dayColumns.length).toBe(7);
        
        // Index 0: Sun Jan 7 (Non-workable, but blocked)
        const sundayColumn = dayColumns[0];
        if (!sundayColumn) throw new Error("Sunday column not found");
        
        // Should have a block
        const blocks = sundayColumn.findAll("button.border-l-4.border-l-gray-500");
        expect(blocks.length).toBeGreaterThan(0);
        const firstBlock = blocks[0];
        if (!firstBlock) throw new Error("Block not found");
        expect(firstBlock.text()).toContain("Sunday Block");
    });
});
