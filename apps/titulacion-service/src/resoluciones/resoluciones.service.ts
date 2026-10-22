import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/database';
import {
  AmbitoCausa,
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
import {
  ActualizarCatalogoCausaDto,
  CrearCatalogoCausaDto,
  EmitirCambioAsesorDto,
  EmitirCambioDictaminanteDto,
  EmitirCambioTituloDto,
  EmitirDejarSinEfectoDto,
  EmitirDesistimientoDto,
  RegistrarDocumentoExternoDto,
} from './dto/complementarias.dto';

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
      throw new BadRequestException(mensajes || 'Datos de entrada inválidos para esta operación.');
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

  /**
   * Valida que una causa exista en CatalogoCausa, esté activa, pertenezca al ámbito exigido
   * y tenga detalle manual si requiereDetalleManual = true.
   */
  private async validarCausaPorAmbito(
    tx: Prisma.TransactionClient,
    causaId: number,
    ambitoEsperado: AmbitoCausa,
    detalleManual?: string,
  ): Promise<{ id: number; descripcion: string; textoConsolidado: string }> {
    const causa = await tx.catalogoCausa.findUnique({
      where: { id: causaId },
    });

    if (!causa || !causa.activo) {
      throw new BadRequestException('La causa o tipo seleccionado no existe o se encuentra inactivo.');
    }

    if (causa.ambito !== ambitoEsperado) {
      throw new BadRequestException(
        `La causa seleccionada ('${causa.descripcion}') pertenece al ámbito ${causa.ambito}, pero esta operación exige el ámbito ${ambitoEsperado}.`,
      );
    }

    const detalleLimpio = detalleManual?.trim();
    if (causa.requiereDetalleManual && (!detalleLimpio || detalleLimpio.length < 3)) {
      throw new BadRequestException(
        `La opción '${causa.descripcion}' exige especificar obligatoriamente el detalle manual (mínimo 3 caracteres).`,
      );
    }

    const textoConsolidado = causa.requiereDetalleManual
      ? `${causa.descripcion}: ${detalleLimpio}`
      : detalleLimpio
        ? `${causa.descripcion} (${detalleLimpio})`
        : causa.descripcion;

    return {
      id: causa.id,
      descripcion: causa.descripcion,
      textoConsolidado,
    };
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
        `Candado de Firma Activo: La resolución ${resPrevia.numeroCompleto} (${nombreEtapaPrevia}) se encuentra en estado EMITIDO. Debe estar en estado FIRMADO para habilitar esta operación.`,
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

  // ==========================================================================
  // PARTE A: FLUJO REGULAR DE LOS 7 PASOS SECUENCIALES
  // ==========================================================================
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

    const pasosConSerieCF: TipoResolucion[] = [TipoResolucion.APTO, TipoResolucion.TITULO];
    const serieCorrespondiente: SerieNumeracion = pasosConSerieCF.includes(tipoNormalizado)
      ? SerieNumeracion.CF
      : SerieNumeracion.ORD;

    return this.prisma.$transaction(async (tx) => {
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

      let datosActualizacionTesistaPaso7: {
        tesistaId: string;
        nota: number;
        mencion: string;
        fechaReal: Date;
      } | null = null;

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

      if (tipoNormalizado === TipoResolucion.FECHA_HORA) {
        const dto = await this.validarDtoEspecifico(ValidarPaso6FechaHoraDto, body);

        if (expediente.fechaHoraResolucionId) {
          throw new ConflictException(
            'El expediente ya cuenta con una resolución de Fecha y Hora de Sustentación vigente.',
          );
        }

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

        const fechaSustStr = dto.fechaSustentacion.slice(0, 10);
        if (fechaSustStr <= fechaEmisionStr) {
          throw new BadRequestException(
            `Regla RB-FH-12: La fecha programada de sustentación (${fechaSustStr}) debe ser posterior a la fecha de emisión de la resolución (${fechaEmisionStr}).`,
          );
        }

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

  // ==========================================================================
  // PARTE B.1: CAMBIO DE ASESOR (Serie ORD - Permitido incluso tras Paso 6)
  // ==========================================================================
  async emitirCambioAsesor(
    expedienteId: string,
    dto: EmitirCambioAsesorDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const fechaEmision = this.validarFechaNoFutura(dto.fechaEmision, 'fecha de emisión');

    return this.prisma.$transaction(async (tx) => {
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

      if (!expediente) throw new NotFoundException('El expediente indicado no existe.');
      if (expediente.estado !== EstadoExpediente.ACTIVO) {
        throw new BadRequestException(
          `El expediente se encuentra en estado ${expediente.estado} y no admite Cambio de Asesor.`,
        );
      }

      const resAsesorAnterior = await this.exigirResolucionPreviaFirmada(
        tx,
        expediente.asesorResolucionId,
        'Asesor Vigente (Paso 1 o Cambio de Asesor previo)',
      );

      const causaValidada = await this.validarCausaPorAmbito(
        tx,
        dto.causaId,
        AmbitoCausa.CAMBIO_ASESOR,
        dto.detalleCausaManual,
      );

      if (dto.nuevoAsesorDocenteId === expediente.asesorDocenteId) {
        throw new BadRequestException(
          'El nuevo docente asesor debe ser una persona diferente al asesor vigente actual.',
        );
      }

      if (
        [
          expediente.dictaminante1Id,
          expediente.dictaminante2Id,
          expediente.dictaminante3Id,
        ].includes(dto.nuevoAsesorDocenteId)
      ) {
        throw new BadRequestException(
          'Regla de exclusividad transversal: El nuevo Asesor no puede ser ninguno de los Dictaminantes vigentes del expediente.',
        );
      }

      const [asesorAnterior, nuevoAsesor] = await Promise.all([
        tx.docente.findUnique({ where: { id: expediente.asesorDocenteId! } }),
        tx.docente.findUnique({
          where: { id: dto.nuevoAsesorDocenteId },
          include: { departamentoAcademico: true },
        }),
      ]);

      if (!nuevoAsesor || nuevoAsesor.estado !== EstadoDocente.ACTIVO) {
        throw new BadRequestException(
          'El docente seleccionado como nuevo Asesor no existe o se encuentra INACTIVO.',
        );
      }

      const nombreDecanoSnapshot = await this.obtenerSnapshotDecanoFirmante(tx);
      const numeracion = await this.reservarSiguienteNumeroSerieAtomico(tx, SerieNumeracion.ORD);

      const datosEspecificos = {
        tipoComplementaria: 'CAMBIO_ASESOR',
        escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
        gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
        tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
        tesistasSnapshot: expediente.tesistas.map((t) => ({
          id: t.id,
          nombresApellidos: t.nombresApellidos,
          codigoEstudiante: t.codigoEstudiante,
        })),
        resolucionAntecedenteNumeroSnapshot: resAsesorAnterior.numeroCompleto,
        asesorSalienteId: asesorAnterior?.id || null,
        asesorSalienteSnapshot: asesorAnterior
          ? `${asesorAnterior.gradoAcademico} ${asesorAnterior.nombresCompletos}`
          : 'SIN DATO',
        asesorDocenteId: nuevoAsesor.id,
        asesorGradoSnapshot: nuevoAsesor.gradoAcademico,
        asesorNombresSnapshot: nuevoAsesor.nombresCompletos,
        asesorNombreCompletoSnapshot: `${nuevoAsesor.gradoAcademico} ${nuevoAsesor.nombresCompletos}`,
        asesorDepartamentoSnapshot: nuevoAsesor.departamentoAcademico.nombre,
        causaId: causaValidada.id,
        causaDescripcionSnapshot: causaValidada.descripcion,
        causaTextoConsolidadoSnapshot: causaValidada.textoConsolidado,
      };

      const hashVersionGenerado = this.generarHashVersionSha256({
        numeroCompleto: numeracion.numeroCompleto,
        idTramiteControl: numeracion.idTramiteControl,
        versionPdf: 1,
        tipo: TipoResolucion.CAMBIO_ASESOR,
        nombreDecanoSnapshot,
        datosEspecificos,
      });

      // Pasar la resolución de asesor anterior a MODIFICADA
      await tx.resolucion.update({
        where: { id: resAsesorAnterior.id },
        data: { situacionJuridica: SituacionJuridicaRes.MODIFICADA },
      });

      const nuevaResolucion = await tx.resolucion.create({
        data: {
          expedienteId: expediente.id,
          tipo: TipoResolucion.CAMBIO_ASESOR,
          serie: SerieNumeracion.ORD,
          numeroCorrelativo: numeracion.numeroCorrelativo,
          anioNumeracion: numeracion.anio,
          numeroCompleto: numeracion.numeroCompleto,
          resolucionAntecedenteId: resAsesorAnterior.id,
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
          serie: SerieNumeracion.ORD,
          categoria: CategoriaNumeracion.TITULACION,
          descripcion: `Cambio de Asesor (${nuevoAsesor.gradoAcademico} ${nuevoAsesor.nombresCompletos}) - Exp. ${expediente.codigoExpediente}`,
          fechaDocumento: fechaEmision,
          registradoPorId: ejecutor.id,
          resolucionId: nuevaResolucion.id,
        },
      });

      await tx.expediente.update({
        where: { id: expediente.id },
        data: {
          asesorDocenteId: nuevoAsesor.id,
          asesorResolucionId: nuevaResolucion.id,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'EMITIR_CAMBIO_ASESOR',
          entidad: 'resoluciones',
          entidadId: nuevaResolucion.id,
          expedienteId: expediente.id,
          resolucionId: nuevaResolucion.id,
          detalle: {
            numeroCompleto: nuevaResolucion.numeroCompleto,
            resolucionAntecedente: resAsesorAnterior.numeroCompleto,
            asesorSaliente: datosEspecificos.asesorSalienteSnapshot,
            asesorEntrante: datosEspecificos.asesorNombreCompletoSnapshot,
            causa: causaValidada.textoConsolidado,
          },
        },
      });

      return nuevaResolucion;
    });
  }

  // ==========================================================================
  // PARTE B.2: CAMBIO DE TÍTULO - DICE / DEBE DECIR (Serie ORD - Sin Causa)
  // ==========================================================================
  async emitirCambioTitulo(
    expedienteId: string,
    dto: EmitirCambioTituloDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const fechaEmision = this.validarFechaNoFutura(dto.fechaEmision, 'fecha de emisión');

    return this.prisma.$transaction(async (tx) => {
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

      if (!expediente) throw new NotFoundException('El expediente indicado no existe.');
      if (expediente.estado !== EstadoExpediente.ACTIVO) {
        throw new BadRequestException(
          `El expediente se encuentra en estado ${expediente.estado} y no admite Cambio de Título.`,
        );
      }

      if (!expediente.tituloActual || !expediente.tituloResolucionId) {
        throw new BadRequestException(
          'El expediente aún no tiene un título registrado (se registra en el Paso 2: Dictamen de Proyecto).',
        );
      }

      const resTituloAnterior = await this.exigirResolucionPreviaFirmada(
        tx,
        expediente.tituloResolucionId,
        'Título Vigente (Dictamen de Proyecto o Cambio de Título previo)',
      );

      if (dto.nuevoTitulo === expediente.tituloActual.trim().toLocaleUpperCase('es-PE')) {
        throw new BadRequestException(
          'El nuevo título (DEBE DECIR) no puede ser idéntico al título vigente actual (DICE).',
        );
      }

      const nombreDecanoSnapshot = await this.obtenerSnapshotDecanoFirmante(tx);
      const numeracion = await this.reservarSiguienteNumeroSerieAtomico(tx, SerieNumeracion.ORD);

      const datosEspecificos = {
        tipoComplementaria: 'CAMBIO_TITULO',
        escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
        gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
        tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
        tesistasSnapshot: expediente.tesistas.map((t) => ({
          id: t.id,
          nombresApellidos: t.nombresApellidos,
          codigoEstudiante: t.codigoEstudiante,
        })),
        resolucionAntecedenteNumeroSnapshot: resTituloAnterior.numeroCompleto,
        diceTituloAnterior: expediente.tituloActual,
        debeDecirNuevoTitulo: dto.nuevoTitulo,
        tituloProyecto: dto.nuevoTitulo,
      };

      const hashVersionGenerado = this.generarHashVersionSha256({
        numeroCompleto: numeracion.numeroCompleto,
        idTramiteControl: numeracion.idTramiteControl,
        versionPdf: 1,
        tipo: TipoResolucion.CAMBIO_TITULO,
        nombreDecanoSnapshot,
        datosEspecificos,
      });

      await tx.resolucion.update({
        where: { id: resTituloAnterior.id },
        data: { situacionJuridica: SituacionJuridicaRes.MODIFICADA },
      });

      const nuevaResolucion = await tx.resolucion.create({
        data: {
          expedienteId: expediente.id,
          tipo: TipoResolucion.CAMBIO_TITULO,
          serie: SerieNumeracion.ORD,
          numeroCorrelativo: numeracion.numeroCorrelativo,
          anioNumeracion: numeracion.anio,
          numeroCompleto: numeracion.numeroCompleto,
          resolucionAntecedenteId: resTituloAnterior.id,
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
          serie: SerieNumeracion.ORD,
          categoria: CategoriaNumeracion.TITULACION,
          descripcion: `Cambio de Título (DICE / DEBE DECIR) - Exp. ${expediente.codigoExpediente}`,
          fechaDocumento: fechaEmision,
          registradoPorId: ejecutor.id,
          resolucionId: nuevaResolucion.id,
        },
      });

      // Actualiza el título vigente del expediente sin tocar el Libro de Inscripción histórico
      await tx.expediente.update({
        where: { id: expediente.id },
        data: {
          tituloActual: dto.nuevoTitulo,
          tituloResolucionId: nuevaResolucion.id,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'EMITIR_CAMBIO_TITULO',
          entidad: 'resoluciones',
          entidadId: nuevaResolucion.id,
          expedienteId: expediente.id,
          resolucionId: nuevaResolucion.id,
          detalle: {
            numeroCompleto: nuevaResolucion.numeroCompleto,
            resolucionAntecedente: resTituloAnterior.numeroCompleto,
            dice: datosEspecificos.diceTituloAnterior,
            debeDecir: datosEspecificos.debeDecirNuevoTitulo,
          },
        },
      });

      return nuevaResolucion;
    });
  }

  // ==========================================================================
  // PARTE B.3: CAMBIO DE DICTAMINANTE (Serie ORD - Bloqueado tras Paso 6)
  // ==========================================================================
  async emitirCambioDictaminante(
    expedienteId: string,
    dto: EmitirCambioDictaminanteDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const fechaEmision = this.validarFechaNoFutura(dto.fechaEmision, 'fecha de emisión');

    return this.prisma.$transaction(async (tx) => {
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

      if (!expediente) throw new NotFoundException('El expediente indicado no existe.');
      if (expediente.estado !== EstadoExpediente.ACTIVO) {
        throw new BadRequestException(
          `El expediente se encuentra en estado ${expediente.estado} y no admite Cambio de Dictaminante.`,
        );
      }

      // Regla RN-CD-20: Congelamiento estricto si ya existe Fecha y Hora de Sustentación (Paso 6)
      if (expediente.fechaHoraResolucionId) {
        throw new ConflictException(
          'Congelamiento Normativo (RN-CD-20): El expediente ya cuenta con Fecha y Hora de Sustentación (Paso 6) vigente y el Jurado está conformado. Para cambiar un dictaminante debe aplicar primero un Dejar Sin Efecto (DSE) a la resolución de Fecha y Hora.',
        );
      }

      if (!expediente.dictaminante1Id || !expediente.dictaminante2Id || !expediente.dictaminante3Id) {
        throw new BadRequestException(
          'El Cambio de Dictaminante requiere que la terna de tres dictaminantes esté completa (Paso 4).',
        );
      }

      const resDictAnterior = await this.exigirResolucionPreviaFirmada(
        tx,
        expediente.dictaminantesResolucionId,
        'Terna de Dictaminantes Vigente (Paso 4 o Cambio de Dictaminante previo)',
      );

      const causaValidada = await this.validarCausaPorAmbito(
        tx,
        dto.causaId,
        AmbitoCausa.CAMBIO_DICTAMINANTE,
        dto.detalleCausaManual,
      );

      const ternaActual = [
        expediente.dictaminante1Id,
        expediente.dictaminante2Id,
        expediente.dictaminante3Id,
      ];

      if (!ternaActual.includes(dto.dictaminanteSalienteId)) {
        throw new BadRequestException(
          'El docente indicado como dictaminante saliente no forma parte de la terna vigente del expediente.',
        );
      }

      if (
        dto.dictaminanteEntranteId === expediente.asesorDocenteId ||
        ternaActual.includes(dto.dictaminanteEntranteId)
      ) {
        throw new BadRequestException(
          'Regla de exclusividad: El nuevo dictaminante entrante no puede ser el Asesor vigente ni uno de los dictaminantes que ya integran la terna.',
        );
      }

      const nuevoD1Id =
        expediente.dictaminante1Id === dto.dictaminanteSalienteId
          ? dto.dictaminanteEntranteId
          : expediente.dictaminante1Id;
      const nuevoD2Id =
        expediente.dictaminante2Id === dto.dictaminanteSalienteId
          ? dto.dictaminanteEntranteId
          : expediente.dictaminante2Id;
      const nuevoD3Id =
        expediente.dictaminante3Id === dto.dictaminanteSalienteId
          ? dto.dictaminanteEntranteId
          : expediente.dictaminante3Id;

      const esModalidadTercerDictaminante =
        dto.dictaminanteSalienteId === expediente.dictaminante3Id;

      const [docSaliente, docEntrante, d1Final, d2Final, d3Final] = await Promise.all([
        tx.docente.findUnique({ where: { id: dto.dictaminanteSalienteId } }),
        tx.docente.findUnique({
          where: { id: dto.dictaminanteEntranteId },
          include: { departamentoAcademico: true },
        }),
        tx.docente.findUnique({ where: { id: nuevoD1Id } }),
        tx.docente.findUnique({ where: { id: nuevoD2Id } }),
        tx.docente.findUnique({ where: { id: nuevoD3Id } }),
      ]);

      if (!docEntrante || docEntrante.estado !== EstadoDocente.ACTIVO) {
        throw new BadRequestException(
          'El docente seleccionado como dictaminante entrante no existe o se encuentra INACTIVO.',
        );
      }

      const nombreDecanoSnapshot = await this.obtenerSnapshotDecanoFirmante(tx);
      const numeracion = await this.reservarSiguienteNumeroSerieAtomico(tx, SerieNumeracion.ORD);

      const datosEspecificos = {
        tipoComplementaria: 'CAMBIO_DICTAMINANTE',
        esModalidadTercerDictaminante,
        escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
        gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
        tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
        tesistasSnapshot: expediente.tesistas.map((t) => ({
          id: t.id,
          nombresApellidos: t.nombresApellidos,
          codigoEstudiante: t.codigoEstudiante,
        })),
        tituloVigenteSnapshot: expediente.tituloActual,
        resolucionAntecedenteNumeroSnapshot: resDictAnterior.numeroCompleto,
        dictaminanteSalienteId: docSaliente!.id,
        dictaminanteSalienteSnapshot: `${docSaliente!.gradoAcademico} ${docSaliente!.nombresCompletos}`,
        dictaminanteEntranteId: docEntrante.id,
        dictaminanteEntranteSnapshot: `${docEntrante.gradoAcademico} ${docEntrante.nombresCompletos}`,
        dictaminante1Id: d1Final!.id,
        dictaminante1Snapshot: `${d1Final!.gradoAcademico} ${d1Final!.nombresCompletos}`,
        dictaminante2Id: d2Final!.id,
        dictaminante2Snapshot: `${d2Final!.gradoAcademico} ${d2Final!.nombresCompletos}`,
        dictaminante3Id: d3Final!.id,
        dictaminante3Snapshot: `${d3Final!.gradoAcademico} ${d3Final!.nombresCompletos}`,
        causaId: causaValidada.id,
        causaDescripcionSnapshot: causaValidada.descripcion,
        causaTextoConsolidadoSnapshot: causaValidada.textoConsolidado,
      };

      const hashVersionGenerado = this.generarHashVersionSha256({
        numeroCompleto: numeracion.numeroCompleto,
        idTramiteControl: numeracion.idTramiteControl,
        versionPdf: 1,
        tipo: TipoResolucion.CAMBIO_DICTAMINANTE,
        nombreDecanoSnapshot,
        datosEspecificos,
      });

      await tx.resolucion.update({
        where: { id: resDictAnterior.id },
        data: { situacionJuridica: SituacionJuridicaRes.MODIFICADA },
      });

      const nuevaResolucion = await tx.resolucion.create({
        data: {
          expedienteId: expediente.id,
          tipo: TipoResolucion.CAMBIO_DICTAMINANTE,
          serie: SerieNumeracion.ORD,
          numeroCorrelativo: numeracion.numeroCorrelativo,
          anioNumeracion: numeracion.anio,
          numeroCompleto: numeracion.numeroCompleto,
          resolucionAntecedenteId: resDictAnterior.id,
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
          serie: SerieNumeracion.ORD,
          categoria: CategoriaNumeracion.TITULACION,
          descripcion: `Cambio de Dictaminante (${docSaliente!.nombresCompletos} -> ${docEntrante.nombresCompletos}) - Exp. ${expediente.codigoExpediente}`,
          fechaDocumento: fechaEmision,
          registradoPorId: ejecutor.id,
          resolucionId: nuevaResolucion.id,
        },
      });

      await tx.expediente.update({
        where: { id: expediente.id },
        data: {
          dictaminante1Id: nuevoD1Id,
          dictaminante2Id: nuevoD2Id,
          dictaminante3Id: nuevoD3Id,
          dictaminantesResolucionId: nuevaResolucion.id,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'EMITIR_CAMBIO_DICTAMINANTE',
          entidad: 'resoluciones',
          entidadId: nuevaResolucion.id,
          expedienteId: expediente.id,
          resolucionId: nuevaResolucion.id,
          detalle: {
            numeroCompleto: nuevaResolucion.numeroCompleto,
            esModalidadTercerDictaminante,
            saliente: datosEspecificos.dictaminanteSalienteSnapshot,
            entrante: datosEspecificos.dictaminanteEntranteSnapshot,
            causa: causaValidada.textoConsolidado,
          },
        },
      });

      return nuevaResolucion;
    });
  }

  // ==========================================================================
  // PARTE B.4: DESISTIMIENTO DE TESISTA (Serie ORD - Solo 2 tesistas activos y antes de Paso 6)
  // ==========================================================================
  async emitirDesistimiento(
    expedienteId: string,
    dto: EmitirDesistimientoDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const fechaEmision = this.validarFechaNoFutura(dto.fechaEmision, 'fecha de emisión');
    if (dto.fechaSolicitudExterna) {
      this.validarFechaNoFutura(dto.fechaSolicitudExterna, 'fecha de la solicitud externa');
    }

    return this.prisma.$transaction(async (tx) => {
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

      if (!expediente) throw new NotFoundException('El expediente indicado no existe.');
      if (expediente.estado !== EstadoExpediente.ACTIVO) {
        throw new BadRequestException(
          `El expediente se encuentra en estado ${expediente.estado} y no admite Desistimiento.`,
        );
      }

      if (expediente.fechaHoraResolucionId) {
        throw new ConflictException(
          'Regla de Desistimiento: No se permite registrar desistimientos una vez emitida la Fecha y Hora de Sustentación (Paso 6).',
        );
      }

      if (expediente.tesistas.length !== 2) {
        throw new BadRequestException(
          'Regla de Desistimiento: La resolución de Desistimiento aplica exclusivamente cuando el expediente tiene 2 tesistas activos. Para anular un expediente de 1 solo tesista, utilice Dejar Sin Efecto (DSE) con Reinicio Integral.',
        );
      }

      const tesistaDesiste = expediente.tesistas.find((t) => t.id === dto.tesistaDesistenteId);
      const tesistaContinua = expediente.tesistas.find((t) => t.id !== dto.tesistaDesistenteId);

      if (!tesistaDesiste || !tesistaContinua) {
        throw new BadRequestException(
          'El tesista seleccionado no pertenece a los tesistas activos de este expediente.',
        );
      }

      const nombreDecanoSnapshot = await this.obtenerSnapshotDecanoFirmante(tx);
      const numeracion = await this.reservarSiguienteNumeroSerieAtomico(tx, SerieNumeracion.ORD);

      const datosEspecificos = {
        tipoComplementaria: 'DESISTIMIENTO',
        escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
        gradoBachillerSnapshot: expediente.escuelaProfesional.gradoBachiller,
        tituloProfesionalSnapshot: expediente.escuelaProfesional.tituloProfesional,
        tituloVigenteSnapshot: expediente.tituloActual,
        tesistaDesistenteId: tesistaDesiste.id,
        tesistaDesistenteNombresSnapshot: tesistaDesiste.nombresApellidos,
        tesistaDesistenteCodigoSnapshot: tesistaDesiste.codigoEstudiante,
        tesistaContinuaId: tesistaContinua.id,
        tesistaContinuaNombresSnapshot: tesistaContinua.nombresApellidos,
        tesistaContinuaCodigoSnapshot: tesistaContinua.codigoEstudiante,
        referenciaSolicitudExterna: dto.referenciaSolicitudExterna,
        fechaSolicitudExterna: dto.fechaSolicitudExterna || null,
        fundamentoSolicitud: dto.fundamentoSolicitud || null,
      };

      const hashVersionGenerado = this.generarHashVersionSha256({
        numeroCompleto: numeracion.numeroCompleto,
        idTramiteControl: numeracion.idTramiteControl,
        versionPdf: 1,
        tipo: TipoResolucion.DESISTIMIENTO,
        nombreDecanoSnapshot,
        datosEspecificos,
      });

      const nuevaResolucion = await tx.resolucion.create({
        data: {
          expedienteId: expediente.id,
          tipo: TipoResolucion.DESISTIMIENTO,
          serie: SerieNumeracion.ORD,
          numeroCorrelativo: numeracion.numeroCorrelativo,
          anioNumeracion: numeracion.anio,
          numeroCompleto: numeracion.numeroCompleto,
          tesistaId: tesistaDesiste.id,
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
          serie: SerieNumeracion.ORD,
          categoria: CategoriaNumeracion.TITULACION,
          descripcion: `Desistimiento de Tesista (${tesistaDesiste.nombresApellidos}) - Continúa ${tesistaContinua.nombresApellidos} - Exp. ${expediente.codigoExpediente}`,
          fechaDocumento: fechaEmision,
          registradoPorId: ejecutor.id,
          resolucionId: nuevaResolucion.id,
        },
      });

      // Cambiar estado del tesista que se retira a DESISTIDO conservando cantidadTesistas = 2 histórico
      await tx.tesista.update({
        where: { id: tesistaDesiste.id },
        data: { estado: EstadoTesista.DESISTIDO },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'EMITIR_DESISTIMIENTO',
          entidad: 'resoluciones',
          entidadId: nuevaResolucion.id,
          expedienteId: expediente.id,
          resolucionId: nuevaResolucion.id,
          detalle: {
            numeroCompleto: nuevaResolucion.numeroCompleto,
            tesistaDesistente: tesistaDesiste.nombresApellidos,
            tesistaQueContinua: tesistaContinua.nombresApellidos,
            referenciaSolicitudExterna: dto.referenciaSolicitudExterna,
          },
        },
      });

      return nuevaResolucion;
    });
  }

  // ==========================================================================
  // PARTE B.5: DEJAR SIN EFECTO - DSE (Serie ORD o CF + Recálculo de Punteros)
  // ==========================================================================
  async emitirDejarSinEfecto(
    expedienteId: string,
    dto: EmitirDejarSinEfectoDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const fechaEmision = this.validarFechaNoFutura(dto.fechaEmision, 'fecha de emisión');
    const idsUnicosAfectados = Array.from(new Set(dto.resolucionesAfectadasIds));

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM expedientes WHERE id = ${expedienteId}::UUID FOR UPDATE`;

      const expediente = await tx.expediente.findUnique({
        where: { id: expedienteId },
        include: {
          escuelaProfesional: true,
          tesistas: { orderBy: { orden: 'asc' } },
          resoluciones: { orderBy: { creadoEn: 'asc' } },
        },
      });

      if (!expediente) throw new NotFoundException('El expediente indicado no existe.');

      const causaValidada = await this.validarCausaPorAmbito(
        tx,
        dto.causaId,
        AmbitoCausa.DSE,
        dto.detalleCausaManual,
      );

      // Si es reinicioIntegral, podemos incluir automáticamente todas las resoluciones VIGENTES o validar las enviadas
      const resolucionesObjetivo = expediente.resoluciones.filter((r) =>
        idsUnicosAfectados.includes(r.id),
      );

      if (resolucionesObjetivo.length !== idsUnicosAfectados.length) {
        throw new BadRequestException(
          'Una o más resoluciones seleccionadas no pertenecen a este expediente.',
        );
      }

      for (const r of resolucionesObjetivo) {
        if (r.situacionJuridica !== SituacionJuridicaRes.VIGENTE) {
          throw new BadRequestException(
            `La resolución ${r.numeroCompleto} (${r.tipo}) no se encuentra VIGENTE (estado actual: ${r.situacionJuridica}) y no puede ser dejada sin efecto directamente.`,
          );
        }
      }

      const nombreDecanoSnapshot = await this.obtenerSnapshotDecanoFirmante(tx);
      const numeracion = await this.reservarSiguienteNumeroSerieAtomico(tx, dto.serie);

      const datosEspecificos = {
        tipoComplementaria: 'DSE',
        escuelaProfesionalSnapshot: expediente.escuelaProfesional.nombre,
        resolucionesAfectadasSnapshot: resolucionesObjetivo.map((r) => ({
          id: r.id,
          numeroCompleto: r.numeroCompleto,
          tipo: r.tipo,
          fechaEmision: r.fechaEmision.toISOString().slice(0, 10),
        })),
        causaId: causaValidada.id,
        causaDescripcionSnapshot: causaValidada.descripcion,
        causaTextoConsolidadoSnapshot: causaValidada.textoConsolidado,
        reinicioIntegral: dto.reinicioIntegral,
        disposicionComplementaria: dto.disposicionComplementaria || null,
      };

      const hashVersionGenerado = this.generarHashVersionSha256({
        numeroCompleto: numeracion.numeroCompleto,
        idTramiteControl: numeracion.idTramiteControl,
        versionPdf: 1,
        tipo: TipoResolucion.DSE,
        nombreDecanoSnapshot,
        datosEspecificos,
      });

      const resolucionDse = await tx.resolucion.create({
        data: {
          expedienteId: expediente.id,
          tipo: TipoResolucion.DSE,
          serie: dto.serie,
          numeroCorrelativo: numeracion.numeroCorrelativo,
          anioNumeracion: numeracion.anio,
          numeroCompleto: numeracion.numeroCompleto,
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
          serie: dto.serie,
          categoria: CategoriaNumeracion.TITULACION,
          descripcion: `Dejar Sin Efecto (${resolucionesObjetivo.map((r) => r.numeroCompleto).join(', ')}) - Exp. ${expediente.codigoExpediente}`,
          fechaDocumento: fechaEmision,
          registradoPorId: ejecutor.id,
          resolucionId: resolucionDse.id,
        },
      });

      // 1. Registrar en DseAfectada, pasar las afectadas a SIN_EFECTO y restituir sus antecedentes si corresponde
      const idsParaAnular = dto.reinicioIntegral
        ? Array.from(
            new Set([
              ...idsUnicosAfectados,
              ...expediente.resoluciones
                .filter((r) => r.situacionJuridica === SituacionJuridicaRes.VIGENTE)
                .map((r) => r.id),
            ]),
          )
        : idsUnicosAfectados;

      for (const r of expediente.resoluciones.filter((x) => idsParaAnular.includes(x.id))) {
        await tx.dseAfectada.create({
          data: {
            resolucionDseId: resolucionDse.id,
            resolucionAfectadaId: r.id,
            estadoPrevio: r.situacionJuridica,
          },
        });

        await tx.resolucion.update({
          where: { id: r.id },
          data: { situacionJuridica: SituacionJuridicaRes.SIN_EFECTO },
        });

        // Si se anuló la Inscripción (Paso 3), marcar su asiento en el Libro de Inscripción como ANULADO_DSE
        if (r.tipo === TipoResolucion.INSCRIPCION) {
          await tx.libroInscripcion.updateMany({
            where: { resolucionInscripcionId: r.id },
            data: { estadoAsiento: 'ANULADO_DSE' },
          });
        }

        // Si tenía antecedente en estado MODIFICADA y NO es reinicio integral, restituir el antecedente a VIGENTE
        if (
          !dto.reinicioIntegral &&
          r.resolucionAntecedenteId &&
          !idsParaAnular.includes(r.resolucionAntecedenteId)
        ) {
          await tx.resolucion.updateMany({
            where: {
              id: r.resolucionAntecedenteId,
              situacionJuridica: SituacionJuridicaRes.MODIFICADA,
            },
            data: { situacionJuridica: SituacionJuridicaRes.VIGENTE },
          });
        }
      }

      // 2. Motor de recálculo operativo de punteros del Expediente y Tesistas
      await this.recalcularPunterosExpedienteTrasDse(tx, expediente.id, dto.reinicioIntegral);

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'DEJAR_SIN_EFECTO',
          entidad: 'resoluciones',
          entidadId: resolucionDse.id,
          expedienteId: expediente.id,
          resolucionId: resolucionDse.id,
          detalle: {
            numeroCompletoDse: resolucionDse.numeroCompleto,
            serie: resolucionDse.serie,
            resolucionesAnuladas: resolucionesObjetivo.map((r) => r.numeroCompleto),
            causa: causaValidada.textoConsolidado,
            reinicioIntegral: dto.reinicioIntegral,
          },
        },
      });

      return tx.resolucion.findUnique({
        where: { id: resolucionDse.id },
        include: {
          resolucionesQueAnulo: {
            include: {
              resolucionAfectada: {
                select: { id: true, numeroCompleto: true, tipo: true, situacionJuridica: true },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Motor de recálculo determinístico de punteros del Expediente tras aplicar un DSE:
   * - Si reinicioIntegral = true: pasa el expediente a ANULADO y limpia todos sus punteros.
   * - Si reinicioIntegral = false: inspecciona las resoluciones VIGENTES restantes y restituye
   *   asesor, título, dictaminantes, inscripción, fecha/hora y estados de tesistas.
   */
  private async recalcularPunterosExpedienteTrasDse(
    tx: Prisma.TransactionClient,
    expedienteId: string,
    reinicioIntegral: boolean,
  ) {
    if (reinicioIntegral) {
      await tx.expediente.update({
        where: { id: expedienteId },
        data: {
          estado: EstadoExpediente.ANULADO,
          asesorDocenteId: null,
          asesorResolucionId: null,
          tituloActual: null,
          tituloResolucionId: null,
          departamentoDictaminantesId: null,
          dictaminante1Id: null,
          dictaminante2Id: null,
          dictaminante3Id: null,
          dictaminantesResolucionId: null,
          inscripcionResolucionId: null,
          libroInscripcionId: null,
          fechaHoraResolucionId: null,
        },
      });

      await tx.tesista.updateMany({
        where: { expedienteId },
        data: {
          aptoResolucionId: null,
          tituloResolucionId: null,
          notaSustentacion: null,
          resultadoSustentacion: null,
          fechaSustentacionReal: null,
          estado: EstadoTesista.ACTIVO,
        },
      });

      return;
    }

    const resolucionesVigentes = await tx.resolucion.findMany({
      where: {
        expedienteId,
        situacionJuridica: SituacionJuridicaRes.VIGENTE,
        tipo: { not: TipoResolucion.DSE },
      },
      orderBy: { creadoEn: 'asc' },
    });

    const buscarUltimaPorTipos = (tipos: TipoResolucion[]) =>
      [...resolucionesVigentes].reverse().find((r) => tipos.includes(r.tipo)) || null;

    // 1. Puntero de Asesor
    const resAsesorVigente = buscarUltimaPorTipos([
      TipoResolucion.ASESOR,
      TipoResolucion.CAMBIO_ASESOR,
    ]);
    const datosAsesor = (resAsesorVigente?.datosEspecificos as Record<string, unknown>) || null;

    // 2. Puntero de Título
    const resTituloVigente = buscarUltimaPorTipos([
      TipoResolucion.DICTAMEN,
      TipoResolucion.CAMBIO_TITULO,
    ]);
    const datosTitulo = (resTituloVigente?.datosEspecificos as Record<string, unknown>) || null;
    const tituloRecuperado = datosTitulo
      ? String(datosTitulo.debeDecirNuevoTitulo || datosTitulo.tituloProyecto || '')
      : null;

    // 3. Punteros de Dictaminantes
    const resDictVigente = buscarUltimaPorTipos([
      TipoResolucion.DICTAMEN,
      TipoResolucion.TERCER_DICT,
      TipoResolucion.CAMBIO_DICTAMINANTE,
    ]);
    const datosDict = (resDictVigente?.datosEspecificos as Record<string, unknown>) || null;

    const resDictBasePaso2 = buscarUltimaPorTipos([TipoResolucion.DICTAMEN]);
    const datosPaso2 = (resDictBasePaso2?.datosEspecificos as Record<string, unknown>) || null;

    // 4. Puntero de Inscripción y Libro
    const resInscripcionVigente = buscarUltimaPorTipos([TipoResolucion.INSCRIPCION]);
    const asientoLibroActivo = resInscripcionVigente
      ? await tx.libroInscripcion.findUnique({
          where: { resolucionInscripcionId: resInscripcionVigente.id },
        })
      : null;

    // 5. Puntero de Fecha y Hora (Paso 6)
    const resFechaHoraVigente = buscarUltimaPorTipos([TipoResolucion.FECHA_HORA]);

    // 6. Recalcular cada Tesista
    const tesistas = await tx.tesista.findMany({ where: { expedienteId } });
    let todosActivosTituladosFirmados = true;
    let totalActivos = 0;

    for (const t of tesistas) {
      const resDesistimiento = [...resolucionesVigentes]
        .reverse()
        .find((r) => r.tipo === TipoResolucion.DESISTIMIENTO && r.tesistaId === t.id);

      if (resDesistimiento) {
        await tx.tesista.update({
          where: { id: t.id },
          data: { estado: EstadoTesista.DESISTIDO },
        });
        continue;
      }

      totalActivos += 1;

      const resApto = [...resolucionesVigentes]
        .reverse()
        .find((r) => r.tipo === TipoResolucion.APTO && r.tesistaId === t.id);

      const resTitulo = [...resolucionesVigentes]
        .reverse()
        .find((r) => r.tipo === TipoResolucion.TITULO && r.tesistaId === t.id);

      const datosTit = (resTitulo?.datosEspecificos as Record<string, unknown>) || null;

      let nuevoEstadoTesista: EstadoTesista = EstadoTesista.ACTIVO;
      if (resTitulo && resTitulo.estadoDocumental === EstadoDocumentalRes.FIRMADO) {
        nuevoEstadoTesista = EstadoTesista.TITULADO;
      } else if (resApto) {
        nuevoEstadoTesista = EstadoTesista.APTO;
        todosActivosTituladosFirmados = false;
      } else {
        todosActivosTituladosFirmados = false;
      }

      await tx.tesista.update({
        where: { id: t.id },
        data: {
          aptoResolucionId: resApto ? resApto.id : null,
          tituloResolucionId: resTitulo ? resTitulo.id : null,
          notaSustentacion: datosTit ? Number(datosTit.notaSustentacion) : null,
          resultadoSustentacion: datosTit ? String(datosTit.resultadoSustentacion) : null,
          fechaSustentacionReal:
            datosTit && datosTit.fechaSustentacionReal
              ? new Date(`${String(datosTit.fechaSustentacionReal)}T00:00:00.000Z`)
              : null,
          estado: nuevoEstadoTesista,
        },
      });
    }

    const nuevoEstadoExpediente =
      totalActivos > 0 && todosActivosTituladosFirmados
        ? EstadoExpediente.TITULADO
        : EstadoExpediente.ACTIVO;

    await tx.expediente.update({
      where: { id: expedienteId },
      data: {
        estado: nuevoEstadoExpediente,
        asesorDocenteId: datosAsesor ? String(datosAsesor.asesorDocenteId) : null,
        asesorResolucionId: resAsesorVigente ? resAsesorVigente.id : null,
        tituloActual: tituloRecuperado || null,
        tituloResolucionId: resTituloVigente ? resTituloVigente.id : null,
        departamentoDictaminantesId: datosPaso2
          ? Number(datosPaso2.departamentoAcademicoId)
          : null,
        dictaminante1Id: datosDict ? String(datosDict.dictaminante1Id) : null,
        dictaminante2Id: datosDict ? String(datosDict.dictaminante2Id) : null,
        dictaminante3Id:
          datosDict && datosDict.dictaminante3Id ? String(datosDict.dictaminante3Id) : null,
        dictaminantesResolucionId: resDictVigente ? resDictVigente.id : null,
        inscripcionResolucionId: resInscripcionVigente ? resInscripcionVigente.id : null,
        libroInscripcionId: asientoLibroActivo ? asientoLibroActivo.id : null,
        fechaHoraResolucionId: resFechaHoraVigente ? resFechaHoraVigente.id : null,
      },
    });
  }

  // ==========================================================================
  // PARTE B.6: REGISTRO DE DOCUMENTOS ADMINISTRATIVOS EXTERNOS Y CONSULTA LIBROS
  // ==========================================================================
  async registrarDocumentoExterno(
    dto: RegistrarDocumentoExternoDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const fechaDocumento = this.validarFechaNoFutura(dto.fechaDocumento, 'fecha del documento');

    return this.prisma.$transaction(async (tx) => {
      const tipoValidado = await this.validarCausaPorAmbito(
        tx,
        dto.causaTipoId,
        AmbitoCausa.DOCUMENTO_EXTERNO,
        dto.detalleTipoManual,
      );

      const numeracion = await this.reservarSiguienteNumeroSerieAtomico(tx, dto.serie);

      const asientoExterno = await tx.libroNumeracion.create({
        data: {
          numeroCompleto: numeracion.numeroCompleto,
          numero: numeracion.numeroCorrelativo,
          anio: numeracion.anio,
          serie: dto.serie,
          categoria: CategoriaNumeracion.ADMINISTRATIVO,
          tipoDocumentoExterno: tipoValidado.textoConsolidado,
          descripcion: dto.descripcion,
          fechaDocumento,
          registradoPorId: ejecutor.id,
          resolucionId: null,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'REGISTRAR_DOCUMENTO_EXTERNO',
          entidad: 'libro_numeracion',
          entidadId: asientoExterno.id,
          detalle: {
            numeroCompleto: asientoExterno.numeroCompleto,
            serie: asientoExterno.serie,
            tipoDocumentoExterno: asientoExterno.tipoDocumentoExterno,
            descripcion: asientoExterno.descripcion,
          },
        },
      });

      return asientoExterno;
    });
  }

  async listarLibroNumeracion(filtros?: {
    serie?: SerieNumeracion;
    anio?: number;
    categoria?: CategoriaNumeracion;
    q?: string;
  }) {
    return this.prisma.libroNumeracion.findMany({
      where: {
        ...(filtros?.serie ? { serie: filtros.serie } : {}),
        ...(filtros?.anio ? { anio: filtros.anio } : {}),
        ...(filtros?.categoria ? { categoria: filtros.categoria } : {}),
        ...(filtros?.q
          ? {
              OR: [
                { numeroCompleto: { contains: filtros.q.trim(), mode: 'insensitive' } },
                { descripcion: { contains: filtros.q.trim(), mode: 'insensitive' } },
                { tipoDocumentoExterno: { contains: filtros.q.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        registradoPor: { select: { iniciales: true, nombresCompletos: true } },
      },
      orderBy: [{ anio: 'desc' }, { numero: 'desc' }],
      take: 200,
    });
  }

  async listarLibroInscripcion(filtros?: { escuelaId?: number; anio?: number; q?: string }) {
    return this.prisma.libroInscripcion.findMany({
      where: {
        ...(filtros?.escuelaId ? { escuelaProfesionalId: filtros.escuelaId } : {}),
        ...(filtros?.anio ? { anio: filtros.anio } : {}),
        ...(filtros?.q
          ? {
              OR: [
                { numeroFolioFormateado: { contains: filtros.q.trim(), mode: 'insensitive' } },
                { tituloInscritoSnapshot: { contains: filtros.q.trim(), mode: 'insensitive' } },
                { tesistasSnapshot: { contains: filtros.q.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        escuelaProfesional: { select: { id: true, nombre: true } },
        resolucionInscripcion: { select: { id: true, numeroCompleto: true, estadoDocumental: true } },
      },
      orderBy: [{ anio: 'desc' }, { numeroAsiento: 'desc' }],
    });
  }

  // ==========================================================================
  // PARTE B.7: CRUD DEL CATÁLOGO DE CAUSAS Y TIPOS (CatalogoCausa)
  // ==========================================================================
  async listarCatalogoCausas(ambito?: AmbitoCausa, incluirInactivos = false) {
    return this.prisma.catalogoCausa.findMany({
      where: {
        ...(ambito ? { ambito } : {}),
        ...(incluirInactivos ? {} : { activo: true }),
      },
      orderBy: [{ ambito: 'asc' }, { id: 'asc' }],
    });
  }

  async crearCatalogoCausa(
    dto: CrearCatalogoCausaDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const existente = await this.prisma.catalogoCausa.findUnique({
      where: {
        ambito_descripcion: {
          ambito: dto.ambito,
          descripcion: dto.descripcion,
        },
      },
    });

    if (existente) {
      throw new ConflictException(
        `Ya existe una causa registrada con la descripción '${dto.descripcion}' en el ámbito ${dto.ambito}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const creada = await tx.catalogoCausa.create({
        data: {
          ambito: dto.ambito,
          descripcion: dto.descripcion,
          requiereDetalleManual: Boolean(dto.requiereDetalleManual),
          activo: true,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'GESTION_CATALOGO_CAUSA',
          entidad: 'catalogo_causas',
          entidadId: String(creada.id),
          detalle: {
            operacion: 'CREAR_CAUSA',
            ambito: creada.ambito,
            descripcion: creada.descripcion,
            requiereDetalleManual: creada.requiereDetalleManual,
          },
        },
      });

      return creada;
    });
  }

  async actualizarCatalogoCausa(
    id: number,
    dto: ActualizarCatalogoCausaDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const actual = await this.prisma.catalogoCausa.findUnique({ where: { id } });
    if (!actual) {
      throw new NotFoundException('El registro del catálogo de causas no existe.');
    }

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.catalogoCausa.update({
        where: { id },
        data: {
          ...(dto.descripcion ? { descripcion: dto.descripcion } : {}),
          ...(dto.requiereDetalleManual !== undefined
            ? { requiereDetalleManual: dto.requiereDetalleManual }
            : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'GESTION_CATALOGO_CAUSA',
          entidad: 'catalogo_causas',
          entidadId: String(actualizada.id),
          detalle: {
            operacion: 'ACTUALIZAR_CAUSA',
            anterior: actual,
            nuevo: actualizada,
          },
        },
      });

      return actualizada;
    });
  }

  // ==========================================================================
  // MÉTODOS EXISTENTES: CONFIRMAR FIRMA Y CORREGIR BORRADOR EMITIDO
  // ==========================================================================
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