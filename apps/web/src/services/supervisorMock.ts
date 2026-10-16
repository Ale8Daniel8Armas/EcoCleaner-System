export type ConsumptionRow = {
    task: string;
    area: string;
    surface: number;
    dirtLevel?: 'baja' | 'media' | 'alta';
    water: number;
    product: number;
    compliance: 'Cumple' | 'Revisar';
    source: 'Medido' | 'Estimado';
    simulated?: boolean;
    startTime?: string | null;
    estimatedTimeMin?: number | null;
};

export type SiteTemplate = {
    id: string;
    name: string;
    description: string;
    areas: string[];
};

export type VariantComparison = {
    name: string;
    dilution: number;
    sampleSize: number;
    productAverage: number;
    waterAverage: number;
    compliance: 'Cumple' | 'No cumple';
    reason: string;
    source: 'Medido' | 'Simulado';
};

export type EffluentDecision = {
    site: string;
    area: string;
    task: string;
    orientation: 'Revisión técnica' | 'Gestor autorizado' | 'Verter' | 'Reutilización' | 'No disponible';
    decision: 'Pendiente de registro' | 'Enviar a gestor' | 'Ajuste técnico' | 'Vertido autorizado' | 'Reutilización interna';
    ph: number | null;
    phOrigin: string;
    reason: string;
};

export const supervisorConsumption: ConsumptionRow[] = [
    { task: 'Lavado de pisos', area: 'Producción A', surface: 420, dirtLevel: 'media', water: 168, product: 8.4, compliance: 'Cumple', source: 'Medido' },
    { task: 'Desengrase de línea', area: 'Producción A', surface: 180, dirtLevel: 'alta', water: 90, product: 4.5, compliance: 'Cumple', source: 'Medido' },
    { task: 'Limpieza de almacén', area: 'Almacén', surface: 310, dirtLevel: 'media', water: 155, product: 7.8, compliance: 'Revisar', source: 'Estimado' },
    { task: 'Lavado de pasillos', area: 'Logística', surface: 260, dirtLevel: 'baja', water: 104, product: 5.2, compliance: 'Cumple', source: 'Medido' },
    { task: 'Limpieza de muelles', area: 'Logística', surface: 150, dirtLevel: 'baja', water: 75, product: 3.8, compliance: 'Cumple', source: 'Estimado' },
];

export const siteTemplates: SiteTemplate[] = [
    { id: 'industrial', name: 'Planta industrial', description: 'Producción, almacén y logística', areas: ['Producción A', 'Almacén', 'Logística'] },
    { id: 'almacen', name: 'Centro de distribución', description: 'Almacén y zonas de despacho', areas: ['Almacén', 'Muelles de carga'] },
    { id: 'personalizado', name: 'Sitio personalizado', description: 'Comienza con una estructura vacía', areas: [] },
];

export const variantComparisons: VariantComparison[] = [
    { name: 'Económica', dilution: 30, sampleSize: 3, productAverage: 5.4, waterAverage: 112, compliance: 'No cumple', reason: 'No cumple el criterio en 1 de 3 repeticiones.', source: 'Medido' },
    { name: 'Recomendada', dilution: 50, sampleSize: 3, productAverage: 8.2, waterAverage: 118, compliance: 'Cumple', reason: 'Cumple el criterio en todas las repeticiones.', source: 'Medido' },
    { name: 'Intensiva', dilution: 80, sampleSize: 2, productAverage: 12.6, waterAverage: 124, compliance: 'Cumple', reason: 'Cumple, pero aún no alcanza el mínimo de 3 repeticiones.', source: 'Simulado' },
];

export const effluentDecision: EffluentDecision = {
    site: 'Planta Norte',
    area: 'Producción A',
    task: 'Lavado de pisos',
    orientation: 'Gestor autorizado',
    decision: 'Enviar a gestor',
    ph: null,
    phOrigin: 'No disponible: no hay medición final del efluente.',
    reason: 'El sobrante concentrado debe conservarse y enviarse a un gestor autorizado. El software no autoriza vertidos ni prescribe neutralización.',
};
