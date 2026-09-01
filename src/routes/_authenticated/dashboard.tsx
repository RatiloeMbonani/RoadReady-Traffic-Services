import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Bell,
  Car,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  ShieldCheck,
  Ticket,
  User,
  Users,
  Wrench,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, ErrorState, LoadingState, Panel, SectionHeader, StatusBadge } from "@/components/dashboard/primitives";
import {
  ApplicationsSection,
  CitizenOverview,
  DocumentsSection,
  FinesSection,
  HelpSection,
  NotificationsSection,
  ProfileSection,
  SecuritySection,
  ServicesSection,
  VehiclesSection,
} from "@/components/dashboard/citizen";
import { TrafficAssistant } from "@/components/dashboard/traffic-assistant";
import { deriveNotices, formatDate, maskIdentifier, serviceLabel, type Booking, type Fine, type Profile, type Vehicle } from "@/lib/dashboard-utils";
import { AdminAppointments, AdminApplications, AdminCitizens, AdminDocuments, AdminFines, AdminOverview, AdminSearch, AdminSecurity, AdminSettings, AdminVehicles } from "@/components/dashboard/admin";
import type { AdminRole } from "@/lib/admin-utils";
import { cn } from "@/lib/utils";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard | RoadReady Traffic Services" },
    { name: "description", content: "Manage licence bookings, vehicles, applications and traffic fines from one secure citizen portal." },
    { property: "og:title", content: "RoadReady Secure Traffic Services Dashboard" },
    { property: "og:description", content: "Book tests, register vehicles, track applications and settle fines securely." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Dashboard,
});

type NavItem = { id: string; label: string; icon: typeof LayoutDashboard; children?: { id: string; label: string }[] };
type NavGroup = { heading: string; items: NavItem[] };

const citizenNav: NavGroup[] = [
  { heading: "Services", items: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "services", label: "Traffic services", icon: Wrench },
    { id: "vehicles", label: "My vehicles", icon: Car },
    { id: "applications", label: "Applications", icon: ClipboardList },
    { id: "fines", label: "Fines", icon: Ticket },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "help", label: "Help & support", icon: HelpCircle },
  ]},
  { heading: "Account", items: [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: ShieldCheck },
  ]},
];

const adminNav: NavGroup[] = [
  { heading: "Administration", items: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "applications:all", label: "Applications", icon: ClipboardList, children: [
      { id: "applications:all", label: "All applications" },
      { id: "applications:pending", label: "Pending review" },
      { id: "applications:approved", label: "Approved" },
      { id: "applications:rejected", label: "Rejected" },
    ]},
    { id: "citizens:all", label: "Citizens", icon: Users, children: [
      { id: "citizens:all", label: "All users" },
      { id: "citizens:active", label: "Active users" },
      { id: "citizens:suspended", label: "Suspended users" },
    ]},
    { id: "vehicles:all", label: "Vehicles", icon: Car, children: [
      { id: "vehicles:all", label: "Registered vehicles" },
      { id: "vehicles:verification", label: "Vehicle verification" },
    ]},
    { id: "fines:outstanding", label: "Fines", icon: Ticket, children: [
      { id: "fines:outstanding", label: "Outstanding fines" },
      { id: "fines:payments", label: "Payments" },
      { id: "fines:history", label: "Fine history" },
    ]},
  ]},
  { heading: "System", items: [
    { id: "appointments:upcoming", label: "Appointments", icon: Clock3, children: [
      { id: "appointments:upcoming", label: "Upcoming appointments" },
      { id: "appointments:completed", label: "Completed appointments" },
    ]},
    { id: "documents:all", label: "Documents", icon: FileText, children: [
      { id: "documents:all", label: "Submitted documents" },
      { id: "documents:verification", label: "Verification" },
    ]},
    { id: "notifications", label: "Notifications", icon: Bell },
  ]},
  { heading: "Security", items: [
    { id: "security:audit", label: "Security & audit", icon: ShieldCheck, children: [
      { id: "security:audit", label: "Audit logs" },
      { id: "security:login", label: "Login activity" },
      { id: "security:events", label: "Security events" },
    ]},
  ]},
  { heading: "Account", items: [
    { id: "admin:profile", label: "Administrator profile", icon: User },
    { id: "security", label: "Account security", icon: Lock },
  ]},
];


