import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  Lock,
  Receipt,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DataTable, EmptyState, Panel, SectionHeader, StatusBadge } from "@/components/dashboard/primitives";
import {
  applicationStage,
  applicationSteps,
  currency,
  deriveActions,
  formatDate,
  formatDateTime,
  maskIdentifier,
  nextStep,
  reference,
  serviceLabel,
  statusInfo,
  type Booking,
  type Fine,
  type Notice,
  type Profile,
  type Vehicle,
} from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

type Common = {
  profile: Profile | null;
  bookings: Booking[];
  vehicles: Vehicle[];
  fines: Fine[];
  onNavigate: (section: string) => void;
};

/* ------------------------------------------------------------------ Overview */

export function CitizenOverview({
  profile,
  bookings,
  vehicles,
  fines,
  notices,
  readIds,
  onNavigate,
}: Common & { notices: Notice[]; readIds: string[] }) {
  const actions = deriveActions(bookings, fines, vehicles);
  const active = bookings.filter((booking) => booking.status === "pending" || booking.status === "approved");
  const unpaid = fines.filter((fine) => fine.payment_status === "unpaid");

  const cards = [
    { key: "applications", label: "Active applications", value: active.length, icon: ClipboardList, hint: "In progress" },
    { key: "vehicles", label: "My vehicles", value: vehicles.length, icon: Car, hint: "Registered to you" },
    { key: "fines", label: "Outstanding fines", value: unpaid.length, icon: Ticket, hint: unpaid.length ? currency(unpaid.reduce((sum, fine) => sum + Number(fine.amount), 0)) : "Nothing due" },
    { key: "overview", label: "Upcoming actions", value: actions.length, icon: Bell, hint: actions.length ? "Needs attention" : "All clear" },
  ] as const;

  return (
    <div className="space-y-8">
      <SectionHeader title="Overview" description="A summary of your traffic services, applications, vehicles and fines." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ key, label, value, icon: Icon, hint }) => (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate(key)}
            className="group rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex items-center justify-between">
              <Icon aria-hidden="true" className="size-5 text-primary" />
              <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="mt-6 block text-sm text-muted-foreground">{label}</span>
            <span className="mt-1 block text-3xl font-black tabular-nums">{value}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>

      <section aria-labelledby="action-required">
        <h2 id="action-required" className="mb-3 text-lg font-bold">Action required</h2>
        {actions.length ? (
          <ul className="space-y-3">
            {actions.map((action) => (
              <li key={action.id} className={cn("rounded-lg border p-5", action.tone === "warning" ? "border-warning/60 bg-warning/10" : "border-primary/30 bg-primary/5")}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-foreground" />
                  <div className="min-w-0">
                    <p className="font-semibold">{action.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{action.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => onNavigate(action.target)}>View details</Button>
                      <Button size="sm" variant="outline" onClick={() => onNavigate("help")}>Get help</Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Panel className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
            <p className="text-sm">You're all caught up. There are no actions requiring your attention.</p>
          </Panel>
        )}
      </section>

      <section aria-labelledby="recent-applications">
        <SectionHeader
          title="Application activity"
          description="Your most recent submissions and where they are in the process."
          action={<Button variant="outline" size="sm" onClick={() => onNavigate("applications")}>View all applications</Button>}
        />
        <h2 id="recent-applications" className="sr-only">Recent applications</h2>
        <div className="mt-4">
          <ApplicationList bookings={bookings.slice(0, 3)} onNavigate={onNavigate} compact />
        </div>
      </section>

      <section aria-labelledby="overview-vehicles">
        <SectionHeader title="My vehicles" description="Vehicles linked to your identity number." action={<Button variant="outline" size="sm" onClick={() => onNavigate("vehicles")}>Manage vehicles</Button>} />
        <h2 id="overview-vehicles" className="sr-only">Vehicle summary</h2>
        <div className="mt-4">
          {vehicles.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {vehicles.slice(0, 3).map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} onNavigate={onNavigate} />)}
            </div>
          ) : (
            <EmptyState icon={Car} title="No vehicles registered" description="Register a vehicle to receive its disc reference and track verification." action={<Button onClick={() => onNavigate("vehicles")}>Register a vehicle</Button>} />
          )}
        </div>
      </section>

      <section aria-labelledby="overview-services">
        <h2 id="overview-services" className="mb-3 text-lg font-bold">Traffic services</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Book a test", "Learner's or driver's licence", "services"],
            ["Register a vehicle", "Add a vehicle to your profile", "vehicles"],
            ["Pay a fine", "Settle outstanding fines securely", "fines"],
            ["My documents", "Access issued service documents", "documents"],
            ["Notifications", "Service updates and reminders", "notifications"],
            ["Help & support", "FAQs and digital assistant", "help"],
          ].map(([title, description, target]) => (
            <button
              key={title}
              type="button"
              onClick={() => onNavigate(target!)}
              className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="block font-semibold">{title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="overview-notifications">
        <SectionHeader title="Recent notifications" action={<Button variant="outline" size="sm" onClick={() => onNavigate("notifications")}>Open notification centre</Button>} />
        <h2 id="overview-notifications" className="sr-only">Recent notifications</h2>
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {notices.slice(0, 4).map((notice) => (
            <li key={notice.id} className="flex items-start gap-3 p-4">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", readIds.includes(notice.id) ? "bg-border" : "bg-primary")} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{notice.title}</p>
                <p className="text-xs text-muted-foreground">{notice.service} · {formatDateTime(notice.at)}{readIds.includes(notice.id) ? "" : " · Unread"}</p>
              </div>
            </li>
          ))}
          {notices.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</li> : null}
        </ul>
      </section>

      <Panel className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-semibold text-foreground">{profile?.full_name ?? "citizen"}</span>. Identity number {maskIdentifier(profile?.id_number)} — sensitive details are masked on this dashboard.
        </p>
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------- Applications */

function ProgressTracker({ status }: { status: string }) {
  const { index, message } = applicationStage(status);
  return (
    <div>
      <ol className="grid gap-2 sm:grid-cols-5">
        {applicationSteps.map((step, stepIndex) => {
          const done = stepIndex < index;
          const current = stepIndex === index;
          return (
            <li key={step} className="flex items-center gap-2 sm:block">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-[11px] font-bold sm:mb-2",
                  done && "border-success bg-success text-primary-foreground",
                  current && "border-primary bg-primary text-primary-foreground",
                  !done && !current && "border-border bg-muted text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {done ? "✓" : stepIndex + 1}
              </span>
              <span className={cn("text-xs", current ? "font-bold text-foreground" : "text-muted-foreground")}>
                {step}
                <span className="sr-only">{done ? " — completed" : current ? " — current step" : " — pending"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 rounded-md bg-muted p-3 text-sm">{message}</p>
    </div>
  );
}

function ApplicationDetails({ booking }: { booking: Booking }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">View details</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{serviceLabel[booking.booking_type] ?? "Application"}</DialogTitle>
          <DialogDescription>Reference {reference("APP", booking.id)} · submitted {formatDate(booking.created_at)}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted-foreground">Traffic department</dt><dd className="font-medium">{booking.traffic_department}</dd></div>
          <div><dt className="text-muted-foreground">Preferred date</dt><dd className="font-medium">{formatDate(booking.preferred_date)}</dd></div>
          <div><dt className="text-muted-foreground">Appointment</dt><dd className="font-medium">{booking.appointment_date ? formatDateTime(booking.appointment_date) : "Awaiting confirmation"}</dd></div>
          <div><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{formatDate(booking.updated_at)}</dd></div>
        </dl>
        <ProgressTracker status={booking.status} />
      </DialogContent>
    </Dialog>
  );
}

function ApplicationList({ bookings, onNavigate, compact = false, onCancel }: { bookings: Booking[]; onNavigate: (section: string) => void; compact?: boolean; onCancel?: (id: string) => void }) {
  if (!bookings.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="You don't have any applications yet"
        description="Book a learner's or driver's licence test to get started."
        action={<Button onClick={() => onNavigate("services")}>Book a test</Button>}
      />
    );
  }
  return (
    <ul className="grid gap-4">
      {bookings.map((booking) => (
        <li key={booking.id} className="rounded-lg border border-border bg-card p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{serviceLabel[booking.booking_type] ?? booking.booking_type}</p>
              <p className="text-xs text-muted-foreground">Reference {reference("APP", booking.id)} · submitted {formatDate(booking.created_at)}</p>
            </div>
            <StatusBadge value={booking.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Department</dt><dd className="font-medium">{booking.traffic_department}</dd></div>
            <div><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{formatDate(booking.updated_at)}</dd></div>
            <div><dt className="text-muted-foreground">Next step</dt><dd className="font-medium">{nextStep(booking.status)}</dd></div>
          </dl>
          {!compact ? <div className="mt-4"><ProgressTracker status={booking.status} /></div> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <ApplicationDetails booking={booking} />
            {onCancel && booking.status === "pending" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" variant="ghost">Cancel application</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this application?</AlertDialogTitle>
                    <AlertDialogDescription>This withdraws your request for {serviceLabel[booking.booking_type]}. You can submit a new booking afterwards.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep application</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onCancel(booking.id)}>Cancel application</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ApplicationsSection({ bookings, onNavigate, onCancel }: { bookings: Booking[]; onNavigate: (section: string) => void; onCancel: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Applications" description="Every service request you have submitted and its current progress." action={<Button onClick={() => onNavigate("services")}>New application</Button>} />
      <ApplicationList bookings={bookings} onNavigate={onNavigate} onCancel={onCancel} />
    </div>
  );
}

/* ------------------------------------------------------------------ Services */

export function ServicesSection({ profile, onBook, onNavigate }: { profile: Profile | null; onBook: (draft: BookingDraft) => Promise<void>; onNavigate: (section: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Traffic services" description="Apply for licence tests and vehicle services from one secure portal." />

      <BookingWizard profile={profile} onSubmit={onBook} />


      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["Renew licence", "Renew an expiring learner's or driver's licence card.", "Bring your identity document and a recent photograph to your traffic department. Online renewal capture is not yet available in this portal."],
          ["Vehicle registration", "Register a vehicle and obtain your disc reference.", "Use My vehicles to submit the registration for verification."],
          ["Change of vehicle details", "Update address, colour or ownership details.", "Submit the change at your traffic department; online capture is not yet available in this portal."],
          ["Other available services", "Duplicate documents, roadworthy bookings and enquiries.", "Contact the support desk under Help & support for these services."],
        ].map(([title, description, note]) => (
          <Panel key={title}>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <p className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">{note}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => onNavigate(title === "Vehicle registration" ? "vehicles" : "help")}>
              {title === "Vehicle registration" ? "Go to My vehicles" : "Contact support"}
            </Button>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Vehicles */

function VehicleCard({ vehicle, onNavigate }: { vehicle: Vehicle; onNavigate: (section: string) => void }) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black tracking-wide">{vehicle.number_plate}</p>
          <p className="truncate text-sm text-muted-foreground">{vehicle.make} {vehicle.model}{vehicle.manufacture_year ? ` · ${vehicle.manufacture_year}` : ""}</p>
        </div>
        <StatusBadge value={vehicle.registration_status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-muted-foreground">Registered</dt><dd className="font-medium">{formatDate(vehicle.created_at)}</dd></div>
        <div><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{formatDate(vehicle.updated_at)}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild><Button size="sm" variant="outline">View details</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{vehicle.number_plate}</DialogTitle>
              <DialogDescription>Vehicle registered to your account.</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Make and model</dt><dd className="font-medium">{vehicle.make} {vehicle.model}</dd></div>
              <div><dt className="text-muted-foreground">Year</dt><dd className="font-medium">{vehicle.manufacture_year ?? "Not recorded"}</dd></div>
              <div><dt className="text-muted-foreground">Colour</dt><dd className="font-medium">{vehicle.color ?? "Not recorded"}</dd></div>
              <div><dt className="text-muted-foreground">Status</dt><dd><StatusBadge value={vehicle.registration_status} /></dd></div>
            </dl>
          </DialogContent>
        </Dialog>
        <Button size="sm" variant="ghost" onClick={() => onNavigate("documents")}>View documents</Button>
      </div>
    </article>
  );
}

export function VehiclesSection({ vehicles, onRegister, onNavigate }: { vehicles: Vehicle[]; onRegister: (event: FormEvent<HTMLFormElement>) => void; onNavigate: (section: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="My vehicles" description="Vehicles linked to your account and their verification status." />
      <Panel>
        <h2 className="text-lg font-bold">Register a vehicle</h2>
        <form onSubmit={onRegister} className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="field"><Label className="field-label" htmlFor="v-plate">Number plate</Label><Input id="v-plate" name="plate" placeholder="ABC 123 GP" required /></div>
          <div className="field"><Label className="field-label" htmlFor="v-make">Make</Label><Input id="v-make" name="make" placeholder="Toyota" required /></div>
          <div className="field"><Label className="field-label" htmlFor="v-model">Model</Label><Input id="v-model" name="model" placeholder="Corolla" required /></div>
          <Button type="submit" className="self-end">Register vehicle</Button>
        </form>
      </Panel>
      {vehicles.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{vehicles.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} onNavigate={onNavigate} />)}</div>
      ) : (
        <EmptyState icon={Car} title="No vehicles registered yet" description="Register your vehicle above to track verification and access its documents." />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- Fines */

export function FinesSection({ fines, onPay }: { fines: Fine[]; onPay: (fine: Fine) => void }) {
  const unpaid = fines.filter((fine) => fine.payment_status === "unpaid");
  return (
    <div className="space-y-6">
      <SectionHeader title="Traffic fines" description="Outstanding and historical fines issued against your record." />
      {unpaid.length === 0 ? (
        <Panel className="flex items-start gap-3 border-success/40 bg-success/5">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
          <div><p className="font-semibold">No outstanding fines</p><p className="text-sm text-muted-foreground">You currently have no unpaid traffic fines.</p></div>
        </Panel>
      ) : (
        <ul className="grid gap-4">
          {unpaid.map((fine) => (
            <li key={fine.id} className="rounded-lg border border-warning/60 bg-warning/5 p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{fine.offence}</p>
                  <p className="text-xs text-muted-foreground">Reference {fine.reference_number} · issued {formatDate(fine.offence_date)}</p>
                </div>
                <StatusBadge value={fine.payment_status} />
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-muted-foreground">Amount</dt><dd className="text-lg font-black">{currency(Number(fine.amount))}</dd></div>
                <div><dt className="text-muted-foreground">Due date</dt><dd className="font-medium">{formatDate(fine.due_date)}</dd></div>
                <div><dt className="text-muted-foreground">Location</dt><dd className="font-medium">{fine.location}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="sm"><CreditCard aria-hidden="true" /> Pay securely</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm secure payment</AlertDialogTitle>
                      <AlertDialogDescription>
                        {currency(Number(fine.amount))} for fine {fine.reference_number} will be recorded through the secure government traffic services channel.
                        Card processing is not yet activated for this portal — a pending payment record is created and you will be notified when settlement is confirmed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onPay(fine)}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Dialog>
                  <DialogTrigger asChild><Button size="sm" variant="outline">View details</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Fine {fine.reference_number}</DialogTitle>
                      <DialogDescription>{fine.offence}</DialogDescription>
                    </DialogHeader>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-muted-foreground">Offence date</dt><dd className="font-medium">{formatDate(fine.offence_date)}</dd></div>
                      <div><dt className="text-muted-foreground">Location</dt><dd className="font-medium">{fine.location}</dd></div>
                      <div><dt className="text-muted-foreground">Amount</dt><dd className="font-medium">{currency(Number(fine.amount))}</dd></div>
                      <div><dt className="text-muted-foreground">Due</dt><dd className="font-medium">{formatDate(fine.due_date)}</dd></div>
                    </dl>
                    <DialogFooter className="text-xs text-muted-foreground sm:justify-start">
                      <span className="flex items-center gap-1.5"><Lock aria-hidden="true" className="size-3" /> Processed by the secure government traffic services channel.</span>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="fine-history">
        <h2 id="fine-history" className="mb-3 text-lg font-bold">Fine history</h2>
        <DataTable
          caption="History of all traffic fines"
          headers={["Reference", "Date", "Description", "Amount", "Due", "Status"]}
          rows={fines.map((fine) => [fine.reference_number, formatDate(fine.offence_date), fine.offence, currency(Number(fine.amount)), formatDate(fine.due_date), <StatusBadge key={fine.id} value={fine.payment_status} />])}
        />
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- Documents */

export function DocumentsSection({ bookings, vehicles }: { bookings: Booking[]; vehicles: Vehicle[] }) {
  const issued = [
    ...bookings.filter((booking) => booking.status === "passed" || booking.status === "approved").map((booking) => ({
      id: booking.id,
      name: `${serviceLabel[booking.booking_type] ?? "Application"} confirmation`,
      ref: reference("APP", booking.id),
      date: booking.updated_at,
    })),
    ...vehicles.filter((vehicle) => vehicle.registration_status === "verified").map((vehicle) => ({
      id: vehicle.id,
      name: `Vehicle disc reference — ${vehicle.number_plate}`,
      ref: reference("VEH", vehicle.id),
      date: vehicle.updated_at,
    })),
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Documents" description="Records issued for your approved services." />
      {issued.length ? (
        <ul className="grid gap-3">
          {issued.map((document) => (
            <li key={document.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card p-4">
              <FileText aria-hidden="true" className="size-5 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium">{document.name}</p>
                <p className="text-xs text-muted-foreground">{document.ref} · {formatDate(document.date)}</p>
              </div>
              <Dialog>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Download aria-hidden="true" /> Access</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{document.name}</DialogTitle>
                    <DialogDescription>
                      Quote reference {document.ref} at your traffic department to collect the printed document. Digital issuing of signed documents is not yet activated for this portal.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FileText} title="No documents available yet" description="Documents appear here once an application is approved or a vehicle registration is verified." />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Notifications */

export function NotificationsSection({ notices, readIds, onRead, onReadAll, onNavigate }: { notices: Notice[]; readIds: string[]; onRead: (id: string) => void; onReadAll: () => void; onNavigate: (section: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Notifications" description="Service updates and reminders linked to your account." action={notices.length ? <Button variant="outline" size="sm" onClick={onReadAll}>Mark all as read</Button> : undefined} />
      {notices.length ? (
        <ul className="grid gap-3">
          {notices.map((notice) => {
            const read = readIds.includes(notice.id);
            return (
              <li key={notice.id} className={cn("rounded-lg border p-4", read ? "border-border bg-card" : "border-primary/30 bg-primary/5")}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <Bell aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-semibold">{notice.title} {read ? null : <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Unread</span>}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{notice.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{notice.service} · {formatDateTime(notice.at)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { onRead(notice.id); onNavigate(notice.target); }}>Open {notice.service.toLowerCase()}</Button>
                      {read ? null : <Button size="sm" variant="ghost" onClick={() => onRead(notice.id)}>Mark as read</Button>}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="No notifications" description="You will be notified here when an application, vehicle or fine is updated." />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- Help */

export function HelpSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Help & support" description="Answers to common questions and ways to reach the support desk." />
      <Panel>
        <Accordion type="single" collapsible className="w-full">
          {[
            ["How do I book a learner's test?", "Open Traffic services, choose Learner's licence, select a preferred date and traffic department, then submit. An administrator reviews the request."],
            ["When is my test?", "Approved applications show the confirmed appointment under Applications and in the Action required section on your overview."],
            ["How do I view my vehicle?", "Go to My vehicles. Each card shows the number plate, make, model and verification status."],
            ["Do I have outstanding fines?", "The Fines section lists unpaid fines with amounts and due dates, and shows a clear message when nothing is due."],
            ["How do I renew my licence?", "Renewals are listed under Traffic services with the documents you must bring to your traffic department."],
            ["What documents do I need?", "Typically your identity document, proof of residence not older than three months and the relevant application form."],
          ].map(([question, answer], index) => (
            <AccordionItem key={question} value={`faq-${index}`}>
              <AccordionTrigger className="text-left">{question}</AccordionTrigger>
              <AccordionContent>{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <HelpCircle aria-hidden="true" className="size-5 text-primary" />
          <h3 className="mt-3 font-semibold">Contact the support desk</h3>
          <p className="mt-1 text-sm text-muted-foreground">Weekdays 08:00–16:00. Have your application reference ready.</p>
          <p className="mt-3 text-sm font-medium">support@roadready.gov.za · 0800 000 123</p>
        </Panel>
        <Panel>
          <Receipt aria-hidden="true" className="size-5 text-primary" />
          <h3 className="mt-3 font-semibold">Digital assistant</h3>
          <p className="mt-1 text-sm text-muted-foreground">Use the Traffic Services Assistant at the bottom-right of the screen for instant answers about your own records.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => onNavigate("overview")}>Back to overview</Button>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Security */

export function ProfileSection({ profile }: { profile: Profile | null }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-6">
      <SectionHeader title="My profile" description="Your citizen record. Sensitive identifiers are masked by default." />
      <Panel>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-muted-foreground">Full name</dt><dd className="font-medium">{profile?.full_name ?? "—"}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Email</dt><dd className="font-medium break-all">{profile?.email ?? "—"}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Phone</dt><dd className="font-medium">{profile?.phone ?? "Not recorded"}</dd></div>
          <div>
            <dt className="text-sm text-muted-foreground">Identity number</dt>
            <dd className="font-medium">{revealed ? profile?.id_number ?? "Not recorded" : maskIdentifier(profile?.id_number)}</dd>
          </div>
          <div><dt className="text-sm text-muted-foreground">Learner's licence</dt><dd className="font-medium">{revealed ? profile?.learners_number ?? "Not recorded" : maskIdentifier(profile?.learners_number)}</dd></div>
          <div><dt className="text-sm text-muted-foreground">Driver's licence</dt><dd className="font-medium">{revealed ? profile?.drivers_number ?? "Not recorded" : maskIdentifier(profile?.drivers_number)}</dd></div>
        </dl>
        <Button variant="outline" size="sm" className="mt-5" onClick={() => setRevealed(!revealed)} aria-pressed={revealed}>
          {revealed ? "Hide sensitive details" : "Reveal sensitive details"}
        </Button>
      </Panel>
    </div>
  );
}

export function SecuritySection({ email, onPasswordReset, onSignOutEverywhere }: { email: string; onPasswordReset: () => void; onSignOutEverywhere: () => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Account & security" description="Protect your account and review how it is being accessed." />
      <Panel className="flex items-start gap-3 border-success/40 bg-success/5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
        <div><p className="font-semibold">Secure session active</p><p className="text-sm text-muted-foreground">Your connection is encrypted and your session token is refreshed automatically.</p></div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h3 className="font-semibold">Change password</h3>
          <p className="mt-1 text-sm text-muted-foreground">We email a secure reset link to {email}.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onPasswordReset}>Send reset link</Button>
        </Panel>
        <Panel>
          <h3 className="font-semibold">Two-factor authentication</h3>
          <p className="mt-1 text-sm text-muted-foreground">Additional verification is not yet enabled for this portal. Use a strong, unique password in the meantime.</p>
          <Button variant="outline" size="sm" className="mt-4" disabled>Not available yet</Button>
        </Panel>
        <Panel>
          <h3 className="font-semibold">Active sessions</h3>
          <p className="mt-1 text-sm text-muted-foreground">This device holds the only session token stored by the portal.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="mt-4">Sign out of all sessions</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out everywhere?</AlertDialogTitle>
                <AlertDialogDescription>All devices signed in with this account will be logged out immediately.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onSignOutEverywhere}>Sign out everywhere</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Panel>
        <Panel>
          <h3 className="font-semibold">Security notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">Sign-in alerts are sent to your registered email address. Never share passwords, PINs or banking credentials with anyone.</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3.5" /> Last activity {formatDateTime(new Date().toISOString())}</p>
        </Panel>
      </div>
    </div>
  );
}
