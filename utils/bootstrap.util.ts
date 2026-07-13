import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { Reflector } from '@nestjs/core';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import { YemotRouterService } from './yemot/v2/yemot-router.service';
import { MaintenanceGuard } from '@shared/guards/maintenance.guard';

export function readPackageJsonName(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.name || 'nra-app';
  } catch {
    return 'nra-app';
  }
}

export interface BootstrapOptions {
  swaggerTitle: string;
  swaggerDescription?: string;
  swaggerVersion?: string;
  swaggerTag?: string;
  port?: number;
}

export function setupApplication(app: INestApplication, options: BootstrapOptions) {
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  // Setup maintenance mode guard
  const reflector = new Reflector();
  app.useGlobalGuards(new MaintenanceGuard(reflector));

  const config = new DocumentBuilder()
    .setTitle(options.swaggerTitle)
    .setDescription(options.swaggerDescription || '')
    .setVersion(options.swaggerVersion || '1.0')
    .addTag(options.swaggerTag || 'api')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const allowedOrigins = [
    new RegExp('http(s?)://' + process.env.DOMAIN_NAME),
    process.env.IP_ADDRESS && new RegExp('http(s?)://' + process.env.IP_ADDRESS + ':[\\d]*'),
  ];

  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push(new RegExp('http(s?)://localhost:[\\d]*'));
    allowedOrigins.push(new RegExp('http(s?)://127.0.0.1:[\\d]*'));
  }

  app.enableCors({
    credentials: true,
    origin: allowedOrigins.filter(Boolean) as (string | RegExp)[]
  });
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());
}

export function setupYemotRouter(app: INestApplication) {
  const yemotRouterSvc = app.get(YemotRouterService);
  app.use('/yemot/handle-call', yemotRouterSvc.getRouter());
}

export async function bootstrapNraApplication(
  module: any,
  options?: Partial<BootstrapOptions>,
): Promise<void> {
  const app = await NestFactory.create(module);

  setupApplication(app, {
    swaggerTitle: readPackageJsonName(),
    ...options,
  });

  try {
    setupYemotRouter(app);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('Nest could not find')) {
      throw err;
    }
    // YemotRouterService not registered in this module — skip
  }

  const port = options?.port ?? Number(process.env.PORT || 3000);

  // Must exceed Caddy's reverse_proxy transport.keepalive (30s) to avoid a
  // race where Caddy reuses a keep-alive connection Node already closed.
  const httpServer = app.getHttpServer();
  httpServer.keepAliveTimeout = 35_000;
  httpServer.headersTimeout = 36_000;

  await app.listen(port);
}
