import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Lock, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askTrafficAssistant } from "@/lib/traffic-ai.functions";
import { currency, formatDate, serviceLabel, statusInfo, type Booking, type Fine, type Vehicle } from "@/lib/dashboard-utils";

type Message = { id: number; from: "user" | "assistant"; text: string };

const quick = ["Check application", "My vehicles", "My fines", "Book a test", "Get help"] as const;

const faq = [
  "How do I book a learner's test?",
  "When is my test?",
  "Do I have outstanding fines?",
  "How do I renew my licence?",
  "What documents do I need?",
];

export function TrafficAssistant({
  bookings,
  vehicles,
  fines,
  onNavigate,
}: {
  bookings: Booking[];
  vehicles: Vehicle[];
  fines: Fine[];
  onNavigate: (section: string) => void;
}) {
  const ask = useServerFn(askTrafficAssistant);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: "assistant", text: "Hello. I'm the AI Traffic Services assistant. Ask about your applications, vehicles, fines or bookings." },
  ]);

  function answer(question: string): string {
    const text = question.toLowerCase();
    if (/(plate|vehicle|car|registration)/.test(text)) {
      if (!vehicles.length) return "No vehicle is registered to your account yet. You can register one under My vehicles.";
      return `You have ${vehicles.length} registered ${vehicles.length === 1 ? "vehicle" : "vehicles"}: ${vehicles
        .map((vehicle) => `${vehicle.number_plate} (${vehicle.make} ${vehicle.model}, ${statusInfo(vehicle.registration_status).label.toLowerCase()})`)
        .join("; ")}.`;
    }
    if (/(fine|ticket|pay)/.test(text)) {
      const unpaid = fines.filter((fine) => fine.payment_status === "unpaid");
      if (!unpaid.length) return "You currently have no unpaid traffic fines.";
      const total = unpaid.reduce((sum, fine) => sum + Number(fine.amount), 0);
      return `You have ${unpaid.length} unpaid ${unpaid.length === 1 ? "fine" : "fines"} totalling ${currency(total)}. Open the Fines section to review and settle them.`;
    }
    if (/(test|appointment|when|booking|application|status)/.test(text)) {
      if (!bookings.length) return "You have no applications yet. Go to Traffic services to book a learner's or driver's test.";
      const latest = bookings[0]!;
      return `Your most recent application is a ${serviceLabel[latest.booking_type] ?? "test"} at ${latest.traffic_department}, scheduled for ${formatDate(
        latest.appointment_date ?? latest.preferred_date,
      )}. Status: ${statusInfo(latest.status).label}.`;
    }
    if (/(renew|licence|license)/.test(text)) {
      return "Licence renewals are captured under Traffic services. Submit the request and bring your identity document and proof of address to your traffic department.";
    }
    if (/(document|need|bring)/.test(text)) {
      return "For most services you need your identity document, proof of residence not older than three months, and the relevant application form. Approved applications appear under Documents.";
    }
    if (/(help|support|contact)/.test(text)) {
      return "You can reach the support desk from Help & support. For emergencies contact your local traffic department directly.";
    }
    return "I can help with applications, appointments, vehicles, fines, renewals and required documents. Try one of the suggested questions below.";
  }

  function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setMessages((current) => [
      ...current,
      { id: current.length, from: "user", text: trimmed },
      { id: current.length + 1, from: "assistant", text: answer(trimmed) },
    ]);
    setInput("");
  }

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-5 right-5 z-30 size-14 rounded-full shadow-lg"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close Traffic Services Assistant" : "Open Traffic Services Assistant"}
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
      </Button>

      {open ? (
        <section
          aria-label="Traffic Services Assistant"
          className="fixed bottom-24 right-4 z-30 flex max-h-[70dvh] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          <header className="flex items-start gap-3 border-b border-border bg-road px-4 py-3 text-primary-foreground">
            <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold">Traffic Services Assistant</h2>
              <p className="text-xs text-primary-foreground/80">How can I help you today?</p>
            </div>
          </header>

          <ScrollArea className="flex-1">
            <div className="space-y-3 p-4">
              {messages.map((message) => (
                <p
                  key={message.id}
                  className={
                    message.from === "user"
                      ? "ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "w-fit max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  {message.text}
                </p>
              ))}
              <div aria-live="polite" className="sr-only">{messages.at(-1)?.text}</div>
            </div>
          </ScrollArea>

          <div className="border-t border-border p-3">
            <div className="flex flex-wrap gap-1.5">
              {quick.map((label) => (
                <Button
                  key={label}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    const map: Record<string, string> = {
                      "Check application": "applications",
                      "My vehicles": "vehicles",
                      "My fines": "fines",
                      "Book a test": "services",
                      "Get help": "help",
                    };
                    send(label);
                    onNavigate(map[label] ?? "overview");
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {faq.slice(0, 3).map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {question}
                </button>
              ))}
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                send(input);
              }}
            >
              <label className="sr-only" htmlFor="assistant-input">Ask the Traffic Services Assistant</label>
              <input
                id="assistant-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your question"
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <Button type="submit" size="icon" className="size-10 shrink-0" aria-label="Send question">
                <Send aria-hidden="true" />
              </Button>
            </form>

            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              Digital assistant — general guidance only, not a legal or licensing decision. Never share passwords, PINs or banking credentials in this chat.
            </p>
          </div>
        </section>
      ) : null}
    </>
  );
}