function Dashboard() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [section, setSection] = useState("overview");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  const storageKey = `roadready:read-notices:${user.id}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setReadIds(JSON.parse(stored) as string[]);
    } catch { /* ignore unreadable storage */ }
  }, [storageKey]);

  function persistRead(ids: string[]) {
    setReadIds(ids);
    try { window.localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* ignore */ }
  }

  const loadData = useCallback(async () => {
    setStatus("loading");
    try {
      const [{ data: p, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name,id_number,phone,learners_number,learners_expiry,drivers_number,drivers_expiry").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (profileError || roleError) throw profileError ?? roleError;
      const admin = roles?.some((role) => role.role === "admin") ?? false;
      setProfile(p as Profile | null);
      setIsAdmin(admin);

      const [bookingResult, vehicleResult, fineResult, usersResult] = await Promise.all([
        supabase.from("bookings").select("id,user_id,booking_type,preferred_date,traffic_department,status,appointment_date,admin_notes,created_at,updated_at").order("created_at", { ascending: false }),
        supabase.from("vehicles").select("id,user_id,number_plate,vin,make,model,manufacture_year,color,registration_status,admin_notes,document_reference,created_at,updated_at").order("created_at", { ascending: false }),
        supabase.from("fines").select("id,user_id,vehicle_id,reference_number,offence,offence_date,location,amount,due_date,payment_status,created_at").order("created_at", { ascending: false }),
        admin
          ? supabase.from("profiles").select("id,email,full_name,id_number,phone,learners_number,learners_expiry,drivers_number,drivers_expiry").order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (bookingResult.error || vehicleResult.error || fineResult.error || usersResult.error) {
        throw bookingResult.error ?? vehicleResult.error ?? fineResult.error ?? usersResult.error;
      }
      setBookings((bookingResult.data ?? []) as Booking[]);
      setVehicles((vehicleResult.data ?? []) as Vehicle[]);
      setFines((fineResult.data ?? []) as Fine[]);
      setUsers((usersResult.data ?? []) as Profile[]);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [user.id]);

  useEffect(() => { void loadData(); }, [loadData]);

  const notices = useMemo(() => deriveNotices(bookings, fines, vehicles), [bookings, fines, vehicles]);
  const unread = notices.filter((notice) => !readIds.includes(notice.id)).length;

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const type = String(data.get("type")) as "learners" | "drivers";
    if (type === "drivers" && !profile?.learners_number) {
      toast.error("A learner's licence must be recorded before booking a driver test.");
      return;
    }
    const { error } = await supabase.from("bookings").insert({ user_id: user.id, booking_type: type, preferred_date: String(data.get("date")), traffic_department: String(data.get("department")) });
    if (error) toast.error(error.message);
    else { toast.success("Booking submitted for approval"); form.reset(); await loadData(); setSection("applications"); }
  }

  async function registerVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error } = await supabase.from("vehicles").insert({ user_id: user.id, number_plate: String(data.get("plate")).toUpperCase(), make: String(data.get("make")), model: String(data.get("model")) });
    if (error) toast.error(error.message);
    else { toast.success("Vehicle submitted for verification"); form.reset(); await loadData(); }
  }

  async function cancelBooking(id: string) {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Application cancelled"); await loadData(); }
  }

  async function payFine(fine: Fine) {
    const { error } = await supabase.from("payments").insert({ user_id: user.id, fine_id: fine.id, amount: fine.amount });
    if (error) toast.error(error.message);
    else toast.success(`Payment of R ${Number(fine.amount).toFixed(2)} recorded as pending with the secure traffic services channel.`);
  }

  async function updateBooking(id: string, next: "approved" | "rejected" | "passed" | "failed", note?: string) {
    const target = bookings.find((booking) => booking.id === id);
    const payload: { status: typeof next; admin_notes?: string; appointment_date?: string } = { status: next };
    if (note) payload.admin_notes = note;
    if (next === "approved" && target && !target.appointment_date) {
      payload.appointment_date = new Date(`${target.preferred_date}T09:00:00`).toISOString();
    }
    const { data, error } = await supabase.from("bookings").update(payload).eq("id", id).select("id");
    if (error) {
      toast.error("We couldn't update this application. Please try again.");
      throw new Error(error.message);
    }
    if (!data?.length) {
      const message = "This decision was not saved — your account may not have permission to review applications.";
      toast.error(message);
      throw new Error(message);
    }
    toast.success(`Application marked ${next}`);
    await loadData();
  }


  async function updateVehicle(id: string, next: "verified" | "rejected", note?: string) {
    const payload: { registration_status: typeof next; admin_notes?: string } = { registration_status: next };
    if (note) payload.admin_notes = note;
    const { error } = await supabase.from("vehicles").update(payload).eq("id", id);
    if (error) toast.error("We couldn't update this vehicle. Please try again.");
    else { toast.success(`Vehicle ${next}`); await loadData(); }
  }


  async function resetPassword() {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email ?? "", { redirectTo: `${window.location.origin}/auth` });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent to your email address.");
  }

  async function signOut(scope: "local" | "global" = "local") {
    await supabase.auth.signOut(scope === "global" ? { scope: "global" } : undefined);
    await navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const groups = isAdmin ? adminNav : citizenNav;
  const adminRole: AdminRole = "super";
  const displayName = profile?.full_name ?? user.email ?? "Citizen";

  function go(target: string) {
    setSection(target);
    setMenuOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  const navContent = (
    <nav aria-label="Dashboard sections" className="grid gap-6 p-4">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground/50">{group.heading}</p>
          <ul className="grid gap-1">
            {group.items.map(({ id, label, icon: Icon, children }) => {
              const groupKey = id.split(":")[0];
              const active = section === id || (children ? section.split(":")[0] === groupKey : false);
              const expanded = Boolean(children) && (section.split(":")[0] === groupKey || openGroups.includes(groupKey!));
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (children) {
                        setOpenGroups((current) => (current.includes(groupKey!) ? current.filter((value) => value !== groupKey) : [...current, groupKey!]));
                        go(children[0]!.id);
                      } else {
                        go(id);
                      }
                    }}
                    aria-current={section === id ? "page" : undefined}
                    aria-expanded={children ? expanded : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning",
                      active && "bg-primary-foreground/15 text-primary-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="truncate">{label}</span>
                    {id === "notifications" && unread ? <span className="ml-auto rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-road">{unread}</span> : null}
                    {children ? <ChevronDown aria-hidden="true" className={cn("ml-auto size-4 transition-transform", expanded && "rotate-180")} /> : null}
                  </button>
                  {children && expanded ? (
                    <ul className="mt-1 grid gap-0.5 border-l border-primary-foreground/20 pl-3">
                      {children.map((child) => (
                        <li key={child.id}>
                          <button
                            type="button"
                            onClick={() => go(child.id)}
                            aria-current={section === child.id ? "page" : undefined}
                            className={cn(
                              "flex min-h-9 w-full items-center rounded-md px-3 text-left text-sm text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning",
                              section === child.id && "bg-primary-foreground/10 font-semibold text-primary-foreground",
                            )}
                          >
                            {child.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <Button variant="ghost" onClick={() => void signOut()} className="justify-start text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground">
        <LogOut aria-hidden="true" /> Sign out
      </Button>
    </nav>
  );


  return (
    <div className="min-h-dvh bg-muted/40 lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#dashboard-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2">Skip to main content</a>

      {/* Desktop sidebar */}
      <aside className="hidden bg-road text-primary-foreground lg:block lg:min-h-dvh lg:border-r lg:border-primary-foreground/10">
        <div className="sticky top-0">
          <div className="flex h-16 items-center gap-2 border-b border-primary-foreground/15 px-5">
            <ShieldCheck aria-hidden="true" className="size-5 text-warning" />
            <span className="text-base font-bold">RoadReady</span>
          </div>
          {navContent}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-background">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:px-8">
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11 lg:hidden" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <Menu aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">{isAdmin ? `${greeting()}, ${displayName}` : `Welcome back, ${displayName}`}</h1>
              <p className="hidden truncate text-sm text-muted-foreground sm:block">
                {isAdmin ? "Monitor citizen activity and manage traffic service requests securely." : "Manage your traffic services, vehicles, applications and fines from one secure portal."}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success md:inline-flex">
                <Lock aria-hidden="true" className="size-3" /> Secure session
              </span>
              {isAdmin ? <AdminSearch data={{ users, bookings, vehicles, fines, role: adminRole }} onNavigate={go} /> : null}
              {isAdmin ? (
                <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Help and support" onClick={() => go("admin:profile")}><HelpCircle aria-hidden="true" /></Button>
              ) : null}
              <Button variant="ghost" size="icon" className="relative min-h-11 min-w-11" onClick={() => go("notifications")} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
                <Bell aria-hidden="true" />
                {unread ? <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">{unread}</span> : null}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Account menu"><User aria-hidden="true" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <span className="block truncate">{displayName}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">ID {maskIdentifier(profile?.id_number)}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!isAdmin ? <DropdownMenuItem onSelect={() => go("profile")}>My profile</DropdownMenuItem> : null}
                  <DropdownMenuItem onSelect={() => go("security")}>Account &amp; security</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => go("notifications")}>Notification preferences</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Mobile drawer */}
        {menuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close navigation menu" className="absolute inset-0 bg-foreground/50" onClick={() => setMenuOpen(false)} />
            <div role="dialog" aria-label="Dashboard navigation" className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-road text-primary-foreground shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-primary-foreground/15 px-4">
                <span className="flex items-center gap-2 font-bold"><ShieldCheck aria-hidden="true" className="size-5 text-warning" /> RoadReady</span>
                <Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-primary-foreground hover:bg-primary-foreground/10" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)}><X aria-hidden="true" /></Button>
              </div>
              {navContent}
            </div>
          </div>
        ) : null}

        <main id="dashboard-main" className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 lg:p-8">
          {status === "loading" ? <LoadingState /> : null}
          {status === "error" ? <ErrorState message="We couldn't load your traffic services. Please check your connection and try again." onRetry={() => void loadData()} /> : null}
          {status === "ready" ? (
            isAdmin ? (
              <AdminViews
                section={section}
                data={{ users, bookings, vehicles, fines, role: adminRole }}
                handlers={{ onNavigate: go, onDecision: updateBooking, onVehicleDecision: updateVehicle }}
                notices={notices}
                readIds={readIds}
                onRead={(id: string) => persistRead(Array.from(new Set([...readIds, id])))}
                onReadAll={() => persistRead(notices.map((notice) => notice.id))}
                email={user.email ?? ""}
                onPasswordReset={resetPassword}
                onSignOutEverywhere={() => void signOut("global")}
              />
            ) : (
              <>
                {section === "overview" && <CitizenOverview profile={profile} bookings={bookings} vehicles={vehicles} fines={fines} notices={notices} readIds={readIds} onNavigate={go} />}
                {section === "services" && <ServicesSection profile={profile} onBook={book} onNavigate={go} />}
                {section === "vehicles" && <VehiclesSection vehicles={vehicles} onRegister={registerVehicle} onNavigate={go} />}
                {section === "applications" && <ApplicationsSection bookings={bookings} onNavigate={go} onCancel={(id) => void cancelBooking(id)} />}
                {section === "fines" && <FinesSection fines={fines} onPay={(fine) => void payFine(fine)} />}
                {section === "documents" && <DocumentsSection bookings={bookings} vehicles={vehicles} />}
                {section === "notifications" && (
                  <NotificationsSection
                    notices={notices}
                    readIds={readIds}
                    onRead={(id) => persistRead(Array.from(new Set([...readIds, id])))}
                    onReadAll={() => persistRead(notices.map((notice) => notice.id))}
                    onNavigate={go}
                  />
                )}
                {section === "help" && <HelpSection onNavigate={go} />}
                {section === "profile" && <ProfileSection profile={profile} />}
                {section === "security" && <SecuritySection email={user.email ?? ""} onPasswordReset={() => void resetPassword()} onSignOutEverywhere={() => void signOut("global")} />}
              </>
            )
          ) : null}
        </main>
      </div>

      {!isAdmin && status === "ready" ? <TrafficAssistant bookings={bookings} vehicles={vehicles} fines={fines} onNavigate={go} /> : null}
    </div>
  );
}

function AdminViews({
  section,
  data,
  handlers,
  notices,
  readIds,
  onRead,
  onReadAll,
  email,
  onPasswordReset,
  onSignOutEverywhere,
}: {
  section: string;
  data: React.ComponentProps<typeof AdminOverview>["data"];
  handlers: React.ComponentProps<typeof AdminOverview>["handlers"];
  notices: ReturnType<typeof deriveNotices>;
  readIds: string[];
  onRead: (id: string) => void;
  onReadAll: () => void;
  email: string;
  onPasswordReset: () => void;
  onSignOutEverywhere: () => void;
}) {
  const [group, sub = "all"] = section.split(":");

  if (section === "security") return <SecuritySection email={email} onPasswordReset={onPasswordReset} onSignOutEverywhere={onSignOutEverywhere} />;
  if (section === "admin:profile") return <AdminSettings role={data.role} email={email} />;
  if (section === "notifications") {
    return <NotificationsSection notices={notices} readIds={readIds} onRead={onRead} onReadAll={onReadAll} onNavigate={handlers.onNavigate} />;
  }
  if (group === "applications") return <AdminApplications data={data} handlers={handlers} filter={sub} />;
  if (group === "citizens") return <AdminCitizens data={data} handlers={handlers} filter={sub} />;
  if (group === "vehicles") return <AdminVehicles data={data} handlers={handlers} filter={sub} />;
  if (group === "fines") return <AdminFines data={data} filter={sub} />;
  if (group === "appointments") return <AdminAppointments data={data} filter={sub} />;
  if (group === "documents") return <AdminDocuments data={data} filter={sub} />;
  if (group === "security") return <AdminSecurity data={data} filter={sub} />;

  return <AdminOverview data={data} handlers={handlers} />;
}
