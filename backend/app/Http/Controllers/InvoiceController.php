<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Services\InvoiceFinalizationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Traits\StandardizesResponses;
use App\Traits\ValidatesContext;

class InvoiceController extends Controller
{
    use StandardizesResponses, ValidatesContext;
    protected $pricingService;
    protected $finalizationService;
    protected $clientNotificationService;

    public function __construct(
        \App\Services\PricingService $pricingService,
        \App\Services\InvoiceFinalizationService $finalizationService,
        \App\Services\ClientNotificationService $clientNotificationService
    ) {
        $this->pricingService = $pricingService;
        $this->finalizationService = $finalizationService;
        $this->clientNotificationService = $clientNotificationService;
        $this->authorizeResource(Invoice::class, 'invoice');
    }

    /**
     * Resolve billing breakdown for a specific service and pet.
     */
    public function resolveBreakdown(Request $request)
    {
        $validated = $request->validate([
            'service_id' => 'required|exists:services,id',
            'pet_id' => 'nullable|exists:pets,id',
            'qty' => 'required|numeric|min:1',
            'weight' => 'nullable|numeric|min:0',
        ]);

        $service = \App\Models\Service::findOrFail($validated['service_id']);
        $pet = $validated['pet_id'] ? \App\Models\Pet::find($validated['pet_id']) : null;

        try {
            $breakdown = $this->pricingService->generateBillingBreakdown(
                $service, 
                $pet, 
                (float) $validated['qty'], 
                $validated['weight'] ? (float) $validated['weight'] : null
            );
            return response()->json($breakdown);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * Display a listing of invoices.
     */
    public function index()
    {
        $user = auth()->user();
        $query = Invoice::with(['pet.species', 'pet.breed', 'items'])->orderBy('created_at', 'desc');

        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            $query->whereHas('pet', function ($q) use ($user) {
                $q->where('owner_id', $user->owner?->id);
            });
        }

        return $this->successResponse($query->get());
    }

    /**
     * Store a newly created invoice.
     */
    public function store(Request $request)
    {
        $this->authorize('create', Invoice::class);

        $validated = $request->validate([
            'pet_id' => 'required|exists:pets,id',
            'owner_id' => 'required|exists:owners,id',
            'appointment_id' => 'required|exists:appointments,id',
            'pet_weight' => 'nullable|numeric|min:0.01',
            'status' => 'required|in:Draft,Finalized,Paid,Partially Paid,Cancelled',
            'subtotal' => 'required|numeric|min:0',
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|numeric|min:0',
            'tax_rate' => 'required|numeric|min:0',
            'total' => 'required|numeric|min:0',
            'amount_paid' => 'required|numeric|min:0',
            'payment_method' => 'nullable|string',
            'notes_to_client' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.item_type' => 'required|in:service,inventory',
            'items.*.line_type' => 'nullable|in:service,item,adjustment',
            'items.*.name' => 'required|string',
            'items.*.notes' => 'nullable|string',
            'items.*.qty' => 'required|numeric|min:0.01',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.amount' => 'required|numeric|min:0',
            'items.*.service_id' => 'nullable|exists:services,id',
            'items.*.inventory_id' => 'nullable|exists:inventories,id',
            'items.*.is_hidden' => 'sometimes|boolean',
            'items.*.billing_behavior' => 'required|string|in:included,separately_billable,internal_only',
            'items.*.source_type' => 'required|string|in:appointment_template,manual,custom',
            'items.*.is_confirmed_used' => 'sometimes|boolean',
            'items.*.is_removed_from_template' => 'sometimes|boolean',
            'items.*.was_price_overridden' => 'sometimes|boolean',
            'items.*.was_quantity_overridden' => 'sometimes|boolean',
            'items.*.unit_price_snapshot' => 'nullable|numeric',
            'items.*.line_total_snapshot' => 'nullable|numeric',
            'items.*.metadata_snapshot' => 'nullable|array',
            'items.*.client_id' => 'nullable|string',
            'items.*.parent_invoice_id' => 'nullable|string',
        ]);

        if ($validated['discount_value'] > $validated['subtotal'] && $validated['discount_type'] === 'fixed') {
             throw ValidationException::withMessages(['discount_value' => 'Discount cannot exceed subtotal.']);
        }
        
        if ($validated['status'] === 'Finalized' && $validated['subtotal'] <= 0) {
            throw ValidationException::withMessages(['subtotal' => 'Cannot finalize an invoice with 0 subtotal.']);
        }

        // Hierarchy Enforcement: Ensure Pet-Appointment-Owner chain is intact
        if (!$this->isPetOwnedBy($validated['pet_id'], $validated['owner_id'])) {
            return $this->errorResponse(
                'HIERARCHY_MISMATCH',
                'relationship',
                'The selected pet does not belong to the selected owner.',
                ['owner_id' => ['Validation mismatch: Pet/Owner linking is incorrect.']],
                422
            );
        }

        if (!empty($validated['appointment_id'])) {
            if (!$this->isAppointmentForPet($validated['appointment_id'], $validated['pet_id'])) {
                return $this->errorResponse(
                    'HIERARCHY_MISMATCH',
                    'relationship',
                    'This appointment belongs to a different pet.',
                    ['appointment_id' => ['Validation failed: Appointment/Pet linking mismatch.']],
                    422
                );
            }
            
            // Appointment-Owner check is implicit if isPetOwnedBy and isAppointmentForPet are true
        }

        DB::beginTransaction();

        try {
            $monthYear = now()->format('Y-m');
            $latestInvoice = Invoice::where('invoice_number', 'like', "VB-{$monthYear}-%")->latest('id')->first();
            $nextNumber = $latestInvoice ? intval(substr($latestInvoice->invoice_number, -4)) + 1 : 1;
            $invoiceNumber = "VB-{$monthYear}-" . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);

            $pet = \App\Models\Pet::findOrFail($validated['pet_id']);
            
            // Update pet weight if provided
            if (isset($validated['pet_weight'])) {
                $pet->update(['weight' => $validated['pet_weight']]);
            }

            $calculatedSubtotal = 0;
            $itemsToCreate = [];

            foreach ($validated['items'] as $itemData) {
                // Determine source-of-truth unit price and capture snapshot
                if ($itemData['item_type'] === 'service') {
                    $service = \App\Models\Service::find($itemData['service_id']);
                    if ($service && $service->pricing_mode !== 'manual') {
                        try {
                            $itemData['unit_price'] = $this->pricingService->calculatePrice($service, $pet, 1, null, $validated['pet_weight'] ?? null);
                        } catch (\Exception $e) {
                             throw ValidationException::withMessages(['items' => $e->getMessage()]);
                        }
                    }
                    $itemData['line_type'] = 'service';
                    $itemData['reference_type'] = \App\Models\Service::class;
                    $itemData['reference_id'] = $itemData['service_id'];
                } else if ($itemData['item_type'] === 'inventory') {
                    $inventory = \App\Models\Inventory::find($itemData['inventory_id']);
                    if ($inventory) {
                        $itemData['unit_price'] = (float) $inventory->selling_price;
                    }
                    $itemData['line_type'] = 'item';
                    $itemData['reference_type'] = \App\Models\Inventory::class;
                    $itemData['reference_id'] = $itemData['inventory_id'];
                }

                $isHidden = $itemData['is_hidden'] ?? false;
                $billingBehavior = $itemData['billing_behavior'] ?? 'separately_billable';
                
                // Enforce 0 amount for internal_only and included items
                if ($billingBehavior !== 'separately_billable' || $isHidden) {
                    $itemAmount = 0;
                } else {
                    $itemAmount = round($itemData['unit_price'] * $itemData['qty'], 2);
                }

                $itemData['unit_price_snapshot'] = $itemData['unit_price'];
                $itemData['line_total_snapshot'] = $itemAmount;

                $isConfirmedUsed = $itemData['is_confirmed_used'] ?? true;
                $isRemoved = $itemData['is_removed_from_template'] ?? false;

                if ($isConfirmedUsed && !$isRemoved) {
                    $calculatedSubtotal += $itemAmount;
                }
                
                $itemsToCreate[] = $itemData;
            }

            // Recalculate total based on backend rules
            $discount = ($validated['discount_type'] === 'percentage') 
                ? $calculatedSubtotal * ($validated['discount_value'] / 100) 
                : $validated['discount_value'];
            
            $taxable = $calculatedSubtotal - $discount;
            // Enforce fixed 12% VAT
            $validated['tax_rate'] = 12.00;
            $tax = round($taxable * 0.12, 2); 
            $calculatedTotal = round($taxable + $tax, 2);

            $invoice = Invoice::create([
                'invoice_number' => $invoiceNumber,
                'pet_id' => $validated['pet_id'],
                'appointment_id' => $validated['appointment_id'],
                'status' => $validated['status'],
                'subtotal' => $calculatedSubtotal,
                'discount_type' => $validated['discount_type'],
                'discount_value' => $validated['discount_value'],
                'tax_rate' => $validated['tax_rate'],
                'total' => $calculatedTotal,
                'amount_paid' => $validated['amount_paid'],
                'payment_method' => $validated['payment_method'],
                'notes_to_client' => $validated['notes_to_client'],
            ]);

            $clientIdToDbId = [];

            // 1. Save top-level items (no parent_invoice_id)
            $topLevelItems = array_filter($itemsToCreate, fn($i) => empty($i['parent_invoice_id']));
            foreach ($topLevelItems as $itemData) {
                $client_id = $itemData['client_id'] ?? null;
                unset($itemData['client_id']); unset($itemData['parent_invoice_id']);
                $model = $invoice->items()->create($itemData);
                if ($client_id) {
                    $clientIdToDbId[$client_id] = $model->id;
                }
            }

            // 2. Save child items
            $childItems = array_filter($itemsToCreate, fn($i) => !empty($i['parent_invoice_id']));
            foreach ($childItems as $itemData) {
                $client_id = $itemData['client_id'] ?? null;
                $parent_client_id = $itemData['parent_invoice_id'];
                
                unset($itemData['client_id']); unset($itemData['parent_invoice_id']);
                
                if (isset($clientIdToDbId[$parent_client_id])) {
                    $itemData['parent_id'] = $clientIdToDbId[$parent_client_id];
                }
                
                $model = $invoice->items()->create($itemData);
                if ($client_id) {
                    $clientIdToDbId[$client_id] = $model->id;
                }
            }

            $invoice->load('items');
            $this->finalizationService->finalizeInvoice($invoice);

            if ($invoice->status === 'Finalized') {
                try {
                    $owner = $invoice->pet->owner;
                    if ($owner) {
                        $this->clientNotificationService->sendFromTemplate(
                            $owner,
                            'invoice_ready',
                            'email',
                            [
                                'invoice_number' => $invoice->invoice_number,
                                'total' => number_format($invoice->total, 2),
                                'pet_name' => $invoice->pet->name ?? '',
                            ],
                            'automated',
                            $invoice
                        );
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to send automated invoice notification: " . $e->getMessage());
                }
            }

            DB::commit();

            return $this->successResponse($invoice->load(['pet.owner', 'appointment', 'items']), 'Invoice created successfully.', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            \Illuminate\Support\Facades\Log::error("Invoice creation failed: " . $e->getMessage(), [
                'stack' => $e->getTraceAsString(),
                'payload' => $request->all()
            ]);
            return $this->errorResponse('SAVE_FAILED', 'billing', 'Failed to create invoice.', [$e->getMessage()], 500);
        }
    }

    /**
     * Display the specified invoice.
     */
    public function show(Invoice $invoice)
    {
        return response()->json($invoice->load('pet', 'items'));
    }

    /**
     * Update the specified invoice in storage.
     */
    public function update(Request $request, Invoice $invoice)
    {
        if (in_array($invoice->status, ['Paid', 'Cancelled'])) {
             return response()->json(['message' => 'Cannot modify a Paid or Cancelled invoice.'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|in:Draft,Finalized,Paid,Partially Paid,Cancelled',
            'pet_weight' => 'nullable|numeric|min:0.01',
            'owner_id' => 'nullable|exists:owners,id',
            'appointment_id' => 'nullable|exists:appointments,id',
            'subtotal' => 'required|numeric|min:0',
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|numeric|min:0',
            'tax_rate' => 'required|numeric|min:0',
            'total' => 'required|numeric|min:0',
            'amount_paid' => 'required|numeric|min:0',
            'payment_method' => 'nullable|string',
            'notes_to_client' => 'nullable|string',
            'items' => 'sometimes|array',
            'items.*.id' => 'nullable|exists:invoice_items,id',
            'items.*.item_type' => 'required_with:items|in:service,inventory',
            'items.*.name' => 'required_with:items|string',
            'items.*.notes' => 'nullable|string',
            'items.*.qty' => 'required_with:items|integer|min:1',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
            'items.*.amount' => 'required_with:items|numeric|min:0',
            'items.*.service_id' => 'nullable|exists:services,id',
            'items.*.inventory_id' => 'nullable|exists:inventories,id',
            'items.*.is_hidden' => 'sometimes|boolean',
            'items.*.billing_behavior' => 'required_with:items|string|in:included,separately_billable,internal_only',
            'items.*.source_type' => 'required_with:items|string|in:appointment_template,manual,custom',
            'items.*.is_confirmed_used' => 'sometimes|boolean',
            'items.*.is_removed_from_template' => 'sometimes|boolean',
            'items.*.was_price_overridden' => 'sometimes|boolean',
            'items.*.was_quantity_overridden' => 'sometimes|boolean',
            'items.*.client_id' => 'nullable|string',
            'items.*.parent_invoice_id' => 'nullable|string',
        ]);

        if (!empty($validated['owner_id'])) {
            if (!$this->isPetOwnedBy($invoice->pet_id, $validated['owner_id'])) {
                return $this->errorResponse(
                    'HIERARCHY_MISMATCH',
                    'relationship',
                    'The invoice pet does not belong to the provided owner.',
                    ['owner_id' => ['Validation mismatch: Pet/Owner linking is incorrect.']],
                    422
                );
            }
        }

        if (!empty($validated['appointment_id'])) {
            if (!$this->isAppointmentForPet($validated['appointment_id'], $invoice->pet_id)) {
                return $this->errorResponse(
                    'HIERARCHY_MISMATCH',
                    'relationship',
                    'This appointment belongs to a different pet context.',
                    ['appointment_id' => ['Validation failed: Appointment/Pet linking mismatch.']],
                    422
                );
            }
        }

        // 1. Finalization & Cancellation Guard
        if ($invoice->status === 'Finalized' || $invoice->status === 'Paid' || $invoice->status === 'Partially Paid') {
            // If changing to Cancelled, we proceed but trigger reversal
            if ($validated['status'] === 'Cancelled') {
                // Keep moving to transaction block
            } else {
                // If already finalized, only allow status updates to Paid/Partially Paid and metadata updates. 
                // NO ITEM EDITS ALLOWED.
                $invoice->update([
                    'amount_paid' => $validated['amount_paid'],
                    'payment_method' => $validated['payment_method'] ?? $invoice->payment_method,
                    'status' => $validated['status'],
                    'notes_to_client' => $validated['notes_to_client'] ?? $invoice->notes_to_client,
                ]);
                return response()->json($invoice->load('pet', 'items'));
            }
        }

        DB::beginTransaction();

        try {
            $pet = $invoice->pet;
            $calculatedSubtotal = 0;
            $itemsToUpdate = [];

            if (isset($validated['pet_weight'])) {
                $pet->update(['weight' => $validated['pet_weight']]);
            }

            if (isset($validated['items'])) {
                foreach ($validated['items'] as $itemData) {
                    if ($itemData['item_type'] === 'service') {
                        $service = \App\Models\Service::find($itemData['service_id']);
                        if ($service && $service->pricing_mode !== 'manual') {
                            try {
                                $itemData['unit_price'] = $this->pricingService->calculatePrice($service, $pet, 1, null, $validated['pet_weight'] ?? null);
                            } catch (\Exception $e) {
                                 throw ValidationException::withMessages(['items' => $e->getMessage()]);
                            }
                        }
                        $itemData['line_type'] = 'service';
                        $itemData['reference_type'] = \App\Models\Service::class;
                        $itemData['reference_id'] = $itemData['service_id'];
                    } else if ($itemData['item_type'] === 'inventory') {
                        $inventory = \App\Models\Inventory::find($itemData['inventory_id']);
                        if ($inventory) {
                            $itemData['unit_price'] = (float) $inventory->selling_price;
                        }
                        $itemData['line_type'] = 'item';
                        $itemData['reference_type'] = \App\Models\Inventory::class;
                        $itemData['reference_id'] = $itemData['inventory_id'];
                    }

                    $isHidden = $itemData['is_hidden'] ?? false;
                    $billingBehavior = $itemData['billing_behavior'] ?? 'separately_billable';
                    
                    // Enforce 0 amount for internal_only and included items
                    if ($billingBehavior !== 'separately_billable' || $isHidden) {
                        $itemAmount = 0;
                    } else {
                        $itemAmount = round($itemData['unit_price'] * $itemData['qty'], 2);
                    }

                    $itemData['unit_price_snapshot'] = $itemData['unit_price'];
                    $itemData['line_total_snapshot'] = $itemAmount;

                    $isConfirmedUsed = $itemData['is_confirmed_used'] ?? true;
                    $isRemoved = $itemData['is_removed_from_template'] ?? false;

                    if ($isConfirmedUsed && !$isRemoved) {
                        $calculatedSubtotal += $itemAmount;
                    }
                    
                    $itemsToUpdate[] = $itemData;
                }
            } else {
                $calculatedSubtotal = $invoice->subtotal;
            }

            // Recalculate total based on backend rules
            $discount = ($validated['discount_type'] === 'percentage') 
                ? $calculatedSubtotal * ($validated['discount_value'] / 100) 
                : $validated['discount_value'];
            
            $taxable = $calculatedSubtotal - $discount;
            // Enforce fixed 12% VAT
            $validated['tax_rate'] = 12.00;
            $tax = $taxable * 0.12; 
            $calculatedTotal = $taxable + $tax;

            // Determine status logic based on amount paid vs total
            $status = $validated['status'];
            if ($status === 'Finalized' && $validated['amount_paid'] > 0) {
                if ($validated['amount_paid'] >= $calculatedTotal) {
                    $status = 'Paid';
                } else {
                    $status = 'Partially Paid';
                }
            }

            $invoice->update([
                'status' => $status,
                'appointment_id' => $validated['appointment_id'] ?? $invoice->appointment_id,
                'subtotal' => $calculatedSubtotal,
                'discount_type' => $validated['discount_type'],
                'discount_value' => $validated['discount_value'],
                'tax_rate' => $validated['tax_rate'],
                'total' => $calculatedTotal,
                'amount_paid' => $validated['amount_paid'],
                'payment_method' => $validated['payment_method'],
                'notes_to_client' => $validated['notes_to_client'],
            ]);

            if (isset($validated['items'])) {
                // Delete items not in the updated list
                $itemIds = collect($itemsToUpdate)->pluck('id')->filter()->toArray();
                $invoice->items()->whereNotIn('id', $itemIds)->delete();
                
                $clientIdToDbId = [];

                // Pass 1: Update existing items & create top-level new items
                foreach ($itemsToUpdate as &$itemData) {
                    $client_id = $itemData['client_id'] ?? null;
                    if (isset($itemData['id'])) {
                        $invoice->items()->where('id', $itemData['id'])->update(collect($itemData)->except(['id', 'client_id', 'parent_invoice_id'])->toArray());
                        if ($client_id) $clientIdToDbId[$client_id] = $itemData['id'];
                    } else if (empty($itemData['parent_invoice_id'])) {
                        $dbItem = $invoice->items()->create(collect($itemData)->except(['client_id', 'parent_invoice_id'])->toArray());
                        $itemData['id'] = $dbItem->id;
                        if ($client_id) $clientIdToDbId[$client_id] = $dbItem->id;
                    }
                }
                unset($itemData); // break reference

                // Pass 2: Create new child items
                foreach ($itemsToUpdate as $itemData) {
                    if (!isset($itemData['id']) && !empty($itemData['parent_invoice_id'])) {
                        $client_id = $itemData['client_id'] ?? null;
                        $parent_client_id = $itemData['parent_invoice_id'];
                        
                        $createData = collect($itemData)->except(['client_id', 'parent_invoice_id'])->toArray();
                        
                        if (isset($clientIdToDbId[$parent_client_id])) {
                            $createData['parent_id'] = $clientIdToDbId[$parent_client_id];
                        }
                        
                        $dbItem = $invoice->items()->create($createData);
                        if ($client_id) $clientIdToDbId[$client_id] = $dbItem->id;
                    }
                }
            }

            $invoice->load('items');
            
            // 3. Finalization / Reversal Trigger
            if ($invoice->status === 'Finalized' || $invoice->status === 'Paid') {
                $this->finalizationService->finalizeInvoice($invoice);
            } else if ($invoice->status === 'Cancelled') {
                $this->finalizationService->reverseStockDeduction($invoice);
            }

            // 4. Decoupled side effects: Notifications happen outside the transaction
            DB::commit();

            if ($invoice->wasChanged('status') && in_array($invoice->status, ['Finalized', 'Paid'])) {
                try {
                    $owner = $invoice->pet->owner;
                    if ($owner) {
                        $this->clientNotificationService->sendFromTemplate(
                            $owner,
                            'invoice_ready',
                            'email',
                            [
                                'invoice_number' => $invoice->invoice_number,
                                'total' => number_format($invoice->total, 2),
                                'pet_name' => $invoice->pet->name ?? '',
                            ],
                            'automated',
                            $invoice
                        );
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to send automated invoice notification: " . $e->getMessage());
                }
            }

            return $this->successResponse($invoice->load(['pet.owner', 'appointment', 'items']), 'Invoice updated.');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('UPDATE_FAILED', 'billing', 'Failed to update invoice.', [$e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified invoice.
     */
    public function destroy(Invoice $invoice)
    {
        return $this->errorResponse('RESTRICTED_DELETION', 'policy', 'Transactions cannot be deleted as per system integrity policy. Use Cancellation instead.', [], 403);
    }
}
