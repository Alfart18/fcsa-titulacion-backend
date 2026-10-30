// Ruta: src/personas/personas.service.ts
import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { EstadoDocente, Prisma } from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarPersonaDto } from './dto/actualizar-persona.dto';
import { CrearDocenteDto } from './dto/crear-docente.dto';
import { CrearEstudianteDto } from './dto/crear-estudiante.dto';
import { ListarDocentesActivosDto } from './dto/listar-docentes-activos.dto';
import { ListarPersonasDto } from './dto/listar-personas.dto';
import type {
  DocenteActivoSelectorResponse, PaginatedPersonasResponse, PersonaResponse,
} from './dto/response/persona.response';

const DOMINIO_INSTITUCIONAL = '@uandina.edu.pe';

@Injectable()
export class PersonasService {
  constructor(private readonly prisma: PrismaService) {}

  private construirNombreCompleto(nombres: string, apellidoPaterno: string, apellidoMaterno: string): string {
    return `${nombres.trim()} ${apellidoPaterno.trim()} ${apellidoMaterno.trim()}`.replace(/\s+/g, ' ').trim();
  }

  async listarPersonas(dto: ListarPersonasDto): Promise<PaginatedPersonasResponse> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.PersonaWhereInput = {};

    if (dto.tipo === 'docente') { where.esDocente = true; } 
    else if (dto.tipo === 'estudiante') { where.esEstudiante = true; }

    if (dto.q && dto.q.trim().length > 0) {
      const termino = dto.q.trim();
      where.OR = [
        { nombreCompleto: { contains: termino, mode: 'insensitive' } },
        { correo: { contains: termino, mode: 'insensitive' } },
        { codigoUniversitario: { contains: termino, mode: 'insensitive' } },
      ];
    }

