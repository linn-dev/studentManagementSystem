import React, {useEffect, useState} from 'react';
import { Client, Databases, Query, ID } from 'appwrite';

// Initialize Appwrite client
const client = new Client();
client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const DB1_ID = import.meta.env.VITE_DB1_ID; // Moved to env for security
const DB2_ID = import.meta.env.VITE_DB2_ID; // Moved to env for security
const STUDENTS_COLLECTION_ID = import.meta.env.VITE_STUDENTS_COLLECTION_ID; // Moved to env for security
const ATTENDANCE_COLLECTION_ID = import.meta.env.VITE_ATTENDANCE_COLLECTION_ID; // Moved to env for security

function AttendanceForm() {

  useEffect(() => {
    document.title = 'Attendance Form';
    // Cleanup on unmount (optional)
    return () => {
      document.title = 'Yan Linn Aung';
    };
  }, []);

  const [studentId, setStudentId] = useState('');
  const [attendanceCode, setAttendanceCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
    if (!/^WDF[1][0-9]{3}$/.test(studentId)) {
      setError('Student ID must be in format WDF1XXX (e.g., WDF1000 to WDF1999).');
      return;
    }
    if (!attendanceCode || !/^[A-Z0-9]+$/.test(attendanceCode)) {
      setError('Attendance Code must consist of uppercase letters and numbers only.');
      return;
    }

    try {
      // Validate studentId exists in db1.students
      const studentResponse = await databases.listDocuments(
          DB1_ID,
          STUDENTS_COLLECTION_ID,
          [Query.equal('studentId', studentId)]
      );
      if (studentResponse.documents.length === 0) {
        setError('Invalid Student ID. Please register first.');
        return;
      }
      const student = studentResponse.documents[0];

      await databases.createDocument(
          DB2_ID,
          ATTENDANCE_COLLECTION_ID,
          ID.unique(),
          {
            studentId,
            studentName: student.studentName,
            attendanceCode,
          }
      );
      setSuccess(true);
      setStudentId('');
      setAttendanceCode('');
    } catch (err) {
      setError('Failed to submit attendance.');
      console.error('Error:', err.message);
    }
  };

  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-200/50 transform transition-all duration-300 hover:shadow-3xl hover:-translate-y-1">
          {/* Subtle decorative elements */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#D16F55]/5 to-transparent rounded-3xl -z-10"></div>

          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#D16F55] to-[#B7A9CC] rounded-2xl mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl font-light mb-2 text-slate-800 tracking-tight">
                Mark Attendance
              </h2>
              <p className="text-slate-500 text-sm font-medium">Quick and secure submission</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
            )}
            {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl text-center">
                  <p className="text-green-600 text-sm font-medium">Attendance submitted successfully!</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="studentId" className="block text-sm font-semibold text-slate-700 mb-3">
                  Student ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                      type="text"
                      id="studentId"
                      value={studentId}
                      onChange={handleStudentIdChange}
                      className="w-full pl-10 pr-4 py-4 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/20 focus:border-transparent bg-slate-50/50 text-slate-900 placeholder-slate-400 transition-all duration-200 text-lg"
                      placeholder="e.g., WDF1000"
                      maxLength={7}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="attendanceCode" className="block text-sm font-semibold text-slate-700 mb-3">
                  Attendance Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                      type="text"
                      id="attendanceCode"
                      value={attendanceCode}
                      onChange={handleAttendanceCodeChange}
                      className="w-full pl-10 pr-4 py-4 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#D16F55]/20 focus:border-transparent bg-slate-50/50 text-slate-900 placeholder-slate-400 transition-all duration-200 text-lg"
                      placeholder="e.g., 13HH"
                      maxLength={10}
                  />
                </div>
              </div>

              <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#D16F55] via-[#D16F55] to-[#B7A9CC] text-white py-4 rounded-2xl hover:from-[#B7A9CC] hover:to-[#D16F55] transition-all duration-300 font-semibold tracking-wide shadow-lg hover:shadow-xl transform hover:scale-[1.02] text-lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Submit Attendance
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
  );
}

export default AttendanceForm;