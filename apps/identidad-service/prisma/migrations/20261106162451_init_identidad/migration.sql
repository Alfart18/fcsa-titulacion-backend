-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'DESACTIVADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombresCompletos" VARCHAR(180) NOT NULL,
    "gradoTitulo" VARCHAR(50) NOT NULL DEFAULT 'Dr.',
    "correo" VARCHAR(150) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "iniciales" VARCHAR(10) NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "esDecanoFirmante" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_institucional" (
    "id" SERIAL NOT NULL,
    "facultad" VARCHAR(200) NOT NULL DEFAULT 'Facultad de Ciencias de la Salud',
    "universidad" VARCHAR(200) NOT NULL DEFAULT 'Universidad Andina del Cusco',
    "ciudad" VARCHAR(100) NOT NULL DEFAULT 'Cusco',
    "siglasFacultad" VARCHAR(20) NOT NULL DEFAULT 'FCSa',
    "siglasUniversidad" VARCHAR(20) NOT NULL DEFAULT 'UAC',
    "reglamentoMarco" VARCHAR(150) NOT NULL DEFAULT 'Resolución N.º 513-CU-2024-UAC',
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_institucional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuarioId" UUID NOT NULL,
    "inicialesUsuario" VARCHAR(10) NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "entidad" VARCHAR(60) NOT NULL,
    "entidadId" VARCHAR(80),
    "expedienteId" UUID,
    "resolucionId" UUID,
    "detalle" JSONB NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE INDEX "registro_auditoria_usuarioId_fechaHora_idx" ON "registro_auditoria"("usuarioId", "fechaHora");

-- CreateIndex
CREATE INDEX "registro_auditoria_accion_idx" ON "registro_auditoria"("accion");

-- AddForeignKey
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
