function isValidHHMM(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isTimeInWindow(time, start, end) {
  const t = toMinutes(time);
  const s = toMinutes(start);
  const e = toMinutes(end);
  return t >= s && t < e;
}

export { isValidHHMM, toMinutes, isTimeInWindow };
