import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ResolucionesService } from './resoluciones.service';
import { JwtRolesGuard, Roles } from '@app/common';
import { RolUsuario } from '@prisma/client';
import { EmitirPasoFlujoBodyDto } from './dto/emitir-paso-flujo.dto';

@UseGuards(JwtRolesGuard)
@Controller('api')
export class ResolucionesController {
  constructor(private readonly resolucionesService: ResolucionesService) {}

  // Emisión de cualquiera de los 7 Pasos Secuenciales:
  // ASESOR, DICTAMEN, INSCRIPCION, TERCER_DICT, APTO, FECHA_HORA, TITULO
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Post('expedientes/:id/pasos/:tipo')
  async emitirPasoFlujo(
    @Param('id', ParseUUIDPipe) expedienteId: string,
    @Param('tipo') tipo: string,
    @Body() body: EmitirPasoFlujoBodyDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.emitirPasoFlujoRegular(expedienteId, tipo, body, req.user);
  }

  // Confirmar firma de una resolución (Cambia de EMITIDO a FIRMADO y desbloquea el siguiente paso)
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Patch('resoluciones/:id/confirmar-firma')
  async confirmarFirma(
    @Param('id', ParseUUIDPipe) resolucionId: string,
    @Req() req: any,
  ) {
    return this.resolucionesService.confirmarFirmaResolucion(resolucionId, req.user);
  }

  // Corregir errores de tipeo en estado EMITIDO conservando el mismo número
  @Roles(RolUsuario.DECANO, RolUsuario.SECRETARIA_ACADEMICA, RolUsuario.ADMINISTRATIVO)
  @Patch('resoluciones/:id/corregir-borrador-emitido')
  async corregirBorradorEmitido(
    @Param('id', ParseUUIDPipe) resolucionId: string,
    @Body() body: EmitirPasoFlujoBodyDto,
    @Req() req: any,
  ) {
    return this.resolucionesService.corregirBorradorEmitido(resolucionId, body, req.user);
  }
}