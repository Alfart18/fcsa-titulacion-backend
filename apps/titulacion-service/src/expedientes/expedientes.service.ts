// Ruta: src/expedientes/expedientes.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  EstadoDocumentalRes, EstadoExpediente, EstadoTesista, EstadoUsuario, OrigenResolucion, Prisma, SerieNumeracion, SituacionJuridicaRes, TipoResolucion,
} from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CambiarEstadoExpedienteDto, CrearExpedienteDto } from './dto/crear-expediente.dto';
import { ListarExpedientesDto } from './dto/listar-expedientes.dto';
import type { ExpedienteDetalleResponse, PaginatedExpedientesResponse, ResolucionExpedienteResponse } from './dto/response/expediente.response';

const DOMINIO_INSTITUCIONAL = '@uandina.edu.pe';

@Injectable()
export class ExpedientesService {
  constructor(private readonly prisma: PrismaService) {}

  private construirNombreCompleto(nombres: string, apellidoPaterno: string, apellidoMaterno: string): string {
    return `${nombres.trim()} ${apellidoPaterno.trim()} ${apellidoMaterno.trim()}`.replace(/\s+/g, ' ').trim();
  }

  private generarHashHistorico(semilla: string): string {
    return createHash('sha256').update(semilla).digest('hex');
  }

  private async obtenerSiguienteCorrelativoHistorico(tx: Prisma.TransactionClient, serie: SerieNumeracion, anioNumeracion: number): Promise<number> {
    const minHistorico = await tx.resolucion.aggregate({
      where: { serie, anioNumeracion, numeroCorrelativo: { lt: 0 } },
      _min: { numeroCorrelativo: true },
    });
    const actualMin = minHistorico._min.numeroCorrelativo;
    return actualMin !== null && actualMin < 0 ? actualMin - 1 : -1;
  }

