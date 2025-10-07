// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RegisterForm from './RegisterForm.jsx'
import AttendanceFrom from './AttendanceForm.jsx';
import AdminDashboard from './AdminDashboard';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <Routes>
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/attendanceForm" element={<AttendanceFrom />} />
            <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
    </BrowserRouter>
);