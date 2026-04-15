import { useState, useEffect, useCallback } from "react";
import { normalizeApiResponse } from "../../utils/apiResponseNormalizer";
import { useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  FiPlusCircle,
  FiClock,
  FiUser,
  FiCalendar,
  FiInfo,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiXCircle,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiBell,
  FiThumbsUp,
  FiThumbsDown
} from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { generateCalendarGrid, generateWeekGrid, generateDayGrid } from "../../utils/calendarUtils";
import { useToast } from "../../context/ToastContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../context/AuthContext";
import api from "../../utils/api";
import ManualSendModal from "../notifications/ManualSendModal";
import SearchableSelect from "../common/SearchableSelect";
import ValidationSummary from "../common/ValidationSummary";

const viewModes = ["Month", "Week", "Day"];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const todayString = new Date().toISOString().split('T')[0];

const quickAddSchema = z.object({
  date: z.string().min(1, "Date is required").refine(val => val >= todayString, {
    message: "Appointment date cannot be in the past"
  }),
  time: z.string().min(1, "Time is required").regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  owner_id: z.string().min(1, "Please select an owner"),
  pet_id: z.string().min(1, "Please select a pet"),
  service_id: z.string().min(1, "Please select a service"),
  vet_id: z.string().min(1, "Please select a veterinarian"),
  notes: z.string().optional(),
}).refine((data) => {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  if (data.date < todayStr) return false;
  if (data.date === todayStr) {
    const currentTime = format(now, "HH:mm");
    return data.time >= currentTime;
  }
  return true;
}, {
  message: "Cannot schedule appointments in the past.",
  path: ["time"],
});

function AppointmentsView() {
  const toast = useToast();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preSelectedPetId = queryParams.get("petId") || queryParams.get("patientId");

  const [activeViewMode, setActiveViewMode] = useState("Month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [aiForecast, setAiForecast] = useState(null);
  const [categories, setCategories] = useState([]);
  const { user } = useAuth();

  const [activePanel, setActivePanel] = useState("booking"); // 'booking' | 'details'
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      date: "",
      time: "",
      owner_id: "",
      pet_id: preSelectedPetId || "",
      service_id: "",
      vet_id: "",
      notes: ""
    }
  });

  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [services, setServices] = useState([]);
  const [vets, setVets] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  const fetchAppointments = useCallback(() => {
    if (!user?.token) return;
    api.get("/api/appointments")
      .then((res) => {
        const data = normalizeApiResponse(res);
        setAppointments(data);
      })
      .catch((err) => {
        console.error("Error fetching appointments:", err);
        setAppointments([]);
      });
  }, [user?.token]);

  useEffect(() => {
    let isMounted = true;
    if (!user?.token) return;

    Promise.all([
      api.get("/api/appointments"),
      api.get("/api/owners"),
      api.get("/api/pets"),
      api.get("/api/services"),
      api.get("/api/vets"),
      api.get("/api/settings"),
      api.get("/api/dashboard/appointment-forecast")
    ]).then(([apptRes, ownersRes, petsRes, servicesRes, vetsRes, settingsRes, forecastRes]) => {
      if (!isMounted) return;

      const apptData = normalizeApiResponse(apptRes);
      const ownersData = normalizeApiResponse(ownersRes);
      const petsData = normalizeApiResponse(petsRes);
      const servicesData = normalizeApiResponse(servicesRes);
      const vetsData = normalizeApiResponse(vetsRes);

      setAppointments(apptData);
      setOwners(ownersData);
      setPets(petsData);
      setServices(servicesData);
      setVets(vetsData);

      if (preSelectedPetId) {
        const foundPet = petsData.find(p => p.id.toString() === preSelectedPetId.toString());
        if (foundPet) {
          const ownerIdStr = foundPet.owner_id.toString();
          setSelectedOwnerId(ownerIdStr);
          setValue("owner_id", ownerIdStr);
          setValue("pet_id", preSelectedPetId.toString());
        }
      }

      const settingsData = settingsRes.data || {};
      const inv = settingsData.inventory_categories ? JSON.parse(settingsData.inventory_categories) : [];
      const svc = settingsData.service_categories ? JSON.parse(settingsData.service_categories) : [];
      setCategories([...new Set([...inv, ...svc])]);

      if (forecastRes.data) setAiForecast(forecastRes.data);
    }).catch(err => {
      console.error("[AppointmentsView] Error loading data:", err);
      if (isMounted) {
        setAppointments([]);
        setOwners([]);
        setPets([]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.token, preSelectedPetId, setValue]);

  const handleReviewHints = () => {
    if (aiForecast) {
      toast.info(
        <div className="text-left">
          <p className="font-bold border-b border-emerald-200 dark:border-emerald-800 pb-1 mb-2">AI Planning Hints:</p>
          <ul className="list-disc pl-4 space-y-1 text-sm">
            {aiForecast.hints.map((hint, i) => <li key={i}>{hint}</li>)}
          </ul>
        </div>,
        { duration: 6000 }
      );
    } else {
      toast.info("AI Analysis is still processing historical data.");
    }
  };

  const onSubmit = async (formData) => {
    try {
      const payload = { ...formData };
      if (payload.owner_id) payload.owner_id = Number(payload.owner_id);
      if (payload.pet_id) payload.pet_id = Number(payload.pet_id);
      if (payload.service_id) payload.service_id = Number(payload.service_id);
      if (payload.vet_id) payload.vet_id = Number(payload.vet_id);

      if (selectedAppointment) {
        await api.put(`/api/appointments/${selectedAppointment.id}`, payload);
        toast.success("Appointment Updated!");
      } else {
        await api.post("/api/appointments", payload);
        toast.success("Appointment Scheduled!");
      }

      reset();
      setSelectedAppointment(null);
      setIsDrawerOpen(false);
      fetchAppointments();
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to schedule appointment.";
      toast.error(message);
    }
  };

  const handleEditClick = () => {
    if (!selectedAppointment) return;
    
    // Set form values
    setValue("date", selectedAppointment.date);
    setValue("time", selectedAppointment.time?.substring(0, 5));
    setValue("pet_id", String(selectedAppointment.pet_id));
    setValue("service_id", String(selectedAppointment.service_id));
    setValue("vet_id", selectedAppointment.vet_id ? String(selectedAppointment.vet_id) : "");
    setValue("notes", selectedAppointment.notes || "");
    
    // Set selected owner so pet list populates
    if (selectedAppointment.pet?.owner_id) {
      const oId = String(selectedAppointment.pet.owner_id);
      setSelectedOwnerId(oId);
      setValue("owner_id", oId);
    }
    
    setActivePanel("booking");
  };

  const handleDayClick = (entry) => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (entry.dateString < todayStr) return; // Prevent booking in the past

    reset({
      date: entry.dateString,
      time: "",
      owner_id: "",
      pet_id: preSelectedPetId || "",
      service_id: "",
      vet_id: "",
      notes: ""
    });
    setSelectedAppointment(null);
    setSelectedOwnerId("");
    setActivePanel("booking");
    setIsDrawerOpen(true);
  };

  const handleAppointmentClick = (event, appointment) => {
    event.stopPropagation();
    setSelectedAppointment(appointment);
    setActivePanel("details");
    setIsDrawerOpen(true);
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.put(`/api/appointments/${id}`, {
        ...selectedAppointment,
        status,
        pet_id: selectedAppointment.pet_id,
        service_id: selectedAppointment.service_id,
        date: selectedAppointment.date,
        time: selectedAppointment.time?.substring(0, 5),
      });

      toast.success(`Appointment marked as ${status.replace('_', ' ')}`);
      fetchAppointments();
      setSelectedAppointment(prev => ({ ...prev, status }));
    } catch (err) {
      let errorMessage = "Failed to update status";
      if (err.response?.data?.errors) {
        errorMessage = Object.values(err.response.data.errors).flat().join(", ");
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    }
  };

  const handleSendReminder = () => {
    setIsSendModalOpen(true);
  };

  const handleDeleteAppointment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    try {
      await api.delete(`/api/appointments/${id}`);
      toast.success("Appointment Deleted");
      setActivePanel("booking");
      setSelectedAppointment(null);
      setIsDrawerOpen(false);
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to delete appointment");
    }
  };

  const handlePrev = () => {
    if (activeViewMode === "Month") setCurrentDate(subMonths(currentDate, 1));
    else if (activeViewMode === "Week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (activeViewMode === "Month") setCurrentDate(addMonths(currentDate, 1));
    else if (activeViewMode === "Week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const calendarDays = activeViewMode === "Month"
    ? generateCalendarGrid(currentDate, appointments)
    : activeViewMode === "Week"
    ? generateWeekGrid(currentDate, appointments)
    : generateDayGrid(currentDate, appointments);

  const qInputBase = "h-11 w-full rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none dark:bg-dark-surface dark:text-zinc-200 dark:placeholder:text-zinc-500";
  const getQInputClass = (error) => clsx(qInputBase, error ? "border-red-400 focus:border-red-500 dark:border-red-500/50" : "border-zinc-200 focus:border-emerald-500 dark:border-dark-border");

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── Left Column: Calendar ── */}
      <div className="flex-1 min-w-0">
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition-colors duration-300 dark:border-dark-border dark:bg-dark-card">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-5 transition-colors duration-300 dark:border-dark-border">
            <div className="flex items-center gap-1.5 rounded-xl bg-zinc-100 p-1 dark:bg-dark-surface">
              {viewModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setActiveViewMode(mode)}
                  className={clsx(
                    "rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-tight transition-all",
                    activeViewMode === mode
                      ? "bg-white text-emerald-600 shadow-sm dark:bg-dark-card dark:text-emerald-400"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-zinc-50/50 dark:bg-dark-surface/30 rounded-2xl border border-zinc-100 dark:border-dark-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-400"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Declined/Past</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface"
                >
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="min-w-[140px] text-center text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 italic">
                  {activeViewMode === "Month" ? format(currentDate, "MMMM yyyy") : 
                   activeViewMode === "Week" ? `Week of ${format(currentDate, "MMM d")}` :
                   format(currentDate, "MMMM d, yyyy")}
                </h2>
                <button
                  onClick={handleNext}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50 dark:border-dark-border dark:text-zinc-400 dark:hover:bg-dark-surface"
                >
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/50 dark:border-dark-border/50 dark:bg-dark-surface/30">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className={clsx(
            "grid divide-x divide-y divide-zinc-100 transition-colors duration-300 dark:divide-dark-border/50",
            activeViewMode === "Month" || activeViewMode === "Week" ? "grid-cols-7" : "grid-cols-1"
          )}>
            {calendarDays.map((entry, index) => {
              const todayStr = format(new Date(), "yyyy-MM-dd");
              const isCellToday = entry.dateString === todayStr;
              const isCellPast = entry.dateString < todayStr;

              if (activeViewMode === "Month" && !entry.inMonth) {
                return <div key={`empty-${index}`} className="min-h-[140px] bg-zinc-50/10 dark:bg-dark-surface/5" />;
              }

              return (
                <div
                  key={`${entry.dateString}-${index}`}
                  onClick={() => handleDayClick(entry)}
                  className={clsx(
                    "group relative min-h-[140px] p-2 transition-all cursor-pointer",
                    !entry.inMonth && "bg-zinc-50/20 dark:bg-dark-surface/10 opacity-40",
                    isCellToday && "bg-emerald-50/50 dark:bg-emerald-900/10",
                    isCellPast && "bg-zinc-100/50 dark:bg-zinc-800/40 grayscale-sm cursor-default",
                    !isCellPast && "hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={clsx(
                        "inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition-all",
                        isCellToday
                          ? "bg-emerald-600 text-white shadow-lg"
                          : (isCellPast ? "text-zinc-400 dark:text-zinc-600" : (entry.inMonth ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-600"))
                      )}
                    >
                      {entry.day}
                    </span>
                    {entry.events.length > 0 && (
                      <span className={clsx(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-md italic",
                        isCellPast ? "text-zinc-400 bg-zinc-100 dark:bg-zinc-800" : "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      )}>
                        {entry.events.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {entry.events.map((event) => {
                      const statusColors = {
                        pending: "border-blue-400 bg-blue-50/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
                        in_progress: "border-orange-400 bg-orange-50/80 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200",
                        completed: "border-emerald-400 bg-emerald-50/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
                        cancelled: "border-rose-400 bg-rose-50/80 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
                      };
                      const currentColor = statusColors[event.status?.toLowerCase()] || "border-slate-400 bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300";

                      return (
                        <article
                          key={event.id}
                          onClick={(e) => handleAppointmentClick(e, event)}
                          className={clsx(
                            "rounded-lg border-l-4 px-2 py-1 text-[10px] font-bold shadow-sm transition-all hover:translate-x-1 group/appt",
                            currentColor
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate flex-1 uppercase">{event.title}</span>
                            <span className="opacity-70 whitespace-nowrap">{event.time?.substring(0, 5)}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Slide-Over Drawer ── */}
      <div
        className={clsx(
          "fixed inset-0 z-[60] transition-opacity duration-500 ease-in-out",
          isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          onClick={() => { setIsDrawerOpen(false); setSelectedAppointment(null); }}
        />

        {/* Dynamic Panel Content */}
        <aside
          className={clsx(
            "absolute inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-dark-card shadow-[-20px_0_50px_-10px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.3,1)] overflow-y-auto",
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {activePanel === "booking" ? (
            <section className="p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic">
                    <span className="text-emerald-600 dark:text-emerald-400 mr-2">/</span>Schedule
                  </h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Add new clinical entry</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reset()} className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-600 transition-colors">Clear</button>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-dark-border transition-all"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {Object.keys(errors).length > 0 && (
                  <ValidationSummary errors={errors} />
                )}
                <div className="space-y-5 rounded-[2rem] border-2 border-slate-100 bg-slate-50/30 p-8 dark:border-dark-border dark:bg-dark-surface/30">
                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Client / Owner Record</label>
                    <SearchableSelect 
                      options={owners.map(o => ({
                        value: o.id.toString(),
                        label: o.name,
                        sublabel: o.phone || o.email || "No contact info"
                      }))}
                      value={watch("owner_id")}
                      onChange={(id) => {
                        setValue("owner_id", id, { shouldValidate: true });
                        setSelectedOwnerId(id);
                        setValue("pet_id", "");
                      }}
                      placeholder="Search owner..."
                      error={errors.owner_id?.message}
                    />
                  </div>

                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Patient / Pet Identification *</label>
                    {(() => {
                      const filteredPets = pets.filter(p => p.owner_id?.toString() === selectedOwnerId?.toString());
                      const hasPets = filteredPets.length > 0;
                      
                      return (
                        <SearchableSelect 
                          options={filteredPets.map(p => ({
                            value: p.id.toString(),
                            label: p.name,
                            sublabel: p.species?.name || "Unknown species"
                          }))}
                          value={watch("pet_id")}
                          onChange={(id) => setValue("pet_id", id, { shouldValidate: true })}
                          placeholder={
                            !selectedOwnerId 
                              ? "Select owner first" 
                              : hasPets 
                                ? `Search pet (${filteredPets.length} available)...` 
                                : "No pets registered for this owner"
                          }
                          disabled={!selectedOwnerId || !hasPets}
                          error={errors.pet_id?.message}
                        />
                      );
                    })()}
                  </div>

                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Clinical Service *</label>
                    <div className="relative">
                      <select {...register("service_id")} className={clsx(getQInputClass(errors.service_id), "appearance-none pr-10 font-bold bg-white dark:bg-dark-card")}>
                        <option value="">— Select Service —</option>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    </div>
                    {errors.service_id && <p className="mt-2 text-xs text-red-500 font-black italic">{errors.service_id.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Date</label>
                    <input type="date" {...register("date")} min={todayString} className={clsx(getQInputClass(errors.date), "font-bold bg-white dark:bg-dark-card")} />
                    {errors.date && <p className="mt-1 text-xs text-red-500 font-bold">{errors.date.message}</p>}
                  </div>
                  <div>
                    <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Time</label>
                    <input type="time" {...register("time")} className={clsx(getQInputClass(errors.time), "font-bold bg-white dark:bg-dark-card")} />
                    {errors.time && <p className="mt-1 text-xs text-red-500 font-bold">{errors.time.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Assigned Veterinarian *</label>
                  <div className="relative">
                    <select {...register("vet_id")} className={clsx(getQInputClass(errors.vet_id), "appearance-none pr-10 font-bold bg-white dark:bg-dark-card")}>
                      <option value="">— Select Vet —</option>
                      {vets.map(v => <option key={v.id} value={v.id}>Dr. {v.name}</option>)}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  </div>
                  {errors.vet_id && <p className="mt-2 text-xs text-red-500 font-black italic">{errors.vet_id.message}</p>}
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Notes / Clinical Reason</label>
                  <textarea {...register("notes")} className={clsx(getQInputClass(false), "bg-white dark:bg-dark-card min-h-[120px] py-4")} placeholder="Describe the reason for visit..." rows={3}></textarea>
                </div>

                <button type="submit" disabled={isSubmitting} className="inline-flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-emerald-500/40 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all mt-4">
                  <FiPlusCircle className="h-6 w-6" />
                  {isSubmitting ? "Syncing..." : selectedAppointment ? "Update Appointment" : "Finalize Appointment"}
                </button>
              </form>
            </section>
          ) : (
            <section className="p-0">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 p-8 dark:border-dark-border bg-white/80 dark:bg-dark-card/80 backdrop-blur-lg">
                <div>
                  <h3 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic">
                    <span className="text-emerald-600 dark:text-emerald-400 mr-2">/</span>Clinical Details
                  </h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">Internal record view</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsDrawerOpen(false); setSelectedAppointment(null); }}
                    className="rounded-2xl bg-zinc-100 p-3 text-zinc-500 hover:bg-zinc-200 dark:bg-dark-surface dark:text-zinc-400 dark:hover:bg-dark-border transition-all active:scale-90"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-10">
                <div className="flex items-start gap-6">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[2rem] bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-xl shadow-emerald-500/10">
                    <FiInfo className="h-10 w-10" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 truncate italic leading-tight">{selectedAppointment?.title}</h4>
                    <div className={clsx(
                      "mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-black uppercase tracking-widest shadow-lg",
                      selectedAppointment?.status?.toLowerCase() === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        selectedAppointment?.status?.toLowerCase() === "cancelled" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                          selectedAppointment?.status?.toLowerCase() === "in_progress" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                            "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      {selectedAppointment?.status?.toLowerCase() === "completed" && <FiCheckCircle className="h-4 w-4" />}
                      {selectedAppointment?.status?.toLowerCase() === "cancelled" && <FiXCircle className="h-4 w-4" />}
                      {selectedAppointment?.status?.toLowerCase() === "in_progress" && <FiAlertCircle className="h-4 w-4" />}
                      {selectedAppointment?.status?.toLowerCase() === "pending" && <FiClock className="h-4 w-4" />}
                      {selectedAppointment?.status === "pending" ? "Scheduled" : selectedAppointment?.status?.replace('_', '-') || "Scheduled"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 rounded-[2.5rem] border-2 border-zinc-100 bg-zinc-50/20 p-8 dark:border-dark-border dark:bg-dark-surface/10">
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-dark-card flex items-center justify-center shadow-md dark:shadow-none border border-zinc-100 dark:border-dark-border">
                      <FiCalendar className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Date Scheduled</p>
                      <p className="text-lg font-black text-zinc-800 dark:text-zinc-100">{selectedAppointment?.date ? format(new Date(selectedAppointment.date), "MMMM d, yyyy") : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-dark-card flex items-center justify-center shadow-md dark:shadow-none border border-zinc-100 dark:border-dark-border">
                      <FiClock className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Appointment Time</p>
                      <p className="text-lg font-black text-slate-800 dark:text-zinc-100 italic">{selectedAppointment?.time?.substring(0, 5)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 rounded-2xl bg-white dark:bg-dark-card flex items-center justify-center shadow-md dark:shadow-none border border-zinc-100 dark:border-dark-border">
                      <FiUser className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Patient & Guardian</p>
                      <p className="text-lg font-black text-slate-800 dark:text-zinc-100 truncate">
                        {selectedAppointment?.pet?.name} <span className="mx-2 text-slate-300 font-normal">|</span> <span className="text-slate-500 dark:text-zinc-400">{selectedAppointment?.pet?.owner?.name || "No Owner Info"}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {selectedAppointment?.notes && (
                  <div>
                    <label className="mb-4 block text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Case Notes / Context</label>
                    <div className="rounded-3xl bg-zinc-50 p-6 text-md font-medium leading-relaxed text-zinc-600 dark:bg-dark-surface dark:text-zinc-400 italic border-l-8 border-emerald-500/20 dark:border-emerald-400/10">
                      "{selectedAppointment.notes}"
                    </div>
                  </div>
                )}

                <div className="pt-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 text-center mb-6">Security & Lifecycle Actions</p>
                  <button
                    onClick={() => setIsSendModalOpen(true)}
                    className="mb-8 w-full flex h-14 items-center justify-center gap-3 rounded-2xl bg-blue-100 text-sm font-black uppercase tracking-widest text-blue-700 shadow-xl shadow-blue-200/50 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/50 transition-all active:scale-95"
                  >
                    <FiBell className="h-5 w-5" />
                    Send Reminder
                  </button>
                  
                  <button
                    onClick={handleEditClick}
                    className="mb-8 w-full flex h-14 items-center justify-center gap-3 rounded-2xl border-2 border-emerald-100 text-sm font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900/30 dark:hover:bg-emerald-900/10 transition-all active:scale-95"
                  >
                    <FiCalendar className="h-5 w-5" />
                    Edit Details
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleStatusUpdate(selectedAppointment?.id, "pending")}
                      className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 transition-all active:scale-95"
                    >
                      <FiClock className="h-5 w-5" />
                      Scheduled
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedAppointment?.id, "in_progress")}
                      className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-orange-100 text-[10px] font-black uppercase tracking-widest text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300 transition-all active:scale-95"
                    >
                      <FiAlertCircle className="h-5 w-5" />
                      In-Progress
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedAppointment?.id, "completed")}
                      className="flex h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-95"
                    >
                      <FiCheckCircle className="h-5 w-5" />
                      Completed
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button
                      onClick={() => handleStatusUpdate(selectedAppointment?.id, "cancelled")}
                      className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-slate-100 text-xs font-black uppercase tracking-widest text-slate-700 shadow-lg shadow-slate-200/50 hover:bg-slate-200 dark:bg-dark-surface dark:text-zinc-300 dark:hover:bg-dark-border transition-all active:scale-95"
                    >
                      <FiXCircle className="h-5 w-5" />
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteAppointment(selectedAppointment?.id)}
                      className="flex h-14 items-center justify-center gap-3 rounded-2xl border-2 border-rose-100 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-900/10 transition-all active:scale-95"
                    >
                      <FiTrash2 className="h-5 w-5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* AI Insights in Drawer Footer */}
          <section className="mt-auto border-t border-zinc-100 bg-emerald-50/30 p-8 dark:border-dark-border dark:bg-emerald-600/5">
            <div className="mb-4 inline-flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xl shadow-emerald-500/40">
                <LuSparkles className="h-5 w-5" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.2em] italic">Clinic Insights</p>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-emerald-300/80 font-bold italic">{aiForecast?.insight || "Analyzing clinic data for scheduling trends..."}</p>
            <button onClick={handleReviewHints} className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
              <FiBell className="h-4 w-4" />
              View Details
            </button>
          </section>
        </aside>
      </div>

      <ManualSendModal 
        isOpen={isSendModalOpen} 
        onClose={() => setIsSendModalOpen(false)} 
        owner={owners.find(o => o.id.toString() === selectedAppointment?.pet?.owner_id?.toString())}
        relatedObject={selectedAppointment}
        relatedType="App\\Models\\Appointment"
      />
    </div>
  );
}

export default AppointmentsView;
