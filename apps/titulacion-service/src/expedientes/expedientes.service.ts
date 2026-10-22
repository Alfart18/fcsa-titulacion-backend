import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { EstadoExpediente, EstadoTesista } from '@prisma/client';
import { CrearExpedienteDto } from './dto/crear-expediente.dto';

@Injectable()
export class ExpedientesService {
  constructor(private readonly prisma: PrismaService) {}

  async crearExpediente(
    dto: CrearExpedienteDto,
    ejecutor: { id: string; iniciales: string },
  ) {
    if (dto.tesistas.length === 2) {
      if (dto.tesistas[0].codigoEstudiante === dto.tesistas[1].codigoEstudiante) {
        throw new BadRequestException(
          'Los dos tesistas de un expediente colectivo deben tener códigos universitarios distintos.',
        );
      }
      if (dto.tesistas[0].nombresApellidos === dto.tesistas[1].nombresApellidos) {
        throw new BadRequestException(
          'Los dos tesistas de un expediente colectivo deben ser personas distintas.',
        );
      }
    }

    const escuela = await this.prisma.escuelaProfesional.findUnique({
      where: { id: dto.escuelaProfesionalId },
      include: {
        departamentoDefecto: { select: { id: true, nombre: true } },
      },
    });

    if (!escuela || !escuela.activa) {
      throw new BadRequestException(
        'La Escuela Profesional seleccionada no existe o no se encuentra activa.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const codigos = dto.tesistas.map((t) => t.codigoEstudiante);
      const tramiteActivoExistente = await tx.tesista.findFirst({
        where: {
          codigoEstudiante: { in: codigos },
          estado: { in: [EstadoTesista.ACTIVO, EstadoTesista.APTO] },
          expediente: {
            estado: EstadoExpediente.ACTIVO,
          },
        },
        include: {
          expediente: { select: { codigoExpediente: true } },
        },
      });

      if (tramiteActivoExistente) {
        throw new BadRequestException(
          `El estudiante ${tramiteActivoExistente.nombresApellidos} (Código: ${tramiteActivoExistente.codigoEstudiante}) ya cuenta con un expediente en trámite activo (${tramiteActivoExistente.expediente.codigoExpediente}).`,
        );
      }

      const anioActual = new Date().getFullYear();

      await tx.$executeRaw`
        INSERT INTO contadores_expediente (anio, ultimo_numero, actualizado_en)
        VALUES (${anioActual}::SMALLINT, 0, NOW())
        ON CONFLICT (anio) DO NOTHING
      `;

      const filasContador = await tx.$queryRaw<Array<{ ultimo_numero: number }>>`
        SELECT ultimo_numero
        FROM contadores_expediente
        WHERE anio = ${anioActual}::SMALLINT
        FOR UPDATE
      `;

      const siguienteNumero = Number(filasContador[0].ultimo_numero) + 1;
      const codigoExpediente = `EXP-${anioActual}-${String(siguienteNumero).padStart(4, '0')}`;

      await tx.contadorExpediente.update({
        where: { anio: anioActual },
        data: { ultimoNumero: siguienteNumero },
      });

      const expedienteCreado = await tx.expediente.create({
        data: {
          codigoExpediente,
          escuelaProfesionalId: escuela.id,
          estado: EstadoExpediente.ACTIVO,
          cantidadTesistas: dto.tesistas.length,
          creadoPorId: ejecutor.id,
          tesistas: {
            create: dto.tesistas.map((t, index) => ({
              orden: index + 1,
              nombresApellidos: t.nombresApellidos,
              codigoEstudiante: t.codigoEstudiante,
              estado: EstadoTesista.ACTIVO,
            })),
          },
        },
        include: {
          escuelaProfesional: {
            select: {
              id: true,
              nombre: true,
              gradoBachiller: true,
              tituloProfesional: true,
              departamentoDefecto: { select: { id: true, nombre: true } },
            },
          },
          tesistas: {
            orderBy: { orden: 'asc' },
          },
        },
      });

      await tx.registroAuditoria.create({
        data: {
          usuarioId: ejecutor.id,
          inicialesUsuario: ejecutor.iniciales,
          accion: 'CREAR_EXPEDIENTE',
          entidad: 'expedientes',
          entidadId: expedienteCreado.id,
          expedienteId: expedienteCreado.id,
          detalle: {
            codigoExpediente: expedienteCreado.codigoExpediente,
            escuelaProfesional: escuela.nombre,
            gradoBachillerDerivado: escuela.gradoBachiller,
            tituloProfesionalDerivado: escuela.tituloProfesional,
            cantidadTesistas: expedienteCreado.cantidadTesistas,
            tesistas: expedienteCreado.tesistas.map((t) => ({
              orden: t.orden,
              nombresApellidos: t.nombresApellidos,
              codigoEstudiante: t.codigoEstudiante,
            })),
          },
        },
      });

      return expedienteCreado;
    });
  }

