import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ScanLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, SectionHeader } from "@/components/dashboard/primitives";
import { analyseTrafficDocument, saveExtractedFine, type ExtractedDocument } from "@/lib/traffic-ai.functions";
import { currency, type Vehicle } from "@/lib/dashboard-utils";

type Draft = {
  reference_number: string;
  offence: string;
  offence_date: string;
  location: string;
  amount: string;
  due_date: string;
  vehicle_id: string;
};

function toDraft(result: ExtractedDocument, vehicles: Vehicle[]): Draft {
  const plate = result.number_plate?.replace(/\s/g, "").toUpperCase();
  const match = plate ? vehicles.find((vehicle) => vehicle.number_plate.replace(/\s/g, "").toUpperCase() === plate) : undefined;
  return {
    reference_number: result.reference_number ?? "",
    offence: result.offence ?? "",
    offence_date: result.offence_date ?? "",
    location: result.location ?? "",
    amount: result.amount === null ? "" : String(result.amount),
    due_date: result.due_date ?? "",
    vehicle_id: match?.id ?? "",
  };
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

export function DocumentScannerSection({ vehicles, onSaved }: { vehicles: Vehicle[]; onSaved: () => Promise<void> | void }) {
  const analyse = useServerFn(analyseTrafficDocument);
  const save = useServerFn(saveExtractedFine);
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExtractedDocument | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    setDraft(null);
    setSaved(false);
    if (file.size > 8_000_000) { setError("That image is larger than 8 MB. Please upload a smaller photograph."); return; }
    const dataUrl = await readFile(file);
    setPreview(dataUrl);
    setScanning(true);
    try {
      const extracted = await analyse({ data: { imageDataUrl: dataUrl } });
      setResult(extracted);
      setDraft(toDraft(extracted, vehicles));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "The document could not be read.");
    } finally {
      setScanning(false);
    }
  }

  async function saveFine() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await save({
        data: {
          reference_number: draft.reference_number,
          offence: draft.offence,
          offence_date: draft.offence_date,
          location: draft.location,
          amount: Number(draft.amount),
          due_date: draft.due_date,
          vehicle_id: draft.vehicle_id || null,
        },
      });
      setSaved(true);
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "This fine could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const complete = draft && draft.reference_number && draft.offence && draft.offence_date.length >= 8 && draft.location && draft.due_date.length >= 8 && Number(draft.amount) > 0;

  function field(key: keyof Draft, label: string, type = "text") {
    return (
      <div className="field">
        <Label className="field-label" htmlFor={`scan-${key}`}>{label}</Label>
        <Input
          id={`scan-${key}`}
          type={type}
          value={draft?.[key] ?? ""}
          onChange={(event) => setDraft((current) => (current ? { ...current, [key]: event.target.value } : current))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Scan a document" description="Photograph a traffic fine or vehicle registration document and the AI reader fills in the details for you." />

      <Panel>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold">Upload a photograph</h2>
            <p className="mt-1 text-sm text-muted-foreground">Clear, well-lit photos work best. JPG or PNG up to 8 MB.</p>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Button className="mt-4" onClick={() => fileInput.current?.click()} disabled={scanning}>
              {scanning ? <><Loader2 aria-hidden="true" className="animate-spin" /> Reading document…</> : <><Upload aria-hidden="true" /> Choose photograph</>}
            </Button>
            {preview ? (
              <img src={preview} alt="Uploaded document preview" className="mt-4 max-h-72 w-full rounded-md border border-border object-contain" />
            ) : (
              <div className="mt-4 grid h-48 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><ScanLine aria-hidden="true" className="size-4" /> No document uploaded yet</span>
              </div>
            )}
          </div>

          <div>
            {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

            {result ? (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-semibold">
                    {result.document_type === "fine" ? "Traffic fine detected" : result.document_type === "vehicle_registration" ? "Vehicle registration document detected" : "Document read"}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">Legibility {Math.round(result.confidence * 100)}%</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">{result.summary}</p>
                </div>

                {saved ? (
                  <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success/5 p-4">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
                    <div>
                      <p className="font-semibold">Saved to your fines</p>
                      <p className="text-sm text-muted-foreground">
                        {currency(Number(draft?.amount ?? 0))} · reference {draft?.reference_number}. You can settle it under Fines.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Check the details below, correct anything the reader got wrong, then save it to your record.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field("reference_number", "Reference number")}
                      {field("amount", "Amount (R)")}
                      {field("offence", "Offence")}
                      {field("location", "Location")}
                      {field("offence_date", "Offence date", "date")}
                      {field("due_date", "Due date", "date")}
                      <div className="field sm:col-span-2">
                        <Label className="field-label" htmlFor="scan-vehicle">Link to a vehicle (optional)</Label>
                        <select
                          id="scan-vehicle"
                          value={draft?.vehicle_id ?? ""}
                          onChange={(event) => setDraft((current) => (current ? { ...current, vehicle_id: event.target.value } : current))}
                          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <option value="">Not linked</option>
                          {vehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>{vehicle.number_plate} — {vehicle.make} {vehicle.model}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button onClick={() => void saveFine()} disabled={!complete || saving}>
                      {saving ? <><Loader2 aria-hidden="true" className="animate-spin" /> Saving…</> : "Save to my fines"}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">What the reader extracts</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Fine reference number and amount payable</li>
                  <li>Offence description, date and location</li>
                  <li>Payment due date</li>
                  <li>Number plate, make and model on registration documents</li>
                </ul>
                <p className="mt-3">Nothing is saved until you review the details and confirm.</p>
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
