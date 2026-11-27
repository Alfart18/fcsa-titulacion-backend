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
      if (!dto.resolucionAsesor.nombreAsesor?.trim() && !dto.resolucionAsesor.asesorDocenteId) throw new BadRequestException('La resolución histórica de asesor debe incluir el nombre del asesor o su identificador de docente.');
    }

    if (pasoActual >= 3) {
      if (!dto.resolucionDictaminantes) throw new BadRequestException('Para iniciar un expediente en un paso mayor o igual a 3, es obligatorio registrar la resolución histórica de designación de dictaminantes.');
      const tieneDictaminantesTexto = Boolean(dto.resolucionDictaminantes.nombreDictaminantes?.trim()) || (Boolean(dto.resolucionDictaminantes.nombreDictaminante1?.trim()) && Boolean(dto.resolucionDictaminantes.nombreDictaminante2?.trim()));
      const tieneDictaminantesIds = Boolean(dto.resolucionDictaminantes.dictaminante1Id) && Boolean(dto.resolucionDictaminantes.dictaminante2Id);
      if (!tieneDictaminantesTexto && !tieneDictaminantesIds) throw new BadRequestException('La resolución histórica de dictaminantes debe especificar los nombres o identificadores de los dictaminantes.');
    }

    if (pasoActual >= 4) {
      if (!dto.resolucionInscripcion) throw new BadRequestException('Para iniciar un expediente en un paso mayor o igual a 4, es obligatorio registrar la resolución histórica de inscripción del proyecto (Paso 3).');
    }

    if (pasoActual >= 5) {
      if (!dto.resolucionTercerDictaminante) throw new BadRequestException('Para iniciar un expediente en un paso mayor o igual a 5, es obligatorio registrar la resolución histórica del tercer dictaminante (Paso 4).');
      if (!dto.resolucionTercerDictaminante.nombreDictaminante3?.trim() && !dto.resolucionTercerDictaminante.dictaminante3Id) {
        throw new BadRequestException('La resolución histórica de tercer dictaminante debe especificar el nombre o identificador del tercer dictaminante.');
      }
    }

    if (pasoActual >= 6) {
      if (!dto.resolucionApto) throw new BadRequestException('Para iniciar un expediente en un paso mayor o igual a 6, es obligatorio registrar la resolución histórica de Apto para Título Profesional (Paso 5).');
    }

    if (pasoActual >= 7) {
      if (!dto.resolucionFechaHora) throw new BadRequestException('Para iniciar un expediente en el paso 7, es obligatorio registrar la resolución histórica de Fecha y Hora de Sustentación (Paso 6).');
    }

    // Validar que no se repitan números de resolución entre los antecedentes históricos enviados
    const numerosHistoricos = [
      pasoActual >= 2 ? dto.resolucionAsesor?.numeroCompleto : undefined,
      pasoActual >= 3 ? dto.resolucionDictaminantes?.numeroCompleto : undefined,
      pasoActual >= 4 ? dto.resolucionInscripcion?.numeroCompleto : undefined,
      pasoActual >= 5 ? dto.resolucionTercerDictaminante?.numeroCompleto : undefined,
      pasoActual >= 6 ? dto.resolucionApto?.numeroCompleto : undefined,
      pasoActual >= 6 && dto.cantidadTesistas === 2 ? dto.resolucionAptoTesista2?.numeroCompleto : undefined,
      pasoActual >= 7 ? dto.resolucionFechaHora?.numeroCompleto : undefined,
    ]
      .filter((n): n is string => Boolean(n && n.trim().length > 0))
      .map((n) => n.trim().toUpperCase());

    const numerosUnicos = new Set(numerosHistoricos);
    if (numerosUnicos.size !== numerosHistoricos.length) {
      throw new BadRequestException('Los números de las resoluciones históricas previas no pueden repetirse entre sí.');
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

      const usuarioId = await this.prisma.resolverUsuarioId(usuarioActual, tx);

      const expediente = await tx.expediente.create({
        data: {
          codigoExpediente, escuelaProfesionalId: dto.escuelaProfesionalId, estado: EstadoExpediente.EN_PROCESO, cantidadTesistas: dto.cantidadTesistas, pasoActual, tituloActual: tituloInicial, creadoPorId: usuarioId,
        },
      });

      const tesistasCreados: Array<{ id: string; orden: number }> = [];

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

        const tesistaCreado = await tx.tesista.create({ data: { expedienteId: expediente.id, personaId: persona.id, orden: i + 1, estado: EstadoTesista.ACTIVO } });
        tesistasCreados.push({ id: tesistaCreado.id, orden: tesistaCreado.orden });
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
      let dictaminante3Id: string | null = null;
      let inscripcionResolucionId: string | null = null;
      let fechaHoraResolucionId: string | null = null;

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
            datosEspecificos: {
              origen: 'HISTORICO',
              nombreAsesor: dto.resolucionAsesor.nombreAsesor?.trim() ?? null,
              asesorNombreCompletoSnapshot: dto.resolucionAsesor.nombreAsesor?.trim() ?? null,
              asesorDocenteId: dto.resolucionAsesor.asesorDocenteId ?? null,
              tituloTesis: dto.resolucionAsesor.tituloTesis?.trim() ?? null,
            },
            idTramiteControl: idTramiteAsesor, versionPdf: 1, hashVersionGenerado: hashAsesor, usuarioEmisorId: usuarioId,
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
            resolucionAntecedenteId: asesorResolucionId,
            situacionJuridica: SituacionJuridicaRes.VIGENTE, estadoDocumental: EstadoDocumentalRes.FIRMADO, origen: OrigenResolucion.HISTORICO, fechaEmision: fechaEmisionDict, nombreDecanoSnapshot, inicialesOperador,
            datosEspecificos: {
              origen: 'HISTORICO',
              nombreDictaminantes: dto.resolucionDictaminantes.nombreDictaminantes?.trim() ?? null,
              nombreDictaminante1: dto.resolucionDictaminantes.nombreDictaminante1?.trim() ?? null,
              dictaminante1Snapshot: dto.resolucionDictaminantes.nombreDictaminante1?.trim() ?? null,
              nombreDictaminante2: dto.resolucionDictaminantes.nombreDictaminante2?.trim() ?? null,
              dictaminante2Snapshot: dto.resolucionDictaminantes.nombreDictaminante2?.trim() ?? null,
              dictaminante1Id: dto.resolucionDictaminantes.dictaminante1Id ?? null,
              dictaminante2Id: dto.resolucionDictaminantes.dictaminante2Id ?? null,
              tituloTesis: dto.resolucionDictaminantes.tituloTesis?.trim() ?? tituloInicial,
            },
            idTramiteControl: idTramiteDict, versionPdf: 1, hashVersionGenerado: hashDict, usuarioEmisorId: usuarioId,
          },
        });
        dictaminantesResolucionId = resolucionDictamen.id;
        tituloResolucionId = resolucionDictamen.id;
        dictaminante1Id = dto.resolucionDictaminantes.dictaminante1Id ?? null;
        dictaminante2Id = dto.resolucionDictaminantes.dictaminante2Id ?? null;
      }

      if (pasoActual >= 4 && dto.resolucionInscripcion) {
        const numeroCompletoInsc = dto.resolucionInscripcion.numeroCompleto.trim();
        const duplicadaInsc = await tx.resolucion.findUnique({ where: { numeroCompleto: numeroCompletoInsc } });
        if (duplicadaInsc) throw new ConflictException(`El número de resolución "${numeroCompletoInsc}" ya se encuentra registrado en el sistema.`);

        const fechaEmisionInsc = new Date(dto.resolucionInscripcion.fechaEmision);
        const anioInsc = fechaEmisionInsc.getUTCFullYear();
        const correlativoHistoricoInsc = await this.obtenerSiguienteCorrelativoHistorico(tx, SerieNumeracion.ORD, anioInsc);
        const idTramiteInsc = `HIST-INSCRIPCION-${randomUUID()}`;
        const hashInsc = this.generarHashHistorico(`${expediente.id}:${numeroCompletoInsc}:${idTramiteInsc}`);

        const resolucionInscripcion = await tx.resolucion.create({
          data: {
            expedienteId: expediente.id, tipo: TipoResolucion.INSCRIPCION, serie: SerieNumeracion.ORD, numeroCorrelativo: correlativoHistoricoInsc, anioNumeracion: anioInsc, numeroCompleto: numeroCompletoInsc,
            resolucionAntecedenteId: dictaminantesResolucionId,
            situacionJuridica: SituacionJuridicaRes.VIGENTE, estadoDocumental: EstadoDocumentalRes.FIRMADO, origen: OrigenResolucion.HISTORICO, fechaEmision: fechaEmisionInsc, nombreDecanoSnapshot, inicialesOperador,
            datosEspecificos: {
              origen: 'HISTORICO',
              tituloTesis: dto.resolucionInscripcion.tituloTesis?.trim() ?? tituloInicial,
            },
            idTramiteControl: idTramiteInsc, versionPdf: 1, hashVersionGenerado: hashInsc, usuarioEmisorId: usuarioId,
          },
        });
        inscripcionResolucionId = resolucionInscripcion.id;
      }

      if (pasoActual >= 5 && dto.resolucionTercerDictaminante) {
        const numeroCompletoTD = dto.resolucionTercerDictaminante.numeroCompleto.trim();
        const duplicadaTD = await tx.resolucion.findUnique({ where: { numeroCompleto: numeroCompletoTD } });
        if (duplicadaTD) throw new ConflictException(`El número de resolución "${numeroCompletoTD}" ya se encuentra registrado en el sistema.`);

        const fechaEmisionTD = new Date(dto.resolucionTercerDictaminante.fechaEmision);
        const anioTD = fechaEmisionTD.getUTCFullYear();
        const correlativoHistoricoTD = await this.obtenerSiguienteCorrelativoHistorico(tx, SerieNumeracion.ORD, anioTD);
        const idTramiteTD = `HIST-TERCER-DICT-${randomUUID()}`;
        const hashTD = this.generarHashHistorico(`${expediente.id}:${numeroCompletoTD}:${idTramiteTD}`);

        const resolucionTercerDict = await tx.resolucion.create({
          data: {
            expedienteId: expediente.id, tipo: TipoResolucion.TERCER_DICT, serie: SerieNumeracion.ORD, numeroCorrelativo: correlativoHistoricoTD, anioNumeracion: anioTD, numeroCompleto: numeroCompletoTD,
            resolucionAntecedenteId: inscripcionResolucionId ?? dictaminantesResolucionId,
            situacionJuridica: SituacionJuridicaRes.VIGENTE, estadoDocumental: EstadoDocumentalRes.FIRMADO, origen: OrigenResolucion.HISTORICO, fechaEmision: fechaEmisionTD, nombreDecanoSnapshot, inicialesOperador,
            datosEspecificos: {
              origen: 'HISTORICO',
              dictaminante1Snapshot: dto.resolucionDictaminantes?.nombreDictaminante1?.trim() ?? null,
              dictaminante2Snapshot: dto.resolucionDictaminantes?.nombreDictaminante2?.trim() ?? null,
              nombreDictaminante3: dto.resolucionTercerDictaminante.nombreDictaminante3?.trim() ?? null,
              dictaminante3Snapshot: dto.resolucionTercerDictaminante.nombreDictaminante3?.trim() ?? null,
              dictaminante3Id: dto.resolucionTercerDictaminante.dictaminante3Id ?? null,
            },
            idTramiteControl: idTramiteTD, versionPdf: 1, hashVersionGenerado: hashTD, usuarioEmisorId: usuarioId,
          },
        });
        dictaminante3Id = dto.resolucionTercerDictaminante.dictaminante3Id ?? null;
        dictaminantesResolucionId = resolucionTercerDict.id;
      }

      if (pasoActual >= 6 && dto.resolucionApto && tesistasCreados.length > 0) {
        const crearAptoHistorico = async (resDto: NonNullable<CrearExpedienteDto['resolucionApto']>, tesistaId: string) => {
          const numeroCompletoApto = resDto.numeroCompleto.trim();
          const duplicadaApto = await tx.resolucion.findUnique({ where: { numeroCompleto: numeroCompletoApto } });
          if (duplicadaApto) throw new ConflictException(`El número de resolución "${numeroCompletoApto}" ya se encuentra registrado en el sistema.`);

          const fechaEmisionApto = new Date(resDto.fechaEmision);
          const anioApto = fechaEmisionApto.getUTCFullYear();
          const correlativoHistoricoApto = await this.obtenerSiguienteCorrelativoHistorico(tx, SerieNumeracion.CF, anioApto);
          const idTramiteApto = `HIST-APTO-${randomUUID()}`;
          const hashApto = this.generarHashHistorico(`${expediente.id}:${tesistaId}:${numeroCompletoApto}:${idTramiteApto}`);

          return tx.resolucion.create({
            data: {
              expedienteId: expediente.id, tesistaId, tipo: TipoResolucion.APTO, serie: SerieNumeracion.CF, numeroCorrelativo: correlativoHistoricoApto, anioNumeracion: anioApto, numeroCompleto: numeroCompletoApto,
              resolucionAntecedenteId: dictaminantesResolucionId,
              situacionJuridica: SituacionJuridicaRes.VIGENTE, estadoDocumental: EstadoDocumentalRes.FIRMADO, origen: OrigenResolucion.HISTORICO, fechaEmision: fechaEmisionApto, nombreDecanoSnapshot, inicialesOperador,
              datosEspecificos: { origen: 'HISTORICO' },
              idTramiteControl: idTramiteApto, versionPdf: 1, hashVersionGenerado: hashApto, usuarioEmisorId: usuarioId,
            },
          });
        };

        const resApto1 = await crearAptoHistorico(dto.resolucionApto, tesistasCreados[0].id);
        await tx.tesista.update({
          where: { id: tesistasCreados[0].id },
          data: { aptoResolucionId: resApto1.id, estado: EstadoTesista.APTO },
        });

        if (tesistasCreados.length === 2) {
          if (dto.resolucionAptoTesista2?.numeroCompleto?.trim()) {
            const resApto2 = await crearAptoHistorico(dto.resolucionAptoTesista2, tesistasCreados[1].id);
            await tx.tesista.update({
              where: { id: tesistasCreados[1].id },
              data: { aptoResolucionId: resApto2.id, estado: EstadoTesista.APTO },
            });
          } else {
            await tx.tesista.update({
              where: { id: tesistasCreados[1].id },
              data: { aptoResolucionId: resApto1.id, estado: EstadoTesista.APTO },
            });
          }
        }
      }

      if (pasoActual >= 7 && dto.resolucionFechaHora) {
        const numeroCompletoFH = dto.resolucionFechaHora.numeroCompleto.trim();
        const duplicadaFH = await tx.resolucion.findUnique({ where: { numeroCompleto: numeroCompletoFH } });
        if (duplicadaFH) throw new ConflictException(`El número de resolución "${numeroCompletoFH}" ya se encuentra registrado en el sistema.`);

        const fechaEmisionFH = new Date(dto.resolucionFechaHora.fechaEmision);
        const anioFH = fechaEmisionFH.getUTCFullYear();
        const correlativoHistoricoFH = await this.obtenerSiguienteCorrelativoHistorico(tx, SerieNumeracion.ORD, anioFH);
        const idTramiteFH = `HIST-FECHA-HORA-${randomUUID()}`;
        const hashFH = this.generarHashHistorico(`${expediente.id}:${numeroCompletoFH}:${idTramiteFH}`);

        const resolucionFechaHora = await tx.resolucion.create({
          data: {
            expedienteId: expediente.id, tipo: TipoResolucion.FECHA_HORA, serie: SerieNumeracion.ORD, numeroCorrelativo: correlativoHistoricoFH, anioNumeracion: anioFH, numeroCompleto: numeroCompletoFH,
            situacionJuridica: SituacionJuridicaRes.VIGENTE, estadoDocumental: EstadoDocumentalRes.FIRMADO, origen: OrigenResolucion.HISTORICO, fechaEmision: fechaEmisionFH, nombreDecanoSnapshot, inicialesOperador,
            datosEspecificos: {
              origen: 'HISTORICO',
              fechaSustentacion: dto.resolucionFechaHora.fechaSustentacion ?? null,
              horaSustentacion: dto.resolucionFechaHora.horaSustentacion?.trim() ?? null,
              modalidadSustentacion: dto.resolucionFechaHora.modalidadSustentacion?.trim() ?? null,
              lugarSustentacion: dto.resolucionFechaHora.lugarSustentacion?.trim() ?? null,
            },
            idTramiteControl: idTramiteFH, versionPdf: 1, hashVersionGenerado: hashFH, usuarioEmisorId: usuarioId,
          },
        });
        fechaHoraResolucionId = resolucionFechaHora.id;
      }

      if (asesorResolucionId || dictaminantesResolucionId || inscripcionResolucionId || fechaHoraResolucionId) {
        await tx.expediente.update({
          where: { id: expediente.id },
          data: {
            asesorResolucionId,
            asesorDocenteId,
            dictaminantesResolucionId,
            tituloResolucionId,
            dictaminante1Id,
            dictaminante2Id,
            dictaminante3Id,
            inscripcionResolucionId,
            fechaHoraResolucionId,
          },
        });
      }

      await tx.registroAuditoria.create({
        data: {
          usuarioId,
          inicialesUsuario: usuarioActual.iniciales || 'OP',
          accion: 'CREAR_EXPEDIENTE',
          entidad: 'expedientes',
          entidadId: expediente.id,
          expedienteId: expediente.id,
          detalle: {
            ejecutorIdJwt: usuarioActual.sub,
            codigoExpediente: expediente.codigoExpediente,
            escuelaProfesionalId: dto.escuelaProfesionalId,
            cantidadTesistas: dto.cantidadTesistas,
            pasoInicial: pasoActual,
          },
        },
      });

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

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoExpedienteDto,
    usuarioActual?: JwtPayload,
  ): Promise<ExpedienteDetalleResponse> {
    const actual = await this.prisma.expediente.findUnique({
      where: { id },
      select: { id: true, codigoExpediente: true, estado: true },
    });
    if (!actual) throw new NotFoundException(`No se encontró el expediente con ID "${id}".`);

    await this.prisma.$transaction(async (tx) => {
      await tx.expediente.update({ where: { id }, data: { estado: dto.estado } });
      if (usuarioActual) {
        const usuarioId = await this.prisma.resolverUsuarioId(usuarioActual, tx);
        await tx.registroAuditoria.create({
          data: {
            usuarioId,
            inicialesUsuario: usuarioActual.iniciales || 'OP',
            accion: 'CAMBIAR_ESTADO_EXPEDIENTE',
            entidad: 'expedientes',
            entidadId: id,
            expedienteId: id,
            detalle: {
              ejecutorIdJwt: usuarioActual.sub,
              codigoExpediente: actual.codigoExpediente,
              estadoAnterior: actual.estado,
              estadoNuevo: dto.estado,
            },
          },
        });
      }
    });

    return this.obtenerPorId(id);
  }
}