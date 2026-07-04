import React, { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, Loader2, Sparkles, Check, Trash2, Edit2, AlertTriangle } from "lucide-react";
import { Booking, SlotType, CustomerType } from "../types";

interface PaperScannerProps {
  date: string;
  existingBookings: Booking[];
  onImportBookings: (bookings: Omit<Booking, "id">[]) => Promise<void>;
}

interface ScannedBooking {
  bedNumber: number;
  customerName: string;
  customerType: CustomerType;
  slot: SlotType;
  notes?: string;
  isSelected: boolean;
}

export default function PaperScanner({ date, existingBookings, onImportBookings }: PaperScannerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isWordFile, setIsWordFile] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningStep, setScanningStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scannedResults, setScannedResults] = useState<ScannedBooking[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps for loading animations
  const steps = [
    "Invio foto della tabella a Gemini AI...",
    "Lettura della scrittura a mano...",
    "Analisi dei lettini occupati e delle note...",
    "Generazione della mappa digitale delle prenotazioni...",
  ];

  // Run the loader steps sequence
  const startLoadingAnimation = () => {
    setScanningStep(0);
    const interval = setInterval(() => {
      setScanningStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2500);
    return interval;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setError(null);
    setSuccessMessage(null);
    setScannedResults([]);
    setFileName(file.name);

    const isDoc = file.name.toLowerCase().endsWith(".docx") || 
                  file.name.toLowerCase().endsWith(".doc") || 
                  file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                  file.type === "application/msword";

    if (!file.type.startsWith("image/") && !isDoc) {
      setError("Seleziona un'immagine valida o un documento Word (.docx, .doc)");
      return;
    }

    setIsWordFile(isDoc);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScanSubmit = async () => {
    if (!imagePreview) {
      setError("Carica un file prima di iniziare la scansione");
      return;
    }

    setIsScanning(true);
    const intervalId = startLoadingAnimation();

    try {
      const response = await fetch("/api/scan-table", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imagePreview,
          date,
          isWord: isWordFile,
        }),
      });

      const data = await response.json();
      clearInterval(intervalId);

      if (!response.ok) {
        throw new Error(data.error || "Errore sconosciuto del server");
      }

      if (data.bookings && Array.isArray(data.bookings)) {
        const mapped = data.bookings.map((b: any) => ({
          bedNumber: Number(b.bedNumber),
          customerName: b.customerName || "Riservato",
          customerType: b.customerType === "subscriber" ? "subscriber" : "daily",
          slot: (["morning", "afternoon", "full_day"].includes(b.slot) ? b.slot : "full_day") as SlotType,
          notes: b.notes || undefined,
          isSelected: true,
        }));
        setScannedResults(mapped);
      } else {
        throw new Error("I dati restituiti da Gemini non sono nel formato corretto.");
      }
    } catch (err: any) {
      clearInterval(intervalId);
      setError("Impossibile analizzare la tabella: " + (err.message || err));
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleSelect = (index: number) => {
    setScannedResults((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const handleFieldChange = (index: number, field: keyof ScannedBooking, value: any) => {
    setScannedResults((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteItem = (index: number) => {
    setScannedResults((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleImportAll = async () => {
    const selectedToImport = scannedResults.filter((r) => r.isSelected);
    if (selectedToImport.length === 0) {
      setError("Seleziona almeno una prenotazione da salvare.");
      return;
    }

    setIsSaving(true);
    try {
      const formatted = selectedToImport.map((r) => ({
        bedNumber: r.bedNumber,
        date,
        slot: r.slot,
        customerName: r.customerName,
        customerType: r.customerType,
        notes: r.notes,
        createdAt: new Date().toISOString(),
      }));

      await onImportBookings(formatted);
      setSuccessMessage(`Scansione completata con successo! ${formatted.length} prenotazioni aggiunte per il giorno ${date}.`);
      setScannedResults([]);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setError("Errore durante l'importazione: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Helper: check if there's an existing reservation for this bed and slot
  const checkOverlap = (bedNum: number, slot: SlotType) => {
    return existingBookings.some((b) => {
      if (b.bedNumber !== bedNum) return false;
      if (b.slot === "full_day" || slot === "full_day") return true;
      return b.slot === slot;
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Scansione AI Tabella Cartacea</h2>
          <p className="text-xs text-slate-500">Fotografa il tuo foglio quotidiano dei lettini e lascia che Gemini lo digiti per te!</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3 text-sm">
          <Check className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Upload area */}
      {!imagePreview && !isScanning && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors bg-slate-50/50"
        >
          <Upload className="w-10 h-10 text-slate-400" />
          <div>
            <p className="text-sm font-bold text-slate-700">Carica foto della tabella o file Word</p>
            <p className="text-xs text-slate-400 mt-1">Trascina qui il file (.docx, .doc, immagini) oppure clicca per sfogliare</p>
          </div>
          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
            Supporta sia immagini che file Microsoft Word (.docx)
          </span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.docx,.doc"
            className="hidden"
          />
        </div>
      )}

      {/* Scanning loading state */}
      {isScanning && (
        <div className="border border-slate-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">Analisi File in corso</h3>
            <p className="text-xs text-indigo-600 font-medium animate-pulse">
              {isWordFile ? "Estrazione del testo dal documento Word..." : steps[scanningStep]}
            </p>
          </div>
          <p className="text-[10px] text-slate-400 max-w-sm">
            {isWordFile 
              ? "Gemini sta elaborando il testo estratto dal documento Word per identificare i numeri di lettino e le relative prenotazioni."
              : "Il modello di intelligenza artificiale di Google sta elaborando l'immagine, identificando la struttura dei lettini ed estraendo i nomi."}
          </p>
        </div>
      )}

      {/* Preview & Scan Action */}
      {imagePreview && !isScanning && scannedResults.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex flex-col items-center justify-center p-6 min-h-[250px] max-h-[350px]">
            {isWordFile ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <FileText className="w-16 h-16 text-blue-600" />
                <div>
                  <p className="text-sm font-bold text-slate-800 truncate max-w-[200px]">{fileName}</p>
                  <p className="text-xs text-slate-400 mt-1">Documento Word Microsoft</p>
                </div>
              </div>
            ) : (
              <img src={imagePreview} alt="Tabella da scansionare" className="max-w-full max-h-[300px] object-contain" />
            )}
            <button
              onClick={() => {
                setImagePreview(null);
                setFileName(null);
                setIsWordFile(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-full shadow-md transition-colors cursor-pointer text-xs"
            >
              Cambia file
            </button>
          </div>

          <div className="flex flex-col justify-center space-y-4">
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Lettore Intelligente Gemini
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Premi il pulsante sotto per avviare l'analisi. L'AI estrarrà le informazioni e ti permetterà di rivederle prima di salvarle sul database del sito.
              </p>
              <ul className="text-[10px] text-slate-500 mt-3 list-disc list-inside space-y-1">
                {isWordFile ? (
                  <>
                    <li>Analizza elenchi, righe descrittive e tabelle di Word</li>
                    <li>Riconosce i numeri dei lettini ed associa i nomi</li>
                    <li>Rileva il tipo di cliente e la fascia oraria dal testo</li>
                  </>
                ) : (
                  <>
                    <li>Riconosce i numeri dei lettini da 1 a 109</li>
                    <li>Estrae i nomi scritti a matita o penna</li>
                    <li>Identifica le diciture "abbonato" o "giornaliero"</li>
                    <li>Rileva se prenotato per mattina, pomeriggio o giornata intera</li>
                  </>
                )}
              </ul>
            </div>

            <button
              onClick={handleScanSubmit}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Sparkles className="w-5 h-5" />
              Inizia Scansione Automatica
            </button>
          </div>
        </div>
      )}

      {/* Scanned results review table */}
      {scannedResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Rivedi le prenotazioni rilevate ({scannedResults.length})</h3>
            <p className="text-xs text-slate-400">Verifica i dati e deseleziona eventuali errori prima di salvare.</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <th className="p-3 text-center w-12">Importa</th>
                  <th className="p-3 w-20 text-center">Lettino</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3 w-32">Tipo</th>
                  <th className="p-3 w-32">Orario</th>
                  <th className="p-3">Note</th>
                  <th className="p-3 w-12 text-center">Cancella</th>
                </tr>
              </thead>
              <tbody>
                {scannedResults.map((res, idx) => {
                  const hasOverlap = checkOverlap(res.bedNumber, res.slot);

                  return (
                    <tr
                      key={idx}
                      className={`border-b border-slate-100 transition-colors ${
                        !res.isSelected ? "opacity-40 bg-slate-50/50" : hasOverlap ? "bg-amber-50/30" : "hover:bg-slate-50/50"
                      }`}
                    >
                      {/* Checkbox Import */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={res.isSelected}
                          onChange={() => handleToggleSelect(idx)}
                          className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Bed Number */}
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        <div className="flex flex-col items-center gap-0.5">
                          <input
                            type="number"
                            value={res.bedNumber}
                            onChange={(e) => handleFieldChange(idx, "bedNumber", Number(e.target.value))}
                            className="w-12 text-center py-1 border border-slate-200 rounded-md font-bold font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                          {hasOverlap && (
                            <span
                              className="text-[9px] text-amber-600 font-semibold flex items-center gap-0.5"
                              title="Esiste già una prenotazione per questo lettino e fascia oraria!"
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" /> Sovrapposizione
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={res.customerName}
                          onChange={(e) => handleFieldChange(idx, "customerName", e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium text-slate-800 text-xs"
                        />
                      </td>

                      {/* Customer Type */}
                      <td className="p-3">
                        <select
                          value={res.customerType}
                          onChange={(e) => handleFieldChange(idx, "customerType", e.target.value as CustomerType)}
                          className="w-full px-2 py-1 border border-slate-200 bg-white rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        >
                          <option value="daily">Giornaliero</option>
                          <option value="subscriber">Abbonato</option>
                        </select>
                      </td>

                      {/* Slot */}
                      <td className="p-3">
                        <select
                          value={res.slot}
                          onChange={(e) => handleFieldChange(idx, "slot", e.target.value as SlotType)}
                          className="w-full px-2 py-1 border border-slate-200 bg-white rounded-md text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        >
                          <option value="full_day">Giornata Intera</option>
                          <option value="morning">Mattina</option>
                          <option value="afternoon">Pomeriggio</option>
                        </select>
                      </td>

                      {/* Notes */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={res.notes || ""}
                          onChange={(e) => handleFieldChange(idx, "notes", e.target.value)}
                          placeholder="Note..."
                          className="w-full px-2 py-1 border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-hidden text-xs text-slate-600"
                        />
                      </td>

                      {/* Delete */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-4 justify-end pt-2">
            <button
              onClick={() => {
                setScannedResults([]);
                setImagePreview(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
            >
              Annulla scansione
            </button>
            <button
              onClick={handleImportAll}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvataggio...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Salva ed Importa Selezionati
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
