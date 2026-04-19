import React, { useState, useEffect, useRef } from 'react';
import { Client, Databases, Query, ID } from 'appwrite';
import html2canvas from 'html2canvas-pro';

// Initialize Appwrite client
const client = new Client();
client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB4_ID = import.meta.env.VITE_DB4_ID;
const DB3_ID = import.meta.env.VITE_DB3_ID;
const REGISTRATIONS_COLLECTION_ID = import.meta.env.VITE_REGISTRATIONS_COLLECTION_ID;
const ZOOM_COLLECTION_ID = import.meta.env.VITE_ZOOM_COLLECTION_ID;

const COMPUTER_LEVELS = ['Beginner', 'Intermediate', 'Advance'];

function RegisterForm() {
    useEffect(() => {
        document.title = 'Register Form';
        return () => { document.title = 'Yan Linn Aung'; };
    }, []);

    // Form fields
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [telegramUsername, setTelegramUsername] = useState('');
    const [computerLevel, setComputerLevel] = useState('');
    const [otherLanguages, setOtherLanguages] = useState('');
    const [purpose, setPurpose] = useState('');

    // UI state
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [generatedId, setGeneratedId] = useState('');
    const [view, setView] = useState('form'); // 'form' or 'success'
    const [registeredData, setRegisteredData] = useState(null);
    const [zoomId, setZoomId] = useState('');
    const [zoomPassword, setZoomPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const cardRef = useRef(null);

    useEffect(() => {
        generateStudentId();
        fetchZoomDetails();
    }, []);

    const fetchZoomDetails = async () => {
        try {
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
                DB4_ID,
                REGISTRATIONS_COLLECTION_ID,
                [Query.orderDesc('studentId'), Query.limit(100)]
            );
            let nextNumber = 2001; // Start from WDF2001
            if (response.documents.length > 0) {
                const lastId = response.documents[0].studentId;
                const lastNumber = parseInt(lastId.replace('WDF', ''));
                if (lastNumber >= 2999) {
                    setError('Registration is currently full. Contact your class teacher or moderator.');
                    setGeneratedId('');
                    return;
                }
                nextNumber = lastNumber + 1;
            }
            setGeneratedId(`WDF${nextNumber}`);
            setError('');
        } catch (err) {
            setError('Failed to generate student ID. Please refresh the page.');
            setGeneratedId('');
            console.error('Error:', err.message);
        }
    };

    const validateStep1 = () => {
        const errors = {};
        if (!fullName.trim()) {
            errors.fullName = 'Full Name is required.';
        } else if (!/^[a-zA-Z\s]+$/.test(fullName.trim())) {
            errors.fullName = 'Full Name should only contain letters and spaces.';
        }
        if (!email.trim()) {
            errors.email = 'Email is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.email = 'Please enter a valid email address.';
        }
        if (!telegramUsername.trim()) {
            errors.telegramUsername = 'Telegram Username is required.';
        } else if (!/^[a-zA-Z0-9_]{5,}$/.test(telegramUsername.trim())) {
            errors.telegramUsername = 'Username must be at least 5 characters (letters, numbers, underscores). No "@" needed.';
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep2 = () => {
        const errors = {};
        if (!computerLevel) {
            errors.computerLevel = 'Please select your computer level.';
        }
        if (!purpose.trim()) {
            errors.purpose = 'Please describe your purpose of attendance.';
        } else if (purpose.trim().length < 10) {
            errors.purpose = 'Please provide at least 10 characters.';
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNextStep = () => {
        if (currentStep === 1 && validateStep1()) {
            setCurrentStep(2);
            setError('');
        }
    };

    const handlePrevStep = () => {
        setCurrentStep(1);
        setFieldErrors({});
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!validateStep2()) return;
        if (!generatedId) {
            setError('No student ID available. Please refresh and try again.');
            return;
        }

        setSubmitting(true);

        try {
            // Check if email is already registered
            const emailCheck = await databases.listDocuments(
                DB4_ID,
                REGISTRATIONS_COLLECTION_ID,
                [Query.equal('email', email.trim().toLowerCase())]
            );
            if (emailCheck.documents.length > 0) {
                setError('This email is already registered. Each email can only register once.');
                setSubmitting(false);
                setCurrentStep(1);
                return;
            }

            // Attempt to create with retry for ID conflicts
            const maxRetries = 5;
            let retries = 0;

            while (retries < maxRetries) {
                try {
                    await databases.createDocument(
                        DB4_ID,
                        REGISTRATIONS_COLLECTION_ID,
                        ID.unique(),
                        {
                            studentId: generatedId,
                            fullName: fullName.trim(),
                            email: email.trim().toLowerCase(),
                            telegramUsername: telegramUsername.trim(),
                            computerLevel: computerLevel,
                            otherLanguages: otherLanguages.trim() || 'None',
                            purpose: purpose.trim(),
                        }
                    );

                    setRegisteredData({
                        id: generatedId,
                        name: fullName.trim(),
                        email: email.trim().toLowerCase(),
                        zoomId: zoomId || 'Not set',
                        zoomPassword: zoomPassword || 'Not set',
                    });
                    setView('success');
                    // Reset form
                    setFullName('');
                    setEmail('');
                    setTelegramUsername('');
                    setComputerLevel('');
                    setOtherLanguages('');
                    setPurpose('');
                    setCurrentStep(1);
                    await generateStudentId();
                    setSubmitting(false);
                    return;
                } catch (err) {
                    if (err.code === 409) {
                        retries++;
                        console.warn(`Retry ${retries}/${maxRetries}: Duplicate ID ${generatedId}. Regenerating...`);
                        await generateStudentId();
                        if (!generatedId) {
                            setError('Failed to generate Student ID after retries. Please try again later.');
                            setSubmitting(false);
                            return;
                        }
                    } else {
                        throw err;
                    }
                }
            }

            setError('Too many concurrent registrations. Please wait a moment and try again.');
        } catch (err) {
            setError(`Registration failed: ${err.message}`);
            console.error('Error:', err);
        }

        setSubmitting(false);
    };

    const handleDownload = async () => {
        if (!registeredData || !cardRef.current) return;
        try {
            const canvas = await html2canvas(cardRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
            });
            canvas.toBlob((blob) => {
                if (!blob) throw new Error('Failed to create blob');
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
            console.error('Download failed:', err.message);
            alert('Download failed: ' + err.message);
        }
    };

    // ─── Success View ───
    if (view === 'success' && registeredData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-4">
                {/* Animated background blobs */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#D16F55]/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#B7A9CC]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                <div className="relative w-full max-w-lg">
                    <div ref={cardRef} className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl shadow-2xl p-8 border border-white/10 relative overflow-hidden">
                        {/* Decorative corner accents */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#D16F55]/20 to-transparent rounded-bl-full" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#B7A9CC]/20 to-transparent rounded-tr-full" />

                        {/* Header */}
                        <div className="text-center mb-8 relative z-10">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl mb-5 shadow-lg shadow-green-500/20">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-bold mb-2 text-white tracking-tight">
                                Registration Complete
                            </h2>
                            <p className="text-slate-400 text-sm">Welcome to Web Development Foundation</p>
                        </div>

                        {/* Info Cards */}
                        <div className="space-y-3 mb-8 relative z-10">
                            {[
                                { icon: 'id', label: 'Student ID', value: registeredData.id, color: 'blue' },
                                { icon: 'user', label: 'Full Name', value: registeredData.name, color: 'emerald' },
                                { icon: 'mail', label: 'Email', value: registeredData.email, color: 'violet' },
                                { icon: 'zoom', label: 'Zoom ID', value: registeredData.zoomId, color: 'sky' },
                                { icon: 'lock', label: 'Zoom Password', value: registeredData.zoomPassword, color: 'amber' },
                            ].map((item) => (
                                <div key={item.label} className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors duration-200">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 bg-${item.color}-500/20 rounded-xl flex items-center justify-center flex-shrink-0`}>
                                            {item.icon === 'id' && (
                                                <svg className={`w-5 h-5 text-${item.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                </svg>
                                            )}
                                            {item.icon === 'user' && (
                                                <svg className={`w-5 h-5 text-${item.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            )}
                                            {item.icon === 'mail' && (
                                                <svg className={`w-5 h-5 text-${item.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                            {item.icon === 'zoom' && (
                                                <svg className={`w-5 h-5 text-${item.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                            {item.icon === 'lock' && (
                                                <svg className={`w-5 h-5 text-${item.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">{item.label}</p>
                                            <p className="text-base font-semibold text-white truncate">{item.value}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Download Button (outside card ref so it doesn't appear in screenshot) */}
                    <button
                        onClick={handleDownload}
                        className="w-full mt-5 bg-gradient-to-r from-[#D16F55] to-[#B7A9CC] text-white py-4 rounded-2xl hover:from-[#B7A9CC] hover:to-[#D16F55] transition-all duration-300 font-semibold tracking-wide flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] text-base"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download Your Student Card
                    </button>
                    <button
                        onClick={() => setView('form')}
                        className="w-full mt-3 bg-white/5 border border-white/10 text-slate-300 py-3 rounded-2xl hover:bg-white/10 transition-all duration-200 font-medium text-sm"
                    >
                        Register Another Student
                    </button>
                </div>
            </div>
        );
    }

    // ─── Registration Form View ───
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-4">
            {/* Animated background blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#D16F55]/15 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#B7A9CC]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D16F55]/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-lg">
                {/* Glass card */}
                <div className="bg-gradient-to-br from-[#1e293b]/90 to-[#0f172a]/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/10 relative overflow-hidden">
                    {/* Decorative corners */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#D16F55]/10 to-transparent rounded-bl-full" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#B7A9CC]/10 to-transparent rounded-tr-full" />

                    {/* Header */}
                    <div className="text-center mb-8 relative z-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#D16F55] to-[#B7A9CC] rounded-2xl mb-4 shadow-lg shadow-[#D16F55]/20">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold mb-1 text-white tracking-tight">
                            Student Registration
                        </h2>
                        <p className="text-slate-400 text-sm">Web Development Foundation</p>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-3 mb-8 relative z-10">
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                                currentStep >= 1
                                    ? 'bg-gradient-to-br from-[#D16F55] to-[#B7A9CC] text-white shadow-lg shadow-[#D16F55]/30'
                                    : 'bg-white/10 text-slate-500'
                            }`}>1</div>
                            <span className={`text-xs font-medium ${currentStep >= 1 ? 'text-slate-300' : 'text-slate-600'}`}>Personal Info</span>
                        </div>
                        <div className={`w-12 h-0.5 rounded-full transition-all duration-500 ${
                            currentStep >= 2 ? 'bg-gradient-to-r from-[#D16F55] to-[#B7A9CC]' : 'bg-white/10'
                        }`} />
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                                currentStep >= 2
                                    ? 'bg-gradient-to-br from-[#D16F55] to-[#B7A9CC] text-white shadow-lg shadow-[#D16F55]/30'
                                    : 'bg-white/10 text-slate-500'
                            }`}>2</div>
                            <span className={`text-xs font-medium ${currentStep >= 2 ? 'text-slate-300' : 'text-slate-600'}`}>Details</span>
                        </div>
                    </div>

                    {/* Global Error */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-center relative z-10">
                            <p className="text-red-400 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="relative z-10">
                        {/* ─── Step 1: Personal Info ─── */}
                        {currentStep === 1 && (
                            <div className="space-y-5 animate-in">
                                {/* Full Name */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                        Full Name <span className="text-[#D16F55]">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className={`w-full pl-11 pr-4 py-3.5 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/50 focus:border-[#D16F55]/50 text-white placeholder-slate-500 transition-all duration-200 text-sm ${
                                                fieldErrors.fullName ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
                                            }`}
                                            placeholder="Enter your full name"
                                            autoComplete="off"
                                        />
                                    </div>
                                    {fieldErrors.fullName && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.fullName}</p>}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                        Email Address <span className="text-[#D16F55]">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className={`w-full pl-11 pr-4 py-3.5 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/50 focus:border-[#D16F55]/50 text-white placeholder-slate-500 transition-all duration-200 text-sm ${
                                                fieldErrors.email ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
                                            }`}
                                            placeholder="you@example.com"
                                            autoComplete="off"
                                        />
                                    </div>
                                    {fieldErrors.email && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.email}</p>}
                                    <p className="mt-1.5 text-[11px] text-slate-500">One email per registration only</p>
                                </div>

                                {/* Telegram Username */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                        Telegram Username <span className="text-[#D16F55]">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={telegramUsername}
                                            onChange={(e) => setTelegramUsername(e.target.value.replace(/^@/, ''))}
                                            className={`w-full pl-11 pr-4 py-3.5 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/50 focus:border-[#D16F55]/50 text-white placeholder-slate-500 transition-all duration-200 text-sm ${
                                                fieldErrors.telegramUsername ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
                                            }`}
                                            placeholder="username (without @)"
                                            autoComplete="off"
                                        />
                                    </div>
                                    {fieldErrors.telegramUsername && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.telegramUsername}</p>}
                                </div>

                                {/* Next Button */}
                                <button
                                    type="button"
                                    onClick={handleNextStep}
                                    className="w-full bg-gradient-to-r from-[#D16F55] to-[#B7A9CC] text-white py-4 rounded-xl hover:from-[#c4624b] hover:to-[#a899bb] transition-all duration-300 font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#D16F55]/20 hover:shadow-xl hover:shadow-[#D16F55]/30 transform hover:scale-[1.01] text-sm"
                                >
                                    Continue to Step 2
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            </div>
                        )}

                        {/* ─── Step 2: Details ─── */}
                        {currentStep === 2 && (
                            <div className="space-y-5 animate-in">
                                {/* Computer Level */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
                                        Computer Level <span className="text-[#D16F55]">*</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {COMPUTER_LEVELS.map((level) => (
                                            <button
                                                key={level}
                                                type="button"
                                                onClick={() => { setComputerLevel(level); setFieldErrors(prev => ({...prev, computerLevel: ''})); }}
                                                className={`py-3 px-2 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                                                    computerLevel === level
                                                        ? 'bg-gradient-to-br from-[#D16F55] to-[#B7A9CC] text-white border-transparent shadow-lg shadow-[#D16F55]/20'
                                                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                {level}
                                            </button>
                                        ))}
                                    </div>
                                    {fieldErrors.computerLevel && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.computerLevel}</p>}
                                </div>

                                {/* Other Programming Languages */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                        Other Programming Languages
                                        <span className="text-slate-600 normal-case tracking-normal font-normal ml-1">(Optional)</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={otherLanguages}
                                            onChange={(e) => setOtherLanguages(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/50 focus:border-[#D16F55]/50 text-white placeholder-slate-500 transition-all duration-200 text-sm"
                                            placeholder="e.g., Python, Java, C++"
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                {/* Purpose of Attendance */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                                        Purpose of Attendance <span className="text-[#D16F55]">*</span>
                                    </label>
                                    <textarea
                                        value={purpose}
                                        onChange={(e) => setPurpose(e.target.value)}
                                        rows={3}
                                        className={`w-full px-4 py-3.5 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/50 focus:border-[#D16F55]/50 text-white placeholder-slate-500 transition-all duration-200 text-sm resize-none ${
                                            fieldErrors.purpose ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
                                        }`}
                                        placeholder="Why do you want to attend this class?"
                                    />
                                    {fieldErrors.purpose && <p className="mt-1.5 text-xs text-red-400">{fieldErrors.purpose}</p>}
                                    <p className="mt-1 text-[11px] text-slate-500 text-right">{purpose.length} / 10 min characters</p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handlePrevStep}
                                        className="flex-1 bg-white/5 border border-white/10 text-slate-300 py-4 rounded-xl hover:bg-white/10 transition-all duration-200 font-semibold text-sm flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                        </svg>
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || !generatedId}
                                        className="flex-[2] bg-gradient-to-r from-[#D16F55] to-[#B7A9CC] text-white py-4 rounded-xl hover:from-[#c4624b] hover:to-[#a899bb] transition-all duration-300 font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#D16F55]/20 hover:shadow-xl hover:shadow-[#D16F55]/30 transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
                                    >
                                        {submitting ? (
                                            <>
                                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Registering...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                                Register Now
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>

                    {/* Footer */}
                    <div className="mt-6 text-center relative z-10">
                        <p className="text-[11px] text-slate-600">
                            By registering, you agree to attend the class regularly.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegisterForm;
