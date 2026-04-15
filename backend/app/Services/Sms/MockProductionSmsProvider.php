<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Log;

/**
 * MockProductionSmsProvider
 * 
 * A high-fidelity mock provider for Phase 2 validation.
 * Simulates real-world SMS delivery behavior.
 */
class MockProductionSmsProvider implements SmsProviderInterface
{
    /**
     * Send an SMS message to a specific phone number.
     *
     * @param string $to
     * @param string $message
     * @return bool
     * @throws \Exception
     */
    public function sendSms(string $to, string $message): bool
    {
        // 1. Simulate invalid recipient (deterministic for testing)
        if (str_ends_with($to, '0000')) {
            throw new \Exception("Invalid Recipient: Mobile number [{$to}] is out of service or invalid.");
        }

        // 2. Simulate Provider Timeout (for testing)
        if (str_ends_with($to, '9999')) {
             Log::error("SMS Mock: Gateway Timeout for {$to}");
             throw new \Exception("Gateway Timeout: SMS Provider did not respond within 10 seconds.");
        }

        // 3. Simulate success
        Log::info("SMS Mock [SENT] to {$to}: {$message}");
        
        // Return true to indicate successful handoff
        return true;
    }
}
