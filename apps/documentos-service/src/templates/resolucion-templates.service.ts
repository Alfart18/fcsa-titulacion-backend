// Ruta: apps/documentos-service/src/templates/resolucion-templates.service.ts
import { Injectable } from '@nestjs/common';
import {
  CambioDictaminanteData,
  CommonTemplateData,
  DseData,
  ModalidadTramiteDse,
  MotivoAnulacion,
  ResolucionAnuladaDto,
  ResolucionTipoCambio,
  SeccionesJuridicasResult,
  SerieNumeracion,
  TesistaSnapshot,
  TipoResolucion,
  VarianteSegundoTipoA,
} from './interfaces/template.interface';
import { buildAsesorTemplate } from './strategies/asesor.template';
import { buildDictamenTemplate } from './strategies/dictamen.template';
import { buildInscripcionTemplate } from './strategies/inscripcion.template';
import { buildTercerDictamenTemplate } from './strategies/tercer-dictamen.template';
import { buildAptoTemplate } from './strategies/apto.template';
import { buildFechaHoraTemplate } from './strategies/fecha-hora.template';
import { buildTituloTemplate } from './strategies/titulo.template';
import { buildCoasesorTemplate } from './strategies/coasesor.template';
import { buildCambioAsesorTemplate } from './strategies/cambio-asesor.template';
import { buildCambioTituloTemplate } from './strategies/cambio-titulo.template';
import { buildCambioDictaminanteTemplate } from './strategies/cambio-dictaminante.template';
import { buildDseTemplate } from './strategies/dse.template';
import { buildDesistimientoTemplate } from './strategies/desistimiento.template';

export { SerieNumeracion, TipoResolucion };
export type { TesistaSnapshot, SeccionesJuridicasResult };

@Injectable()
export class ResolucionTemplatesService {
  formatearFechaLargaCastellano(fechaInput: Date | string): string {
    if (!fechaInput) return '';
    const fecha =
      fechaInput instanceof Date ? fechaInput : new Date(fechaInput);
    if (Number.isNaN(fecha.getTime())) {
      return String(fechaInput);
    }
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const dia = String(fecha.getUTCDate()).padStart(2, '0');
    const mes = meses[fecha.getUTCMonth()];
    const anio = fecha.getUTCFullYear();
    return `${dia} de ${mes} de ${anio}`;
  }

  formatearListaTesistas(
    tesistas: TesistaSnapshot[],
    _gradoBachiller?: string,
  ): {
    esPlural: boolean;
    articuloBachiller: string;
    listaFormateada: string;
  } {
    const esPlural = tesistas.length > 1;
    const articuloBachiller = esPlural
      ? 'los(las) señores(itas)'
      : 'el/la señor(ita)';

    const listaFormateada = tesistas
      .map((t) => `**${String(t.nombresApellidos || '').toUpperCase()}**`)
      .join(' y ');

    return { esPlural, articuloBachiller, listaFormateada };
  }

