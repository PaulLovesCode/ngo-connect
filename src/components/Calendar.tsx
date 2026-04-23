import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, Info, MapPin, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '../lib/utils';
import { Emergency, Urgency } from '../types';

interface CalendarProps {
  emergencies: Emergency[];
}

export function Calendar({ emergencies }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getEmergenciesForDay = (day: Date) => {
    return emergencies.filter(emergency => {
      const createdAt = emergency.createdAt.toDate();
      return isSameDay(createdAt, day);
    });
  };

  const getUrgencyColor = (urgency: Urgency) => {
    switch (urgency) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-emerald-500 text-white';
    }
  };

  const selectedDayEmergencies = selectedDay ? getEmergenciesForDay(selectedDay) : [];

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
      <div className="p-6 border-b border-emerald-50 flex items-center justify-between bg-emerald-50/30">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="text-emerald-600" size={20} />
          <h2 className="text-lg font-bold text-gray-900">Emergency Archive</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-emerald-900 min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <span key={day} className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider py-2">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayEmergencies = getEmergenciesForDay(day);
            const highestUrgency = dayEmergencies.length > 0 
              ? dayEmergencies.reduce((prev, curr) => {
                  const urgencyMap = { critical: 4, high: 3, medium: 2, low: 1 };
                  return urgencyMap[curr.urgency] > urgencyMap[prev.urgency] ? curr : prev;
                }).urgency
              : null;

            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center rounded-xl text-xs relative transition-all active:scale-95",
                  !isSameMonth(day, currentMonth) && "text-gray-300",
                  isToday(day) && !highestUrgency && "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200",
                  highestUrgency ? getUrgencyColor(highestUrgency) : (isSameMonth(day, currentMonth) ? "hover:bg-emerald-50 text-gray-700" : ""),
                  selectedDay && isSameDay(day, selectedDay) && "ring-2 ring-emerald-400 ring-offset-2"
                )}
              >
                <span className="z-10">{format(day, 'd')}</span>
                {dayEmergencies.length > 1 && (
                  <span className="absolute top-1 right-1 text-[8px] font-bold opacity-80">
                    +{dayEmergencies.length - 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-emerald-50 bg-emerald-50/20 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-emerald-900">
                  {format(selectedDay, 'MMMM d, yyyy')}
                </h3>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="text-[10px] uppercase font-bold text-emerald-600 hover:underline"
                >
                  Close
                </button>
              </div>
              
              {selectedDayEmergencies.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-4 text-center">No emergencies recorded for this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDayEmergencies.map(emergency => (
                    <div key={emergency.id} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-bold uppercase border",
                          emergency.urgency === 'critical' ? "bg-red-50 text-red-700 border-red-100" :
                          emergency.urgency === 'high' ? "bg-orange-50 text-orange-700 border-orange-100" :
                          emergency.urgency === 'medium' ? "bg-yellow-50 text-yellow-700 border-yellow-100" :
                          "bg-blue-50 text-blue-700 border-blue-100"
                        )}>
                          {emergency.urgency}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {format(emergency.createdAt.toDate(), 'h:mm a')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 font-medium mb-2 leading-relaxed">
                        {emergency.description}
                      </p>
                      <div className="flex items-center text-[10px] text-gray-500">
                        <MapPin size={10} className="mr-1" />
                        {emergency.location}
                        {emergency.processedByAi && (
                          <span className="ml-auto flex items-center text-emerald-600 font-bold">
                            <AlertCircle size={10} className="mr-0.5" />
                            AI ARCHIVE
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 bg-emerald-50/50 border-t border-emerald-50">
        <div className="flex flex-wrap gap-3 justify-center">
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-[10px] font-medium text-gray-600">Critical</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-[10px] font-medium text-gray-600">High</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span className="text-[10px] font-medium text-gray-600">Medium</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-[10px] font-medium text-gray-600">Low</span>
          </div>
        </div>
      </div>
    </section>
  );
}