    const [total, personas] = await Promise.all([
      this.prisma.persona.count({ where }),
      this.prisma.persona.findMany({
        where, skip, take: limit, orderBy: { nombreCompleto: 'asc' },
        include: {
          docente: {
            include: {
              departamentoAcademico: { select: { id: true, nombre: true } },
              escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    return { data: personas, meta: { page, limit, total, totalPages } };
  }

  async crearDocente(dto: CrearDocenteDto): Promise<PersonaResponse> {
    const nombres = dto.nombres.trim();
    const apellidoPaterno = dto.apellidoPaterno.trim();
    const apellidoMaterno = dto.apellidoMaterno.trim();
    const correo = dto.correo.trim().toLowerCase();
    const telefono = dto.telefono?.trim() || null;
    const gradoAcademico = dto.gradoAcademico.trim();
    const nombreCompleto = this.construirNombreCompleto(nombres, apellidoPaterno, apellidoMaterno);

    const [departamento, escuela, personaExistente] = await Promise.all([
      this.prisma.departamentoAcademico.findUnique({ where: { id: dto.departamentoAcademicoId } }),
      this.prisma.escuelaProfesional.findUnique({ where: { id: dto.escuelaProfesionalId } }),
      this.prisma.persona.findUnique({ where: { correo }, include: { docente: true } }),
    ]);

    if (!departamento || !departamento.activo) throw new BadRequestException('El departamento académico especificado no existe o se encuentra inactivo.');
    if (!escuela || !escuela.activa) throw new BadRequestException('La escuela profesional especificada no existe o se encuentra inactiva.');

    if (personaExistente) {
      if (personaExistente.docente) throw new ConflictException(`Ya existe un docente registrado con el correo "${correo}".`);

      return this.prisma.persona.update({
        where: { id: personaExistente.id },
        data: {
          nombres, apellidoPaterno, apellidoMaterno, nombreCompleto,
          telefono: telefono ?? personaExistente.telefono,
          esDocente: true,
          docente: {
            create: {
              gradoAcademico, departamentoAcademicoId: dto.departamentoAcademicoId,
              escuelaProfesionalId: dto.escuelaProfesionalId, estado: EstadoDocente.ACTIVO,
            },
          },
        },
        include: {
          docente: {
            include: {
              departamentoAcademico: { select: { id: true, nombre: true } },
              escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
            },
          },
        },
      });
    }

    return this.prisma.persona.create({
      data: {
        nombres, apellidoPaterno, apellidoMaterno, nombreCompleto, correo, telefono,
        esDocente: true, esEstudiante: false,
        docente: {
          create: {
            gradoAcademico, departamentoAcademicoId: dto.departamentoAcademicoId,
            escuelaProfesionalId: dto.escuelaProfesionalId, estado: EstadoDocente.ACTIVO,
          },
        },
      },
      include: {
        docente: {
          include: {
            departamentoAcademico: { select: { id: true, nombre: true } },
            escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
          },
        },
      },
    });
  }

  async crearEstudiante(dto: CrearEstudianteDto): Promise<PersonaResponse> {
    const nombres = dto.nombres.trim();
    const apellidoPaterno = dto.apellidoPaterno.trim();
    const apellidoMaterno = dto.apellidoMaterno.trim();
    const codigoUniversitario = dto.codigoUniversitario.trim();
    const correo = dto.correo && dto.correo.trim().length > 0 ? dto.correo.trim().toLowerCase() : `${codigoUniversitario.toLowerCase()}${DOMINIO_INSTITUCIONAL}`;
    const telefono = dto.telefono?.trim() || null;
    const nombreCompleto = this.construirNombreCompleto(nombres, apellidoPaterno, apellidoMaterno);

    const [porCodigo, porCorreo] = await Promise.all([
      this.prisma.persona.findUnique({ where: { codigoUniversitario } }),
      this.prisma.persona.findUnique({ where: { correo } }),
    ]);

    if (porCodigo) throw new ConflictException(`El código universitario "${codigoUniversitario}" ya se encuentra registrado.`);
    if (porCorreo) throw new ConflictException(`El correo electrónico "${correo}" ya pertenece a otra persona registrada.`);

    return this.prisma.persona.create({
      data: {
        nombres, apellidoPaterno, apellidoMaterno, nombreCompleto, codigoUniversitario, correo, telefono,
        esEstudiante: true, esDocente: false,
      },
      include: {
        docente: {
          include: {
            departamentoAcademico: { select: { id: true, nombre: true } },
            escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
          },
        },
      },
    });
  }

  async obtenerPorId(id: string): Promise<PersonaResponse> {
    const persona = await this.prisma.persona.findUnique({
      where: { id },
      include: {
        docente: {
          include: {
            departamentoAcademico: { select: { id: true, nombre: true } },
            escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
          },
        },
        tesista: {
          include: { expediente: { select: { id: true, codigoExpediente: true } } },
          orderBy: { creadoEn: 'desc' },
        },
      },
    });

    if (!persona) throw new NotFoundException(`No se encontró la persona con ID "${id}".`);

    return {
      id: persona.id, nombres: persona.nombres, apellidoPaterno: persona.apellidoPaterno,
      apellidoMaterno: persona.apellidoMaterno, nombreCompleto: persona.nombreCompleto,
      correo: persona.correo, telefono: persona.telefono, codigoUniversitario: persona.codigoUniversitario,
      esDocente: persona.esDocente, esEstudiante: persona.esEstudiante,
      creadoEn: persona.creadoEn, actualizadoEn: persona.actualizadoEn, docente: persona.docente,
      tesista: persona.tesista.map((t) => ({
        id: t.id, expedienteId: t.expedienteId, codigoExpediente: t.expediente.codigoExpediente,
        orden: t.orden, estado: t.estado,
      })),
    };
  }

  async actualizarPersona(id: string, dto: ActualizarPersonaDto): Promise<PersonaResponse> {
    const actual = await this.prisma.persona.findUnique({ where: { id }, include: { docente: true } });
    if (!actual) throw new NotFoundException(`No se encontró la persona con ID "${id}".`);

    const nombres = dto.nombres !== undefined ? dto.nombres.trim() : actual.nombres;
    const apellidoPaterno = dto.apellidoPaterno !== undefined ? dto.apellidoPaterno.trim() : actual.apellidoPaterno;
    const apellidoMaterno = dto.apellidoMaterno !== undefined ? dto.apellidoMaterno.trim() : actual.apellidoMaterno;
    const nombreCompleto = this.construirNombreCompleto(nombres, apellidoPaterno, apellidoMaterno);

    let correo = actual.correo;
    if (dto.correo !== undefined) {
      correo = dto.correo.trim().toLowerCase();
      if (correo !== actual.correo) {
        const duplicadoCorreo = await this.prisma.persona.findUnique({ where: { correo } });
        if (duplicadoCorreo && duplicadoCorreo.id !== id) throw new ConflictException(`El correo electrónico "${correo}" ya está registrado en otra persona.`);
      }
    }

    let codigoUniversitario = actual.codigoUniversitario;
    if (dto.codigoUniversitario !== undefined) {
      codigoUniversitario = dto.codigoUniversitario.trim();
      if (codigoUniversitario !== actual.codigoUniversitario) {
        const duplicadoCodigo = await this.prisma.persona.findUnique({ where: { codigoUniversitario } });
        if (duplicadoCodigo && duplicadoCodigo.id !== id) throw new ConflictException(`El código universitario "${codigoUniversitario}" ya está registrado en otra persona.`);
      }
    }

    const tieneCamposDocente = dto.gradoAcademico !== undefined || dto.departamentoAcademicoId !== undefined || dto.escuelaProfesionalId !== undefined || dto.estadoDocente !== undefined;
    if (tieneCamposDocente && !actual.docente) throw new BadRequestException('No se pueden actualizar datos de docente porque esta persona no está registrada como docente.');

    if (dto.departamentoAcademicoId !== undefined) {
      const depto = await this.prisma.departamentoAcademico.findUnique({ where: { id: dto.departamentoAcademicoId } });
      if (!depto || !depto.activo) throw new BadRequestException('El departamento académico especificado no existe o se encuentra inactivo.');
    }

    if (dto.escuelaProfesionalId !== undefined) {
      const esc = await this.prisma.escuelaProfesional.findUnique({ where: { id: dto.escuelaProfesionalId } });
      if (!esc || !esc.activa) throw new BadRequestException('La escuela profesional especificada no existe o se encuentra inactiva.');
    }

    return this.prisma.persona.update({
      where: { id },
      data: {
        nombres, apellidoPaterno, apellidoMaterno, nombreCompleto, correo, codigoUniversitario,
        telefono: dto.telefono !== undefined ? dto.telefono.trim() : actual.telefono,
        ...(actual.docente && tieneCamposDocente ? {
          docente: {
            update: {
              gradoAcademico: dto.gradoAcademico !== undefined ? dto.gradoAcademico.trim() : actual.docente.gradoAcademico,
              departamentoAcademicoId: dto.departamentoAcademicoId ?? actual.docente.departamentoAcademicoId,
              escuelaProfesionalId: dto.escuelaProfesionalId ?? actual.docente.escuelaProfesionalId,
              estado: dto.estadoDocente ?? actual.docente.estado,
            },
          },
        } : {}),
      },
      include: {
        docente: {
          include: {
            departamentoAcademico: { select: { id: true, nombre: true } },
            escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
          },
        },
      },
    });
  }

  async desactivarDocente(id: string): Promise<PersonaResponse> {
    const docente = await this.prisma.docente.findFirst({ where: { OR: [{ id }, { personaId: id }] } });
    if (!docente) throw new NotFoundException(`No se encontró un registro de docente asociado al identificador "${id}".`);

    await this.prisma.docente.update({ where: { id: docente.id }, data: { estado: EstadoDocente.INACTIVO } });
    return this.obtenerPorId(docente.personaId);
  }

  async listarDocentesActivos(dto: ListarDocentesActivosDto): Promise<DocenteActivoSelectorResponse[]> {
    const where: Prisma.DocenteWhereInput = { estado: EstadoDocente.ACTIVO };
    if (dto.departamentoId !== undefined) where.departamentoAcademicoId = dto.departamentoId;
    if (dto.escuelaId !== undefined) where.escuelaProfesionalId = dto.escuelaId;
    if (dto.q && dto.q.trim().length > 0) {
      const termino = dto.q.trim();
      where.persona = { OR: [{ nombreCompleto: { contains: termino, mode: 'insensitive' } }, { correo: { contains: termino, mode: 'insensitive' } }] };
    }

    const docentes = await this.prisma.docente.findMany({
      where, orderBy: { persona: { nombreCompleto: 'asc' } },
      include: {
        persona: true,
        departamentoAcademico: { select: { id: true, nombre: true } },
        escuelaProfesional: { select: { id: true, nombre: true, siglasDocumento: true } },
      },
    });

    return docentes.map((d) => ({
      docenteId: d.id, personaId: d.personaId, nombreCompleto: d.persona.nombreCompleto,
      gradoAcademico: d.gradoAcademico, correo: d.persona.correo, estado: d.estado,
      departamentoAcademico: d.departamentoAcademico, escuelaProfesional: d.escuelaProfesional,
    }));
  }
}