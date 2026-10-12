import type { Area, Producto, Sitio } from '@ecocleaner/schemas'

export type SitioOperario = Sitio & { id: string }
export type AreaOperario = Area & { id: string }
export type ProductoOperario = Producto & { id: string }

/** Parámetros configurables del flujo del operario (ERS 10.3). */
export const operarioConfig = {
  toleranciaSobredosisPct: 10,
  litrosSolucionPorM2PorDefecto: 0.4,
  minutosPorDefecto: 30,
  /** Rango de pH de descarga: valor de ejemplo hasta verificarlo en el TULSMA. */
  rangoPhDescarga: { min: 6, max: 9 },
  validacionRango: {
    verificado: false,
    fuente: 'Valor de ejemplo, no normativo (pendiente TULSMA)',
    jurisdiccion: 'Ecuador (no verificado)',
    aplica_al_caso: false,
  },
  fuentesPhEfluente: ['Tira reactiva', 'Medidor de pH', 'Laboratorio externo'],
}

/**
 * Catálogo y sitios de demostración. Datos ficticios rotulados como simulados;
 * se sustituyen por consultas a `services/` cuando se conecte Supabase.
 */
export const sitios: SitioOperario[] = [
  {
    id: 'sitio-planta-norte',
    nombre: 'Planta Norte',
    tipo: 'Planta industrial',
    criterios_limpieza: [
      'Superficie sin residuos visibles',
      'Sin restos de producto químico',
      'Sin charcos ni acumulación de agua',
    ],
  },
  {
    id: 'sitio-centro-distribucion',
    nombre: 'Centro de distribución',
    tipo: 'Almacén logístico',
    criterios_limpieza: [
      'Superficie sin residuos visibles',
      'Pasillos despejados y secos',
    ],
  },
]

export const areas: AreaOperario[] = [
  {
    id: 'area-produccion-a',
    sitio_id: 'sitio-planta-norte',
    nombre: 'Producción A',
    superficie_m2: 120,
    tipo_superficie: 'Piso industrial',
    litros_solucion_por_m2: 0.4,
  },
  {
    id: 'area-almacen',
    sitio_id: 'sitio-planta-norte',
    nombre: 'Almacén',
    superficie_m2: 80,
    tipo_superficie: 'Piso epóxico',
    litros_solucion_por_m2: 0.3,
  },
  {
    id: 'area-muelles',
    sitio_id: 'sitio-centro-distribucion',
    nombre: 'Muelles de carga',
    superficie_m2: 60,
    tipo_superficie: 'Hormigón',
    litros_solucion_por_m2: null,
  },
]

/** Vocabulario de superficies sugerido por el ERS; editable antes de guardar. */
export const tiposSuperficie = [
  'Piso industrial',
  'Piso epóxico',
  'Hormigón',
  'Cerámica',
  'Acero inoxidable',
]

