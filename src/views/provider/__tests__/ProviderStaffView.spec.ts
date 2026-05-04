import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ProviderStaffView from "../ProviderStaffView.vue";
import { useAuthStore } from "../../../stores/useAuthStore";
import * as staffService from "../../../services/staffService";

const { pushMock, shareMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  shareMock: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("vue-i18n", () => ({
  createI18n: () => ({ global: { locale: { value: "en" } } }),
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.name ? `${key}:${params.name}` : key,
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    })),
  },
}));

vi.mock("@/services/staffService", () => ({
  fetchStaff: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
  deleteStaff: vi.fn(),
}));

vi.mock("@/services/subscriptionService", () => ({
  canAddStaff: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("@/services/availabilityService", () => ({
  fetchAvailability: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/composables/useNotifications", () => ({
  useNotifications: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

vi.mock("@/components/common/ConfirmationModal.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/components/provider/StaffFormModal.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/components/common/LoadingSpinner.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/components/common/BackButton.vue", () => ({ default: { template: "<div />" } }));
vi.mock("@/components/ui/alert", () => ({
  Alert: { template: "<div><slot /></div>" },
  AlertDescription: { template: "<div><slot /></div>" },
  AlertTitle: { template: "<div><slot /></div>" },
}));
vi.mock("lucide-vue-next", () => ({
  AlertCircle: { template: "<span />" },
}));

describe("ProviderStaffView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { origin: "https://app.test" },
      writable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0",
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses i18n strings for the native staff share message", async () => {
    vi.mocked(staffService.fetchStaff).mockResolvedValue([
      {
        id: "staff-1",
        provider_id: "provider-1",
        name: "Ana",
        slug: "ana",
        email: "ana@example.com",
        role: "staff",
        active: true,
      } as any,
    ]);

    const authStore = useAuthStore();
    authStore.provider = { id: "provider-1", name: "Provider", slug: "provider" } as any;

    const wrapper = mount(ProviderStaffView, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { RouterLink: { template: "<a><slot /></a>" } },
      },
    });

    await flushPromises();
    await wrapper.find("button[title='provider.staff.share_link']").trigger("click");

    expect(shareMock).toHaveBeenCalledWith({
      title: "provider.staff.share_title:Ana",
      text: "provider.staff.share_text:Ana",
      url: "https://app.test/p/provider/s/ana",
    });
  });
});
