<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$categories = DB::table('mdm_inventory_categories')->pluck('name', 'id');
$items = DB::table('inventories')->get();

$output = "AUTOVET FULL INVENTORY EXTRACTION - " . date('Y-m-d H:i:s') . "\n";
$output .= str_repeat("=", 80) . "\n\n";

if ($items->isEmpty()) {
    $output .= "NO INVENTORY RECORDS FOUND.\n";
} else {
    foreach ($items as $item) {
        $output .= "ID: {$item->id}\n";
        $output .= "ITEM NAME: {$item->item_name}\n";
        $output .= "CATEGORY: " . ($categories[$item->inventory_category_id] ?? 'Unknown') . "\n";
        $output .= "SKU: " . ($item->sku ?: 'N/A') . "\n";
        $output .= "SUB DETAILS: " . ($item->sub_details ?: 'N/A') . "\n";
        $output .= "STOCK LEVEL: {$item->stock_level}\n";
        $output .= "ALERT LEVEL: {$item->min_stock_level}\n";
        $output .= "STATUS: {$item->status}\n";
        $output .= "COST PRICE: ₱" . number_format($item->cost_price, 2) . "\n";
        $output .= "SELLING PRICE: ₱" . number_format($item->selling_price, 2) . "\n";
        $output .= "SERVICE PRICE: ₱" . number_format($item->service_price, 2) . "\n";
        $output .= "SUPPLIER: " . ($item->supplier ?: 'Other') . "\n";
        $output .= "EXPIRATION: " . ($item->expiration_date ?: 'N/A') . "\n";
        $output .= "SELLABLE: " . ($item->is_sellable ? 'YES' : 'NO') . "\n";
        $output .= "SERVICE USABLE: " . ($item->is_service_usable ? 'YES' : 'NO') . "\n";
        $output .= "ARCHIVED: " . ($item->deleted_at ? "[DELETED AT {$item->deleted_at}]" : 'NO') . "\n";
        $output .= "CREATED: {$item->created_at}\n";
        $output .= "UPDATED: {$item->updated_at}\n";
        $output .= str_repeat("-", 40) . "\n\n";
    }
}

file_put_contents(__DIR__ . '/inventory_extraction.txt', $output);
echo "Extraction complete. Saved to backend/inventory_extraction.txt\n";
