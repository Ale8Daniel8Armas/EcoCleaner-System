import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileLayout from './MobileLayout';
import OperarioHome from '../features/operario/pages/OperarioHome';
import SupervisorHome from '../features/supervisor/pages/SupervisorHome';
import NewSite from '../features/supervisor/pages/NewSite';
import Comparison from '../features/supervisor/pages/Comparison';
import Report from '../features/supervisor/pages/Report';
import Effluent from '../features/supervisor/pages/Effluent';

function Home() {
    return (
        <div className="p-8 flex flex-col gap-4">
            <h1 className="text-2xl font-bold">EcoCleaner App</h1>
        </div>
    );
}

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MobileLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/operario" element={<OperarioHome />} />
                    <Route path="/supervisor" element={<SupervisorHome />} />
                    <Route path="/supervisor/panel" element={<SupervisorHome />} />
                    <Route path="/supervisor/sitios/nuevo" element={<NewSite />} />
                    <Route path="/supervisor/comparacion" element={<Comparison />} />
                    <Route path="/supervisor/reporte" element={<Report />} />
                    <Route path="/supervisor/efluente" element={<Effluent />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}