import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ConfiguracionInstitucionalDto {
  id: number;
  facultad: string;
  universidad: string;
  ciudad: string;
  siglasFacultad: string;
  siglasUniversidad: string;
  reglamentoMarco: string;
}

export interface DecanoVigenteDto {
  id: string;
  gradoTitulo: string;
  nombresCompletos: string;
  iniciales: string;
  correo: string;
  nombreCompletoFormateado?: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class IdentidadClient {
  private readonly logger = new Logger(IdentidadClient.name);
  private readonly baseUrl =
    process.env.IDENTIDAD_SERVICE_URL || 'http://localhost:4000';
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutos

  private configuracionCache: CacheEntry<ConfiguracionInstitucionalDto> | null =
    null;
  private decanoCache: CacheEntry<DecanoVigenteDto> | null = null;

  private readonly defaultConfig: ConfiguracionInstitucionalDto = {
    id: 1,
    facultad: 'Facultad de Ciencias de la Salud',
    universidad: 'Universidad Andina del Cusco',
    ciudad: 'Cusco',
    siglasFacultad: 'FCSa',
    siglasUniversidad: 'UAC',
    reglamentoMarco: 'Resolución N.º 513-CU-2024-UAC',
  };

  constructor(private readonly httpService: HttpService) {}

  async obtenerConfiguracion(
    authHeader?: string,
  ): Promise<ConfiguracionInstitucionalDto> {
    const now = Date.now();
    if (this.configuracionCache && this.configuracionCache.expiresAt > now) {
      return this.configuracionCache.data;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          institucional?: ConfiguracionInstitucionalDto;
          facultad?: string;
          universidad?: string;
          ciudad?: string;
          siglasFacultad?: string;
          siglasUniversidad?: string;
          reglamentoMarco?: string;
        }>(`${this.baseUrl}/api/configuracion`, {
          headers: authHeader ? { Authorization: authHeader } : {},
        }),
      );

      const payload = response.data;
      const institucional: ConfiguracionInstitucionalDto =
        payload?.institucional ?? {
          id: 1,
          facultad: payload?.facultad || this.defaultConfig.facultad,
          universidad: payload?.universidad || this.defaultConfig.universidad,
          ciudad: payload?.ciudad || this.defaultConfig.ciudad,
          siglasFacultad:
            payload?.siglasFacultad || this.defaultConfig.siglasFacultad,
          siglasUniversidad:
            payload?.siglasUniversidad || this.defaultConfig.siglasUniversidad,
          reglamentoMarco:
            payload?.reglamentoMarco || this.defaultConfig.reglamentoMarco,
        };

      this.configuracionCache = {
        data: institucional,
        expiresAt: now + this.cacheTtlMs,
      };

      return institucional;
    } catch (error) {
      this.logger.warn(
        `No se pudo obtener /api/configuracion desde identidad-service (${(error as Error).message}). Usando valores por defecto.`,
      );
      return this.configuracionCache?.data ?? this.defaultConfig;
    }
  }

  async obtenerDecanoVigente(
    authHeader?: string,
  ): Promise<DecanoVigenteDto | null> {
    const now = Date.now();
    if (this.decanoCache && this.decanoCache.expiresAt > now) {
      return this.decanoCache.data;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<DecanoVigenteDto>(
          `${this.baseUrl}/api/institucional/decano-vigente`,
          {
            headers: authHeader ? { Authorization: authHeader } : {},
          },
        ),
      );

      const decano = response.data;
      this.decanoCache = {
        data: decano,
        expiresAt: now + this.cacheTtlMs,
      };

      return decano;
    } catch (error) {
      this.logger.warn(
        `No se pudo obtener /api/institucional/decano-vigente desde identidad-service (${(error as Error).message}).`,
      );
      return this.decanoCache?.data ?? null;
    }
  }
}