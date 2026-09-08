import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { settleFine } from "@/lib/traffic-ai.functions";
import { currency, formatDate, type Fine } from "@/lib/dashboard-utils";

function formatCard(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

/** Mock secure checkout for a single fine. On success the fine is marked paid server-side. */
export function FineCheckout({ fine, onPaid }: { fine: Fine; onPaid: () => Promise<void> | void }) {
  const pay = useServerFn(settleFine);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  const digits = card.replace(/\s/g, "");
  const valid = name.trim().length > 2 && digits.length === 16 && /^\d{2}\/\d{2}$/.test(expiry) && /^\d{3,4}$/.test(cvv);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await pay({ data: { fineId: fine.id } });
      setReceipt(result.receipt ?? "PAID");
      await onPaid();
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "The payment could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) { setReceipt(null); setError(""); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm"><CreditCard aria-hidden="true" /> Pay fine</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {receipt ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="size-5 text-success" /> Payment successful</DialogTitle>
              <DialogDescription>Fine {fine.reference_number} is now marked as paid on your record.</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Amount paid</dt><dd className="font-semibold">{currency(Number(fine.amount))}</dd></div>
              <div><dt className="text-muted-foreground">Receipt number</dt><dd className="font-semibold">{receipt}</dd></div>
            </dl>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Secure checkout</DialogTitle>
              <DialogDescription>
                Paying {currency(Number(fine.amount))} for fine {fine.reference_number} · due {formatDate(fine.due_date)}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="field">
                <Label className="field-label" htmlFor="pay-name">Cardholder name</Label>
                <Input id="pay-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="A. Citizen" autoComplete="off" />
              </div>
              <div className="field">
                <Label className="field-label" htmlFor="pay-card">Card number</Label>
                <Input id="pay-card" value={card} onChange={(event) => setCard(formatCard(event.target.value))} placeholder="4111 1111 1111 1111" inputMode="numeric" autoComplete="off" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <Label className="field-label" htmlFor="pay-expiry">Expiry</Label>
                  <Input
                    id="pay-expiry"
                    value={expiry}
                    onChange={(event) => {
                      const raw = event.target.value.replace(/\D/g, "").slice(0, 4);
                      setExpiry(raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw);
                    }}
                    placeholder="09/29"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="field">
                  <Label className="field-label" htmlFor="pay-cvv">CVV</Label>
                  <Input id="pay-cvv" value={cvv} onChange={(event) => setCvv(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" autoComplete="off" />
                </div>
              </div>
              {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
              <Button onClick={() => void submit()} disabled={!valid || busy}>
                {busy ? <><Loader2 aria-hidden="true" className="animate-spin" /> Processing…</> : <>Pay {currency(Number(fine.amount))}</>}
              </Button>
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Lock aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                Prototype checkout — no card details are stored or sent to a bank. Enter any test card number.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
