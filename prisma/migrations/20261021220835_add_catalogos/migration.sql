-- CreateEnum
CREATE TYPE "EstadoDocente" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateTable
CREATE TABLE "departamentos_academicos" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(180) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "departamentos_academicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escuelas_profesionales" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(180) NOT NULL,
    "grado_bachiller" VARCHAR(200) NOT NULL,
    "titulo_profesional" VARCHAR(220) NOT NULL,
    "departamento_defecto_id" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "escuelas_profesionales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docentes" (
    "id" UUID NOT NULL,
    "grado_academico" VARCHAR(30) NOT NULL,
    "nombres_completos" VARCHAR(200) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "departamento_academico_id" INTEGER NOT NULL,
    "escuela_profesional_id" INTEGER NOT NULL,
    "estado" "EstadoDocente" NOT NULL DEFAULT 'ACTIVO',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "docentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_academicos_nombre_key" ON "departamentos_academicos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "escuelas_profesionales_nombre_key" ON "escuelas_profesionales"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "docentes_correo_key" ON "docentes"("correo");

-- AddForeignKey
ALTER TABLE "escuelas_profesionales" ADD CONSTRAINT "escuelas_profesionales_departamento_defecto_id_fkey" FOREIGN KEY ("departamento_defecto_id") REFERENCES "departamentos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docentes" ADD CONSTRAINT "docentes_departamento_academico_id_fkey" FOREIGN KEY ("departamento_academico_id") REFERENCES "departamentos_academicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "docentes" ADD CONSTRAINT "docentes_escuela_profesional_id_fkey" FOREIGN KEY ("escuela_profesional_id") REFERENCES "escuelas_profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
