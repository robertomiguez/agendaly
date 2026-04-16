import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import BlockTimeModal from "../BlockTimeModal.vue";

describe("BlockTimeModal Time Range", () => {
  const defaultProps = {
    isOpen: true,
    staffId: "s1",
  };

  const globalMock = {
    plugins: [createTestingPinia()],
    mocks: { $t: (key: string) => key },
    stubs: {
        Modal: { template: '<div><slot /></div>' }
    }
  };

  it("generates full 24h range if no limits provided", async () => {
    const wrapper = mount(BlockTimeModal, {
      props: { ...defaultProps, isOpen: false }, // Start closed
      global: globalMock
    });

    await wrapper.setProps({ isOpen: true }); // Open to trigger watcher

    // form.allDay defaults to true. We need to uncheck it to see time selects.
    const allDayCheckbox = wrapper.find("input[type='checkbox']");
    await allDayCheckbox.setValue(false);

    const selects = wrapper.findAll("select");
    // 0: Repeat, 1: Start, 2: End
    const startTimeSelect = selects[1];
    if (!startTimeSelect) throw new Error("Start time select not found");
    const options = startTimeSelect.findAll("option");
    
    // 00:00 to 23:45? 
    // 24 * 4 = 96 options.
    // Plus maybe the flat hour for end time if logic allows?
    // references say: for (let h = startH; h <= endH; h++)
    // If endH is 23, loop goes to 23.
    // 23:00, 23:15, 23:30, 23:45.
    // Total 96 options.
    
    expect(options.length).toBeGreaterThan(90);
    expect(options[0]?.text()).toBe("00:00");
  });

  it("renders time options within minTime and maxTime", async () => {
    const wrapper = mount(BlockTimeModal, {
      props: { 
          ...defaultProps,
          isOpen: false,
          initialDate: new Date(2024, 0, 1, 10, 0), // Sets hasTime=true, so allDay=false
          minTime: "09:00",
          maxTime: "11:00"
      },
      global: globalMock
    });

    await wrapper.setProps({ isOpen: true }); // Trigger watcher
    
    // initialDate has time 10:00 != 00:00, so hasTime=true -> allDay=false.
    
    const selects = wrapper.findAll("select");
    const startTimeSelect = selects[1];

    if (!startTimeSelect) {
      throw new Error("Start time select not found");
    }

    const options = startTimeSelect.findAll("option");
    
    const texts = options.map(o => o.text());
    expect(texts).toContain("09:00");
    expect(texts).toContain("11:45");
    expect(texts).not.toContain("08:45");
    expect(texts).not.toContain("12:00");
    expect(options.length).toBe(12);
  });
});
