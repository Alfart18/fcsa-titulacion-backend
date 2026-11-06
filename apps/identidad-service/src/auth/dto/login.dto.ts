// Ruta: apps/identidad-service/src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'jarenas@uandina.edu.pe',
    description: 'Correo electrónico institucional del usuario',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El formato del correo institucional no es válido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  correo!: string;

  @ApiProperty({
    example: 'UacFcsa2026!',
    description: 'Contraseña de acceso',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password!: string;
}