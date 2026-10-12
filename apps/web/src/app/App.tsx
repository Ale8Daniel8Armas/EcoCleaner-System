import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileLayout from './MobileLayout';
import Home from './Home';
import OperarioHome from '../features/operario/pages/OperarioHome';
import Recipe from '../features/operario/pages/Recipe';
import UsageLog from '../features/operario/pages/UsageLog';
import Criteria from '../features/operario/pages/Criteria';
import OperarioEffluent from '../features/operario/pages/Effluent';
import { OperarioFlowProvider } from '../context/OperarioFlowContext';
import SupervisorHome from '../features/supervisor/pages/SupervisorHome';
import NewSite from '../features/supervisor/pages/NewSite';
import NewProduct from '../features/supervisor/pages/NewProduct';
import Comparison from '../features/supervisor/pages/Comparison';
import Report from '../features/supervisor/pages/Report';
import Effluent from '../features/supervisor/pages/Effluent';

export function App() {
    return (
        <BrowserRouter>
            <OperarioFlowProvider>
                <Routes>
                    <Route element={<MobileLayout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/operario" element={<OperarioHome />} />
                        <Route path="/operario/receta" element={<Recipe />} />
                        <Route path="/operario/registro/:tareaId" element={<UsageLog />} />
                        <Route path="/operario/criterio/:registroId" element={<Criteria />} />
                        <Route path="/operario/efluente/:registroId" element={<OperarioEffluent />} />
                        <Route path="/supervisor" element={<SupervisorHome />} />
                        <Route path="/supervisor/panel" element={<SupervisorHome />} />
                        <Route path="/supervisor/sitios/nuevo" element={<NewSite />} />
                        <Route path="/supervisor/productos/nuevo" element={<NewProduct />} />
                        <Route path="/supervisor/comparacion" element={<Comparison />} />
                        <Route path="/supervisor/reporte" element={<Report />} />
                        <Route path="/supervisor/efluente" element={<Effluent />} />
                    </Route>
                </Routes>
            </OperarioFlowProvider>
        </BrowserRouter>
    );
}