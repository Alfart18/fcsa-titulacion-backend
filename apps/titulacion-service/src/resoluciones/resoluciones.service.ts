// Ruta: src/resoluciones/resoluciones.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CategoriaNumeracion,
  EstadoDocumentalRes,
  EstadoExpediente,
  EstadoTesista,
  EstadoUsuario,
  OrigenResolucion,
  Prisma,
  SerieNumeracion,
  SituacionJuridicaRes,
  TipoImpactoResolucion,
  TipoResolucion,
} from '../generated/client';
import { LibrosService } from '../libros/libros.service';
import { PrismaService } from '../prisma/prisma.service';
import { CrearResolucionDto } from './dto/crear-resolucion.dto';
import type { ResolucionResponse } from './dto/response/resolucion.response';

const PASO_SIGUIENTE_POR_TIPO: Partial<Record<TipoResolucion, number>> = {
  [TipoResolucion.ASESOR]: 2,
  [TipoResolucion.DICTAMEN]: 3,
  [TipoResolucion.INSCRIPCION]: 4,
  [TipoResolucion.TERCER_DICT]: 5,
  [TipoResolucion.APTO]: 6,
  [TipoResolucion.FECHA_HORA]: 7,
  [TipoResolucion.TITULO]: 7,
};

@Injectable()
export class ResolucionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly librosService: LibrosService,
  ) {}

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
        if (antecedente.estadoDocumental !== EstadoDocumentalRes.FIRMADO) {
          throw new BadRequestException(
            `La resolución antecedente "${antecedente.numeroCompleto}" aún está pendiente de firma digital (estado ${antecedente.estadoDocumental}). Debe estar FIRMADO para continuar.`,
          );
        }
      }

      const pendienteFirma = await tx.resolucion.findFirst({
        where: {
          expedienteId: expediente.id,
          ...(dto.tesistaId ? { tesistaId: dto.tesistaId } : {}),
          situacionJuridica: SituacionJuridicaRes.VIGENTE,
          estadoDocumental: EstadoDocumentalRes.EMITIDO,
        },
        select: { numeroCompleto: true },
      });

      if (pendienteFirma) {
        throw new BadRequestException(
          `No se puede avanzar al siguiente paso: la resolución "${pendienteFirma.numeroCompleto}" aún está pendiente de firma digital.`,
        );
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

      const datos = dto.datosEspecificos;

      // Validaciones de reglas de negocio en servidor (no confiar solo en frontend)
      if (
        dto.tipo === TipoResolucion.CAMBIO_DICTAMINANTE &&
        expediente.fechaHoraResolucionId
      ) {
        throw new BadRequestException(
          'No se puede cambiar dictaminantes porque el expediente ya tiene resolución de Fecha y Hora de Sustentación (Paso 6).',
        );
      }

      if (dto.tipo === TipoResolucion.APTO && !dto.tesistaId) {
        throw new BadRequestException(
          'La resolución de Apto (Paso 5) debe especificar el tesistaId correspondiente.',
        );
      }

      if (dto.tipo === TipoResolucion.TITULO) {
        if (!dto.tesistaId) {
          throw new BadRequestException(
            'La resolución de Título Profesional (Paso 7) debe especificar el tesistaId correspondiente.',
          );
        }
        const notaRaw = datos.notaSustentacion;
        if (notaRaw !== undefined && notaRaw !== null) {
          const notaNum = Number(notaRaw);
          if (!Number.isInteger(notaNum) || notaNum < 14 || notaNum > 20) {
            throw new BadRequestException(
              'La calificación de sustentación debe ser un número entero entre 14 y 20.',
            );
          }
        }
      }

      const usuarioId = await this.prisma.resolverUsuarioId(usuarioActual, tx);

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
          usuarioEmisorId: usuarioId,
        },
      });

      // Registrar asiento automático en el Libro de Numeración (categoría TITULACION)
      await tx.libroNumeracion.create({
        data: {
          numeroCompleto,
          numero: contador.ultimoNumero,
          anio: anioActual,
          serie,
          categoria: CategoriaNumeracion.TITULACION,
          tipoDocumentoExterno: null,
          descripcion: `${dto.tipo} - Expediente ${expediente.codigoExpediente}`,
          fechaDocumento: fechaEmision,
          registradoPorId: usuarioId,
          resolucionId: nuevaResolucion.id,
        },
      });

      const updateExpedienteData: Prisma.ExpedienteUpdateInput = {};
      const pasoSiguiente = PASO_SIGUIENTE_POR_TIPO[dto.tipo];
      if (pasoSiguiente !== undefined && pasoSiguiente > expediente.pasoActual) {
        updateExpedienteData.pasoActual = pasoSiguiente;
      }

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

      // Helper para marcar resolución antecedente como MODIFICADA en cambios
      const marcarAntecedenteModificada = async (motivo?: string) => {
        if (!dto.resolucionAntecedenteId) return;
        const ant = await tx.resolucion.findUnique({
          where: { id: dto.resolucionAntecedenteId },
          select: { id: true, situacionJuridica: true },
        });
        if (ant && ant.situacionJuridica === SituacionJuridicaRes.VIGENTE) {
          await tx.resolucion.update({
            where: { id: ant.id },
            data: { situacionJuridica: SituacionJuridicaRes.MODIFICADA },
          });
          await tx.dseAfectada.create({
            data: {
              resolucionDseId: nuevaResolucion.id,
              resolucionAfectadaId: ant.id,
              estadoPrevio: ant.situacionJuridica,
              tipoImpacto: TipoImpactoResolucion.MODIFICA,
              motivo: motivo ?? `Modificada por ${dto.tipo} (${numeroCompleto})`,
            },
          });
        }
      };

      switch (dto.tipo) {
        case TipoResolucion.ASESOR: {
          updateExpedienteData.asesorResolucionId = nuevaResolucion.id;
          if (typeof datos.asesorDocenteId === 'string') {
            updateExpedienteData.asesorDocenteId = datos.asesorDocenteId;
          }
          break;
        }
        case TipoResolucion.CAMBIO_ASESOR: {
          updateExpedienteData.asesorResolucionId = nuevaResolucion.id;
          if (typeof datos.asesorDocenteId === 'string') {
            updateExpedienteData.asesorDocenteId = datos.asesorDocenteId;
          }
          await marcarAntecedenteModificada(
            typeof datos.causaTextoConsolidadoSnapshot === 'string'
              ? datos.causaTextoConsolidadoSnapshot
              : undefined,
          );
          break;
        }
        case TipoResolucion.DICTAMEN:
        case TipoResolucion.TERCER_DICT: {
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
          await marcarAntecedenteModificada(
            typeof datos.causaTextoConsolidadoSnapshot === 'string'
              ? datos.causaTextoConsolidadoSnapshot
              : undefined,
          );
          break;
        }
        case TipoResolucion.INSCRIPCION: {
          updateExpedienteData.inscripcionResolucionId = nuevaResolucion.id;
          const tituloParaLibro =
            tituloDesdeDatos ||
            (typeof datos.tituloInscritoSnapshot === 'string'
              ? datos.tituloInscritoSnapshot.trim()
              : undefined) ||
            expediente.tituloActual ||
            undefined;
          if (tituloParaLibro) {
            const asientoInsc =
              await this.librosService.registrarAsientoInscripcionTx(tx, {
                expedienteId: expediente.id,
                resolucionInscripcionId: nuevaResolucion.id,
                anio: anioActual,
                fechaAsiento: fechaEmision,
                tituloOverride: tituloParaLibro,
              });
            updateExpedienteData.libroInscripcionId = asientoInsc.id;
          }
          break;
        }
        case TipoResolucion.FECHA_HORA: {
          updateExpedienteData.fechaHoraResolucionId = nuevaResolucion.id;
          break;
        }
        case TipoResolucion.CAMBIO_TITULO: {
          updateExpedienteData.tituloResolucionId = nuevaResolucion.id;
          await marcarAntecedenteModificada('Cambio de título de proyecto/tesis');
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
            const notaNum =
              datos.notaSustentacion !== undefined &&
              datos.notaSustentacion !== null
                ? Number(datos.notaSustentacion)
                : null;
            const fechaSustReal =
              typeof datos.fechaSustentacionReal === 'string' &&
              datos.fechaSustentacionReal.trim().length > 0
                ? new Date(datos.fechaSustentacionReal)
                : null;
            const resultadoSust =
              typeof datos.resultadoSustentacion === 'string' &&
              datos.resultadoSustentacion.trim().length > 0
                ? datos.resultadoSustentacion.trim().slice(0, 80)
                : null;

            await tx.tesista.update({
              where: { id: dto.tesistaId },
              data: {
                tituloResolucionId: nuevaResolucion.id,
                ...(fechaSustReal ? { fechaSustentacionReal: fechaSustReal } : {}),
                ...(notaNum !== null ? { notaSustentacion: notaNum } : {}),
                ...(resultadoSust ? { resultadoSustentacion: resultadoSust } : {}),
              },
            });

            // Registrar en Libro de Títulos (manteniendo estado APTO hasta que se firme el PDF)
            const expEscuela = await tx.escuelaProfesional.findUnique({
              where: { id: expediente.escuelaProfesionalId },
            });
            const tesistaObj = await tx.tesista.findUnique({
              where: { id: dto.tesistaId },
              include: { persona: true },
            });
            if (expEscuela && tesistaObj) {
              const contTit = await tx.contadorLibroTitulo.upsert({
                where: {
                  escuelaProfesionalId_anio: {
                    escuelaProfesionalId: expediente.escuelaProfesionalId,
                    anio: anioActual,
                  },
                },
                update: { ultimoRegistro: { increment: 1 } },
                create: {
                  escuelaProfesionalId: expediente.escuelaProfesionalId,
                  anio: anioActual,
                  ultimoRegistro: 1,
                },
              });
              await tx.libroTitulo.create({
                data: {
                  tesistaId: tesistaObj.id,
                  numeroRegistro: contTit.ultimoRegistro,
                  anioRegistro: anioActual,
                  expedienteId: expediente.id,
                  resolucionTituloId: nuevaResolucion.id,
                  escuelaProfesionalId: expediente.escuelaProfesionalId,
                  tituladoTexto: tesistaObj.persona.nombreCompleto.slice(0, 250),
                  denominacionOtorgada: expEscuela.tituloProfesional.slice(0, 200),
                  fechaSustentacion: fechaSustReal,
                  notaNumero: notaNum,
                  notaCalificativo: resultadoSust,
                  informeConformidadSA:
                    typeof datos.informeConformidadSA === 'string'
                      ? datos.informeConformidadSA.slice(0, 100)
                      : null,
                  estado: 'VIGENTE',
                },
              });
            }
          }
          break;
        }
        case TipoResolucion.DESISTIMIENTO: {
          const idDesistente =
            dto.tesistaId ||
            (typeof datos.tesistaDesistenteId === 'string'
              ? datos.tesistaDesistenteId
              : undefined);
          if (idDesistente) {
            const pertenece = expediente.tesistas.some((t) => t.id === idDesistente);
            if (!pertenece) {
              throw new BadRequestException(
                'El tesista indicado para desistimiento no pertenece a este expediente.',
              );
            }
            await tx.tesista.update({
              where: { id: idDesistente },
              data: { estado: EstadoTesista.DESISTIDO },
            });
          }
          break;
        }
        case TipoResolucion.DSE: {
          const afectadasRaw = Array.isArray(datos.resolucionesAfectadasIds)
            ? datos.resolucionesAfectadasIds.filter(
                (v): v is string => typeof v === 'string' && v.trim().length > 0,
              )
            : [];
          const motivoDse =
            typeof datos.causaTextoConsolidadoSnapshot === 'string'
              ? datos.causaTextoConsolidadoSnapshot
              : 'Dejada sin efecto mediante DSE';

          if (afectadasRaw.length > 0) {
            const resolucionesAfectadas = await tx.resolucion.findMany({
              where: {
                id: { in: afectadasRaw },
                expedienteId: expediente.id,
              },
            });

            const idsAfectadosSet = new Set(resolucionesAfectadas.map((r) => r.id));

            for (const resAf of resolucionesAfectadas) {
              if (resAf.situacionJuridica !== SituacionJuridicaRes.SIN_EFECTO) {
                await tx.resolucion.update({
                  where: { id: resAf.id },
                  data: { situacionJuridica: SituacionJuridicaRes.SIN_EFECTO },
                });
                await tx.dseAfectada.create({
                  data: {
                    resolucionDseId: nuevaResolucion.id,
                    resolucionAfectadaId: resAf.id,
                    estadoPrevio: resAf.situacionJuridica,
                    tipoImpacto: TipoImpactoResolucion.DEJA_SIN_EFECTO,
                    motivo: motivoDse,
                  },
                });
              }
            }

            if (expediente.asesorResolucionId && idsAfectadosSet.has(expediente.asesorResolucionId)) {
              updateExpedienteData.asesorResolucionId = null;
              updateExpedienteData.asesorDocenteId = null;
            }
            if (expediente.dictaminantesResolucionId && idsAfectadosSet.has(expediente.dictaminantesResolucionId)) {
              updateExpedienteData.dictaminantesResolucionId = null;
              updateExpedienteData.dictaminante1Id = null;
              updateExpedienteData.dictaminante2Id = null;
              updateExpedienteData.dictaminante3Id = null;
            }
            if (expediente.inscripcionResolucionId && idsAfectadosSet.has(expediente.inscripcionResolucionId)) {
              updateExpedienteData.inscripcionResolucionId = null;
            }
            if (expediente.fechaHoraResolucionId && idsAfectadosSet.has(expediente.fechaHoraResolucionId)) {
              updateExpedienteData.fechaHoraResolucionId = null;
            }
            if (expediente.tituloResolucionId && idsAfectadosSet.has(expediente.tituloResolucionId)) {
              updateExpedienteData.tituloResolucionId = null;
            }

            // Limpiar punteros individuales de tesistas si se anuló APTO o TITULO
            await tx.tesista.updateMany({
              where: {
                expedienteId: expediente.id,
                aptoResolucionId: { in: Array.from(idsAfectadosSet) },
              },
              data: { aptoResolucionId: null, estado: EstadoTesista.ACTIVO },
            });
            await tx.tesista.updateMany({
              where: {
                expedienteId: expediente.id,
                tituloResolucionId: { in: Array.from(idsAfectadosSet) },
              },
              data: { tituloResolucionId: null, estado: EstadoTesista.APTO },
            });
          }

          if (datos.reinicioIntegral === true) {
            updateExpedienteData.pasoActual = 1;
            updateExpedienteData.asesorResolucionId = null;
            updateExpedienteData.asesorDocenteId = null;
            updateExpedienteData.dictaminantesResolucionId = null;
            updateExpedienteData.dictaminante1Id = null;
            updateExpedienteData.dictaminante2Id = null;
            updateExpedienteData.dictaminante3Id = null;
            updateExpedienteData.inscripcionResolucionId = null;
            updateExpedienteData.fechaHoraResolucionId = null;
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

      await tx.registroAuditoria.create({
        data: {
          usuarioId,
          inicialesUsuario: usuarioActual.iniciales || 'OP',
          accion:
            dto.tipo === TipoResolucion.DSE
              ? 'DEJAR_SIN_EFECTO'
              : 'EMITIR_RESOLUCION',
          entidad: 'resoluciones',
          entidadId: nuevaResolucion.id,
          expedienteId: expediente.id,
          resolucionId: nuevaResolucion.id,
          detalle: {
            ejecutorIdJwt: usuarioActual.sub,
            tipo: dto.tipo,
            serie,
            numeroCompleto,
            codigoExpediente: expediente.codigoExpediente,
            tesistaId: dto.tesistaId ?? null,
            resolucionAntecedenteId: dto.resolucionAntecedenteId ?? null,
          },
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