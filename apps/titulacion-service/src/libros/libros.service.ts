// Ruta: src/libros/libros.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AmbitoCausa,
  CategoriaNumeracion,
  EstadoTesista,
  Prisma,
  SerieNumeracion,
} from '../generated/client';
import {
  FiltroLibroInscripcionDto,
  FiltroLibroNumeracionDto,
  FiltroLibroTituloDto,
  ReservarNumeracionExternaDto,
} from './dto/libros.dto';

@Injectable()
export class LibrosService {
  constructor(private readonly prisma: PrismaService) {}

  async formatearNumeroResolucion(
    tx: Prisma.TransactionClient,
    serie: SerieNumeracion,
    anio: number,
    correlativo: number,
  ): Promise<string> {
    const config = await tx.configuracionInstitucional.findFirst();
    const siglasFacultad = config?.siglasFacultad ?? 'FCSa';
    const siglasUniversidad = config?.siglasUniversidad ?? 'UAC';
    const numPadded = String(correlativo).padStart(4, '0');

    if (serie === SerieNumeracion.CF) {
      return `${numPadded}-${anio}-CF-${siglasFacultad}-${siglasUniversidad}`;
    }
    return `${numPadded}-${anio}-${siglasFacultad}-${siglasUniversidad}`;
  }

  async reservarNumeracionExterna(
    dto: ReservarNumeracionExternaDto,
    usuario: { id: string; iniciales: string },
  ) {
    const anio = dto.anio ?? new Date().getFullYear();
    let tipoDocExterno = dto.tipoDocumentoExterno?.trim() ?? null;

    if (dto.causaCatalogoId) {
      const causa = await this.prisma.catalogoCausa.findUnique({
        where: { id: dto.causaCatalogoId },
      });

      if (!causa || !causa.activo) {
        throw new NotFoundException(
          `La causa de catálogo con ID ${dto.causaCatalogoId} no existe o está inactiva`,
        );
      }

      if (causa.ambito !== AmbitoCausa.DOCUMENTO_EXTERNO) {
        throw new BadRequestException(
          `La causa seleccionada pertenece al ámbito ${causa.ambito}, se esperaba DOCUMENTO_EXTERNO`,
        );
      }

      if (causa.requiereDetalleManual && !tipoDocExterno) {
        throw new BadRequestException(
          `La causa "${causa.descripcion}" requiere especificar el detalle en tipoDocumentoExterno`,
        );
      }

      tipoDocExterno = tipoDocExterno
        ? `${causa.descripcion}: ${tipoDocExterno}`
        : causa.descripcion;
    }

    if (!tipoDocExterno) {
      tipoDocExterno = 'RESOLUCIÓN ADMINISTRATIVA EXTERNA';
    }

    return this.prisma.$transaction(async (tx) => {
      const contador = await tx.contadorSerie.upsert({
        where: {
          anio_serie: {
            anio,
            serie: dto.serie,
          },
        },
        update: { ultimoNumero: { increment: 1 } },
        create: { anio, serie: dto.serie, ultimoNumero: 1 },
      });

      const numeroCompleto = await this.formatearNumeroResolucion(
        tx, dto.serie, anio, contador.ultimoNumero,
      );

      const asiento = await tx.libroNumeracion.create({
        data: {
          numeroCompleto,
          numero: contador.ultimoNumero,
          anio,
          serie: dto.serie,
          categoria: CategoriaNumeracion.ADMINISTRATIVO,
          tipoDocumentoExterno: tipoDocExterno.slice(0, 80),
          descripcion: dto.descripcion.trim(),
          fechaDocumento: dto.fechaDocumento ? new Date(dto.fechaDocumento) : new Date(),
          registradoPorId: usuario.id,
          resolucionId: null,
        },
        include: {
          registradoPor: { select: { id: true, nombresCompletos: true, iniciales: true } },
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: usuario.id,
          inicialesUsuario: usuario.iniciales,
          accion: 'RESERVAR_NUMERACION_EXTERNA',
          entidad: 'LibroNumeracion',
          entidadId: asiento.id,
          detalle: {
            numeroCompleto: asiento.numeroCompleto,
            serie: asiento.serie,
            anio: asiento.anio,
            numero: asiento.numero,
            tipoDocumentoExterno: asiento.tipoDocumentoExterno,
            descripcion: asiento.descripcion,
          },
        },
      });

      return asiento;
    });
  }

