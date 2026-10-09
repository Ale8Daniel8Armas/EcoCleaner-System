import { Outlet, Link } from 'react-router-dom';

export default function MobileLayout() {
    return (
        <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden">
            {/* Área principal donde cargan las pantallas */}
            <main className="flex-1 overflow-y-auto p-4 pb-20">
                <Outlet /> {/* Aquí React Router inyectará el OperarioHome o SupervisorHome */}
            </main>

            {/* Barra de navegación inferior */}
            <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 pb-4">
                <Link
                    to="/operario"
                    className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-blue-600 font-medium"
                >
                    <span>🧹</span>
                    <span className="text-xs">Operario</span>
                </Link>

                <Link
                    to="/supervisor"
                    className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] text-gray-500 font-medium"
                >
                    <span>📊</span>
                    <span className="text-xs">Supervisor</span>
                </Link>
            </nav>
        </div>
    );
}