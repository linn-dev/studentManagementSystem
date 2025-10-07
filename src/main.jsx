import './App.css'
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom'; // Add this
import RegisterForm from './RegisterForm.jsx';
import AttendanceForm from './AttendanceForm.jsx';
import AdminDashboard from './AdminDashboard.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter> {/* Wrap everything */}
            <Routes>
                <Route path="/" element={<div style={{textAlign: "center"}}><p>Hi!</p><h1>I am Yan Linn Aung</h1><p>Linn Dev</p></div>} /> {/* Home */}
                <Route path="/register" element={<RegisterForm />} />
                <Route path="/attendance" element={<AttendanceForm />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="*" element={<div>404 - Not Found</div>} /> {/* Catch-all */}
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);