export const productos: ProductoOperario[] = [
  {
    id: 'prod-alcalino',
    nombre: 'Detergente alcalino',
    tipo_quimico: 'detergente alcalino',
    categorias: ['alcalino'],
    incompatibilidades: ['acido', 'hipoclorito'],
    dilucion_min_ml_por_litro: 20,
    dilucion_ml_por_litro: 50,
    dilucion_max_ml_por_litro: 100,
    dilucion_texto_ficha: 'Ejemplo 1:20',
    ph: 11.5,
    concentracion_ph: 'pH al 1% (ficticio)',
    ph_medido_a_ml_por_litro: 10,
    indicaciones_disposicion: 'Sección 13 de la hoja de seguridad (ficticia)',
    url_ficha_tecnica: 'https://example.com/fichas/alcalino.pdf',
    url_hoja_seguridad: 'https://example.com/fichas/alcalino-sds.pdf',
  },
  {
    id: 'prod-acido',
    nombre: 'Desincrustante ácido',
    tipo_quimico: 'limpiador ácido',
    categorias: ['acido'],
    incompatibilidades: ['alcalino', 'hipoclorito'],
    dilucion_min_ml_por_litro: 10,
    dilucion_ml_por_litro: 30,
    dilucion_max_ml_por_litro: 60,
    dilucion_texto_ficha: 'Ejemplo 1:33',
    ph: 2,
    concentracion_ph: 'pH al 1% (ficticio)',
    ph_medido_a_ml_por_litro: 10,
    indicaciones_disposicion: 'Sección 13 de la hoja de seguridad (ficticia)',
    url_ficha_tecnica: 'https://example.com/fichas/acido.pdf',
    url_hoja_seguridad: 'https://example.com/fichas/acido-sds.pdf',
  },
  {
    id: 'prod-hipoclorito',
    nombre: 'Desinfectante con hipoclorito',
    tipo_quimico: 'desinfectante clorado',
    categorias: ['hipoclorito'],
    incompatibilidades: ['acido', 'amoniaco'],
    dilucion_min_ml_por_litro: 5,
    dilucion_ml_por_litro: 20,
    dilucion_max_ml_por_litro: 50,
    dilucion_texto_ficha: 'Ejemplo 1:50',
    ph: 12,
    concentracion_ph: 'pH al 1% (ficticio)',
    ph_medido_a_ml_por_litro: 10,
    indicaciones_disposicion: 'Sección 13 de la hoja de seguridad (ficticia)',
    url_ficha_tecnica: 'https://example.com/fichas/hipoclorito.pdf',
    url_hoja_seguridad: 'https://example.com/fichas/hipoclorito-sds.pdf',
  },
  {
    id: 'prod-amoniaco',
    nombre: 'Limpiador con amoniaco',
    tipo_quimico: 'base nitrogenada',
    categorias: ['amoniaco'],
    incompatibilidades: ['hipoclorito', 'acido'],
    dilucion_min_ml_por_litro: 10,
    dilucion_ml_por_litro: 25,
    dilucion_max_ml_por_litro: 50,
    dilucion_texto_ficha: 'Ejemplo 1:40',
    ph: 11,
    concentracion_ph: 'pH al 1% (ficticio)',
    ph_medido_a_ml_por_litro: 10,
    indicaciones_disposicion: 'Sección 13 de la hoja de seguridad (ficticia)',
    url_ficha_tecnica: 'https://example.com/fichas/amoniaco.pdf',
    url_hoja_seguridad: 'https://example.com/fichas/amoniaco-sds.pdf',
  },
  {
    id: 'prod-cuaternario',
    nombre: 'Desinfectante de amonio cuaternario',
    tipo_quimico: 'amonio cuaternario',
    categorias: ['amonio_cuaternario'],
    incompatibilidades: ['otro'],
    dilucion_min_ml_por_litro: 15,
    dilucion_ml_por_litro: 40,
    dilucion_max_ml_por_litro: 80,
    dilucion_texto_ficha: 'Ejemplo 1:25',
    ph: 7,
    concentracion_ph: 'pH al 1% (ficticio)',
    ph_medido_a_ml_por_litro: 10,
    indicaciones_disposicion: 'Sección 13 de la hoja de seguridad (ficticia)',
    url_ficha_tecnica: 'https://example.com/fichas/cuaternario.pdf',
    url_hoja_seguridad: 'https://example.com/fichas/cuaternario-sds.pdf',
  },
  {
    id: 'prod-peroxido',
    nombre: 'Peróxido desincrustante',
    tipo_quimico: 'oxidante',
    categorias: ['peroxido'],
    incompatibilidades: ['otro'],
    dilucion_min_ml_por_litro: 10,
    dilucion_ml_por_litro: 30,
    dilucion_max_ml_por_litro: 60,
    dilucion_texto_ficha: 'Ejemplo 1:33',
    ph: 4,
    concentracion_ph: 'pH al 1% (ficticio)',
    ph_medido_a_ml_por_litro: 10,
    indicaciones_disposicion: 'Sección 13 de la hoja de seguridad (ficticia)',
    url_ficha_tecnica: 'https://example.com/fichas/peroxido.pdf',
    url_hoja_seguridad: 'https://example.com/fichas/peroxido-sds.pdf',
  },
]

export const getSitio = (id: string): SitioOperario | undefined =>
  sitios.find((sitio) => sitio.id === id)

export const getAreasDeSitio = (sitioId: string): AreaOperario[] =>
  areas.filter((area) => area.sitio_id === sitioId)

export const getProducto = (id: string): ProductoOperario | undefined =>
  productos.find((producto) => producto.id === id)
