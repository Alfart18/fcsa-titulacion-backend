// Ruta: src/plantillas/seed-plantillas.ts
import { SerieNumeracion, TipoResolucion } from '../generated/client';

export interface PlantillaSeedDef {
  tipo: TipoResolucion;
  nombre: string;
  seriePorDefecto: SerieNumeracion;
  asuntoPlantilla: string;
  variablesEsquema: string[];
  cuerpoHtml: string;
}

export const PLANTILLAS_OFICIALES_SEED: PlantillaSeedDef[] = [
  {
    tipo: TipoResolucion.ASESOR,
    nombre: 'Designación de Docente Asesor de Tesis',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Designar Docente Asesor de Tesis - {{tesistasTexto}} ({{escuelaSiglas}})',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'solicitudReferencia',
      'tesistasTexto',
      'escuelaNombre',
      'escuelaSiglas',
      'gradoBachiller',
      'tituloProfesional',
      'tituloTesis',
      'asesorNombreCompleto',
      'asesorDepartamento',
      'reglamentoMarco',
      'facultadNombre',
      'universidadNombre',
      'decanoFirmante',
      'inicialesOperador',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> ({{solicitudReferencia}}), presentado por <strong>{{tesistasTexto}}</strong>, de la Escuela Profesional de <strong>{{escuelaNombre}}</strong> de la {{facultadNombre}} de la {{universidadNombre}}, mediante el cual solicita la designación de Docente Asesor para el desarrollo del Proyecto de Tesis intitulado: <em>"{{tituloTesis}}"</em>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, de conformidad con la Ley Universitaria N.º 30220, el Estatuto de la {{universidadNombre}} y el Reglamento Marco de Grados y Títulos aprobado mediante <strong>{{reglamentoMarco}}</strong>, el graduando o tesista tiene derecho a contar con el asesoramiento de un docente especialista para la elaboración de su trabajo de investigación conducente a la obtención del Título Profesional de <strong>{{tituloProfesional}}</strong>.</p>
    <p>Que, habiéndose verificado el cumplimiento de los requisitos establecidos y contando con la carta de aceptación del docente propuesto adscrito al <strong>{{asesorDepartamento}}</strong>, corresponde emitir el acto resolutivo de designación.</p>
    <p>Estando a las atribuciones conferidas al Decanato de la {{facultadNombre}};</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- DESIGNAR</strong> a <strong>{{asesorNombreCompleto}}</strong>, docente adscrito al {{asesorDepartamento}}, como <strong>DOCENTE ASESOR</strong> del Proyecto de Tesis intitulado: <em>"{{tituloTesis}}"</em>, presentado por <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de {{escuelaNombre}}.</p>
    <p><strong>ARTÍCULO SEGUNDO.- ENCARGAR</strong> a la Dirección de la Escuela Profesional de {{escuelaNombre}} y a la Secretaría Académica de la {{facultadNombre}} el cumplimiento de la presente Resolución.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.DICTAMEN,
    nombre: 'Designación de Comisión Dictaminadora de Proyecto de Tesis',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Designar Docentes Dictaminantes de Proyecto de Tesis - {{tesistasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistasTexto',
      'escuelaNombre',
      'tituloTesis',
      'asesorNombreCompleto',
      'resolucionAsesorNumero',
      'dictaminante1Nombre',
      'dictaminante2Nombre',
      'departamentoDictaminantes',
      'reglamentoMarco',
      'facultadNombre',
      'universidadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> y el informe favorable del Docente Asesor <strong>{{asesorNombreCompleto}}</strong> (designado con Resolución N.º {{resolucionAsesorNumero}}), mediante el cual <strong>{{tesistasTexto}}</strong>, de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, solicita el nombramiento de Docentes Dictaminantes para la revisión del Proyecto de Tesis intitulado: <em>"{{tituloTesis}}"</em>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, conforme a lo dispuesto en el Reglamento Marco de Grados y Títulos (<strong>{{reglamentoMarco}}</strong>), concluida la formulación del Proyecto de Tesis con el aval del Docente Asesor, el Decanato designa a dos (02) docentes dictaminantes para evaluar la viabilidad metodológica y científica del proyecto.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- DESIGNAR</strong> como <strong>DOCENTES DICTAMINANTES</strong> del Proyecto de Tesis intitulado: <em>"{{tituloTesis}}"</em>, presentado por <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de {{escuelaNombre}}, a los siguientes docentes adscritos al {{departamentoDictaminantes}}:</p>
    <ul>
      <li><strong>{{dictaminante1Nombre}}</strong> (Primer Dictaminante)</li>
      <li><strong>{{dictaminante2Nombre}}</strong> (Segundo Dictaminante)</li>
    </ul>
    <p><strong>ARTÍCULO SEGUNDO.- OTORGAR</strong> el plazo reglamentario para que los docentes designados emitan el dictamen correspondiente ante el Decanato de la {{facultadNombre}}.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.INSCRIPCION,
    nombre: 'Aprobación e Inscripción de Tema de Tesis',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Aprobar e Inscribir Proyecto de Tesis en el Libro Oficial - {{tesistasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistasTexto',
      'escuelaNombre',
      'tituloTesis',
      'asesorNombreCompleto',
      'dictaminante1Nombre',
      'dictaminante2Nombre',
      'resolucionDictamenNumero',
      'folioInscripcion',
      'reglamentoMarco',
      'facultadNombre',
      'universidadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> y los dictámenes favorables emitidos por los docentes dictaminantes <strong>{{dictaminante1Nombre}}</strong> y <strong>{{dictaminante2Nombre}}</strong> (designados por Resolución N.º {{resolucionDictamenNumero}}), respecto al Proyecto de Tesis presentado por <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, en cumplimiento de lo establecido en el Reglamento Marco de Grados y Títulos (<strong>{{reglamentoMarco}}</strong>), habiendo obtenido dictamen de conformidad, corresponde aprobar el Proyecto de Tesis y disponer su inscripción en el Libro Oficial de Inscripción de Temas de Tesis de la Escuela Profesional de {{escuelaNombre}}, otorgándose los derechos de exclusividad sobre el tema por el plazo reglamentario.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- APROBAR E INSCRIBIR</strong> en el Libro de Inscripción de Temas de Tesis de la Escuela Profesional de <strong>{{escuelaNombre}}</strong> (Folio/Registro <strong>{{folioInscripcion}}</strong>), el Proyecto de Tesis intitulado: <em>"{{tituloTesis}}"</em>, presentado por <strong>{{tesistasTexto}}</strong>, contando con el asesoramiento de <strong>{{asesorNombreCompleto}}</strong>.</p>
    <p><strong>ARTÍCULO SEGUNDO.- AUTORIZAR</strong> la ejecución y desarrollo del trabajo de investigación conforme al cronograma aprobado.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.TERCER_DICT,
    nombre: 'Designación de Tercer Docente Dictaminante Dirimente',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Designar Tercer Docente Dictaminante Dirimente - {{tesistasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistasTexto',
      'escuelaNombre',
      'tituloTesis',
      'dictaminante3Nombre',
      'resolucionDictamenNumero',
      'reglamentoMarco',
      'facultadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> correspondiente a <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, y los informes discrepantes presentados por la comisión designada mediante Resolución N.º {{resolucionDictamenNumero}}; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, de acuerdo con el Reglamento Marco de Grados y Títulos (<strong>{{reglamentoMarco}}</strong>), ante la existencia de dictámenes discrepantes sobre la evaluación de la tesis intitulada <em>"{{tituloTesis}}"</em>, corresponde designar a un Tercer Docente Dictaminante con carácter dirimente.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO ÚNICO.- DESIGNAR</strong> a <strong>{{dictaminante3Nombre}}</strong> como <strong>TERCER DOCENTE DICTAMINANTE (DIRIMENTE)</strong> de la Tesis intitulada: <em>"{{tituloTesis}}"</em>, presentada por <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de {{escuelaNombre}}.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.APTO,
    nombre: 'Declaratoria de Apto para Sustentación de Tesis',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Declarar APTO para Sustentación Oral de Tesis - {{tesistaIndividualNombre}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistaIndividualNombre',
      'escuelaNombre',
      'gradoBachiller',
      'tituloProfesional',
      'tituloTesis',
      'resolucionInscripcionNumero',
      'porcentajeSimilitud',
      'reglamentoMarco',
      'facultadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> presentado por el(la) Bachiller <strong>{{tesistaIndividualNombre}}</strong>, de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, solicitando ser declarado(a) APTO(A) para la sustentación oral del trabajo de tesis intitulado: <em>"{{tituloTesis}}"</em> (inscrito mediante Resolución N.º {{resolucionInscripcionNumero}}); y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, habiéndose concluido el borrador final de tesis con dictámenes de suficiencia favorables, constancia de originalidad (porcentaje de similitud: <strong>{{porcentajeSimilitud}}</strong>) e informe de conformidad de expedito académico de acuerdo con el <strong>{{reglamentoMarco}}</strong>, resulta procedente declarar apto(a) al/a la solicitante.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO ÚNICO.- DECLARAR APTO(A)</strong> al(a la) <strong>{{gradoBachiller}} {{tesistaIndividualNombre}}</strong>, de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, para optar al Título Profesional de <strong>{{tituloProfesional}}</strong> mediante la sustentación oral de la Tesis intitulada: <em>"{{tituloTesis}}"</em>.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.FECHA_HORA,
    nombre: 'Designación de Jurado Evaluador y Fijación de Fecha y Hora de Sustentación',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Designar Jurado y Fijar Fecha y Hora de Sustentación - {{tesistasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistasTexto',
      'escuelaNombre',
      'tituloTesis',
      'presidenteJurado',
      'primerMiembroJurado',
      'segundoMiembroJurado',
      'asesorNombreCompleto',
      'fechaSustentacionProgramada',
      'horaSustentacionProgramada',
      'lugarSustentacion',
      'modalidadSustentacion',
      'reglamentoMarco',
      'facultadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> mediante el cual <strong>{{tesistasTexto}}</strong>, declarado(s) APTO(S) de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, solicita(n) fijación de fecha, hora y nombramiento de Jurado Examinador para la sustentación de la Tesis intitulada: <em>"{{tituloTesis}}"</em>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, en observancia del <strong>{{reglamentoMarco}}</strong>, corresponde al Decanato nombrar al Jurado Examinador y programar el acto público de sustentación de tesis.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- NOMBRAR</strong> al <strong>JURADO EXAMINADOR</strong> que recepcionará la sustentación oral de la Tesis intitulada: <em>"{{tituloTesis}}"</em>, presentada por <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de {{escuelaNombre}}, integrado por:</p>
    <ul>
      <li><strong>Presidente:</strong> {{presidenteJurado}}</li>
      <li><strong>Primer Miembro (Dictaminante):</strong> {{primerMiembroJurado}}</li>
      <li><strong>Segundo Miembro (Dictaminante):</strong> {{segundoMiembroJurado}}</li>
      <li><strong>Docente Asesor (con voz y sin voto):</strong> {{asesorNombreCompleto}}</li>
    </ul>
    <p><strong>ARTÍCULO SEGUNDO.- FIJAR</strong> como fecha y hora para el acto de sustentación el día <strong>{{fechaSustentacionProgramada}}</strong> a horas <strong>{{horaSustentacionProgramada}}</strong>, en la modalidad <strong>{{modalidadSustentacion}}</strong> ({{lugarSustentacion}}).</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.TITULO,
    nombre: 'Aprobación de Otorgamiento de Título Profesional (Consejo de Facultad)',
    seriePorDefecto: SerieNumeracion.CF,
    asuntoPlantilla:
      'Aprobar Otorgamiento de Título Profesional de {{tituloProfesional}} - {{tesistaIndividualNombre}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistaIndividualNombre',
      'escuelaNombre',
      'gradoBachiller',
      'tituloProfesional',
      'tituloTesis',
      'fechaSustentacionReal',
      'notaSustentacion',
      'resultadoSustentacion',
      'numeroRegistroLibroTitulo',
      'sesionConsejoFecha',
      'reglamentoMarco',
      'facultadNombre',
      'universidadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong>, el Acta de Sustentación de Tesis de fecha <strong>{{fechaSustentacionReal}}</strong> en la cual el(la) <strong>{{gradoBachiller}} {{tesistaIndividualNombre}}</strong> aprobó con nota <strong>{{notaSustentacion}} ({{resultadoSustentacion}})</strong> la defensa de la tesis <em>"{{tituloTesis}}"</em>, y el acuerdo del Consejo de Facultad en sesión de fecha <strong>{{sesionConsejoFecha}}</strong>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, habiendo cumplido satisfactoriamente con todos los requisitos académicos y administrativos exigidos por el Reglamento Marco de Grados y Títulos (<strong>{{reglamentoMarco}}</strong>), el Consejo de Facultad de la {{facultadNombre}} acordó aprobar el otorgamiento del Título Profesional correspondiente e inscribirlo en el Libro Oficial de Títulos (Registro N.º <strong>{{numeroRegistroLibroTitulo}}</strong>).</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- APROBAR</strong> el otorgamiento del <strong>TÍTULO PROFESIONAL DE {{tituloProfesional}}</strong> a favor del(de la) <strong>{{gradoBachiller}} {{tesistaIndividualNombre}}</strong>, de la Escuela Profesional de <strong>{{escuelaNombre}}</strong> de la {{facultadNombre}}.</p>
    <p><strong>ARTÍCULO SEGUNDO.- ELEVAR</strong> la presente Resolución y el expediente respectivo al Consejo Universitario de la {{universidadNombre}} para que confiera el Título Profesional y disponga la expedición del diploma correspondiente.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.COASESOR,
    nombre: 'Incorporación / Designación de Coasesor de Tesis',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Designar Docente Coasesor de Tesis - {{tesistasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistasTexto',
      'escuelaNombre',
      'tituloTesis',
      'asesorNombreCompleto',
      'coasesorNombreCompleto',
      'reglamentoMarco',
      'facultadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> presentado por <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, solicitando la incorporación de un Coasesor para el desarrollo de la Tesis intitulada: <em>"{{tituloTesis}}"</em>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, la naturaleza especializada e interdisciplinaria del tema de investigación justifica contar con el acompañamiento complementario de un Coasesor, en concordancia con el <strong>{{reglamentoMarco}}</strong> y con la conformidad del Docente Asesor principal <strong>{{asesorNombreCompleto}}</strong>.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO ÚNICO.- DESIGNAR</strong> a <strong>{{coasesorNombreCompleto}}</strong> como <strong>COASESOR</strong> del trabajo de Tesis intitulado: <em>"{{tituloTesis}}"</em>, presentado por <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de {{escuelaNombre}}.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.CAMBIO_ASESOR,
    nombre: 'Cambio de Docente Asesor de Tesis',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Autorizar Cambio de Docente Asesor de Tesis - {{tesistasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistasTexto',
      'escuelaNombre',
      'tituloTesis',
      'asesorAnteriorNombre',
      'asesorNombreCompleto',
      'resolucionAntecedenteNumero',
      'motivoCausa',
      'reglamentoMarco',
      'facultadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> mediante el cual <strong>{{tesistasTexto}}</strong>, de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, solicita el cambio de Docente Asesor por causal de <strong>{{motivoCausa}}</strong> respecto a la Resolución N.º <strong>{{resolucionAntecedenteNumero}}</strong>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, encontrándose acreditada la causal invocada conforme al <strong>{{reglamentoMarco}}</strong>, corresponde modificar la Resolución N.º {{resolucionAntecedenteNumero}} y designar al nuevo Docente Asesor para garantizar la continuidad de la Tesis intitulada: <em>"{{tituloTesis}}"</em>.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- MODIFICAR</strong> la Resolución N.º <strong>{{resolucionAntecedenteNumero}}</strong>, dando por concluida la designación de <strong>{{asesorAnteriorNombre}}</strong> y <strong>DESIGNANDO</strong> en su reemplazo a <strong>{{asesorNombreCompleto}}</strong> como nuevo <strong>DOCENTE ASESOR</strong> de la Tesis intitulada: <em>"{{tituloTesis}}"</em>, presentada por <strong>{{tesistasTexto}}</strong>.</p>
    <p><strong>ARTÍCULO SEGUNDO.- MANTENER</strong> subsistentes los demás extremos que no se opongan a la presente Resolución.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.CAMBIO_TITULO,
    nombre: 'Modificación de Título de Tesis',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Autorizar Modificación de Título de Tesis - {{tesistasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistasTexto',
      'escuelaNombre',
      'tituloAnterior',
      'tituloTesis',
      'resolucionAntecedenteNumero',
      'asesorNombreCompleto',
      'reglamentoMarco',
      'facultadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> y el informe técnico favorable del Docente Asesor <strong>{{asesorNombreCompleto}}</strong>, mediante el cual <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de <strong>{{escuelaNombre}}</strong> solicita la precisión o modificación del título de tesis aprobado con Resolución N.º <strong>{{resolucionAntecedenteNumero}}</strong>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, de acuerdo con el <strong>{{reglamentoMarco}}</strong>, procede la actualización del título cuando responde a observaciones de los dictaminantes o ajustes metodológicos que no alteran la esencia del tema inscrito.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- MODIFICAR</strong> el título del trabajo de investigación aprobado por Resolución N.º <strong>{{resolucionAntecedenteNumero}}</strong>, debiendo registrarse en adelante bajo la denominación oficial: <em>"{{tituloTesis}}"</em> (antes: <em>"{{tituloAnterior}}"</em>), correspondiente a <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de {{escuelaNombre}}.</p>
    <p><strong>ARTÍCULO SEGUNDO.- DISPONER</strong> la anotación marginal de la presente modificación en el Libro de Inscripción de Temas de Tesis correspondiente.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.CAMBIO_DICTAMINANTE,
    nombre: 'Reconformación / Cambio de Docente Dictaminante',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Autorizar Cambio de Docente Dictaminante - {{tesistasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistasTexto',
      'escuelaNombre',
      'tituloTesis',
      'resolucionAntecedenteNumero',
      'dictaminanteSalienteNombre',
      'dictaminanteEntranteNombre',
      'motivoCausa',
      'reglamentoMarco',
      'facultadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> correspondiente a <strong>{{tesistasTexto}}</strong> de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, sobre reconformación de Comisión Dictaminadora por causal de <strong>{{motivoCausa}}</strong> respecto a la Resolución N.º <strong>{{resolucionAntecedenteNumero}}</strong>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, a fin de no perjudicar los plazos de evaluación del Proyecto/Borrador de Tesis intitulado: <em>"{{tituloTesis}}"</em>, y en aplicación del <strong>{{reglamentoMarco}}</strong>, resulta necesario subrogar al docente impedido y designar un nuevo integrante.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- MODIFICAR</strong> la Resolución N.º <strong>{{resolucionAntecedenteNumero}}</strong>, incorporando a <strong>{{dictaminanteEntranteNombre}}</strong> como Docente Dictaminante en reemplazo de <strong>{{dictaminanteSalienteNombre}}</strong>, para la evaluación de la Tesis de <strong>{{tesistasTexto}}</strong> ({{escuelaNombre}}).</p>
    <p><strong>ARTÍCULO SEGUNDO.- DEJAR SUBSISTENTES</strong> los demás extremos de la Resolución N.º {{resolucionAntecedenteNumero}}.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.DSE,
    nombre: 'Dejar Sin Efecto Resolución(es) Anterior(es)',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Dejar Sin Efecto Resolución N.º {{resolucionesAfectadasTexto}}',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'resolucionesAfectadasTexto',
      'motivoCausa',
      'reglamentoMarco',
      'facultadNombre',
      'universidadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El informe de Secretaría Académica (Expediente ref.: <strong>{{expedienteCodigo}}</strong>) por el cual se solicita dejar sin efecto la(s) Resolución(es) N.º <strong>{{resolucionesAfectadasTexto}}</strong> por motivo de: <strong>{{motivoCausa}}</strong>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, dentro de la potestad de autotutela administrativa y en observancia del Reglamento Marco de Grados y Títulos (<strong>{{reglamentoMarco}}</strong>), corresponde dejar sin efecto los actos resolutivos afectados por causal sobreviniente o vicio advertido, actualizando los registros y libros oficiales correspondientes.</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- DEJAR SIN EFECTO</strong> en todos sus extremos la(s) Resolución(es) N.º <strong>{{resolucionesAfectadasTexto}}</strong>, en mérito a los fundamentos expuestos en la parte considerativa de la presente Resolución.</p>
    <p><strong>ARTÍCULO SEGUNDO.- DISPONER</strong> que Secretaría Académica registre la baja o reversión de estado en los libros y registros del sistema de grados y títulos.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
  {
    tipo: TipoResolucion.DESISTIMIENTO,
    nombre: 'Aceptación de Desistimiento de Trámite / Coautoría de Tesis',
    seriePorDefecto: SerieNumeracion.ORD,
    asuntoPlantilla:
      'Aceptar Desistimiento de Tesis - {{tesistaIndividualNombre}} ({{expedienteCodigo}})',
    variablesEsquema: [
      'ciudad',
      'fechaEmisionTexto',
      'numeroResolucion',
      'expedienteCodigo',
      'tesistaIndividualNombre',
      'escuelaNombre',
      'tituloTesis',
      'motivoCausa',
      'reglamentoMarco',
      'facultadNombre',
    ],
    cuerpoHtml: `<div class="resolucion-documento">
  <p class="lugar-fecha">{{ciudad}}, {{fechaEmisionTexto}}</p>
  <h2 class="titulo-resolucion">RESOLUCIÓN N.º {{numeroResolucion}}</h2>

  <div class="seccion-visto">
    <p><strong>VISTO:</strong></p>
    <p>El expediente <strong>{{expedienteCodigo}}</strong> y la solicitud con firma legalizada presentada por <strong>{{tesistaIndividualNombre}}</strong>, de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, formulando desistimiento respecto al desarrollo del trabajo de Tesis intitulado: <em>"{{tituloTesis}}"</em>; y,</p>
  </div>

  <div class="seccion-considerando">
    <p><strong>CONSIDERANDO:</strong></p>
    <p>Que, al amparo del Texto Único Ordenado de la Ley N.º 27444 y del Reglamento Marco de Grados y Títulos (<strong>{{reglamentoMarco}}</strong>), procede aceptar el desistimiento voluntario formulado por el(la) interesado(a) ({{motivoCausa}}).</p>
  </div>

  <div class="seccion-resuelve">
    <p><strong>SE RESUELVE:</strong></p>
    <p><strong>ARTÍCULO PRIMERO.- ACEPTAR EL DESISTIMIENTO</strong> presentado por <strong>{{tesistaIndividualNombre}}</strong>, de la Escuela Profesional de <strong>{{escuelaNombre}}</strong>, respecto al trabajo de Tesis intitulado: <em>"{{tituloTesis}}"</em> tramitado en el expediente <strong>{{expedienteCodigo}}</strong>.</p>
    <p><strong>ARTÍCULO SEGUNDO.- ACTUALIZAR</strong> la condición del(de la) solicitante en los registros de la Coordinación de Grados y Títulos y Secretaría Académica de la {{facultadNombre}}.</p>
  </div>

  <p class="cierre-formula">Regístrese, comuníquese y archívese.</p>
</div>`,
  },
];