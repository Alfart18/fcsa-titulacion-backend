// Ruta: src/reportes/reportes.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoExpediente } from '../generated/client';

export interface ResumenDashboardResponse {
  totalExpedientes: number;
  expedientesEnProceso: number;
  expedientesFinalizados: number;
  expedientesAnulados: number;
  totalTitulosEmitidos: number;
}

export interface ExpedientesPorEstadoItem {
  estado: EstadoExpediente;
  total: number;
}

export interface ExpedientesPorEscuelaItem {
  escuelaProfesionalId: number;
  nombreEscuela: string;
  siglasDocumento: string;
  totalExpedientes: number;
}

export interface ResolucionesPorMesItem {
  mes: number;
  nombreMes: string;
  anio: number;
  totalResoluciones: number;
}

export interface TitulosPorEscuelaItem {
  escuelaProfesionalId: number;
  nombreEscuela: string;
  siglasDocumento: string;
  anio: number;
  totalTitulos: number;
}

const NOMBRES_MESES: readonly string[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerResumenGeneral(): Promise<ResumenDashboardResponse> {
    const [agrupadoEstados, totalTitulosEmitidos] = await Promise.all([
      this.prisma.expediente.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.libroTitulo.count({ where: { estado: 'VIGENTE' } }),
    ]);

    const mapaEstados = new Map<EstadoExpediente, number>(agrupadoEstados.map((item) => [item.estado, item._count._all]));

    const expedientesEnProceso = mapaEstados.get(EstadoExpediente.EN_PROCESO) ?? 0;
    const expedientesFinalizados = mapaEstados.get(EstadoExpediente.FINALIZADO) ?? 0;
    const expedientesAnulados = mapaEstados.get(EstadoExpediente.ANULADO) ?? 0;
    const totalExpedientes = expedientesEnProceso + expedientesFinalizados + expedientesAnulados;

    return { totalExpedientes, expedientesEnProceso, expedientesFinalizados, expedientesAnulados, totalTitulosEmitidos };
  }

  async obtenerExpedientesPorEstado(): Promise<ExpedientesPorEstadoItem[]> {
    const agrupado = await this.prisma.expediente.groupBy({ by: ['estado'], _count: { _all: true } });
    const mapa = new Map<EstadoExpediente, number>(agrupado.map((g) => [g.estado, g._count._all]));

    const estadosOrdenados: EstadoExpediente[] = [EstadoExpediente.EN_PROCESO, EstadoExpediente.FINALIZADO, EstadoExpediente.ANULADO];
    return estadosOrdenados.map((estado) => ({ estado, total: mapa.get(estado) ?? 0 }));
  }

  async obtenerExpedientesPorEscuela(): Promise<ExpedientesPorEscuelaItem[]> {
    const [escuelas, agrupado] = await Promise.all([
      this.prisma.escuelaProfesional.findMany({ where: { activa: true }, orderBy: { id: 'asc' }, select: { id: true, nombre: true, siglasDocumento: true } }),
      this.prisma.expediente.groupBy({ by: ['escuelaProfesionalId'], _count: { _all: true } }),
    ]);

    const mapaConteo = new Map<number, number>(agrupado.map((g) => [g.escuelaProfesionalId, g._count._all]));

    return escuelas.map((escuela) => ({
      escuelaProfesionalId: escuela.id,
      nombreEscuela: escuela.nombre,
      siglasDocumento: escuela.siglasDocumento,
      totalExpedientes: mapaConteo.get(escuela.id) ?? 0,
    }));
  }

  async obtenerResolucionesPorMes(): Promise<ResolucionesPorMesItem[]> {
    const anioActual = new Date().getFullYear();
    const inicioAnio = new Date(Date.UTC(anioActual, 0, 1));
    const finAnio = new Date(Date.UTC(anioActual, 11, 31, 23, 59, 59, 999));

    const agrupadoPorFecha = await this.prisma.resolucion.groupBy({
      by: ['fechaEmision'],
      where: { fechaEmision: { gte: inicioAnio, lte: finAnio } },
      _count: { _all: true },
    });

    const conteoPorMes = new Array<number>(12).fill(0);
    for (const fila of agrupadoPorFecha) {
      const mesIndex = new Date(fila.fechaEmision).getUTCMonth();
      conteoPorMes[mesIndex] += fila._count._all;
    }

    return NOMBRES_MESES.map((nombreMes, index) => ({
      mes: index + 1,
      nombreMes,
      anio: anioActual,
      totalResoluciones: conteoPorMes[index],
    }));
  }

  async obtenerTitulosPorEscuelaAnioActual(): Promise<TitulosPorEscuelaItem[]> {
    const anioActual = new Date().getFullYear();

    const [escuelas, agrupadoTitulos] = await Promise.all([
      this.prisma.escuelaProfesional.findMany({ where: { activa: true }, orderBy: { id: 'asc' }, select: { id: true, nombre: true, siglasDocumento: true } }),
      this.prisma.libroTitulo.groupBy({ by: ['escuelaProfesionalId'], where: { anioRegistro: anioActual, estado: 'VIGENTE' }, _count: { _all: true } }),
    ]);

    const mapaTitulos = new Map<number, number>(agrupadoTitulos.map((g) => [g.escuelaProfesionalId, g._count._all]));

    return escuelas.map((escuela) => ({
      escuelaProfesionalId: escuela.id,
      nombreEscuela: escuela.nombre,
      siglasDocumento: escuela.siglasDocumento,
      anio: anioActual,
      totalTitulos: mapaTitulos.get(escuela.id) ?? 0,
    }));
  }
}