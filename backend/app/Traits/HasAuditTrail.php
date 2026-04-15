<?php

namespace App\Traits;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

trait HasAuditTrail
{
    public static function bootHasAuditTrail()
    {
        static::created(function ($model) {
            $model->logAudit('created', null, $model->getAttributes());
        });

        static::updated(function ($model) {
            $model->logAudit('updated', $model->getOriginal(), $model->getAttributes());
        });

        static::deleted(function ($model) {
            $model->logAudit('deleted', $model->getOriginal(), null);
        });
    }

    /**
     * Log a manual action not tied to a specific model event.
     */
    public static function logManual($action, $modelType = 'System', $modelId = 0, $old = null, $new = null)
    {
        try {
            AuditLog::create([
                'user_id' => Auth::id(),
                'action' => $action,
                'model_type' => $modelType,
                'model_id' => $modelId,
                'old_values' => $old,
                'new_values' => $new,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to log manual audit: ' . $e->getMessage());
        }
    }

    protected function logAudit($action, $old, $new)
    {
        try {
            $user = Auth::user();
            $userId = null;

            // Only log user_id if the authenticated user is an Admin
            // because audit_logs.user_id points to the admins table.
            if ($user instanceof \App\Models\Admin) {
                $userId = $user->id;
            }

            AuditLog::create([
                'user_id' => $userId,
                'action' => $action,
                'model_type' => get_class($this),
                'model_id' => $this->id,
                'old_values' => $old,
                'new_values' => $new,
                'ip_address' => Request::ip(),
                'user_agent' => Request::userAgent(),
            ]);
        } catch (\Exception $e) {
            // Do not break the main transaction if audit logging fails
            \Illuminate\Support\Facades\Log::error('Failed to log audit: ' . $e->getMessage());
        }
    }
}
