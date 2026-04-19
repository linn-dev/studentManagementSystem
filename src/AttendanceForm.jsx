import React, { useEffect, useState } from 'react';
import { Client, Databases, Query } from 'appwrite';

// Initialize Appwrite client
const client = new Client();
client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB4_ID = import.meta.env.VITE_DB4_ID; // New registration database
const DB2_ID = import.meta.env.VITE_DB2_ID; // Attendance database
const REGISTRATIONS_COLLECTION_ID = import.meta.env.VITE_REGISTRATIONS_COLLECTION_ID; // New registrations collection
const ATTENDANCE_COLLECTION_ID = import.meta.env.VITE_ATTENDANCE_COLLECTION_ID;

function AttendanceForm() {

    useEffect(() => {
        document.title = 'Attendance Form';
        return () => { document.title = 'Yan Linn Aung'; };
    }, []);

    const [studentId, setStudentId] = useState('');
    const [attendanceCode, setAttendanceCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleStudentIdChange = (e) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setStudentId(value);
    };

    const handleAttendanceCodeChange = (e) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setAttendanceCode(value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!studentId) {
            setError('Student ID is required.');
            return;
        }
        if (!/^WDF[12][0-9]{3}$/.test(studentId)) {
            setError('Student ID must be in format WDF1XXX or WDF2XXX (e.g., WDF1001, WDF2001).');
            return;
        }
        if (!attendanceCode || !/^[A-Z0-9]+$/.test(attendanceCode)) {
            setError('Attendance Code must consist of uppercase letters and numbers only.');
            return;
        }

        setSubmitting(true);

        try {
            // 1. Validate studentId exists in registration database
            const studentResponse = await databases.listDocuments(
                DB4_ID,
                REGISTRATIONS_COLLECTION_ID,
                [Query.equal('studentId', studentId)]
            );
            if (studentResponse.documents.length === 0) {
                setError('Invalid Student ID. Please register first.');
                setSubmitting(false);
                return;
            }
            const student = studentResponse.documents[0];

            // 2. Generate predictable document ID for today (Option B - Overwrite logic)
            // Get today's date in local YYYY-MM-DD format
            const today = new Date();
            const offset = today.getTimezoneOffset();
            const todayStr = new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
            
            // Format: WDF2001_2026-04-18
            const docId = `${studentId}_${todayStr}`;

            try {
                // Try to create a new attendance record
                await databases.createDocument(
                    DB2_ID,
                    ATTENDANCE_COLLECTION_ID,
                    docId, // Use specific ID instead of ID.unique()
                    {
                        studentId,
                        studentName: student.fullName || student.studentName,
                        attendanceCode,
                    }
                );
            } catch (createErr) {
                // If it fails because the document already exists (409 Conflict)
                if (createErr.code === 409) {
                    // Overwrite the existing attendance code
                    await databases.updateDocument(
                        DB2_ID,
                        ATTENDANCE_COLLECTION_ID,
                        docId,
                        {
                            attendanceCode
                        }
                    );
                } else {
                    throw createErr; // If it's a different error, throw it so it gets caught below
                }
            }

            setSuccess(true);
            setStudentId('');
            setAttendanceCode('');
        } catch (err) {
            setError('Failed to submit attendance. Please check your connection and try again.');
            console.error('Error:', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-4">
            {/* Animated background blobs matching RegisterForm */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#D16F55]/15 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#B7A9CC]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D16F55]/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Glass card container */}
                <div className="bg-gradient-to-br from-[#1e293b]/90 to-[#0f172a]/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/10 relative overflow-hidden">
                    {/* Decorative corners */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#D16F55]/10 to-transparent rounded-bl-full" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#B7A9CC]/10 to-transparent rounded-tr-full" />

                    <div className="relative z-10">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#D16F55] to-[#B7A9CC] rounded-2xl mb-4 shadow-lg shadow-[#D16F55]/20">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold mb-2 text-white tracking-tight">
                                Mark Attendance
                            </h2>
                            <p className="text-slate-400 text-sm">Quick and secure submission</p>
                        </div>

                        {/* Status Messages */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
                                <p className="text-red-400 text-sm font-medium">{error}</p>
                            </div>
                        )}
                        {success && (
                            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
                                <p className="text-emerald-400 text-sm font-medium">Attendance submitted successfully!</p>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Student ID */}
                            <div>
                                <label htmlFor="studentId" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                    Student ID <span className="text-[#D16F55]">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        id="studentId"
                                        value={studentId}
                                        onChange={handleStudentIdChange}
                                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/50 focus:border-[#D16F55]/50 text-white placeholder-slate-500 transition-all duration-200 text-lg tracking-wide uppercase"
                                        placeholder="WDF2001"
                                        maxLength={7}
                                    />
                                </div>
                            </div>

                            {/* Attendance Code */}
                            <div>
                                <label htmlFor="attendanceCode" className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                    Attendance Code <span className="text-[#D16F55]">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        id="attendanceCode"
                                        value={attendanceCode}
                                        onChange={handleAttendanceCodeChange}
                                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/50 focus:border-[#D16F55]/50 text-white placeholder-slate-500 transition-all duration-200 text-lg tracking-widest uppercase font-mono"
                                        placeholder="CODE123"
                                        maxLength={10}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full mt-2 bg-gradient-to-r from-[#D16F55] to-[#B7A9CC] text-white py-4 rounded-xl hover:from-[#c4624b] hover:to-[#a899bb] transition-all duration-300 font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#D16F55]/20 hover:shadow-xl hover:shadow-[#D16F55]/30 transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-base"
                            >
                                {submitting ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Submit Attendance
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AttendanceForm;
