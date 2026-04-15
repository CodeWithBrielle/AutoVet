<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

trait StandardizesResponses
{
    /**
     * Return a standardized success response.
     */
    protected function successResponse($data, ?string $message = null, int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'metadata' => [
                'processed_at' => now(),
            ]
        ], $status);
    }

    /**
     * Return a standardized error response.
     */
    protected function errorResponse(
        string $code,
        ?string $source,
        string $message,
        array $errors = [],
        int $status = 422,
        $existingRecord = null
    ): JsonResponse {
        $response = [
            'success' => false,
            'error_code' => $code,
            'conflict_source' => $source,
            'message' => $message,
            'errors' => $errors,
        ];

        if ($existingRecord) {
            $response['existing_record'] = $existingRecord;
        }

        return response()->json($response, $status);
    }
}
