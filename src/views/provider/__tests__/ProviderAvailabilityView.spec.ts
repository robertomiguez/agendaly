import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ProviderAvailabilityView from "../ProviderAvailabilityView.vue";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import * as staffService from "../../../services/staffService";
import * as availabilityService from "../../../services/availabilityService";


// Mock Supabase first
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

// Mock Services
vi.mock("@/services/staffService", () => ({
  fetchStaff: vi.fn(),
  fetchStaffMembers: vi.fn(),
}));

vi.mock("@/services/availabilityService", () => ({
  fetchAvailability: vi.fn(),
  fetchBlockedDates: vi.fn(), 
  upsertAvailability: vi.fn(),
  createBlockedDate: vi.fn(),
  deleteBlockedDate: vi.fn(),
}));

// Mock Router
const pushMock = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useRoute: () => ({
    path: "/provider/availability",
  }),
}));

// Mock Notifications
const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();
const clearMessagesMock = vi.fn();

vi.mock("@/composables/useNotifications", () => ({
  useNotifications: () => ({
    successMessage: { value: "" },
    errorMessage: { value: "" },
    showSuccess: showSuccessMock,
    showError: showErrorMock,
    clearMessages: clearMessagesMock,
  }),
}));

// Mock i18n
vi.mock("vue-i18n", () => ({
  createI18n: () => ({
    global: {
        locale: { value: "en" }
    }
  }),
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Child Components
vi.mock("@/components/common/ConfirmationModal.vue", () => ({ default: { template: "<div><slot /></div>" } }));
vi.mock("@/components/common/Modal.vue", () => ({ default: { template: "<div><slot /></div>" } }));

// Mock Appointment Store
const fetchFutureAppointmentsMock = vi.fn();
vi.mock("@/stores/useAppointmentStore", () => ({
    useAppointmentStore: vi.fn(() => ({
        fetchFutureAppointments: fetchFutureAppointmentsMock,
        fetchStaffAppointments: vi.fn().mockResolvedValue([]),
    }))
}));


describe("ProviderAvailabilityView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    
    // Setup Default Mocks
    vi.mocked(staffService.fetchStaff).mockResolvedValue([
        { id: "staff1", name: "Staff Member", active: true } as any
    ]);
    vi.mocked(availabilityService.fetchAvailability).mockResolvedValue([]);
    vi.mocked(availabilityService.fetchBlockedDates).mockResolvedValue([]); 
    vi.mocked(availabilityService.upsertAvailability).mockResolvedValue([]);
    fetchFutureAppointmentsMock.mockResolvedValue([]);
    
    const settingsStore = useSettingsStore();
    settingsStore.language = "en-US";
  });

  it("redirects to booking if no provider", async () => {
    const authStore = useAuthStore();
    authStore.provider = null;
    
    mount(ProviderAvailabilityView, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { ConfirmationModal: true }
      }
    });
    
    await flushPromises();
    expect(pushMock).toHaveBeenCalledWith("/booking");
  });

  it("fetches staff and schedule on mount", async () => {
     const authStore = useAuthStore();
     authStore.provider = { id: "p1", name: "Provider" } as any;

     const wrapper = mount(ProviderAvailabilityView, {
        global: {
            mocks: { $t: (key: string) => key }
        }
     });

     await flushPromises();

     expect(staffService.fetchStaff).toHaveBeenCalledWith("p1");
     // Should select first staff and fetch schedule
     expect(availabilityService.fetchAvailability).toHaveBeenCalledWith("staff1");
     
     // IMPORTANT: verify fetchBlockedDates is NOT called
     expect(availabilityService.fetchBlockedDates).not.toHaveBeenCalled();
     
     // Check if weekly schedule is rendered
     expect(wrapper.text()).toContain("provider.availability.weekly_schedule");
  });

  it("saves schedule when save button is clicked", async () => {
    const authStore = useAuthStore();
    authStore.provider = { id: "p1", name: "Provider" } as any;
    
    const wrapper = mount(ProviderAvailabilityView, {
         global: {
             mocks: { $t: (key: string) => key }
         }
    });
    
    await flushPromises();

    // Find save button
    const saveBtn = wrapper.findAll("button").find(b => b.text().includes("common.save"));
    expect(saveBtn).toBeDefined();
    
    await saveBtn?.trigger("click");
    await flushPromises();
    
    // Check if upsertAvailability was called
    expect(availabilityService.upsertAvailability).toHaveBeenCalled();
    expect(showSuccessMock).toHaveBeenCalledWith("provider.availability.save_success");
  });
  
  it("does not render Time Off section", async () => {
      const authStore = useAuthStore();
      authStore.provider = { id: "p1", name: "Provider" } as any;

      const wrapper = mount(ProviderAvailabilityView, {
         global: {
             mocks: { $t: (key: string) => key }
         }
      });

      await flushPromises();

      // Check strictly that "Time Off" text (key or content) is absent
      // Note: We mock $t to return key. The key for title was 'provider.availability.time_off'
      expect(wrapper.text()).not.toContain("provider.availability.time_off");
  });

});
