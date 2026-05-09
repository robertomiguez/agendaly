<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useAuthStore } from "../../stores/useAuthStore";
import { useRouter } from "vue-router";
import { supabase } from "../../lib/supabase";
import type { Staff, BlockedDate, BlockedDateException, Availability, AppointmentStatus } from "../../types";
import {
  format,
  parseISO,
  isSameDay,
  addMinutes,
  differenceInMinutes,
  getDay,
  isBefore,
  startOfDay,
  endOfDay,
  addDays,
} from "date-fns";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useAppointmentStore } from "../../stores/useAppointmentStore";
import { useNotifications } from "../../composables/useNotifications";
import AppointmentDetailsModal from "../../components/provider/AppointmentDetailsModal.vue";
import BlockTimeModal from "../../components/provider/BlockTimeModal.vue";
import BlockDetailsModal from "../../components/provider/BlockDetailsModal.vue";
import * as availabilityService from "../../services/availabilityService";
import ConfirmationModal from "@/components/common/ConfirmationModal.vue";
import { useI18n } from "vue-i18n";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { rrulestr } from "rrule";
import LoadingSpinner from "../../components/common/LoadingSpinner.vue";
import BackButton from "../../components/common/BackButton.vue";

const authStore = useAuthStore();
const router = useRouter();
const settingsStore = useSettingsStore();
const appointmentStore = useAppointmentStore();
const { showSuccess, showError } = useNotifications();
const { t } = useI18n();

const staff = ref<Staff[]>([]);
const selectedStaffId = ref<string>("all");
const currentDate = ref(new Date());
const view = ref<"month" | "week" | "day">("week");
const appointments = ref<any[]>([]);
const blockedDates = ref<BlockedDate[]>([]);
const blockedDateExceptions = ref<BlockedDateException[]>([]);
const availabilities = ref<Availability[]>([]);
const expandedBlocks = ref<any[]>([]);
const loading = ref(false);
const savingBlock = ref(false);
const deletingBlock = ref(false);
const updatingStatus = ref(false);

// Calendar generation helpers
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days = [];

  // Padding for start of month
  for (let i = 0; i < firstDay.getDay(); i++) {
    const date = new Date(year, month, -i);
    days.unshift({ date, isCurrentMonth: false });
  }

  // Days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Padding for end of month
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  return days;
});

