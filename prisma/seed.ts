import { PrismaClient, RolUsuario, EstadoUsuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordInicial = await bcrypt.hash('UacFcsa2026!', 10);

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

  await prisma.usuario.updateMany({
    where: { correo: { not: 'jarenas@uandina.edu.pe' } },
    data: { esDecanoFirmante: false },
  });

  const decano = await prisma.usuario.upsert({
    where: { correo: 'jarenas@uandina.edu.pe' },
    update: {
      nombresCompletos: 'JESUS ALEJANDRO ARENAS FERNANDEZ DAVILA',
      gradoTitulo: 'Dr.',
      iniciales: 'JAAFD',
      rol: RolUsuario.DECANO,
      estado: EstadoUsuario.ACTIVO,
      esDecanoFirmante: true,
    },
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

  const secretaria = await prisma.usuario.upsert({
    where: { correo: 'avaler@uandina.edu.pe' },
    update: {
      nombresCompletos: 'AIDA VALER CONTRERAS',
      gradoTitulo: 'Lic.',
      iniciales: 'AVC',
      rol: RolUsuario.SECRETARIA_ACADEMICA,
      estado: EstadoUsuario.ACTIVO,
      esDecanoFirmante: false,
    },
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

  const administrativo = await prisma.usuario.upsert({
    where: { correo: 'achuchullo@uandina.edu.pe' },
    update: {
      nombresCompletos: 'ALEXANDER JOSE CHUCHULLO ROJAS',
      gradoTitulo: 'Ing.',
      iniciales: 'AJCR',
      rol: RolUsuario.ADMINISTRATIVO,
      estado: EstadoUsuario.ACTIVO,
      esDecanoFirmante: false,
    },
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

  console.log('Seed FCSa-UAC completado:', {
    decano: `${decano.nombresCompletos} (${decano.iniciales})`,
    secretaria: `${secretaria.nombresCompletos} (${secretaria.iniciales})`,
    administrativo: `${administrativo.nombresCompletos} (${administrativo.iniciales})`,
  });
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });