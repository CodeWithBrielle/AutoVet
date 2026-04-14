<?php

/**
 * AutoVet Inventory Text Report Generator
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Inventory;
use App\Models\InventoryCategory;
use Carbon\Carbon;

$items = Inventory::withTrashed()
    ->with(['inventoryCategory', 'transactions.creator:id,name', 'deleter:id,name'])
    ->get();

$report = "AUTOVET SYSTEM - FULL INVENTORY EXTRACT\n";
$report .= "Date Generated: " . now()->toDateTimeString() . "\n";
$report .= "================================================================================\n\n";

// Summary Section
$total = $items->count();
$active = $items->where('deleted_at', null)->count();
$archived = $items->where('deleted_at', '!==', null)->count();
$outOfStock = $items->where('stock_level', '<=', 0)->where('deleted_at', null)->count();

$report .= "SUMMARY\n";
$report .= "-------\n";
$report .= "Total Items: $total\n";
$report .= "Active Items: $active\n";
$report .= "Archived Items: $archived\n";
$report .= "Out of Stock: $outOfStock\n\n";

$report .= "DETAILED RECORDS\n";
$report .= "----------------\n\n";

foreach ($items as $item) {
    $archivedStatus = $item->deleted_at ? "[ARCHIVED on " . $item->deleted_at->toDateTimeString() . " by " . ($item->deleter->name ?? 'System') . "]" : "[ACTIVE]";
    $report .= "ID: {$item->id} | Name: {$item->item_name} $archivedStatus\n";
    $report .= "SKU: {$item->sku} | Category: " . ($item->inventoryCategory->name ?? 'N/A') . "\n";
    $report .= "Stock: {$item->stock_level} | Min Stock: {$item->min_stock_level}\n";
    $report .= "Cost: " . ($item->cost_price ?? '0.00') . " | Selling Price: " . ($item->selling_price ?? '0.00') . "\n";
    $report .= "Supplier: " . ($item->supplier ?? 'N/A') . " | Status: {$item->status}\n";
    $report .= "Expiry: " . ($item->expiration_date ? $item->expiration_date->toDateString() : 'None') . "\n";
    
    $types = [];
    if ($item->is_sellable) $types[] = "Sellable";
    if ($item->is_service_usable) $types[] = "Service Usable";
    if ($item->deduct_on_finalize) $types[] = "Auto-Deduct";
    $report .= "Usage: " . implode(', ', $types) . "\n";
    
    // Transactions
    $txs = $item->transactions->sortByDesc('created_at')->take(3);
    if ($txs->count() > 0) {
        $report .= "Recent Activity:\n";
        foreach ($txs as $tx) {
            $report .= "  - {$tx->created_at->toDateString()}: {$tx->transaction_type} ({$tx->quantity}) -> New Stock: {$tx->new_stock} | {$tx->remarks}\n";
        }
    }
    
    $report .= "--------------------------------------------------------------------------------\n";
}

file_put_contents(__DIR__ . '/inventory_report.txt', $report);

echo "Text report generated: inventory_report.txt\n";
