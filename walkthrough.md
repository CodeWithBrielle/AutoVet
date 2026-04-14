# AutoVet — Capstone Defense Walkthrough

**System:** AutoVet Veterinary Clinic Management System  
**Stack:** Laravel 11 (API) + React 18 + Vite (Frontend)  
**Defense Flow:** 8-Step End-to-End Demonstration

---

## Pre-Demo Checklist

Before presenting, confirm the following:

- [ ] Backend is running (`php artisan serve` → `http://localhost:8000`)
- [ ] Frontend is running (`npm run dev` → `http://localhost:5173`)
- [ ] Database has at least 1–2 months of seeded invoice history (for AI forecast to render)
- [ ] At least one inventory item has a low stock threshold set (for deduction demo)
- [ ] Logged in as **Admin** role for full module access

---

## Step 1 — Dashboard Setup & Overview

**What to show:**
- Navigate to the **Dashboard** page.
- Point out the **metric cards**: Total Pets, Today's Appointments, Monthly Revenue, Pending Invoices.
- Highlight the **AI Sales Forecast card** (emerald line chart) showing actual vs. projected revenue.
- Highlight the **Inventory Consumption card** (blue line chart) showing usage trends.
- Highlight the **Appointment Intelligence** and **Recent Notifications** panels.

**Talking point:**
> "The dashboard gives the clinic admin a real-time operational snapshot — revenue trends, inventory health, and upcoming appointments — all in one view without opening separate modules."

---

## Step 2 — Registering a Client & Pet

**What to show:**
- Navigate to the **Patients** page.
- Click **Add Patient**.
- Fill in the **Owner** details: name, contact number, email, address.
- Fill in the **Pet** details: name, species (e.g. Dog), breed, date of birth, sex, weight.
- Submit and confirm the new patient card appears in the list.

**Talking point:**
> "Client and pet registration are linked in a single form — the system creates the owner record and the pet record together, so there's no risk of orphaned data."

---

## Step 3 — Booking an Appointment

**What to show:**
- Navigate to the **Appointments** page.
- Click **New Appointment**.
- Select the pet registered in Step 2 as the subject.
- Choose a service (e.g. General Consultation), assign a veterinarian, and pick a date/time.
- Submit. The appointment should appear in the list with status **Pending**.

**Talking point:**
> "Appointments are tied directly to pet and owner records. The status starts as Pending, which prevents any consultation or billing from proceeding until a vet explicitly approves it."

---

## Step 4 — Approving the Appointment

**What to show:**
- Locate the appointment created in Step 3.
- Click **Approve** (or change status to Confirmed/In Progress depending on your flow).
- Show the status badge update in the list.

**Talking point:**
> "The approval gate ensures the clinic controls workflow. Only approved appointments can proceed to a medical record or invoice — this prevents accidental billing on cancelled visits."

---

## Step 5 — Inputting Medical Consultation Records

**What to show:**
- From the approved appointment, open the patient's profile or navigate to the **Medical Records** module.
- Create a new record: chief complaint, diagnosis, treatment notes, prescribed medications.
- If applicable, attach an inventory item (medicine/supply) used during the consultation.
- Save the record.

**Talking point:**
> "Medical records are stored per visit, per pet — providing a full clinical history. Any inventory item recorded here triggers a deduction when the invoice is finalized."

---

## Step 6 — Generating the Invoice

**What to show:**
- Navigate to the **Invoices** module (or generate directly from the appointment/record).
- Create a new invoice linked to the patient from Step 2.
- Add the service rendered (e.g. General Consultation fee) and any medicines/supplies used.
- Review the line items, subtotal, VAT (12%), and total.
- Click **Finalize Invoice**. Status changes from Draft to Finalized/Paid.

**Talking point:**
> "Invoices are generated from actual services and supplies recorded during the consultation. Finalization is a deliberate action — it locks the record and triggers both inventory deduction and revenue recording simultaneously."

---

## Step 7 — Displaying Automatic Inventory Deduction

**What to show:**
- Navigate to **Inventory**.
- Search for or locate the item that was included in the invoice (e.g. the medicine from Step 5/6).
- Show the current stock quantity — it should have decreased by the amount billed.
- Optionally open the item's transaction log / movement history to show the deduction entry.

**Talking point:**
> "AutoVet automates inventory deduction at the point of invoice finalization — no manual stock adjustment needed. This prevents over-dispensing and keeps stock counts accurate in real time."

---

## Step 8 — Reviewing Revenue and AI Forecasting Impacts

**What to show:**
- Navigate to **Reports → Sales tab**.
- Show the **Revenue Stream** chart — the finalized invoice from Step 6 should appear in the daily totals.
- Point out that **Revenue (Last 30 Days)** metric card reflects the updated total.
- Navigate back to the **Dashboard**.
- Show the **Monthly Revenue** metric card — confirm it matches the Current Month Revenue on the Sales Report.
- Point to the **AI Sales Forecast card** — explain the emerald line (actual) vs. dashed line (AI projection).
- If inventory consumption data is sufficient, show the **Inventory Consumption chart** and explain the AI reorder suggestions.

**Talking point:**
> "Every finalized invoice feeds directly into the revenue analytics and AI forecasting engine. The system builds a projection model from historical sales patterns — giving the clinic owner forward-looking insight, not just a rearview mirror."

---

## Expected Revenue Consistency Check

| Location | Field | Should Match |
|---|---|---|
| Dashboard | Monthly Revenue metric card | ✓ |
| Reports → Sales | Revenue (Last 30 Days) metric card | ✓ |
| Reports → Sales | Revenue Stream chart total | ✓ |

> If these three values do not match, the most likely cause is a timezone mismatch in the `created_at` filter on the backend revenue query. Verify the server timezone in `config/app.php` matches the clinic's local timezone.

---

## Common Panel Questions & Suggested Answers

**Q: What happens if the internet goes down mid-consultation?**  
A: The frontend falls back to locally cached data for pet images and static assets. API-dependent features (live search, invoice generation) require connectivity, which is standard for any web-based clinic system.

**Q: How does the AI forecasting work?**  
A: The system uses time-series revenue data from finalized invoices. When sufficient history (2+ months) exists, it computes a weighted moving average projection and uses Claude AI to generate a plain-language interpretation and actionable recommendations. If data is insufficient, it displays "Insufficient historical data" rather than a misleading projection.

**Q: Is patient data secure?**  
A: All API routes are protected by Laravel Sanctum token authentication. Role-based access control (Admin vs. Staff) restricts sensitive operations like revenue viewing and invoice finalization.

**Q: What if a wrong medicine quantity is invoiced?**  
A: Invoices in Draft state can be edited freely. Once Finalized, the record is locked to maintain audit integrity — consistent with standard clinic billing practice.

---

*Document prepared for AutoVet Capstone Defense — Phase 8*
