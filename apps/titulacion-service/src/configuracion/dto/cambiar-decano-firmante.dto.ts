// Ruta: src/configuracion/dto/cambiar-decano-firmante.dto.ts
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CambiarDecanoFirmanteDto {
  @IsUUID('4', { message: 'El identificador del usuario decano debe ser un UUID v4 válido.' })
  @IsNotEmpty({ message: 'El identificador del usuario decano es obligatorio.' })
  usuarioId: string;
}