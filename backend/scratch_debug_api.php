<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle(
    Illuminate\Http\Request::create('/api/services', 'GET')
);
$data = json_decode($response->getContent(), true);
$services = array_filter($data, function($s) { return $s['pricing_type'] === 'weight_based'; });
print_r($services);
