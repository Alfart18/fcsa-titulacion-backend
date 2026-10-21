import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { EstadoDocente } from '@prisma/client';
import { CrearDocenteDto, GRADOS_DOCENTE_PERMITIDOS } from './dto/crear-docente.dto';
import { ActualizarDocenteDto } from './dto/actualizar-docente.dto';

@Injectable()
export class DocentesService {
  constructor(private readonly prisma: PrismaService) {}

  obtenerGradosPermitidos() {
    return GRADOS_DOCENTE_PERMITIDOS;
  }

  async listarCatalogosAcademicos() {
    const [departamentos, escuelas] = await Promise.all([
      this.prisma.departamentoAcademico.findMany({
        where: { activo: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.escuelaProfesional.findMany({
        where: { activa: true },
        include: {
          departamentoDefecto: { select: { id: true, nombre: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    return {
      departamentos,
      escuelas,
      gradosDocentePermitidos: GRADOS_DOCENTE_PERMITIDOS,
    };
  }

  async listarDocentes(filtros?: {
    q?: string;
    departamentoId?: number;
    escuelaId?: number;
    estado?: EstadoDocente;
  }) {
    const docentes = await this.prisma.docente.findMany({
      where: {
        ...(filtros?.departamentoId ? { departamentoAcademicoId: filtros.departamentoId } : {}),
        ...(filtros?.escuelaId ? { escuelaProfesionalId: filtros.escuelaId } : {}),
        ...(filtros?.estado ? { estado: filtros.estado } : {}),
        ...(filtros?.q
          ? {
              OR: [
                { nombresCompletos: { contains: filtros.q.trim(), mode: 'insensitive' } },
                { correo: { contains: filtros.q.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        departamentoAcademico: { select: { id: true, nombre: true } },
        escuelaProfesional: { select: { id: true, nombre: true } },
      },
      orderBy: { nombresCompletos: 'asc' },
    });

    return docentes.map((d) => ({
      ...d,
      nombreParaResolucion: `${d.gradoAcademico} ${d.nombresCompletos}`,
    }));
  }

  /**
   * Embudo de 3 niveles para selección de Asesores y Dictaminantes:
   * - Nivel 1: Docentes ACTIVOS de la misma Escuela Profesional del expediente.
   * - Nivel 2: Docentes ACTIVOS del mismo Departamento Académico (pero de otra escuela asociada).
   * - Nivel 3: Docentes ACTIVOS de otros Departamentos de la FCSa (para investigaciones interdisciplinarias).
   */
  async buscarDocentesElegiblesEmbudo(params: {
    escuelaProfesionalId: number;
    incluirOtrosDepartamentos?: boolean;
    excluirDocentesIds?: string[];
    q?: string;
  }) {
    const escuela = await this.prisma.escuelaProfesional.findUnique({
      where: { id: params.escuelaProfesionalId },
    });

    if (!escuela) {
      throw new NotFoundException('La Escuela Profesional indicada no existe.');
    }

    const incluirInterdisciplinarios = params.incluirOtrosDepartamentos ?? true;

    const docentesActivos = await this.prisma.docente.findMany({
      where: {
        estado: EstadoDocente.ACTIVO,
        ...(incluirInterdisciplinarios
          ? {}
          : { departamentoAcademicoId: escuela.departamentoDefectoId }),
        ...(params.excluirDocentesIds && params.excluirDocentesIds.length > 0
          ? { id: { notIn: params.excluirDocentesIds } }
          : {}),
        ...(params.q
          ? { nombresCompletos: { contains: params.q.trim(), mode: 'insensitive' } }
          : {}),
      },
      include: {
        departamentoAcademico: { select: { id: true, nombre: true } },
        escuelaProfesional: { select: { id: true, nombre: true } },
      },
    });

    const clasificados = docentesActivos.map((d) => {
      let nivelPrioridad: 1 | 2 | 3 = 3;
      let categoriaEmbudo = 'NIVEL_3_OTRO_DEPARTAMENTO_INTERDISCIPLINARIO';
      let advertenciaInterdisciplinaria: string | null =
        'Docente de otro Departamento Académico (selección permitida para investigación interdisciplinaria).';

      if (d.escuelaProfesionalId === escuela.id) {
        nivelPrioridad = 1;
        categoriaEmbudo = 'NIVEL_1_MISMA_ESCUELA';
        advertenciaInterdisciplinaria = null;
      } else if (d.departamentoAcademicoId === escuela.departamentoDefectoId) {
        nivelPrioridad = 2;
        categoriaEmbudo = 'NIVEL_2_MISMO_DEPARTAMENTO';
        advertenciaInterdisciplinaria = null;
      }

      return {
        id: d.id,
        gradoAcademico: d.gradoAcademico,
        nombresCompletos: d.nombresCompletos,
        nombreParaResolucion: `${d.gradoAcademico} ${d.nombresCompletos}`,
        correo: d.correo,
        departamentoAcademico: d.departamentoAcademico,
        escuelaProfesional: d.escuelaProfesional,
        nivelPrioridad,
        categoriaEmbudo,
        advertenciaInterdisciplinaria,
      };
    });

    // Ordenar estrictamente por Nivel 1 -> Nivel 2 -> Nivel 3 y luego alfabéticamente
    return clasificados.sort((a, b) => {
      if (a.nivelPrioridad !== b.nivelPrioridad) {
        return a.nivelPrioridad - b.nivelPrioridad;
      }
      return a.nombresCompletos.localeCompare(b.nombresCompletos, 'es');
    });
  }

  async crearDocente(dto: CrearDocenteDto, ejecutor: { id: string; iniciales: string }) {
    const existeCorreo = await this.prisma.docente.findUnique({
      where: { correo: dto.correo },
    });
    if (existeCorreo) {
      throw new BadRequestException(
        `Ya existe un docente registrado con el correo ${dto.correo} (${existeCorreo.gradoAcademico} ${existeCorreo.nombresCompletos}).`,
      );
    }

    const [depto, escuela] = await Promise.all([
      this.prisma.departamentoAcademico.findUnique({ where: { id: dto.departamentoAcademicoId } }),
      this.prisma.escuelaProfesional.findUnique({ where: { id: dto.escuelaProfesionalId } }),
    ]);

    if (!depto) throw new BadRequestException('El Departamento Académico seleccionado no existe.');
    if (!escuela) throw new BadRequestException('La Escuela Profesional seleccionada no existe.');

    return this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.docente.create({
        data: {
          gradoAcademico: dto.gradoAcademico,
          nombresCompletos: dto.nombresCompletos,
          correo: dto.correo,
          departamentoAcademicoId: dto.departamentoAcademicoId,
          escuelaProfesionalId: dto.escuelaProfesionalId,
          estado: EstadoDocente.ACTIVO,
        },
        include: {
          departamentoAcademico: { select: { id: true, nombre: true } },
          escuelaProfesional: { select: { id: true, nombre: true } },
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'GESTION_DOCENTE',
          entidad: 'docentes',
          entidadId: nuevo.id,
          detalle: {
            operacion: 'CREAR_DOCENTE',
            nombreParaResolucion: `${nuevo.gradoAcademico} ${nuevo.nombresCompletos}`,
            correo: nuevo.correo,
            departamento: nuevo.departamentoAcademico.nombre,
            escuela: nuevo.escuelaProfesional.nombre,
          },
        },
      });

      return {
        ...nuevo,
        nombreParaResolucion: `${nuevo.gradoAcademico} ${nuevo.nombresCompletos}`,
      };
    });
  }

  async actualizarDocente(
    docenteId: string,
    dto: ActualizarDocenteDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    const actual = await this.prisma.docente.findUnique({
      where: { id: docenteId },
    });
    if (!actual) {
      throw new NotFoundException('Docente no encontrado en el catálogo.');
    }

    if (dto.correo && dto.correo !== actual.correo) {
      const correoOcupado = await this.prisma.docente.findUnique({
        where: { correo: dto.correo },
      });
      if (correoOcupado) {
        throw new BadRequestException(`El correo ${dto.correo} ya pertenece a otro docente.`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.docente.update({
        where: { id: docenteId },
        data: {
          ...(dto.gradoAcademico ? { gradoAcademico: dto.gradoAcademico } : {}),
          ...(dto.nombresCompletos ? { nombresCompletos: dto.nombresCompletos } : {}),
          ...(dto.correo ? { correo: dto.correo } : {}),
          ...(dto.departamentoAcademicoId ? { departamentoAcademicoId: dto.departamentoAcademicoId } : {}),
          ...(dto.escuelaProfesionalId ? { escuelaProfesionalId: dto.escuelaProfesionalId } : {}),
          ...(dto.estado ? { estado: dto.estado } : {}),
        },
        include: {
          departamentoAcademico: { select: { id: true, nombre: true } },
          escuelaProfesional: { select: { id: true, nombre: true } },
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'GESTION_DOCENTE',
          entidad: 'docentes',
          entidadId: actualizado.id,
          detalle: {
            operacion: 'ACTUALIZAR_DOCENTE',
            datosAnteriores: {
              gradoAcademico: actual.gradoAcademico,
              nombresCompletos: actual.nombresCompletos,
              correo: actual.correo,
              departamentoAcademicoId: actual.departamentoAcademicoId,
              escuelaProfesionalId: actual.escuelaProfesionalId,
              estado: actual.estado,
            },
            datosNuevos: {
              gradoAcademico: actualizado.gradoAcademico,
              nombresCompletos: actualizado.nombresCompletos,
              correo: actualizado.correo,
              departamentoAcademicoId: actualizado.departamentoAcademicoId,
              escuelaProfesionalId: actualizado.escuelaProfesionalId,
              estado: actualizado.estado,
            },
          },
        },
      });

      return {
        ...actualizado,
        nombreParaResolucion: `${actualizado.gradoAcademico} ${actualizado.nombresCompletos}`,
      };
    });
  }
}