// Updated AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Client, Databases, Query, ID } from 'appwrite';
import { format, subDays, isSameDay, parseISO } from 'date-fns';

// Initialize Appwrite client
const client = new Client();
client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB1_ID = import.meta.env.VITE_DB1_ID; // Moved to env for security
const DB2_ID = import.meta.env.VITE_DB2_ID; // Moved to env for security
const DB3_ID = import.meta.env.VITE_DB3_ID; // Moved to env for security
const STUDENTS_COLLECTION_ID = import.meta.env.VITE_STUDENTS_COLLECTION_ID; // Moved to env for security
const ATTENDANCE_COLLECTION_ID = import.meta.env.VITE_ATTENDANCE_COLLECTION_ID; // Moved to env for security
const CODE_COLLECTION_ID = import.meta.env.VITE_CODE_COLLECTION_ID; // Moved to env for security
const ZOOM_COLLECTION_ID = import.meta.env.VITE_ZOOM_COLLECTION_ID; // New: Global Zoom config collection

// Simple Admin Auth (hardcoded for now; add VITE_ADMIN_USERNAME and VITE_ADMIN_PASSWORD to .env for env vars)
const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME; // Or import.meta.env.VITE_ADMIN_USERNAME
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;// Or import.meta.env.VITE_ADMIN_PASSWORD

function AdminDashboard() {

    useEffect(() => {
        document.title = 'Admin Dashboard';
        // Cleanup on unmount (optional)
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
    const [allCodeDates, setAllCodeDates] = useState([]); // New: Store all historical code dates
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('current');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [definedCode, setDefinedCode] = useState('');
    const [definedZoomId, setDefinedZoomId] = useState('');
    const [definedZoomPassword, setDefinedZoomPassword] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newZoomId, setNewZoomId] = useState(''); // Pre-filled with current on load
    const [newZoomPassword, setNewZoomPassword] = useState(''); // Pre-filled with current on load
    const [codeError, setCodeError] = useState('');
    const [zoomError, setZoomError] = useState('');
    const [codeSuccess, setCodeSuccess] = useState(false);
    const [zoomSuccess, setZoomSuccess] = useState(false);

    // Check localStorage for auth on mount
    useEffect(() => {
        const savedAuth = localStorage.getItem('adminAuth');
        if (savedAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        setLoginError('');
        if (loginUsername === ADMIN_USERNAME && loginPassword === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            localStorage.setItem('adminAuth', 'true');
        } else {
            setLoginError('Invalid credentials.');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        localStorage.removeItem('adminAuth');
        setLoginUsername('');
        setLoginPassword('');
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchStudents();
        fetchAttendanceData();
        fetchAllCodeDates(); // New: Fetch all historical codes
        fetchDefinedCode(selectedDate);
        fetchGlobalZoom(); // Separate fetch for global Zoom
    }, [isAuthenticated]);

    // New: Fetch all code dates for long-term absentee calculation
    const fetchAllCodeDates = async () => {
        try {
            const response = await databases.listDocuments(
                DB3_ID,
                CODE_COLLECTION_ID,
                [Query.orderDesc('date')]
            );
            const codeDates = response.documents.map(doc => ({
                date: doc.date,
                code: doc.code,
                dateObj: parseISO(doc.date)
            }));
            setAllCodeDates(codeDates);
        } catch (err) {
            console.error('Error fetching code dates:', err);
        }
    };

    useEffect(() => {
        if (!isAuthenticated || allCodeDates.length === 0) return;
        fetchDefinedCode(selectedDate);
    }, [selectedDate, allCodeDates]);

    const fetchStudents = async () => {
        try {
            const response = await databases.listDocuments(
                DB1_ID,
                STUDENTS_COLLECTION_ID,
                [Query.orderAsc('studentId')]
            );
            setStudents(response.documents);
        } catch (err) {
            console.error('Error fetching students:', err);
        }
    };

    const fetchAttendanceData = async () => {
        try {
            const response = await databases.listDocuments(
                DB2_ID,
                ATTENDANCE_COLLECTION_ID,
                [Query.orderDesc('$createdAt')]
            );
            const records = response.documents.map(doc => ({
                id: doc.$id,
                studentId: doc.studentId,
                studentName: doc.studentName,
                attendanceCode: doc.attendanceCode,
                createdAt: parseISO(doc.$createdAt)
            }));
            setAttendanceData(records);
        } catch (err) {
            console.error('Error fetching attendance:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDefinedCode = async (date) => {
        const codeDate = allCodeDates.find(cd => cd.date === date);
        if (codeDate) {
            setDefinedCode(codeDate.code || '');
        } else {
            setDefinedCode('');
        }
    };

    const fetchGlobalZoom = async () => {
        try {
            const response = await databases.listDocuments(
                DB3_ID,
                ZOOM_COLLECTION_ID,
                [Query.equal('$id', 'global_zoom')]
            );
            if (response.documents.length > 0) {
                const doc = response.documents[0];
                const zoomId = doc.zoomId || '';
                const zoomPassword = doc.zoomPassword || '';
                setDefinedZoomId(zoomId);
                setDefinedZoomPassword(zoomPassword);
                // Pre-fill inputs with current values for easy editing
                setNewZoomId(zoomId);
                setNewZoomPassword(zoomPassword);
            } else {
                setDefinedZoomId('');
                setDefinedZoomPassword('');
                setNewZoomId('');
                setNewZoomPassword('');
            }
        } catch (err) {
            console.error('Error fetching global Zoom:', err);
        }
    };

    const handleCodeSubmit = async (e) => {
        e.preventDefault();
        setCodeError('');
        setCodeSuccess(false);

        if (!newCode || !/^[A-Z0-9]+$/.test(newCode)) {
            setCodeError('Code must consist of uppercase letters and numbers only.');
            return;
        }

        try {
            const existing = await databases.listDocuments(
                DB3_ID,
                CODE_COLLECTION_ID,
                [Query.equal('date', selectedDate)]
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
            // Refresh all code dates after save
            await fetchAllCodeDates();
            setNewCode('');
            setCodeSuccess(true);
        } catch (err) {
            setCodeError('Failed to save code.');
            console.error('Error:', err.message);
        }
    };

    const handleZoomSubmit = async (e) => {
        e.preventDefault();
        setZoomError('');
        setZoomSuccess(false);

        // Allow partial updates: Use current values if not changed
        const finalZoomId = newZoomId || definedZoomId;
        const finalZoomPassword = newZoomPassword || definedZoomPassword;

        if (!finalZoomId || !/^\d+$/.test(finalZoomId)) {
            setZoomError('Zoom ID must be numbers only.');
            return;
        }
        if (!finalZoomPassword || finalZoomPassword.length < 6) {
            setZoomError('Zoom Password must be at least 6 characters.');
            return;
        }

        // Check if anything changed
        if (finalZoomId === definedZoomId && finalZoomPassword === definedZoomPassword) {
            setZoomError('No changes detected. Enter new values to update.');
            return;
        }

        try {
            const existing = await databases.listDocuments(
                DB3_ID,
                ZOOM_COLLECTION_ID,
                [Query.equal('$id', 'global_zoom')]
            );
            if (existing.documents.length > 0) {
                await databases.updateDocument(
                    DB3_ID,
                    ZOOM_COLLECTION_ID,
                    'global_zoom',
                    {
                        zoomId: finalZoomId,
                        zoomPassword: finalZoomPassword
                    }
                );
            } else {
                await databases.createDocument(
                    DB3_ID,
                    ZOOM_COLLECTION_ID,
                    'global_zoom',
                    {
                        zoomId: finalZoomId,
                        zoomPassword: finalZoomPassword
                    }
                );
            }
            setDefinedZoomId(finalZoomId);
            setDefinedZoomPassword(finalZoomPassword);
            // Keep inputs filled for further edits
            setNewZoomId(finalZoomId);
            setNewZoomPassword(finalZoomPassword);
            setZoomSuccess(true);
        } catch (err) {
            setZoomError('Failed to save Zoom details.');
            console.error('Error:', err.message);
        }
    };

    const getAttendanceStatus = (studentId, date, code) => {
        if (!code) {
            return { status: null, code: '-' }; // No code defined, neutral status
        }
        const selectedDateObj = parseISO(date);
        const studentRecords = attendanceData.filter(
            record => record.studentId === studentId && isSameDay(record.createdAt, selectedDateObj)
        );
        if (studentRecords.length === 0) {
            return { status: 'absent-without-inform', code: '-' };
        }
        const latestRecord = studentRecords[0];
        return {
            status: latestRecord.attendanceCode === code ? 'present' : 'absent-informed',
            code: latestRecord.attendanceCode
        };
    };

    const getLongTermAbsentees = () => {
        const absentees = [];
        students.forEach((student) => {
            let absentClassDays = 0;
            // Start from the most recent class day and go backwards through code-defined days
            for (let i = 0; i < allCodeDates.length && absentClassDays < 5; i++) {
                const classDay = allCodeDates[i].dateObj;
                const records = attendanceData.filter(
                    record => record.studentId === student.studentId && isSameDay(record.createdAt, classDay)
                );
                if (records.length === 0) {
                    absentClassDays++;
                } else {
                    break; // Stop on first attendance found
                }
            }
            if (absentClassDays > 4) {
                const lastAtt = attendanceData
                    .filter(record => record.studentId === student.studentId)
                    .sort((a, b) => b.createdAt - a.createdAt)[0]?.createdAt;
                absentees.push({ ...student, absentClassDays, lastAttendance: lastAtt });
            }
        });
        return absentees;
    };

    const renderCurrentAttendanceTable = () => {
        if (!definedCode) {
            return (
                <div className="text-center py-8">
                    <p className="text-gray-500 text-lg">No attendance code defined for {selectedDate}. Please set a code to view attendance status.</p>
                </div>
            );
        }
        return (
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg shadow-md">
                    <thead className="bg-[#D16F55] text-white">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Student ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Telegram</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Submitted Code</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {students.map((student) => {
                        const { status, code } = getAttendanceStatus(student.studentId, selectedDate, definedCode);
                        if (status === null) return null; // Skip if no code defined (handled above)
                        const statusStyles = {
                            'present': 'bg-green-100 text-green-800',
                            'absent-informed': 'bg-orange-100 text-orange-800',
                            'absent-without-inform': 'bg-red-100 text-red-800'
                        };
                        const statusText = {
                            'present': 'Present',
                            'absent-informed': 'Absent (Informed)',
                            'absent-without-inform': 'Absent (No Inform)'
                        };
                        return (
                            <tr key={student.studentId} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">{student.studentId}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{student.studentName}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{student.telegramUsername || '-'}</td>
                                <td className={`px-6 py-4 whitespace-nowrap ${statusStyles[status]}`}>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        status === 'present' ? 'bg-green-200 text-green-800' :
                            status === 'absent-informed' ? 'bg-orange-200 text-orange-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {statusText[status]}
                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{code}</td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderAbsenteesTable = () => {
        const absentees = getLongTermAbsentees();
        return (
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg shadow-md">
                    <thead className="bg-[#A8B5A2] text-white">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Student ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Telegram</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Consecutive Absent Class Days</th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Last Attendance</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {absentees.map((student) => (
                        <tr key={student.studentId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-[#D16F55]">{student.studentId}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{student.studentName}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{student.telegramUsername || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D16F55]">{student.absentClassDays} days</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {student.lastAttendance ? format(student.lastAttendance, 'MMM dd, yyyy') : 'Never'}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                {absentees.length === 0 && (
                    <p className="text-center py-8 text-gray-500">No students absent for more than 4 class days.</p>
                )}
            </div>
        );
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#F5E8C7] to-[#B7A9CC] flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-6 text-center text-[#D16F55]">Admin Login</h2>
                    {loginError && <p className="text-[#B91C1C] mb-4 text-center text-sm">{loginError}</p>}
                    <form onSubmit={handleLogin}>
                        <div className="mb-4">
                            <label htmlFor="username" className="block text-sm font-medium text-[#A8B5A2] mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={loginUsername}
                                onChange={(e) => setLoginUsername(e.target.value)}
                                className="w-full px-4 py-2 border border-[#A8B5A2]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55]"
                                placeholder="admin"
                            />
                        </div>
                        <div className="mb-6">
                            <label htmlFor="password" className="block text-sm font-medium text-[#A8B5A2] mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-[#A8B5A2]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55]"
                                placeholder="Enter password"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-[#D16F55] text-white py-2 rounded-lg hover:bg-[#B7A9CC] transition-all duration-200"
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
            <div className="min-h-screen bg-gradient-to-br from-[#F5E8C7] to-[#B7A9CC] flex items-center justify-center">
                <div className="text-[#A8B5A2] text-xl">Loading dashboard...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#F5E8C7] to-[#B7A9CC]">
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-[#D16F55]">Admin Attendance Dashboard</h1>
                    <button
                        onClick={handleLogout}
                        className="bg-red-900 text-white px-4 py-2 rounded-lg hover:bg-red-950 transition-all duration-200"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Global Zoom Settings Section */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <h3 className="text-lg font-semibold text-[#D16F55] mb-4">Zoom Settings</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="newZoomId" className="block text-sm font-medium text-[#A8B5A2] mb-2">
                                Zoom ID
                            </label>
                            <input
                                type="text"
                                id="newZoomId"
                                value={newZoomId}
                                onChange={(e) => setNewZoomId(e.target.value.replace(/[^\d]/g, ''))}
                                className="w-full px-4 py-2 border border-[#A8B5A2]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55] bg-[#F5E8C7]/20"
                                placeholder="Zoom ID"
                            />
                        </div>
                        <div>
                            <label htmlFor="newZoomPassword" className="block text-sm font-medium text-[#A8B5A2] mb-2">
                                Zoom Password
                            </label>
                            <input
                                type="password"
                                id="newZoomPassword"
                                value={newZoomPassword}
                                onChange={(e) => setNewZoomPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-[#A8B5A2]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55] bg-[#F5E8C7]/20"
                                placeholder="Zoom Password"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleZoomSubmit}
                        className="mt-4 bg-[#A8B5A2] text-white px-6 py-2 rounded-lg hover:bg-[#D16F55] transition-all duration-200"
                    >
                        Save Zoom Details
                    </button>
                    {zoomError && <p className="text-[#B91C1C] mt-2 text-sm">{zoomError}</p>}
                    {zoomSuccess && (
                        <p className="text-[#A8B5A2] mt-2 text-sm">Zoom details saved successfully!</p>
                    )}
                    {definedZoomId && (
                        <p className="text-[#A8B5A2] mt-2 text-sm">Current: Zoom ID={definedZoomId}, Password={definedZoomPassword}</p>
                    )}
                </div>

                {/* Date-Specific Attendance Code Section */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <h3 className="text-lg font-semibold text-[#D16F55] mb-4">Date-Specific Attendance Code</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="selectedDate" className="block text-sm font-medium text-[#A8B5A2] mb-2">
                                Select Date
                            </label>
                            <input
                                type="date"
                                id="selectedDate"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full px-4 py-2 border border-[#A8B5A2]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55] bg-[#F5E8C7]/20"
                            />
                        </div>
                        <div>
                            <label htmlFor="newCode" className="block text-sm font-medium text-[#A8B5A2] mb-2">
                                Attendance Code
                            </label>
                            <input
                                type="text"
                                id="newCode"
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                className="w-full px-4 py-2 border border-[#A8B5A2]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55] bg-[#F5E8C7]/20"
                                placeholder={definedCode || "e.g., 13HH"}
                                maxLength={10}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleCodeSubmit}
                        className="mt-4 bg-[#D16F55] text-white px-6 py-2 rounded-lg hover:bg-[#B7A9CC] transition-all duration-200"
                    >
                        Save Code
                    </button>
                    {codeError && <p className="text-[#B91C1C] mt-2 text-sm">{codeError}</p>}
                    {codeSuccess && (
                        <p className="text-[#A8B5A2] mt-2 text-sm">Code saved successfully!</p>
                    )}
                    {definedCode && !newCode && (
                        <p className="text-[#A8B5A2] mt-2 text-sm">Current code for {selectedDate}: {definedCode}</p>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <nav className="flex space-x-8" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'current'
                                    ? 'bg-[#D16F55] text-white'
                                    : 'text-[#A8B5A2] hover:text-[#D16F55]'
                            }`}
                        >
                            Current Attendance Status
                        </button>
                        <button
                            onClick={() => setActiveTab('absentees')}
                            className={`py-2 px-4 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'absentees'
                                    ? 'bg-[#A8B5A2] text-white'
                                    : 'text-[#A8B5A2] hover:text-[#D16F55]'
                            }`}
                        >
                            Long-term Absent (Over 4 class days)
                        </button>
                    </nav>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6">
                    {activeTab === 'current' && renderCurrentAttendanceTable()}
                    {activeTab === 'absentees' && renderAbsenteesTable()}
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;