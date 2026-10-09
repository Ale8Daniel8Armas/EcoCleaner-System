import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import MobileLayout from './MobileLayout';
import OperarioHome from '../features/operario/pages/OperarioHome';
import SupervisorHome from '../features/supervisor/pages/SupervisorHome';

function Home() {
    return (
        <div className="p-8 flex flex-col gap-4">
            <h1 className="text-2xl font-bold">EcoCleaner - Hackatón</h1>
            <div className="flex gap-4">
                <Link to="/operario" className="border p-2 rounded">Entrar como Operario</Link>
                <Link to="/supervisor" className="border p-2 rounded">Entrar como Supervisor</Link>
            </div>
        </div>
    );
}

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MobileLayout />}>
                    <Route path="/" element={<div className="p-4 text-center">Selecciona tu rol abajo</div>} />
                    <Route path="/operario" element={<OperarioHome />} />
                    <Route path="/supervisor" element={<SupervisorHome />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}