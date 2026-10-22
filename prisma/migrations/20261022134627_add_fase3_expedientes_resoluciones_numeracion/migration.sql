-- CreateEnum
CREATE TYPE "AmbitoCausa" AS ENUM ('CAMBIO_ASESOR', 'CAMBIO_DICTAMINANTE', 'DSE', 'DOCUMENTO_EXTERNO');

-- CreateEnum
CREATE TYPE "EstadoExpediente" AS ENUM ('ACTIVO', 'TITULADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoTesista" AS ENUM ('ACTIVO', 'APTO', 'DESISTIDO', 'TITULADO');

-- CreateEnum
CREATE TYPE "SerieNumeracion" AS ENUM ('ORD', 'CF');

-- CreateEnum
CREATE TYPE "CategoriaNumeracion" AS ENUM ('TITULACION', 'ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "SituacionJuridicaRes" AS ENUM ('VIGENTE', 'MODIFICADA', 'SIN_EFECTO');

-- CreateEnum
CREATE TYPE "EstadoDocumentalRes" AS ENUM ('EMITIDO', 'FIRMADO');

-- CreateEnum
CREATE TYPE "OrigenResolucion" AS ENUM ('SISTEMA', 'HISTORICO');

-- CreateEnum
CREATE TYPE "ModalidadSustentacion" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "TipoResolucion" AS ENUM ('ASESOR', 'DICTAMEN', 'INSCRIPCION', 'TERCER_DICT', 'APTO', 'FECHA_HORA', 'TITULO', 'CAMBIO_ASESOR', 'CAMBIO_TITULO', 'CAMBIO_DICTAMINANTE', 'DSE', 'DESISTIMIENTO');

-- AlterTable
ALTER TABLE "registro_auditoria" ADD COLUMN     "expediente_id" UUID,
ADD COLUMN     "resolucion_id" UUID;

-- CreateTable
CREATE TABLE "catalogo_causas" (
    "id" SERIAL NOT NULL,
    "ambito" "AmbitoCausa" NOT NULL,
    "descripcion" VARCHAR(160) NOT NULL,
    "requiere_detalle_manual" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogo_causas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contadores_expediente" (
    "anio" SMALLINT NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contadores_expediente_pkey" PRIMARY KEY ("anio")
);

-- CreateTable
CREATE TABLE "contadores_serie" (
    "anio" SMALLINT NOT NULL,
    "serie" "SerieNumeracion" NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contadores_serie_pkey" PRIMARY KEY ("anio","serie")
);

-- CreateTable
CREATE TABLE "contadores_libro_inscripcion" (
    "escuela_profesional_id" INTEGER NOT NULL,
    "anio" SMALLINT NOT NULL,
    "ultimo_asiento" INTEGER NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contadores_libro_inscripcion_pkey" PRIMARY KEY ("escuela_profesional_id","anio")
);

-- CreateTable
CREATE TABLE "expedientes" (
    "id" UUID NOT NULL,
    "codigo_expediente" VARCHAR(30) NOT NULL,
    "escuela_profesional_id" INTEGER NOT NULL,
    "estado" "EstadoExpediente" NOT NULL DEFAULT 'ACTIVO',
    "cantidad_tesistas" SMALLINT NOT NULL,
    "asesor_docente_id" UUID,
    "asesor_resolucion_id" UUID,
    "titulo_actual" TEXT,
    "titulo_resolucion_id" UUID,
    "departamento_dictaminantes_id" INTEGER,
    "dictaminante_1_id" UUID,
    "dictaminante_2_id" UUID,
    "dictaminante_3_id" UUID,
    "dictaminantes_resolucion_id" UUID,
    "inscripcion_resolucion_id" UUID,
    "libro_inscripcion_id" UUID,
    "fecha_hora_resolucion_id" UUID,
    "creado_por_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expedientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tesistas" (
    "id" UUID NOT NULL,
    "expediente_id" UUID NOT NULL,
    "orden" SMALLINT NOT NULL,
    "nombres_apellidos" VARCHAR(200) NOT NULL,
    "codigo_estudiante" VARCHAR(25) NOT NULL,
    "estado" "EstadoTesista" NOT NULL DEFAULT 'ACTIVO',
    "apto_resolucion_id" UUID,
    "titulo_resolucion_id" UUID,
    "fecha_sustentacion_real" DATE,
    "nota_sustentacion" SMALLINT,
    "resultado_sustentacion" VARCHAR(80),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tesistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resoluciones" (
    "id" UUID NOT NULL,
    "expediente_id" UUID NOT NULL,
    "tipo" "TipoResolucion" NOT NULL,
    "serie" "SerieNumeracion" NOT NULL,
    "numero_correlativo" INTEGER NOT NULL,
    "anio_numeracion" SMALLINT NOT NULL,
    "numero_completo" VARCHAR(50) NOT NULL,
    "tesista_id" UUID,
    "resolucion_antecedente_id" UUID,
    "situacion_juridica" "SituacionJuridicaRes" NOT NULL DEFAULT 'VIGENTE',
    "estado_documental" "EstadoDocumentalRes" NOT NULL DEFAULT 'EMITIDO',
    "origen" "OrigenResolucion" NOT NULL DEFAULT 'SISTEMA',
    "fecha_emision" DATE NOT NULL,
    "nombre_decano_snapshot" VARCHAR(180) NOT NULL,
    "iniciales_operador" VARCHAR(10) NOT NULL,
    "datos_especificos" JSONB NOT NULL,
    "id_tramite_control" VARCHAR(60) NOT NULL,
    "version_pdf" SMALLINT NOT NULL DEFAULT 1,
    "hash_version_generado" VARCHAR(64) NOT NULL,
    "pdf_generado_path" TEXT,
    "pdf_firmado_path" TEXT,
    "pdf_firmado_sha256" VARCHAR(64),
    "fecha_confirmacion_firma" TIMESTAMP(3),
    "usuario_emisor_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dse_afectadas" (
    "resolucion_dse_id" UUID NOT NULL,
    "resolucion_afectada_id" UUID NOT NULL,
    "estado_previo" "SituacionJuridicaRes" NOT NULL,

    CONSTRAINT "dse_afectadas_pkey" PRIMARY KEY ("resolucion_dse_id","resolucion_afectada_id")
);

-- CreateTable
CREATE TABLE "libro_numeracion" (
    "id" UUID NOT NULL,
    "numero_completo" VARCHAR(50) NOT NULL,
    "numero" INTEGER NOT NULL,
    "anio" SMALLINT NOT NULL,
    "serie" "SerieNumeracion" NOT NULL,
    "categoria" "CategoriaNumeracion" NOT NULL,
    "tipo_documento_externo" VARCHAR(80),
    "descripcion" TEXT NOT NULL,
    "fecha_documento" DATE NOT NULL,
    "registrado_por_id" UUID NOT NULL,
    "resolucion_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "libro_numeracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libro_inscripcion" (
    "id" UUID NOT NULL,
    "escuela_profesional_id" INTEGER NOT NULL,
    "numero_asiento" INTEGER NOT NULL,
    "anio" SMALLINT NOT NULL,
    "numero_folio_formateado" VARCHAR(40) NOT NULL,
    "expediente_id" UUID NOT NULL,
    "resolucion_inscripcion_id" UUID NOT NULL,
    "titulo_inscrito_snapshot" TEXT NOT NULL,
    "tesistas_snapshot" TEXT NOT NULL,
    "asesor_snapshot" VARCHAR(200) NOT NULL,
    "estado_asiento" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "fecha_asiento" DATE NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "libro_inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_causas_ambito_descripcion_key" ON "catalogo_causas"("ambito", "descripcion");

-- CreateIndex
CREATE UNIQUE INDEX "expedientes_codigo_expediente_key" ON "expedientes"("codigo_expediente");

-- CreateIndex
CREATE UNIQUE INDEX "tesistas_expediente_id_orden_key" ON "tesistas"("expediente_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "tesistas_expediente_id_codigo_estudiante_key" ON "tesistas"("expediente_id", "codigo_estudiante");

-- CreateIndex
CREATE UNIQUE INDEX "resoluciones_numero_completo_key" ON "resoluciones"("numero_completo");

-- CreateIndex
CREATE UNIQUE INDEX "resoluciones_id_tramite_control_key" ON "resoluciones"("id_tramite_control");

-- CreateIndex
CREATE UNIQUE INDEX "libro_numeracion_numero_completo_key" ON "libro_numeracion"("numero_completo");

-- CreateIndex
CREATE UNIQUE INDEX "libro_numeracion_resolucion_id_key" ON "libro_numeracion"("resolucion_id");

-- CreateIndex
CREATE UNIQUE INDEX "libro_numeracion_serie_anio_numero_key" ON "libro_numeracion"("serie", "anio", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "libro_inscripcion_numero_folio_formateado_key" ON "libro_inscripcion"("numero_folio_formateado");

-- CreateIndex
CREATE UNIQUE INDEX "libro_inscripcion_resolucion_inscripcion_id_key" ON "libro_inscripcion"("resolucion_inscripcion_id");

-- CreateIndex
CREATE UNIQUE INDEX "libro_inscripcion_escuela_profesional_id_anio_numero_asient_key" ON "libro_inscripcion"("escuela_profesional_id", "anio", "numero_asiento");

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_escuela_profesional_id_fkey" FOREIGN KEY ("escuela_profesional_id") REFERENCES "escuelas_profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tesistas" ADD CONSTRAINT "tesistas_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expedientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resoluciones" ADD CONSTRAINT "resoluciones_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expedientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resoluciones" ADD CONSTRAINT "resoluciones_tesista_id_fkey" FOREIGN KEY ("tesista_id") REFERENCES "tesistas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resoluciones" ADD CONSTRAINT "resoluciones_resolucion_antecedente_id_fkey" FOREIGN KEY ("resolucion_antecedente_id") REFERENCES "resoluciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resoluciones" ADD CONSTRAINT "resoluciones_usuario_emisor_id_fkey" FOREIGN KEY ("usuario_emisor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dse_afectadas" ADD CONSTRAINT "dse_afectadas_resolucion_dse_id_fkey" FOREIGN KEY ("resolucion_dse_id") REFERENCES "resoluciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dse_afectadas" ADD CONSTRAINT "dse_afectadas_resolucion_afectada_id_fkey" FOREIGN KEY ("resolucion_afectada_id") REFERENCES "resoluciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libro_numeracion" ADD CONSTRAINT "libro_numeracion_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libro_numeracion" ADD CONSTRAINT "libro_numeracion_resolucion_id_fkey" FOREIGN KEY ("resolucion_id") REFERENCES "resoluciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libro_inscripcion" ADD CONSTRAINT "libro_inscripcion_escuela_profesional_id_fkey" FOREIGN KEY ("escuela_profesional_id") REFERENCES "escuelas_profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libro_inscripcion" ADD CONSTRAINT "libro_inscripcion_expediente_id_fkey" FOREIGN KEY ("expediente_id") REFERENCES "expedientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libro_inscripcion" ADD CONSTRAINT "libro_inscripcion_resolucion_inscripcion_id_fkey" FOREIGN KEY ("resolucion_inscripcion_id") REFERENCES "resoluciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
