<script setup lang="ts">
import { ref, watch, computed } from "vue";
import Modal from "../common/Modal.vue";
import { RRule } from "rrule";
import type { BlockedDate, Staff } from "../../types";
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import { useDays } from "../../composables/useDays";

const props = defineProps<{
  isOpen: boolean;
  staffId: string;
  staffList?: Staff[];
  initialDate?: Date;
  minTime?: string; // "HH:mm"
  maxTime?: string; // "HH:mm"
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: Omit<BlockedDate, "id" | "created_at">): void;
}>();

const form = ref({
  staffId: "",
  title: "",
  reason: "",
  startDate: "",
  endDate: "",
  allDay: true,
  startTime: "09:00",
  endTime: "17:00",
  repeat: "none", // none, daily, weekly, custom
  customRecurrence: "",
});

const { daysOfWeekShort, rruleDays } = useDays();
const daysOfWeek = computed(() => {
  return daysOfWeekShort.value.map((day, index) => ({
    value: rruleDays[index],
    label: day.label
  }));
});


const timeOptions = computed(() => {
  const options = [];
  const minTimeStr = props.minTime || "00:00";
  const maxTimeStr = props.maxTime || "23:00";
  
  const startH = parseInt(minTimeStr.split(":")[0] ?? "0");
  const endH = parseInt(maxTimeStr.split(":")[0] ?? "0");
  
  for (let h = startH; h <= endH; h++) {
    for (let m = 0; m < 60; m += 15) {
        // If it's the last hour, we might want to include it or stop at 00?
        // Usually if endH is 17, we want 17:00, 17:15, 17:30, 17:45 available as START times? 
        // Or strictly up to 17:00?
        // Let's assume inclusive of the hour.
        const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        options.push(time);
    }
  }
  // Add the next hour flat if needed for end time? 
  // Typically end time can be later.
  // Let's add one more slot for the exact end of the range?
  // If maxTime is 17:00, allow 17:00?
  
  return options;
});

const staffName = computed(() => {
  if (props.staffId && props.staffId !== "all" && props.staffList) {
    const found = props.staffList.find((s) => s.id === props.staffId);
    return found ? found.name : "";
  }
  return "";
});

const selectedDays = ref<any[]>([]);

// Initialize form when opening
watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      const today = props.initialDate || new Date();
      const dateStr = today.toISOString().split("T")[0] ?? "";

      // Check if specific time was likely provided (not exactly midnight local time)
      // Or if we should defaulting to time based.
      // Let's assume if hours or minutes > 0 it's a specific time.
      // Even if 00:00 is clicked, it's fine to default to all day if that's the edge case,
      // but our calendar usually starts later.
      const hasTime = today.getHours() !== 0 || today.getMinutes() !== 0;

      let isAllDay = true;
      let startT = "09:00";
      let endT = "17:00";

      if (hasTime) {
        isAllDay = false;
        // Ensure HH:mm format
        const h = today.getHours().toString().padStart(2, "0");
        const m = today.getMinutes().toString().padStart(2, "0");
        startT = `${h}:${m}`;

        // Add 1 hour
        const endD = new Date(today);
        endD.setHours(endD.getHours() + 1);
        const eh = endD.getHours().toString().padStart(2, "0");
        const em = endD.getMinutes().toString().padStart(2, "0");
        endT = `${eh}:${em}`;
      }

      form.value = {
        staffId: props.staffId === "all" ? "" : props.staffId,
        title: "",
        reason: "",
        startDate: dateStr,
        endDate: dateStr,
        allDay: isAllDay,
        startTime: startT,
        endTime: endT,
        repeat: "none",
        customRecurrence: "",
      };
      selectedDays.value = [];
    }
  },
);

function generateRRule(): string | undefined {
  if (form.value.repeat === "none") return undefined;

  if (form.value.repeat === "daily") {
    return new RRule({
      freq: RRule.DAILY,
      dtstart: new Date(form.value.startDate),
      until: new Date(
        new Date(form.value.endDate).setFullYear(
          new Date(form.value.endDate).getFullYear() + 1,
        ),
      ), // Default 1 year? Or user specified end?
    }).toString();
  }

  if (form.value.repeat === "weekly") {
    // If no days selected, assume the day of start date
    let days = selectedDays.value;
    if (days.length === 0) {
      const date = new Date(form.value.startDate);
      // map getDay() 0-6 (Sun-Sat) to RRule day
      const map = [
        RRule.SU,
        RRule.MO,
        RRule.TU,
        RRule.WE,
        RRule.TH,
        RRule.FR,
        RRule.SA,
      ];
      days = [map[date.getDay()]];
    }

    return new RRule({
      freq: RRule.WEEKLY,
      byweekday: days,
      dtstart: new Date(form.value.startDate),
    }).toString();
  }

  return undefined;
}

