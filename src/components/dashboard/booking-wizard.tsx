import { useMemo, useState } from "react";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Panel } from "@/components/dashboard/primitives";
import { formatDate, serviceLabel, type Profile } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

export type BookingDraft = {
  type: "learners" | "drivers";
  vehicleClass: string;
  date: string;
  department: string;
  slot: string;
};

export const vehicleClasses = [
  { code: "A1", label: "A1 — Motorcycle under 125cc" },
  { code: "A", label: "A — Motorcycle any engine size" },
  { code: "B", label: "B — Light motor vehicle (car)" },
  { code: "EB", label: "EB — Light vehicle with trailer" },
  { code: "C1", label: "C1 — Heavy motor vehicle up to 16 000kg" },
  { code: "C", label: "C — Heavy motor vehicle above 16 000kg" },
  { code: "EC", label: "EC — Articulated / truck-trailer combination" },
] as const;

const departments = [
  "Centurion Traffic Department",
  "Pretoria (Waltloo) Testing Centre",
  "Johannesburg (Langlaagte) Testing Centre",
  "Randburg Licensing Department",
  "Sandton Licensing Department",
];

const slots = ["08:00", "09:00", "10:30", "12:00", "13:30", "15:00"];

/** Deterministic mock availability: weekdays only, some days shown as fully booked. */
function dayCapacity(date: Date, department: string) {
  const seed = date.getDate() + date.getMonth() * 31 + department.length;
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return 0;
  return [0, 2, 4, 6, 3, 5, 1][seed % 7]!;
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const steps = ["Licence type", "Date & centre", "Review & confirm"] as const;

export function BookingWizard({
  profile,
  onSubmit,
}: {
  profile: Profile | null;
  onSubmit: (draft: BookingDraft) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"learners" | "drivers">("learners");
  const [vehicleClass, setVehicleClass] = useState("B");
  const [department, setDepartment] = useState(departments[0]!);
  const [selected, setSelected] = useState<Date | undefined>();
  const [slot, setSlot] = useState(slots[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<BookingDraft | null>(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const available = selected ? dayCapacity(selected, department) : 0;
  const needsLearners = type === "drivers" && !profile?.learners_number;

  function next() {
    setError("");
    if (step === 0 && needsLearners) {
      setError("A recorded learner's licence is required before booking a driver's test.");
      return;
    }
    if (step === 1) {
      if (!selected) { setError("Choose an available date."); return; }
      if (!available) { setError("That date is fully booked. Please choose another."); return; }
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function confirm() {
    if (!selected) return;
    const draft: BookingDraft = { type, vehicleClass, date: toIso(selected), department, slot };
    setBusy(true);
    setError("");
    try {
      await onSubmit(draft);
      setConfirmation(draft);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't submit this booking.");
    } finally {
      setBusy(false);
    }
  }

  if (confirmation) {
    return (
      <Panel className="border-success/40 bg-success/5">
        <div className="flex items-start gap-3">
          <CalendarCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-success" />
          <div>
            <h2 className="text-lg font-bold">Booking request confirmed</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your {serviceLabel[confirmation.type]} request for code {confirmation.vehicleClass} has been submitted and is awaiting
              administrator approval.
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Preferred date</dt><dd className="font-medium">{formatDate(confirmation.date)} at {confirmation.slot}</dd></div>
              <div><dt className="text-muted-foreground">Testing centre</dt><dd className="font-medium">{confirmation.department}</dd></div>
            </dl>
            <Button className="mt-5" variant="outline" onClick={() => { setConfirmation(null); setStep(0); setSelected(undefined); }}>
              Make another booking
            </Button>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <h2 className="text-lg font-bold">Book a learner&apos;s or driver&apos;s test</h2>
      <p className="mt-1 text-sm text-muted-foreground">Three quick steps. A traffic administrator confirms your appointment.</p>

      <ol className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Booking steps">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm",
              index === step && "border-primary bg-primary/5 font-semibold",
              index < step && "text-muted-foreground",
            )}
          >
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border border-border text-xs font-bold", index <= step && "border-primary bg-primary text-primary-foreground")}>
              {index < step ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === 0 ? (
          <div className="grid max-w-2xl gap-5">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold">Test type</legend>
              {(["learners", "drivers"] as const).map((value) => (
                <label key={value} className={cn("flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm", type === value && "border-primary bg-primary/5")}>
                  <input type="radio" name="test-type" value={value} checked={type === value} onChange={() => setType(value)} className="mt-1" />
                  <span>
                    <span className="block font-medium">{serviceLabel[value]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {value === "learners" ? "Written test on rules of the road, signs and vehicle controls." : "Practical driving test. Requires a valid learner's licence."}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="field">
              <Label className="field-label" htmlFor="vehicle-class">Vehicle class</Label>
              <select
                id="vehicle-class"
                value={vehicleClass}
                onChange={(event) => setVehicleClass(event.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {vehicleClasses.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </div>

            {needsLearners ? (
              <p className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
                No learner&apos;s licence is recorded on your profile, so a driver&apos;s test cannot be booked yet.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div className="rounded-md border border-border p-2">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={setSelected}
                disabled={(date) => date < today || dayCapacity(date, department) === 0}
              />
            </div>
            <div className="grid content-start gap-5">
              <div className="field">
                <Label className="field-label" htmlFor="centre">Testing centre</Label>
                <select
                  id="centre"
                  value={department}
                  onChange={(event) => { setDepartment(event.target.value); setSelected(undefined); }}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {departments.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <p className="text-sm font-semibold">Available time slots</p>
                <p className="text-xs text-muted-foreground">
                  {selected ? `${available} slot${available === 1 ? "" : "s"} left on ${formatDate(toIso(selected))}` : "Pick an available date on the calendar. Greyed-out days are full or closed."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {slots.slice(0, Math.max(available, 1)).map((option) => (
                    <Button key={option} type="button" size="sm" variant={slot === option ? "default" : "outline"} disabled={!selected || !available} onClick={() => setSlot(option)}>
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 && selected ? (
          <dl className="grid max-w-2xl gap-3 rounded-md border border-border p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Test type</dt><dd className="font-medium">{serviceLabel[type]}</dd></div>
            <div><dt className="text-muted-foreground">Vehicle class</dt><dd className="font-medium">{vehicleClasses.find((option) => option.code === vehicleClass)?.label}</dd></div>
            <div><dt className="text-muted-foreground">Date and time</dt><dd className="font-medium">{formatDate(toIso(selected))} at {slot}</dd></div>
            <div><dt className="text-muted-foreground">Testing centre</dt><dd className="font-medium">{department}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Applicant</dt><dd className="font-medium">{profile?.full_name ?? "Your account"}</dd></div>
          </dl>
        ) : null}
      </div>

      {error ? <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={step === 0 || busy} onClick={() => { setError(""); setStep((current) => current - 1); }}>
          <ChevronLeft aria-hidden="true" /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={next}>Continue <ChevronRight aria-hidden="true" /></Button>
        ) : (
          <Button type="button" onClick={() => void confirm()} disabled={busy}>
            {busy ? <><Loader2 aria-hidden="true" className="animate-spin" /> Submitting…</> : <>Confirm booking</>}
          </Button>
        )}
      </div>
    </Panel>
  );
}
