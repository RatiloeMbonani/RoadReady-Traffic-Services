import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Car,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  Search,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, EmptyState, Panel, SectionHeader, StatusBadge } from "@/components/dashboard/primitives";
import {
  appointmentBuckets,
  can,
  countThisMonth,
  currency,
  deriveAdminTasks,
  deriveAuditTrail,
  downloadCsv,
  fineState,
  formatDate,
  formatDateTime,
  reference,
  roleLabel,
  serviceLabel,
  toCsv,
  trendLabel,
  type AdminRole,
} from "@/lib/admin-utils";
import { maskIdentifier, statusInfo, type Booking, type Fine, type Profile, type Vehicle } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

export type AdminData = {
  users: Profile[];
  bookings: Booking[];
  vehicles: Vehicle[];
  fines: Fine[];
  role: AdminRole;
};

type Decision = "approved" | "rejected" | "passed" | "failed";

export type AdminHandlers = {
  onNavigate: (section: string) => void;
  onDecision: (id: string, status: Decision, note?: string) => void | Promise<void>;
  onVehicleDecision: (id: string, status: "verified" | "rejected", note?: string) => void | Promise<void>;
};

const priorityTone: Record<string, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/50 bg-warning/15 text-foreground",
  low: "border-border bg-muted text-muted-foreground",
};

function nameOf(users: Profile[], id?: string | null) {
  if (!id) return "Citizen";
  return users.find((user) => user.id === id)?.full_name ?? "Citizen";
}

function Metric({ label, value, trend, icon: Icon, actionLabel, onAction }: { label: string; value: number; trend: string; icon: typeof Users; actionLabel: string; onAction: () => void }) {
  return (
    <Panel className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon aria-hidden="true" className="size-5 text-primary" />
      </div>
      <p className="text-3xl font-black tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{trend}</p>
      <Button variant="link" className="mt-2 h-auto justify-start p-0 text-sm font-semibold" onClick={onAction}>
        {actionLabel} <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </Panel>
  );
}

/* ------------------------------------------------------------------ Overview */

