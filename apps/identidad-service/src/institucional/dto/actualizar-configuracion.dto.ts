// Ruta: apps/identidad-service/src/institucional/dto/actualizar-configuracion.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ActualizarConfiguracionDto {
  @ApiProperty({
    example: 'Resolución N.º 513-CU-2024-UAC',
    description: 'Denominación oficial del reglamento marco vigente',
  })
  @IsString({ message: 'El reglamento marco debe ser una cadena de texto.' })
  @IsNotEmpty({
    message: 'El reglamento marco es obligatorio y no puede estar vacío.',
  })
  @MaxLength(150, {
    message: 'El reglamento marco no puede exceder los 150 caracteres.',
  })
  reglamentoMarco!: string;
}