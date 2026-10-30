// Ruta: src/catalogos/catalogos.service.ts
import {
  ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarCausaDto } from './dto/actualizar-causa.dto';
import { CrearCausaDto } from './dto/crear-causa.dto';
import { ListarCausasDto } from './dto/listar-causas.dto';
import type {
  CausaResponse, DepartamentoCatalogoResponse, EscuelaCatalogoResponse,
} from './dto/response/catalogo.response';

@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  async listarCausas(dto: ListarCausasDto): Promise<CausaResponse[]> {
    const where: Prisma.CatalogoCausaWhereInput = {};
    if (dto.ambito) { where.ambito = dto.ambito; }
    if (!dto.incluirInactivos) { where.activo = true; }

    return this.prisma.catalogoCausa.findMany({
      where,
      orderBy: [{ ambito: 'asc' }, { descripcion: 'asc' }],
    });
  }

  async crearCausa(dto: CrearCausaDto): Promise<CausaResponse> {
    const descripcion = dto.descripcion.trim();
    const existente = await this.prisma.catalogoCausa.findUnique({
      where: { ambito_descripcion: { ambito: dto.ambito, descripcion } },
    });

    if (existente) {
      throw new ConflictException(`Ya existe una causa con la descripción "${descripcion}" en el ámbito ${dto.ambito}.`);
    }

    return this.prisma.catalogoCausa.create({
      data: {
        ambito: dto.ambito,
        descripcion,
        requiereDetalleManual: dto.requiereDetalleManual ?? false,
        activo: true,
      },
    });
  }

  async actualizarCausa(id: number, dto: ActualizarCausaDto): Promise<CausaResponse> {
    const actual = await this.prisma.catalogoCausa.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException(`No se encontró la causa de catálogo con ID ${id}.`);

    const nuevoAmbito = dto.ambito ?? actual.ambito;
    const nuevaDescripcion = dto.descripcion !== undefined ? dto.descripcion.trim() : actual.descripcion;

    if (nuevoAmbito !== actual.ambito || nuevaDescripcion !== actual.descripcion) {
      const duplicada = await this.prisma.catalogoCausa.findUnique({
        where: { ambito_descripcion: { ambito: nuevoAmbito, descripcion: nuevaDescripcion } },
      });
      if (duplicada && duplicada.id !== id) {
        throw new ConflictException(`Ya existe otra causa con la descripción "${nuevaDescripcion}" en el ámbito ${nuevoAmbito}.`);
      }
    }

    return this.prisma.catalogoCausa.update({
      where: { id },
      data: {
        ambito: nuevoAmbito,
        descripcion: nuevaDescripcion,
        requiereDetalleManual: dto.requiereDetalleManual ?? actual.requiereDetalleManual,
        activo: dto.activo ?? actual.activo,
      },
    });
  }

  async listarEscuelas(): Promise<EscuelaCatalogoResponse[]> {
    return this.prisma.escuelaProfesional.findMany({ where: { activa: true }, orderBy: { nombre: 'asc' } });
  }

  async listarDepartamentos(): Promise<DepartamentoCatalogoResponse[]> {
    return this.prisma.departamentoAcademico.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  }
}