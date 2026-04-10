import React from 'react';
import { LuPawPrint } from "react-icons/lu";

const currency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

const PrintableInvoice = ({ data, patient, clinic }) => {
  if (!data) return null;

  const {
    invoice_number,
    date,
    items = [],
    subtotal = 0,
    taxAmount = 0,
    totalDue = 0,
    amountPaid = 0,
    paymentMethod = "",
    notes = "",
    status = "Draft"
  } = data;

  const billableItems = items.filter(item => !item.is_hidden && !item.is_removed_from_template);

  return (
    <div className="bg-white p-12 text-slate-800 w-[210mm] min-h-[297mm] mx-auto shadow-none print:shadow-none print:m-0 printable-document" id="printable-invoice">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-100 pb-10">
        <div className="flex gap-6 items-center">
          {clinic?.clinic_logo ? (
            <img src={clinic.clinic_logo} alt="Logo" className="h-20 w-20 rounded-full object-cover shadow-sm" />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
              <LuPawPrint size={40} />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{clinic?.clinic_name || "AutoVet Clinic"}</h1>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs leading-relaxed">{clinic?.address}</p>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {[clinic?.phone_number, clinic?.primary_email].filter(Boolean).join(" • ")}
            </p>
            {clinic?.clinic_tax_id && <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Tax ID: {clinic.clinic_tax_id}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-5xl font-black text-slate-100 tracking-tighter uppercase leading-none">Invoice</h2>
          <div className="mt-6 space-y-1">
            <p className="text-base font-bold text-slate-900">{invoice_number || "VB-PENDING"}</p>
            <p className="text-xs text-slate-500 font-medium font-mono lowercase">Date: {date || new Date().toLocaleDateString()}</p>
            <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                    status === 'Draft' ? 'bg-amber-100 text-amber-700' : 
                    'bg-blue-100 text-blue-700'
                }`}>
                    {status}
                </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Sections */}
      <div className="grid grid-cols-2 gap-12 mt-12 pb-12 border-b border-slate-50">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Client Information</h3>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{patient?.owner?.name || "Guest Client"}</p>
          <div className="text-sm text-slate-500 mt-3 space-y-1.5 leading-relaxed">
            <p className="flex items-start gap-2">
                <span className="shrink-0 font-bold text-slate-400 w-4">A:</span>
                <span>{patient?.owner?.address || "No address provided"}</span>
            </p>
            {patient?.owner?.email && (
                <p className="flex items-center gap-2">
                    <span className="shrink-0 font-bold text-slate-400 w-4">E:</span>
                    <span>{patient.owner.email}</span>
                </p>
            )}
            {patient?.owner?.phone && (
                <p className="flex items-center gap-2">
                    <span className="shrink-0 font-bold text-slate-400 w-4">P:</span>
                    <span>{patient.owner.phone}</span>
                </p>
            )}
          </div>
        </div>
        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Patient Profile</h3>
          <div className="flex gap-4 items-center">
            {patient?.photo ? (
                <img src={patient.photo} alt={patient.name} className="h-16 w-16 rounded-2xl object-cover ring-4 ring-white shadow-sm" />
            ) : (
                <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <span className="text-3xl">🐾</span>
                </div>
            )}
            <div>
              <p className="text-xl font-black text-slate-900 tracking-tight">{patient?.name}</p>
              <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
                {patient?.species?.name} • {patient?.breed?.name || 'Unknown'}
              </p>
              <div className="flex gap-3 mt-2">
                  {patient?.weight && (
                      <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-100 text-slate-500">
                          {patient.weight} KG
                      </span>
                  )}
                  {patient?.sex && (
                      <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-100 text-slate-500">
                          {patient.sex}
                      </span>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-12">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <th className="pb-5 pl-2">Description of Services & Products</th>
              <th className="pb-5 text-center w-24">Quantity</th>
              <th className="pb-5 text-right w-36">Unit Price</th>
              <th className="pb-5 text-right w-36 pr-2">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {billableItems.length > 0 ? billableItems.map((item, idx) => (
              <tr key={idx} className="group">
                <td className="py-6 pl-2 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-slate-900 text-sm tracking-tight">{item.name}</p>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                        item.item_type === 'inventory' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                        {item.item_type === 'inventory' ? 'PROD' : 'SERV'}
                    </span>
                  </div>
                  {item.notes && <p className="text-[11px] text-slate-400 mt-1 italic font-medium leading-relaxed">{item.notes}</p>}
                </td>
                <td className="py-6 text-center text-sm font-bold text-slate-600">{item.qty}</td>
                <td className="py-6 text-right text-sm font-medium text-slate-500">{currency(item.unitPrice || item.unit_price)}</td>
                <td className="py-6 text-right font-black text-slate-900 text-sm pr-2">{currency(item.amount)}</td>
              </tr>
            )) : (
                <tr>
                    <td colSpan="4" className="py-12 text-center text-sm text-slate-300 italic font-medium">No billable items found.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="mt-12 flex justify-end">
        <div className="w-80 space-y-4">
          <div className="space-y-2.5 px-2">
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Subtotal</span>
              <span className="text-slate-700">{currency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>VAT (12.0%)</span>
              <span className="text-slate-700">{currency(taxAmount)}</span>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black uppercase tracking-[0.2em] opacity-60">Total Amount</span>
              <span className="text-2xl font-black">{currency(totalDue)}</span>
            </div>
          </div>
          
          {amountPaid > 0 && (
            <div className="space-y-3 pt-2">
                <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex justify-between items-center text-emerald-700">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Paid Amount</span>
                    <span className="text-[10px] font-bold opacity-80">{paymentMethod || 'Record Payment'}</span>
                  </div>
                  <div className="text-base font-black">{currency(amountPaid)}</div>
                </div>
                
                {amountPaid > totalDue ? (
                  <div className="flex justify-between items-center px-4 py-1">
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Change</span>
                    <span className="text-lg font-black text-emerald-600">{currency(amountPaid - totalDue)}</span>
                  </div>
                ) : totalDue - amountPaid > 0 ? (
                  <div className="flex justify-between items-center px-4 py-1">
                    <span className="text-xs font-black uppercase tracking-widest text-rose-500">Balance Due</span>
                    <span className="text-lg font-black text-rose-600">{currency(totalDue - amountPaid)}</span>
                  </div>
                ) : totalDue === amountPaid && totalDue > 0 ? (
                  <div className="flex justify-end px-4 py-1">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-lg">Fully Paid</span>
                  </div>
                ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Footer / Legal */}
      <div className="mt-auto pt-20">
        {notes && (
          <div className="mb-12 bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Terms & Conditions / Notes</h4>
            <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap font-medium">{notes}</p>
          </div>
        )}
        
        <div className="flex justify-between items-end border-t border-slate-100 pt-10">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-900 font-black uppercase tracking-[0.3em]">AutoVet Pro</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Clinic Management Software</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold italic mb-1">Generated electronically.</p>
            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tighter">Secure Document ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableInvoice;
