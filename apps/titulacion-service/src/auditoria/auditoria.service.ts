// Ruta: src/auditoria/auditoria.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/client';
import type { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto';

export interface RegistroAuditoriaItem {
  id: string;
  usuarioId: string;
  inicialesUsuario: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  expedienteId: string | null;
  resolucionId: string | null;
  detalle: Prisma.JsonValue;
  fechaHora: Date;
  usuario: {
    id: string;
    nombresCompletos: string;
    correo: string;
    rol: string;
  };
}

export interface ListaAuditoriaResponse {
  data: RegistroAuditoriaItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listarRegistros(filtros: FiltroAuditoriaDto): Promise<ListaAuditoriaResponse> {
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RegistroAuditoriaWhereInput = {};

    if (filtros.usuarioId) where.usuarioId = filtros.usuarioId;
    if (filtros.entidad?.trim()) where.entidad = { contains: filtros.entidad.trim(), mode: 'insensitive' };
    if (filtros.accion?.trim()) where.accion = { contains: filtros.accion.trim(), mode: 'insensitive' };

    if (filtros.fechaDesde || filtros.fechaHasta) {
      const desde = filtros.fechaDesde ? new Date(filtros.fechaDesde.length === 10 ? `${filtros.fechaDesde}T00:00:00.000Z` : filtros.fechaDesde) : undefined;
      const hasta = filtros.fechaHasta ? new Date(filtros.fechaHasta.length === 10 ? `${filtros.fechaHasta}T23:59:59.999Z` : filtros.fechaHasta) : undefined;

      if (desde && hasta && desde.getTime() > hasta.getTime()) {
        throw new BadRequestException('La fecha de inicio (fechaDesde) no puede ser posterior a la fecha de fin (fechaHasta)');
      }

      where.fechaHora = {
        ...(desde ? { gte: desde } : {}),
        ...(hasta ? { lte: hasta } : {}),
      };
    }

    const [total, registros] = await Promise.all([
      this.prisma.registroAuditoria.count({ where }),
      this.prisma.registroAuditoria.findMany({
        where, skip, take: limit,
        orderBy: { fechaHora: 'desc' },
        include: {
          usuario: { select: { id: true, nombresCompletos: true, correo: true, rol: true } },
        },
      }),
    ]);

    const data: RegistroAuditoriaItem[] = registros.map((item) => ({
      ...item,
      id: item.id.toString(),
    }));

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}