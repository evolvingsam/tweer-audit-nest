import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { LoaderService } from './loader/loader.service';
import { EvaluatorService } from './evaluator/evaluator.service';

@Module({
    imports: [ConfigModule.forRoot()],
    providers: [AppService, LoaderService, EvaluatorService],
})
export class AppModule { }