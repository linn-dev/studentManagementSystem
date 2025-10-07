// Updated RegisterForm.jsx (fetches global Zoom, no date dependency)
import React, { useState, useEffect, useRef } from 'react';
import { Client, Databases, Query, ID } from 'appwrite';
import html2canvas from 'html2canvas-pro'; // Changed to html2canvas-pro for better support of modern CSS colors like oklch

// Initialize Appwrite client
const client = new Client();
client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB1_ID = import.meta.env.VITE_DB1_ID; // Moved to env for security
const DB3_ID = import.meta.env.VITE_DB3_ID; // Moved to env for security
const STUDENTS_COLLECTION_ID = import.meta.env.VITE_STUDENTS_COLLECTION_ID; // Moved to env for security
const ZOOM_COLLECTION_ID = import.meta.env.VITE_ZOOM_COLLECTION_ID; // New: Global Zoom config collection
const CODE_COLLECTION_ID = import.meta.env.VITE_CODE_COLLECTION_ID; // Moved to env for security

function RegisterForm() {

    useEffect(() => {
        document.title = 'Register Form';
        // Cleanup on unmount (optional)
        return () => {
            document.title = 'Yan Linn Aung';
        };
    }, []);

    const [studentName, setStudentName] = useState('');
    const [telegramUsername, setTelegramUsername] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [generatedId, setGeneratedId] = useState('');
    const [view, setView] = useState('form'); // 'form' or 'success'
    const [registeredData, setRegisteredData] = useState(null);
    const [zoomId, setZoomId] = useState(''); // Fetched from global Zoom config
    const [zoomPassword, setZoomPassword] = useState(''); // Fetched from global Zoom config
    const cardRef = useRef(null);

    useEffect(() => {
        generateStudentId();
        fetchZoomDetails(); // Fetch global Zoom details on load (no date)
    }, []);

    const fetchZoomDetails = async () => {
        try {
            // Fetch from global Zoom config collection (fixed document ID)
            const response = await databases.listDocuments(
                DB3_ID,
                ZOOM_COLLECTION_ID,
                [Query.equal('$id', 'global_zoom')]
            );
            if (response.documents.length > 0) {
                const doc = response.documents[0];
                setZoomId(doc.zoomId || '');
                setZoomPassword(doc.zoomPassword || '');
            }
        } catch (err) {
            console.error('Error fetching Zoom details:', err);
        }
    };

    const generateStudentId = async () => {
        try {
            const response = await databases.listDocuments(
                DB1_ID,
                STUDENTS_COLLECTION_ID,
                [Query.orderDesc('studentId'), Query.limit(100)]
            );
            let nextNumber = 1001;
            if (response.documents.length > 0) {
                const lastId = response.documents[0].studentId; // e.g., WDF1005
                const lastNumber = parseInt(lastId.replace('WDF', '')); // e.g., 1005
                if (lastNumber >= 1999) {
                    setError('Contact your class teacher or moderator!');
                    setGeneratedId('');
                    return;
                }
                nextNumber = lastNumber + 1;
            }
            setGeneratedId(`WDF${nextNumber.toString().padStart(3, '0')}`);
            setError(''); // Clear any prior errors on regen
        } catch (err) {
            setError('Failed to generate student ID.');
            setGeneratedId('');
            console.error('Error:', err.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!studentName.trim()) {
            setError('Student Name is required.');
            return;
        }
        if (!/^[a-zA-Z\s]+$/.test(studentName.trim())) {
            setError('Student Name should only contain letters and spaces.');
            return;
        }
        if (!telegramUsername.trim()) {
            setError('Telegram Username is required.');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(telegramUsername.trim())) {
            setError('Telegram Username should only contain letters, numbers, or underscores & don\'t need "@" Sign');
            return;
        }
        if (!generatedId) {
            setError('No student ID available. Please refresh and try again.');
            return;
        }

        const maxRetries = 5;
        let retries = 0;
        let lastError = '';

        while (retries < maxRetries) {
            try {
                await databases.createDocument(
                    DB1_ID,
                    STUDENTS_COLLECTION_ID,
                    ID.unique(),
                    {
                        studentId: generatedId,
                        studentName: studentName.trim(),
                        telegramUsername: telegramUsername.trim() || null,
                    }
                );
                // Capture data before clearing, using fetched global Zoom details
                setRegisteredData({
                    id: generatedId,
                    name: studentName.trim(),
                    zoomId: zoomId || 'Not set',
                    zoomPassword: zoomPassword || 'Not set'
                });
                setView('success');
                setStudentName('');
                setTelegramUsername('');
                await generateStudentId(); // Regen for next user
                return; // Success, exit loop
            } catch (err) {
                if (err.code === 409) { // Conflict: Duplicate studentId
                    retries++;
                    console.warn(`Retry ${retries}/${maxRetries}: Duplicate ID ${generatedId} detected. Regenerating...`);
                    await generateStudentId(); // Get next ID
                    if (!generatedId) {
                        setError('Failed to generate Student ID after retries. Please try again later.');
                        return;
                    }
                } else {
                    lastError = `Failed to register: ${err.message}`;
                    break; // Non-duplicate error, bail out
                }
            }
        }

        if (retries >= maxRetries) {
            setError('Too many concurrent registrations. Please wait a moment and try again.');
        } else {
            setError(lastError);
        }
    };

    const handleDownload = async () => {
        if (!registeredData || !cardRef.current) return;

        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: '#ffffff',
                scale: 2, // Restored to 2 for better quality, as pro version should handle it
                useCORS: true,
                allowTaint: true,
                logging: true // Enable logging for debugging
            });

            canvas.toBlob((blob) => {
                if (!blob) {
                    throw new Error('Failed to create blob');
                }
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `StudentCard_${registeredData.id}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 'image/jpeg', 0.95);

        } catch (err) {
            console.error('Download failed:', err.message, err.stack);
            alert('Download failed: ' + err.message);
        }
    };

    if (view === 'success' && registeredData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5E8C7] to-[#B7A9CC] p-4">
                <div ref={cardRef} className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all duration-500 hover:shadow-3xl border border-gray-100 relative overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#D16F55]/10 rounded-full -mr-16 -mt-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#B7A9CC]/10 rounded-full -ml-12 -mb-16"></div>

                    {/* Header */}
                    <div className="text-center mb-8 relative z-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-[#D16F55] rounded-full mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold mb-2 text-gray-800 tracking-tight">
                            Successfully Registered
                        </h2>
                        <p className="text-[#A8B5A2] text-sm">Welcome to Web Development Foundation!</p>
                    </div>

                    {/* Body - Info Cards */}
                    <div className="space-y-4 mb-8 relative z-10">
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Student ID</p>
                                    <p className="text-lg font-semibold text-gray-900">{registeredData.id}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Full Name</p>
                                    <p className="text-lg font-semibold text-gray-900">{registeredData.name}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Zoom ID</p>
                                    <p className="text-lg font-semibold text-gray-900">{registeredData.zoomId}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Zoom Password</p>
                                    <p className="text-lg font-semibold text-gray-900">{registeredData.zoomPassword}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="relative z-10">
                        <button
                            onClick={handleDownload}
                            className="w-full bg-gradient-to-r from-[#D16F55] to-[#B7A9CC] text-white py-4 rounded-2xl hover:from-[#B7A9CC] hover:to-[#D16F55] transition-all duration-300 font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download Your Student ID
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5E8C7] to-[#B7A9CC] p-4">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all duration-500 hover:shadow-3xl border border-gray-100 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D16F55]/10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#B7A9CC]/10 rounded-full -ml-12 -mb-16"></div>

                {/* Header */}
                <div className="text-center mb-8 relative z-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#D16F55] rounded-full mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold mb-2 text-gray-800 tracking-tight">
                        Student Registration
                    </h2>
                    <p className="text-[#A8B5A2] text-sm">Web Development Foundation</p>
                </div>

                {error && <p className="text-[#B91C1C] mb-6 text-center text-sm font-medium bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
                {success && (
                    <p className="text-[#A8B5A2] mb-6 text-center text-sm font-medium bg-green-50 border border-green-200 rounded-xl p-3">
                        Successfully registered! Your Student ID is <strong>{generatedId}</strong>.
                    </p>
                )}

                <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
                    {/* Full Name Input Card */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 shadow-sm">
                        <label className="block text-sm font-medium text-[#A8B5A2] mb-2">
                            Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            className="w-full px-4 py-3 border border-[#A8B5A2]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55] bg-[#F5E8C7]/20 text-gray-800 placeholder-gray-400 transition-all duration-200"
                            placeholder="Full name"
                            autoComplete="off"
                        />
                    </div>

                    {/* Telegram Username Input Card */}
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 shadow-sm">
                        <label className="block text-sm font-medium text-[#A8B5A2] mb-2">
                            Telegram Username <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={telegramUsername}
                            onChange={(e) => setTelegramUsername(e.target.value)}
                            className="w-full px-4 py-3 border border-[#A8B5A2]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D16F55] bg-[#F5E8C7]/20 text-gray-800 placeholder-gray-400 transition-all duration-200"
                            placeholder="@username"
                            autoComplete="off"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-[#D16F55] to-[#B7A9CC] text-white py-4 rounded-2xl hover:from-[#B7A9CC] hover:to-[#D16F55] transition-all duration-300 font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!generatedId || success}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        {success ? 'Registered!' : 'Register'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default RegisterForm;