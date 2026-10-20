import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '@app/database';
import { IdentidadServiceController } from './identidad-service.controller';
import { IdentidadServiceService } from './identidad-service.service';
import { JwtRolesGuard } from './guards/jwt-roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        if (!config.DATABASE_URL || typeof config.DATABASE_URL !== 'string') {
          throw new Error('FATAL: La variable de entorno DATABASE_URL es obligatoria.');
        }
        if (!config.JWT_SECRET || typeof config.JWT_SECRET !== 'string' || config.JWT_SECRET.length < 16) {
          throw new Error(
            'FATAL: La variable de entorno JWT_SECRET es obligatoria y debe tener al menos 16 caracteres.',
          );
        }
        return config;
      },
    }),
    DatabaseModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '8h') as any,
        },
      }),
    }),
  ],
  controllers: [IdentidadServiceController],
  providers: [IdentidadServiceService, JwtRolesGuard],
})
export class IdentidadServiceModule {}