  sanitizarTextoWinAnsi(texto: string): string {
    if (!texto) return '';
    return texto
      .replace(/[“”«»]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      // Solo normalizamos los espacios y saltos de línea, SIN borrar letras
      .replace(/\s+/g, ' ') 
      .trim();
  }

  construirSeccionesJuridicas(
    tipo: TipoResolucion,
    datos: Record<string, any> = {},
    codigoExpediente: string = 'EXP-S/N',
  ): SeccionesJuridicasResult {
    const escuela = String(
      datos.escuelaProfesionalSnapshot ||
        datos.escuelaProfesional ||
        'Escuela Profesional',
    ).toUpperCase();

    const gradoBachiller = String(
      datos.gradoBachillerSnapshot || 'Bachiller',
    );

    const tituloProfesional = String(
      datos.tituloProfesionalSnapshot ||
        datos.tituloProfesional ||
        'Título Profesional',
    ).toUpperCase();

    const reglamentoMarco = String(
      datos.reglamentoMarcoSnapshot || 'Resolución N.º 513-CU-2024-UAC',
    );

    const departamentoAcademico = String(
      datos.departamentoAcademico ||
        datos.departamentoDictaminantesSnapshot ||
        datos.asesorDepartamentoSnapshot ||
        escuela,
    );

    const tesistas: TesistaSnapshot[] = Array.isArray(datos.tesistasSnapshot)
      ? datos.tesistasSnapshot
      : [];

    const { esPlural, articuloBachiller, listaFormateada } =
      this.formatearListaTesistas(tesistas, gradoBachiller);

    const listaNombresPlanos = tesistas
      .map((t) => String(t.nombresApellidos || '').toUpperCase())
      .filter(Boolean)
      .join(' Y ');

    const commonData: CommonTemplateData = {
      codigoExpediente,
      escuela,
      gradoBachiller,
      tituloProfesional,
      reglamentoMarco,
      departamentoAcademico,
      tesistas,
      esPlural,
      articuloBachiller,
      articuloBachillerGrado: esPlural
        ? 'los(las) bachilleres'
        : 'el/la bachiller',
      listaFormateada,
      listaNombresPlanos,
      raw: datos,
      formatearFechaLargaCastellano: (f) =>
        this.formatearFechaLargaCastellano(f),
    };

    switch (tipo) {
      case TipoResolucion.ASESOR:
        return buildAsesorTemplate(commonData);

      case TipoResolucion.DICTAMEN:
        return buildDictamenTemplate(commonData);

      case TipoResolucion.INSCRIPCION:
        return buildInscripcionTemplate(commonData);

      case TipoResolucion.TERCER_DICT:
        return buildTercerDictamenTemplate(commonData);

      case TipoResolucion.APTO:
        return buildAptoTemplate(commonData);

      case TipoResolucion.FECHA_HORA:
        return buildFechaHoraTemplate(commonData);

      case TipoResolucion.TITULO:
        return buildTituloTemplate(commonData);

      case TipoResolucion.COASESOR:
        return buildCoasesorTemplate(commonData);

      case TipoResolucion.CAMBIO_ASESOR:
        return buildCambioAsesorTemplate(commonData);

      case TipoResolucion.CAMBIO_TITULO:
        return buildCambioTituloTemplate(commonData);

      case TipoResolucion.CAMBIO_DICTAMINANTE:
        return buildCambioDictaminanteTemplate(
          this.mapearDatosCambioDictaminante(commonData, datos),
        );

      case TipoResolucion.DSE:
        return buildDseTemplate(this.mapearDatosDse(commonData, datos));

      case TipoResolucion.DESISTIMIENTO:
        return buildDesistimientoTemplate(commonData);

      default:
        return {
          visto: `El expediente ${codigoExpediente} presentado para revisión y trámite correspondiente.`,
          considerando: [
            `Que, de conformidad con el Reglamento Marco de Grados y Títulos de la Universidad Andina del Cusco (${reglamentoMarco}), corresponde emitir el acto resolutivo pertinente.`,
          ],
          articulosResolutivos: [
            {
              titulo: 'PRIMERO.-',
              texto: `**DISPONER** lo que corresponda según el trámite regular de la Escuela Profesional de **${escuela}**.`,
            },
          ],
        };
    }
  }

  private mapearDatosDse(
    common: CommonTemplateData,
    datos: Record<string, any>,
  ): DseData {
    const rawLista = Array.isArray(datos.resolucionesAnular)
      ? datos.resolucionesAnular
      : Array.isArray(datos.resolucionesAAnular)
        ? datos.resolucionesAAnular
        : Array.isArray(datos.resolucionesAfectadasSnapshot)
          ? datos.resolucionesAfectadasSnapshot
          : [];

    const resolucionesAnular: ResolucionAnuladaDto[] = rawLista.map(
      (item: Record<string, any>) => {
        const partesNum = String(item.numeroCompleto || '').split('-');
        return {
          num: String(item.num || item.numero || partesNum[0] || '').trim(),
          anio: String(
            item.anio || partesNum[1] || new Date().getUTCFullYear(),
          ).trim(),
          fechaLiteral: String(
            item.fechaLiteral ||
              item.fechaEmisionTexto ||
              (item.fechaEmision
                ? this.formatearFechaLargaCastellano(item.fechaEmision)
                : ''),
          ),
          fecha: String(item.fecha || item.fechaLiteral || item.fechaEmisionTexto || ''),
          tipoActo: item.tipoActo || item.tipo,
          accionResumida: item.accionResumida,
          detalleExtremoResuelve: item.detalleExtremoResuelve,
          docenteAsignado: item.docenteAsignado,
          docentesDictaminantes: item.docentesDictaminantes,
          tituloProyecto: item.tituloProyecto,
        };
      },
    );

    return {
      ...common,
      modalidad: datos.modalidad as ModalidadTramiteDse | undefined,
      esErrorOficio: Boolean(datos.esErrorOficio || datos.unidadRemitenteError),
      numeroTicket: datos.numeroTicket ? String(datos.numeroTicket) : undefined,
      fechaCorreoSolicitud: datos.fechaCorreoSolicitud
        ? this.formatearFechaLargaCastellano(datos.fechaCorreoSolicitud)
        : '',
      tratamientoInteresado:
        datos.tratamientoInteresado || common.articuloBachiller,
      nombresInteresados:
        datos.nombresInteresados ||
        (Array.isArray(datos.interesados)
          ? datos.interesados.join(' Y ')
          : common.listaNombresPlanos),
      nombreCompleto:
        datos.nombreCompleto ||
        datos.nombresInteresados ||
        common.listaNombresPlanos,
      escuelaProfesional: datos.escuelaProfesional || common.escuela,
      unidadRemitenteError: datos.unidadRemitenteError,
      oficioRemitenteError: datos.oficioRemitenteError,
      motivoAnulacion:
        (datos.motivoAnulacion as MotivoAnulacion) ||
        MotivoAnulacion.REINICIAR_TRAMITE,
      listaConceptosAnulados:
        datos.listaConceptosAnulados || datos.causaTextoConsolidadoSnapshot || '',
      resolucionesAnular,
      complementoVisto: datos.complementoVisto,
      complementoErrorAdministrativo: datos.complementoErrorAdministrativo,
      complementoCeseDocenteAsesor: datos.complementoCeseDocenteAsesor,
      complementoErrorDigitacionTitulo: datos.complementoErrorDigitacionTitulo,
      complementoResuelvePrimero: datos.complementoResuelvePrimero,
      disposicionComplementaria: datos.disposicionComplementaria,
    };
  }

  private mapearDatosCambioDictaminante(
    common: CommonTemplateData,
    datos: Record<string, any>,
  ): CambioDictaminanteData {
    const partesAnt = String(
      datos.resolucionAntecedenteNumeroSnapshot || '',
    ).split('-');

    const numeroResAnterior = String(
      datos.numeroResAnterior ||
        datos.resolucionesAnteriores?.[0]?.numero ||
        datos.resolucionesAnteriores?.[0]?.numeroResAnterior ||
        partesAnt[0] ||
        '',
    ).trim();

    const anioResAnterior = String(
      datos.anioResAnterior ||
        datos.resolucionesAnteriores?.[0]?.anio ||
        datos.resolucionesAnteriores?.[0]?.anioResAnterior ||
        partesAnt[1] ||
        new Date().getUTCFullYear(),
    ).trim();

    const fechaResAnteriorLiteral = String(
      datos.fechaResAnteriorLiteral ||
        datos.resolucionesAnteriores?.[0]?.fechaLiteral ||
        datos.resolucionesAnteriores?.[0]?.fechaResAnteriorLiteral ||
        (datos.fechaResolucionAntecedente
          ? this.formatearFechaLargaCastellano(datos.fechaResolucionAntecedente)
          : ''),
    );

    const saliente = String(
      datos.docenteSaliente ||
        datos.dictaminanteSalienteSnapshot ||
        datos.reemplazos?.[0]?.salienteGradoYNombre ||
        datos.reemplazos?.[0]?.saliente ||
        '',
    ).toUpperCase();

    const entrante = String(
      datos.docenteEntrante ||
        datos.dictaminanteEntranteSnapshot ||
        datos.reemplazos?.[0]?.entranteGradoYNombre ||
        datos.reemplazos?.[0]?.entrante ||
        '',
    ).toUpperCase();

    const motivoLiteral = String(
      datos.motivoLiteral ||
        datos.causaTextoConsolidadoSnapshot ||
        datos.reemplazos?.[0]?.motivoTexto ||
        'por cese de vínculo laboral',
    );

    return {
      ...common,
      tipoCambio:
        (datos.tipoCambio as ResolucionTipoCambio) ||
        (datos.tipo as ResolucionTipoCambio) ||
        ResolucionTipoCambio.TIPO_A,
      tratamiento:
        datos.estudianteTratamiento ||
        datos.tratamiento ||
        common.articuloBachiller,
      estudianteNombres:
        datos.estudianteNombres ||
        (Array.isArray(datos.estudiantesNombres)
          ? datos.estudiantesNombres.join(' Y ')
          : common.listaNombresPlanos),
      tesisTitulo: String(
        datos.tesisTitulo ||
          datos.tituloVigenteSnapshot ||
          datos.tituloProyecto ||
          '',
      ),
      numeroResAnterior,
      anioResAnterior,
      fechaResAnteriorLiteral,
      resolucionesAnteriores: Array.isArray(datos.resolucionesAnteriores)
        ? datos.resolucionesAnteriores.map((r: Record<string, any>) => ({
            numeroResAnterior: String(r.numeroResAnterior || r.numero || ''),
            anioResAnterior: String(r.anioResAnterior || r.anio || ''),
            fechaResAnteriorLiteral: String(
              r.fechaResAnteriorLiteral || r.fechaLiteral || '',
            ),
          }))
        : undefined,
      docentesOriginales: String(
        datos.docentesOriginales ||
          datos.docentesOriginalesTexto ||
          saliente,
      ).toUpperCase(),
      docenteSaliente: saliente,
      docenteEntrante: entrante,
      motivoLiteral,
      reemplazos: Array.isArray(datos.reemplazos)
        ? datos.reemplazos.map((r: Record<string, any>) => ({
            saliente: String(
              r.saliente || r.salienteGradoYNombre || '',
            ).toUpperCase(),
            entrante: String(
              r.entrante || r.entranteGradoYNombre || '',
            ).toUpperCase(),
            motivoTexto: r.motivoTexto,
          }))
        : undefined,
      varianteSegundoTipoA:
        datos.varianteSegundoTipoA === 'PRECISAR_DICTAMINANTES' ||
        datos.varianteSegundoTipoA === VarianteSegundoTipoA.PRECISAR
          ? VarianteSegundoTipoA.PRECISAR
          : VarianteSegundoTipoA.ACLARAR,
      docenteQuePermanece: datos.docenteQuePermanece
        ? String(datos.docenteQuePermanece).toUpperCase()
        : '',
      docenteNuevo: datos.docenteNuevo
        ? String(datos.docenteNuevo).toUpperCase()
        : entrante,
      tercerDictaminanteDesignado: datos.tercerDictaminanteDesignado
        ? String(datos.tercerDictaminanteDesignado).toUpperCase()
        : entrante,
      docenteTerceroSaliente: datos.docenteTerceroSaliente
        ? String(datos.docenteTerceroSaliente).toUpperCase()
        : saliente,
      docenteTerceroEntrante: datos.docenteTerceroEntrante
        ? String(datos.docenteTerceroEntrante).toUpperCase()
        : entrante,
      docentesRatificados: Array.isArray(datos.docentesRatificados)
        ? datos.docentesRatificados.map((d: unknown) =>
            String(d || '').toUpperCase(),
          )
        : [],
      concordancia: datos.concordancia,
    };
  }
}