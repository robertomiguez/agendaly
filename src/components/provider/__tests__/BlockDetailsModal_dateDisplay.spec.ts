
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import BlockDetailsModal from "../BlockDetailsModal.vue";
import { createTestingPinia } from "@pinia/testing";

// Mock dependencies
vi.mock("lucide-vue-next", () => ({
  Trash2: { template: "<span></span>" },
}));

const mockT = (key: string) => key;

describe("BlockDetailsModal Date Display", () => {
  it("displays single date for single-day block", () => {
    const block = {
        title: "Single Day",
        start: new Date("2024-01-01T12:00:00"),
        isRecurring: false,
        original: {
            id: "1",
            start_date: "2024-01-01",
            end_date: "2024-01-01",
            reason: ""
        }
    };

    const wrapper = mount(BlockDetailsModal, {
      props: {
        isOpen: true,
        block: block,
      },
      global: {
        plugins: [createTestingPinia({
            initialState: {
                settings: { language: 'en-US' }
            }
        })],
        mocks: {
          $t: mockT,
        },
        stubs: {
            Modal: { template: "<div><slot /></div>" }
        }
      },
    });

    const detailsDiv = wrapper.findAll(".flex.items-center.gap-3.text-gray-700")[0];
    if (!detailsDiv) throw new Error("Details div not found");
    const dateDiv = detailsDiv.findAll("div")[1];
    if (!dateDiv) throw new Error("Date div not found");

    // "Monday, January 1, 2024" depends on locale, but checking partial match or known format
    expect(dateDiv.text()).toContain("January 1, 2024");
    expect(dateDiv.text()).not.toContain("-");
  });

  it("displays date range for multi-day block", () => {
    const block = {
        title: "Multi Day",
        start: new Date("2024-01-01T12:00:00"), // Display block start might be clamped, but modal uses original for range
        isRecurring: false,
        original: {
            id: "2",
            start_date: "2024-01-01",
            end_date: "2024-01-05", // Range
            reason: ""
        }
    };

    const wrapper = mount(BlockDetailsModal, {
      props: {
        isOpen: true,
        block: block,
      },
      global: {
        plugins: [createTestingPinia({
            initialState: {
                settings: { language: 'en-US' }
            }
        })],
        mocks: {
          $t: mockT,
        },
        stubs: {
            Modal: { template: "<div><slot /></div>" }
        }
      },
    });

    const detailsDiv = wrapper.findAll(".flex.items-center.gap-3.text-gray-700")[0];
    if (!detailsDiv) throw new Error("Details div not found");
    const dateDiv = detailsDiv.findAll("div")[1];
    if (!dateDiv) throw new Error("Date div not found");

    expect(dateDiv.text()).toContain("January 1, 2024");
    expect(dateDiv.text()).toContain("-");
    expect(dateDiv.text()).toContain("January 5, 2024");
  });

  it("displays instance date for recurring block", () => {
    const block = {
        title: "Recurring Instance",
        start: new Date("2024-02-01T12:00:00"), // Instance date
        isRecurring: true,
        original: {
            id: "3",
            start_date: "2024-01-01", // Series start
            end_date: "2024-01-01", 
            reason: ""
        }
    };

    const wrapper = mount(BlockDetailsModal, {
      props: {
        isOpen: true,
        block: block,
      },
      global: {
        plugins: [createTestingPinia({
            initialState: {
                settings: { language: 'en-US' }
            }
        })],
        mocks: {
          $t: mockT,
        },
        stubs: {
            Modal: { template: "<div><slot /></div>" }
        }
      },
    });

    const detailsDiv = wrapper.findAll(".flex.items-center.gap-3.text-gray-700")[0];
    if (!detailsDiv) throw new Error("Details div not found");
    const dateDiv = detailsDiv.findAll("div")[1];
    if (!dateDiv) throw new Error("Date div not found");

    // Should show Feb 1 (instance), NOT Jan 1 (series)
    expect(dateDiv.text()).toContain("February 1, 2024");
    expect(dateDiv.text()).not.toContain("January 1");
  });

  it("emits occurrence delete for a recurring block", async () => {
    const block = {
        title: "Recurring Instance",
        start: new Date("2024-02-01T12:00:00"),
        isRecurring: true,
        original: {
            id: "3",
            start_date: "2024-01-01",
            end_date: "2024-01-01",
            reason: ""
        }
    };

    const wrapper = mount(BlockDetailsModal, {
      props: {
        isOpen: true,
        block: block,
      },
      global: {
        plugins: [createTestingPinia({
            initialState: {
                settings: { language: 'en-US' }
            }
        })],
        mocks: {
          $t: mockT,
        },
        stubs: {
            Modal: { template: "<div><slot /></div>" }
        }
      },
    });

    const occurrenceButton = wrapper.findAll("button").find((button) =>
      button.text().includes("Delete this occurrence")
    );
    if (!occurrenceButton) throw new Error("Occurrence delete button not found");

    await occurrenceButton.trigger("click");

    expect(wrapper.emitted("delete")?.[0]?.[0]).toEqual({
      id: "3",
      scope: "occurrence",
      date: block.start,
    });
  });
});
