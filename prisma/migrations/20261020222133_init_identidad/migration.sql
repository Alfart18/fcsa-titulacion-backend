-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'DESACTIVADO');

-- CreateTable
CREATE TABLE "configuracion_institucional" (
    "id" SERIAL NOT NULL,
    "facultad" VARCHAR(200) NOT NULL DEFAULT 'Facultad de Ciencias de la Salud',
    "universidad" VARCHAR(200) NOT NULL DEFAULT 'Universidad Andina del Cusco',
    "ciudad" VARCHAR(100) NOT NULL DEFAULT 'Cusco',
    "siglas_facultad" VARCHAR(20) NOT NULL DEFAULT 'FCSa',
    "siglas_universidad" VARCHAR(20) NOT NULL DEFAULT 'UAC',
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_institucional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombres_completos" VARCHAR(180) NOT NULL,
    "grado_titulo" VARCHAR(50) NOT NULL DEFAULT 'Dr.',
    "correo" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "iniciales" VARCHAR(10) NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "es_decano_firmante" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "iniciales_usuario" VARCHAR(10) NOT NULL,
    "accion" VARCHAR(50) NOT NULL,
    "entidad" VARCHAR(60) NOT NULL,
    "entidad_id" VARCHAR(80),
    "detalle" JSONB NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- AddForeignKey
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
