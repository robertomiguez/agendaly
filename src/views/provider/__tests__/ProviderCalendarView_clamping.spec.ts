import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ProviderCalendarView from "../ProviderCalendarView.vue";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "../../../stores/useSettingsStore";

// Simplified mock setup
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [] }),
      order: vi.fn().mockResolvedValue({ data: [] }),
      single: vi.fn(),
    })),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: "/provider/calendar" }),
}));

vi.mock("@/services/availabilityService", () => ({
  fetchBlockedDates: vi.fn().mockResolvedValue([]),
  fetchBlockedDateExceptions: vi.fn().mockResolvedValue([]),
  fetchAvailability: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../stores/useSettingsStore", () => ({
    useSettingsStore: vi.fn(() => ({
        language: "en-US"
    }))
}));

// Mock child components
vi.mock("@/components/provider/AppointmentDetailsModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/provider/BlockTimeModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/provider/BlockDetailsModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("@/components/common/ConfirmationModal.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("lucide-vue-next", () => ({
  ChevronLeft: { template: "<span></span>" },
  ChevronRight: { template: "<span></span>" },
  ArrowLeft: { template: "<span></span>" },
  Loader2: { template: "<span></span>" },
}));
vi.mock("vue-i18n", () => ({
  createI18n: () => ({ global: { locale: { value: "en" } } }),
  useI18n: () => ({ t: (key: string) => key, locale: { value: "en" } }),
}));

describe("ProviderCalendarView Event Clamping", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        // Set language for locale
        const settings = { language: "en-US" };
        vi.mocked(useSettingsStore, { partial: true }).mockReturnValue(settings as any);
    });

    it("clamps events to visible grid hours", async () => {
        const wrapper = mount(ProviderCalendarView, {
            global: {
                mocks: { $t: (key: string) => key },
                stubs: {
                    LoadingSpinner: true,
                },
            },
        });
        
        // Settings store mock might need to be more robust if component uses it directly in template
        const vm = wrapper.vm as any;
        vm.settingsStore = { language: 'en-US' }; // Force if needed, but better via pinia

        // Access internal function via vm if exposed, or check computed style.
        // getEventStyle is not exposed by default in <script setup>.
        // However, we can test it by inspecting the rendered style of an event.
        // But we need to inject an event.
        // It's easier to export the logic or test side effects.
        
        // Let's force some state.
        // Set calendarStartHour to 9 (09:00), End to 17 (17:00 -> 18:00 end of grid).
        // Default is usually 0-23 if no avail.
        
        // We can manually set the refs if we use defineExpose or if we cheat with 'any'.
        // Or we can mock startOfDay/etc to force a specific range? No, range is calc from API.
        
        // Let's manipulate the component instance.
        // vm is already defined above
        vm.calendarStartHour = 9;
        vm.calendarEndHour = 17; // Ends at 18:00
                
        const testDate = new Date(2024, 0, 10, 10, 0); // Jan 10
        vm.currentDate = testDate;
        vm.view = 'day';
        
        // Case 1: Event completely inside (10:00 - 11:00)
        // Grid: 09:00 (540m) to 18:00 (1080m). Start is 0px.
        // 10:00 (600m) is 60m from start. top = 78px.
        // Duration 60m. height = 78px.
        
        // Case 2: Event starting before (08:00 - 10:00)
        // Should start at 09:00 (0px).
        // Duration 09:00 to 10:00 (60m). height = 78px.
        
        // Case 3: Event ending after (17:00 - 19:00)
        // Should start at 17:00 (8 * 60 = 480m from 9am) -> 8 * 78 = 624px.
        // End at 18:00. Duration 60m. height = 78px.
        
        // Case 4: All Day 00:00 - 24:00
        // Should be full height: 9h * 78 = 702px. Top 0.
        
        // We need to trigger the template to render these.
        // `getEventsForDate` filters `appointments` and `expandedBlocks`.
        // Let's add a fake appointment.
        
        vm.appointments = [];
        vm.expandedBlocks = [
            {
                id: 'case1',
                type: 'block',
                start: new Date(2024, 0, 10, 10, 0),
                end: new Date(2024, 0, 10, 11, 0),
                title: 'Inside'
            },
            {
                id: 'case2',
                type: 'block',
                start: new Date(2024, 0, 10, 8, 0),
                end: new Date(2024, 0, 10, 10, 0),
                title: 'Start Early'
            },
             {
                id: 'case3',
                type: 'block',
                start: new Date(2024, 0, 10, 17, 0),
                end: new Date(2024, 0, 10, 19, 0),
                title: 'End Late'
            },
             {
                id: 'case4',
                type: 'block',
                start: new Date(2024, 0, 10, 0, 0),
                end: new Date(2024, 0, 11, 0, 0), // Next day 00:00
                title: 'All Day'
            }
        ];
        
        await wrapper.vm.$nextTick();
        
        // Find events in DOM. They are buttons with absolute position.
        // We need to identify them. The title is rendered.
        
        const events = wrapper.findAll("button.absolute");
        // We might have other buttons (nav), so filter by text or class.
        // The event buttons have specific classes like border-l-4.
        
        const findEvent = (title: string) => events.find(w => w.text().includes(title));
        
        const case1 = findEvent('Inside');
        expect(case1).toBeDefined();
        // 10:00 is 1h from 09:00. 1 * 78 = 78px.
        expect(case1?.attributes('style')).toContain('top: 78px');
        expect(case1?.attributes('style')).toContain('height: 78px');
        
        const case2 = findEvent('Start Early');
        expect(case2).toBeDefined();
        // 08:00 is before 09:00. Clamped to 09:00. Top 0.
        // End is 10:00. Duration 09:00-10:00 = 1h. Height 78px.
        expect(case2?.attributes('style')).toContain('top: 0px');
        expect(case2?.attributes('style')).toContain('height: 78px');
        
        const case3 = findEvent('End Late');
        expect(case3).toBeDefined();
        // 17:00 is 8h from 09:00. 8 * 78 = 624px.
        // End 19:00 is after 18:00. Clamped to 18:00. Duration 1h. Height 78px.
        // Note: 17:00 to 18:00 is the last slot?
        // Grid: 9, 10, 11, 12, 13, 14, 15, 16, 17.
        // 17:00 is the start of the last hour?
        // HOURS = [9, ..., 17]. 
        // 17:00 starts at index 8?
        // 0:9, 1:10, 2:11, 3:12, 4:13, 5:14, 6:15, 7:16, 8:17.
        // Yes, top 8 * 78 = 624.
        expect(case3?.attributes('style')).toContain('top: 624px');
        expect(case3?.attributes('style')).toContain('height: 78px');
        
        const case4 = findEvent('All Day');
        expect(case4).toBeDefined();
        // 00:00 clamped to 09:00. Top 0.
        // 24:00 clamped to 18:00. Duration 9h.
        // 9 * 78 = 702px.
        expect(case4?.attributes('style')).toContain('top: 0px');
        expect(case4?.attributes('style')).toContain('height: 702px');
    });
});
