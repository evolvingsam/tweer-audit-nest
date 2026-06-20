import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppService } from './app.service';

async function bootstrap() {
    // Create a standalone application context (no HTTP listener)
    const app = await NestFactory.createApplicationContext(AppModule);

    const appService = app.get(AppService);

    try {
        await appService.run();
    } catch (error) {
        console.error('Fatal error during execution:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

bootstrap();