  async asignarNumeracionTitulacionTx(
    tx: Prisma.TransactionClient,
    params: {
      serie: SerieNumeracion;
      anio: number;
      resolucionId: string;
      descripcion: string;
      fechaDocumento: Date;
      registradoPorId: string;
    },
  ) {
    const contador = await tx.contadorSerie.upsert({
      where: { anio_serie: { anio: params.anio, serie: params.serie } },
      update: { ultimoNumero: { increment: 1 } },
      create: { anio: params.anio, serie: params.serie, ultimoNumero: 1 },
    });

    const numeroCompleto = await this.formatearNumeroResolucion(
      tx, params.serie, params.anio, contador.ultimoNumero,
    );

    const asiento = await tx.libroNumeracion.create({
      data: {
        numeroCompleto,
        numero: contador.ultimoNumero,
        anio: params.anio,
        serie: params.serie,
        categoria: CategoriaNumeracion.TITULACION,
        tipoDocumentoExterno: null,
        descripcion: params.descripcion,
        fechaDocumento: params.fechaDocumento,
        registradoPorId: params.registradoPorId,
        resolucionId: params.resolucionId,
      },
    });

    return { numeroCorrelativo: contador.ultimoNumero, numeroCompleto, asiento };
  }

  async registrarAsientoInscripcionTx(
    tx: Prisma.TransactionClient,
    params: {
      expedienteId: string;
      resolucionInscripcionId: string;
      anio?: number;
      fechaAsiento?: Date;
      tituloOverride?: string;
    },
  ) {
    const existente = await tx.libroInscripcion.findUnique({
      where: { resolucionInscripcionId: params.resolucionInscripcionId },
    });
    if (existente) throw new ConflictException('La resolución indicada ya posee un asiento en el Libro de Inscripción');

    const expediente = await tx.expediente.findUnique({
      where: { id: params.expedienteId },
      include: {
        escuelaProfesional: true,
        tesistas: {
          where: { estado: { not: EstadoTesista.DESISTIDO } },
          orderBy: { orden: 'asc' },
          include: { persona: true },
        },
      },
    });

    if (!expediente) throw new NotFoundException('Expediente no encontrado para el Libro de Inscripción');

    const tituloSnapshot = (params.tituloOverride ?? expediente.tituloActual ?? '').trim();
    if (!tituloSnapshot) throw new BadRequestException('El expediente no tiene un título de tesis registrado');
    if (expediente.tesistas.length === 0) throw new BadRequestException('El expediente no cuenta con tesistas activos');

    const tesistasSnapshot = expediente.tesistas
      .map((t) => {
        const codigo = t.persona.codigoUniversitario ? ` (${t.persona.codigoUniversitario})` : '';
        return `${t.persona.nombreCompleto}${codigo}`;
      })
      .join(' / ');

    let asesorSnapshot = 'SIN ASESOR REGISTRADO';
    if (expediente.asesorDocenteId) {
      const docenteAsesor = await tx.docente.findUnique({
        where: { id: expediente.asesorDocenteId },
        include: { persona: true },
      });
      if (docenteAsesor) asesorSnapshot = `${docenteAsesor.gradoAcademico} ${docenteAsesor.persona.nombreCompleto}`.slice(0, 200);
    }

    const anio = params.anio ?? new Date().getFullYear();

    const contador = await tx.contadorLibroInscripcion.upsert({
      where: { escuelaProfesionalId_anio: { escuelaProfesionalId: expediente.escuelaProfesionalId, anio } },
      update: { ultimoAsiento: { increment: 1 } },
      create: { escuelaProfesionalId: expediente.escuelaProfesionalId, anio, ultimoAsiento: 1 },
    });

    const numeroFolioFormateado = `INS-${expediente.escuelaProfesional.siglasDocumento}-${anio}-${String(contador.ultimoAsiento).padStart(4, '0')}`;

    const asiento = await tx.libroInscripcion.create({
      data: {
        escuelaProfesionalId: expediente.escuelaProfesionalId,
        numeroAsiento: contador.ultimoAsiento,
        anio,
        numeroFolioFormateado,
        expedienteId: expediente.id,
        resolucionInscripcionId: params.resolucionInscripcionId,
        tituloInscritoSnapshot: tituloSnapshot,
        tesistasSnapshot,
        asesorSnapshot,
        estadoAsiento: 'ACTIVO',
        fechaAsiento: params.fechaAsiento ?? new Date(),
      },
      include: {
        escuelaProfesional: true,
        resolucionInscripcion: { select: { id: true, numeroCompleto: true, fechaEmision: true } },
      },
    });

    await tx.expediente.update({
      where: { id: expediente.id },
      data: { libroInscripcionId: asiento.id, inscripcionResolucionId: params.resolucionInscripcionId },
    });

    return asiento;
  }

  async registrarAsientoTituloTx(
    tx: Prisma.TransactionClient,
    params: {
      expedienteId: string;
      tesistaId: string;
      resolucionTituloId: string;
      anioRegistro?: number;
      denominacionOtorgada?: string;
      informeConformidadSA?: string;
    },
  ) {
    const existente = await tx.libroTitulo.findUnique({
      where: { resolucionTituloId: params.resolucionTituloId },
    });
    if (existente) throw new ConflictException('La resolución de título indicada ya posee un registro');

    const expediente = await tx.expediente.findUnique({
      where: { id: params.expedienteId },
      include: { escuelaProfesional: true },
    });
    if (!expediente) throw new NotFoundException('Expediente no encontrado');

    const tesista = await tx.tesista.findFirst({
      where: { id: params.tesistaId, expedienteId: params.expedienteId },
      include: { persona: true },
    });
    if (!tesista) throw new NotFoundException('El tesista especificado no existe');

    const anioRegistro = params.anioRegistro ?? new Date().getFullYear();

    const contador = await tx.contadorLibroTitulo.upsert({
      where: { escuelaProfesionalId_anio: { escuelaProfesionalId: expediente.escuelaProfesionalId, anio: anioRegistro } },
      update: { ultimoRegistro: { increment: 1 } },
      create: { escuelaProfesionalId: expediente.escuelaProfesionalId, anio: anioRegistro, ultimoRegistro: 1 },
    });

    const denominacion = (params.denominacionOtorgada ?? expediente.escuelaProfesional.tituloProfesional).slice(0, 200);

    const registroTitulo = await tx.libroTitulo.create({
      data: {
        tesistaId: tesista.id,
        numeroRegistro: contador.ultimoRegistro,
        anioRegistro,
        expedienteId: expediente.id,
        resolucionTituloId: params.resolucionTituloId,
        escuelaProfesionalId: expediente.escuelaProfesionalId,
        tituladoTexto: tesista.persona.nombreCompleto.slice(0, 250),
        denominacionOtorgada: denominacion,
        fechaSustentacion: tesista.fechaSustentacionReal,
        notaNumero: tesista.notaSustentacion,
        notaCalificativo: tesista.resultadoSustentacion,
        informeConformidadSA: params.informeConformidadSA?.slice(0, 100) ?? null,
        estado: 'VIGENTE',
      },
      include: {
        escuelaProfesional: true,
        resolucionTitulo: { select: { id: true, numeroCompleto: true, fechaEmision: true } },
      },
    });

    await tx.tesista.update({
      where: { id: tesista.id },
      data: { tituloResolucionId: params.resolucionTituloId, estado: EstadoTesista.TITULADO },
    });

    return registroTitulo;
  }

