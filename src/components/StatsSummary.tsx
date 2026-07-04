import React from "react";
import { Sun, Calendar, Users, FileText, CheckCircle2 } from "lucide-react";
import { Booking } from "../types";

interface StatsSummaryProps {
  bookings: Booking[];
  totalBeds: number;
  date: string;
}

export default function StatsSummary({ bookings, totalBeds, date }: StatsSummaryProps) {
  const morningCount = bookings.filter((b) => b.slot === "morning").length;
  const afternoonCount = bookings.filter((b) => b.slot === "afternoon").length;
  const fullDayCount = bookings.filter((b) => b.slot === "full_day").length;

  const subscriberCount = bookings.filter((b) => b.customerType === "subscriber").length;
  const dailyCount = bookings.filter((b) => b.customerType === "daily").length;

  const occupiedBedsSet = new Set(bookings.map((b) => b.bedNumber));
  const occupiedCount = occupiedBedsSet.size;
  const freeCount = totalBeds - occupiedCount;

  // Format date to Italian readable format
  const formatDateItalian = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("it-IT", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Stato Lettini</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {occupiedCount} <span className="text-sm font-normal text-slate-400">/ {totalBeds} Occupati</span>
          </p>
          <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {freeCount} lettini disponibili
          </p>
        </div>
        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
          <Sun className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tipologia Clienti</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {bookings.length} <span className="text-sm font-normal text-slate-400">Totale</span>
          </p>
          <div className="flex gap-2 mt-1 text-xs font-medium">
            <span className="text-indigo-600">{subscriberCount} Abbonati</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-600">{dailyCount} Giornalieri</span>
          </div>
        </div>
        <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
          <Users className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fasce Orarie prenotate</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {morningCount + afternoonCount + fullDayCount} <span className="text-sm font-normal text-slate-400">Slot</span>
          </p>
          <div className="flex gap-1.5 mt-1 text-[10px] font-semibold tracking-tight">
            <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded-sm">Mattina: {morningCount}</span>
            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-sm">Pomeriggio: {afternoonCount}</span>
            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded-sm">Intera: {fullDayCount}</span>
          </div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
          <Calendar className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-xl text-white shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Giorno Selezionato</p>
            <h3 className="text-sm font-bold capitalize mt-1 text-slate-100">
              {formatDateItalian(date)}
            </h3>
          </div>
          <Calendar className="w-4 h-4 text-slate-400" />
        </div>
        <div className="text-[11px] text-slate-300 mt-2 italic flex items-center gap-1">
          <FileText className="w-3 h-3 text-indigo-400" />
          Sincronizzato in tempo reale
        </div>
      </div>
    </div>
  );
}
