import { Link } from 'react-router-dom';

export default function OperarioHome() {
    return (
        <div className="p-4">
            <h1>Vista del Operario</h1>
            <p>Aquí irá la pantalla de receta y registro.</p>
            <Link to="/" className="text-blue-500 underline">Volver al inicio</Link>
        </div>
    );
}