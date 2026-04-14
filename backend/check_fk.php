<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$fks = Illuminate\Support\Facades\DB::select("
    SELECT 
        CONSTRAINT_NAME, 
        DELETE_RULE 
    FROM information_schema.REFERENTIAL_CONSTRAINTS 
    WHERE TABLE_NAME = 'pets' 
    AND CONSTRAINT_SCHEMA = DATABASE()
");

print_r($fks);
