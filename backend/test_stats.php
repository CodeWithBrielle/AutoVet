<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$req = Illuminate\Http\Request::capture();
$stats = app(App\Http\Controllers\DashboardController::class)->getStats()->getData();
$revenue = app(App\Http\Controllers\SalesReportController::class)->getRevenueSummary($req)->getData();

echo "Dashboard Metrics:\n";
echo json_encode($stats, JSON_PRETTY_PRINT);
echo "\n\nSales Report:\n";
echo json_encode($revenue, JSON_PRETTY_PRINT);