const weekDays = computed(() => {
  const curr = new Date(currentDate.value);
  const week = [];

  // Start from Sunday
  curr.setDate(curr.getDate() - curr.getDay());

  for (let i = 0; i < 7; i++) {
    week.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  return week;
});

// Time Grid Helpers
const PIXELS_PER_HOUR = 78;
const calendarStartHour = ref(0);
const calendarEndHour = ref(23);

const HOURS = computed(() => {
  const hours = [];
  for (let i = calendarStartHour.value; i <= calendarEndHour.value; i++) {
    hours.push(i);
  }
  if (hours.length === 0) return Array.from({ length: 24 }, (_, i) => i);
  return hours;
});

function getEventStyle(event: any) {
  const start = event.start;
  const end = event.end;
  
  // Calendar bounds in minutes from start of day
  const gridStartMinutes = calendarStartHour.value * 60;
  const gridEndMinutes = (calendarEndHour.value + 1) * 60; // End of the last hour
  
  // Event times in minutes from start of day
  let eventStartMinutes = start.getHours() * 60 + start.getMinutes();
  let eventEndMinutes = end.getHours() * 60 + end.getMinutes();

  // Handle cross-day or full-day ending at 00:00 next day (which is 0 minutes)
  // If end is 00:00 and date > start date, treat as 24:00 (1440 mins)
  if (eventEndMinutes === 0 && end.getDate() !== start.getDate()) {
      eventEndMinutes = 24 * 60;
  }
  
  // Clamp values to the grid range
  const clampedStartMinutes = Math.max(eventStartMinutes, gridStartMinutes);
  const clampedEndMinutes = Math.min(eventEndMinutes, gridEndMinutes);
  
  // If event is completely outside, it might have 0 height or negative duration if logic fails,
  // but Math.max/min should handle overlap.
  // If clampedEnd <= clampedStart, it's not visible.
  if (clampedEndMinutes <= clampedStartMinutes) {
      return { display: 'none' };
  }

  // Calculate top relative to the grid start
  const topMinutes = clampedStartMinutes - gridStartMinutes;
  const durationMinutes = clampedEndMinutes - clampedStartMinutes;

  const columnCount = event.columnCount || 1;
  const columnIndex = event.columnIndex || 0;
  const columnWidth = 100 / columnCount;
  const horizontalStyle = columnCount > 1
    ? {
        left: `calc(${columnIndex * columnWidth}% + 2px)`,
        width: `calc(${columnWidth}% - 4px)`,
        right: "auto",
      }
    : {
        left: "2px",
        right: "2px",
      };

  return {
    top: `${(topMinutes / 60) * PIXELS_PER_HOUR}px`,
    height: `${(durationMinutes / 60) * PIXELS_PER_HOUR}px`,
    position: "absolute" as const,
    ...horizontalStyle,
  };
}

onMounted(async () => {
  if (!authStore.provider) {
    router.push("/booking");
    return;
  }
  await fetchStaff();
  await calculateGlobalRange();
  await refreshData();
});

async function calculateGlobalRange() {
  const staffIds = staff.value.map((s) => s.id);
  if (staffIds.length === 0) return;

  const { data } = await supabase
    .from("availability")
    .select("start_time, end_time, is_available")
    .in("staff_id", staffIds)
    .eq("is_available", true);

  if (!data || data.length === 0) return;

  let minH = 24;
  let maxH = 0;

  data.forEach((a) => {
    const startH = parseInt(a.start_time.split(":")[0]);
    const endH = parseInt(a.end_time.split(":")[0]);
    const endM = parseInt(a.end_time.split(":")[1]);

    if (startH < minH) minH = startH;

    let effectiveEnd = endH;
    if (endM > 0) effectiveEnd += 1;

    if (effectiveEnd > maxH) maxH = effectiveEnd;
  });

  if (minH < maxH) {
    calendarStartHour.value = minH;
    calendarEndHour.value = maxH;
  }
}

async function fetchStaff() {
  const { data } = await supabase
    .from("staff")
    .select("*")
    .eq("provider_id", authStore.provider?.id)
    .eq("active", true)
    .order("name");

  staff.value = data || [];
}

async function refreshData() {
  await Promise.all([fetchAppointments(), fetchBlockedDates(), fetchAvailabilities()]);
  await fetchBlockedDateExceptions();
  expandBlockedDates();
}

async function fetchAvailabilities() {
  if (selectedStaffId.value === "all") {
    const allAvail: Availability[] = [];
    for (const s of staff.value) {
      const av = await availabilityService.fetchAvailability(s.id);
      allAvail.push(...av);
    }
    availabilities.value = allAvail;
  } else {
    availabilities.value = await availabilityService.fetchAvailability(
      selectedStaffId.value,
    );
  }
}

async function fetchAppointments() {
  loading.value = true;
  try {
    let query = supabase
      .from("appointments")
      .select(
        `
        *,
        services!inner (name, duration, buffer_before, buffer_after),
        customers (profiles (name, phone, email)),
        staff!inner (name, provider_id)
      `,
      )
      .eq("services.provider_id", authStore.provider?.id)
      .eq("staff.provider_id", authStore.provider?.id);

    if (selectedStaffId.value !== "all") {
      query = query.eq("staff_id", selectedStaffId.value);
    }

    // Date range filter based on view
    const { start, end } = getViewDateRange();

    const { data, error } = await query
      .gte("appointment_date", format(start, "yyyy-MM-dd"))
      .lte("appointment_date", format(end, "yyyy-MM-dd"));

    if (error) throw error;
    appointments.value = data || [];
  } catch (e) {
    console.error("Error fetching appointments:", e);
  } finally {
    loading.value = false;
  }
}

async function fetchBlockedDates() {
  if (selectedStaffId.value === "all") {
    const allBlocks = [];
    for (const s of staff.value) {
      const blocks = await availabilityService.fetchBlockedDates(s.id);
      allBlocks.push(...blocks);
    }
    blockedDates.value = allBlocks;
  } else {
    blockedDates.value = await availabilityService.fetchBlockedDates(
      selectedStaffId.value,
    );
  }
}

async function fetchBlockedDateExceptions() {
  blockedDateExceptions.value =
    await availabilityService.fetchBlockedDateExceptions(
      blockedDates.value
        .filter((block) => block.recurrence_rule)
        .map((block) => block.id),
    );
}

function getViewDateRange() {
  const start = new Date(currentDate.value);
  const end = new Date(currentDate.value);

  if (view.value === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else if (view.value === "week") {
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + (6 - end.getDay()));
    end.setHours(23, 59, 59, 999);
  } else {
    return {
      start: startOfDay(start),
      end: endOfDay(end),
    };
  }
  return { start, end };
}

function formatEventTimeRange(event: any) {
  const start = event.displayStart || event.start;
  const end = event.displayEnd || event.end;

  if (!start) return "";
  const startStr = formatTimeDisplay(start);
  if (!end) return startStr;
  return `${startStr} - ${formatTimeDisplay(end)}`;
}

function formatBlockedTimeRange(event: any) {
  if (event.type !== "appointment" || !event.displayStart || !event.displayEnd) {
    return "";
  }

  const hasBuffer =
    event.start.getTime() !== event.displayStart.getTime() ||
    event.end.getTime() !== event.displayEnd.getTime();

  if (!hasBuffer) return "";

  return `${t("calendar.blocked")}: ${formatTimeDisplay(event.start)} - ${formatTimeDisplay(
    event.end,
  )}`;
}

function formatEventTitle(event: any) {
  const blockedRange = formatBlockedTimeRange(event);
  const range = blockedRange
    ? `${formatEventTimeRange(event)}, ${blockedRange}`
    : formatEventTimeRange(event);

  return `${event.title} - ${event.subtitle} (${range})`;
}

function isPast(date: Date) {
  return isBefore(date, startOfDay(new Date()));
}

function isToday(date: Date) {
  return isSameDay(date, new Date());
}

function getPastTimeOverlayStyle(date: Date) {
  if (!isToday(date)) return { display: "none" };

  const now = new Date();
  const gridStartMinutes = calendarStartHour.value * 60;
  const gridEndMinutes = (calendarEndHour.value + 1) * 60;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const pastMinutes = Math.min(
    Math.max(nowMinutes - gridStartMinutes, 0),
    gridEndMinutes - gridStartMinutes,
  );

  if (pastMinutes <= 0) return { display: "none" };

  return {
    height: `${(pastMinutes / 60) * PIXELS_PER_HOUR}px`,
  };
}

function getCurrentTimeIndicatorStyle(date: Date) {
  if (!isToday(date)) return { display: "none" };

  const now = new Date();
  const gridStartMinutes = calendarStartHour.value * 60;
  const gridEndMinutes = (calendarEndHour.value + 1) * 60;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (nowMinutes < gridStartMinutes || nowMinutes > gridEndMinutes) {
    return { display: "none" };
  }

  return {
    top: `${((nowMinutes - gridStartMinutes) / 60) * PIXELS_PER_HOUR}px`,
  };
}

function isDateWorkable(date: Date) {
  const dayOfWeek = getDay(date);
  
  // Check if ANY staff is available
  if (selectedStaffId.value === "all") {
    return availabilities.value.some(
      (a) => a.day_of_week === dayOfWeek && a.is_available,
    );
  }

  return availabilities.value.some(
    (a) =>
      a.staff_id === selectedStaffId.value &&
      a.day_of_week === dayOfWeek &&
      a.is_available,
  );
}

function isStaffWorkable(staffId: string, date: Date) {
  const dayOfWeek = getDay(date);

  return availabilities.value.some(
    (a) =>
      a.staff_id === staffId &&
      a.day_of_week === dayOfWeek &&
      a.is_available,
  );
}

function hasCancelledBlockException(blockId: string, date: Date) {
  const dateStr = format(date, "yyyy-MM-dd");

  return blockedDateExceptions.value.some(
    (exception) =>
      exception.blocked_date_id === blockId &&
      exception.exception_date === dateStr &&
      exception.type === "cancelled",
  );
}

function getBlockTimeRangeForDate(block: BlockedDate, date: Date) {
  const dateStr = format(date, "yyyy-MM-dd");
  const start = parseISO(`${dateStr}T${block.start_time || "00:00:00"}`);
  const end = parseISO(`${dateStr}T${block.end_time || "23:59:59"}`);

  return { start, end };
}

function getExistingBlockInstancesForDate(staffId: string, date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  return blockedDates.value.flatMap((block) => {
    if (block.staff_id !== staffId) return [];

    if (block.recurrence_rule) {
      if (hasCancelledBlockException(block.id, date)) return [];

      try {
        const blockStart = parseISO(
          `${block.start_date}T${block.start_time || "00:00:00"}`,
        );
        const rule = rrulestr(block.recurrence_rule, { dtstart: blockStart });
        const occurrences = rule.between(dayStart, dayEnd, true);

        return occurrences.map((occurrence) => {
          const duration = differenceInMinutes(
            parseISO(`${block.start_date}T${block.end_time || "23:59:59"}`),
            blockStart,
          );

          return {
            start: occurrence,
            end: addMinutes(occurrence, duration),
          };
        });
      } catch (e) {
        console.error("Error checking recurring block conflict", e);
        return [];
      }
    }

    const blockStart = parseISO(`${block.start_date}T${block.start_time || "00:00:00"}`);
    const blockEnd = parseISO(`${block.end_date}T${block.end_time || "23:59:59"}`);
    if (blockStart > dayEnd || blockEnd < dayStart) return [];

    return [getBlockTimeRangeForDate(block, date)];
  });
}

function hasBlockedDateConflict(data: any, blockStart: Date, blockEnd: Date) {
  const duration = differenceInMinutes(blockEnd, blockStart);
  const datesToCheck = data.recurrence_rule
    ? rrulestr(data.recurrence_rule, { dtstart: blockStart }).between(
        blockStart,
        addDays(blockStart, 366),
        true,
      )
    : [blockStart];

  return datesToCheck.some((date) => {
    const newStart = date;
    const newEnd = addMinutes(newStart, duration);
    const existingBlocks = getExistingBlockInstancesForDate(data.staff_id, date);

    return existingBlocks.some(
      (block) => newStart < block.end && newEnd > block.start,
    );
  });
}

async function hasAppointmentConflict(data: any, blockStart: Date, blockEnd: Date) {
  const duration = differenceInMinutes(blockEnd, blockStart);
  const occurrenceStarts = data.recurrence_rule
    ? rrulestr(data.recurrence_rule, { dtstart: blockStart }).between(
        blockStart,
        addDays(blockStart, 366),
        true,
      )
    : [blockStart];

  if (occurrenceStarts.length === 0) return false;

  const firstOccurrence = occurrenceStarts[0];
  const lastOccurrence = occurrenceStarts[occurrenceStarts.length - 1];
  if (!firstOccurrence || !lastOccurrence) return false;

  const firstDate = format(firstOccurrence, "yyyy-MM-dd");
  const lastDate = format(lastOccurrence, "yyyy-MM-dd");
  const occurrenceDates = new Map(
    occurrenceStarts.map((date) => [format(date, "yyyy-MM-dd"), date]),
  );

  const { data: staffAppointments, error } = await supabase
    .from("appointments")
    .select("appointment_date,start_time,end_time,status,staff_id,services(duration)")
    .eq("staff_id", data.staff_id)
    .in("status", ["confirmed", "pending"])
    .gte("appointment_date", firstDate)
    .lte("appointment_date", lastDate);

  if (error) throw error;

  return (staffAppointments || []).some((apt: any) => {
    const occurrenceStart = occurrenceDates.get(apt.appointment_date);
    if (!occurrenceStart) return false;

    const occurrenceEnd = addMinutes(occurrenceStart, duration);
    const aptStart = parseISO(`${apt.appointment_date}T${apt.start_time}`);
    const aptEnd = apt.end_time
      ? parseISO(`${apt.appointment_date}T${apt.end_time}`)
      : addMinutes(aptStart, apt.services?.duration || 30);

    return occurrenceStart < aptEnd && occurrenceEnd > aptStart;
  });
}

function expandBlockedDates() {
  const { start, end } = getViewDateRange();
  const blocks: any[] = [];
  
  blockedDates.value.forEach((block) => {
    // Resolve staffName
    const staffName = staff.value.find((s) => s.id === block.staff_id)?.name;

    // If it has a recurrence rule
    if (block.recurrence_rule) {
      try {
        const blockStart = parseISO(
          block.start_date + "T" + (block.start_time || "00:00:00"),
        );
        const blockEnd = parseISO(
          block.start_date + "T" + (block.end_time || "00:00:00"),
        );
        const duration = differenceInMinutes(blockEnd, blockStart);

        const rule = rrulestr(block.recurrence_rule, { dtstart: blockStart });
        const occurrences = rule.between(start, end, true);

        occurrences.forEach((date) => {
          if (!isStaffWorkable(block.staff_id, date)) return;
          if (hasCancelledBlockException(block.id, date)) return;

          blocks.push({
            id: block.id + "-" + date.toISOString(),
            type: "block",
            title: block.title || block.reason || "Blocked",
            start: date,
            end: addMinutes(date, duration),
            original: block,
            status: "blocked",
            isRecurring: true,
            staffName: staffName,
          });
        });
      } catch (e) {
        console.error("Error parsing rrule", e);
      }
    } else {
      // Single block
      const blockStart = parseISO(
        block.start_date + "T" + (block.start_time || "00:00:00"),
      );
      const blockEnd = parseISO(
        block.end_date + "T" + (block.end_time || "23:59:59"),
      );

      if (blockStart <= end && blockEnd >= start) {
        // Add block regardless of workable status
        blocks.push({
          id: block.id,
          type: "block",
          title: block.title || block.reason || "Blocked",
          start: blockStart,
          end: blockEnd,
          original: block,
          status: "blocked",
          isRecurring: false,
          staffName: staffName,
        });
      }
    }
  });

  expandedBlocks.value = blocks;
}

function getEventsForDate(date: Date) {
  const dateStr = format(date, "yyyy-MM-dd");

  // Appointments
  const apts = appointments.value
    .filter((apt) => apt.appointment_date === dateStr)
    .map((apt) => {
      const dbStart = parseISO(apt.appointment_date + "T" + apt.start_time);
      const dbEnd = addMinutes(dbStart, apt.services?.duration || 30);

      const bufferBefore = apt.services?.buffer_before || 0;
      const bufferAfter = apt.services?.buffer_after || 0;

      const visualStart = addMinutes(dbStart, -bufferBefore);
      const visualEnd = addMinutes(dbEnd, bufferAfter);

      return {
        id: apt.id,
        type: "appointment",
        title: apt.customers?.profiles?.name || "Unknown",
        subtitle: apt.services?.name,
        start: visualStart,
        end: visualEnd,
        displayStart: dbStart,
        displayEnd: dbEnd,
        status: apt.status,
        original: apt,
        staffName: apt.staff?.name,
      };
    });

  // Blocked Dates
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);

  const blocks = expandedBlocks.value
    .filter((block) => {
      // Check overlap: block starts before day ends AND block ends after day starts
      return block.start < dayEnd && block.end > dayStart;
    })
    .map((block) => {
      // Clone and clamp visual range for this specific day
      // so the getEventStyle function can calculate correct height/position
      let displayStart = block.start;
      let displayEnd = block.end;

      if (displayStart < dayStart) {
        displayStart = dayStart;
      }

      if (displayEnd > dayEnd) {
        displayEnd = dayEnd;
      }

      return {
        ...block,
        start: displayStart,
        end: displayEnd,
        // We keep original start/end in the 'original' field if needed, 
        // or just rely on the fact that these are transient display objects.
        // Note: formatEventTimeRange uses displayStart/displayEnd if available,
        // but for blocks we might want to show "All Day" or just the time?
        // Let's leave formatEventTimeRange as is for now.
      };
    });

  // Sort by time
  return [...apts, ...blocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
}

function getLaidOutEventsForDate(date: Date) {
  const events = getEventsForDate(date).map((event) => ({
    ...event,
    columnIndex: 0,
    columnCount: 1,
  }));

  const groups: any[][] = [];
  let currentGroup: any[] = [];
  let currentGroupEnd = 0;

  events.forEach((event) => {
    const startTime = event.start.getTime();
    const endTime = event.end.getTime();

    if (currentGroup.length === 0 || startTime < currentGroupEnd) {
      currentGroup.push(event);
      currentGroupEnd = Math.max(currentGroupEnd, endTime);
      return;
    }

    groups.push(currentGroup);
    currentGroup = [event];
    currentGroupEnd = endTime;
  });

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  groups.forEach((group) => {
    const columnEnds: number[] = [];

    group.forEach((event) => {
      const startTime = event.start.getTime();
      const availableColumn = columnEnds.findIndex((endTime) => endTime <= startTime);
      const columnIndex = availableColumn === -1 ? columnEnds.length : availableColumn;

      event.columnIndex = columnIndex;
      columnEnds[columnIndex] = event.end.getTime();
    });

    const columnCount = columnEnds.length;
    group.forEach((event) => {
      event.columnCount = columnCount;
    });
  });

  return events;
}

function formatTimeDisplay(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Duplicate removed - see top of file

function prevPeriod() {
  const date = new Date(currentDate.value);
  if (view.value === "month") {
    date.setMonth(date.getMonth() - 1);
  } else if (view.value === "week") {
    date.setDate(date.getDate() - 7);
  } else {
    date.setDate(date.getDate() - 1);
  }
  currentDate.value = date;
  refreshData();
}

function nextPeriod() {
  const date = new Date(currentDate.value);
  if (view.value === "month") {
    date.setMonth(date.getMonth() + 1);
  } else if (view.value === "week") {
    date.setDate(date.getDate() + 7);
  } else {
    date.setDate(date.getDate() + 1);
  }
  currentDate.value = date;
  refreshData();
}

function today() {
  currentDate.value = new Date();
  refreshData();
}

function handleViewChange(newView: string) {
  view.value = newView as "month" | "week" | "day";
  refreshData();
}

// Appointment Details Modal
const selectedAppointment = ref<any>(null);
const showDetailsModal = ref(false);

// Block Details
const showBlockDetailsModal = ref(false);
const selectedBlock = ref<any>(null);
const showConflictModal = ref(false);
const conflictMessage = ref("");

function openEventDetails(event: any) {
  if (event.type === "appointment") {
    selectedAppointment.value = event.original;
    showDetailsModal.value = true;
  } else {
    selectedBlock.value = event;
    showBlockDetailsModal.value = true;
  }
}

async function handleBlockDelete(payload: { id: string; scope: "series" | "occurrence"; date?: Date }) {
  deletingBlock.value = true
  try {
    const providerId = selectedBlock.value?.original?.provider_id || authStore.provider?.id;

    if (payload.scope === "occurrence" && payload.date && providerId) {
      await availabilityService.createBlockedDateException({
        blocked_date_id: payload.id,
        provider_id: providerId,
        exception_date: format(payload.date, "yyyy-MM-dd"),
        type: "cancelled",
      });
    } else {
      await availabilityService.deleteBlockedDate(payload.id);
    }

    showBlockDetailsModal.value = false;
    await refreshData();
  } catch (e) {
    console.error("Error deleting block", e);
  } finally {
    deletingBlock.value = false
  }
}

async function updateStatus(status: AppointmentStatus) {
  if (!selectedAppointment.value) return;

  updatingStatus.value = true
  try {
    await appointmentStore.updateAppointment(selectedAppointment.value.id, { status });
    
    // Update local state directly since selectedAppointment is a reference to the item in appointments array
    selectedAppointment.value.status = status;
    showDetailsModal.value = false;
    showSuccess(t('provider.appointments.status_update_success') || 'Status updated');
  } catch (e) {
    console.error("Error updating status:", e);
    showError(t('provider.appointments.status_update_error') || 'Failed to update status');
  } finally {
    updatingStatus.value = false
  }
}

// Block Time Modal
const showBlockModal = ref(false);
const blockModalDate = ref(new Date());

function openBlockModal(date?: Date) {
  blockModalDate.value = date || new Date();
  showBlockModal.value = true;
}

function handleTimeSlotClick(date: Date, event: MouseEvent) {
  // Prevent triggering if clicked on an event (stop propagation is on events, but good to be safe)
  if ((event.target as HTMLElement).closest("button")) return;

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const y = event.clientY - rect.top;

  const hoursFromTop = y / PIXELS_PER_HOUR;
  const totalHours = calendarStartHour.value + hoursFromTop;

  const clickedDate = new Date(date);
  clickedDate.setHours(Math.floor(totalHours));
  clickedDate.setMinutes(Math.floor((totalHours % 1) * 60));

  // Round to nearest 15 minutes for cleaner UX
  const m = clickedDate.getMinutes();
  const roundedM = Math.round(m / 15) * 15;
  clickedDate.setMinutes(roundedM);
  clickedDate.setSeconds(0);

  // Prevent creating blocks in the past
  if (isBefore(clickedDate, new Date())) {
    return;
  }

  openBlockModal(clickedDate);
}
async function handleBlockSave(data: any) {
  savingBlock.value = true
  try {
    const blockStart = parseISO(
      data.start_date + "T" + (data.start_time || "00:00:00"),
    );
    // If end_date is missing (single day), use start_date.
    const blockEnd = parseISO(
      (data.end_date || data.start_date) + "T" + (data.end_time || "23:59:59"),
    );

    if (await hasAppointmentConflict(data, blockStart, blockEnd)) {
      conflictMessage.value =
        t("calendar.conflict_error") ||
        "Cannot block time: This staff member has existing appointments during this period.";
      showConflictModal.value = true;
      return;
    }

    if (hasBlockedDateConflict(data, blockStart, blockEnd)) {
      conflictMessage.value =
        t("calendar.block_conflict_error") ||
        "Cannot block time: This staff member already has blocked time during this period.";
      showConflictModal.value = true;
      return;
    }

    const payload = {
      ...data,
      provider_id: authStore.provider?.id,
    };
    await availabilityService.createBlockedDate(payload);
    showBlockModal.value = false;
    await refreshData();
  } catch (e) {
    console.error("Error creating block", e);
  } finally {
    savingBlock.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50/50 p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header Controls -->
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-4 self-start md:self-auto">
          <BackButton to="/provider/dashboard" />
          <h1 class="text-2xl font-bold tracking-tight">
            {{ $t("calendar.title") }}
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <!-- Staff Filter -->
          <div class="relative w-48">
            <select
              v-model="selectedStaffId"
              @change="refreshData"
              class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">
                {{ $t("category_pills.all") }}
                {{ $t("modals.appointment_details.staff") }}
              </option>
              <option
                v-for="member in staff"
                :key="member.id"
                :value="member.id"
              >
                {{ member.name }}
              </option>
            </select>
          </div>

          <!-- View Tabs -->
          <div class="calendar-tabs" role="tablist" aria-label="Calendar view">
            <button
              type="button"
              class="calendar-tab"
              :class="{ 'calendar-tab--active': view === 'month' }"
              role="tab"
              :aria-selected="view === 'month'"
              @click="handleViewChange('month')"
            >{{
                $t("calendar.month")
              }}</button>
            <button
              type="button"
              class="calendar-tab"
              :class="{ 'calendar-tab--active': view === 'week' }"
              role="tab"
              :aria-selected="view === 'week'"
              @click="handleViewChange('week')"
            >{{ $t("calendar.week") }}</button>
            <button
              type="button"
              class="calendar-tab"
              :class="{ 'calendar-tab--active': view === 'day' }"
              role="tab"
              :aria-selected="view === 'day'"
              @click="handleViewChange('day')"
            >{{ $t("calendar.day") }}</button>
          </div>
        </div>
      </div>

      <!-- Calendar Card -->
      <section class="calendar-card">
        <header class="calendar-card__header">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button class="calendar-icon-button" type="button" @click="prevPeriod">
                <ChevronLeft class="h-4 w-4" />
              </button>
              <button class="calendar-icon-button" type="button" @click="nextPeriod">
                <ChevronRight class="h-4 w-4" />
              </button>
              <h2 class="text-lg font-semibold ml-2">
                <span v-if="view === 'day'">
                  {{
                    currentDate.toLocaleDateString(settingsStore.language, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  }}
                </span>
                <span v-else>
                  {{
                    currentDate.toLocaleDateString(settingsStore.language, {
                      month: "long",
                      year: "numeric",
                    })
                  }}
                </span>
              </h2>
            </div>
            <button class="calendar-today-button" type="button" @click="today">
              {{ $t("calendar.today") }}
            </button>
          </div>
        </header>

        <div class="relative p-0">
          <LoadingSpinner v-if="loading" :text="$t('calendar.loading')" class="absolute inset-0 z-10 bg-white/80" />
          <div class="min-h-[600px]">
            <!-- Week View (Time Grid) -->
            <div
              v-if="view === 'week'"
              class="flex flex-col bg-white border rounded-md"
            >
              <!-- Time Grid Scroll Area -->
              <div class="flex-1 relative">
                <!-- Header (Moved Inside) -->
                <div class="flex border-b sticky top-0 bg-white z-20 shrink-0">
                  <div class="w-16 shrink-0 border-r bg-gray-50/40"></div>
                  <div class="flex-1 grid grid-cols-7">
                    <div
                      v-for="day in weekDays"
                      :key="day.toISOString()"
                      class="p-2 text-center bg-gray-50/40 border-r border-gray-300 last:border-r-0"
                      :class="{
                        'bg-primary/5 text-primary': isSameDay(day, new Date()),
                      }"
                    >
                      <p
                        class="text-xs font-medium uppercase text-muted-foreground"
                      >
                        {{
                          day.toLocaleDateString(settingsStore.language, {
                            weekday: "short",
                          })
                        }}
                      </p>
                      <p class="text-lg font-bold">{{ day.getDate() }}</p>
                    </div>
                  </div>
                </div>
                <div
                  class="flex relative"
                  :style="{ minHeight: HOURS.length * PIXELS_PER_HOUR + 'px' }"
                >
                  <!-- Time Column -->
                  <div
                    class="w-16 shrink-0 border-r bg-gray-50/20 relative"
                    :style="{ minHeight: HOURS.length * PIXELS_PER_HOUR + 'px' }"
                  >
                    <div
                      v-for="h in HOURS"
                      :key="h"
                      class="absolute right-2 text-xs text-muted-foreground font-medium flex items-center justify-end h-5"
                      :style="{ 
                        top: (h - calendarStartHour) * PIXELS_PER_HOUR - 10 + 'px' 
                      }"
                    >
                      <span v-if="h !== calendarStartHour">{{
                        h > 12 ? h - 12 + " PM" : h === 12 ? "12 PM" : h + " AM"
                      }}</span>
                    </div>
                  </div>

                  <!-- Days Grid -->
                  <div class="flex-1 grid grid-cols-7 min-h-full relative">
                    <div
                      v-for="day in weekDays"
                      :key="day.toISOString()"
                      class="relative min-h-full border-r border-gray-300 last:border-r-0 hover:bg-gray-50/20 transition-colors"
                      :class="{ 
                        'bg-gray-100/60': !isDateWorkable(day) || isPast(day),
                        'cursor-default': isPast(day),
                        'cursor-pointer': !isPast(day)
                      }"
                      @click="handleTimeSlotClick(day, $event)"
                    >
                      <!-- Hour Grid Lines -->
                      <div
                        v-for="h in HOURS"
                        :key="h"
                        class="border-b border-gray-200 w-full absolute pointer-events-none"
                        :style="{
                          top: (h - calendarStartHour) * PIXELS_PER_HOUR + 'px',
                        }"
                      ></div>

                      <div
                        v-if="isToday(day)"
                        class="past-time-overlay absolute top-0 left-0 right-0 z-10 bg-gray-100/60 cursor-default"
                        :style="getPastTimeOverlayStyle(day)"
                        @click.stop
                      ></div>

                      <!-- Events -->
                      <button
                        v-for="event in getLaidOutEventsForDate(day)"
                        :key="event.id"
                        :style="getEventStyle(event)"
                        @click.stop="openEventDetails(event)"
                        class="absolute z-20 rounded px-1.5 py-1 text-xs border-l-4 shadow-sm overflow-hidden hover:z-30 hover:shadow-md transition-all text-left flex flex-col pointer-events-auto group"
                        :class="{
                          'border-l-blue-500 bg-blue-50 text-blue-700 opacity-90 hover:opacity-100':
                            event.type === 'appointment' &&
                            event.status === 'confirmed',
                          'border-l-yellow-500 bg-yellow-50 text-yellow-700 opacity-90 hover:opacity-100':
                            event.type === 'appointment' &&
                            event.status === 'pending',
                          'border-l-green-500 bg-green-50 text-green-700 opacity-90 hover:opacity-100':
                            event.type === 'appointment' &&
                            event.status === 'completed',
                          'border-l-red-500 bg-red-50 text-red-700 opacity-90 hover:opacity-100':
                            event.type === 'appointment' &&
                            event.status === 'cancelled',
                          'border-l-gray-500 bg-gray-100 text-gray-700':
                            event.type === 'block',
                        }"
                        :title="formatEventTitle(event)"
                      >
                        <div
                          class="font-bold truncate text-[11px] leading-tight mb-0.5"
                        >
                          {{ event.title }}
                        </div>
                        <div
                          class="truncate opacity-80 text-[11px] leading-tight"
                        >
                          {{ formatEventTimeRange(event) }}
                          <span v-if="selectedStaffId === 'all'">
                            {{ $t("calendar.with") }} {{ event.staffName }}
                          </span>
                        </div>
                        <div
                          v-if="formatBlockedTimeRange(event)"
                          class="truncate text-[10px] leading-tight opacity-70"
                        >
                          {{ formatBlockedTimeRange(event) }}
                        </div>
                      </button>

                      <!-- Current Time Indicator -->
                      <div
                        v-if="isToday(day)"
                        class="absolute w-full border-t-2 border-red-500 z-30 pointer-events-none flex items-center"
                        :style="getCurrentTimeIndicatorStyle(day)"
                      >
                        <div
                          class="w-2 h-2 rounded-full bg-red-500 -ml-1"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Month View -->
            <div v-else-if="view === 'month'" class="grid grid-cols-7">
              <div
                v-for="d in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
                :key="d"
                class="p-2 text-center text-xs font-medium text-muted-foreground uppercase border-b border-r last:border-r-0 bg-gray-50/40"
              >
                {{ d }}
              </div>
              <div
                v-for="(day, idx) in calendarDays"
                :key="idx"
                class="min-h-[120px] p-2 border-b border-r last:border-r-0 relative transition-colors hover:bg-gray-50/30"
                :class="{
                  'bg-gray-50/50': !day.isCurrentMonth,
                  'bg-gray-100/60':
                    day.isCurrentMonth && (!isDateWorkable(day.date) || isPast(day.date)),
                }"
              >
                <span
                  class="text-sm font-medium inline-flex w-7 h-7 items-center justify-center rounded-full"
                  :class="{
                    'text-muted-foreground': !day.isCurrentMonth,
                    'text-primary-foreground bg-primary':
                      day.date.toDateString() === new Date().toDateString(),
                  }"
                >
                  {{ day.date.getDate() }}
                </span>
                <div class="mt-2 space-y-1">
                  <div
                    v-for="event in getEventsForDate(day.date)"
                    :key="event.id"
                    class="text-[10px] px-2 py-1 rounded truncate w-full border-l-2 cursor-pointer hover:opacity-80"
                    :class="{
                      'border-blue-500 bg-blue-100 text-blue-700':
                        event.type === 'appointment' &&
                        event.status === 'confirmed',
                      'border-yellow-500 bg-yellow-100 text-yellow-700':
                        event.type === 'appointment' &&
                        event.status === 'pending',
                      'border-green-500 bg-green-100 text-green-700':
                        event.type === 'appointment' &&
                        event.status === 'completed',
                      'border-red-500 bg-red-100 text-red-700':
                        event.type === 'appointment' &&
                        event.status === 'cancelled',
                      'border-gray-500 bg-gray-200 text-gray-700':
                        event.type === 'block',
                    }"
                    @click="openEventDetails(event)"
                  >
                    <span v-if="event.type === 'appointment'">
                      {{ formatEventTimeRange(event) }}
                      <span
                        v-if="formatBlockedTimeRange(event)"
                        class="text-[11px] opacity-70"
                      >
                        ({{ formatBlockedTimeRange(event) }})
                      </span>
                      <span
                        v-if="selectedStaffId === 'all'"
                        class="font-semibold mr-0.5"
                        >{{ event.staffName }}:</span
                      >
                      {{ event.title }}
                    </span>
                    <span v-else class="italic">
                      {{ formatEventTimeRange(event) }}
                      <span
                        v-if="selectedStaffId === 'all'"
                        class="font-semibold mr-0.5 not-italic"
                        >{{ event.staffName }}:</span
                      >
                      {{ event.title }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Day View (Time Grid) -->
            <div
              v-else-if="view === 'day'"
              class="flex flex-col bg-white border rounded-md"
            >
              <!-- Time Grid Scroll Area -->
              <div class="flex-1 relative">
                <!-- Header (Day - Moved Inside) -->
                <div class="flex border-b sticky top-0 bg-white z-20 shrink-0">
                  <div class="w-16 shrink-0 border-r bg-gray-50/40"></div>
                  <div
                    class="flex-1 p-2 text-center bg-gray-50/40"
                    :class="{
                      'bg-primary/5 text-primary': isSameDay(
                        currentDate,
                        new Date(),
                      ),
                    }"
                  >
                    <p
                      class="text-xs font-medium uppercase text-muted-foreground"
                    >
                      {{
                        currentDate.toLocaleDateString(settingsStore.language, {
                          weekday: "long",
                        })
                      }}
                    </p>
                    <p class="text-lg font-bold">{{ currentDate.getDate() }}</p>
                  </div>
                </div>
                <div
                  class="flex relative"
                  :style="{ minHeight: HOURS.length * PIXELS_PER_HOUR + 'px' }"
                >
                  <!-- Time Column -->
                  <div
                    class="w-16 shrink-0 border-r bg-gray-50/20 relative"
                    :style="{ minHeight: HOURS.length * PIXELS_PER_HOUR + 'px' }"
                  >
                    <div
                      v-for="h in HOURS"
                      :key="h"
                      class="absolute right-2 text-xs text-muted-foreground font-medium flex items-center justify-end h-5"
                      :style="{ 
                        top: (h - calendarStartHour) * PIXELS_PER_HOUR - 10 + 'px' 
                      }"
                    >
                      <span v-if="h !== calendarStartHour">{{
                        h > 12 ? h - 12 + " PM" : h === 12 ? "12 PM" : h + " AM"
                      }}</span>
                    </div>
                  </div>

                  <!-- Day Content -->
                  <div
                    class="flex-1 relative min-h-full bg-white"
                    :class="{ 
                      'bg-gray-100/60': !isDateWorkable(currentDate) || isPast(currentDate),
                      'cursor-default': isPast(currentDate),
                      'cursor-pointer': !isPast(currentDate)
                    }"
                    @click="handleTimeSlotClick(currentDate, $event)"
                  >
                    <!-- Hour Grid Lines -->
                    <div
                      v-for="h in HOURS"
                      :key="h"
                      class="border-b border-gray-200 w-full absolute pointer-events-none"
                      :style="{
                        top: (h - calendarStartHour) * PIXELS_PER_HOUR + 'px',
                      }"
                    ></div>

                    <div
                      v-if="isToday(currentDate)"
                      class="past-time-overlay absolute top-0 left-0 right-0 z-10 bg-gray-100/60 cursor-default"
                      :style="getPastTimeOverlayStyle(currentDate)"
                      @click.stop
                    ></div>

                    <!-- Events -->
                    <button
                      v-for="event in getLaidOutEventsForDate(currentDate)"
                      :key="event.id"
                      :style="getEventStyle(event)"
                      @click.stop="openEventDetails(event)"
                      class="absolute z-20 rounded px-3 py-2 text-sm border-l-4 shadow-sm overflow-hidden hover:z-30 hover:shadow-md transition-all text-left flex flex-col pointer-events-auto"
                      :class="{
                        'border-l-blue-500 bg-blue-50 text-blue-700 opacity-90 hover:opacity-100':
                          event.type === 'appointment' &&
                          event.status === 'confirmed',
                        'border-l-yellow-500 bg-yellow-50 text-yellow-700 opacity-90 hover:opacity-100':
                          event.type === 'appointment' &&
                          event.status === 'pending',
                        'border-l-green-500 bg-green-50 text-green-700 opacity-90 hover:opacity-100':
                          event.type === 'appointment' &&
                          event.status === 'completed',
                        'border-l-red-500 bg-red-50 text-red-700 opacity-90 hover:opacity-100':
                          event.type === 'appointment' &&
                          event.status === 'cancelled',
                        'border-l-gray-500 bg-gray-100 text-gray-700':
                          event.type === 'block',
                      }"
                    >
                      <div class="flex items-center justify-between mb-0.5">
                        <span class="font-bold truncate leading-tight">{{
                          event.title
                        }}</span>
                        <span
                          class="text-xs opacity-80 font-medium bg-white/50 px-1.5 py-0.5 rounded"
                          >{{ formatEventTimeRange(event) }}</span
                        >
                      </div>
                      <div
                        v-if="formatBlockedTimeRange(event)"
                        class="truncate text-[11px] leading-tight opacity-70"
                      >
                        {{ formatBlockedTimeRange(event) }}
                      </div>
                      <div
                        v-if="selectedStaffId === 'all'"
                        class="text-[10px] uppercase font-bold tracking-wider opacity-60 mt-auto"
                      >
                        {{ $t("calendar.with") }} {{ event.staffName }}
                      </div>
                    </button>

                    <!-- Current Time -->
                    <div
                      v-if="isToday(currentDate)"
                      class="absolute w-full border-t-2 border-red-500 z-30 pointer-events-none flex items-center"
                      :style="getCurrentTimeIndicatorStyle(currentDate)"
                    >
                      <div class="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Appointment Details Modal -->
    <AppointmentDetailsModal
      :isOpen="showDetailsModal"
      :appointment="selectedAppointment"
      :loading="updatingStatus"
      @close="showDetailsModal = false"
      @update-status="updateStatus"
    />

    <!-- Block Time Modal -->
    <BlockTimeModal
      :isOpen="showBlockModal"
      :staff-id="selectedStaffId"
      :staff-list="staff"
      :initial-date="blockModalDate"
      :min-time="calendarStartHour.toString().padStart(2, '0') + ':00'"
      :max-time="calendarEndHour.toString().padStart(2, '0') + ':00'"
      :loading="savingBlock"
      @close="showBlockModal = false"
      @save="handleBlockSave"
    />

    <!-- Block Details Modal -->
    <BlockDetailsModal
      :isOpen="showBlockDetailsModal"
      :block="selectedBlock"
      :loading="deletingBlock"
      @close="showBlockDetailsModal = false"
      @delete="handleBlockDelete"
    />

    <!-- Conflict Confirmation Modal -->
    <ConfirmationModal
      :isOpen="showConflictModal"
      :title="$t('calendar.conflict_title') || 'Unable to Block Time'"
      :message="conflictMessage"
      :confirmLabel="$t('common.ok') || 'OK'"
      :isDestructive="false"
      @close="showConflictModal = false"
      @confirm="showConflictModal = false"
    />
  </div>
</template>

<style scoped>
@reference "../../style.css";

.calendar-tabs {
  @apply grid w-[300px] grid-cols-3 rounded-md bg-gray-100 p-1;
}

.calendar-tab {
  @apply rounded px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300;
}

.calendar-tab--active {
  @apply bg-white text-gray-950 shadow-sm;
}

.calendar-card {
  @apply overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm;
}

.calendar-card__header {
  @apply border-b border-gray-200 bg-gray-50/40 p-4;
}

.calendar-icon-button {
  @apply inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300;
}

.calendar-today-button {
  @apply rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300;
}
</style>
