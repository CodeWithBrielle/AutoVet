<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\InventoryBatch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryBatchController extends Controller
{
    /**
     * List all batches for a given inventory item (FIFO order - soonest expiry first)
     */
    public function index(Inventory $inventory)
    {
        $batches = $inventory->batches()
            ->orderBy('expiration_date', 'asc')
            ->get()
            ->each(fn ($b) => $b->checkAndMarkExpired());

        return response()->json($batches);
    }

    /**
     * Receive a new batch into stock
     */
    public function store(Request $request, Inventory $inventory)
    {
        $validated = $request->validate([
            'batch_number'    => 'required|string|unique:inventory_batches,batch_number',
            'quantity'        => 'required|integer|min:1',
            'expiration_date' => 'required|date|after:today',
            'received_date'   => 'required|date',
            'supplier'        => 'nullable|string|max:255',
        ]);

        DB::transaction(function () use ($validated, $inventory, &$batch) {
            $batch = $inventory->batches()->create($validated);

            // Update the master stock level on the parent inventory item
            $inventory->increment('stock_level', $validated['quantity']);
        });

        return response()->json($batch, 201);
    }

    /**
     * Expire batches past their date (can be called by a scheduled command)
     */
    public function expireOld()
    {
        $expired = InventoryBatch::where('status', 'Active')
            ->where('expiration_date', '<', now()->toDateString())
            ->get();

        foreach ($expired as $batch) {
            // Deduct from master stock
            $batch->inventory->decrement('stock_level', $batch->quantity);
            $batch->update(['status' => 'Expired']);
        }

        return response()->json([
            'message' => "Marked {$expired->count()} batch(es) as expired.",
            'expired_batches' => $expired->pluck('batch_number'),
        ]);
    }

    /**
     * Expiring Soon - for dashboard alerts (within 30 days)
     */
    public function expiringSoon()
    {
        $soon = InventoryBatch::with('inventory')
            ->where('status', 'Active')
            ->where('expiration_date', '<=', now()->addDays(30)->toDateString())
            ->where('expiration_date', '>=', now()->toDateString())
            ->orderBy('expiration_date', 'asc')
            ->get();

        return response()->json($soon);
    }
}
