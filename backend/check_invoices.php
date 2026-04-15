<?php
$keys = DB::select("SHOW CREATE TABLE invoices");
echo $keys[0]->{'Create Table'};