  async listarLibroNumeracion(filtros: FiltroLibroNumeracionDto) {
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.LibroNumeracionWhereInput = {};

    if (filtros.anio) where.anio = filtros.anio;
    if (filtros.serie) where.serie = filtros.serie;
    if (filtros.categoria) where.categoria = filtros.categoria;

    if (filtros.busqueda?.trim()) {
      const q = filtros.busqueda.trim();
      where.OR = [
        { numeroCompleto: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
        { tipoDocumentoExterno: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.libroNumeracion.count({ where }),
      this.prisma.libroNumeracion.findMany({
        where, skip, take: limit,
        orderBy: [{ anio: 'desc' }, { serie: 'asc' }, { numero: 'desc' }],
        include: {
          registradoPor: { select: { id: true, nombresCompletos: true, iniciales: true } },
          resolucion: {
            select: {
              id: true, tipo: true, situacionJuridica: true, estadoDocumental: true, expedienteId: true,
              expediente: { select: { codigoExpediente: true } },
            },
          },
        },
      }),
    ]);

    return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async listarLibroInscripcion(filtros: FiltroLibroInscripcionDto) {
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.LibroInscripcionWhereInput = {};

    if (filtros.escuelaProfesionalId) where.escuelaProfesionalId = filtros.escuelaProfesionalId;
    if (filtros.anio) where.anio = filtros.anio;
    if (filtros.estadoAsiento) where.estadoAsiento = filtros.estadoAsiento;

    if (filtros.busqueda?.trim()) {
      const q = filtros.busqueda.trim();
      where.OR = [
        { numeroFolioFormateado: { contains: q, mode: 'insensitive' } },
        { tituloInscritoSnapshot: { contains: q, mode: 'insensitive' } },
        { tesistasSnapshot: { contains: q, mode: 'insensitive' } },
        { asesorSnapshot: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.libroInscripcion.count({ where }),
      this.prisma.libroInscripcion.findMany({
        where, skip, take: limit,
        orderBy: [{ anio: 'desc' }, { escuelaProfesionalId: 'asc' }, { numeroAsiento: 'desc' }],
        include: {
          escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
          expediente: { select: { id: true, codigoExpediente: true, estado: true } },
          resolucionInscripcion: {
            select: { id: true, numeroCompleto: true, fechaEmision: true, situacionJuridica: true, estadoDocumental: true },
          },
        },
      }),
    ]);

    return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async listarLibroTitulo(filtros: FiltroLibroTituloDto) {
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.LibroTituloWhereInput = {};

    if (filtros.escuelaProfesionalId) where.escuelaProfesionalId = filtros.escuelaProfesionalId;
    if (filtros.anioRegistro) where.anioRegistro = filtros.anioRegistro;
    if (filtros.estado) where.estado = filtros.estado;

    if (filtros.busqueda?.trim()) {
      const q = filtros.busqueda.trim();
      where.OR = [
        { tituladoTexto: { contains: q, mode: 'insensitive' } },
        { denominacionOtorgada: { contains: q, mode: 'insensitive' } },
        { informeConformidadSA: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.libroTitulo.count({ where }),
      this.prisma.libroTitulo.findMany({
        where, skip, take: limit,
        orderBy: [{ anioRegistro: 'desc' }, { escuelaProfesionalId: 'asc' }, { numeroRegistro: 'desc' }],
        include: {
          escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
          expediente: { select: { id: true, codigoExpediente: true, tituloActual: true } },
          resolucionTitulo: {
            select: { id: true, numeroCompleto: true, fechaEmision: true, situacionJuridica: true, estadoDocumental: true },
          },
        },
      }),
    ]);

    return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async obtenerResumenContadores(anio?: number) {
    const anioConsulta = anio ?? new Date().getFullYear();
    const [
      contadorExpediente, contadoresSerie, contadoresInscripcion, contadoresTitulo, escuelas,
    ] = await Promise.all([
      this.prisma.contadorExpediente.findUnique({ where: { anio: anioConsulta } }),
      this.prisma.contadorSerie.findMany({ where: { anio: anioConsulta } }),
      this.prisma.contadorLibroInscripcion.findMany({ where: { anio: anioConsulta } }),
      this.prisma.contadorLibroTitulo.findMany({ where: { anio: anioConsulta } }),
      this.prisma.escuelaProfesional.findMany({
        where: { activa: true },
        orderBy: { id: 'asc' },
        select: { id: true, nombre: true, siglasDocumento: true },
      }),
    ]);

    return {
      anio: anioConsulta,
      expedientes: { ultimoNumero: contadorExpediente?.ultimoNumero ?? 0 },
      seriesResolucion: {
        ORD: contadoresSerie.find((c) => c.serie === SerieNumeracion.ORD)?.ultimoNumero ?? 0,
        CF: contadoresSerie.find((c) => c.serie === SerieNumeracion.CF)?.ultimoNumero ?? 0,
      },
      librosPorEscuela: escuelas.map((esc) => ({
        escuelaProfesionalId: esc.id,
        escuela: esc.nombre,
        siglas: esc.siglasDocumento,
        ultimoAsientoInscripcion: contadoresInscripcion.find((i) => i.escuelaProfesionalId === esc.id)?.ultimoAsiento ?? 0,
        ultimoRegistroTitulo: contadoresTitulo.find((t) => t.escuelaProfesionalId === esc.id)?.ultimoRegistro ?? 0,
      })),
    };
  }
}