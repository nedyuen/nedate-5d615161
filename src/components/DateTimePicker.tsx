import { useEffect, useState } from "react";

const MINUTES = ["00", "15", "30", "45"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

/** Splits a `YYYY-MM-DDTHH:mm` value into a date + time (15-min) picker. */
export function DateTimePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");

  useEffect(() => {
    if (value && value.includes("T")) {
      const [d, t] = value.split("T");
      const [h, m] = (t ?? "").split(":");
      setDate(d ?? "");
      setHour(h ?? "");
      // snap to nearest allowed minute slot
      const snapped = MINUTES.includes(m) ? m : "";
      setMinute(snapped);
    } else {
      setDate(""); setHour(""); setMinute("");
    }
  }, [value]);

  function emit(d: string, h: string, m: string) {
    if (d && h && m) onChange(`${d}T${h}:${m}`);
    else onChange("");
  }

  const selectCls =
    "rounded-2xl border border-input bg-card px-3 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      <input
        type="date"
        value={date}
        onChange={(e) => { setDate(e.target.value); emit(e.target.value, hour, minute); }}
        className={`${selectCls} flex-1 min-w-[160px]`}
      />
      <select
        value={hour}
        onChange={(e) => { setHour(e.target.value); emit(date, e.target.value, minute); }}
        className={selectCls}
        aria-label="Hour"
      >
        <option value="">HH</option>
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <select
        value={minute}
        onChange={(e) => { setMinute(e.target.value); emit(date, hour, e.target.value); }}
        className={selectCls}
        aria-label="Minute"
      >
        <option value="">MM</option>
        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}
