// Ruta: src/configuracion/dto/actualizar-configuracion.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ActualizarConfiguracionDto {
  @IsString({ message: 'El reglamento marco debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El reglamento marco es obligatorio y no puede estar vacío.' })
  @MaxLength(150, { message: 'El reglamento marco no puede exceder los 150 caracteres.' })
  reglamentoMarco: string;
}