export function AdminOverview({ data, handlers }: { data: AdminData; handlers: AdminHandlers }) {
  const { users, bookings, vehicles, fines, role } = data;
  const tasks = useMemo(() => deriveAdminTasks(bookings, vehicles, fines), [bookings, vehicles, fines]);
  const audit = useMemo(() => deriveAuditTrail(bookings, vehicles, fines, users), [bookings, vehicles, fines, users]);
  const appointments = useMemo(() => appointmentBuckets(bookings), [bookings]);
  const pending = bookings.filter((booking) => booking.status === "pending");
  const unpaid = fines.filter((fine) => fine.payment_status === "unpaid");

  return (
    <div className="space-y-8">
      <SectionHeader title="Administration overview" description="Monitor citizen activity, applications, vehicles and enforcement in one secure view." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registered citizens" value={users.length} trend={trendLabel(countThisMonth(users as unknown as { created_at: string }[]), "registered")} icon={Users} actionLabel="View all citizens" onAction={() => handlers.onNavigate("citizens:all")} />
        <Metric label="Pending applications" value={pending.length} trend={trendLabel(countThisMonth(pending), "submitted")} icon={ClipboardList} actionLabel="Review applications" onAction={() => handlers.onNavigate("applications:pending")} />
        <Metric label="Registered vehicles" value={vehicles.length} trend={trendLabel(countThisMonth(vehicles), "registered")} icon={Car} actionLabel="Manage vehicles" onAction={() => handlers.onNavigate("vehicles:all")} />
        <Metric label="Outstanding fines" value={unpaid.length} trend={unpaid.length ? `${currency(unpaid.reduce((sum, fine) => sum + Number(fine.amount), 0))} outstanding` : "Nothing outstanding"} icon={Ticket} actionLabel="View fines" onAction={() => handlers.onNavigate("fines:outstanding")} />
      </div>

      <section aria-labelledby="action-required">
        <h2 id="action-required" className="mb-3 text-lg font-bold">Action required</h2>
        {tasks.length ? (
          <ul className="grid gap-3">
            {tasks.map((task) => (
              <li key={task.id}>
                <Panel className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", priorityTone[task.priority])}>{task.priority} priority</span>
                      <span className="text-xs font-semibold text-muted-foreground">{task.service}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(task.at)}</span>
                    </div>
                    <p className="mt-2 font-semibold">{task.title}</p>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                  <Button onClick={() => handlers.onNavigate(task.target)}>{task.actionLabel}</Button>
                </Panel>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CheckCircle2} title="You're all caught up" description="No administrative actions require your attention." />
        )}
      </section>

      <section aria-labelledby="application-activity">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="application-activity" className="text-lg font-bold">Application activity</h2>
          <Button variant="outline" size="sm" onClick={() => handlers.onNavigate("applications:all")}>View all applications</Button>
        </div>
        <DataTable
          caption="Recent applications"
          headers={["Reference", "Applicant", "Service", "Department", "Submitted", "Status"]}
          rows={bookings.slice(0, 6).map((booking) => [
            reference("APP", booking.id),
            nameOf(users, booking.user_id),
            serviceLabel[booking.booking_type] ?? booking.booking_type,
            booking.traffic_department,
            formatDate(booking.created_at),
            <StatusBadge key={booking.id} value={booking.status} />,
          ])}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="admin-activity">
          <h2 id="admin-activity" className="mb-3 text-lg font-bold">Recent administrator activity</h2>
          <Panel className="p-0">
            <ul className="divide-y divide-border">
              {audit.filter((event) => event.actor === "Administrator").slice(0, 5).map((event) => (
                <li key={event.id} className="px-5 py-3">
                  <p className="text-sm font-semibold">{event.action} — {event.resource}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(event.at)} · {event.result}</p>
                </li>
              ))}
              {audit.every((event) => event.actor !== "Administrator") ? <li className="px-5 py-8 text-center text-sm text-muted-foreground">No administrative actions recorded yet.</li> : null}
            </ul>
          </Panel>
        </section>

        <section aria-labelledby="upcoming-appointments">
          <h2 id="upcoming-appointments" className="mb-3 text-lg font-bold">Upcoming appointments</h2>
          <Panel className="p-0">
            <ul className="divide-y divide-border">
              {[...appointments.today, ...appointments.upcoming].slice(0, 5).map((booking) => (
                <li key={booking.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{nameOf(users, booking.user_id)} — {serviceLabel[booking.booking_type]}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatDate(booking.appointment_date ?? booking.preferred_date)} · {booking.traffic_department}</p>
                  </div>
                  <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </li>
              ))}
              {!appointments.today.length && !appointments.upcoming.length ? <li className="px-5 py-8 text-center text-sm text-muted-foreground">No upcoming appointments scheduled.</li> : null}
            </ul>
          </Panel>
        </section>
      </div>

      {can(role, "security:view") ? (
        <section aria-labelledby="security-events">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="security-events" className="text-lg font-bold">Recent security &amp; audit events</h2>
            <Button variant="outline" size="sm" onClick={() => handlers.onNavigate("security:audit")}>Open security &amp; audit</Button>
          </div>
          <DataTable
            caption="Recent audit events"
            headers={["Timestamp", "Actor", "Action", "Resource", "Result"]}
            rows={audit.slice(0, 5).map((event) => [formatDateTime(event.at), event.actor, event.action, event.resource, event.result])}
          />
        </section>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- Applications */

const statusOptions = ["all", "pending", "approved", "rejected", "passed", "failed", "cancelled"];

export function AdminApplications({ data, handlers, filter }: { data: AdminData; handlers: AdminHandlers; filter: string }) {
  const { users, bookings, role } = data;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(filter === "all" ? "all" : filter);
  const [service, setService] = useState("all");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState("newest");
  const [active, setActive] = useState<Booking | null>(null);

  const departments = Array.from(new Set(bookings.map((booking) => booking.traffic_department)));

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = bookings.filter((booking) => {
      if (status !== "all" && booking.status !== status) return false;
      if (service !== "all" && booking.booking_type !== service) return false;
      if (department !== "all" && booking.traffic_department !== department) return false;
      if (!term) return true;
      return [reference("APP", booking.id), nameOf(users, booking.user_id), booking.traffic_department, booking.booking_type].join(" ").toLowerCase().includes(term);
    });
    list = [...list].sort((a, b) => (sort === "newest" ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    return list;
  }, [bookings, users, query, status, service, department, sort]);

  function exportCsv() {
    downloadCsv(
      "applications.csv",
      toCsv(
        ["Reference", "Applicant", "Service", "Department", "Submitted", "Preferred date", "Status"],
        rows.map((booking) => [reference("APP", booking.id), nameOf(users, booking.user_id), serviceLabel[booking.booking_type] ?? booking.booking_type, booking.traffic_department, formatDate(booking.created_at), formatDate(booking.preferred_date), statusInfo(booking.status).label]),
      ),
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Applications"
        description="Search, filter and process citizen licence applications."
        action={<Button variant="outline" onClick={exportCsv}><Download aria-hidden="true" /> Export</Button>}
      />

      <Panel className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <div className="grid gap-1.5">
          <Label htmlFor="app-search">Search applications</Label>
          <Input id="app-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, applicant or department" />
        </div>
        <Field label="Status" id="app-status" value={status} onChange={setStatus} options={statusOptions.map((value) => ({ value, label: value === "all" ? "All statuses" : statusInfo(value).label }))} />
        <Field label="Service" id="app-service" value={service} onChange={setService} options={[{ value: "all", label: "All services" }, { value: "learners", label: "Learner's licence" }, { value: "drivers", label: "Driving licence" }]} />
        <Field label="Department" id="app-dept" value={department} onChange={setDepartment} options={[{ value: "all", label: "All departments" }, ...departments.map((value) => ({ value, label: value }))]} />
        <Field label="Sort" id="app-sort" value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} />
      </Panel>

      {rows.length ? (
        <DataTable
          caption="Applications"
          headers={["Reference", "Applicant", "Service", "Department", "Submitted", "Preferred", "Status", "Assigned", "Actions"]}
          rows={rows.map((booking) => [
            reference("APP", booking.id),
            nameOf(users, booking.user_id),
            serviceLabel[booking.booking_type] ?? booking.booking_type,
            booking.traffic_department,
            formatDate(booking.created_at),
            formatDate(booking.preferred_date),
            <StatusBadge key={`${booking.id}-s`} value={booking.status} />,
            "Unassigned",
            <Button key={`${booking.id}-a`} size="sm" variant="outline" onClick={() => setActive(booking)}>Open review</Button>,
          ])}
        />
      ) : (
        <EmptyState icon={ClipboardList} title="No applications match these filters" description="Adjust the search or filters to see other applications." />
      )}

      <ApplicationReview booking={active} users={users} role={role} onClose={() => setActive(null)} onDecision={handlers.onDecision} />
    </div>
  );
}

function Field({ label, id, value, onChange, options }: { label: string; id: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

const timeline = ["Submitted", "Document verification", "Under review", "Decision", "Completed"];

function timelineIndex(status: string) {
  if (status === "pending") return 2;
  if (status === "approved") return 3;
  if (status === "passed" || status === "failed" || status === "rejected" || status === "cancelled") return 4;
  return 0;
}

function ApplicationReview({ booking, users, role, onClose, onDecision }: { booking: Booking | null; users: Profile[]; role: AdminRole; onClose: () => void; onDecision: AdminHandlers["onDecision"] }) {
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<Decision | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const applicant = booking ? users.find((user) => user.id === booking.user_id) : undefined;
  const allowed = can(role, "applications:review");

  function close() {
    setNote("");
    setConfirm(null);
    setFailure(null);
    setSaving(false);
    onClose();
  }

  async function submit(decision: Decision) {
    if (!booking || saving) return;
    if (decision === "rejected" && !note.trim()) return;
    setSaving(true);
    setFailure(null);
    try {
      await onDecision(booking.id, decision, note.trim() || undefined);
      close();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "We couldn't save this decision. Please try again.");
      setSaving(false);
    }
  }


  return (
    <Dialog open={Boolean(booking)} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        {booking ? (
          <>
            <DialogHeader>
              <DialogTitle>Application {reference("APP", booking.id)}</DialogTitle>
              <DialogDescription>Review the submitted details and record an outcome.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Panel>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Applicant</h3>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <Row term="Name" detail={applicant?.full_name ?? "Citizen"} />
                    <Row term="Contact" detail={applicant?.phone ?? "Not recorded"} />
                    <Row term="Identity number" detail={maskIdentifier(applicant?.id_number)} />
                    <Row term="Learner licence" detail={applicant?.learners_number ? maskIdentifier(applicant.learners_number) : "Not recorded"} />
                  </dl>
                </Panel>
                <Panel>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Application</h3>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <Row term="Service" detail={serviceLabel[booking.booking_type] ?? booking.booking_type} />
                    <Row term="Department" detail={booking.traffic_department} />
                    <Row term="Submitted" detail={formatDate(booking.created_at)} />
                    <Row term="Preferred date" detail={formatDate(booking.preferred_date)} />
                    <Row term="Status" detail={statusInfo(booking.status).label} />
                  </dl>
                </Panel>
              </div>

              <Panel>
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Documents</h3>
                <DataTable
                  caption="Submitted documents"
                  headers={["Document", "Submitted", "Verification", "Actions"]}
                  rows={[[
                    "Application confirmation",
                    formatDate(booking.created_at),
                    <StatusBadge key="doc" value={booking.status === "pending" ? "pending" : "verified"} />,
                    <span key="acts" className="text-xs text-muted-foreground">Upload storage not yet enabled</span>,
                  ]]}
                />
              </Panel>

              <Panel>
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Timeline</h3>
                <ol className="mt-3 grid gap-2 sm:grid-cols-5">
                  {timeline.map((step, index) => (
                    <li key={step} className={cn("rounded-md border px-3 py-2 text-xs font-semibold", index <= timelineIndex(booking.status) ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground")}>
                      {step}
                    </li>
                  ))}
                </ol>
              </Panel>

              {booking.admin_notes ? (
                <Panel>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Internal notes</h3>
                  <p className="mt-2 text-sm">{booking.admin_notes}</p>
                </Panel>
              ) : null}

              {allowed ? (
                <Panel className="grid gap-3">
                  <Label htmlFor="review-note">Internal note / reason</Label>
                  <Textarea id="review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required when rejecting an application." />
                  {confirm ? (
                    <div role="alertdialog" aria-label="Confirm decision" className="rounded-md border border-warning/50 bg-warning/10 p-4">
                      <p className="text-sm font-semibold">Confirm: mark this application {statusInfo(confirm).label.toLowerCase()}?</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {confirm === "rejected"
                          ? "This application will be marked as rejected. The applicant will be notified of the decision and the reason will be stored on the record."
                          : "The applicant will see this outcome on their dashboard immediately."}
                      </p>
                      {confirm === "rejected" && !note.trim() ? <p className="mt-2 text-sm font-semibold text-destructive">A rejection reason is required.</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button onClick={() => void submit(confirm)} disabled={confirm === "rejected" && !note.trim()}>Confirm</Button>
                        <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setConfirm("approved")}>Approve</Button>
                      <Button variant="outline" onClick={() => setConfirm("rejected")}>Reject</Button>
                      <Button variant="secondary" onClick={() => setConfirm("passed")}>Record pass</Button>
                      <Button variant="ghost" onClick={() => setConfirm("failed")}>Record fail</Button>
                    </div>
                  )}
                </Panel>
              ) : (
                <p className="text-sm text-muted-foreground">Your administrator role can view this application but cannot record a decision.</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close}>Close</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ term, detail }: { term: string; detail: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium">{detail}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ Citizens */

export function AdminCitizens({ data, handlers, filter }: { data: AdminData; handlers: AdminHandlers; filter: string }) {
  const { users, bookings, vehicles, fines, role } = data;
  const [query, setQuery] = useState("");
  const [reveal, setReveal] = useState(false);
  const [active, setActive] = useState<Profile | null>(null);

  const filtered = users.filter((person) => {
    const term = query.trim().toLowerCase();
    const hasActivity = bookings.some((b) => b.user_id === person.id) || vehicles.some((v) => v.user_id === person.id);
    if (filter === "active" && !hasActivity) return false;
    if (filter === "suspended") return false;
    if (!term) return true;
    return [person.full_name, person.email, person.phone ?? ""].join(" ").toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title={filter === "active" ? "Active citizens" : filter === "suspended" ? "Suspended citizens" : "Citizens"}
        description="Search citizen accounts and open a complete service history. Sensitive identifiers are masked by default."
        action={can(role, "citizens:reveal") ? (
          <Button variant="outline" onClick={() => setReveal((value) => !value)} aria-pressed={reveal}>
            {reveal ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />} {reveal ? "Hide identifiers" : "Reveal identifiers"}
          </Button>
        ) : undefined}
      />

      <Panel>
        <Label htmlFor="citizen-search">Search citizens</Label>
        <Input id="citizen-search" className="mt-1.5" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email or phone number" />
      </Panel>

      {filter === "suspended" ? (
        <EmptyState icon={Users} title="No suspended accounts" description="Account suspension is not yet enabled in the backend. Suspended accounts will appear here once available." />
      ) : filtered.length ? (
        <DataTable
          caption="Citizens"
          headers={["Citizen", "Reference", "Contact", "Identity", "Vehicles", "Applications", "Outstanding fines", "Actions"]}
          rows={filtered.map((person) => [
            person.full_name,
            reference("CIT", person.id),
            person.email,
            reveal ? person.id_number ?? "Not recorded" : maskIdentifier(person.id_number),
            String(vehicles.filter((vehicle) => vehicle.user_id === person.id).length),
            String(bookings.filter((booking) => booking.user_id === person.id).length),
            String(fines.filter((fine) => fine.user_id === person.id && fine.payment_status === "unpaid").length),
            <Button key={person.id} size="sm" variant="outline" onClick={() => setActive(person)}>View profile</Button>,
          ])}
        />
      ) : (
        <EmptyState icon={Users} title="No citizens found" description="No citizen accounts match this search." />
      )}

      <CitizenProfile person={active} data={data} reveal={reveal} onClose={() => setActive(null)} onNavigate={handlers.onNavigate} />
    </div>
  );
}

function CitizenProfile({ person, data, reveal, onClose }: { person: Profile | null; data: AdminData; reveal: boolean; onClose: () => void; onNavigate: (section: string) => void }) {
  if (!person) return <Dialog open={false} onOpenChange={() => undefined}><DialogContent /></Dialog>;
  const bookings = data.bookings.filter((booking) => booking.user_id === person.id);
  const vehicles = data.vehicles.filter((vehicle) => vehicle.user_id === person.id);
  const fines = data.fines.filter((fine) => fine.user_id === person.id);
  const audit = deriveAuditTrail(bookings, vehicles, fines, data.users);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{person.full_name}</DialogTitle>
          <DialogDescription>Citizen reference {reference("CIT", person.id)}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="fines">Fines</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="pt-4">
            <Panel>
              <dl className="grid gap-2 text-sm">
                <Row term="Email" detail={person.email} />
                <Row term="Phone" detail={person.phone ?? "Not recorded"} />
                <Row term="Identity number" detail={reveal ? person.id_number ?? "Not recorded" : maskIdentifier(person.id_number)} />
                <Row term="Learner licence" detail={reveal ? person.learners_number ?? "Not recorded" : maskIdentifier(person.learners_number)} />
                <Row term="Driving licence" detail={reveal ? person.drivers_number ?? "Not recorded" : maskIdentifier(person.drivers_number)} />
                <Row term="Account status" detail={<StatusBadge value="verified" />} />
              </dl>
            </Panel>
          </TabsContent>
          <TabsContent value="applications" className="pt-4">
            <DataTable caption="Citizen applications" headers={["Reference", "Service", "Preferred", "Status"]} rows={bookings.map((booking) => [reference("APP", booking.id), serviceLabel[booking.booking_type] ?? booking.booking_type, formatDate(booking.preferred_date), <StatusBadge key={booking.id} value={booking.status} />])} />
          </TabsContent>
          <TabsContent value="vehicles" className="pt-4">
            <DataTable caption="Citizen vehicles" headers={["Number plate", "Vehicle", "Status"]} rows={vehicles.map((vehicle) => [vehicle.number_plate, `${vehicle.make} ${vehicle.model}`, <StatusBadge key={vehicle.id} value={vehicle.registration_status} />])} />
          </TabsContent>
          <TabsContent value="fines" className="pt-4">
            <DataTable caption="Citizen fines" headers={["Reference", "Offence", "Amount", "Status"]} rows={fines.map((fine) => [fine.reference_number, fine.offence, currency(Number(fine.amount)), <StatusBadge key={fine.id} value={fineState(fine)} />])} />
          </TabsContent>
          <TabsContent value="activity" className="pt-4">
            <DataTable caption="Citizen activity" headers={["Timestamp", "Action", "Resource", "Result"]} rows={audit.slice(0, 20).map((event) => [formatDateTime(event.at), event.action, event.resource, event.result])} />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Vehicles */

export function AdminVehicles({ data, handlers, filter }: { data: AdminData; handlers: AdminHandlers; filter: string }) {
  const { users, vehicles, role } = data;
  const [query, setQuery] = useState("");
  const [confirmItem, setConfirmItem] = useState<{ vehicle: Vehicle; next: "verified" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const list = vehicles.filter((vehicle) => {
    if (filter === "verification" && vehicle.registration_status !== "pending") return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [vehicle.number_plate, vehicle.make, vehicle.model, vehicle.vin ?? ""].join(" ").toLowerCase().includes(term);
  });

  async function apply() {
    if (!confirmItem) return;
    await handlers.onVehicleDecision(confirmItem.vehicle.id, confirmItem.next, note.trim() || undefined);
    setConfirmItem(null);
    setNote("");
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={filter === "verification" ? "Vehicle verification" : "Registered vehicles"} description="Confirm submitted vehicle information before a disc reference is issued." />

      <Panel>
        <Label htmlFor="vehicle-search">Search registration numbers</Label>
        <Input id="vehicle-search" className="mt-1.5" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="CA 123-456, make or model" />
      </Panel>

      {list.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((vehicle) => (
            <li key={vehicle.id}>
              <Panel className="grid gap-2">
                <p className="font-mono text-xl font-black tracking-wider">{vehicle.number_plate}</p>
                <p className="text-sm">{vehicle.make} {vehicle.model}{vehicle.manufacture_year ? ` · ${vehicle.manufacture_year}` : ""}</p>
                <p className="text-sm text-muted-foreground">Owner: {nameOf(users, vehicle.user_id)}</p>
                <p className="text-sm text-muted-foreground">Registered {formatDate(vehicle.created_at)}</p>
                <StatusBadge value={vehicle.registration_status} />
                {vehicle.admin_notes ? <p className="text-xs text-muted-foreground">Note: {vehicle.admin_notes}</p> : null}
                {can(role, "vehicles:verify") && vehicle.registration_status === "pending" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setConfirmItem({ vehicle, next: "verified" })}>Verify</Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmItem({ vehicle, next: "rejected" })}>Reject</Button>
                  </div>
                ) : null}
              </Panel>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Car} title="No vehicles found" description="No vehicle registrations match this view." />
      )}

      <Dialog open={Boolean(confirmItem)} onOpenChange={(open) => { if (!open) { setConfirmItem(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmItem?.next === "verified" ? "Verify vehicle registration" : "Reject vehicle registration"}</DialogTitle>
            <DialogDescription>
              {confirmItem?.next === "verified"
                ? `${confirmItem?.vehicle.number_plate} will be marked as verified and the owner may collect the vehicle disc reference.`
                : `${confirmItem?.vehicle.number_plate} will be marked as rejected. The owner will be notified and must resubmit with correct details.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="vehicle-note">{confirmItem?.next === "rejected" ? "Rejection reason (required)" : "Internal note (optional)"}</Label>
            <Textarea id="vehicle-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmItem(null); setNote(""); }}>Cancel</Button>
            <Button onClick={() => void apply()} disabled={confirmItem?.next === "rejected" && !note.trim()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------------------------------------------- Fines */

export function AdminFines({ data, filter }: { data: AdminData; filter: string }) {
  const { users, fines, vehicles } = data;
  const [query, setQuery] = useState("");
  const [state, setState] = useState(filter === "outstanding" ? "outstanding" : "all");

  const list = fines.filter((fine) => {
    if (filter === "payments" && fine.payment_status === "unpaid") return false;
    if (state !== "all" && fineState(fine) !== state) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [fine.reference_number, fine.offence, fine.location, nameOf(users, fine.user_id)].join(" ").toLowerCase().includes(term);
  });

  const title = filter === "payments" ? "Payments" : filter === "history" ? "Fine history" : "Outstanding fines";

  return (
    <div className="space-y-6">
      <SectionHeader title={title} description="Monitor issued fines, payment status and enforcement follow-up." />
      <Panel className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <Label htmlFor="fine-search">Search fines</Label>
          <Input id="fine-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, offence, location or citizen" />
        </div>
        <Field label="Status" id="fine-status" value={state} onChange={setState} options={[
          { value: "all", label: "All statuses" },
          { value: "outstanding", label: "Outstanding" },
          { value: "overdue", label: "Overdue" },
          { value: "pending", label: "Payment pending" },
          { value: "paid", label: "Paid" },
          { value: "refunded", label: "Refunded" },
        ]} />
      </Panel>

      {list.length ? (
        <DataTable
          caption="Fines"
          headers={["Reference", "Citizen", "Vehicle", "Offence", "Issued", "Due", "Amount", "Status"]}
          rows={list.map((fine) => [
            fine.reference_number,
            nameOf(users, fine.user_id),
            vehicles.find((vehicle) => vehicle.id === fine.vehicle_id)?.number_plate ?? "Not linked",
            fine.offence,
            formatDate(fine.offence_date),
            formatDate(fine.due_date),
            currency(Number(fine.amount)),
            <StatusBadge key={fine.id} value={fineState(fine)} />,
          ])}
        />
      ) : (
        <EmptyState icon={Ticket} title="No fines to show" description="No fines match this view." />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Appointments */

export function AdminAppointments({ data, filter }: { data: AdminData; filter: string }) {
  const { users, bookings } = data;
  const buckets = appointmentBuckets(bookings);
  const list = filter === "completed" ? buckets.completed : [...buckets.today, ...buckets.upcoming];

  return (
    <div className="space-y-6">
      <SectionHeader title={filter === "completed" ? "Completed appointments" : "Upcoming appointments"} description="Scheduled testing appointments across all traffic departments." />
      {filter !== "completed" && buckets.today.length ? (
        <Panel className="border-warning/50 bg-warning/10">
          <p className="font-semibold">{buckets.today.length} appointment{buckets.today.length === 1 ? "" : "s"} scheduled for today</p>
        </Panel>
      ) : null}
      {list.length ? (
        <DataTable
          caption="Appointments"
          headers={["Applicant", "Service", "Date", "Department", "Status"]}
          rows={list.map((booking) => [
            nameOf(users, booking.user_id),
            serviceLabel[booking.booking_type] ?? booking.booking_type,
            formatDate(booking.appointment_date ?? booking.preferred_date),
            booking.traffic_department,
            <StatusBadge key={booking.id} value={booking.status} />,
          ])}
        />
      ) : (
        <EmptyState icon={CalendarClock} title="No appointments" description="No appointments are scheduled for this view." />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Documents */

export function AdminDocuments({ data, filter }: { data: AdminData; filter: string }) {
  const { users, bookings, vehicles } = data;
  const rows = [
    ...bookings.map((booking) => [
      reference("APP", booking.id),
      nameOf(users, booking.user_id),
      "Application confirmation",
      formatDate(booking.created_at),
      <StatusBadge key={`d-${booking.id}`} value={booking.status === "pending" ? "pending" : "verified"} />,
    ]),
    ...vehicles.map((vehicle) => [
      vehicle.number_plate,
      nameOf(users, vehicle.user_id),
      "Vehicle registration record",
      formatDate(vehicle.created_at),
      <StatusBadge key={`d-${vehicle.id}`} value={vehicle.registration_status} />,
    ]),
  ].filter((row) => (filter === "verification" ? true : true));

  return (
    <div className="space-y-6">
      <SectionHeader title={filter === "verification" ? "Document verification" : "Submitted documents"} description="Records generated by citizen submissions. File uploads will appear here once document storage is enabled." />
      {rows.length ? <DataTable caption="Documents" headers={["Record", "Citizen", "Document type", "Submitted", "Verification"]} rows={rows} /> : <EmptyState icon={FileText} title="No documents submitted" description="Citizen document submissions will be listed here." />}
    </div>
  );
}

/* --------------------------------------------------------- Security & audit */

export function AdminSecurity({ data, filter }: { data: AdminData; filter: string }) {
  const { users, bookings, vehicles, fines, role } = data;
  const [query, setQuery] = useState("");
  const audit = useMemo(() => deriveAuditTrail(bookings, vehicles, fines, users), [bookings, vehicles, fines, users]);

  if (!can(role, "security:view")) {
    return <EmptyState icon={ShieldCheck} title="Restricted" description="Your administrator role does not have access to security and audit records." />;
  }

  const scoped = audit.filter((event) => {
    if (filter === "login") return false;
    if (filter === "events" && event.result !== "Failed") return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [event.actor, event.action, event.resource].join(" ").toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="Security &amp; audit" description="Read-only record of activity across the traffic services platform. Audit records cannot be edited or deleted from this interface." />

      {filter === "login" ? (
        <EmptyState icon={ShieldCheck} title="Login activity not yet recorded" description="Sign-in and sign-out auditing requires dedicated audit storage, which is not enabled yet. This view is ready for that data." />
      ) : (
        <>
          <Panel>
            <Label htmlFor="audit-search">Search audit records</Label>
            <Input id="audit-search" className="mt-1.5" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Administrator, action or resource" />
          </Panel>
          {scoped.length ? (
            <DataTable
              caption="Audit records"
              headers={["Timestamp", "Actor", "Action", "Resource", "Category", "Result"]}
              rows={scoped.slice(0, 100).map((event) => [formatDateTime(event.at), event.actor, event.action, event.resource, event.category, event.result])}
            />
          ) : (
            <EmptyState icon={AlertTriangle} title="No security events" description="No events match this view." />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Settings */

export function AdminSettings({ role, email }: { role: AdminRole; email: string }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Administrator profile &amp; settings" description="Your administrative identity and access level." />
      <Panel>
        <dl className="grid gap-2 text-sm">
          <Row term="Signed in as" detail={email} />
          <Row term="Access level" detail={roleLabel[role]} />
          <Row term="Session" detail="Protected administrative session" />
        </dl>
      </Panel>
      <Panel>
        <h3 className="font-bold">Access model</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Permissions are enforced in the database with row level security. Interface controls are hidden when your role cannot perform an action, but the backend remains the source of truth.
        </p>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------- Global search */

export function AdminSearch({ data, onNavigate }: { data: AdminData; onNavigate: (section: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();

  const results = term
    ? [
        ...data.users.filter((person) => person.full_name.toLowerCase().includes(term) || person.email.toLowerCase().includes(term)).map((person) => ({ id: person.id, primary: person.full_name, secondary: "Citizen account", target: "citizens:all" })),
        ...data.bookings.filter((booking) => reference("APP", booking.id).toLowerCase().includes(term)).map((booking) => ({ id: booking.id, primary: reference("APP", booking.id), secondary: `${serviceLabel[booking.booking_type] ?? "Application"}`, target: "applications:all" })),
        ...data.vehicles.filter((vehicle) => vehicle.number_plate.toLowerCase().includes(term)).map((vehicle) => ({ id: vehicle.id, primary: vehicle.number_plate, secondary: "Vehicle registration", target: "vehicles:all" })),
        ...data.fines.filter((fine) => fine.reference_number.toLowerCase().includes(term)).map((fine) => ({ id: fine.id, primary: fine.reference_number, secondary: "Traffic fine", target: "fines:outstanding" })),
      ].slice(0, 12)
    : [];

  return (
    <>
      <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Search records" onClick={() => setOpen(true)}>
        <Search aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Search records</DialogTitle>
            <DialogDescription>Find a citizen, application reference, vehicle registration or fine reference.</DialogDescription>
          </DialogHeader>
          <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search citizens, applications, vehicles…" aria-label="Search citizens, applications, vehicles" />
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {results.map((result) => (
              <li key={`${result.secondary}-${result.id}`}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 px-2 py-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  onClick={() => { onNavigate(result.target); setOpen(false); setQuery(""); }}
                >
                  <span className="font-semibold">{result.primary}</span>
                  <span className="text-xs text-muted-foreground">{result.secondary}</span>
                </button>
              </li>
            ))}
            {term && !results.length ? <li className="px-2 py-6 text-center text-sm text-muted-foreground">No records found.</li> : null}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
