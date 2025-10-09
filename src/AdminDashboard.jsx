import React, { useState, useEffect } from 'react';
import { Client, Databases, Query, ID } from 'appwrite';
import { format, parseISO, isSameDay, startOfDay, endOfDay } from 'date-fns';

// Initialize Appwrite client
const client = new Client();
client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB1_ID = import.meta.env.VITE_DB1_ID;
const DB2_ID = import.meta.env.VITE_DB2_ID;
const DB3_ID = import.meta.env.VITE_DB3_ID;
const STUDENTS_COLLECTION_ID = import.meta.env.VITE_STUDENTS_COLLECTION_ID;
const ATTENDANCE_COLLECTION_ID = import.meta.env.VITE_ATTENDANCE_COLLECTION_ID;
const CODE_COLLECTION_ID = import.meta.env.VITE_CODE_COLLECTION_ID;
const ZOOM_COLLECTION_ID = import.meta.env.VITE_ZOOM_COLLECTION_ID;

const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

function AdminDashboard() {
    useEffect(() => {
        document.title = 'Admin Dashboard';
        return () => {
            document.title = 'Yan Linn Aung';
        };
    }, []);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [attendanceData, setAttendanceData] = useState([]);
    const [students, setStudents] = useState([]);
    const [allCodeDates, setAllCodeDates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('current');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [definedCode, setDefinedCode] = useState('');
    const [definedZoomId, setDefinedZoomId] = useState('');
    const [definedZoomPassword, setDefinedZoomPassword] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newZoomId, setNewZoomId] = useState('');
    const [newZoomPassword, setNewZoomPassword] = useState('');
    const [codeError, setCodeError] = useState('');
    const [zoomError, setZoomError] = useState('');
    const [codeSuccess, setCodeSuccess] = useState(false);
    const [zoomSuccess, setZoomSuccess] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const itemsPerPage = 20;

    useEffect(() => {
        const savedAuth = sessionStorage.getItem('adminAuth');
        if (savedAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        setLoginError('');
        if (loginUsername === ADMIN_USERNAME && loginPassword === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            sessionStorage.setItem('adminAuth', 'true');
        } else {
            setLoginError('Invalid credentials.');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem('adminAuth');
        setLoginUsername('');
        setLoginPassword('');
    };

    const fetchWithRetry = async (fn, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (err) {
                if (i === retries - 1) throw err;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };

    // Fetch ALL students with pagination
    const fetchAllStudents = async () => {
        try {
            let allStudents = [];
            let offset = 0;
            const limit = 100;
            let hasMore = true;

            while (hasMore) {
                const response = await fetchWithRetry(() =>
                    databases.listDocuments(DB1_ID, STUDENTS_COLLECTION_ID, [
                        Query.limit(limit),
                        Query.offset(offset),
                        Query.orderAsc('studentId')
                    ])
                );

                allStudents = [...allStudents, ...response.documents];
                offset += limit;
                hasMore = response.documents.length === limit;
            }

            setStudents(allStudents);
            console.log(`Fetched ${allStudents.length} students`);
        } catch (err) {
            console.error('Error fetching students:', err);
            setCodeError('Failed to fetch students.');
        }
    };

    // Fetch ALL attendance records for selected date
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
                        Query.limit(limit),
                        Query.offset(offset),
                        Query.orderDesc('$createdAt')
                    ])
                );

                allAttendance = [...allAttendance, ...response.documents];
                offset += limit;
                hasMore = response.documents.length === limit;
            }

            const records = allAttendance.map(doc => ({
                id: doc.$id,
                studentId: doc.studentId,
                studentName: doc.studentName,
                attendanceCode: doc.attendanceCode,
                createdAt: parseISO(doc.$createdAt)
            }));

            setAttendanceData(records);
            console.log(`Fetched ${records.length} attendance records for ${date}`);
        } catch (err) {
            console.error('Error fetching attendance:', err);
            setCodeError('Failed to fetch attendance data.');
        } finally {
            setLoading(false);
        }
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
                        Query.limit(limit),
                        Query.offset(offset),
                        Query.orderDesc('date')
                    ])
                );

                allCodes = [...allCodes, ...response.documents];
                offset += limit;
                hasMore = response.documents.length === limit;
            }

            const codeDates = allCodes.map(doc => ({
                date: doc.date,
                code: doc.code,
                dateObj: parseISO(doc.date)
            }));

            setAllCodeDates(codeDates);

            // Set code for selected date
            const codeForDate = codeDates.find(cd => cd.date === selectedDate);
            setDefinedCode(codeForDate ? codeForDate.code || '' : '');
        } catch (err) {
            console.error('Error fetching code dates:', err);
            setCodeError('Failed to fetch code dates.');
        }
    };

    const fetchGlobalZoom = async () => {
        try {
            const response = await fetchWithRetry(() =>
                databases.listDocuments(DB3_ID, ZOOM_COLLECTION_ID, [Query.equal('$id', 'global_zoom')])
            );
            if (response.documents.length > 0) {
                const doc = response.documents[0];
                const zoomId = doc.zoomId || '';
                const zoomPassword = doc.zoomPassword || '';
                setDefinedZoomId(zoomId);
                setDefinedZoomPassword(zoomPassword);
                setNewZoomId(zoomId);
                setNewZoomPassword(zoomPassword);
            }
        } catch (err) {
            console.error('Error fetching global Zoom:', err);
            setZoomError('Failed to fetch Zoom details.');
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchAllStudents(),
                fetchAllCodeDates(),
                fetchGlobalZoom()
            ]);
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

    const handleCodeSubmit = async (e) => {
        e.preventDefault();
        setCodeError('');
        setCodeSuccess(false);

        if (!newCode || !/^[A-Z0-9]+$/.test(newCode)) {
            setCodeError('Code must consist of uppercase letters and numbers only.');
            return;
        }

        try {
            const existing = await fetchWithRetry(() =>
                databases.listDocuments(DB3_ID, CODE_COLLECTION_ID, [Query.equal('date', selectedDate)])
            );
            if (existing.documents.length > 0) {
                await databases.updateDocument(
                    DB3_ID,
                    CODE_COLLECTION_ID,
                    existing.documents[0].$id,
                    { code: newCode }
                );
            } else {
                await databases.createDocument(
                    DB3_ID,
                    CODE_COLLECTION_ID,
                    ID.unique(),
                    { date: selectedDate, code: newCode }
                );
            }
            await fetchAllCodeDates();
            setNewCode('');
            setCodeSuccess(true);
            setTimeout(() => setCodeSuccess(false), 3000);
        } catch (err) {
            setCodeError('Failed to save code: ' + err.message);
            console.error('Error:', err);
        }
    };

    const handleZoomSubmit = async (e) => {
        e.preventDefault();
        setZoomError('');
        setZoomSuccess(false);

        if (!newZoomId || !/^\d+$/.test(newZoomId)) {
            setZoomError('Zoom ID must be numbers only.');
            return;
        }
        if (!newZoomPassword || newZoomPassword.length < 6) {
            setZoomError('Zoom Password must be at least 6 characters.');
            return;
        }

        if (newZoomId === definedZoomId && newZoomPassword === definedZoomPassword) {
            setZoomError('No changes detected.');
            return;
        }

        try {
            const existing = await fetchWithRetry(() =>
                databases.listDocuments(DB3_ID, ZOOM_COLLECTION_ID, [Query.equal('$id', 'global_zoom')])
            );
            if (existing.documents.length > 0) {
                await databases.updateDocument(
                    DB3_ID,
                    ZOOM_COLLECTION_ID,
                    'global_zoom',
                    { zoomId: newZoomId, zoomPassword: newZoomPassword }
                );
            } else {
                await databases.createDocument(
                    DB3_ID,
                    ZOOM_COLLECTION_ID,
                    'global_zoom',
                    { zoomId: newZoomId, zoomPassword: newZoomPassword }
                );
            }
            setDefinedZoomId(newZoomId);
            setDefinedZoomPassword(newZoomPassword);
            setZoomSuccess(true);
            setTimeout(() => setZoomSuccess(false), 3000);
        } catch (err) {
            setZoomError('Failed to save Zoom details: ' + err.message);
            console.error('Error:', err);
        }
    };

    const getAttendanceStatus = (studentId) => {
        if (!definedCode) {
            return { status: 'no-code', code: '-', label: 'No Code Set' };
        }

        const studentRecords = attendanceData.filter(record => record.studentId === studentId);

        if (studentRecords.length === 0) {
            return { status: 'absent-no-inform', code: '-', label: 'Absent (No Info)' };
        }

        // Get the latest submission
        const latestRecord = studentRecords.sort((a, b) => b.createdAt - a.createdAt)[0];
        const submittedCode = latestRecord.attendanceCode;

        if (submittedCode === definedCode) {
            return { status: 'present', code: submittedCode, label: 'Present' };
        } else {
            return { status: 'absent-informed', code: submittedCode, label: 'Absent (Informed)' };
        }
    };

    const getLongTermAbsentees = () => {
        const absentees = [];
        const sortedDates = [...allCodeDates].sort((a, b) => b.dateObj - a.dateObj);

        students.forEach((student) => {
            let consecutiveAbsent = 0;

            for (let i = 0; i < sortedDates.length && consecutiveAbsent < 5; i++) {
                const classDate = sortedDates[i].date;
                const classCode = sortedDates[i].code;

                if (!classCode) continue;

                // Check if student attended this class
                const attended = attendanceData.some(
                    record => record.studentId === student.studentId &&
                        record.attendanceCode === classCode &&
                        format(record.createdAt, 'yyyy-MM-dd') === classDate
                );

                if (!attended) {
                    consecutiveAbsent++;
                } else {
                    break; // Stop counting if they attended
                }
            }

            if (consecutiveAbsent >= 5) {
                const lastAtt = attendanceData
                    .filter(record => record.studentId === student.studentId)
                    .sort((a, b) => b.createdAt - a.createdAt)[0]?.createdAt;

                absentees.push({
                    ...student,
                    consecutiveAbsent,
                    lastAttendance: lastAtt
                });
            }
        });

        return absentees;
    };

    const getFilteredStudents = () => {
        let filtered = students.map(student => {
            const attendance = getAttendanceStatus(student.studentId);
            return { ...student, ...attendance };
        });

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(s => s.status === statusFilter);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                s.studentId?.toLowerCase().includes(query) ||
                s.studentName?.toLowerCase().includes(query) ||
                s.telegramUsername?.toLowerCase().includes(query)
            );
        }

        return filtered;
    };

    const filteredStudents = getFilteredStudents();
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const paginatedStudents = filteredStudents.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getStatusStyles = (status) => {
        const styles = {
            'present': 'bg-green-100 text-green-800',
            'absent-informed': 'bg-yellow-100 text-yellow-800',
            'absent-no-inform': 'bg-red-100 text-red-800',
            'no-code': 'bg-gray-100 text-gray-800'
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };

    const renderCurrentAttendanceTable = () => {
        const presentCount = filteredStudents.filter(s => s.status === 'present').length;
        const absentInformedCount = filteredStudents.filter(s => s.status === 'absent-informed').length;
        const absentNoInformCount = filteredStudents.filter(s => s.status === 'absent-no-inform').length;

        return (
            <div className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-gray-200">
                        <div className="text-sm text-gray-600">Total Students</div>
                        <div className="text-2xl font-bold text-gray-800">{students.length}</div>
                    </div>
                    <div className="bg-green-50/50 backdrop-blur-sm rounded-xl p-4 border border-green-200">
                        <div className="text-sm text-green-600">Present</div>
                        <div className="text-2xl font-bold text-green-700">{presentCount}</div>
                    </div>
                    <div className="bg-yellow-50/50 backdrop-blur-sm rounded-xl p-4 border border-yellow-200">
                        <div className="text-sm text-yellow-600">Absent (Informed)</div>
                        <div className="text-2xl font-bold text-yellow-700">{absentInformedCount}</div>
                    </div>
                    <div className="bg-red-50/50 backdrop-blur-sm rounded-xl p-4 border border-red-200">
                        <div className="text-sm text-red-600">Absent (No Info)</div>
                        <div className="text-2xl font-bold text-red-700">{absentNoInformCount}</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D16F55] focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D16F55] focus:border-transparent"
                        >
                            <option value="all">All Students</option>
                            <option value="present">Present Only</option>
                            <option value="absent-informed">Absent (Informed)</option>
                            <option value="absent-no-inform">Absent (No Info)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by ID, name, telegram..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D16F55] focus:border-transparent"
                        />
                    </div>
                </div>

                {definedCode && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <span className="text-sm text-blue-800">
                            <strong>Attendance Code for {selectedDate}:</strong> {definedCode}
                        </span>
                    </div>
                )}

                {!definedCode && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <span className="text-sm text-yellow-800">
                            ⚠️ No attendance code set for {selectedDate}. Please set a code above.
                        </span>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telegram</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted Code</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedStudents.map((student) => (
                            <tr key={student.studentId} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.studentId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.studentName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.telegramUsername || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(student.status)}`}>
                                            {student.label}
                                        </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{student.code}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    {paginatedStudents.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            No students found matching your filters.
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                            currentPage === pageNum
                                                ? 'bg-[#D16F55] text-white'
                                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderAbsenteesTable = () => {
        const absentees = getLongTermAbsentees();

        return (
            <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-sm text-red-800">
                        <strong>{absentees.length}</strong> student(s) have been absent for 5 or more consecutive class days
                    </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telegram</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consecutive Absent</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Attendance</th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {absentees.map((student) => (
                            <tr key={student.studentId} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">{student.studentId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.studentName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.telegramUsername || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                            {student.consecutiveAbsent} classes
                                        </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {student.lastAttendance ? format(student.lastAttendance, 'MMM dd, yyyy') : 'Never'}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    {absentees.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            ✅ No students have been absent for 5+ consecutive class days
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5E8C7] to-[#B7A9CC] p-4">
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl max-w-md w-full p-8">
                    <h2 className="text-2xl font-bold mb-6 text-center text-[#D16F55]">Admin Login</h2>
                    {loginError && <p className="text-red-600 mb-4 text-center text-sm bg-red-50 rounded p-2">{loginError}</p>}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                            <input
                                type="text"
                                id="username"
                                value={loginUsername}
                                onChange={(e) => setLoginUsername(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55]"
                                placeholder="admin"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55]"
                                placeholder="Enter password"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-[#D16F55] text-white py-3 rounded-lg hover:bg-[#B85D47] transition-all duration-200 font-medium"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5E8C7] to-[#B7A9CC]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#D16F55] mb-4"></div>
                    <div className="text-gray-700 text-xl">Loading dashboard data...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#F5E8C7] to-[#B7A9CC]">
            <header className="bg-white/80 backdrop-blur-lg shadow-md border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-[#D16F55]">Admin Attendance Dashboard</h1>
                    <button
                        onClick={handleLogout}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-all duration-200 font-medium"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {/* Zoom Settings */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-md p-6 mb-6">
                    <h3 className="text-lg font-semibold text-[#D16F55] mb-4">Global Zoom Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="newZoomId" className="block text-sm font-medium text-gray-700 mb-2">Zoom ID</label>
                            <input
                                type="text"
                                id="newZoomId"
                                value={newZoomId}
                                onChange={(e) => setNewZoomId(e.target.value.replace(/[^\d]/g, ''))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D16F55] focus:border-transparent"
                                placeholder="Enter Zoom Meeting ID"
                            />
                        </div>
                        <div>
                            <label htmlFor="newZoomPassword" className="block text-sm font-medium text-gray-700 mb-2">Zoom Password</label>
                            <input
                                type="text"
                                id="newZoomPassword"
                                value={newZoomPassword}
                                onChange={(e) => setNewZoomPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D16F55] focus:border-transparent"
                                placeholder="Enter Zoom Password"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleZoomSubmit}
                        className="mt-4 bg-[#D16F55] text-white px-6 py-2 rounded-lg hover:bg-[#B85D47] transition-all duration-200 font-medium"
                    >
                        Save Zoom Settings
                    </button>
                    {zoomError && <p className="text-red-600 mt-2 text-sm bg-red-50 rounded-lg p-2">{zoomError}</p>}
                    {zoomSuccess && <p className="text-green-600 mt-2 text-sm bg-green-50 rounded-lg p-2">✅ Zoom settings saved successfully!</p>}
                    {definedZoomId && (
                        <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                            <strong>Current:</strong> Zoom ID: {definedZoomId} | Password: {definedZoomPassword}
                        </div>
                    )}
                </div>

                {/* Attendance Code Settings */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-md p-6 mb-6">
                    <h3 className="text-lg font-semibold text-[#D16F55] mb-4">Set Attendance Code for Specific Date</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="codeDate" className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                            <input
                                type="date"
                                id="codeDate"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D16F55] focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label htmlFor="newCode" className="block text-sm font-medium text-gray-700 mb-2">Attendance Code</label>
                            <input
                                type="text"
                                id="newCode"
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D16F55] focus:border-transparent font-mono"
                                placeholder={definedCode || "e.g., ABC123"}
                                maxLength={10}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleCodeSubmit}
                        className="mt-4 bg-[#D16F55] text-white px-6 py-2 rounded-lg hover:bg-[#B85D47] transition-all duration-200 font-medium"
                    >
                        Save Attendance Code
                    </button>
                    {codeError && <p className="text-red-600 mt-2 text-sm bg-red-50 rounded-lg p-2">{codeError}</p>}
                    {codeSuccess && <p className="text-green-600 mt-2 text-sm bg-green-50 rounded-lg p-2">✅ Attendance code saved successfully!</p>}
                    {definedCode && !newCode && (
                        <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                            <strong>Current code for {selectedDate}:</strong> <span className="font-mono font-bold text-[#D16F55]">{definedCode}</span>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-md p-6 mb-6">
                    <nav className="flex space-x-4" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`py-2 px-6 text-sm font-medium rounded-lg transition-all duration-200 ${
                                activeTab === 'current'
                                    ? 'bg-[#D16F55] text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Current Attendance Status
                        </button>
                        <button
                            onClick={() => setActiveTab('absentees')}
                            className={`py-2 px-6 text-sm font-medium rounded-lg transition-all duration-200 ${
                                activeTab === 'absentees'
                                    ? 'bg-[#A8B5A2] text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Long-term Absent Students (5+ Days)
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-md p-6">
                    {activeTab === 'current' && renderCurrentAttendanceTable()}
                    {activeTab === 'absentees' && renderAbsenteesTable()}
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;