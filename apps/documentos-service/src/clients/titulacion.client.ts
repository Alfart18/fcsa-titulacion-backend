import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { AxiosError } from 'axios';
import {
  SerieNumeracion,
  TipoResolucion,
} from '../templates/resolucion-templates.service';

export interface ResolucionRemotaDto {
  id: string;
  expedienteId: string | null;
  tipo: TipoResolucion;
  serie: SerieNumeracion;
  numeroCorrelativo: number;
  anioNumeracion: number;
  numeroCompleto: string;
  fechaEmision: string | Date;
  nombreDecanoSnapshot: string;
  inicialesOperador: string;
  datosEspecificos: Record<string, any>;
  idTramiteControl: string;
  versionPdf: number;
  hashVersionGenerado: string;
  expediente?: {
    codigoExpediente: string;
  } | null;
}

@Injectable()
export class TitulacionClient {
  private readonly baseUrl =
    process.env.TITULACION_SERVICE_URL || 'http://localhost:4001';

  constructor(private readonly httpService: HttpService) {}

  async obtenerResolucionPorId(
    resolucionId: string,
    authHeader?: string,
  ): Promise<ResolucionRemotaDto> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<ResolucionRemotaDto>(
          `${this.baseUrl}/api/resoluciones/${resolucionId}`,
          {
            headers: authHeader ? { Authorization: authHeader } : {},
          },
        ),
      );

      if (!response.data) {
        throw new NotFoundException('La resolución solicitada no existe.');
      }

      return response.data;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const axiosErr = error as AxiosError<{ message?: string }>;
      const status = axiosErr.response?.status;

      if (status === HttpStatus.NOT_FOUND) {
        throw new NotFoundException('La resolución solicitada no existe.');
      }

      if (status) {
        throw new HttpException(
          axiosErr.response?.data?.message ||
            `Error al consultar la resolución en titulacion-service (HTTP ${status}).`,
          status,
        );
      }

      throw new HttpException(
        'No fue posible comunicarse con titulacion-service para obtener los datos de la resolución.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}