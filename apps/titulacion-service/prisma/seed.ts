// Ruta: prisma/seed.ts
import { PrismaClient, RolUsuario, EstadoUsuario, AmbitoCausa } from '../src/generated/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Configuración Institucional
  // TODO: confirmar reglamento vigente aplicable a la FCSa.
  await prisma.configuracionInstitucional.upsert({
    where: { id: 1 },
    update: {
      facultad: 'Facultad de Ciencias de la Salud',
      universidad: 'Universidad Andina del Cusco',
      ciudad: 'Cusco',
      siglasFacultad: 'FCSa',
      siglasUniversidad: 'UAC',
      reglamentoMarco: 'Resolución N.º 513-CU-2024-UAC',
    },
    create: {
      id: 1,
      facultad: 'Facultad de Ciencias de la Salud',
      universidad: 'Universidad Andina del Cusco',
      ciudad: 'Cusco',
      siglasFacultad: 'FCSa',
      siglasUniversidad: 'UAC',
      reglamentoMarco: 'Resolución N.º 513-CU-2024-UAC',
    },
  });

  // 2. Departamentos Académicos (4)
  const nombresDepartamentos = [
    'Medicina Humana',
    'Enfermería y Obstetricia',
    'Estomatología',
    'Psicología',
  ];

  const departamentosMap = new Map<string, number>();

  for (const nombre of nombresDepartamentos) {
    const depto = await prisma.departamentoAcademico.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre, activo: true },
    });
    departamentosMap.set(nombre, depto.id);
  }

  // 3. Escuelas Profesionales (6)
  // Nota: nombre va SIN prefijo "Escuela Profesional de..." y todo en masculino genérico.
  const escuelasData = [
    {
      nombre: 'Medicina Humana',
      siglasDocumento: 'MED',
      gradoBachiller: 'Bachiller en Medicina Humana',
      tituloProfesional: 'Médico Cirujano',
      departamentoDefectoNombre: 'Medicina Humana',
    },
    {
      nombre: 'Enfermería',
      siglasDocumento: 'ENF',
      gradoBachiller: 'Bachiller en Enfermería',
      tituloProfesional: 'Licenciado en Enfermería',
      departamentoDefectoNombre: 'Enfermería y Obstetricia',
    },
    {
      nombre: 'Obstetricia',
      siglasDocumento: 'OBS',
      gradoBachiller: 'Bachiller en Obstetricia',
      tituloProfesional: 'Licenciado en Obstetricia',
      departamentoDefectoNombre: 'Enfermería y Obstetricia',
    },
    {
      nombre: 'Estomatología',
      // TODO: confirmar si debe ser "ESTM" para evitar ambigüedad.
      siglasDocumento: 'EST',
      gradoBachiller: 'Bachiller en Estomatología',
      tituloProfesional: 'Cirujano Dentista',
      departamentoDefectoNombre: 'Estomatología',
    },
    {
      nombre: 'Tecnología Médica',
      siglasDocumento: 'TM',
      gradoBachiller: 'Bachiller en Tecnología Médica',
      tituloProfesional: 'Tecnólogo Médico con mención en Terapia Física y Rehabilitación',
      departamentoDefectoNombre: 'Medicina Humana',
    },
    {
      nombre: 'Psicología',
      siglasDocumento: 'PSI',
      gradoBachiller: 'Bachiller en Psicología',
      tituloProfesional: 'Psicólogo',
      departamentoDefectoNombre: 'Psicología',
    },
  ];

  for (const esc of escuelasData) {
    const departamentoDefectoId = departamentosMap.get(esc.departamentoDefectoNombre);
    if (!departamentoDefectoId) {
      throw new Error(`Departamento por defecto no encontrado: ${esc.departamentoDefectoNombre}`);
    }

    await prisma.escuelaProfesional.upsert({
      where: { nombre: esc.nombre },
      update: {
        siglasDocumento: esc.siglasDocumento,
        gradoBachiller: esc.gradoBachiller,
        tituloProfesional: esc.tituloProfesional,
        departamentoDefectoId,
        activa: true,
      },
      create: {
        nombre: esc.nombre,
        siglasDocumento: esc.siglasDocumento,
        gradoBachiller: esc.gradoBachiller,
        tituloProfesional: esc.tituloProfesional,
        departamentoDefectoId,
        activa: true,
      },
    });
  }

  // 4. Usuarios Iniciales (4)
  // TODO: cambiar en producción
  const passwordPlano = 'UacFcsa2026!';
  const passwordHash = await bcrypt.hash(passwordPlano, 10);

  const usuariosData = [
    {
      nombresCompletos: 'ARNOLD ALFARO TORRES',
      gradoTitulo: 'Ing.',
      correo: 'admin.fcsa@uandina.edu.pe',
      iniciales: 'AAT',
      rol: RolUsuario.ADMIN,
      esDecanoFirmante: false,
    },
    {
      nombresCompletos: 'JESÚS ALEJANDRO ARENAS FERNÁNDEZ DÁVILA',
      gradoTitulo: 'Dr.',
      correo: 'jarenas@uandina.edu.pe',
      iniciales: 'JAAFD',
      rol: RolUsuario.DECANO,
      esDecanoFirmante: true,
    },
    {
      nombresCompletos: 'AIDA VALER CONTRERAS',
      gradoTitulo: 'Mg.',
      correo: 'avaler@uandina.edu.pe',
      iniciales: 'AVC',
      rol: RolUsuario.SECRETARIA_ACADEMICA,
      esDecanoFirmante: false,
    },
    {
      nombresCompletos: 'ALEXANDER JOSÉ CHUCHULLO ROJAS',
      gradoTitulo: 'Sr.',
      correo: 'achuchullo@uandina.edu.pe',
      iniciales: 'AJCR',
      rol: RolUsuario.ADMINISTRATIVO,
      esDecanoFirmante: false,
    },
  ];

  for (const usr of usuariosData) {
    await prisma.usuario.upsert({
      where: { correo: usr.correo },
      update: {
        nombresCompletos: usr.nombresCompletos,
        gradoTitulo: usr.gradoTitulo,
        passwordHash,
        iniciales: usr.iniciales,
        rol: usr.rol,
        estado: EstadoUsuario.ACTIVO,
        esDecanoFirmante: usr.esDecanoFirmante,
      },
      create: {
        nombresCompletos: usr.nombresCompletos,
        gradoTitulo: usr.gradoTitulo,
        correo: usr.correo,
        passwordHash,
        iniciales: usr.iniciales,
        rol: usr.rol,
        estado: EstadoUsuario.ACTIVO,
        esDecanoFirmante: usr.esDecanoFirmante,
      },
    });
  }

  // 5. Catálogo de Causas (snapshots en resoluciones emitidas se guardan en datosEspecificos)
  const causasData: Array<{
    ambito: AmbitoCausa;
    descripcion: string;
    requiereDetalleManual: boolean;
  }> = [
    // Ámbito CAMBIO_ASESOR
    { ambito: AmbitoCausa.CAMBIO_ASESOR, descripcion: 'Renuncia del asesor', requiereDetalleManual: false },
    { ambito: AmbitoCausa.CAMBIO_ASESOR, descripcion: 'Cambio de línea de investigación', requiereDetalleManual: false },
    { ambito: AmbitoCausa.CAMBIO_ASESOR, descripcion: 'Incompatibilidad académica', requiereDetalleManual: false },

    // Ámbito CAMBIO_DICTAMINANTE
    { ambito: AmbitoCausa.CAMBIO_DICTAMINANTE, descripcion: 'Renuncia del dictaminante', requiereDetalleManual: false },
    { ambito: AmbitoCausa.CAMBIO_DICTAMINANTE, descripcion: 'Incompatibilidad académica', requiereDetalleManual: false },
    { ambito: AmbitoCausa.CAMBIO_DICTAMINANTE, descripcion: 'Licencia del dictaminante', requiereDetalleManual: false },

    // Ámbito DSE
    { ambito: AmbitoCausa.DSE, descripcion: 'Error material en resolución', requiereDetalleManual: true },
    { ambito: AmbitoCausa.DSE, descripcion: 'Reinicio de trámite por abandono', requiereDetalleManual: false },
    { ambito: AmbitoCausa.DSE, descripcion: 'Reinicio por error de fondo', requiereDetalleManual: true },

    // Ámbito DOCUMENTO_EXTERNO
    { ambito: AmbitoCausa.DOCUMENTO_EXTERNO, descripcion: 'Oficio externo', requiereDetalleManual: false },
    { ambito: AmbitoCausa.DOCUMENTO_EXTERNO, descripcion: 'Carta notarial', requiereDetalleManual: false },
    { ambito: AmbitoCausa.DOCUMENTO_EXTERNO, descripcion: 'Solicitud de estudiante', requiereDetalleManual: false },
    { ambito: AmbitoCausa.DOCUMENTO_EXTERNO, descripcion: 'Otro', requiereDetalleManual: true },
  ];

  for (const causa of causasData) {
    await prisma.catalogoCausa.upsert({
      where: {
        ambito_descripcion: {
          ambito: causa.ambito,
          descripcion: causa.descripcion,
        },
      },
      update: {
        requiereDetalleManual: causa.requiereDetalleManual,
        activo: true,
      },
      create: {
        ambito: causa.ambito,
        descripcion: causa.descripcion,
        requiereDetalleManual: causa.requiereDetalleManual,
        activo: true,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed SGRT v4.0:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });