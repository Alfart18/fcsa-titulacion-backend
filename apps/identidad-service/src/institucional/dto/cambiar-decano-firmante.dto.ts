// Ruta: apps/identidad-service/src/institucional/dto/cambiar-decano-firmante.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CambiarDecanoFirmanteDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID v4 del usuario con rol DECANO que asumirá la firma',
  })
  @IsUUID('4', {
    message: 'El identificador del usuario decano debe ser un UUID v4 válido.',
  })
  @IsNotEmpty({ message: 'El identificador del usuario decano es obligatorio.' })
  usuarioId!: string;
}