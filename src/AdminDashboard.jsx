import React, { useState, useEffect } from 'react';
import { Client, Databases, Account, Query, ID } from 'appwrite';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import Papa from 'papaparse';

// Initialize Appwrite client
const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const account = new Account(client);

const DB4_ID = import.meta.env.VITE_DB4_ID; // Registrations
const DB2_ID = import.meta.env.VITE_DB2_ID; // Attendance
const DB3_ID = import.meta.env.VITE_DB3_ID; // Codes & Zoom
const REGISTRATIONS_COLLECTION_ID = import.meta.env.VITE_REGISTRATIONS_COLLECTION_ID;
const ATTENDANCE_COLLECTION_ID = import.meta.env.VITE_ATTENDANCE_COLLECTION_ID;
const CODE_COLLECTION_ID = import.meta.env.VITE_CODE_COLLECTION_ID;
const ZOOM_COLLECTION_ID = import.meta.env.VITE_ZOOM_COLLECTION_ID;

function AdminDashboard() {
    useEffect(() => {
        document.title = 'Admin Dashboard';
        return () => { document.title = 'Yan Linn Aung'; };
    }, []);

    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Data State
    const [attendanceData, setAttendanceData] = useState([]);
    const [students, setStudents] = useState([]);
    const [allCodeDates, setAllCodeDates] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI & Filter State
    const [activeTab, setActiveTab] = useState('current');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [definedCode, setDefinedCode] = useState('');
    const [definedZoomId, setDefinedZoomId] = useState('');
    const [definedZoomPassword, setDefinedZoomPassword] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newZoomId, setNewZoomId] = useState('');
    const [newZoomPassword, setNewZoomPassword] = useState('');
    const [codeStatus, setCodeStatus] = useState('');
    const [zoomStatus, setZoomStatus] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const itemsPerPage = 20;

    // Check Auth on Mount
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            await account.get();
            setIsAuthenticated(true);
        } catch (err) {
            setIsAuthenticated(false);
        } finally {
            setAuthChecking(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        try {
            await account.createEmailPasswordSession(loginEmail, loginPassword);
            setIsAuthenticated(true);
        } catch (err) {
            setLoginError('Invalid email or password.');
            console.error('Login error:', err);
        }
    };

    const handleLogout = async () => {
        try {
            await account.deleteSession('current');
            setIsAuthenticated(false);
            setLoginEmail('');
            setLoginPassword('');
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const fetchWithRetry = async (fn, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
            try { return await fn(); }
            catch (err) {
                if (i === retries - 1) throw err;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };

    // Data Fetching
    const fetchAllStudents = async () => {
        try {
            let allStudents = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            while (hasMore) {
                const response = await fetchWithRetry(() =>
                    databases.listDocuments(DB4_ID, REGISTRATIONS_COLLECTION_ID, [
                        Query.limit(limit), Query.offset(offset), Query.orderAsc('studentId')
                    ])
                );
                const normalized = response.documents.map(doc => ({
                    ...doc, studentName: doc.fullName || doc.studentName
                }));
                allStudents = [...allStudents, ...normalized];
                offset += limit;
                hasMore = response.documents.length === limit;
            }
            setStudents(allStudents);
        } catch (err) { console.error('Error fetching students:', err); }
    };

    const fetchAttendanceData = async (date) => {
        try {
            const start = startOfDay(parseISO(date));
            const end = endOfDay(parseISO(date));
            let allAttendance = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            while (hasMore) {
                const response = await fetchWithRetry(() =>
                    databases.listDocuments(DB2_ID, ATTENDANCE_COLLECTION_ID, [
                        Query.greaterThanEqual('$createdAt', start.toISOString()),
                        Query.lessThanEqual('$createdAt', end.toISOString()),
                        Query.limit(limit), Query.offset(offset), Query.orderDesc('$createdAt')
                    ])
                );
                allAttendance = [...allAttendance, ...response.documents];
                offset += limit;
                hasMore = response.documents.length === limit;
            }
            const records = allAttendance.map(doc => ({
                id: doc.$id, studentId: doc.studentId, studentName: doc.studentName,
                attendanceCode: doc.attendanceCode, createdAt: parseISO(doc.$createdAt)
            }));
            setAttendanceData(records);
        } catch (err) { console.error('Error fetching attendance:', err); }
        finally { setLoading(false); }
    };

    const fetchAllCodeDates = async () => {
        try {
            let allCodes = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;
            while (hasMore) {
                const response = await fetchWithRetry(() =>
                    databases.listDocuments(DB3_ID, CODE_COLLECTION_ID, [
                        Query.limit(limit), Query.offset(offset), Query.orderDesc('date')
                    ])
                );
                allCodes = [...allCodes, ...response.documents];
                offset += limit;
                hasMore = response.documents.length === limit;
            }
            const codeDates = allCodes.map(doc => ({ date: doc.date, code: doc.code, dateObj: parseISO(doc.date) }));
            setAllCodeDates(codeDates);
            const codeForDate = codeDates.find(cd => cd.date === selectedDate);
            setDefinedCode(codeForDate ? codeForDate.code || '' : '');
        } catch (err) { console.error('Error fetching code dates:', err); }
    };

    const fetchGlobalZoom = async () => {
        try {
            const response = await fetchWithRetry(() =>
                databases.listDocuments(DB3_ID, ZOOM_COLLECTION_ID, [Query.equal('$id', 'global_zoom')])
            );
            if (response.documents.length > 0) {
                const doc = response.documents[0];
                setDefinedZoomId(doc.zoomId || '');
                setDefinedZoomPassword(doc.zoomPassword || '');
                setNewZoomId(doc.zoomId || '');
                setNewZoomPassword(doc.zoomPassword || '');
            }
        } catch (err) { console.error('Error fetching global Zoom:', err); }
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchAllStudents(), fetchAllCodeDates(), fetchGlobalZoom()]);
            await fetchAttendanceData(selectedDate);
        };
        loadData();
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const codeForDate = allCodeDates.find(cd => cd.date === selectedDate);
        setDefinedCode(codeForDate ? codeForDate.code || '' : '');
        fetchAttendanceData(selectedDate);
        setCurrentPage(1);
    }, [selectedDate, allCodeDates]);

    // Admin Settings Handlers
    const handleCodeSubmit = async (e) => {
        e.preventDefault();
        if (!newCode || !/^[A-Z0-9]+$/.test(newCode)) { setCodeStatus('error'); return; }
        try {
            const existing = await fetchWithRetry(() => databases.listDocuments(DB3_ID, CODE_COLLECTION_ID, [Query.equal('date', selectedDate)]));
            if (existing.documents.length > 0) {
                await databases.updateDocument(DB3_ID, CODE_COLLECTION_ID, existing.documents[0].$id, { code: newCode });
            } else {
                await databases.createDocument(DB3_ID, CODE_COLLECTION_ID, ID.unique(), { date: selectedDate, code: newCode });
            }
            await fetchAllCodeDates();
            setNewCode('');
            setCodeStatus('success');
            setTimeout(() => setCodeStatus(''), 3000);
        } catch (err) { setCodeStatus('error'); }
    };

    const handleZoomSubmit = async (e) => {
        e.preventDefault();
        if (!newZoomId || !/^\d+$/.test(newZoomId) || !newZoomPassword || newZoomPassword.length < 6) { setZoomStatus('error'); return; }
        try {
            const existing = await fetchWithRetry(() => databases.listDocuments(DB3_ID, ZOOM_COLLECTION_ID, [Query.equal('$id', 'global_zoom')]));
            if (existing.documents.length > 0) {
                await databases.updateDocument(DB3_ID, ZOOM_COLLECTION_ID, 'global_zoom', { zoomId: newZoomId, zoomPassword: newZoomPassword });
            } else {
                await databases.createDocument(DB3_ID, ZOOM_COLLECTION_ID, 'global_zoom', { zoomId: newZoomId, zoomPassword: newZoomPassword });
            }
            setDefinedZoomId(newZoomId);
            setDefinedZoomPassword(newZoomPassword);
            setZoomStatus('success');
            setTimeout(() => setZoomStatus(''), 3000);
        } catch (err) { setZoomStatus('error'); }
    };

    // Manual Override Handler
    const handleOverride = async (studentId, studentName, overrideType) => {
        if (overrideType === 'present' && !definedCode) {
            alert('You must set an attendance code for this date first.');
            return;
        }

        try {
            const start = startOfDay(parseISO(selectedDate)).toISOString();
            const end = endOfDay(parseISO(selectedDate)).toISOString();
            const existing = await databases.listDocuments(DB2_ID, ATTENDANCE_COLLECTION_ID, [
                Query.equal('studentId', studentId),
                Query.greaterThanEqual('$createdAt', start),
                Query.lessThanEqual('$createdAt', end)
            ]);

            if (overrideType === 'absent') {
                if (existing.documents.length > 0) {
                    await databases.deleteDocument(DB2_ID, ATTENDANCE_COLLECTION_ID, existing.documents[0].$id);
                }
            } else {
                const codeToSet = overrideType === 'present' ? definedCode : 'EXCUSED';
                if (existing.documents.length > 0) {
                    await databases.updateDocument(DB2_ID, ATTENDANCE_COLLECTION_ID, existing.documents[0].$id, { attendanceCode: codeToSet });
                } else {
                    const docId = `${studentId}_${selectedDate}`;
                    try {
                        await databases.createDocument(DB2_ID, ATTENDANCE_COLLECTION_ID, docId, {
                            studentId, studentName, attendanceCode: codeToSet
                        });
                    } catch (err) {
                        if (err.code === 409) {
                            await databases.updateDocument(DB2_ID, ATTENDANCE_COLLECTION_ID, docId, { attendanceCode: codeToSet });
                        } else throw err;
                    }
                }
            }
            await fetchAttendanceData(selectedDate); // Refresh table
        } catch (err) {
            alert('Failed to override status: ' + err.message);
        }
    };

    // Export CSV
    const handleExportCSV = () => {
        const dataToExport = filteredStudents.map(s => ({
            "Student ID": s.studentId,
            "Full Name": s.studentName,
            "Email": s.email || 'N/A',
            "Telegram": s.telegramUsername || 'N/A',
            "Status": s.label,
            "Code Submitted": s.code
        }));
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Attendance_${selectedDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Status Calculations
    const getAttendanceStatus = (studentId) => {
        if (!definedCode) return { status: 'no-code', code: '-', label: 'No Code Set' };
        const studentRecords = attendanceData.filter(record => record.studentId === studentId);
        if (studentRecords.length === 0) return { status: 'absent-no-inform', code: '-', label: 'Absent (No Info)' };
        const latestRecord = studentRecords.sort((a, b) => b.createdAt - a.createdAt)[0];
        const submittedCode = latestRecord.attendanceCode;
        if (submittedCode === definedCode) return { status: 'present', code: submittedCode, label: 'Present' };
        if (submittedCode === 'EXCUSED') return { status: 'absent-informed', code: 'EXCUSED', label: 'Excused (Admin)' };
        return { status: 'absent-informed', code: submittedCode, label: 'Absent (Informed)' };
    };

    const getFilteredStudents = () => {
        let filtered = students.map(student => ({ ...student, ...getAttendanceStatus(student.studentId) }));
        if (statusFilter !== 'all') filtered = filtered.filter(s => s.status === statusFilter);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                s.studentId?.toLowerCase().includes(q) || s.studentName?.toLowerCase().includes(q) || s.telegramUsername?.toLowerCase().includes(q)
            );
        }
        return filtered;
    };

    const filteredStudents = getFilteredStudents();
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Render Helpers
    const getStatusStyles = (status) => {
        switch(status) {
            case 'present': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
            case 'absent-informed': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
            case 'absent-no-inform': return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
        }
    };

    if (authChecking) {
        return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D16F55]"></div></div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-4">
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#D16F55]/15 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#B7A9CC]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
                <div className="relative bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl max-w-md w-full p-8 border border-white/10">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#D16F55] to-[#B7A9CC] rounded-2xl mb-4 shadow-lg shadow-[#D16F55]/20">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Admin Login</h2>
                    </div>
                    {loginError && <p className="text-red-400 mb-4 text-center text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">{loginError}</p>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">Email</label>
                            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#D16F55]/50 outline-none" placeholder="admin@example.com" required />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">Password</label>
                            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#D16F55]/50 outline-none" placeholder="••••••••" required />
                        </div>
                        <button type="submit" className="w-full mt-4 bg-gradient-to-r from-[#D16F55] to-[#B7A9CC] text-white py-3 rounded-xl hover:from-[#c4624b] hover:to-[#a899bb] font-semibold tracking-wide shadow-lg">Login Securely</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans selection:bg-[#D16F55]/30">
            {/* Header */}
            <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#D16F55] to-[#B7A9CC] rounded-xl flex items-center justify-center shadow-lg shadow-[#D16F55]/20">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Attendance Dashboard</h1>
                    </div>
                    <button onClick={handleLogout} className="bg-white/5 border border-white/10 text-slate-300 px-5 py-2 rounded-lg hover:bg-white/10 transition text-sm font-medium">Logout</button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
                {/* Control Panels Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Zoom Settings */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-xl">
                        <h3 className="text-sm font-semibold text-[#B7A9CC] mb-4 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            Global Zoom Configuration
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Zoom ID</label>
                                <input type="text" value={newZoomId} onChange={e => setNewZoomId(e.target.value.replace(/[^\d]/g, ''))} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#B7A9CC]" placeholder="Meeting ID" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Password</label>
                                <input type="text" value={newZoomPassword} onChange={e => setNewZoomPassword(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#B7A9CC]" placeholder="Password" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <button onClick={handleZoomSubmit} className="bg-[#B7A9CC]/20 text-[#B7A9CC] border border-[#B7A9CC]/30 px-4 py-2 rounded-lg hover:bg-[#B7A9CC]/30 text-xs font-semibold uppercase tracking-wider transition">Save Settings</button>
                            {zoomStatus === 'success' && <span className="text-emerald-400 text-xs">✅ Saved</span>}
                            {zoomStatus === 'error' && <span className="text-rose-400 text-xs">Error</span>}
                        </div>
                    </div>

                    {/* Code Settings */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-xl">
                        <h3 className="text-sm font-semibold text-[#D16F55] mb-4 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                            Attendance Code Access
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Target Date</label>
                                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#D16F55]" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Daily Code</label>
                                <input type="text" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#D16F55] font-mono" placeholder={definedCode || "Set Code..."} maxLength={10} />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <button onClick={handleCodeSubmit} className="bg-[#D16F55]/20 text-[#D16F55] border border-[#D16F55]/30 px-4 py-2 rounded-lg hover:bg-[#D16F55]/30 text-xs font-semibold uppercase tracking-wider transition">Save Code</button>
                            {codeStatus === 'success' && <span className="text-emerald-400 text-xs">✅ Saved</span>}
                            {codeStatus === 'error' && <span className="text-rose-400 text-xs">Error</span>}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D16F55]"></div></div>
                ) : (
                    <>
                        {/* Stats Overview */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                <div className="text-xs text-slate-500 uppercase font-semibold">Total Students</div>
                                <div className="text-3xl font-bold text-white mt-1">{students.length}</div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                                <div className="text-xs text-emerald-500/70 uppercase font-semibold">Present</div>
                                <div className="text-3xl font-bold text-emerald-400 mt-1">{filteredStudents.filter(s => s.status === 'present').length}</div>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                                <div className="text-xs text-amber-500/70 uppercase font-semibold">Absent (Informed)</div>
                                <div className="text-3xl font-bold text-amber-400 mt-1">{filteredStudents.filter(s => s.status === 'absent-informed').length}</div>
                            </div>
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                                <div className="text-xs text-rose-500/70 uppercase font-semibold">Absent (No Info)</div>
                                <div className="text-3xl font-bold text-rose-400 mt-1">{filteredStudents.filter(s => s.status === 'absent-no-inform').length}</div>
                            </div>
                        </div>

                        {/* Main Table Area */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                            {/* Toolbar */}
                            <div className="p-4 border-b border-white/10 flex flex-col md:flex-row gap-4 justify-between items-center bg-black/20">
                                <div className="flex flex-1 w-full gap-4">
                                    <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="Search IDs, Names, Telegram..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-slate-500" />
                                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-slate-300 focus:outline-none focus:border-slate-500 [&>option]:bg-slate-800">
                                        <option value="all">All Statuses</option>
                                        <option value="present">Present Only</option>
                                        <option value="absent-informed">Informed/Excused</option>
                                        <option value="absent-no-inform">No Info</option>
                                    </select>
                                </div>
                                <button onClick={handleExportCSV} className="w-full md:w-auto bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Export CSV
                                </button>
                            </div>

                            {/* Info Banner */}
                            {!definedCode && (
                                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center gap-3">
                                    <span className="text-amber-500 text-lg">⚠️</span>
                                    <span className="text-amber-400/90 text-sm font-medium">No attendance code set for {selectedDate}. Students cannot check in.</span>
                                </div>
                            )}

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/40 text-xs uppercase tracking-wider text-slate-500 border-b border-white/10">
                                            <th className="px-6 py-4 font-semibold">Student</th>
                                            <th className="px-6 py-4 font-semibold">Contact</th>
                                            <th className="px-6 py-4 font-semibold">Status</th>
                                            <th className="px-6 py-4 font-semibold">Code</th>
                                            <th className="px-6 py-4 font-semibold text-right">Overrides</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {paginatedStudents.length > 0 ? paginatedStudents.map((student) => (
                                            <tr key={student.studentId} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-white">{student.studentName}</div>
                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">{student.studentId}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-300">{student.email || 'No email'}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{student.telegramUsername ? `@${student.telegramUsername}` : '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${getStatusStyles(student.status)}`}>
                                                        {student.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-400 font-mono bg-black/30 px-2 py-1 rounded">{student.code}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="inline-flex opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg p-1 border border-white/5">
                                                        <button onClick={() => handleOverride(student.studentId, student.studentName, 'present')} className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 transition tooltip" title="Mark Present">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                                        </button>
                                                        <button onClick={() => handleOverride(student.studentId, student.studentName, 'excused')} className="p-1.5 rounded hover:bg-amber-500/20 text-amber-400 transition" title="Mark Excused">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        </button>
                                                        <button onClick={() => handleOverride(student.studentId, student.studentName, 'absent')} className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition" title="Mark Absent (Delete Record)">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">No students match your criteria.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="p-4 border-t border-white/10 flex justify-between items-center bg-black/20 text-sm">
                                    <div className="text-slate-500">Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length}</div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition">Prev</button>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition">Next</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

export default AdminDashboard;
