// Ruta: src/plantillas/plantillas.service.ts
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EstadoTesista, EstadoUsuario, RolUsuario, TipoResolucion,
} from '../generated/client';
import { PLANTILLAS_OFICIALES_SEED } from './seed-plantillas';
import { ActualizarPlantillaDto, PrevisualizarPlantillaDto } from './dto/plantillas.dto';

@Injectable()
export class PlantillasService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.asegurarPlantillasBase();
  }

  async asegurarPlantillasBase() {
    for (const item of PLANTILLAS_OFICIALES_SEED) {
      const existe = await this.prisma.plantillaResolucion.findUnique({
        where: { tipo: item.tipo },
      });

      if (!existe) {
        await this.prisma.$transaction(async (tx) => {
          const creada = await tx.plantillaResolucion.create({
            data: {
              tipo: item.tipo,
              nombre: item.nombre,
              seriePorDefecto: item.seriePorDefecto,
              asuntoPlantilla: item.asuntoPlantilla,
              cuerpoHtml: item.cuerpoHtml,
              variablesEsquema: item.variablesEsquema,
              versionActual: 1,
              activa: true,
            },
          });

          await tx.plantillaResolucionHistorial.create({
            data: {
              plantillaId: creada.id,
              version: 1,
              asuntoPlantilla: creada.asuntoPlantilla,
              cuerpoHtml: creada.cuerpoHtml,
              motivoCambio: 'Semilla inicial de plantilla oficial FCSa - UAC',
            },
          });
        });
      }
    }
  }

  async listarTodas() {
    return this.prisma.plantillaResolucion.findMany({
      orderBy: { tipo: 'asc' },
    });
  }

  async obtenerPorTipo(tipo: TipoResolucion) {
    const plantilla = await this.prisma.plantillaResolucion.findUnique({
      where: { tipo },
      include: {
        historialVersiones: { orderBy: { version: 'desc' }, take: 10 },
      },
    });

    if (!plantilla) throw new NotFoundException(`No se encontró plantilla configurada para el tipo ${tipo}`);
    return plantilla;
  }

  async actualizarPlantilla(
    tipo: TipoResolucion,
    dto: ActualizarPlantillaDto,
    usuario: { id: string; iniciales: string },
  ) {
    const actual = await this.obtenerPorTipo(tipo);
    const nuevaVersion = actual.versionActual + 1;

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.plantillaResolucion.update({
        where: { id: actual.id },
        data: {
          nombre: dto.nombre ?? actual.nombre,
          seriePorDefecto: dto.seriePorDefecto ?? actual.seriePorDefecto,
          asuntoPlantilla: dto.asuntoPlantilla,
          cuerpoHtml: dto.cuerpoHtml,
          activa: dto.activa ?? actual.activa,
          versionActual: nuevaVersion,
          actualizadoPorId: usuario.id,
        },
      });

      await tx.plantillaResolucionHistorial.create({
        data: {
          plantillaId: actual.id,
          version: nuevaVersion,
          asuntoPlantilla: actualizada.asuntoPlantilla,
          cuerpoHtml: actualizada.cuerpoHtml,
          motivoCambio: dto.motivoCambio ?? `Actualización manual a versión ${nuevaVersion}`,
          modificadoPorId: usuario.id,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: usuario.id,
          inicialesUsuario: usuario.iniciales,
          accion: 'ACTUALIZAR_PLANTILLA_RESOLUCION',
          entidad: 'PlantillaResolucion',
          entidadId: actual.id,
          detalle: {
            tipo, versionAnterior: actual.versionActual, versionNueva: nuevaVersion,
            motivoCambio: dto.motivoCambio ?? null,
          },
        },
      });

      return actualizada;
    });
  }

  async restaurarVersion(
    tipo: TipoResolucion,
    versionObjetivo: number,
    usuario: { id: string; iniciales: string },
  ) {
    const actual = await this.obtenerPorTipo(tipo);

    const versionHist = await this.prisma.plantillaResolucionHistorial.findUnique({
      where: { plantillaId_version: { plantillaId: actual.id, version: versionObjetivo } },
    });

    if (!versionHist) throw new NotFoundException(`No existe la versión ${versionObjetivo} en el historial de la plantilla ${tipo}`);

    return this.actualizarPlantilla(
      tipo,
      {
        asuntoPlantilla: versionHist.asuntoPlantilla,
        cuerpoHtml: versionHist.cuerpoHtml,
        motivoCambio: `Restauración desde la versión v${versionObjetivo}`,
      },
      usuario,
    );
  }

  async construirContextoVariables(
    expedienteId?: string,
    tesistaId?: string,
    variablesExtra: Record<string, any> = {},
  ): Promise<Record<string, string>> {
    const [config, decano] = await Promise.all([
      this.prisma.configuracionInstitucional.findFirst(),
      this.prisma.usuario.findFirst({
        where: {
          estado: EstadoUsuario.ACTIVO,
          OR: [{ esDecanoFirmante: true }, { rol: RolUsuario.DECANO }],
        },
        orderBy: { esDecanoFirmante: 'desc' },
      }),
    ]);

    const hoyTexto = new Date().toLocaleDateString('es-PE', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const vars: Record<string, string> = {
      ciudad: config?.ciudad ?? 'Cusco',
      facultadNombre: config?.facultad ?? 'Facultad de Ciencias de la Salud',
      universidadNombre: config?.universidad ?? 'Universidad Andina del Cusco',
      siglasFacultad: config?.siglasFacultad ?? 'FCSa',
      siglasUniversidad: config?.siglasUniversidad ?? 'UAC',
      reglamentoMarco: config?.reglamentoMarco ?? 'Resolución N.º 513-CU-2024-UAC',
      decanoFirmante: decano ? `${decano.gradoTitulo} ${decano.nombresCompletos}` : 'Dr. Decano de la Facultad de Ciencias de la Salud',
      fechaEmisionTexto: hoyTexto,
      numeroResolucion: '0000-2026-FCSa-UAC',
      expedienteCodigo: 'EXP-S/N',
      tesistasTexto: '[NOMBRE DEL TESISTA]',
      tesistaIndividualNombre: '[NOMBRE DEL TESISTA]',
      escuelaNombre: '[ESCUELA PROFESIONAL]',
      escuelaSiglas: '[SIGLAS]',
      gradoBachiller: '[GRADO DE BACHILLER]',
      tituloProfesional: '[TÍTULO PROFESIONAL]',
      tituloTesis: '[TÍTULO DEL PROYECTO / TESIS]',
      asesorNombreCompleto: '[DOCENTE ASESOR]',
      asesorDepartamento: '[DEPARTAMENTO ACADÉMICO]',
      dictaminante1Nombre: '[PRIMER DICTAMINANTE]',
      dictaminante2Nombre: '[SEGUNDO DICTAMINANTE]',
      dictaminante3Nombre: '[TERCER DICTAMINANTE]',
      departamentoDictaminantes: '[DEPARTAMENTO DICTAMINANTES]',
    };

    if (expedienteId) {
      const expediente = await this.prisma.expediente.findUnique({
        where: { id: expedienteId },
        include: {
          escuelaProfesional: { include: { departamentoDefecto: true } },
          tesistas: {
            where: { estado: { not: EstadoTesista.DESISTIDO } },
            orderBy: { orden: 'asc' },
            include: { persona: true },
          },
        },
      });

      if (expediente) {
        vars.expedienteCodigo = expediente.codigoExpediente;
        vars.escuelaNombre = expediente.escuelaProfesional.nombre;
        vars.escuelaSiglas = expediente.escuelaProfesional.siglasDocumento;
        vars.gradoBachiller = expediente.escuelaProfesional.gradoBachiller;
        vars.tituloProfesional = expediente.escuelaProfesional.tituloProfesional;
        vars.tituloTesis = expediente.tituloActual ?? vars.tituloTesis;
        vars.departamentoDictaminantes = expediente.escuelaProfesional.departamentoDefecto.nombre;

        if (expediente.tesistas.length > 0) {
          vars.tesistasTexto = expediente.tesistas.map((t) => t.persona.nombreCompleto).join(' y ');
          const tesistaSeleccionado = tesistaId
            ? expediente.tesistas.find((t) => t.id === tesistaId) ?? expediente.tesistas[0]
            : expediente.tesistas[0];

          vars.tesistaIndividualNombre = tesistaSeleccionado.persona.nombreCompleto;

          if (tesistaSeleccionado.fechaSustentacionReal) {
            vars.fechaSustentacionReal = tesistaSeleccionado.fechaSustentacionReal.toLocaleDateString('es-PE');
          }
          if (tesistaSeleccionado.notaSustentacion !== null) {
            vars.notaSustentacion = String(tesistaSeleccionado.notaSustentacion);
          }
          if (tesistaSeleccionado.resultadoSustentacion) {
            vars.resultadoSustentacion = tesistaSeleccionado.resultadoSustentacion;
          }
        }

        if (expediente.asesorDocenteId) {
          const asesor = await this.prisma.docente.findUnique({
            where: { id: expediente.asesorDocenteId },
            include: { persona: true, departamentoAcademico: true },
          });
          if (asesor) {
            vars.asesorNombreCompleto = `${asesor.gradoAcademico} ${asesor.persona.nombreCompleto}`;
            vars.asesorDepartamento = asesor.departamentoAcademico.nombre;
          }
        }

        const idsDictaminantes = [
          expediente.dictaminante1Id, expediente.dictaminante2Id, expediente.dictaminante3Id,
        ].filter((id): id is string => Boolean(id));

        if (idsDictaminantes.length > 0) {
          const docentesDict = await this.prisma.docente.findMany({
            where: { id: { in: idsDictaminantes } },
            include: { persona: true, departamentoAcademico: true },
          });
          const mapaDocentes = new Map(docentesDict.map((d) => [d.id, d]));

          if (expediente.dictaminante1Id) {
            const d1 = mapaDocentes.get(expediente.dictaminante1Id);
            if (d1) {
              vars.dictaminante1Nombre = `${d1.gradoAcademico} ${d1.persona.nombreCompleto}`;
              vars.primerMiembroJurado = vars.dictaminante1Nombre;
              vars.departamentoDictaminantes = d1.departamentoAcademico.nombre;
            }
          }
          if (expediente.dictaminante2Id) {
            const d2 = mapaDocentes.get(expediente.dictaminante2Id);
            if (d2) {
              vars.dictaminante2Nombre = `${d2.gradoAcademico} ${d2.persona.nombreCompleto}`;
              vars.segundoMiembroJurado = vars.dictaminante2Nombre;
            }
          }
          if (expediente.dictaminante3Id) {
            const d3 = mapaDocentes.get(expediente.dictaminante3Id);
            if (d3) {
              vars.dictaminante3Nombre = `${d3.gradoAcademico} ${d3.persona.nombreCompleto}`;
            }
          }
        }
      }
    }

    for (const [k, v] of Object.entries(variablesExtra)) {
      if (v !== undefined && v !== null) {
        vars[k] = String(v);
      }
    }

    return vars;
  }

  interpolarTexto(plantillaTexto: string, variables: Record<string, string>): string {
    return plantillaTexto.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return variables[key] ?? `{{${key}}}`;
    });
  }

  async previsualizarPlantilla(tipo: TipoResolucion, dto: PrevisualizarPlantillaDto) {
    const plantilla = await this.obtenerPorTipo(tipo);
    const variables = await this.construirContextoVariables(dto.expedienteId, dto.tesistaId, dto.variablesExtra);

    const asuntoRenderizado = this.interpolarTexto(plantilla.asuntoPlantilla, variables);
    const cuerpoHtmlRenderizado = this.interpolarTexto(plantilla.cuerpoHtml, variables);

    return {
      tipo: plantilla.tipo,
      version: plantilla.versionActual,
      seriePorDefecto: plantilla.seriePorDefecto,
      asuntoRenderizado,
      cuerpoHtmlRenderizado,
      variablesUtilizadas: variables,
    };
  }
}