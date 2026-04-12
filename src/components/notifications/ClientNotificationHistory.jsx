import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FiRefreshCw, FiSearch, FiEye, FiX, FiUser, FiClock, FiCheckCircle, FiAlertCircle, FiInfo, FiCopy, FiExternalLink } from 'react-icons/fi';
import { LuSparkles } from "react-icons/lu";
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function ClientNotificationHistory() {
    const toast = useToast();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // Filters
    const [channel, setChannel] = useState('');
    const [status, setStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    
    // Details Drawer
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const { user } = useAuth();

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (user?.token) {
            fetchHistory();
        }
    }, [page, channel, status, debouncedSearch, user?.token]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const params = { page };
            if (channel) params.channel = channel;
            if (status) params.status = status;
            if (debouncedSearch) params.search = debouncedSearch;
            
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`/api/client-notifications?${queryString}`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${user?.token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch history');
            const data = await response.json();
            setHistory(data.data);
            setTotalPages(data.last_page);
        } catch (err) {
            console.error('Failed to load notification history', err);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (notification) => {
        setSelectedNotification(notification);
        setIsDrawerOpen(true);
    };

    const handleCopyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Message copied to clipboard');
    };

    return (
        <div className="card-shell p-8 shadow-soft-xl border border-slate-100 dark:border-zinc-800">
            <div className="flex flex-wrap justify-between items-end mb-8 gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-zinc-50">Notification Log</h1>
                    <p className="mt-1 text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">History of outbound client communications</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={16} />
                        <input 
                            type="text"
                            placeholder="Search recipient or message..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 transition-all placeholder:text-slate-400 placeholder:font-semibold"
                        />
                    </div>
                    <select 
                        value={channel} 
                        onChange={e => { setChannel(e.target.value); setPage(1); }}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 transition-all"
                    >
                        <option value="">All Channels</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                    </select>
                    <select 
                        value={status} 
                        onChange={e => { setStatus(e.target.value); setPage(1); }}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 transition-all"
                    >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                    </select>
                    <button onClick={fetchHistory} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 transition-all">
                        <FiRefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 shadow-sm">
                <table className="w-full text-left border-collapse cursor-default">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:border-zinc-800 dark:bg-zinc-800/30">
                            <th className="p-5">Date</th>
                            <th className="p-5">Recipient</th>
                            <th className="p-5">Message Preview</th>
                            <th className="p-5 text-center">Type</th>
                            <th className="p-5 text-center">Status</th>
                            <th className="p-5 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                        {loading && history.length === 0 ? (
                            <tr><td colSpan="5" className="p-16 text-center text-slate-400 font-bold italic">Gathering communication records...</td></tr>
                        ) : history.length === 0 ? (
                            <tr><td colSpan="5" className="p-16 text-center text-slate-400 font-bold italic">No records found.</td></tr>
                        ) : (
                            history.map(item => (
                                <tr 
                                    key={item.id} 
                                    onClick={() => handleViewDetails(item)}
                                    className="border-b border-slate-50 hover:bg-slate-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/20 transition-all relative group cursor-pointer hover:scale-[1.002]"
                                >
                                    <td className="p-5 align-top whitespace-nowrap text-[11px] font-black uppercase tracking-widest text-slate-400">
                                        {format(new Date(item.created_at), 'MMM d, yyyy • HH:mm')}
                                    </td>
                                    <td className="p-5 align-top">
                                        <div className="font-black text-slate-800 dark:text-zinc-100 italic">{item.owner?.name || 'Unknown'}</div>
                                        <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 flex gap-2 mt-1 uppercase tracking-widest items-center">
                                            {item.channel}
                                        </div>
                                    </td>
                                    <td className="p-5 align-top max-w-md">
                                        {item.title && <div className="font-black text-slate-800 dark:text-zinc-100 mb-1 italic">{item.title}</div>}
                                        <div className="text-slate-500 dark:text-zinc-400 line-clamp-2 pr-4 text-xs font-semibold leading-relaxed">{item.message}</div>
                                        {item.status === 'failed' && item.error_message && (
                                            <div className="mt-3 bg-rose-50 dark:bg-rose-900/10 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                                Error: {item.error_message}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5 align-top text-center">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="p-5 align-top text-center">
                                        <span className={clsx(
                                          "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm border",
                                          item.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/30' : 
                                          item.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/30' : 
                                          'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800/30'
                                        )}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-5 align-top text-center">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleViewDetails(item); }}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-600 hover:text-white transition-all dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-blue-600"
                                        >
                                            <FiEye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-400 mt-6">
                    <div>Page {page} of {totalPages}</div>
                    <div className="flex gap-2">
                        <button 
                            disabled={page === 1} 
                            onClick={() => setPage(p => p - 1)}
                            className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 transition-all active:scale-95"
                        >
                            Previous
                        </button>
                        <button 
                            disabled={page === totalPages} 
                            onClick={() => setPage(p => p + 1)}
                            className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 transition-all active:scale-95"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
            {/* Slide-Over Details Drawer */}
            <div
                className={clsx(
                    "fixed inset-0 z-[60] transition-opacity duration-500 ease-in-out",
                    isDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    onClick={() => setIsDrawerOpen(false)}
                />

                {/* Drawer Panel */}
                <aside
                    className={clsx(
                        "absolute inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-zinc-900 shadow-[-20px_0_50px_-10px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.3,1)] flex flex-col",
                        isDrawerOpen ? "translate-x-0" : "translate-x-full"
                    )}
                >
                    {/* Header */}
                    <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/30">
                        <div>
                            <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50 uppercase italic flex items-center gap-3">
                                <span className="text-blue-600 dark:text-blue-400">/</span>Notification Details
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Audit trail & full message log</p>
                        </div>
                        <button
                            onClick={() => setIsDrawerOpen(false)}
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-rose-900/20 transition-all"
                        >
                            <FiX size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
                        {selectedNotification && (
                            <>
                                {/* Status Alert */}
                                {selectedNotification.status === 'failed' && (
                                    <div className="flex items-start gap-4 p-5 rounded-3xl bg-rose-50 border border-rose-100 text-rose-700 dark:bg-rose-900/10 dark:border-rose-900/30 dark:text-rose-400">
                                        <div className="mt-1 h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-2xl bg-white dark:bg-rose-900/30 shadow-sm">
                                            <FiAlertCircle size={22} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-black uppercase tracking-widest mb-1 italic">Delivery Failed</div>
                                            <div className="text-xs font-bold leading-relaxed">{selectedNotification.error_message}</div>
                                        </div>
                                    </div>
                                )}

                                {selectedNotification.status === 'sent' && (
                                    <div className="flex items-start gap-4 p-5 rounded-3xl bg-emerald-50 border border-emerald-100 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400">
                                        <div className="mt-1 h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-2xl bg-white dark:bg-emerald-900/30 shadow-sm">
                                            <FiCheckCircle size={22} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-black uppercase tracking-widest mb-1 italic">Successfully Delivered</div>
                                            <div className="text-xs font-bold leading-relaxed">Confirmed by {selectedNotification.channel} provider on {format(new Date(selectedNotification.sent_at || selectedNotification.updated_at), 'MMMM d, yyyy @ HH:mm')}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Recipient & Subject Section */}
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between bg-slate-50 dark:bg-zinc-800/40 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-4">
                                            <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-zinc-700 text-slate-400">
                                                <FiUser size={28} />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recipient</div>
                                                <div className="text-lg font-black text-slate-800 dark:text-zinc-100 italic">{selectedNotification.owner?.name}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={clsx(
                                                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                                                selectedNotification.channel === 'email' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'
                                            )}>
                                                {selectedNotification.channel}
                                            </span>
                                            <span className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                                                {selectedNotification.type}
                                            </span>
                                        </div>
                                    </div>

                                    {selectedNotification.title && (
                                        <div className="p-6 rounded-[2rem] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Subject / Title</div>
                                            <div className="text-xl font-black text-slate-900 dark:text-zinc-50 italic">
                                                {selectedNotification.title}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Message Content */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                            <LuSparkles size={16} />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Message Content</span>
                                        </div>
                                        <button 
                                            onClick={() => handleCopyToClipboard(selectedNotification.message)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800 transition-all text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <FiCopy size={12} />
                                            Copy
                                        </button>
                                    </div>
                                    <div className="p-8 rounded-[2.5rem] bg-slate-900 text-slate-100 font-medium text-sm leading-relaxed whitespace-pre-wrap shadow-2xl border-4 border-slate-800 selection:bg-blue-500/30 min-h-[200px]">
                                        {selectedNotification.message}
                                    </div>
                                </div>

                                {/* Metadata Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <FiClock size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Sent Date</span>
                                        </div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                            {format(new Date(selectedNotification.created_at), 'MMMM d, yyyy')}
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <FiClock size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Sent Time</span>
                                        </div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                            {format(new Date(selectedNotification.created_at), 'HH:mm:ss')}
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <FiInfo size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">ID Reference</span>
                                        </div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                            #{selectedNotification.id}
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <FiExternalLink size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Related To</span>
                                        </div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                            {selectedNotification.related_type ? (
                                                <span className="capitalize">{selectedNotification.related_type.split('\\').pop()} #{selectedNotification.related_id}</span>
                                            ) : (
                                                'N/A'
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex justify-end">
                        <button 
                            onClick={() => setIsDrawerOpen(false)}
                            className="px-8 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                        >
                            Close Audit
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}
