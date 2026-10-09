import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileLayout from './MobileLayout';
import OperarioHome from '../features/operario/pages/OperarioHome';
import SupervisorHome from '../features/supervisor/pages/SupervisorHome';

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
                </Route>
            </Routes>
        </BrowserRouter>
    );
}