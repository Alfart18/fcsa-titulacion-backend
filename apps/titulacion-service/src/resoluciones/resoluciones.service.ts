// Ruta: src/resoluciones/resoluciones.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  EstadoDocumentalRes,
  EstadoExpediente,
  EstadoUsuario,
  OrigenResolucion,
  Prisma,
  SerieNumeracion,
  SituacionJuridicaRes,
  TipoResolucion,
} from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrearResolucionDto } from './dto/crear-resolucion.dto';
import type { ResolucionResponse } from './dto/response/resolucion.response';

@Injectable()
export class ResolucionesService {
  constructor(private readonly prisma: PrismaService) {}

  private determinarSeriePorTipo(
    tipo: TipoResolucion,
    serieExplicita?: SerieNumeracion,
  ): SerieNumeracion {
    if (serieExplicita) {
      return serieExplicita;
    }

    if (tipo === TipoResolucion.APTO || tipo === TipoResolucion.TITULO) {
      return SerieNumeracion.CF;
    }

    return SerieNumeracion.ORD;
  }

  private generarHashVersion(payload: Record<string, unknown>): string {
    return createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  async emitirResolucion(
    dto: CrearResolucionDto,
    usuarioActual: JwtPayload,
  ): Promise<ResolucionResponse> {
    return this.prisma.$transaction(async (tx) => {
      const expediente = await tx.expediente.findUnique({
        where: { id: dto.expedienteId },
        include: { tesistas: true },
      });

      if (!expediente) {
        throw new NotFoundException(
          `No se encontró el expediente con ID "${dto.expedienteId}".`,
        );
      }

      if (expediente.estado !== EstadoExpediente.EN_PROCESO) {
        throw new BadRequestException(
          `No se pueden emitir resoluciones porque el expediente "${expediente.codigoExpediente}" se encuentra en estado ${expediente.estado}.`,
        );
      }

      if (dto.tesistaId) {
        const tesistaPertenece = expediente.tesistas.some(
          (t) => t.id === dto.tesistaId,
        );
        if (!tesistaPertenece) {
          throw new BadRequestException(
            `El tesista con ID "${dto.tesistaId}" no pertenece al expediente "${expediente.codigoExpediente}".`,
          );
        }
      }

      if (dto.resolucionAntecedenteId) {
        const antecedente = await tx.resolucion.findUnique({
          where: { id: dto.resolucionAntecedenteId },
        });
        if (!antecedente || antecedente.expedienteId !== expediente.id) {
          throw new BadRequestException(
            'La resolución antecedente especificada no existe o no pertenece al mismo expediente.',
          );
        }
      }

      const decanoActivo = await tx.usuario.findFirst({
        where: {
          esDecanoFirmante: true,
          estado: EstadoUsuario.ACTIVO,
        },
      });

      if (!decanoActivo) {
        throw new BadRequestException(
          'No existe un usuario activo configurado como Decano Firmante en el sistema.',
        );
      }

      const fechaEmision = dto.fechaEmision
        ? new Date(dto.fechaEmision)
        : new Date();
      const anioActual = fechaEmision.getUTCFullYear();
      const serie = this.determinarSeriePorTipo(dto.tipo, dto.serie);

      const contador = await tx.contadorSerie.upsert({
        where: {
          anio_serie: {
            anio: anioActual,
            serie,
          },
        },
        update: {
          ultimoNumero: { increment: 1 },
        },
        create: {
          anio: anioActual,
          serie,
          ultimoNumero: 1,
        },
      });

      const correlativoFormateado = contador.ultimoNumero
        .toString()
        .padStart(4, '0');
      const numeroCompleto = `RES-${serie}-${anioActual}-${correlativoFormateado}`;
      const idTramiteControl = `TRAM-${anioActual}-${correlativoFormateado}-${randomUUID().slice(0, 8).toUpperCase()}`;

      const pdfGeneradoPath = `/temp/res-${serie.toLowerCase()}-${anioActual}-${correlativoFormateado}.pdf`;

      const nombreDecanoSnapshot =
        `${decanoActivo.gradoTitulo} ${decanoActivo.nombresCompletos}`.trim();
      const inicialesOperador = (usuarioActual.iniciales || 'op').toLowerCase();

      const hashVersionGenerado = this.generarHashVersion({
        expedienteId: expediente.id,
        tipo: dto.tipo,
        serie,
        numeroCompleto,
        fechaEmision: fechaEmision.toISOString(),
        datosEspecificos: dto.datosEspecificos,
        versionPdf: 1,
      });

      const nuevaResolucion = await tx.resolucion.create({
        data: {
          expedienteId: expediente.id,
          tipo: dto.tipo,
          serie,
          numeroCorrelativo: contador.ultimoNumero,
          anioNumeracion: anioActual,
          numeroCompleto,
          tesistaId: dto.tesistaId ?? null,
          resolucionAntecedenteId: dto.resolucionAntecedenteId ?? null,
          situacionJuridica: SituacionJuridicaRes.VIGENTE,
          estadoDocumental: EstadoDocumentalRes.EMITIDO,
          origen: OrigenResolucion.SISTEMA,
          fechaEmision,
          nombreDecanoSnapshot,
          inicialesOperador,
          datosEspecificos: dto.datosEspecificos as Prisma.InputJsonValue,
          idTramiteControl,
          versionPdf: 1,
          hashVersionGenerado,
          pdfGeneradoPath,
          usuarioEmisorId: usuarioActual.sub,
        },
      });

      const datos = dto.datosEspecificos;
      const updateExpedienteData: Prisma.ExpedienteUpdateInput = {
        pasoActual: { increment: 1 },
      };

      const tituloDesdeDatos =
        typeof datos.tituloTesis === 'string' && datos.tituloTesis.trim().length > 0
          ? datos.tituloTesis.trim()
          : typeof datos.nuevoTitulo === 'string' &&
              datos.nuevoTitulo.trim().length > 0
            ? datos.nuevoTitulo.trim()
            : undefined;

      if (tituloDesdeDatos) {
        updateExpedienteData.tituloActual = tituloDesdeDatos;
        updateExpedienteData.tituloResolucionId = nuevaResolucion.id;
      }

      switch (dto.tipo) {
        case TipoResolucion.ASESOR:
        case TipoResolucion.CAMBIO_ASESOR: {
          updateExpedienteData.asesorResolucionId = nuevaResolucion.id;
          if (typeof datos.asesorDocenteId === 'string') {
            updateExpedienteData.asesorDocenteId = datos.asesorDocenteId;
          }
          break;
        }
        case TipoResolucion.DICTAMEN:
        case TipoResolucion.TERCER_DICT:
        case TipoResolucion.CAMBIO_DICTAMINANTE: {
          updateExpedienteData.dictaminantesResolucionId = nuevaResolucion.id;
          if (typeof datos.dictaminante1Id === 'string') {
            updateExpedienteData.dictaminante1Id = datos.dictaminante1Id;
          }
          if (typeof datos.dictaminante2Id === 'string') {
            updateExpedienteData.dictaminante2Id = datos.dictaminante2Id;
          }
          if (typeof datos.dictaminante3Id === 'string') {
            updateExpedienteData.dictaminante3Id = datos.dictaminante3Id;
          }
          break;
        }
        case TipoResolucion.INSCRIPCION: {
          updateExpedienteData.inscripcionResolucionId = nuevaResolucion.id;
          break;
        }
        case TipoResolucion.FECHA_HORA: {
          updateExpedienteData.fechaHoraResolucionId = nuevaResolucion.id;
          break;
        }
        case TipoResolucion.CAMBIO_TITULO: {
          updateExpedienteData.tituloResolucionId = nuevaResolucion.id;
          break;
        }
        case TipoResolucion.APTO: {
          if (dto.tesistaId) {
            await tx.tesista.update({
              where: { id: dto.tesistaId },
              data: { aptoResolucionId: nuevaResolucion.id },
            });
          }
          break;
        }
        case TipoResolucion.TITULO: {
          if (dto.tesistaId) {
            await tx.tesista.update({
              where: { id: dto.tesistaId },
              data: { tituloResolucionId: nuevaResolucion.id },
            });
          }
          break;
        }
        default:
          break;
      }

      const expedienteActualizado = await tx.expediente.update({
        where: { id: expediente.id },
        data: updateExpedienteData,
        select: {
          id: true,
          codigoExpediente: true,
          estado: true,
          pasoActual: true,
          tituloActual: true,
          asesorResolucionId: true,
          dictaminantesResolucionId: true,
          inscripcionResolucionId: true,
          fechaHoraResolucionId: true,
          tituloResolucionId: true,
        },
      });

      return {
        ...nuevaResolucion,
        expediente: expedienteActualizado,
      };
    });
  }

  async obtenerPorId(id: string): Promise<ResolucionResponse> {
    const resolucion = await this.prisma.resolucion.findUnique({
      where: { id },
      include: {
        expediente: {
          select: {
            id: true,
            codigoExpediente: true,
            estado: true,
            pasoActual: true,
            tituloActual: true,
            asesorResolucionId: true,
            dictaminantesResolucionId: true,
            inscripcionResolucionId: true,
            fechaHoraResolucionId: true,
            tituloResolucionId: true,
          },
        },
      },
    });

    if (!resolucion) {
      throw new NotFoundException(`No se encontró la resolución con ID "${id}".`);
    }

    return resolucion;
  }
}