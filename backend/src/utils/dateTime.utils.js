import { isValidHHMM, toMinutes } from "./time.js";

function isValidDateKey(dateKey) {
  return typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

function toDateTime(dateKey, hhmm) {
  if (!isValidDateKey(dateKey)) throw new Error("Invalid dateKey format");
  if (!isValidHHMM(hhmm)) throw new Error("Invalid time format");

  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);

  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function isSlotValid(slot) {
  if (!slot || typeof slot !== "object") return false;
  if (!isValidHHMM(slot.start) || !isValidHHMM(slot.end)) return false;
  return toMinutes(slot.start) < toMinutes(slot.end);
}

function isSameSlot(a, b) {
  return a.start === b.start && a.end === b.end;
}

export { isValidDateKey, toDateTime, isSlotValid, isSameSlot };
