<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice - {{ $invoice->invoice_number }}</title>
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 14px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 20px; }
        .clinic-name { font-size: 24px; font-weight: bold; color: #10b981; margin: 0; }
        .clinic-details { font-size: 12px; color: #666; margin-top: 5px; }
        .invoice-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
        .details-container { width: 100%; margin-bottom: 30px; }
        .details-table { width: 100%; border-collapse: collapse; }
        .details-table td { padding: 5px 0; vertical-align: top; }
        .label { font-weight: bold; width: 120px; color: #555; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .items-table th { background-color: #f3f4f6; padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151; }
        .items-table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .totals-container { width: 50%; float: right; }
        .totals-table { width: 100%; border-collapse: collapse; }
        .totals-table td { padding: 8px 0; }
        .totals-table .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 10px; }
        .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .status-paid { background-color: #d1fae5; color: #065f46; }
        .status-draft { background-color: #f3f4f6; color: #374151; }
        .status-cancelled { background-color: #fee2e2; color: #991b1b; }
        .notes { margin-top: 50px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #10b981; font-size: 12px; clear: both; }
        .footer { position: absolute; bottom: 30px; width: 100%; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="clinic-name">AutoVet Clinic</h1>
        <div class="clinic-details">
            123 Pet Care Avenue, Animal City, AC 12345<br>
            Phone: (555) 123-4567 | Email: clinic@autovet.com
        </div>
    </div>

    <div class="invoice-title">Invoice</div>

    <table class="details-table details-container">
        <tr>
            <td style="width: 50%;">
                <table class="details-table">
                    <tr><td class="label">Invoice No:</td><td>{{ $invoice->invoice_number }}</td></tr>
                    <tr><td class="label">Date:</td><td>{{ $invoice->created_at->format('M d, Y') }}</td></tr>
                    <tr><td class="label">Status:</td>
                        <td>
                            @php
                                $statusClass = strtolower($invoice->status) == 'paid' ? 'status-paid' : (strtolower($invoice->status) == 'cancelled' ? 'status-cancelled' : 'status-draft');
                            @endphp
                            <span class="status-badge {{ $statusClass }}">{{ $invoice->status }}</span>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%;">
                <table class="details-table">
                    <tr><td class="label">Client Name:</td><td>{{ $invoice->patient->owner_name ?? 'N/A' }}</td></tr>
                    <tr><td class="label">Patient Name:</td><td>{{ $invoice->patient->name ?? 'N/A' }} ({{ $invoice->patient->species ?? '' }})</td></tr>
                    <tr><td class="label">Address:</td>
                        <td>
                            {{ $invoice->patient->owner_address ?? '' }}<br>
                            {{ $invoice->patient->owner_city ?? '' }} {{ $invoice->patient->owner_province ?? '' }} {{ $invoice->patient->owner_zip ?? '' }}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 50%">Item / Service</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach($invoice->items as $item)
            <tr>
                <td>
                    {{ $item->name }}
                    @if($item->notes)
                        <br><span style="font-size: 11px; color: #666;">{{ $item->notes }}</span>
                    @endif
                </td>
                <td class="text-center">{{ $item->qty }}</td>
                <td class="text-right">₱{{ number_format($item->unit_price, 2) }}</td>
                <td class="text-right">₱{{ number_format($item->amount, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals-container">
        <table class="totals-table">
            <tr>
                <td class="label text-right">Subtotal:</td>
                <td class="text-right">₱{{ number_format($invoice->subtotal, 2) }}</td>
            </tr>
            @if($invoice->discount_value > 0)
            <tr>
                <td class="label text-right">Discount ({{ $invoice->discount_type == 'percentage' ? $invoice->discount_value.'%' : 'Fixed' }}):</td>
                <td class="text-right">-₱{{ number_format($invoice->discount_type == 'percentage' ? ($invoice->subtotal * ($invoice->discount_value / 100)) : $invoice->discount_value, 2) }}</td>
            </tr>
            @endif
            @if($invoice->tax_rate > 0)
            <tr>
                <td class="label text-right">Tax ({{ $invoice->tax_rate }}%):</td>
                <td class="text-right">₱{{ number_format(($invoice->subtotal - ($invoice->discount_type == 'percentage' ? ($invoice->subtotal * ($invoice->discount_value / 100)) : $invoice->discount_value)) * ($invoice->tax_rate / 100), 2) }}</td>
            </tr>
            @endif
            <tr>
                <td class="label text-right total-row">Total:</td>
                <td class="text-right total-row">₱{{ number_format($invoice->total, 2) }}</td>
            </tr>
            <tr>
                <td class="label text-right">Amount Paid:</td>
                <td class="text-right">₱{{ number_format($invoice->amount_paid, 2) }}</td>
            </tr>
            <tr>
                <td class="label text-right" style="color: #4b5563;">Balance Due:</td>
                <td class="text-right" style="color: #4b5563;">₱{{ number_format(max(0, $invoice->total - $invoice->amount_paid), 2) }}</td>
            </tr>
        </table>
    </div>
    
    <div style="clear: both;"></div>

    @if($invoice->notes_to_client)
    <div class="notes">
        <strong>Notes / Instructions:</strong><br>
        {!! nl2br(e($invoice->notes_to_client)) !!}
    </div>
    @endif

    <div class="footer">
        Thank you for trusting AutoVet Clinic with your pet's care.<br>
        Generated on {{ now()->format('M d, Y h:i A') }}
    </div>
</body>
</html>
