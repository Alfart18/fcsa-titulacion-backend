import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/database';
import {
  CategoriaNumeracion,
  EstadoDocente,
  EstadoDocumentalRes,
  EstadoExpediente,
  EstadoTesista,
  EstadoUsuario,
  OrigenResolucion,
  Prisma,
  RolUsuario,
  SerieNumeracion,
  SituacionJuridicaRes,
  TipoResolucion,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as crypto from 'crypto';
import {
  EmitirPasoFlujoBodyDto,
  ValidarPaso1AsesorDto,
  ValidarPaso2DictamenDto,
  ValidarPaso4TercerDictDto,
  ValidarPaso5AptoDto,
  ValidarPaso6FechaHoraDto,
  ValidarPaso7TituloDto,
} from './dto/emitir-paso-flujo.dto';

@Injectable()
export class ResolucionesService {
  constructor(private readonly prisma: PrismaService) {}

  private async validarDtoEspecifico<T extends object>(cls: new () => T, payload: object): Promise<T> {
    const instance = plainToInstance(cls, payload);
    const errors = await validate(instance);
    if (errors.length > 0) {
      const mensajes = errors
        .flatMap((e) => (e.constraints ? Object.values(e.constraints) : []))
        .join(' | ');
      throw new BadRequestException(mensajes || 'Datos de entrada inválidos para este paso.');
    }
    return instance;
  }

  private validarFechaNoFutura(fechaStr?: string, nombreCampo = 'fecha de emisión'): Date {
    const hoyStr = new Date().toISOString().slice(0, 10);
    const fechaFinalStr = fechaStr ? fechaStr.slice(0, 10) : hoyStr;
    if (fechaFinalStr > hoyStr) {
      throw new BadRequestException(
        `Regla normativa: La ${nombreCampo} (${fechaFinalStr}) no puede ser una fecha futura.`,
      );
    }
    return new Date(`${fechaFinalStr}T00:00:00.000Z`);
  }

  /**
   * Deriva automáticamente la mención oficial según la nota entera (14 a 20).
   * Regla RB-TP-12: El resultado no puede ser modificado manualmente.
   */
  private calcularMencionTitulo(nota: number): string {
    if (!Number.isInteger(nota) || nota < 14 || nota > 20) {
      throw new BadRequestException(
        'Bloqueo normativo (Paso 7): La nota debe ser un número entero entre 14 y 20.',
      );
    }
    if (nota >= 14 && nota <= 16) {
      return 'APROBADO';
    }
    if (nota === 17 || nota === 18) {
      return 'APROBADO CON DISTINCIÓN';
    }
    return 'APROBADO CON DISTINCIÓN Y FELICITACIÓN PÚBLICA';
  }

  private generarHashVersionSha256(payload: Record<string, unknown>): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();
  }

  private async exigirResolucionPreviaFirmada(
    tx: Prisma.TransactionClient,
    resolucionId: string | null,
    nombreEtapaPrevia: string,
  ) {
    if (!resolucionId) {
      throw new BadRequestException(
        `Prerrequisito incumplido: El expediente no cuenta con la resolución previa de ${nombreEtapaPrevia}.`,
      );
    }

    const resPrevia = await tx.resolucion.findUnique({
      where: { id: resolucionId },
    });

    if (!resPrevia || resPrevia.situacionJuridica !== SituacionJuridicaRes.VIGENTE) {
      throw new BadRequestException(
        `Prerrequisito incumplido: La resolución de ${nombreEtapaPrevia} no se encuentra VIGENTE.`,
      );
    }

    if (resPrevia.estadoDocumental !== EstadoDocumentalRes.FIRMADO) {
      throw new BadRequestException(
        `Candado de Firma Activo: La resolución ${resPrevia.numeroCompleto} (${nombreEtapaPrevia}) se encuentra en estado EMITIDO. Debe estar en estado FIRMADO para habilitar el siguiente paso.`,
      );
    }

    return resPrevia;
  }

  async reservarSiguienteNumeroSerieAtomico(
    tx: Prisma.TransactionClient,
    serie: SerieNumeracion,
  ): Promise<{
    numeroCorrelativo: number;
    anio: number;
    numeroCompleto: string;
    idTramiteControl: string;
  }> {
    const anioActual = new Date().getFullYear();

    await tx.$executeRaw`
      INSERT INTO contadores_serie (anio, serie, ultimo_numero, actualizado_en)
      VALUES (${anioActual}::SMALLINT, ${serie}::"SerieNumeracion", 0, NOW())
      ON CONFLICT (anio, serie) DO NOTHING
    `;

    const filas = await tx.$queryRaw<Array<{ ultimo_numero: number }>>`
      SELECT ultimo_numero
      FROM contadores_serie
      WHERE anio = ${anioActual}::SMALLINT
        AND serie = ${serie}::"SerieNumeracion"
      FOR UPDATE
    `;

    const siguienteNumero = Number(filas[0].ultimo_numero) + 1;

    await tx.contadorSerie.update({
      where: {
        anio_serie: {
          anio: anioActual,
          serie,
        },
      },
      data: { ultimoNumero: siguienteNumero },
    });

    const config = await tx.configuracionInstitucional.findFirst();
    const siglasFac = config?.siglasFacultad || 'FCSa';
    const siglasUni = config?.siglasUniversidad || 'UAC';
    const nnnn = String(siguienteNumero).padStart(4, '0');

    const numeroCompleto =
      serie === SerieNumeracion.CF
        ? `${nnnn}-${anioActual}-CF-${siglasFac}-${siglasUni}`
        : `${nnnn}-${anioActual}-${siglasFac}-${siglasUni}`;

    const idTramiteControl = `TRM-${anioActual}-${serie}-${nnnn}`;

    return {
      numeroCorrelativo: siguienteNumero,
      anio: anioActual,
      numeroCompleto,
      idTramiteControl,
    };
  }

  private async generarAsientoLibroInscripcionAtomico(
    tx: Prisma.TransactionClient,
    params: {
      escuelaProfesionalId: number;
      expedienteId: string;
      resolucionInscripcionId: string;
      tituloInscritoSnapshot: string;
      tesistasSnapshot: string;
      asesorSnapshot: string;
      fechaAsiento: Date;
    },
  ) {
    const anio = params.fechaAsiento.getUTCFullYear();

    await tx.$executeRaw`
      INSERT INTO contadores_libro_inscripcion (escuela_profesional_id, anio, ultimo_asiento, actualizado_en)
      VALUES (${params.escuelaProfesionalId}::INTEGER, ${anio}::SMALLINT, 0, NOW())
      ON CONFLICT (escuela_profesional_id, anio) DO NOTHING
    `;

    const filas = await tx.$queryRaw<Array<{ ultimo_asiento: number }>>`
      SELECT ultimo_asiento
      FROM contadores_libro_inscripcion
      WHERE escuela_profesional_id = ${params.escuelaProfesionalId}::INTEGER
        AND anio = ${anio}::SMALLINT
      FOR UPDATE
    `;

    const siguienteAsiento = Number(filas[0].ultimo_asiento) + 1;

    await tx.contadorLibroInscripcion.update({
      where: {
        escuelaProfesionalId_anio: {
          escuelaProfesionalId: params.escuelaProfesionalId,
          anio,
        },
      },
      data: { ultimoAsiento: siguienteAsiento },
    });

    const numeroFolioFormateado = `LIB-EP${params.escuelaProfesionalId}-${anio}-${String(
      siguienteAsiento,
    ).padStart(4, '0')}`;

    return tx.libroInscripcion.create({
      data: {
        escuelaProfesionalId: params.escuelaProfesionalId,
        numeroAsiento: siguienteAsiento,
        anio,
        numeroFolioFormateado,
        expedienteId: params.expedienteId,
        resolucionInscripcionId: params.resolucionInscripcionId,
        tituloInscritoSnapshot: params.tituloInscritoSnapshot,
        tesistasSnapshot: params.tesistasSnapshot,
        asesorSnapshot: params.asesorSnapshot,
        estadoAsiento: 'ACTIVO',
        fechaAsiento: params.fechaAsiento,
      },
    });
  }

  private async obtenerSnapshotDecanoFirmante(tx: Prisma.TransactionClient): Promise<string> {
    const decano = await tx.usuario.findFirst({
      where: {
        rol: RolUsuario.DECANO,
        estado: EstadoUsuario.ACTIVO,
        esDecanoFirmante: true,
      },
    });

    if (!decano) {
      throw new BadRequestException(
        'No existe un usuario con rol DECANO activo marcado con esDecanoFirmante = true.',
      );
    }

    return `${decano.gradoTitulo} ${decano.nombresCompletos}`;
  }

  /**
   * Emisión transaccional de los 7 Pasos Secuenciales:
   * - Paso 1: ASESOR (ORD)
   * - Paso 2: DICTAMEN (ORD)
   * - Paso 3: INSCRIPCION (ORD + LibroInscripcion)
   * - Paso 4: TERCER_DICT (ORD)
   * - Paso 5: APTO (CF - Individual por Tesista)
   * - Paso 6: FECHA_HORA (ORD - Jurado de 4 miembros, bloquea dictaminantes)
   * - Paso 7: TITULO (CF - Individual por Tesista, Nota 14-20 y mención automática)
   */
  async emitirPasoFlujoRegular(
    expedienteId: string,
    tipoParam: string,
    body: EmitirPasoFlujoBodyDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const tipoNormalizado = tipoParam.trim().toUpperCase() as TipoResolucion;
    const pasosFlujoRegular: TipoResolucion[] = [
      TipoResolucion.ASESOR,
      TipoResolucion.DICTAMEN,
      TipoResolucion.INSCRIPCION,
      TipoResolucion.TERCER_DICT,
      TipoResolucion.APTO,
      TipoResolucion.FECHA_HORA,
      TipoResolucion.TITULO,
    ];

    if (!pasosFlujoRegular.includes(tipoNormalizado)) {
      throw new BadRequestException(
        `El tipo de paso '${tipoParam}' no es válido. Pasos permitidos: ${pasosFlujoRegular.join(', ')}.`,
      );
    }

    const fechaEmision = this.validarFechaNoFutura(body.fechaEmision, 'fecha de emisión');
    const fechaEmisionStr = fechaEmision.toISOString().slice(0, 10);

    // Determinar automáticamente la serie oficial según el paso (ORD vs CF)
    const pasosConSerieCF: TipoResolucion[] = [TipoResolucion.APTO, TipoResolucion.TITULO];
    const serieCorrespondiente: SerieNumeracion = pasosConSerieCF.includes(tipoNormalizado)
      ? SerieNumeracion.CF
      : SerieNumeracion.ORD;

    return this.prisma.$transaction(async (tx) => {
      // 1. Bloquear la fila del expediente para evitar condiciones de carrera
      await tx.$queryRaw`SELECT id FROM expedientes WHERE id = ${expedienteId}::UUID FOR UPDATE`;

      const expediente = await tx.expediente.findUnique({
        where: { id: expedienteId },
        include: {
          escuelaProfesional: true,
          tesistas: {
            where: { estado: { not: EstadoTesista.DESISTIDO } },
            orderBy: { orden: 'asc' },
          },
        },
      });

      if (!expediente) {
        throw new NotFoundException('El expediente indicado no existe.');
      }

      if (expediente.estado !== EstadoExpediente.ACTIVO) {
        throw new BadRequestException(
          `El expediente ${expediente.codigoExpediente} se encuentra en estado ${expediente.estado} y no admite nuevas resoluciones.`,
        );
      }

      if (expediente.tesistas.length === 0) {
        throw new BadRequestException('El expediente no cuenta con tesistas activos.');
      }

      const nombreDecanoSnapshot = await this.obtenerSnapshotDecanoFirmante(tx);

      const tesistasSnapshot = expediente.tesistas.map((t) => ({
        id: t.id,
        orden: t.orden,
        nombresApellidos: t.nombresApellidos,
        codigoEstudiante: t.codigoEstudiante,
      }));
      const textoTesistasSnapshot = expediente.tesistas
        .map((t) => `${t.nombresApellidos} (Código: ${t.codigoEstudiante})`)
        .join(' y ');

      let resolucionAntecedenteId: string | null = null;
      let tesistaIdAsociado: string | null = null;
      let datosEspecificos: Record<string, unknown> = {};
      let descripcionLibroNumeracion = '';

      // Variables auxiliares para actualizar al tesista en Paso 7
      let datosActualizacionTesistaPaso7: {
        tesistaId: string;
        nota: number;
        mencion: string;
        fechaReal: Date;
      } | null = null;

      // ======================================================================
      // PASO 1: NOMBRAMIENTO DE ASESOR (Serie ORD)
      // ======================================================================
      if (tipoNormalizado === TipoResolucion.ASESOR) {
        const dto = await this.validarDtoEspecifico(ValidarPaso1AsesorDto, body);

        if (expediente.asesorResolucionId) {
          throw new ConflictException(
            'El expediente ya cuenta con una resolución de Nombramiento de Asesor vigente. Para reemplazarlo utilice Cambio de Asesor.',
          );
        }

        const asesor = await tx.docente.findUnique({
          where: { id: dto.asesorDocenteId },
          include: { departamentoAcademico: true, escuelaProfesional: true },
        });

        if (!asesor || asesor.estado !== EstadoDocente.ACTIVO) {
          throw new BadRequestException(
            'El docente seleccionado como Asesor no existe o se encuentra INACTIVO.',
          );
        }

        datosEspecificos = {
          paso: 1,
          escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
          gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
          tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
          tesistasSnapshot,
          asesorDocenteId: asesor.id,
          asesorGradoSnapshot: asesor.gradoAcademico,
          asesorNombresSnapshot: asesor.nombresCompletos,
          asesorNombreCompletoSnapshot: `${asesor.gradoAcademico} ${asesor.nombresCompletos}`,
          asesorDepartamentoIdSnapshot: asesor.departamentoAcademicoId,
          asesorDepartamentoSnapshot: asesor.departamentoAcademico.nombre,
        };

        descripcionLibroNumeracion = `Paso 1: Nombramiento de Asesor (${asesor.gradoAcademico} ${asesor.nombresCompletos}) - Exp. ${expediente.codigoExpediente}`;
      }

      // ======================================================================
      // PASO 2: DICTAMEN DE PROYECTO (Serie ORD)
      // ======================================================================
      if (tipoNormalizado === TipoResolucion.DICTAMEN) {
        const dto = await this.validarDtoEspecifico(ValidarPaso2DictamenDto, body);

        const resAsesor = await this.exigirResolucionPreviaFirmada(
          tx,
          expediente.asesorResolucionId,
          'Nombramiento de Asesor (Paso 1)',
        );

        if (expediente.dictaminantesResolucionId) {
          throw new ConflictException(
            'El expediente ya cuenta con una resolución de Dictamen de Proyecto vigente.',
          );
        }

        if (dto.dictaminante1Id === dto.dictaminante2Id) {
          throw new BadRequestException(
            'Regla de exclusividad: Los dos docentes dictaminantes deben ser personas diferentes entre sí.',
          );
        }

        if (
          dto.dictaminante1Id === expediente.asesorDocenteId ||
          dto.dictaminante2Id === expediente.asesorDocenteId
        ) {
          throw new BadRequestException(
            'Regla de exclusividad transversal: El Asesor vigente no puede ser designado como Dictaminante del mismo expediente.',
          );
        }

        const [depto, d1, d2] = await Promise.all([
          tx.departamentoAcademico.findUnique({ where: { id: dto.departamentoAcademicoId } }),
          tx.docente.findUnique({
            where: { id: dto.dictaminante1Id },
            include: { departamentoAcademico: true },
          }),
          tx.docente.findUnique({
            where: { id: dto.dictaminante2Id },
            include: { departamentoAcademico: true },
          }),
        ]);

        if (!depto || !depto.activo) {
          throw new BadRequestException('El Departamento Académico seleccionado no es válido.');
        }
        if (!d1 || d1.estado !== EstadoDocente.ACTIVO) {
          throw new BadRequestException('El Dictaminante 1 no existe o se encuentra INACTIVO.');
        }
        if (!d2 || d2.estado !== EstadoDocente.ACTIVO) {
          throw new BadRequestException('El Dictaminante 2 no existe o se encuentra INACTIVO.');
        }

        datosEspecificos = {
          paso: 2,
          escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
          gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
          tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
          tesistasSnapshot,
          resolucionAsesorNumeroSnapshot: resAsesor.numeroCompleto,
          tituloProyecto: dto.tituloProyecto,
          departamentoAcademicoId: depto.id,
          departamentoNombreSnapshot: depto.nombre,
          dictaminante1Id: d1.id,
          dictaminante1Snapshot: `${d1.gradoAcademico} ${d1.nombresCompletos}`,
          dictaminante1DepartamentoSnapshot: d1.departamentoAcademico.nombre,
          dictaminante2Id: d2.id,
          dictaminante2Snapshot: `${d2.gradoAcademico} ${d2.nombresCompletos}`,
          dictaminante2DepartamentoSnapshot: d2.departamentoAcademico.nombre,
          esInterdisciplinario:
            d1.departamentoAcademicoId !== depto.id || d2.departamentoAcademicoId !== depto.id,
        };

        descripcionLibroNumeracion = `Paso 2: Dictamen de Proyecto - Exp. ${expediente.codigoExpediente}`;
      }

      // ======================================================================
      // PASO 3: INSCRIPCIÓN DE PROYECTO (Serie ORD + Asiento LibroInscripcion)
      // ======================================================================
      if (tipoNormalizado === TipoResolucion.INSCRIPCION) {
        const resDictamen = await this.exigirResolucionPreviaFirmada(
          tx,
          expediente.dictaminantesResolucionId,
          'Dictamen de Proyecto (Paso 2)',
        );
        await this.exigirResolucionPreviaFirmada(
          tx,
          expediente.tituloResolucionId,
          'Título Vigente del Proyecto',
        );

        if (expediente.inscripcionResolucionId) {
          throw new ConflictException(
            'El expediente ya cuenta con una resolución de Inscripción de Proyecto vigente.',
          );
        }

        if (!expediente.tituloActual) {
          throw new BadRequestException(
            'El expediente no tiene un título vigente registrado para inscribir.',
          );
        }

        const asesor = expediente.asesorDocenteId
          ? await tx.docente.findUnique({ where: { id: expediente.asesorDocenteId } })
          : null;

        datosEspecificos = {
          paso: 3,
          escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
          gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
          tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
          tesistasSnapshot,
          tituloInscritoSnapshot: expediente.tituloActual,
          resolucionDictamenIdSnapshot: resDictamen.id,
          resolucionDictamenNumeroSnapshot: resDictamen.numeroCompleto,
          asesorNombreCompletoSnapshot: asesor
            ? `${asesor.gradoAcademico} ${asesor.nombresCompletos}`
            : 'SIN ASESOR',
        };

        descripcionLibroNumeracion = `Paso 3: Inscripción de Proyecto - Exp. ${expediente.codigoExpediente}`;
      }

      // ======================================================================
      // PASO 4: TERCER DICTAMINANTE (Serie ORD + Paso 2 pasa a MODIFICADA)
      // ======================================================================
      if (tipoNormalizado === TipoResolucion.TERCER_DICT) {
        const dto = await this.validarDtoEspecifico(ValidarPaso4TercerDictDto, body);

        const resInscripcion = await this.exigirResolucionPreviaFirmada(
          tx,
          expediente.inscripcionResolucionId,
          'Inscripción de Proyecto (Paso 3)',
        );

        const resDictVigente = await this.exigirResolucionPreviaFirmada(
          tx,
          expediente.dictaminantesResolucionId,
          'Dictaminantes del Proyecto (Paso 2)',
        );

        if (expediente.dictaminante3Id) {
          throw new ConflictException(
            'El expediente ya cuenta con un Tercer Dictaminante vigente. Para reemplazarlo utilice Cambio de Dictaminante.',
          );
        }

        if (
          dto.dictaminante3Id === expediente.asesorDocenteId ||
          dto.dictaminante3Id === expediente.dictaminante1Id ||
          dto.dictaminante3Id === expediente.dictaminante2Id
        ) {
          throw new BadRequestException(
            'Regla de exclusividad: El Tercer Dictaminante debe ser una persona diferente del Asesor y de los dos primeros dictaminantes.',
          );
        }

        const [d1, d2, d3] = await Promise.all([
          tx.docente.findUnique({ where: { id: expediente.dictaminante1Id! } }),
          tx.docente.findUnique({ where: { id: expediente.dictaminante2Id! } }),
          tx.docente.findUnique({
            where: { id: dto.dictaminante3Id },
            include: { departamentoAcademico: true },
          }),
        ]);

        if (!d3 || d3.estado !== EstadoDocente.ACTIVO) {
          throw new BadRequestException(
            'El docente seleccionado como Tercer Dictaminante no existe o se encuentra INACTIVO.',
          );
        }

        resolucionAntecedenteId = resDictVigente.id;

        datosEspecificos = {
          paso: 4,
          escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
          gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
          tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
          tesistasSnapshot,
          tituloVigenteSnapshot: expediente.tituloActual,
          resolucionInscripcionNumeroSnapshot: resInscripcion.numeroCompleto,
          resolucionDictamenAntecedenteNumero: resDictVigente.numeroCompleto,
          dictaminante1Id: d1!.id,
          dictaminante1Snapshot: `${d1!.gradoAcademico} ${d1!.nombresCompletos}`,
          dictaminante2Id: d2!.id,
          dictaminante2Snapshot: `${d2!.gradoAcademico} ${d2!.nombresCompletos}`,
          dictaminante3Id: d3.id,
          dictaminante3Snapshot: `${d3.gradoAcademico} ${d3.nombresCompletos}`,
          dictaminante3DepartamentoSnapshot: d3.departamentoAcademico.nombre,
        };

        descripcionLibroNumeracion = `Paso 4: Tercer Dictaminante (${d3.gradoAcademico} ${d3.nombresCompletos}) - Exp. ${expediente.codigoExpediente}`;
      }

      // ======================================================================
      // PASO 5: APTO PARA TÍTULO PROFESIONAL (Serie CF - Individual por Tesista)
      // ======================================================================
      if (tipoNormalizado === TipoResolucion.APTO) {
        const dto = await this.validarDtoEspecifico(ValidarPaso5AptoDto, body);

        if (!expediente.dictaminante3Id) {
          throw new BadRequestException(
            'Prerrequisito incumplido: Debe haberse designado al Tercer Dictaminante (Paso 4) antes de emitir el Apto.',
          );
        }

        const resTercerDict = await this.exigirResolucionPreviaFirmada(
          tx,
          expediente.dictaminantesResolucionId,
          'Tercer Dictaminante / Terna de Dictaminantes (Paso 4)',
        );

        this.validarFechaNoFutura(dto.fechaInformeSecretaria, 'fecha del informe de Secretaría Académica');

        const tesista = expediente.tesistas.find((t) => t.id === dto.tesistaId);
        if (!tesista) {
          throw new BadRequestException(
            'El tesista indicado no pertenece a este expediente o se encuentra DESISTIDO.',
          );
        }

        if (tesista.aptoResolucionId) {
          const resAptoExistente = await tx.resolucion.findUnique({
            where: { id: tesista.aptoResolucionId },
          });
          if (resAptoExistente && resAptoExistente.situacionJuridica === SituacionJuridicaRes.VIGENTE) {
            throw new ConflictException(
              `El tesista ${tesista.nombresApellidos} ya cuenta con una resolución de Apto vigente (${resAptoExistente.numeroCompleto}).`,
            );
          }
        }

        tesistaIdAsociado = tesista.id;

        datosEspecificos = {
          paso: 5,
          escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
          gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
          tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
          tesistaId: tesista.id,
          tesistaNombresSnapshot: tesista.nombresApellidos,
          tesistaCodigoSnapshot: tesista.codigoEstudiante,
          tituloVigenteSnapshot: expediente.tituloActual,
          numeroInformeSecretaria: dto.numeroInformeSecretaria,
          fechaInformeSecretaria: dto.fechaInformeSecretaria,
          resolucionTercerDictNumeroSnapshot: resTercerDict.numeroCompleto,
        };

        descripcionLibroNumeracion = `Paso 5: Apto para Título Profesional (${tesista.nombresApellidos}) - Exp. ${expediente.codigoExpediente}`;
      }

      // ======================================================================
      // PASO 6: FECHA Y HORA DE SUSTENTACIÓN (Serie ORD - Jurado de 4 miembros)
      // ======================================================================
      if (tipoNormalizado === TipoResolucion.FECHA_HORA) {
        const dto = await this.validarDtoEspecifico(ValidarPaso6FechaHoraDto, body);

        if (expediente.fechaHoraResolucionId) {
          throw new ConflictException(
            'El expediente ya cuenta con una resolución de Fecha y Hora de Sustentación vigente.',
          );
        }

        // Regla RB-FH-04: TODOS los tesistas activos del expediente deben tener su resolución de APTO VIGENTE y FIRMADA
        const resolucionesAptoSnapshot: Array<{
          tesistaId: string;
          tesistaNombres: string;
          numeroResolucionApto: string;
        }> = [];

        for (const t of expediente.tesistas) {
          const resApto = await this.exigirResolucionPreviaFirmada(
            tx,
            t.aptoResolucionId,
            `Apto para Título Profesional (Paso 5) del tesista ${t.nombresApellidos}`,
          );
          resolucionesAptoSnapshot.push({
            tesistaId: t.id,
            tesistaNombres: t.nombresApellidos,
            numeroResolucionApto: resApto.numeroCompleto,
          });
        }

        // Regla RB-FH-12: La fecha programada de sustentación debe ser posterior a la fecha de emisión
        const fechaSustStr = dto.fechaSustentacion.slice(0, 10);
        if (fechaSustStr <= fechaEmisionStr) {
          throw new BadRequestException(
            `Regla RB-FH-12: La fecha programada de sustentación (${fechaSustStr}) debe ser posterior a la fecha de emisión de la resolución (${fechaEmisionStr}).`,
          );
        }

        // Validar conformación del Jurado: Presidente, Secretario y Vocal deben ser los 3 dictaminantes vigentes sin duplicarse
        const propuestosJurado = [
          dto.presidenteDocenteId,
          dto.secretarioDocenteId,
          dto.vocalDocenteId,
        ];

        if (new Set(propuestosJurado).size !== 3) {
          throw new BadRequestException(
            'Los cargos de Presidente, Secretario y Vocal/Dictaminante deben ser ocupados por tres docentes distintos.',
          );
        }

        const ternaDictaminantesVigentes = [
          expediente.dictaminante1Id,
          expediente.dictaminante2Id,
          expediente.dictaminante3Id,
        ];

        const coincidenConTerna = propuestosJurado.every((id) =>
          ternaDictaminantesVigentes.includes(id),
        );

        if (!coincidenConTerna) {
          throw new BadRequestException(
            'Conformación inválida del Jurado: El Presidente, Secretario y Vocal deben ser exactamente los tres Dictaminantes vigentes del expediente (el Asesor se incorpora automáticamente como 4.° integrante).',
          );
        }

        const [presidente, secretario, vocal, asesor] = await Promise.all([
          tx.docente.findUnique({ where: { id: dto.presidenteDocenteId } }),
          tx.docente.findUnique({ where: { id: dto.secretarioDocenteId } }),
          tx.docente.findUnique({ where: { id: dto.vocalDocenteId } }),
          tx.docente.findUnique({ where: { id: expediente.asesorDocenteId! } }),
        ]);

        datosEspecificos = {
          paso: 6,
          escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
          gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
          tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
          tesistasSnapshot,
          resolucionesAptoSnapshot,
          tituloVigenteSnapshot: expediente.tituloActual,
          fechaSustentacion: fechaSustStr,
          horaSustentacion: dto.horaSustentacion,
          modalidad: dto.modalidad,
          lugarReferencia: dto.lugarReferencia,
          juradoSnapshot: {
            presidenteId: presidente!.id,
            presidenteSnapshot: `${presidente!.gradoAcademico} ${presidente!.nombresCompletos}`,
            secretarioId: secretario!.id,
            secretarioSnapshot: `${secretario!.gradoAcademico} ${secretario!.nombresCompletos}`,
            vocalId: vocal!.id,
            vocalSnapshot: `${vocal!.gradoAcademico} ${vocal!.nombresCompletos}`,
            asesorId: asesor!.id,
            asesorSnapshot: `${asesor!.gradoAcademico} ${asesor!.nombresCompletos}`,
          },
        };

        descripcionLibroNumeracion = `Paso 6: Fecha y Hora de Sustentación (${fechaSustStr} ${dto.horaSustentacion}) - Exp. ${expediente.codigoExpediente}`;
      }

      // ======================================================================
      // PASO 7: TÍTULO PROFESIONAL (Serie CF - Individual por Tesista)
      // ======================================================================
      if (tipoNormalizado === TipoResolucion.TITULO) {
        const dto = await this.validarDtoEspecifico(ValidarPaso7TituloDto, body);

        const resFechaHora = await this.exigirResolucionPreviaFirmada(
          tx,
          expediente.fechaHoraResolucionId,
          'Fecha y Hora de Sustentación (Paso 6)',
        );

        const tesista = expediente.tesistas.find((t) => t.id === dto.tesistaId);
        if (!tesista) {
          throw new BadRequestException(
            'El tesista indicado no pertenece a este expediente o se encuentra DESISTIDO.',
          );
        }

        const resApto = await this.exigirResolucionPreviaFirmada(
          tx,
          tesista.aptoResolucionId,
          `Apto para Título Profesional (Paso 5) del tesista ${tesista.nombresApellidos}`,
        );

        if (tesista.tituloResolucionId) {
          const resTituloExistente = await tx.resolucion.findUnique({
            where: { id: tesista.tituloResolucionId },
          });
          if (
            resTituloExistente &&
            resTituloExistente.situacionJuridica === SituacionJuridicaRes.VIGENTE
          ) {
            throw new ConflictException(
              `El tesista ${tesista.nombresApellidos} ya cuenta con una resolución de Título Profesional vigente (${resTituloExistente.numeroCompleto}).`,
            );
          }
        }

        // Validar coherencia de fechaSustentacionReal (no futura y no anterior a la emisión del Paso 6)
        const fechaSustRealDate = this.validarFechaNoFutura(
          dto.fechaSustentacionReal,
          'fecha real de sustentación',
        );
        const fechaSustRealStr = fechaSustRealDate.toISOString().slice(0, 10);
        const fechaEmisionPaso6Str = resFechaHora.fechaEmision.toISOString().slice(0, 10);

        if (fechaSustRealStr < fechaEmisionPaso6Str) {
          throw new BadRequestException(
            `Inconsistencia cronológica: La fecha real de sustentación (${fechaSustRealStr}) no puede ser anterior a la fecha de emisión de la programación del Paso 6 (${fechaEmisionPaso6Str}).`,
          );
        }

        const mencionCalculada = this.calcularMencionTitulo(dto.notaSustentacion);
        const asesor = await tx.docente.findUnique({ where: { id: expediente.asesorDocenteId! } });

        tesistaIdAsociado = tesista.id;
        datosActualizacionTesistaPaso7 = {
          tesistaId: tesista.id,
          nota: dto.notaSustentacion,
          mencion: mencionCalculada,
          fechaReal: fechaSustRealDate,
        };

        datosEspecificos = {
          paso: 7,
          escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
          gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
          tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
          tesistaId: tesista.id,
          tesistaNombresSnapshot: tesista.nombresApellidos,
          tesistaCodigoSnapshot: tesista.codigoEstudiante,
          tituloFinalSnapshot: expediente.tituloActual,
          asesorNombreCompletoSnapshot: asesor
            ? `${asesor.gradoAcademico} ${asesor.nombresCompletos}`
            : 'SIN ASESOR',
          resolucionAptoNumeroSnapshot: resApto.numeroCompleto,
          resolucionFechaHoraNumeroSnapshot: resFechaHora.numeroCompleto,
          fechaSustentacionReal: fechaSustRealStr,
          notaSustentacion: dto.notaSustentacion,
          resultadoSustentacion: mencionCalculada,
        };

        descripcionLibroNumeracion = `Paso 7: Título Profesional (${tesista.nombresApellidos} - Nota: ${dto.notaSustentacion} ${mencionCalculada}) - Exp. ${expediente.codigoExpediente}`;
      }

      // ======================================================================
      // NUMERACIÓN ATÓMICA (ORD o CF) Y CREACIÓN DE LA RESOLUCIÓN
      // ======================================================================
      const numeracion = await this.reservarSiguienteNumeroSerieAtomico(tx, serieCorrespondiente);

      const hashVersionGenerado = this.generarHashVersionSha256({
        numeroCompleto: numeracion.numeroCompleto,
        idTramiteControl: numeracion.idTramiteControl,
        versionPdf: 1,
        tipo: tipoNormalizado,
        nombreDecanoSnapshot,
        datosEspecificos,
      });

      if (resolucionAntecedenteId) {
        await tx.resolucion.update({
          where: { id: resolucionAntecedenteId },
          data: { situacionJuridica: SituacionJuridicaRes.MODIFICADA },
        });
      }

      const resolucionCreada = await tx.resolucion.create({
        data: {
          expedienteId: expediente.id,
          tipo: tipoNormalizado,
          serie: serieCorrespondiente,
          numeroCorrelativo: numeracion.numeroCorrelativo,
          anioNumeracion: numeracion.anio,
          numeroCompleto: numeracion.numeroCompleto,
          tesistaId: tesistaIdAsociado,
          resolucionAntecedenteId,
          situacionJuridica: SituacionJuridicaRes.VIGENTE,
          estadoDocumental: EstadoDocumentalRes.EMITIDO,
          origen: OrigenResolucion.SISTEMA,
          fechaEmision,
          nombreDecanoSnapshot,
          inicialesOperador: ejecutor.iniciales,
          datosEspecificos: datosEspecificos as Prisma.InputJsonValue,
          idTramiteControl: numeracion.idTramiteControl,
          versionPdf: 1,
          hashVersionGenerado,
          usuarioEmisorId: ejecutor.id,
        },
      });

      await tx.libroNumeracion.create({
        data: {
          numeroCompleto: numeracion.numeroCompleto,
          numero: numeracion.numeroCorrelativo,
          anio: numeracion.anio,
          serie: serieCorrespondiente,
          categoria: CategoriaNumeracion.TITULACION,
          descripcion: descripcionLibroNumeracion,
          fechaDocumento: fechaEmision,
          registradoPorId: ejecutor.id,
          resolucionId: resolucionCreada.id,
        },
      });

      // ======================================================================
      // ACTUALIZACIÓN DE PUNTEROS EN EXPEDIENTE, TESISTA Y LIBRO INSCRIPCIÓN
      // ======================================================================
      if (tipoNormalizado === TipoResolucion.ASESOR) {
        await tx.expediente.update({
          where: { id: expediente.id },
          data: {
            asesorDocenteId: String(datosEspecificos.asesorDocenteId),
            asesorResolucionId: resolucionCreada.id,
          },
        });
      } else if (tipoNormalizado === TipoResolucion.DICTAMEN) {
        await tx.expediente.update({
          where: { id: expediente.id },
          data: {
            tituloActual: String(datosEspecificos.tituloProyecto),
            tituloResolucionId: resolucionCreada.id,
            departamentoDictaminantesId: Number(datosEspecificos.departamentoAcademicoId),
            dictaminante1Id: String(datosEspecificos.dictaminante1Id),
            dictaminante2Id: String(datosEspecificos.dictaminante2Id),
            dictaminantesResolucionId: resolucionCreada.id,
          },
        });
      } else if (tipoNormalizado === TipoResolucion.INSCRIPCION) {
        const asientoLibro = await this.generarAsientoLibroInscripcionAtomico(tx, {
          escuelaProfesionalId: expediente.escuelaProfesionalId,
          expedienteId: expediente.id,
          resolucionInscripcionId: resolucionCreada.id,
          tituloInscritoSnapshot: expediente.tituloActual!,
          tesistasSnapshot: textoTesistasSnapshot,
          asesorSnapshot: String(datosEspecificos.asesorNombreCompletoSnapshot),
          fechaAsiento: fechaEmision,
        });

        datosEspecificos.numeroAsientoLibroSnapshot = asientoLibro.numeroAsiento;
        datosEspecificos.numeroFolioLibroSnapshot = asientoLibro.numeroFolioFormateado;

        await tx.resolucion.update({
          where: { id: resolucionCreada.id },
          data: { datosEspecificos: datosEspecificos as Prisma.InputJsonValue },
        });

        await tx.expediente.update({
          where: { id: expediente.id },
          data: {
            inscripcionResolucionId: resolucionCreada.id,
            libroInscripcionId: asientoLibro.id,
          },
        });
      } else if (tipoNormalizado === TipoResolucion.TERCER_DICT) {
        await tx.expediente.update({
          where: { id: expediente.id },
          data: {
            dictaminante3Id: String(datosEspecificos.dictaminante3Id),
            dictaminantesResolucionId: resolucionCreada.id,
          },
        });
      } else if (tipoNormalizado === TipoResolucion.APTO && tesistaIdAsociado) {
        await tx.tesista.update({
          where: { id: tesistaIdAsociado },
          data: {
            aptoResolucionId: resolucionCreada.id,
            estado: EstadoTesista.APTO,
          },
        });
      } else if (tipoNormalizado === TipoResolucion.FECHA_HORA) {
        await tx.expediente.update({
          where: { id: expediente.id },
          data: {
            fechaHoraResolucionId: resolucionCreada.id,
          },
        });
      } else if (tipoNormalizado === TipoResolucion.TITULO && datosActualizacionTesistaPaso7) {
        await tx.tesista.update({
          where: { id: datosActualizacionTesistaPaso7.tesistaId },
          data: {
            tituloResolucionId: resolucionCreada.id,
            notaSustentacion: datosActualizacionTesistaPaso7.nota,
            resultadoSustentacion: datosActualizacionTesistaPaso7.mencion,
            fechaSustentacionReal: datosActualizacionTesistaPaso7.fechaReal,
          },
        });
      }

      // Registrar Auditoría Transaccional
      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'EMITIR_RESOLUCION',
          entidad: 'resoluciones',
          entidadId: resolucionCreada.id,
          expedienteId: expediente.id,
          resolucionId: resolucionCreada.id,
          detalle: {
            numeroCompleto: resolucionCreada.numeroCompleto,
            tipo: resolucionCreada.tipo,
            serie: resolucionCreada.serie,
            tesistaId: tesistaIdAsociado,
            idTramiteControl: resolucionCreada.idTramiteControl,
            hashVersionGenerado: resolucionCreada.hashVersionGenerado,
            resolucionAntecedenteId,
          },
        },
      });

      return tx.resolucion.findUnique({
        where: { id: resolucionCreada.id },
        include: {
          asientoLibroInscripcion: true,
          tesista: true,
        },
      });
    });
  }

  /**
   * Confirmación de firma de una resolución:
   * Pasa de EMITIDO a FIRMADO. En el Paso 7 (TITULO), actualiza al tesista a TITULADO y,
   * si todos los tesistas activos ya cuentan con su Título firmado, cierra el expediente como TITULADO.
   */
  async confirmarFirmaResolucion(
    resolucionId: string,
    ejecutor: { id: string; iniciales: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const resolucion = await tx.resolucion.findUnique({
        where: { id: resolucionId },
      });

      if (!resolucion) {
        throw new NotFoundException('La resolución indicada no existe.');
      }

      if (resolucion.situacionJuridica === SituacionJuridicaRes.SIN_EFECTO) {
        throw new BadRequestException(
          `La resolución ${resolucion.numeroCompleto} se encuentra SIN_EFECTO y no puede ser marcada como firmada.`,
        );
      }

      if (resolucion.estadoDocumental === EstadoDocumentalRes.FIRMADO) {
        throw new ConflictException(
          `La resolución ${resolucion.numeroCompleto} ya se encuentra en estado FIRMADO e inmutable.`,
        );
      }

      const actualizada = await tx.resolucion.update({
        where: { id: resolucion.id },
        data: {
          estadoDocumental: EstadoDocumentalRes.FIRMADO,
          fechaConfirmacionFirma: new Date(),
        },
      });

      if (resolucion.tipo === TipoResolucion.APTO && resolucion.tesistaId) {
        await tx.tesista.update({
          where: { id: resolucion.tesistaId },
          data: { estado: EstadoTesista.APTO },
        });
      }

      let expedienteCerradoComoTitulado = false;

      if (resolucion.tipo === TipoResolucion.TITULO && resolucion.tesistaId) {
        await tx.tesista.update({
          where: { id: resolucion.tesistaId },
          data: { estado: EstadoTesista.TITULADO },
        });

        const tesistasActivos = await tx.tesista.findMany({
          where: {
            expedienteId: resolucion.expedienteId,
            estado: { not: EstadoTesista.DESISTIDO },
          },
        });

        let todosConTituloFirmado = tesistasActivos.length > 0;
        for (const t of tesistasActivos) {
          if (!t.tituloResolucionId) {
            todosConTituloFirmado = false;
            break;
          }
          const resTit = await tx.resolucion.findUnique({
            where: { id: t.tituloResolucionId },
          });
          if (
            !resTit ||
            resTit.situacionJuridica !== SituacionJuridicaRes.VIGENTE ||
            resTit.estadoDocumental !== EstadoDocumentalRes.FIRMADO
          ) {
            todosConTituloFirmado = false;
            break;
          }
        }

        if (todosConTituloFirmado) {
          await tx.expediente.update({
            where: { id: resolucion.expedienteId },
            data: { estado: EstadoExpediente.TITULADO },
          });
          expedienteCerradoComoTitulado = true;
        }
      }

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'VALIDACION_FIRMA_PDF',
          entidad: 'resoluciones',
          entidadId: actualizada.id,
          expedienteId: actualizada.expedienteId,
          resolucionId: actualizada.id,
          detalle: {
            numeroCompleto: actualizada.numeroCompleto,
            tipo: actualizada.tipo,
            idTramiteControl: actualizada.idTramiteControl,
            hashVersionValidado: actualizada.hashVersionGenerado,
            nuevoEstadoDocumental: EstadoDocumentalRes.FIRMADO,
            expedienteCerradoComoTitulado,
          },
        },
      });

      return {
        ...actualizada,
        expedienteCerradoComoTitulado,
      };
    });
  }

  /**
   * Corrección y regeneración en estado EMITIDO (Antes de la firma):
   * Conserva el mismo número correlativo, incrementa versionPdf y regenera el hash de seguridad.
   */
  async corregirBorradorEmitido(
    resolucionId: string,
    body: EmitirPasoFlujoBodyDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const resolucion = await tx.resolucion.findUnique({
        where: { id: resolucionId },
      });

      if (!resolucion) {
        throw new NotFoundException('La resolución indicada no existe.');
      }

      if (resolucion.estadoDocumental === EstadoDocumentalRes.FIRMADO) {
        throw new ConflictException(
          `Bloqueo de Inmutabilidad: La resolución ${resolucion.numeroCompleto} ya está FIRMADA. Cualquier corrección posterior exige obligatoriamente emitir un Dejar Sin Efecto (DSE).`,
        );
      }

      const datosActuales = (resolucion.datosEspecificos as Record<string, unknown>) || {};
      const nuevosDatos = { ...datosActuales };

      if (resolucion.tipo === TipoResolucion.DICTAMEN && body.tituloProyecto) {
        nuevosDatos.tituloProyecto = body.tituloProyecto;
        await tx.expediente.update({
          where: { id: resolucion.expedienteId },
          data: { tituloActual: body.tituloProyecto },
        });
      }

      if (resolucion.tipo === TipoResolucion.APTO && body.numeroInformeSecretaria) {
        nuevosDatos.numeroInformeSecretaria = body.numeroInformeSecretaria;
      }

      if (resolucion.tipo === TipoResolucion.FECHA_HORA) {
        if (body.horaSustentacion) nuevosDatos.horaSustentacion = body.horaSustentacion;
        if (body.lugarReferencia) nuevosDatos.lugarReferencia = body.lugarReferencia;
      }

      if (resolucion.tipo === TipoResolucion.TITULO && body.notaSustentacion !== undefined) {
        const nuevaMencion = this.calcularMencionTitulo(body.notaSustentacion);
        nuevosDatos.notaSustentacion = body.notaSustentacion;
        nuevosDatos.resultadoSustentacion = nuevaMencion;
        if (resolucion.tesistaId) {
          await tx.tesista.update({
            where: { id: resolucion.tesistaId },
            data: {
              notaSustentacion: body.notaSustentacion,
              resultadoSustentacion: nuevaMencion,
            },
          });
        }
      }

      const nuevaVersion = resolucion.versionPdf + 1;
      const nombreDecanoSnapshot = await this.obtenerSnapshotDecanoFirmante(tx);
      const nuevoHash = this.generarHashVersionSha256({
        numeroCompleto: resolucion.numeroCompleto,
        idTramiteControl: resolucion.idTramiteControl,
        versionPdf: nuevaVersion,
        tipo: resolucion.tipo,
        nombreDecanoSnapshot,
        datosEspecificos: nuevosDatos,
      });

      const regenerada = await tx.resolucion.update({
        where: { id: resolucion.id },
        data: {
          datosEspecificos: nuevosDatos as Prisma.InputJsonValue,
          nombreDecanoSnapshot,
          inicialesOperador: ejecutor.iniciales,
          versionPdf: nuevaVersion,
          hashVersionGenerado: nuevoHash,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'REGENERAR_PDF',
          entidad: 'resoluciones',
          entidadId: regenerada.id,
          expedienteId: regenerada.expedienteId,
          resolucionId: regenerada.id,
          detalle: {
            numeroCompleto: regenerada.numeroCompleto,
            versionAnterior: resolucion.versionPdf,
            versionNueva: nuevaVersion,
            hashAnterior: resolucion.hashVersionGenerado,
            hashNuevo: nuevoHash,
          },
        },
      });

      return regenerada;
    });
  }
}