import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./lib/firebase";
import { Booking, ALL_BED_NUMBERS } from "./types";
import StatsSummary from "./components/StatsSummary";
import BedMap from "./components/BedMap";
import BookingModal from "./components/BookingModal";
import PaperScanner from "./components/PaperScanner";
import {
  Sun,
  Calendar,
  Sparkles,
  Grid,
  Plus,
  RefreshCw,
  Umbrella,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Check,
  Zap,
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [selectedDate, setSelectedDate] = useState("2026-07-04");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "scanner">("map");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddBed, setQuickAddBed] = useState("");
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddSlot, setQuickAddSlot] = useState<"morning" | "afternoon" | "full_day">("full_day");
  const [quickAddType, setQuickAddType] = useState<"daily" | "subscriber">("daily");
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBookings = bookings.filter((booking) => {
    if (!searchQuery.trim()) return true;
    
    const queryLower = searchQuery.toLowerCase().trim();
    const matchesName = booking.customerName.toLowerCase().includes(queryLower);
    const matchesNotes = booking.notes ? booking.notes.toLowerCase().includes(queryLower) : false;
    const matchesBed = booking.bedNumber.toString() === queryLower;

    return matchesName || matchesNotes || matchesBed;
  });

  // Sync bookings in real-time for the selected date
  useEffect(() => {
    setIsLoading(true);
    const bookingsRef = collection(db, "bookings");
    const q = query(bookingsRef, where("date", "==", selectedDate));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedBookings: Booking[] = [];
        snapshot.forEach((docSnap) => {
          loadedBookings.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Booking, "id">),
          });
        });
        setBookings(loadedBookings);
        setIsLoading(false);
      },
      (error) => {
        console.error("Errore durante il caricamento delle prenotazioni:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedDate]);

  // Adjust date by offset
  const shiftDate = (days: number) => {
    try {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + days);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setSelectedDate(`${yyyy}-${mm}-${dd}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Set date to today
  const setToToday = () => {
    setSelectedDate("2026-07-04");
  };

  // Save single booking
  const handleSaveBooking = async (bookingData: Omit<Booking, "id">) => {
    try {
      const bookingsRef = collection(db, "bookings");
      // Sanitize undefined fields which Firestore doesn't support
      const cleaned = { ...bookingData } as any;
      Object.keys(cleaned).forEach((key) => {
        if (cleaned[key] === undefined) {
          delete cleaned[key];
        }
      });
      await addDoc(bookingsRef, cleaned);
    } catch (error) {
      console.error("Errore salvataggio:", error);
      throw error;
    }
  };

  // Delete single booking
  const handleDeleteBooking = async (bookingId: string) => {
    try {
      const bookingDocRef = doc(db, "bookings", bookingId);
      await deleteDoc(bookingDocRef);
    } catch (error) {
      console.error("Errore cancellazione:", error);
      throw error;
    }
  };

  // Bulk import scanned bookings from paper
  const handleImportBookings = async (newBookings: Omit<Booking, "id">[]) => {
    try {
      const batch = writeBatch(db);
      const bookingsRef = collection(db, "bookings");

      newBookings.forEach((b) => {
        // Sanitize undefined fields which Firestore doesn't support
        const cleaned = { ...b } as any;
        Object.keys(cleaned).forEach((key) => {
          if (cleaned[key] === undefined) {
            delete cleaned[key];
          }
        });
        const newDocRef = doc(bookingsRef);
        batch.set(newDocRef, cleaned);
      });

      await batch.commit();
    } catch (error) {
      console.error("Errore durante l'importazione batch:", error);
      throw error;
    }
  };

  // Quick manual add form handler
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAddError(null);

    const bedNum = parseInt(quickAddBed);
    if (isNaN(bedNum) || !ALL_BED_NUMBERS.includes(bedNum)) {
      setQuickAddError(`Numero lettino non valido. Scegli un numero presente in mappa.`);
      return;
    }

    if (!quickAddName.trim()) {
      setQuickAddError("Inserisci il nome del cliente");
      return;
    }

    // Check if bed is already booked for that slot or full day
    const alreadyBooked = bookings.some((b) => {
      if (b.bedNumber !== bedNum) return false;
      if (b.slot === "full_day" || quickAddSlot === "full_day") return true;
      return b.slot === quickAddSlot;
    });

    if (alreadyBooked) {
      setQuickAddError(`Il lettino ${bedNum} è già occupato per la fascia selezionata.`);
      return;
    }

    try {
      await handleSaveBooking({
        bedNumber: bedNum,
        date: selectedDate,
        slot: quickAddSlot,
        customerName: quickAddName.trim(),
        customerType: quickAddType,
        createdAt: new Date().toISOString(),
      });

      // Reset
      setQuickAddBed("");
      setQuickAddName("");
      setQuickAddOpen(false);
    } catch (err: any) {
      setQuickAddError("Errore nel salvataggio: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800">
      
      {/* Decorative top bar */}
      <div className="bg-amber-400 h-1.5 w-full" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
        
        {/* APP HEADER */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600 border border-amber-100 shadow-xs">
              <Umbrella className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-full">
                  Stabilimento Balneare
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800 mt-0.5">
                Sabbia & Sole
              </h1>
              <p className="text-xs text-slate-400">Gestione Prenotazioni Lettini in Tempo Reale</p>
            </div>
          </div>

          {/* Nav / Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            
            {/* View switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 w-full sm:w-auto">
              <button
                onClick={() => setViewMode("map")}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "map"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Grid className="w-4 h-4 text-indigo-500" />
                Mappa Spiaggia
              </button>
              <button
                onClick={() => setViewMode("scanner")}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "scanner"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                Scansiona Cartaceo
              </button>
            </div>

            {/* Quick manual add triggers */}
            <button
              onClick={() => setQuickAddOpen(!quickAddOpen)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Inserimento Manuale
            </button>
          </div>
        </header>

        {/* DATE SELECTOR NAV */}
        <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Calendar Select with Offset Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => shiftDate(-1)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Giorno precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={setToToday}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Oggi
            </button>

            <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-indigo-500 mr-2" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden font-mono"
              />
            </div>

            <button
              onClick={() => shiftDate(1)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Giorno successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca cliente, note o n° lettino..."
              className="pl-9 pr-8 py-2 border border-slate-200 hover:border-slate-300 rounded-xl bg-slate-50/50 text-xs text-slate-700 placeholder-slate-400 outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Cancella ricerca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </section>

        {/* Notifica di Filtro Attivo */}
        {searchQuery && (
          <div className="bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-indigo-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                Filtro attivo per <strong>"{searchQuery}"</strong>. Trovate <strong>{filteredBookings.length}</strong> prenotazioni corrispondenti.
              </span>
            </div>
            <button 
              onClick={() => setSearchQuery("")}
              className="font-bold hover:underline cursor-pointer text-indigo-600"
            >
              Mostra tutti
            </button>
          </div>
        )}

        {/* QUICK MANUAL ADD DRAWER / ACCORDION */}
        <AnimatePresence>
          {quickAddOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-indigo-50/40 border border-indigo-100 rounded-2xl"
            >
              <form onSubmit={handleQuickAddSubmit} className="p-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-5 flex items-center justify-between border-b border-indigo-100/50 pb-2 mb-2">
                  <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-500" /> Inserimento Rapido
                  </h3>
                  {quickAddError && (
                    <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-sm">
                      {quickAddError}
                    </span>
                  )}
                </div>

                {/* Bed number */}
                <div>
                  <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">N. Lettino</label>
                  <input
                    type="number"
                    value={quickAddBed}
                    onChange={(e) => setQuickAddBed(e.target.value)}
                    placeholder="es. 15"
                    className="w-full bg-white px-3 py-2 border border-indigo-200/60 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-mono font-bold"
                  />
                </div>

                {/* Customer name */}
                <div>
                  <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Nome Cliente</label>
                  <input
                    type="text"
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    placeholder="Nome e Cognome"
                    className="w-full bg-white px-3 py-2 border border-indigo-200/60 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                  />
                </div>

                {/* Slot */}
                <div>
                  <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Orario</label>
                  <select
                    value={quickAddSlot}
                    onChange={(e) => setQuickAddSlot(e.target.value as any)}
                    className="w-full bg-white px-3 py-2 border border-indigo-200/60 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                  >
                    <option value="full_day">Giornata Intera</option>
                    <option value="morning">Mattina</option>
                    <option value="afternoon">Pomeriggio</option>
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Tipologia</label>
                  <select
                    value={quickAddType}
                    onChange={(e) => setQuickAddType(e.target.value as any)}
                    className="w-full bg-white px-3 py-2 border border-indigo-200/60 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs font-medium"
                  >
                    <option value="daily">Giornaliero</option>
                    <option value="subscriber">Abbonato</option>
                  </select>
                </div>

                {/* Submit button */}
                <div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5 h-[38px]"
                  >
                    <Check className="w-4 h-4" />
                    Registra Prenotazione
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SUMMARY STATS PANEL */}
        <StatsSummary bookings={filteredBookings} totalBeds={ALL_BED_NUMBERS.length} date={selectedDate} />

        {/* LOADING INDICATOR */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-slate-100 shadow-xs">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">Caricamento stato spiaggia in corso...</p>
            <p className="text-xs text-slate-400 mt-1">Sincronizzazione in tempo reale con il cloud</p>
          </div>
        )}

        {/* VIEWS (MAP vs SCANNER) */}
        {!isLoading && (
          <main>
            {viewMode === "map" ? (
              <BedMap
                bookings={filteredBookings}
                onSelectBed={(bedNum) => setSelectedBed(bedNum)}
              />
            ) : (
              <PaperScanner
                date={selectedDate}
                existingBookings={bookings}
                onImportBookings={handleImportBookings}
              />
            )}
          </main>
        )}
      </div>

      {/* BED DETAIL MODAL */}
      {selectedBed !== null && (
        <BookingModal
          bedNumber={selectedBed}
          date={selectedDate}
          existingBookings={bookings.filter((b) => b.bedNumber === selectedBed)}
          onClose={() => setSelectedBed(null)}
          onSaveBooking={handleSaveBooking}
          onDeleteBooking={handleDeleteBooking}
        />
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 py-8 border-t border-slate-100 mt-12 bg-white">
        <p className="font-semibold">Sabbia & Sole - Gestione Lettini Balneari</p>
        <p className="text-[10px] mt-1 text-slate-400">
          Sviluppato con React, Tailwind CSS e Firebase Firestore per aggiornamenti istantanei.
        </p>
      </footer>
    </div>
  );
}
