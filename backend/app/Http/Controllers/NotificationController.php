<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Notification::orderBy('created_at', 'desc');
        
        if ($request->user()) {
            $query->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            });
        }

        $notifications = $query->limit(50)->get();
        return response()->json($notifications);
    }

    public function markAsRead(Request $request)
    {
        $request->validate([
            'notification_ids' => 'nullable|array',
            'notification_ids.*' => 'exists:notifications,id',
            'all' => 'nullable|boolean'
        ]);

        $query = Notification::whereNull('read_at');

        // Apply user filter if applicable
        if ($request->user()) {
            $query->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            });
        }

        if ($request->boolean('all')) {
            // Mark all unread for this user as read
            $query->update(['read_at' => now()]);
        } elseif ($request->has('notification_ids')) {
            // Mark specific IDs as read (scoping to user-accessible only)
            $query->whereIn('id', $request->notification_ids)
                ->update(['read_at' => now()]);
        }

        return response()->json(['message' => 'Notifications updated successfully.']);
    }
}