function handleSave() {
  const rrule = generateRRule();

  // If repeating, the end date of the *series* is different from the end date of the *block*
  // For simplicity in this version, let's treat startDate/endDate as the range for the first occurrence
  // AND the range for the recurrence series if applicable.
  // Wait, normally Recurrence has an 'until'.

  // Let's refine the logic:
  // - startDate/endDate in the form defines the "First Instance" date.
  // - recurrence defines future instances.
  // - We also need a "End of recurrence" logic. For now let's say "Forever" or "1 year".

  if (!form.value.staffId) {
    alert("Please select a staff member");
    return;
  }

  const payload: any = {
    staff_id: form.value.staffId,
    start_date: form.value.startDate,
    end_date: form.value.endDate, // This is technically the end of the first block or the range
    title: form.value.title || "Blocked",
    reason: form.value.reason,
    recurrence_rule: rrule,
  };

  if (!form.value.allDay) {
    payload.start_time = form.value.startTime;
    payload.end_time = form.value.endTime;
  }

  emit("save", payload);
}
</script>

<template>
  <Modal
    :isOpen="isOpen"
    :title="$t('calendar.block_time')"
    @close="$emit('close')"
  >
    <form @submit.prevent="handleSave" class="space-y-4 mt-4">
      <!-- Staff Selection (if needed) -->
      <div v-if="!staffId || staffId === 'all'">
        <label class="block text-sm font-medium text-gray-700">{{
          $t("modals.appointment_details.staff") || "Staff Member"
        }}</label>
        <select
          v-model="form.staffId"
          class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          required
        >
          <option value="" disabled selected>Select a staff member</option>
          <option v-for="staff in staffList" :key="staff.id" :value="staff.id">
            {{ staff.name }}
          </option>
        </select>
      </div>
      <div v-else class="text-sm text-gray-500">
        {{ $t("modals.appointment_details.staff") || "Staff Member" }}:
        <span class="font-medium text-gray-900">{{ staffName }}</span>
      </div>

      <!-- Title -->
      <div>
        <label class="block text-sm font-medium text-gray-700">{{
          $t("calendar.event_title")
        }}</label>
        <input
          v-model="form.title"
          type="text"
          class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          placeholder="e.g. Lunch, Meeting"
        />
      </div>

      <!-- Date Range -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">{{
            $t("common.date")
          }}</label>
          <input
            v-model="form.startDate"
            type="date"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>
        <div v-if="form.repeat === 'none'">
          <label class="block text-sm font-medium text-gray-700">{{
            $t("common.end_date")
          }}</label>
          <input
            v-model="form.endDate"
            type="date"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>
      </div>

      <!-- Time -->
      <div class="flex items-center gap-2 mb-2">
        <input
          v-model="form.allDay"
          type="checkbox"
          id="allDay"
          class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label for="allDay" class="text-sm font-medium text-gray-700">{{
          $t("calendar.all_day")
        }}</label>
      </div>

      <div v-if="!form.allDay" class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">{{
            $t("common.start_time")
          }}</label>
          <select
            v-model="form.startTime"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
            <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">{{
            $t("common.end_time")
          }}</label>
          <select
            v-model="form.endTime"
            class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          >
             <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>

      <!-- Recurrence -->
      <div>
        <label class="block text-sm font-medium text-gray-700">{{
          $t("calendar.repeat")
        }}</label>
        <select
          v-model="form.repeat"
          class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        >
          <option value="none">{{ $t("calendar.does_not_repeat") }}</option>
          <option value="daily">{{ $t("calendar.daily") }}</option>
          <option value="weekly">{{ $t("calendar.weekly") }}</option>
        </select>
      </div>

      <!-- Weekly Sub-options -->
      <div v-if="form.repeat === 'weekly'" class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">{{
          $t("calendar.repeat_on")
        }}</label>
        <div class="flex gap-2">
          <button
            type="button"
            v-for="day in daysOfWeek"
            :key="day.label"
            @click="
              selectedDays.includes(day.value)
                ? (selectedDays = selectedDays.filter((d) => d !== day.value))
                : selectedDays.push(day.value)
            "
            class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border transition-colors"
            :class="
              selectedDays.includes(day.value)
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            "
          >
            {{ day.label.charAt(0) }}
          </button>
        </div>
      </div>

      <!-- Reason/Description -->
      <div>
        <label class="block text-sm font-medium text-gray-700">{{
          $t("common.description")
        }}</label>
        <textarea
          v-model="form.reason"
          rows="3"
          class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        ></textarea>
      </div>

      <div class="mt-5 flex gap-3 sm:justify-end">
        <button
          type="button"
          class="flex-1 sm:flex-none inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:text-sm"
          @click="$emit('close')"
        >
          {{ $t("common.cancel") }}
        </button>
        <button
          type="submit"
          :disabled="loading"
          class="flex-1 sm:flex-none inline-flex justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:text-sm items-center"
          :class="{ 'opacity-75 cursor-not-allowed': loading }"
        >
          <LoadingSpinner v-if="loading" inline size="sm" class="mr-2" color="text-white" />
          {{ loading ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </form>
  </Modal>
</template>
