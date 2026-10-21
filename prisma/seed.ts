import { PrismaClient, RolUsuario, EstadoUsuario, EstadoDocente } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordInicial = await bcrypt.hash('UacFcsa2026!', 10);

  // 1. Configuración Institucional
  await prisma.configuracionInstitucional.upsert({
    where: { id: 1 },
    update: {},
    create: {
      facultad: 'Facultad de Ciencias de la Salud',
      universidad: 'Universidad Andina del Cusco',
      ciudad: 'Cusco',
      siglasFacultad: 'FCSa',
      siglasUniversidad: 'UAC',
    },
  });

  // 2. Usuarios Institucionales (Fase 1)
  await prisma.usuario.updateMany({
    where: { correo: { not: 'jarenas@uandina.edu.pe' } },
    data: { esDecanoFirmante: false },
  });

  await prisma.usuario.upsert({
    where: { correo: 'jarenas@uandina.edu.pe' },
    update: {},
    create: {
      nombresCompletos: 'JESUS ALEJANDRO ARENAS FERNANDEZ DAVILA',
      gradoTitulo: 'Dr.',
      correo: 'jarenas@uandina.edu.pe',
      passwordHash: passwordInicial,
      iniciales: 'JAAFD',
      rol: RolUsuario.DECANO,
      estado: EstadoUsuario.ACTIVO,
      esDecanoFirmante: true,
    },
  });

  await prisma.usuario.upsert({
    where: { correo: 'avaler@uandina.edu.pe' },
    update: {},
    create: {
      nombresCompletos: 'AIDA VALER CONTRERAS',
      gradoTitulo: 'Lic.',
      correo: 'avaler@uandina.edu.pe',
      passwordHash: passwordInicial,
      iniciales: 'AVC',
      rol: RolUsuario.SECRETARIA_ACADEMICA,
      estado: EstadoUsuario.ACTIVO,
      esDecanoFirmante: false,
    },
  });

  await prisma.usuario.upsert({
    where: { correo: 'achuchullo@uandina.edu.pe' },
    update: {},
    create: {
      nombresCompletos: 'ALEXANDER JOSE CHUCHULLO ROJAS',
      gradoTitulo: 'Ing.',
      correo: 'achuchullo@uandina.edu.pe',
      passwordHash: passwordInicial,
      iniciales: 'AJCR',
      rol: RolUsuario.ADMINISTRATIVO,
      estado: EstadoUsuario.ACTIVO,
      esDecanoFirmante: false,
    },
  });

  // 3. Los 4 Departamentos Académicos Oficiales de la FCSa
  const deptoMedicina = await prisma.departamentoAcademico.upsert({
    where: { nombre: 'Departamento Académico de Medicina Humana' },
    update: {},
    create: { nombre: 'Departamento Académico de Medicina Humana' },
  });

  const deptoObsEnf = await prisma.departamentoAcademico.upsert({
    where: { nombre: 'Departamento Académico de Obstetricia y Enfermería' },
    update: {},
    create: { nombre: 'Departamento Académico de Obstetricia y Enfermería' },
  });

  const deptoEstomatologia = await prisma.departamentoAcademico.upsert({
    where: { nombre: 'Departamento Académico de Estomatología' },
    update: {},
    create: { nombre: 'Departamento Académico de Estomatología' },
  });

  const deptoPsicologia = await prisma.departamentoAcademico.upsert({
    where: { nombre: 'Departamento Académico de Psicología' },
    update: {},
    create: { nombre: 'Departamento Académico de Psicología' },
  });

  // 4. Las 6 Escuelas Profesionales
  const escMedicina = await prisma.escuelaProfesional.upsert({
    where: { nombre: 'Escuela Profesional de Medicina Humana' },
    update: {},
    create: {
      nombre: 'Escuela Profesional de Medicina Humana',
      gradoBachiller: 'Bachiller en Medicina Humana',
      tituloProfesional: 'Médico Cirujano',
      departamentoDefectoId: deptoMedicina.id,
    },
  });

  const escTecMedica = await prisma.escuelaProfesional.upsert({
    where: { nombre: 'Escuela Profesional de Tecnología Médica' },
    update: {},
    create: {
      nombre: 'Escuela Profesional de Tecnología Médica',
      gradoBachiller: 'Bachiller en Tecnología Médica',
      tituloProfesional: 'Tecnólogo Médico con mención en Terapia Física y Rehabilitación',
      departamentoDefectoId: deptoMedicina.id,
    },
  });

  const escObstetricia = await prisma.escuelaProfesional.upsert({
    where: { nombre: 'Escuela Profesional de Obstetricia' },
    update: {},
    create: {
      nombre: 'Escuela Profesional de Obstetricia',
      gradoBachiller: 'Bachiller en Obstetricia',
      tituloProfesional: 'Obstetra',
      departamentoDefectoId: deptoObsEnf.id,
    },
  });

  const escEnfermeria = await prisma.escuelaProfesional.upsert({
    where: { nombre: 'Escuela Profesional de Enfermería' },
    update: {},
    create: {
      nombre: 'Escuela Profesional de Enfermería',
      gradoBachiller: 'Bachiller en Enfermería',
      tituloProfesional: 'Licenciado en Enfermería',
      departamentoDefectoId: deptoObsEnf.id,
    },
  });

  const escEstomatologia = await prisma.escuelaProfesional.upsert({
    where: { nombre: 'Escuela Profesional de Estomatología' },
    update: {},
    create: {
      nombre: 'Escuela Profesional de Estomatología',
      gradoBachiller: 'Bachiller en Estomatología',
      tituloProfesional: 'Cirujano Dentista',
      departamentoDefectoId: deptoEstomatologia.id,
    },
  });

  const escPsicologia = await prisma.escuelaProfesional.upsert({
    where: { nombre: 'Escuela Profesional de Psicología' },
    update: {},
    create: {
      nombre: 'Escuela Profesional de Psicología',
      gradoBachiller: 'Bachiller en Psicología',
      tituloProfesional: 'Psicólogo',
      departamentoDefectoId: deptoPsicologia.id,
    },
  });

  // 5. Los 9 Docentes Reales de la FCSa
  const docentesSeed = [
    { gradoAcademico: 'Mg.', nombresCompletos: 'ÉRIKA SOFÍA PÉREZ VÉLEZ', correo: 'eperez@uandina.edu.pe', departamentoAcademicoId: deptoMedicina.id, escuelaProfesionalId: escMedicina.id },
    { gradoAcademico: 'Dra.', nombresCompletos: 'CRISTABEL NILDA RIVAS ACHAHUI', correo: 'crivas@uandina.edu.pe', departamentoAcademicoId: deptoMedicina.id, escuelaProfesionalId: escMedicina.id },
    { gradoAcademico: 'Dr.', nombresCompletos: 'RENÁN RAMÍREZ VARGAS', correo: 'rramirez@uandina.edu.pe', departamentoAcademicoId: deptoMedicina.id, escuelaProfesionalId: escMedicina.id },
    { gradoAcademico: 'Mtro.', nombresCompletos: 'WILFREDO MODESTO VILLAMONTE CALANCHE', correo: 'wvillamonte@uandina.edu.pe', departamentoAcademicoId: deptoMedicina.id, escuelaProfesionalId: escMedicina.id },
    { gradoAcademico: 'Mtra.', nombresCompletos: 'ÁNGELA LUZ CABALLERO NÚÑEZ', correo: 'acaballero@uandina.edu.pe', departamentoAcademicoId: deptoMedicina.id, escuelaProfesionalId: escTecMedica.id },
    { gradoAcademico: 'Mg.', nombresCompletos: 'PAMELA CONSUELO CARRILLO VELA', correo: 'pcarrillo@uandina.edu.pe', departamentoAcademicoId: deptoObsEnf.id, escuelaProfesionalId: escObstetricia.id },
    { gradoAcademico: 'Lic.', nombresCompletos: 'ÍNGRID SOCORRO RAMOS MOSTAJO', correo: 'iramos@uandina.edu.pe', departamentoAcademicoId: deptoObsEnf.id, escuelaProfesionalId: escEnfermeria.id },
    { gradoAcademico: 'Mtra.', nombresCompletos: 'VALERY KIMIYO GAMERO HUARCAYA', correo: 'vgamero@uandina.edu.pe', departamentoAcademicoId: deptoEstomatologia.id, escuelaProfesionalId: escEstomatologia.id },
    { gradoAcademico: 'Mg.', nombresCompletos: 'NÉLIDA MIRANDA HUAMANI', correo: 'nmirandah@uandina.edu.pe', departamentoAcademicoId: deptoPsicologia.id, escuelaProfesionalId: escPsicologia.id },
  ];

  for (const doc of docentesSeed) {
    await prisma.docente.upsert({
      where: { correo: doc.correo },
      update: {},
      create: { ...doc, estado: EstadoDocente.ACTIVO },
    });
  }

  console.log('Seed completo: Usuarios, Departamentos, Escuelas y Docentes insertados.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });