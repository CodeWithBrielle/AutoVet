import { useMemo, useState, useEffect, useRef } from "react";
import clsx from "clsx";
import {
  FiCalendar,
  FiChevronDown,
  FiDownload,
  FiEye,
  FiPlusCircle,
  FiPrinter,
  FiSearch,
  FiSend,
  FiBell,
  FiXCircle,
} from "react-icons/fi";
import { LuPawPrint } from "react-icons/lu";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useFormErrors } from "../../hooks/useFormErrors";
import { getPetImageUrl, getActualPetImageUrl } from "../../utils/petImages";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import PrintableInvoice from "./PrintableInvoice";
import ManualSendModal from "../notifications/ManualSendModal";

const currency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
const pdfCurrency = (value) => "P " + (value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (date) => {
  if (!date) return "N/A";
  try {
     return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch (e) {
     return "N/A";
  }
};

/* ───────────────────────────────────────── PDF Generation ── */
async function generateInvoicePDF(element, filename = 'invoice.pdf') {
  if (!element) return;
  
  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff"
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const canvasHeight = canvas.height;
    const canvasWidth = canvas.width;
    const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  } catch (err) {
    console.error("PDF Generation Error:", err);
    throw new Error("Failed to generate PDF document.");
  }
}

function InvoiceModuleView() {
  const toast = useToast();
  const { user } = useAuth();
  const { setLaravelErrors, clearErrors, getError } = useFormErrors();
  const [items, setItems] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const [discountVal, setDiscountVal] = useState(0);
  const [discountType, setDiscountType] = useState("percentage");

  const [owners, setOwners] = useState([]);
  const [pets, setPets] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  const [selectedPatientId, setSelectedPatientId] = useState("");

  // New state for appointments and selected appointment
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [clinicSettings, setClinicSettings] = useState(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Draft");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [currentWeight, setCurrentWeight] = useState("");

  const [services, setServices] = useState([]);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  const [inventory, setInventory] = useState([]);
  const [weightRanges, setWeightRanges] = useState([]);
  const processedApptsRef = useRef(new Set());
  const printableRef = useRef(null);

  useEffect(() => {
    if (!user?.token) return;

    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${user.token}`
    };

    // Fetch owners, pets, and settings on mount
    Promise.all([
      fetch("/api/owners", { headers }).then(res => res.json()).catch(() => ({ error: "Fetch failed" })),
      fetch("/api/pets", { headers }).then(res => res.json()).catch(() => ({ error: "Fetch failed" })),
      fetch("/api/settings", { headers }).then(res => res.json()).catch(() => ({})),
      fetch("/api/services", { headers }).then(res => res.json()).catch(() => []),
      fetch("/api/inventory", { headers }).then(res => res.json()).catch(() => [])
    ])
      .then(([ownersData, petsData, settingsData, servicesData, inventoryData]) => {
        // Robustness: Only set array state if data is an array, else log payload
        if (!Array.isArray(ownersData)) {
          console.error("Unexpected owners API response:", ownersData);
          setOwners([]);
        } else {
          setOwners(ownersData);
        }

        if (!Array.isArray(petsData)) {
          console.error("Unexpected pets API response:", petsData);
          setPets([]);
        } else {
          setPets(petsData);
        }

        setNotes(settingsData?.invoice_notes_template || "");
        setClinicSettings(settingsData);
        setServices(Array.isArray(servicesData) ? servicesData : []);
        setInventory(Array.isArray(inventoryData) ? inventoryData : []);
      })
      .catch((err) => {
        console.error("Critical fail in Invoice initialization:", err);
        toast.error("Failed to load initial invoice data.");
      });

    fetch("/api/weight-ranges", { headers })
      .then(res => res.json())
      .then(data => {
        const ranges = data.data || data;
        if (!Array.isArray(ranges)) {
          console.error("Unexpected weight-ranges response:", data);
          setWeightRanges([]);
        } else {
          setWeightRanges(ranges);
        }
      })
      .catch(err => {
        console.error("Weight ranges fetch error:", err);
        setWeightRanges([]);
      });
  }, [user?.token]);
  
  // Diagnostic state watcher
  useEffect(() => {
    console.log("[DEBUG] Invoice Items State Updated:", items);
  }, [items]);

  const handlePatientSelect = (e) => {
    const pId = e.target.value;
    setSelectedPatientId(pId);
    setSelectedAppointmentId(""); // reset appointment selection
    setItems([]); // Clear previous patient's items
    if (processedApptsRef.current) processedApptsRef.current.clear();
    if (!pId) {
      setPatientDetails(null);
      setAppointments([]);
      return;
    }
    const patientData = (Array.isArray(pets) ? pets : []).find(p => p.id.toString() === pId.toString());
    
    // Simply use the raw patient data, the UI will access nested properties
    setPatientDetails(patientData);
    setCurrentWeight(patientData?.weight || "");

    // Fetch appointments for this patient
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${user?.token}`
    };
    fetch(`/api/appointments?pet_id=${pId}`, { headers })
      .then(res => res.json())
      .then(data => {
        const appts = Array.isArray(data) ? data : [];
        // Sort by date descending, take recent 5 + future
        const sorted = appts.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAppointments(sorted);
      })
      .catch(err => {
        console.error("Failed to load appointments", err);
        setAppointments([]);
      });

    // Auto replace placeholders in the notes if clinic template is present
    if (clinicSettings && clinicSettings.invoice_notes_template) {
      let template = clinicSettings.invoice_notes_template;
      template = template.replace(/{clinic_name}/g, clinicSettings.clinic_name || "");
      template = template.replace(/{pet_name}/g, patientData.name || "");
      template = template.replace(/{owner_name}/g, patientData.owner?.name || "");
      setNotes(template);
    }
  };

  const subtotal = useMemo(() => items.reduce((sum, item) => {
    if (item.billing_behavior !== 'separately_billable' && item.billing_behavior !== undefined) return sum;
    if (item.is_hidden) return sum;
    if (item.is_removed_from_template || item.is_confirmed_used === false) return sum;
    return sum + (item.amount || 0);
  }, 0), [items]);

  // Real-time discount calculations safely capping out at subtotal
  const discountAmount = useMemo(() => {
    let amt = 0;
    if (discountType === "percentage") {
      amt = subtotal * ((discountVal || 0) / 100);
    } else {
      amt = discountVal || 0;
    }
    return amt > subtotal ? subtotal : amt;
  }, [subtotal, discountVal, discountType]);

  const taxable = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = useMemo(() => taxable * 0.12, [taxable]);
  const totalDue = useMemo(() => taxable + taxAmount, [taxable, taxAmount]);
  
  const reviewWarnings = useMemo(() => {
    const warnings = [];
    
    // 1. Removed items
    const removedCount = items.filter(i => i.is_removed_from_template).length;
    if (removedCount > 0) {
      warnings.push({ type: 'info', message: `${removedCount} item(s) were removed from the service template.` });
    }

    // 2. Overrides
    const priceOverrides = items.filter(i => i.was_price_overridden).length;
    if (priceOverrides > 0) {
      warnings.push({ type: 'warning', message: `${priceOverrides} item(s) have manual price overrides.` });
    }

    // 3. Stock checks
    items.forEach(item => {
      if (item.item_type === 'inventory' && !item.is_removed_from_template) {
        const inv = inventory.find(i => i.id === Number(item.inventory_id));
        if (inv && Number(inv.stock_level) < Number(item.qty)) {
          warnings.push({ type: 'error', message: `Insufficient stock for ${item.name}. (Available: ${inv.stock_level})` });
        }
      }
    });

    return warnings;
  }, [items, inventory]);

  const [amountPaid, setAmountPaid] = useState(0);
  const [amountPaidInput, setAmountPaidInput] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [serviceInput, setServiceInput] = useState("");
  const [qtyInput, setQtyInput] = useState(1);
  const [priceInput, setPriceInput] = useState(50);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  const groupedItems = useMemo(() => {
    const term = serviceInput.toLowerCase();
    
    const filteredServices = (Array.isArray(services) ? services : []).filter(s => 
      s.name.toLowerCase().includes(term) || 
      (s.category && s.category.toLowerCase().includes(term))
    ).map(s => ({ ...s, type: 'service' }));

    const filteredInventory = (Array.isArray(inventory) ? inventory : []).filter(i => 
      i.is_sellable && (
        i.item_name.toLowerCase().includes(term) || 
        i.sku?.toLowerCase().includes(term) ||
        i.category?.toLowerCase().includes(term)
      )
    ).map(i => ({ ...i, name: i.item_name, price: i.selling_price, type: 'inventory' }));

    const all = [...filteredServices, ...filteredInventory];

    return all.reduce((acc, item) => {
      const cat = item.type === 'service' ? (item.category || "Services") : (item.category || "Products");
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [services, inventory, serviceInput]);

  const calculateDynamicPrice = (service) => {
    if (service.pricing_type === "weight_based" && patientDetails?.weight !== null) {
      const petWeight = Number(patientDetails.weight);
      const range = weightRanges.find(r => 
        (Number(r.species_id) === Number(petSpeciesId)) &&
        Number(r.min_weight) <= petWeight && 
        (r.max_weight === null || Number(r.max_weight) >= petWeight)
      );
      
      if (range && range.size_category_id) {
        // NEW mapping: weight_based rules now use basis_type 'size' and the size_category_id from the range
        const rule = service.pricing_rules?.find(r => r.basis_type === 'size' && r.reference_id === range.size_category_id);
        if (rule) return Number(rule.price);
      }
    }

    return Number(service.professional_fee || service.price) || 0;
  };

  const selectItemFromDropdown = async (item) => {
    setServiceInput(item.name);
    setSelectedService(item);
    setIsDropdownOpen(false);

    if (item.type === 'service') {
      try {
        const headers = {
          "Accept": "application/json",
          "Authorization": `Bearer ${user.token}`
        };
        const res = await fetch(`/api/invoices/resolve-breakdown?service_id=${item.id}&pet_id=${selectedPatientId}&qty=${qtyInput}&weight=${currentWeight}`, { headers });
        if (!res.ok) throw new Error("Breakdown failed");
        const breakdown = await res.json();
        setPriceInput(breakdown.professional_fee);
      } catch (e) {
        setPriceInput(calculateDynamicPrice(item));
      }
    } else {
      setPriceInput(item.selling_price ?? 0);
    }
  };

  const handleServiceChange = (e) => {
    const val = e.target.value;
    setServiceInput(val);
    setIsDropdownOpen(true);
    
    // Check services first
    const matchedService = services.find(s => s.name.toLowerCase() === val.toLowerCase());
    if (matchedService) {
      setPriceInput(calculateDynamicPrice(matchedService));
      setSelectedService({ ...matchedService, type: 'service' });
      return;
    }

    // Check inventory
    const matchedInv = inventory.find(i => i.item_name.toLowerCase() === val.toLowerCase() && i.is_sellable);
    if (matchedInv) {
      setPriceInput(matchedInv.selling_price ?? 0);
      setSelectedService({ ...matchedInv, name: matchedInv.item_name, type: 'inventory' });
      return;
    }

    setSelectedService(null);
  };


  const addServiceLineItems = (itemName, breakdown, service) => {
    const timestamp = Date.now();
    const newItems = [];

    // 1. The Professional Fee line
    newItems.push({
      id: `li-svc-${timestamp}`,
      name: itemName,
      item_type: 'service',
      service_id: service.id,
      line_type: 'service',
      notes: "Professional Fee",
      qty: qtyInput,
      unitPrice: breakdown.professional_fee,
      amount: breakdown.professional_fee * qtyInput,
      indicator: "bg-blue-400",
      is_hidden: service.show_on_invoice === false,
      is_billable: service.show_on_invoice !== false,
      billing_behavior: service.show_on_invoice === false ? 'internal_only' : 'separately_billable',
      source_type: 'custom', // Manually added service use custom source
      is_confirmed_used: true,
      is_removed_from_template: false,
      was_price_overridden: false,
      was_quantity_overridden: false,
      metadata_snapshot: breakdown.metadata || {}
    });

    // 2. The Item lines (Linked Consumables)
    if (breakdown.item_lines && breakdown.item_lines.length > 0) {
      breakdown.item_lines.forEach((line, idx) => {
        const inv = inventory.find(i => i.id === line.inventory_id);
        const itemQty = line.quantity; 
        const isBillable = line.is_billable;
        const unitPrice = line.unit_price;

        newItems.push({
          id: `li-item-${timestamp}-${idx}`,
          name: inv?.item_name || "Linked Item",
          item_type: 'inventory',
          inventory_id: line.inventory_id,
          line_type: 'item',
          notes: line.notes || `Linked to ${itemName}`,
          qty: itemQty,
          unitPrice: unitPrice,
          amount: unitPrice * itemQty,
          indicator: "bg-emerald-400",
          is_hidden: !isBillable,
          is_billable: isBillable,
          billing_behavior: line.billing_behavior || (isBillable ? 'separately_billable' : 'internal_only'),
          source_type: 'custom',
          is_confirmed_used: true,
          is_removed_from_template: false,
          was_price_overridden: false,
          was_quantity_overridden: false,
          can_modify: service.allow_manual_item_override !== false,
          parent_id: `li-svc-${timestamp}`
        });
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const manuallyAddItem = async () => {
    if (!serviceInput) return;
    
    let itemName = serviceInput;
    let itemType = selectedService?.type || 'service';
    let serviceId = itemType === 'service' ? selectedService?.id : null;
    let inventoryId = itemType === 'inventory' ? selectedService?.id : null;

    if (itemType === 'service' && selectedService?.pricing_type === "weight_based" && patientDetails?.weight !== null) {
      itemName = `${serviceInput} (${patientDetails.weight}kg)`;
    }

    // Duplicate Check
    const isDuplicate = items.some(i => 
      !i.is_removed_from_template && 
      ((serviceId && i.service_id === serviceId && i.item_type === 'service') || 
       (inventoryId && i.inventory_id === inventoryId && i.item_type === 'inventory'))
    );

    if (isDuplicate) {
      toast.error(`${itemName} is already in the invoice.`);
      setSelectedService(null);
      setServiceInput("");
      return;
    }

    if (itemType === 'service' && selectedService) {
      // If we have a selected service, we should use the breakdown to add linked items
      try {
        const headers = { "Accept": "application/json", "Authorization": `Bearer ${user.token}` };
        const res = await fetch(`/api/invoices/resolve-breakdown?service_id=${selectedService.id}&pet_id=${selectedPatientId}&qty=${qtyInput}&weight=${currentWeight}`, { headers });
        if (res.ok) {
          const breakdown = await res.json();
          addServiceLineItems(itemName, breakdown, selectedService);
          // Reset inputs and return
          setServiceInput("");
          setQtyInput(1);
          setPriceInput(50);
          setSelectedService(null);
          return;
        }
      } catch (e) {
        console.error("Manual add breakdown failed, falling back to flat item", e);
      }
    }

    const newItem = {
      id: `li-${Date.now()}`,
      name: itemName,
      item_type: itemType,
      inventory_id: inventoryId,
      notes: itemType === 'inventory' ? "Inventory Product" : "Manual Adjustment",
      qty: qtyInput,
      unitPrice: priceInput,
      amount: priceInput * qtyInput,
      indicator: itemType === 'inventory' ? "bg-emerald-400" : "bg-slate-400",
      billing_behavior: 'separately_billable',
      source_type: 'manual',
      is_confirmed_used: true,
      is_removed_from_template: false,
      was_price_overridden: Number(priceInput) !== (selectedService?.price || 50),
      was_quantity_overridden: Number(qtyInput) !== 1
    };
    setItems((prev) => [...prev, newItem]);

    setServiceInput("");
    setQtyInput(1);
    setPriceInput(50);
    setSelectedService(null);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.map((item) => {
      if (item.id === id) {
        if (item.source_type === 'appointment_template' || item.client_id) {
           return { ...item, is_removed_from_template: true, is_confirmed_used: false };
        }
      }
      return item;
    }).filter(item => {
      // Really remove from array if it was pure manual and not saved yet
      if (item.id === id && item.source_type === 'manual' && !item.client_id) {
        return false;
      }
      return true;
    }));
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "qty" || field === "unitPrice") {
            updated.amount = Number(updated.qty || 0) * Number(updated.unitPrice || 0);
            if (field === "qty") updated.was_quantity_overridden = true;
            if (field === "unitPrice") updated.was_price_overridden = true;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const resetForm = () => {
    setItems([]);
    if (processedApptsRef.current) processedApptsRef.current.clear();
    setDiscountVal(0);
    setNotes(clinicSettings ? clinicSettings.invoice_notes_template || "" : "");
    setSelectedPatientId("");
    setPatientDetails(null);
    setStatus("Draft");
    setAmountPaid(0);
    setAmountPaidInput("0");
    setPaymentMethod("Cash");
  };

  const submitInvoice = async (finalStatus) => {
    if (items.length === 0) {
      toast.error("Cannot save an invoice without items.");
      return;
    }
    if (!selectedPatientId) {
      toast.error("Please select a patient.");
      return;
    }

    // Determine status logic based on amount paid vs total
    let actualStatus = finalStatus;
    if (finalStatus === "Finalized" && amountPaid > 0) {
      if (amountPaid >= totalDue) {
        actualStatus = "Paid";
      } else {
        actualStatus = "Partially Paid";
      }
    }

    const payload = {
      pet_id: selectedPatientId,
      appointment_id: selectedAppointmentId || null,
      pet_weight: currentWeight || null,
      status: actualStatus,
      subtotal: subtotal,
      discount_type: discountType,
      discount_value: discountVal,
      tax_rate: 12.00,
      total: totalDue,
      amount_paid: amountPaid,
      payment_method: paymentMethod,
      notes_to_client: notes,
      items: items.map(item => ({
        client_id: item.id,
        item_type: item.item_type || 'service',
        line_type: item.line_type || (item.item_type === 'service' ? 'service' : 'item'),
        service_id: item.service_id,
        inventory_id: item.inventory_id,
        name: item.name,
        notes: item.notes,
        qty: item.qty,
        unit_price: item.unitPrice,
        amount: item.amount,
        is_hidden: !!item.is_hidden,
        billing_behavior: item.billing_behavior || 'separately_billable',
        source_type: item.source_type || 'manual',
        is_confirmed_used: item.is_confirmed_used ?? true,
        is_removed_from_template: item.is_removed_from_template ?? false,
        was_price_overridden: item.was_price_overridden ?? false,
        was_quantity_overridden: item.was_quantity_overridden ?? false,
        unit_price_snapshot: item.unitPrice,
        line_total_snapshot: item.amount,
        metadata_snapshot: item.metadata_snapshot || null,
        parent_invoice_id: item.parent_id || null // Add client-side parent ID
      }))
    };
    if (!selectedAppointmentId) {
      toast.error("Please select an appointment for this invoice.");
      return;
    }

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Accept": "application/json",
          "Authorization": `Bearer ${user?.token}`
        },
        body: JSON.stringify(payload)
      });

      clearErrors();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 422) {
          setLaravelErrors(errorData);
          toast.error("Validation error. Please check specified fields.");
        } else {
          // Extract specific error if backend provided it
          const detail = errorData.error || errorData.message || "Failed to save invoice";
          throw new Error(detail);
        }
        return;
      }

      toast.success(`Invoice ${finalStatus === "Draft" ? "saved as draft" : "finalized"} successfully.`);

      if (finalStatus !== "Draft") {
        setStatus(actualStatus);
        setIsPreviewMode(true); // Automatically switch to preview mode on finalization
      } else {
        resetForm();
      }
    } catch (err) {
      toast.error(err.message || "Failed to save invoice");
      console.error(err);
    }
  };

  return (
    <div className="card-shell overflow-hidden p-0">
      <div className={clsx(
        "grid grid-cols-1 lg:h-[calc(100vh-11rem)]",
        isPreviewMode ? "lg:grid-cols-1" : "lg:grid-cols-[410px_1fr]"
      )}>
        {!isPreviewMode && (
          <aside className="flex h-full flex-col overflow-hidden border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card lg:border-b-0 lg:border-r lg:border-slate-200 dark:border-dark-border">
            <div className="shrink-0 border-b border-slate-200 dark:border-dark-border p-5">
              <p className="text-sm text-slate-500 dark:text-zinc-400">Invoice &gt; New Invoice</p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">New Invoice</h2>
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {status}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">Patient Details</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                    <select
                      value={selectedOwnerId}
                      onChange={(e) => {
                        setSelectedOwnerId(e.target.value);
                        setSelectedPatientId(""); // reset pet
                        setSelectedAppointmentId(""); // reset appointment
                        setPatientDetails(null);
                        setAppointments([]);
                      }}
                      className="h-11 w-full appearance-none rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-10 pr-8 text-sm text-slate-700 dark:text-zinc-300 focus:outline-none"
                      disabled={status === "Finalized"}
                    >
                      <option value="">Select an owner...</option>
                      {owners.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                  </div>

                  <div className="relative">
                    <select
                      value={selectedPatientId}
                      onChange={handlePatientSelect}
                      disabled={!selectedOwnerId || status === "Finalized"}
                      className={clsx(
                        "h-11 w-full appearance-none rounded-xl border pl-4 pr-8 text-sm focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                        getError("pet_id") ? "border-rose-500 bg-rose-50/10" : "border-slate-200 dark:border-dark-border bg-slate-50"
                      )}
                    >
                      <option value="">Select a pet...</option>
                      {(Array.isArray(pets) ? pets : []).filter(p => p.owner_id?.toString() === selectedOwnerId?.toString()).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.species?.name || "Unknown"}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                    {getError("pet_id") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("pet_id")}</p>}
                  </div>

                  <div className="relative">
                    <select
                      value={selectedAppointmentId}
                      onChange={(e) => {
                        const newApptId = e.target.value;
                        if (!newApptId || newApptId === selectedAppointmentId) {
                          setSelectedAppointmentId(newApptId);
                          return;
                        }
                        setSelectedAppointmentId(newApptId);
                        
                        if (newApptId) {
                          const appt = appointments.find(a => a.id.toString() === newApptId.toString());
                          if (appt && appt.service) {
                            // Auto-load service into invoice
                            const headers = { "Accept": "application/json", "Authorization": `Bearer ${user?.token}` };
                            const targetUrl = `/api/invoices/resolve-breakdown?service_id=${appt.service_id}&pet_id=${selectedPatientId || ""}&qty=1&weight=${currentWeight || ""}`;
                            console.log("[DEBUG] Fetching breakdown from:", targetUrl);
                            
                            fetch(targetUrl, { headers })
                              .then(res => {
                                if (!res.ok) {
                                  return res.json().then(data => {
                                    console.error("[ERROR] API Response Body:", data);
                                    const detailedMsg = data.errors ? Object.values(data.errors).flat().join(", ") : (data.message || "Failed to resolve pricing");
                                    throw new Error(detailedMsg);
                                  });
                                }
                                return res.json();
                              })
                              .then(breakdown => {
                                console.log("[DEBUG] Breakdown Received:", breakdown);
                                const timestamp = Date.now();
                                const newItems = [];
                                
                                const fee = Number(breakdown.professional_fee) || 0;
                                newItems.push({
                                  id: `li-svc-${timestamp}`,
                                  name: appt.service.name,
                                  item_type: 'service',
                                  service_id: appt.service.id,
                                  line_type: 'service',
                                  notes: "From Appointment",
                                  qty: 1,
                                  unitPrice: fee,
                                  amount: fee * 1,
                                  indicator: "bg-blue-400",
                                  is_hidden: appt.service.show_on_invoice === false,
                                  is_billable: appt.service.show_on_invoice !== false,
                                  billing_behavior: appt.service.show_on_invoice === false ? 'internal_only' : 'separately_billable',
                                  source_type: 'appointment_template',
                                  is_confirmed_used: true,
                                  is_removed_from_template: false,
                                  was_price_overridden: false,
                                  was_quantity_overridden: false,
                                  metadata_snapshot: { ...(breakdown.metadata || {}), auto_loaded: true }
                                });
                                
                                if (breakdown.item_lines && breakdown.item_lines.length > 0) {
                                  breakdown.item_lines.forEach((line, idx) => {
                                    const inv = inventory.find(i => i.id === line.inventory_id);
                                    const uPrice = Number(line.unit_price) || 0;
                                    const lQty = Number(line.quantity) || 1;

                                    newItems.push({
                                      id: `li-item-${timestamp}-${idx}`,
                                      name: inv?.item_name || line.name || "Linked Item",
                                      item_type: 'inventory',
                                      inventory_id: line.inventory_id,
                                      line_type: 'item',
                                      notes: "Template Applied",
                                      qty: lQty,
                                      unitPrice: uPrice,
                                      amount: uPrice * lQty,
                                      indicator: "bg-emerald-400",
                                      is_hidden: !line.is_billable,
                                      is_billable: line.is_billable,
                                      billing_behavior: line.billing_behavior || (line.is_billable ? 'separately_billable' : 'internal_only'),
                                      source_type: 'appointment_template',
                                      is_confirmed_used: true,
                                      is_removed_from_template: false,
                                      was_price_overridden: false,
                                      was_quantity_overridden: false,
                                      can_modify: appt.service.allow_manual_item_override !== false,
                                      parent_id: `li-svc-${timestamp}`
                                    });
                                  });
                                }
                                
                                 console.log("[DEBUG] Constructed newItems:", newItems);
                                 
                                 // Prevent duplicate insertion if already exists
                                 setItems(prev => {
                                   const exists = prev.some(i => i.service_id === appt.service_id && !i.is_removed_from_template);
                                   if (exists) {
                                     console.warn("[DEBUG] Service already exists in items, skipping.");
                                     toast.error("Service from appointment is already in the invoice.");
                                     return prev;
                                   }
                                   
                                   processedApptsRef.current.add(newApptId);
                                   toast.success(`${appt.service.name} auto-loaded from appointment.`);
                                   const updated = [...prev, ...newItems];
                                   console.log("[DEBUG] Successfully added items. New count:", updated.length);
                                   return updated;
                                 });
                              })
                              .catch(err => {
                                console.error("[ERROR] Failed to resolve breakdown for auto-load:", err);
                                toast.error(err.message || "Failed to load service pricing.");
                              });
                          }
                        }
                      }}
                      disabled={!selectedPatientId || status === "Finalized"}
                      className={clsx(
                        "h-11 w-full appearance-none rounded-xl border pl-4 pr-8 text-sm focus:outline-none disabled:opacity-50 dark:bg-dark-surface dark:text-zinc-300",
                        getError("appointment_id") ? "border-rose-500 bg-rose-50/10" : "border-slate-200 dark:border-dark-border bg-slate-50"
                      )}
                    >
                      <option value="">Select an appointment...</option>
                      {appointments.map(appt => (
                        <option key={appt.id} value={appt.id}>
                          {formatDate(appt.date)} {appt.time ? `@ ${appt.time}` : ""} - {appt.title}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                    {getError("appointment_id") && <p className="mt-1 text-xs font-medium text-rose-500">{getError("appointment_id")}</p>}
                  </div>

                   {patientDetails && (
                    <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-3 text-sm">
                      <div className="mb-3 flex items-center justify-between">
                         <strong className="text-slate-700 dark:text-zinc-300">Weight Override (kg)</strong>
                         <input 
                            type="number" 
                            step="0.01" 
                            value={currentWeight} 
                            onChange={(e) => {
                               setCurrentWeight(e.target.value);
                               // Force price recalculation for items in the list?
                               // For simplicity, we just update the state and newly added items will use it.
                            }}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold text-blue-600 focus:outline-none dark:bg-dark-card dark:border-dark-border"
                         />
                      </div>
                      <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Owner:</strong> {patientDetails.owner?.name}</p>
                      <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Contact:</strong> {patientDetails.owner?.phone || "N/A"}</p>
                      <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Email:</strong> {patientDetails.owner?.email || "N/A"}</p>
                      <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Address:</strong> {
                        [patientDetails.owner?.address, patientDetails.owner?.city, patientDetails.owner?.province, patientDetails.owner?.zip_code].filter(Boolean).join(", ") || "N/A"
                      }</p>
                      <p className="mt-2 text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Species/Breed:</strong> {patientDetails.species?.name} {patientDetails.breed?.name ? `• ${patientDetails.breed?.name}` : ""}</p>
                      {patientDetails.date_of_birth && (
                        <p className="text-slate-500 dark:text-zinc-400"><strong className="text-slate-700 dark:text-zinc-300">Age:</strong> {(() => {
                          const dob = new Date(patientDetails.date_of_birth);
                          const diff = Date.now() - dob.getTime();
                          const ageDate = new Date(diff);
                          return Math.abs(ageDate.getUTCFullYear() - 1970);
                        })()} yrs</p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {reviewWarnings.length > 0 && (
                <section className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 dark:border-amber-900/20 dark:bg-amber-900/10">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-500 flex items-center gap-2">
                    <FiBell className="h-3 w-3" /> Pre-Finalization Review
                  </h3>
                  <ul className="space-y-2">
                    {reviewWarnings.map((w, idx) => (
                      <li key={idx} className={clsx(
                        "text-[11px] font-medium flex gap-2",
                        w.type === 'error' ? "text-rose-600 dark:text-rose-400" : 
                        w.type === 'warning' ? "text-amber-700 dark:text-amber-500" : 
                        "text-slate-500 dark:text-zinc-400"
                      )}>
                        <span>•</span>
                        {w.message}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">Services &amp; Meds</h3>


                <div className="grid grid-cols-[1fr_54px_80px_auto] gap-2 items-center">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search or add service..."
                      value={serviceInput}
                      onChange={handleServiceChange}
                      onFocus={() => setIsDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          manuallyAddItem();
                          setIsDropdownOpen(false);
                        }
                      }}
                      disabled={status === "Finalized"}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3 text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:text-zinc-500 disabled:opacity-50"
                    />
                    {isDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card p-2 shadow-lg z-50">
                        {Object.keys(groupedItems).length > 0 ? (
                          Object.entries(groupedItems).map(([category, svcs]) => (
                            <div key={category} className="mb-2 last:mb-0">
                              <div className="bg-slate-50 dark:bg-dark-surface px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 rounded-md">
                                {category}
                              </div>
                              <ul className="mt-1 space-y-1">
                                {svcs.map((item) => (
                                  <li key={`${item.type}-${item.id}`}>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => selectItemFromDropdown(item)}
                                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-dark-surface"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={clsx(
                                          "h-1.5 w-1.5 rounded-full",
                                          item.type === 'inventory' ? "bg-emerald-500" : "bg-blue-500"
                                        )} />
                                        <span>{item.name}</span>
                                      </div>
                                      <span className="text-slate-400 dark:text-zinc-500">{currency(item.price)}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-sm text-slate-500 dark:text-zinc-400">
                            {services.length === 0 && inventory.length === 0 ? "No services or products found." : "No matching items."}
                          </div>
                        )}
                        {serviceInput && !services.find(s => s.name.toLowerCase() === serviceInput.toLowerCase()) && (
                           <div className="mt-2 border-t border-slate-100 dark:border-dark-border pt-2 text-center">
                              <p className="text-xs text-slate-500 mb-1 dark:text-zinc-500">Create new item</p>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { manuallyAddItem(); setIsDropdownOpen(false); }}
                                className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                              >
                                + Add &quot;{serviceInput}&quot;
                              </button>
                           </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    disabled={status === "Finalized"}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-2 text-center text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                  />
                  <div className="relative w-full">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">₱</span>
                    <input
                      type="number"
                      min="0"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      disabled={status === "Finalized" || (selectedService && selectedService.pricing_mode !== "manual")}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-6 pr-2 text-sm text-slate-700 dark:text-zinc-300 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { manuallyAddItem(); setIsDropdownOpen(false); }}
                    disabled={!serviceInput || status === "Finalized"}
                    className="h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-slate-900 dark:hover:bg-zinc-200"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {items.length > 0 ? items.filter(i => !i.parent_id).map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">
                            <span className={`inline-block h-2 w-2 rounded-full ${item.indicator}`} />
                            {item.name}
                            <span className={clsx(
                              "ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded-md font-bold",
                              item.item_type === 'inventory' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            )}>
                              {item.item_type === 'inventory' ? 'Product' : 'Service'}
                            </span>
                            {item.is_hidden && (
                              <span className="ml-1 text-[10px] uppercase px-1.5 py-0.5 rounded-md font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Internal
                              </span>
                            )}
                            {item.metadata_snapshot?.auto_loaded && (
                              <span className="ml-1 text-[10px] uppercase px-1.5 py-0.5 rounded-md font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                From Appointment
                              </span>
                            )}
                            {item.is_removed_from_template && (
                              <span className="ml-1 text-[10px] uppercase px-1.5 py-0.5 rounded-md font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                                Removed
                              </span>
                            )}
                          </p>
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">{item.notes}</p>
                            
                            {items.filter(i => i.parent_id === item.id).length > 0 && (
                              <button 
                                onClick={() => setExpandedItems(prev => ({...prev, [item.id]: expandedItems[item.id] === false}))}
                                className="mt-2 text-xs font-semibold text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
                              >
                                {expandedItems[item.id] !== false ? <FiChevronDown className="rotate-180 transition-transform" /> : <FiChevronDown className="transition-transform" />}
                                {items.filter(i => i.parent_id === item.id).length} Linked Items
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className={clsx("text-2xl font-semibold text-slate-900 dark:text-zinc-50 leading-none", item.is_removed_from_template && "line-through opacity-50")}>{currency(item.amount)}</p>
                            {status === "Draft" && (
                              item.is_removed_from_template ? (
                                <button onClick={() => {
                                  setItems(prev => prev.map(p => p.id === item.id || p.parent_id === item.id ? { ...p, is_removed_from_template: false, is_confirmed_used: true } : p));
                                }} className="mt-1 text-xs font-semibold text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                                  Restore
                                </button>
                              ) : (
                                <button onClick={() => {
                                  removeItem(item.id);
                                  items.filter(i => i.parent_id === item.id).forEach(c => removeItem(c.id));
                                }} className="mt-1 text-xs font-semibold text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300">
                                  Remove
                                </button>
                              )
                            )}
                          </div>
                        </div>

                      {/* Children section */}
                      {expandedItems[item.id] !== false && items.filter(i => i.parent_id === item.id).length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-slate-200 dark:border-dark-border space-y-2">
                          {items.filter(i => i.parent_id === item.id).map(child => (
                            <div key={child.id} className="flex items-center justify-between rounded-lg bg-white dark:bg-dark-card border border-slate-100 dark:border-dark-border p-2 shadow-sm relative overflow-hidden group">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 opacity-80" />
                              <div className="min-w-0 pl-2 flex flex-col">
                                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                  {child.name}
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold dark:bg-slate-800 dark:text-slate-400">
                                    Template Applied
                                  </span>
                                  {child.is_hidden && (
                                     <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold dark:bg-slate-800 dark:text-slate-400">
                                       Internal Only
                                     </span>
                                  )}
                                  {child.is_removed_from_template && (
                                     <span className="text-[10px] bg-rose-100 text-rose-700 px-1 py-0.5 rounded font-bold dark:bg-rose-900/30 dark:text-rose-400">
                                       Removed
                                     </span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500">{child.notes}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                  <div className="flex items-center flex-col justify-end gap-0.5 min-w-[120px]">
                                      <p className="text-sm text-slate-900 font-bold dark:text-zinc-50 leading-none">{currency(child.amount)}</p>
                                      <div className={clsx("text-[10px] font-medium text-slate-400 flex items-center gap-1", child.is_removed_from_template && "opacity-50 line-through")}>
                                          {child.can_modify && status === "Draft" && !child.is_removed_from_template ? (
                                            <div className="flex items-center gap-1">
                                              <span>Qty:</span>
                                              <input 
                                                type="number"
                                                min="0.01" step="0.01"
                                                value={child.qty}
                                                onChange={e => updateItem(child.id, 'qty', e.target.value)}
                                                className="w-10 rounded border border-slate-200 px-1 text-center py-0 focus:border-blue-500 outline-none h-4 dark:bg-dark-card"
                                              />
                                            </div>
                                          ) : (
                                            <span>{child.qty} qty</span>
                                          )}
                                          <span>•</span>
                                          <span>{currency(child.unitPrice)}</span>
                                      </div>
                                  </div>
                                {status === "Draft" && child.can_modify && (
                                  child.is_removed_from_template ? (
                                    <button onClick={() => setItems(prev => prev.map(p => p.id === child.id ? { ...p, is_removed_from_template: false, is_confirmed_used: true } : p))} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors opacity-100 text-xs font-bold">
                                      Restore
                                    </button>
                                  ) : (
                                    <button onClick={() => removeItem(child.id)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100">
                                      <FiXCircle size={14} />
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {item.is_hidden && (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">
                            This item is used for internal tracking and inventory deduction. It will not appear on the client's printed invoice.
                          </div>
                      )}

                      {item.warning ? (
                        <span className="mt-2 inline-block rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          {item.warning}
                        </span>
                      ) : null}
                    </article>
                  )) : (
                    <p className="pt-4 text-center text-sm text-slate-400">No items added yet.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="shrink-0 space-y-4 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-5 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)]">
              <section className="space-y-3">
                {/* Tax and Discount removed as per user request */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-zinc-300">Note to Client</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={status === "Finalized"}
                    placeholder="Visible on the invoice..."
                    className="w-full rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:text-zinc-500 disabled:opacity-50 focus:outline-none"
                  />
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-dark-card px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => submitInvoice("Draft")}
                  disabled={status !== "Draft"}
                  className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Save Draft
                </button>
              </div>
            </div>
          </aside>
        )}

        <section className="flex h-full flex-col overflow-hidden bg-slate-100 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-dark-border bg-white dark:bg-dark-card px-5 py-3 shrink-0">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-zinc-400">
              <button 
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={clsx(
                  "inline-flex items-center gap-2 font-semibold transition-colors px-3 py-1.5 rounded-lg no-print",
                  isPreviewMode ? "bg-blue-600 text-white" : "text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-dark-surface"
                )}
              >
                <FiEye className="h-4 w-4" />
                {isPreviewMode ? "Exit Preview" : "Preview Mode"}
              </button>
              <span className="no-print">Invoice Status: <b className="text-slate-700 dark:text-slate-300">{status}</b></span>
              {status !== "Draft" && (
                <button
                  onClick={() => resetForm()}
                  className="inline-flex items-center gap-2 font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 px-3 py-1.5 rounded-lg transition-colors no-print"
                >
                  <FiPlusCircle className="h-4 w-4" />
                  New Invoice
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={() => window.print()}
                className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
              >
                <FiPrinter className="h-4 w-4" />
              </button>
              <button
                onClick={async () => {
                  if (items.length === 0) {
                    toast.error("Add items before downloading PDF.");
                    return;
                  }
                  
                  toast.info("Generating PDF, please wait...");
                  try {
                    const filename = `Invoice_${status}_${Date.now()}.pdf`;
                    await generateInvoicePDF(printableRef.current, filename);
                    toast.success("Invoice downloaded successfully.");
                  } catch (e) {
                    toast.error("Failed to generate PDF.");
                  }
                }}
                className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-dark-surface dark:bg-zinc-950"
              >
                <FiDownload className="h-4 w-4" />
              </button>
              <button
                onClick={() => submitInvoice("Finalized")}
                disabled={status !== "Draft"}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <FiSend className="h-4 w-4" />
                Finalize &amp; Send
              </button>
              <button
                onClick={() => setIsSendModalOpen(true)}
                disabled={status === "Draft"}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-dark-surface px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-200 disabled:opacity-50"
              >
                <FiBell className="h-4 w-4" />
                Notify Client
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 text-left">
            <article className="mx-auto max-w-4xl rounded-sm bg-white dark:bg-dark-card p-6 sm:p-8 md:p-12 shadow-md printable-invoice">
              <header className="flex flex-row items-start justify-between gap-4 sm:gap-6">
                <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                  <p className="inline-flex items-center gap-2.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                    {clinicSettings?.clinic_logo ? (
                      <img src={clinicSettings.clinic_logo} alt="Logo" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0">
                        <LuPawPrint className="h-4 w-4" />
                      </span>
                    )}
                    <span className="truncate">{clinicSettings?.clinic_name || "AutoVet Clinic"}</span>
                  </p>
                  <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400 truncate whitespace-normal">
                    {clinicSettings?.address && (
                      <p className="mb-0.5">{clinicSettings.address}</p>
                    )}
                    {(clinicSettings?.primary_email || clinicSettings?.phone_number) && (
                      <p className="mb-0.5">
                        {[clinicSettings.phone_number, clinicSettings.primary_email].filter(Boolean).join(" • ")}
                      </p>
                    )}
                    {clinicSettings?.clinic_tax_id && <p>Tax ID: {clinicSettings.clinic_tax_id}</p>}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-3xl font-light tracking-wide text-slate-300 dark:text-zinc-600">INVOICE</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-700 dark:text-zinc-300">#VB-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}-0000</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">Due: Upon Receipt</p>
                </div>
              </header>

              <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Bill To</p>
                  {patientDetails ? (
                    <>
                      <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-50">{patientDetails?.owner?.name || "Guest Client"}</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-zinc-400">
                        <p>{patientDetails?.owner?.address || "No address provided"}</p>
                        <p>{patientDetails?.owner?.email}</p>
                        <p>{patientDetails?.owner?.phone}</p>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400 dark:text-zinc-500 italic">No patient selected</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Patient</p>
                  {patientDetails ? (
                    <div className="mt-2 flex items-center gap-3">
                      <img
                        src={patientDetails.photo ? getActualPetImageUrl(patientDetails.photo) : getPetImageUrl(patientDetails.species?.name, patientDetails.breed?.name)}
                        alt={patientDetails.name}
                        className="h-10 w-10 rounded-full object-cover bg-slate-100 dark:bg-zinc-800"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-zinc-50">{patientDetails.name}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {patientDetails?.species?.name || "Unknown"} • {patientDetails?.breed?.name || "Unknown"}
                          {patientDetails.date_of_birth && ` • ${(() => {
                            const dob = new Date(patientDetails.date_of_birth);
                            const diff = Date.now() - dob.getTime();
                            const ageDate = new Date(diff);
                            return Math.abs(ageDate.getUTCFullYear() - 1970);
                          })()} yrs`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500 italic">Select to view pet details</p>
                  )}
                </div>
              </section>

              <section className="mt-8 border-y border-slate-200 dark:border-dark-border py-3">
                <div className="grid grid-cols-[1fr_60px_100px_100px] text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <p>Description</p>
                  <p className="text-right">Qty</p>
                  <p className="text-right">Unit Price</p>
                  <p className="text-right">Amount</p>
                </div>

                <div className="mt-3 space-y-3">
                  {items.filter(item => !item.is_hidden).map((item) => (
                    <div key={`doc-${item.id}`} className="grid grid-cols-[1fr_60px_100px_100px] items-start gap-2 border-b border-slate-100 dark:border-dark-border pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{item.name}</p>
                          <span className={clsx(
                            "text-[8px] uppercase px-1 rounded-sm font-bold border",
                            item.item_type === 'inventory' ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-blue-200 text-blue-600 bg-blue-50"
                          )}>
                            {item.item_type === 'inventory' ? 'PROD' : 'SERV'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {item.notes || (item.item_type === 'service' ? 'Service Fee' : '')}
                        </p>
                      </div>
                      {status === "Draft" && !isPreviewMode ? (
                        <>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                            className="w-full bg-transparent text-right text-sm text-slate-700 focus:outline-none focus:border-b focus:border-blue-500 dark:text-zinc-300"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                            className="w-full bg-transparent text-right text-sm text-slate-700 focus:outline-none focus:border-b focus:border-blue-500 dark:text-zinc-300"
                          />
                        </>
                      ) : (
                        <>
                          <p className="text-right text-sm text-slate-700 dark:text-zinc-300">{item.qty}</p>
                          <p className="text-right text-sm text-slate-700 dark:text-zinc-300">{currency(item.unitPrice)}</p>
                        </>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <p className="text-right text-sm font-semibold text-slate-900 dark:text-zinc-50">{currency(item.amount)}</p>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                     <p className="py-4 text-center text-sm text-slate-400 dark:text-zinc-500 italic">No line items added yet.</p>
                  )}
                </div>
              </section>

<section className="mt-6 ml-auto w-full max-w-sm space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-zinc-300">
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-zinc-300">
                  <span>VAT (12%)</span>
                  <span>{currency(taxAmount)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 dark:border-dark-border pt-3">
                  <span className="text-lg font-bold text-slate-900 dark:text-zinc-50">Total Due</span>
                  <span className="text-2xl font-bold text-blue-600">{currency(totalDue)}</span>
                </div>

                <div className="mt-6 border-t border-slate-200 dark:border-dark-border pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">Payment Details</p>
                  
                  {status === "Draft" && !isPreviewMode ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-9 w-full flex items-center rounded-lg border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface px-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-2">Method:</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Cash</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-sm">₱</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={amountPaidInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              setAmountPaidInput(val);
                              const numVal = parseFloat(val);
                              setAmountPaid(!isNaN(numVal) ? numVal : 0);
                            }
                          }}
                          onBlur={() => {
                            if (amountPaidInput === "" || isNaN(parseFloat(amountPaidInput))) {
                              setAmountPaidInput("0");
                              setAmountPaid(0);
                            } else {
                              const numVal = parseFloat(amountPaidInput);
                              setAmountPaidInput(numVal.toString());
                              setAmountPaid(numVal);
                            }
                          }}
                          onFocus={(e) => {
                            if (amountPaidInput === "0") {
                              setAmountPaidInput("");
                            }
                            e.target.select();
                          }}
                          placeholder="Amount Paid"
                          className="h-9 w-full rounded-lg border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface pl-7 pr-3 text-sm text-slate-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 text-sm text-slate-700 dark:text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Method</span>
                        <span className="font-bold">{paymentMethod || "Not Recorded"}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-dark-border pb-1">
                        <span className="text-slate-500">Amount Paid</span>
                        <span className="font-bold">{currency(amountPaid)}</span>
                      </div>
                    </div>
                  )}

                  {/* Balance / Change Calculation Display */}
                  <div className="mt-3 space-y-1">
                    {amountPaid > totalDue ? (
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter text-[10px]">Change</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg">{currency(amountPaid - totalDue)}</span>
                      </div>
                    ) : amountPaid < totalDue && amountPaid > 0 ? (
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-rose-500 dark:text-rose-400 uppercase tracking-tighter text-[10px]">Balance Due</span>
                        <span className="font-black text-rose-500 dark:text-rose-400 text-lg">{currency(totalDue - amountPaid)}</span>
                      </div>
                    ) : amountPaid === totalDue && totalDue > 0 ? (
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">Fully Paid</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <footer className="mt-12 border-t border-slate-200 dark:border-dark-border pt-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Notes to Client</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-300 whitespace-pre-wrap">
                  {notes || "No additional notes provided."}
                </p>
                <p className="mt-8 text-center text-xs text-slate-400 dark:text-zinc-500">Powered by AutoVet Systems</p>
              </footer>
            </article>
          </div>
        </section>
      </div>

      <ManualSendModal 
        isOpen={isSendModalOpen} 
        onClose={() => setIsSendModalOpen(false)} 
        owner={patientDetails?.owner}
        relatedObject={null}
        relatedType="App\Models\Invoice"
      />

      <div className="hidden-for-preview">
        <div ref={printableRef}>
          <PrintableInvoice 
            data={{
              invoice_number: status === "Draft" ? `DRAFT-${Date.now()}` : "VB-2026-04-0001",
              date: new Date().toLocaleDateString(),
              items,
              subtotal,
              taxAmount,
              totalDue,
              amountPaid,
              paymentMethod,
              notes,
              status
            }}
            patient={patientDetails}
            clinic={clinicSettings}
          />
        </div>
      </div>
    </div>
  );
}

export default InvoiceModuleView;
