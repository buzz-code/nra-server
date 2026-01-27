import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import { YemotRouterService } from './yemot/v2/yemot-router.service';

export interface BootstrapOptions {
  swaggerTitle: string;
  swaggerDescription?: string;
  swaggerVersion?: string;
  swaggerTag?: string;
}

export function setupApplication(app: INestApplication, options: BootstrapOptions) {
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

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
