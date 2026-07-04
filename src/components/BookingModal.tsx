import React, { useState } from "react";
import { Booking, SlotType, CustomerType } from "../types";
import { X, Plus, Trash2, Shield, Calendar, Tag, Check, AlertCircle } from "lucide-react";

interface BookingModalProps {
  bedNumber: number;
  date: string;
  existingBookings: Booking[];
  onClose: () => void;
  onSaveBooking: (booking: Omit<Booking, "id">) => Promise<void>;
  onDeleteBooking: (bookingId: string) => Promise<void>;
}

export default function BookingModal({
  bedNumber,
  date,
  existingBookings,
  onClose,
  onSaveBooking,
  onDeleteBooking,
}: BookingModalProps) {
  // New booking form state
  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("daily");
  const [slot, setSlot] = useState<SlotType>("full_day");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check which slots are already booked to prevent overlap
  const isMorningBooked = existingBookings.some((b) => b.slot === "morning" || b.slot === "full_day");
  const isAfternoonBooked = existingBookings.some((b) => b.slot === "afternoon" || b.slot === "full_day");
  const isFullDayBooked = existingBookings.some((b) => b.slot === "full_day");

  // Determine available slots
  const getAvailableSlots = (): { value: SlotType; label: string; disabled: boolean }[] => {
    return [
      {
        value: "full_day",
        label: "Giornata Intera",
        disabled: isMorningBooked || isAfternoonBooked || isFullDayBooked,
      },
      {
        value: "morning",
        label: "Fascia Mattutina",
        disabled: isMorningBooked || isFullDayBooked,
      },
      {
        value: "afternoon",
        label: "Fascia Pomeridiana",
        disabled: isAfternoonBooked || isFullDayBooked,
      },
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError("Inserisci il nome del cliente");
      return;
    }

    // Double check availability
    const selectedSlotInfo = getAvailableSlots().find((s) => s.value === slot);
    if (selectedSlotInfo?.disabled) {
      setError("La fascia oraria selezionata è già occupata");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveBooking({
        bedNumber,
        date,
        slot,
        customerName: customerName.trim(),
        customerType,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
      // Clear form
      setCustomerName("");
      setNotes("");
    } catch (err: any) {
      setError("Errore durante il salvataggio: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (bookingId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa prenotazione?")) return;

    try {
      await onDeleteBooking(bookingId);
    } catch (err: any) {
      setError("Errore durante l'eliminazione: " + (err.message || err));
    }
  };

  // Helper translations
  const translateSlot = (s: SlotType) => {
    if (s === "morning") return "Mattina";
    if (s === "afternoon") return "Pomeriggio";
    return "Giornata Intera";
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Lettino {bedNumber}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Gestione prenotazioni per il giorno {date}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Existing Bookings List */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Prenotazioni attive</h4>
            {existingBookings.length === 0 ? (
              <p className="text-sm text-slate-400 bg-slate-50 border border-dashed border-slate-200 p-4 rounded-xl text-center">
                Nessuna prenotazione attiva per questo lettino in questa data.
              </p>
            ) : (
              <div className="space-y-3">
                {existingBookings.map((b) => (
                  <div
                    key={b.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      b.slot === "full_day"
                        ? "bg-rose-50/50 border-rose-200"
                        : b.slot === "morning"
                        ? "bg-sky-50/50 border-sky-200"
                        : "bg-amber-50/50 border-amber-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{b.customerName}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          b.customerType === "subscriber"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {b.customerType === "subscriber" ? (
                            <>
                              <Shield className="w-2.5 h-2.5" /> Abbonato
                            </>
                          ) : (
                            "Giornaliero"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {translateSlot(b.slot)}
                        </span>
                        {b.notes && (
                          <span className="flex items-center gap-1 italic max-w-[200px] truncate">
                            <Tag className="w-3.5 h-3.5" />
                            {b.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    {b.id && (
                      <button
                        onClick={() => handleDelete(b.id!)}
                        className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors cursor-pointer"
                        title="Cancella prenotazione"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Booking Form */}
          {!isFullDayBooked && !(isMorningBooked && isAfternoonBooked) && (
            <div className="border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Aggiungi Nuova Prenotazione</h4>
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nome Cliente *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Esempio: Mario Rossi"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Grid for Type and Slot */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Customer Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tipologia Cliente</label>
                    <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                      <button
                        type="button"
                        onClick={() => setCustomerType("daily")}
                        className={`flex-1 text-center text-xs py-1.5 font-medium rounded-md transition-all cursor-pointer ${
                          customerType === "daily"
                            ? "bg-white text-slate-800 shadow-xs border border-slate-200/50"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Giornaliero
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerType("subscriber")}
                        className={`flex-1 text-center text-xs py-1.5 font-medium rounded-md transition-all cursor-pointer ${
                          customerType === "subscriber"
                            ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50"
                            : "text-slate-500 hover:text-indigo-600"
                        }`}
                      >
                        Abbonato
                      </button>
                    </div>
                  </div>

                  {/* Slot Choice */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fascia Oraria</label>
                    <select
                      value={slot}
                      onChange={(e) => setSlot(e.target.value as SlotType)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      {getAvailableSlots().map((s) => (
                        <option key={s.value} value={s.value} disabled={s.disabled}>
                          {s.label} {s.disabled ? "(Occupata)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Note Opzionali</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="es. Pagato acconto, Ombrellone incluso"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? "Salvataggio..." : "Salva Prenotazione"}
                </button>
              </form>
            </div>
          )}

          {(isFullDayBooked || (isMorningBooked && isAfternoonBooked)) && (
            <div className="border-t border-slate-100 pt-5 text-center">
              <p className="text-sm text-amber-600 font-medium bg-amber-50 p-3 rounded-xl inline-flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Questo lettino è completamente prenotato per oggi.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
