import { toMinutes } from "./time.js";

function minutesToHHMM(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateSlotsFromWindows(windows, durationMinutes) {
  const slots = [];

  for (const w of windows) {
    const startMin = toMinutes(w.start);
    const endMin = toMinutes(w.end);

    let cur = startMin;

    while (cur + durationMinutes <= endMin) {
      slots.push({
        start: minutesToHHMM(cur),
        end: minutesToHHMM(cur + durationMinutes),
      });
      cur += durationMinutes;
    }
  }

  return slots;
}
