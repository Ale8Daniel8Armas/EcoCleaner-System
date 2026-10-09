import { Link } from 'react-router-dom';

export default function SupervisorHome() {
    return (
        <div className="p-4">
            <h1>Vista del Supervisor</h1>
            <p>Aquí irá el panel de consumo y comparación.</p>
            <Link to="/" className="text-blue-500 underline">Volver al inicio</Link>
        </div>
    );
}