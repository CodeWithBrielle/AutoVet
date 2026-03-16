<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Inventory;
use App\Models\InventoryTransaction;
use App\Events\LowStockDetected;
use Illuminate\Support\Facades\DB;
use Exception;

class InvoiceFinalizationService
{
    /**
     * Finalize an invoice and deduct inventory stock.
     *
     * @param Invoice $invoice
     * @return void
     * @throws Exception
     */
    public function finalizeInvoice(Invoice $invoice): void
    {
        DB::transaction(function () use ($invoice) {
            // Skip if already deducted
            if ($invoice->stock_deducted) {
                return;
            }

            // Only deduct on these statuses
            if (!in_array($invoice->status, ['Finalized', 'Paid', 'Partially Paid'])) {
                return;
            }

            foreach ($invoice->items as $item) {
                if (!$item->inventory_id) continue;

                // Pessimistic lock prevents race conditions in concurrent requests
                $inventoryItem = Inventory::where('id', $item->inventory_id)
                    ->lockForUpdate()
                    ->first();

                if (!$inventoryItem) {
                    throw new Exception("Inventory item not found for ID: {$item->inventory_id}");
                }

                if ($inventoryItem->stock_level < $item->qty) {
                    throw new Exception("Insufficient stock for '{$inventoryItem->item_name}'. Needed: {$item->qty}, Available: {$inventoryItem->stock_level}");
                }

                $previousStock = $inventoryItem->stock_level;

                // Deduct stock
                $inventoryItem->stock_level -= $item->qty;
                $inventoryItem->save();

                // Log to audit trail
                InventoryTransaction::create([
                    'inventory_id'   => $inventoryItem->id,
                    'user_id'        => auth()->id(),
                    'transaction_type' => 'Deduction',
                    'quantity'       => $item->qty,
                    'previous_stock' => $previousStock,
                    'new_stock'      => $inventoryItem->stock_level,
                    'reference_type' => Invoice::class,
                    'reference_id'   => $invoice->id,
                    'notes'          => "Deducted via Invoice #{$invoice->invoice_number}",
                ]);

                // Trigger low stock alert if needed
                if ($inventoryItem->stock_level <= $inventoryItem->min_stock_level) {
                    event(new LowStockDetected($inventoryItem));
                }
            }

            $invoice->stock_deducted = true;
            $invoice->save();
        });
    }
}