  async listarExpedientes(filtros?: {
    q?: string;
    escuelaId?: number;
    estado?: EstadoExpediente;
  }) {
    const busqueda = filtros?.q?.trim();

    return this.prisma.expediente.findMany({
      where: {
        ...(filtros?.escuelaId ? { escuelaProfesionalId: filtros.escuelaId } : {}),
        ...(filtros?.estado ? { estado: filtros.estado } : {}),
        ...(busqueda
          ? {
              OR: [
                { codigoExpediente: { contains: busqueda, mode: 'insensitive' } },
                { tituloActual: { contains: busqueda, mode: 'insensitive' } },
                {
                  tesistas: {
                    some: {
                      OR: [
                        { nombresApellidos: { contains: busqueda, mode: 'insensitive' } },
                        { codigoEstudiante: { contains: busqueda, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
                {
                  resoluciones: {
                    some: {
                      numeroCompleto: { contains: busqueda, mode: 'insensitive' },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        escuelaProfesional: {
          select: {
            id: true,
            nombre: true,
            gradoBachiller: true,
            tituloProfesional: true,
          },
        },
        tesistas: {
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: { actualizadoEn: 'desc' },
    });
  }

  async obtenerFichaExpediente(expedienteId: string) {
    const expediente = await this.prisma.expediente.findUnique({
      where: { id: expedienteId },
      include: {
        escuelaProfesional: {
          include: {
            departamentoDefecto: { select: { id: true, nombre: true } },
          },
        },
        tesistas: {
          orderBy: { orden: 'asc' },
        },
        resoluciones: {
          orderBy: { creadoEn: 'asc' },
        },
        asientosLibroInscripcion: {
          orderBy: { creadoEn: 'desc' },
        },
      },
    });

    if (!expediente) {
      throw new NotFoundException('El expediente solicitado no existe.');
    }

    const idsDocentesVigentes = [
      expediente.asesorDocenteId,
      expediente.dictaminante1Id,
      expediente.dictaminante2Id,
      expediente.dictaminante3Id,
    ].filter((id): id is string => Boolean(id));

    const docentesVigentes = idsDocentesVigentes.length
      ? await this.prisma.docente.findMany({
          where: { id: { in: idsDocentesVigentes } },
          select: { id: true, gradoAcademico: true, nombresCompletos: true },
        })
      : [];

    const mapaDocentes = new Map(
      docentesVigentes.map((d) => [d.id, `${d.gradoAcademico} ${d.nombresCompletos}`]),
    );

    return {
      ...expediente,
      informacionVigenteConsolidada: {
        gradoBachiller: expediente.escuelaProfesional.gradoBachiller,
        tituloProfesional: expediente.escuelaProfesional.tituloProfesional,
        asesorActual: expediente.asesorDocenteId
          ? mapaDocentes.get(expediente.asesorDocenteId) || null
          : null,
        tituloActual: expediente.tituloActual,
        dictaminante1Actual: expediente.dictaminante1Id
          ? mapaDocentes.get(expediente.dictaminante1Id) || null
          : null,
        dictaminante2Actual: expediente.dictaminante2Id
          ? mapaDocentes.get(expediente.dictaminante2Id) || null
          : null,
        dictaminante3Actual: expediente.dictaminante3Id
          ? mapaDocentes.get(expediente.dictaminante3Id) || null
          : null,
        dictaminantesCongeladosPorPaso6: Boolean(expediente.fechaHoraResolucionId),
      },
    };
  }
}