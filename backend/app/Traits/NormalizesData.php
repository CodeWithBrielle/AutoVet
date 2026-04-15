<?php

namespace App\Traits;

use libphonenumber\PhoneNumberUtil;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\NumberParseException;

trait NormalizesData
{
    /**
     * Normalize phone number to +639XXXXXXXXX format or standard E164.
     */
    public function normalizePhone(?string $phone): ?string
    {
        if (!$phone) return null;

        // Strip non-numeric characters except leading +
        $phone = preg_replace('/(?<!^)\+|[^0-9+]/', '', $phone);

        // Handle local PH format: starts with 09 and has 11 digits total
        if (preg_match('/^09\d{9}$/', $phone)) {
            $phone = '+63' . substr($phone, 1);
        } 
        // Handle case where +63 is already there but maybe has some formatting (stripped above)
        // libphonenumber will handle the rest.

        $phoneUtil = PhoneNumberUtil::getInstance();
        try {
            // Parse with PH as default
            $numberProto = $phoneUtil->parse($phone, "PH");
            
            if ($phoneUtil->isValidNumber($numberProto)) {
                return $phoneUtil->format($numberProto, PhoneNumberFormat::E164);
            }
        } catch (NumberParseException $e) {
            // Fallback to cleaned numeric string
        }

        return $phone;
    }

    /**
     * Normalize email to lowercase and trimmed.
     */
    public function normalizeEmail(?string $email): ?string
    {
        if (!$email) return null;
        return strtolower(trim($email));
    }
    /**
     * Light sanitization for labels (City, Province, etc.)
     * This is formatting for UI consistency, not geo-validation.
     */
    public function sanitizeLabel(?string $string): ?string
    {
        if (!$string) return null;
        // Trim and Title Case (e.g. "san jose" -> "San Jose")
        return ucwords(strtolower(trim($string)));
    }
}
