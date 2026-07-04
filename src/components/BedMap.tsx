import React from "react";
import { Booking, PEDANA_SINISTRA_LEFT, PEDANA_SINISTRA_RIGHT, PEDANA_DESTRA_LEFT, PEDANA_DESTRA_RIGHT } from "../types";
import { Armchair, Shield, Sun, Users } from "lucide-react";

interface BedMapProps {
  bookings: Booking[];
  searchQuery?: string;
  onSelectBed: (bedNumber: number) => void;
}

export default function BedMap({ bookings, searchQuery = "", onSelectBed }: BedMapProps) {
  // Get all bookings for a specific bed number
  const getBedBookings = (bedNum: number | null): Booking[] => {
    if (bedNum === null) return [];
    return bookings.filter((b) => b.bedNumber === bedNum);
  };

  // Render a single bed cell
  const renderBedCell = (bedNum: number | null, key: string) => {
    if (bedNum === null) {
      return <div key={key} className="aspect-square bg-slate-50/50 rounded-lg border border-dashed border-slate-200" />;
    }

    const bedBookings = getBedBookings(bedNum);
    const hasMorning = bedBookings.some((b) => b.slot === "morning" || b.slot === "full_day");
    const hasAfternoon = bedBookings.some((b) => b.slot === "afternoon" || b.slot === "full_day");
    const isFullDay = bedBookings.some((b) => b.slot === "full_day");

    // Color classes
    let bgStyle = "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300";
    let badgeText = "";
    let subTitle = "";
    let isSubscriber = false;

    if (bedBookings.length > 0) {
      isSubscriber = bedBookings.some((b) => b.customerType === "subscriber");
      if (isFullDay) {
        bgStyle = "bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100/80 hover:border-rose-400";
        badgeText = "Intera";
        subTitle = bedBookings[0].customerName;
      } else if (hasMorning && hasAfternoon) {
        // Double booked (morning + afternoon by different people)
        bgStyle = "bg-indigo-50 border-indigo-300 text-indigo-800 hover:bg-indigo-100/80 hover:border-indigo-400";
        badgeText = "M+P";
        const morningClient = bedBookings.find(b => b.slot === 'morning')?.customerName || '';
        const afternoonClient = bedBookings.find(b => b.slot === 'afternoon')?.customerName || '';
        subTitle = `${morningClient} / ${afternoonClient}`;
      } else if (hasMorning) {
        bgStyle = "bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100/80 hover:border-sky-400";
        badgeText = "Mattina";
        subTitle = bedBookings.find((b) => b.slot === "morning")?.customerName || "";
      } else if (hasAfternoon) {
        bgStyle = "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100/80 hover:border-amber-400";
        badgeText = "Pomeriggio";
        subTitle = bedBookings.find((b) => b.slot === "afternoon")?.customerName || "";
      }
    }

    const queryTrimmed = searchQuery.trim().toLowerCase();
    let isMatch = true;
    let hasActiveFilter = queryTrimmed.length > 0;

    if (hasActiveFilter) {
      const matchesBedNum = bedNum.toString() === queryTrimmed;
      const matchesBookings = bedBookings.some((b) => {
        const matchesName = b.customerName.toLowerCase().includes(queryTrimmed);
        const matchesNotes = b.notes ? b.notes.toLowerCase().includes(queryTrimmed) : false;
        return matchesName || matchesNotes;
      });
      isMatch = matchesBedNum || matchesBookings;
    }

    let matchClass = "";
    if (hasActiveFilter) {
      if (isMatch) {
        matchClass = "ring-4 ring-amber-500 scale-105 z-10 transition-all duration-200 animate-pulse";
      } else {
        matchClass = "opacity-20 scale-95 saturate-50 hover:opacity-60 transition-all duration-200";
      }
    }

    return (
      <button
        id={`bed-btn-${bedNum}`}
        key={key}
        onClick={() => onSelectBed(bedNum)}
        className={`relative flex flex-col items-center justify-between p-1.5 aspect-square rounded-xl border text-center transition-all cursor-pointer shadow-xs ${bgStyle} ${matchClass}`}
      >
        {/* Bed Number */}
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-bold font-mono">{bedNum}</span>
          {isSubscriber && (
            <Shield className="w-3 h-3 text-indigo-600 fill-indigo-200" title="Abbonato" />
          )}
        </div>

        {/* Armchair/Bed Icon */}
        <div className="my-0.5">
          <Armchair className={`w-5 h-5 ${bedBookings.length > 0 ? "opacity-80" : "text-slate-300"}`} />
        </div>

        {/* Badge or name info */}
        <div className="w-full min-h-[14px] flex items-center justify-center">
          {bedBookings.length > 0 ? (
            <div className="w-full">
              <p className="text-[9px] font-bold truncate max-w-full leading-none text-ellipsis" title={subTitle}>
                {subTitle}
              </p>
              <span className={`text-[7px] font-semibold px-1 rounded-xs inline-block mt-0.5 ${
                isFullDay ? "bg-rose-200/50 text-rose-800" :
                hasMorning && hasAfternoon ? "bg-indigo-200/50 text-indigo-800" :
                hasMorning ? "bg-sky-200/50 text-sky-800" : "bg-amber-200/50 text-amber-800"
              }`}>
                {badgeText}
              </span>
            </div>
          ) : (
            <span className="text-[8px] text-emerald-600 font-medium">Libero</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-8">
      {/* PEDANA SINISTRA */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-500" />
            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Pedana Sinistra</h2>
          </div>
          <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            Lettini 1 - 34
          </span>
        </div>

        {/* Two physical sub-grids mimicking the paper diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left sub-grid (Cols 1-5) */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider text-center">
              Fila 1 - 5 (Sinistra)
            </div>
            <div className="grid grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {PEDANA_SINISTRA_LEFT.flat().map((bedNum, idx) =>
                renderBedCell(bedNum, `ps-left-${bedNum ?? "null"}-${idx}`)
              )}
            </div>
          </div>

          {/* Right sub-grid (Cols 6-10) */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider text-center">
              Fila 6 - 10 (Destra)
            </div>
            <div className="grid grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {PEDANA_SINISTRA_RIGHT.flat().map((bedNum, idx) =>
                renderBedCell(bedNum, `ps-right-${bedNum ?? "null"}-${idx}`)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PEDANA DESTRA */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Pedana Destra</h2>
          </div>
          <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            Lettini 60 - 109
          </span>
        </div>

        {/* Two physical sub-grids mimicking the paper diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left sub-grid (Cols 1-5, values 60-64 etc.) */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider text-center">
              Fila 60 - 64 (Sinistra)
            </div>
            <div className="grid grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {PEDANA_DESTRA_LEFT.flat().map((bedNum, idx) =>
                renderBedCell(bedNum, `pd-left-${bedNum ?? "null"}-${idx}`)
              )}
            </div>
          </div>

          {/* Right sub-grid (Cols 6-11, values 65-109 with reversal) */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wider text-center">
              Fila 65 - 109 (Destra)
            </div>
            <div className="grid grid-cols-6 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {PEDANA_DESTRA_RIGHT.flat().map((bedNum, idx) =>
                renderBedCell(bedNum, `pd-right-${bedNum ?? "null"}-${idx}`)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 bg-white p-3 rounded-xl border border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-white border border-slate-200 inline-block" />
          <span>Libero</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-sky-100 border border-sky-300 inline-block" />
          <span>Mattina (M)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-300 inline-block" />
          <span>Pomeriggio (P)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-indigo-100 border border-indigo-300 inline-block" />
          <span>M+P (Due clienti)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-rose-100 border border-rose-300 inline-block" />
          <span>Giornata Intera</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-indigo-600 fill-indigo-100" />
          <span>Abbonato</span>
        </div>
      </div>
    </div>
  );
}
