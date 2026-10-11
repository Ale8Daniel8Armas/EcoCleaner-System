export type ConsumptionRow = {
    task: string;
    area: string;
    surface: number;
    water: number;
    product: number;
    compliance: 'Cumple' | 'Revisar';
    source: 'Medido' | 'Estimado';
};

export type SiteTemplate = {
    id: string;
    name: string;
    description: string;
    areas: string[];
};

export const supervisorConsumption: ConsumptionRow[] = [
    { task: 'Lavado de pisos', area: 'Producción A', surface: 420, water: 168, product: 8.4, compliance: 'Cumple', source: 'Medido' },
    { task: 'Desengrase de línea', area: 'Producción A', surface: 180, water: 90, product: 4.5, compliance: 'Cumple', source: 'Medido' },
    { task: 'Limpieza de almacén', area: 'Almacén', surface: 310, water: 155, product: 7.8, compliance: 'Revisar', source: 'Estimado' },
    { task: 'Lavado de pasillos', area: 'Logística', surface: 260, water: 104, product: 5.2, compliance: 'Cumple', source: 'Medido' },
    { task: 'Limpieza de muelles', area: 'Logística', surface: 150, water: 75, product: 3.8, compliance: 'Cumple', source: 'Estimado' },
];

export const siteTemplates: SiteTemplate[] = [
    { id: 'industrial', name: 'Planta industrial', description: 'Producción, almacén y logística', areas: ['Producción A', 'Almacén', 'Logística'] },
    { id: 'almacen', name: 'Centro de distribución', description: 'Almacén y zonas de despacho', areas: ['Almacén', 'Muelles de carga'] },
    { id: 'personalizado', name: 'Sitio personalizado', description: 'Comienza con una estructura vacía', areas: [] },
];