  async crearExpediente(dto: CrearExpedienteDto, usuarioActual: JwtPayload): Promise<ExpedienteDetalleResponse> {
    const pasoActual = dto.pasoActual ?? 1;

    if (dto.tesistas.length !== dto.cantidadTesistas) {
      throw new BadRequestException(`La cantidad de tesistas declarada (${dto.cantidadTesistas}) no coincide con el número de tesistas enviados (${dto.tesistas.length}).`);
    }

    if (dto.tesistas.length === 2) {
      const cod1 = dto.tesistas[0].codigoUniversitario.trim().toLowerCase();
      const cod2 = dto.tesistas[1].codigoUniversitario.trim().toLowerCase();
      if (cod1 === cod2) {
        throw new BadRequestException('Los dos tesistas deben tener códigos universitarios distintos.');
      }
    }

    if (pasoActual >= 2) {
      if (!dto.resolucionAsesor) throw new BadRequestException('Para iniciar un expediente en un paso mayor o igual a 2, es obligatorio registrar la resolución histórica de designación de asesor.');
      if (!dto.resolucionAsesor.nombreAsesor && !dto.resolucionAsesor.asesorDocenteId) throw new BadRequestException('La resolución histórica de asesor debe incluir el nombre del asesor o su identificador de docente.');
    }

    if (pasoActual >= 3) {
      if (!dto.resolucionDictaminantes) throw new BadRequestException('Para iniciar un expediente en un paso mayor o igual a 3, es obligatorio registrar la resolución histórica de designación de dictaminantes.');
      const tieneDictaminantesTexto = Boolean(dto.resolucionDictaminantes.nombreDictaminantes?.trim()) || (Boolean(dto.resolucionDictaminantes.nombreDictaminante1?.trim()) && Boolean(dto.resolucionDictaminantes.nombreDictaminante2?.trim()));
      const tieneDictaminantesIds = Boolean(dto.resolucionDictaminantes.dictaminante1Id) && Boolean(dto.resolucionDictaminantes.dictaminante2Id);
      if (!tieneDictaminantesTexto && !tieneDictaminantesIds) throw new BadRequestException('La resolución histórica de dictaminantes debe especificar los nombres o identificadores de los dictaminantes.');
      if (dto.resolucionAsesor && dto.resolucionAsesor.numeroCompleto.trim().toUpperCase() === dto.resolucionDictaminantes.numeroCompleto.trim().toUpperCase()) throw new BadRequestException('La resolución histórica de asesor y la de dictaminantes no pueden tener el mismo número de resolución.');
    }

    return this.prisma.$transaction(async (tx) => {
      const escuela = await tx.escuelaProfesional.findUnique({ where: { id: dto.escuelaProfesionalId } });
      if (!escuela || !escuela.activa) throw new BadRequestException('La escuela profesional especificada no existe o se encuentra inactiva.');

      const anioActual = new Date().getFullYear();
      const contador = await tx.contadorExpediente.upsert({
        where: { anio: anioActual },
        update: { ultimoNumero: { increment: 1 } },
        create: { anio: anioActual, ultimoNumero: 1 },
      });
      const codigoExpediente = `EXP-${anioActual}-${contador.ultimoNumero.toString().padStart(4, '0')}`;
      const tituloInicial = dto.tituloActual?.trim() || dto.resolucionDictaminantes?.tituloTesis?.trim() || dto.resolucionAsesor?.tituloTesis?.trim() || null;

      const expediente = await tx.expediente.create({
        data: {
          codigoExpediente, escuelaProfesionalId: dto.escuelaProfesionalId, estado: EstadoExpediente.EN_PROCESO, cantidadTesistas: dto.cantidadTesistas, pasoActual, tituloActual: tituloInicial, creadoPorId: usuarioActual.sub,
        },
      });

      for (let i = 0; i < dto.tesistas.length; i++) {
        const item = dto.tesistas[i];
        const nombres = item.nombres.trim();
        const apellidoPaterno = item.apellidoPaterno.trim();
        const apellidoMaterno = item.apellidoMaterno.trim();
        const codigoUniversitario = item.codigoUniversitario.trim().toLowerCase();
        const correoGenerado = `${codigoUniversitario}${DOMINIO_INSTITUCIONAL}`;
        const nombreCompleto = this.construirNombreCompleto(nombres, apellidoPaterno, apellidoMaterno);

        let persona = await tx.persona.findFirst({ where: { codigoUniversitario: { equals: codigoUniversitario, mode: 'insensitive' } } });

        if (!persona) {
          const correoExistente = await tx.persona.findUnique({ where: { correo: correoGenerado } });
          if (correoExistente) throw new ConflictException(`El correo institucional "${correoGenerado}" ya está asociado a otra persona registrada.`);
          persona = await tx.persona.create({
            data: { nombres, apellidoPaterno, apellidoMaterno, nombreCompleto, codigoUniversitario, correo: correoGenerado, telefono: item.telefono?.trim() || null, esEstudiante: true, esDocente: false },
          });
        } else {
          const participacionActiva = await tx.tesista.findFirst({
            where: { personaId: persona.id, estado: { in: [EstadoTesista.ACTIVO, EstadoTesista.APTO] }, expediente: { estado: EstadoExpediente.EN_PROCESO } },
            include: { expediente: { select: { codigoExpediente: true } } },
          });
          if (participacionActiva) throw new ConflictException(`El estudiante con código "${item.codigoUniversitario}" ya tiene un expediente activo en curso (${participacionActiva.expediente.codigoExpediente}).`);
          if (!persona.esEstudiante) persona = await tx.persona.update({ where: { id: persona.id }, data: { esEstudiante: true } });
        }

        await tx.tesista.create({ data: { expedienteId: expediente.id, personaId: persona.id, orden: i + 1, estado: EstadoTesista.ACTIVO } });
      }

      const decanoActivo = await tx.usuario.findFirst({ where: { esDecanoFirmante: true, estado: EstadoUsuario.ACTIVO } });
      const nombreDecanoSnapshot = decanoActivo ? `${decanoActivo.gradoTitulo} ${decanoActivo.nombresCompletos}`.trim() : 'DECANO FCSa-UAC (HISTÓRICO)';
      const inicialesOperador = (usuarioActual.iniciales || 'op').toLowerCase();

      let asesorResolucionId: string | null = null;
      let asesorDocenteId: string | null = null;
      let dictaminantesResolucionId: string | null = null;
      let tituloResolucionId: string | null = null;
      let dictaminante1Id: string | null = null;
      let dictaminante2Id: string | null = null;

      if (pasoActual >= 2 && dto.resolucionAsesor) {
        const numeroCompletoAsesor = dto.resolucionAsesor.numeroCompleto.trim();
        const duplicadaAsesor = await tx.resolucion.findUnique({ where: { numeroCompleto: numeroCompletoAsesor } });
        if (duplicadaAsesor) throw new ConflictException(`El número de resolución "${numeroCompletoAsesor}" ya se encuentra registrado en el sistema.`);

        const fechaEmisionAsesor = new Date(dto.resolucionAsesor.fechaEmision);
        const anioAsesor = fechaEmisionAsesor.getUTCFullYear();
        const correlativoHistoricoAsesor = await this.obtenerSiguienteCorrelativoHistorico(tx, SerieNumeracion.ORD, anioAsesor);
        const idTramiteAsesor = `HIST-ASESOR-${randomUUID()}`;
        const hashAsesor = this.generarHashHistorico(`${expediente.id}:${numeroCompletoAsesor}:${idTramiteAsesor}`);

        const resolucionAsesor = await tx.resolucion.create({
          data: {
            expedienteId: expediente.id, tipo: TipoResolucion.ASESOR, serie: SerieNumeracion.ORD, numeroCorrelativo: correlativoHistoricoAsesor, anioNumeracion: anioAsesor, numeroCompleto: numeroCompletoAsesor,
            situacionJuridica: SituacionJuridicaRes.VIGENTE, estadoDocumental: EstadoDocumentalRes.FIRMADO, origen: OrigenResolucion.HISTORICO, fechaEmision: fechaEmisionAsesor, nombreDecanoSnapshot, inicialesOperador,
            datosEspecificos: { origen: 'HISTORICO', nombreAsesor: dto.resolucionAsesor.nombreAsesor?.trim() ?? null, asesorDocenteId: dto.resolucionAsesor.asesorDocenteId ?? null, tituloTesis: dto.resolucionAsesor.tituloTesis?.trim() ?? null },
            idTramiteControl: idTramiteAsesor, versionPdf: 1, hashVersionGenerado: hashAsesor, usuarioEmisorId: usuarioActual.sub,
          },
        });
        asesorResolucionId = resolucionAsesor.id;
        asesorDocenteId = dto.resolucionAsesor.asesorDocenteId ?? null;
        if (dto.resolucionAsesor.tituloTesis) tituloResolucionId = resolucionAsesor.id;
      }

      if (pasoActual >= 3 && dto.resolucionDictaminantes) {
        const numeroCompletoDict = dto.resolucionDictaminantes.numeroCompleto.trim();
        const duplicadaDict = await tx.resolucion.findUnique({ where: { numeroCompleto: numeroCompletoDict } });
        if (duplicadaDict) throw new ConflictException(`El número de resolución "${numeroCompletoDict}" ya se encuentra registrado en el sistema.`);

        const fechaEmisionDict = new Date(dto.resolucionDictaminantes.fechaEmision);
        const anioDict = fechaEmisionDict.getUTCFullYear();
        const correlativoHistoricoDict = await this.obtenerSiguienteCorrelativoHistorico(tx, SerieNumeracion.ORD, anioDict);
        const idTramiteDict = `HIST-DICTAMEN-${randomUUID()}`;
        const hashDict = this.generarHashHistorico(`${expediente.id}:${numeroCompletoDict}:${idTramiteDict}`);

        const resolucionDictamen = await tx.resolucion.create({
          data: {
            expedienteId: expediente.id, tipo: TipoResolucion.DICTAMEN, serie: SerieNumeracion.ORD, numeroCorrelativo: correlativoHistoricoDict, anioNumeracion: anioDict, numeroCompleto: numeroCompletoDict,
            situacionJuridica: SituacionJuridicaRes.VIGENTE, estadoDocumental: EstadoDocumentalRes.FIRMADO, origen: OrigenResolucion.HISTORICO, fechaEmision: fechaEmisionDict, nombreDecanoSnapshot, inicialesOperador,
            datosEspecificos: { origen: 'HISTORICO', nombreDictaminantes: dto.resolucionDictaminantes.nombreDictaminantes?.trim() ?? null, nombreDictaminante1: dto.resolucionDictaminantes.nombreDictaminante1?.trim() ?? null, nombreDictaminante2: dto.resolucionDictaminantes.nombreDictaminante2?.trim() ?? null, dictaminante1Id: dto.resolucionDictaminantes.dictaminante1Id ?? null, dictaminante2Id: dto.resolucionDictaminantes.dictaminante2Id ?? null, tituloTesis: dto.resolucionDictaminantes.tituloTesis?.trim() ?? tituloInicial },
            idTramiteControl: idTramiteDict, versionPdf: 1, hashVersionGenerado: hashDict, usuarioEmisorId: usuarioActual.sub,
          },
        });
        dictaminantesResolucionId = resolucionDictamen.id;
        tituloResolucionId = resolucionDictamen.id;
        dictaminante1Id = dto.resolucionDictaminantes.dictaminante1Id ?? null;
        dictaminante2Id = dto.resolucionDictaminantes.dictaminante2Id ?? null;
      }

      if (asesorResolucionId || dictaminantesResolucionId) {
        await tx.expediente.update({
          where: { id: expediente.id },
          data: { asesorResolucionId, asesorDocenteId, dictaminantesResolucionId, tituloResolucionId, dictaminante1Id, dictaminante2Id },
        });
      }

      return tx.expediente.findUniqueOrThrow({
        where: { id: expediente.id },
        include: {
          escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true, gradoBachiller: true, tituloProfesional: true } },
          tesistas: { orderBy: { orden: 'asc' }, include: { persona: { select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true, nombreCompleto: true, codigoUniversitario: true, correo: true, telefono: true } } } },
          resoluciones: { orderBy: { creadoEn: 'asc' } },
        },
      });
    });
  }

  async listarExpedientes(dto: ListarExpedientesDto): Promise<PaginatedExpedientesResponse> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.ExpedienteWhereInput = {};

    const escuelaFiltro = dto.escuelaProfesionalId ?? dto.escuelaId;
    if (escuelaFiltro !== undefined) where.escuelaProfesionalId = escuelaFiltro;
    if (dto.estado !== undefined) where.estado = dto.estado;
    if (dto.pasoActual !== undefined) where.pasoActual = dto.pasoActual;

    if (dto.q && dto.q.trim().length > 0) {
      const termino = dto.q.trim();
      where.OR = [
        { codigoExpediente: { contains: termino, mode: 'insensitive' } },
        { tituloActual: { contains: termino, mode: 'insensitive' } },
        { tesistas: { some: { persona: { OR: [{ nombreCompleto: { contains: termino, mode: 'insensitive' } }, { codigoUniversitario: { contains: termino, mode: 'insensitive' } }] } } } },
      ];
    }

    const [total, expedientes] = await Promise.all([
      this.prisma.expediente.count({ where }),
      this.prisma.expediente.findMany({
        where, skip, take: limit, orderBy: { creadoEn: 'desc' },
        include: {
          escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true, gradoBachiller: true, tituloProfesional: true } },
          tesistas: { orderBy: { orden: 'asc' }, include: { persona: { select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true, nombreCompleto: true, codigoUniversitario: true, correo: true, telefono: true } } } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return { data: expedientes, meta: { page, limit, total, totalPages } };
  }

  async obtenerPorId(id: string): Promise<ExpedienteDetalleResponse> {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id },
      include: {
        escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true, gradoBachiller: true, tituloProfesional: true } },
        tesistas: { orderBy: { orden: 'asc' }, include: { persona: { select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true, nombreCompleto: true, codigoUniversitario: true, correo: true, telefono: true } } } },
        resoluciones: { orderBy: { creadoEn: 'asc' } },
      },
    });
    if (!expediente) throw new NotFoundException(`No se encontró el expediente con ID "${id}".`);
    return expediente;
  }

  async listarResolucionesExpediente(id: string): Promise<ResolucionExpedienteResponse[]> {
    const existe = await this.prisma.expediente.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException(`No se encontró el expediente con ID "${id}".`);
    return this.prisma.resolucion.findMany({ where: { expedienteId: id }, orderBy: { creadoEn: 'asc' } });
  }

  async cambiarEstado(id: string, dto: CambiarEstadoExpedienteDto): Promise<ExpedienteDetalleResponse> {
    const actual = await this.prisma.expediente.findUnique({ where: { id }, select: { id: true } });
    if (!actual) throw new NotFoundException(`No se encontró el expediente con ID "${id}".`);
    await this.prisma.expediente.update({ where: { id }, data: { estado: dto.estado } });
    return this.obtenerPorId(id);
  }
}