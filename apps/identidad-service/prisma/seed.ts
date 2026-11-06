// Ruta: apps/identidad-service/prisma/seed.ts
import { PrismaClient, RolUsuario, EstadoUsuario } from '../src/generated/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
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
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed de identidad-service:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });